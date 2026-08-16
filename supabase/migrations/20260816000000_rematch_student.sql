-- Per-student study group rematching.
--
-- Replaces the old, undocumented `auto_assign_groups()` RPC (which lived only
-- in the live project, took no arguments, and reassigned ALL students at
-- once) with a scoped function that only ever touches the calling student's
-- own group_members rows. Safe to call automatically after onboarding,
-- profile edits, and leaving a group, as well as from the manual
-- "Find My Groups" button.
--
-- Rematching is additive-only: it fills in a group for classes where the
-- student currently has none, and never removes/moves an existing
-- membership. Dropping a class does not auto-remove the student from that
-- class's group; leaving stays a manual action.
--
-- Live schema notes (confirmed via information_schema before writing this):
--   - students.classes and students.preferred_locations are jsonb (JSON
--     arrays of strings), not Postgres text[] — handled below with jsonb
--     operators (?, jsonb_array_elements_text) rather than array ops.
--   - study_groups had no `status` or `schedule_type` columns even though
--     src/components/MyGroup.js already reads/relies on both — added below
--     so the existing client-side scoring logic (which silently no-ops on
--     undefined status today) starts working as originally intended.
--   - study_groups.id / group_members.group_id are uuid, as assumed.

-- Add the columns the client already expects but the table never had.
alter table study_groups add column if not exists status text not null default 'forming';
alter table study_groups add column if not exists schedule_type text;

-- Required for `on conflict (group_id, user_id)` below and for idempotent reruns.
create unique index if not exists group_members_group_id_user_id_key
  on group_members (group_id, user_id);

-- Mirrors DAY_ABBRS in src/components/MyGroup.js
create or replace function _blk_day_abbr(p_date date)
returns text language sql immutable as $$
  select (array['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[extract(dow from p_date)::int + 1];
$$;

-- Mirrors isCoordinateGroup() in src/components/MyGroup.js
create or replace function _blk_is_coordinate_group(p_schedule_type text, p_day_of_week text, p_time_slot text)
returns boolean language sql immutable as $$
  select p_schedule_type = 'coordinate'
      or p_day_of_week is null
      or p_time_slot is null
      or p_time_slot ~* 'coordinate';
$$;

-- Mirrors studentOverlapsGroup() in src/components/MyGroup.js
create or replace function _blk_student_overlaps_slot(p_availability jsonb, p_day_of_week text, p_time_slot text)
returns boolean language sql stable as $$
  select exists (
    select 1 from jsonb_each(coalesce(p_availability, '{}'::jsonb)) as avail(date_key, times)
    where _blk_day_abbr(avail.date_key::date) = p_day_of_week
      and times @> to_jsonb(p_time_slot::text)
  );
$$;

-- Mirrors groupMajorityLocations() in src/components/MyGroup.js
create or replace function _blk_group_majority_locations(p_group_id uuid)
returns text[] language sql stable as $$
  with loc_counts as (
    select loc, count(*) as cnt
    from group_members gm
    join students s on s.user_id = gm.user_id
    cross join lateral jsonb_array_elements_text(coalesce(s.preferred_locations, '[]'::jsonb)) as loc
    where gm.group_id = p_group_id
    group by loc
  ), max_cnt as (select coalesce(max(cnt), 0) as m from loc_counts)
  select coalesce(array_agg(loc), '{}'::text[])
  from loc_counts, max_cnt where cnt = max_cnt.m and max_cnt.m > 0;
$$;

-- Mirrors scoreGroup() weighting in src/components/MyGroup.js:
-- 50 class match / 30 quorum fill / 20 forming status / 20 location overlap, out of 120, as a %.
create or replace function _blk_score_group(p_user_id uuid, p_group study_groups)
returns numeric language plpgsql stable as $$
declare
  v_student students%rowtype;
  v_coordinate boolean;
  v_member_count int;
  v_raw numeric := 0;
  v_majority text[];
begin
  select * into v_student from students where user_id = p_user_id;
  if not found then return 0; end if;

  v_coordinate := _blk_is_coordinate_group(p_group.schedule_type, p_group.day_of_week, p_group.time_slot);

  if not v_coordinate and not _blk_student_overlaps_slot(v_student.availability_dates, p_group.day_of_week, p_group.time_slot) then
    return 0;
  end if;

  if coalesce(v_student.classes, '[]'::jsonb) ? p_group.class_code then
    v_raw := v_raw + 50;
  end if;

  select count(*) into v_member_count from group_members where group_id = p_group.id;
  v_raw := v_raw + least(v_member_count::numeric / 4, 1) * 30;

  if p_group.status = 'forming' then
    v_raw := v_raw + 20;
  end if;

  v_majority := _blk_group_majority_locations(p_group.id);
  if array_length(v_majority, 1) > 0 and exists (
    select 1 from jsonb_array_elements_text(coalesce(v_student.preferred_locations, '[]'::jsonb)) as loc
    where loc = any(v_majority)
  ) then
    v_raw := v_raw + 20;
  end if;

  if v_coordinate then
    return least((v_raw / 120) * 100, 90);
  else
    return (v_raw / 120) * 100;
  end if;
end;
$$;

-- Main entry point, called from the client via supabase.rpc('rematch_student', { p_user_id }).
create or replace function rematch_student(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_class text;
  v_student students%rowtype;
  v_already_has_group boolean;
  v_best_group_id uuid;
  v_best_score numeric;
  v_new_group_id uuid;
  rec record;
  v_score numeric;
begin
  -- Only a student may rematch themselves; service_role (auth.uid() is null) may call for anyone.
  if v_caller is not null and v_caller <> p_user_id then
    raise exception 'Not authorized to rematch another student';
  end if;

  select * into v_student from students where user_id = p_user_id;
  if not found then
    raise exception 'Student profile not found for %', p_user_id;
  end if;

  if v_student.classes is null or jsonb_typeof(v_student.classes) <> 'array' or jsonb_array_length(v_student.classes) = 0 then
    return;
  end if;

  for v_class in select jsonb_array_elements_text(v_student.classes) loop
    -- Serialize concurrent rematches for the same class so two students
    -- calling near-simultaneously see each other's writes instead of both
    -- creating redundant groups. Released automatically at transaction commit.
    perform pg_advisory_xact_lock(hashtextextended('rematch_class:' || v_class, 0));

    -- Additive-only / idempotent: skip classes where the student already has a live group.
    select exists (
      select 1 from group_members gm
      join study_groups sg on sg.id = gm.group_id
      where gm.user_id = p_user_id and sg.class_code = v_class and sg.status <> 'cancelled'
    ) into v_already_has_group;

    if v_already_has_group then
      continue;
    end if;

    v_best_group_id := null;
    v_best_score := 0;

    for rec in
      select sg.*
      from study_groups sg
      where sg.class_code = v_class
        and sg.status = 'forming'
        and (select count(*) from group_members gm2 where gm2.group_id = sg.id) < 4
        and not exists (select 1 from group_members gm3 where gm3.group_id = sg.id and gm3.user_id = p_user_id)
    loop
      v_score := _blk_score_group(p_user_id, rec);
      if v_score > v_best_score then
        v_best_score := v_score;
        v_best_group_id := rec.id;
      end if;
    end loop;

    if v_best_group_id is not null and v_best_score > 0 then
      insert into group_members (group_id, user_id)
      values (v_best_group_id, p_user_id)
      on conflict (group_id, user_id) do nothing;
    else
      insert into study_groups (class_code, status, schedule_type)
      values (v_class, 'forming', 'coordinate')
      returning id into v_new_group_id;

      insert into group_members (group_id, user_id)
      values (v_new_group_id, p_user_id)
      on conflict (group_id, user_id) do nothing;
    end if;
  end loop;
end;
$$;

grant execute on function rematch_student(uuid) to authenticated;

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { connectGoogleCalendar, createGoogleCalendarEvent } from '../services/googleCalendarService';
import '../styles/MyGroup.css';

// ─── Scoring constants ────────────────────────────────────────────────────────
const DAY_ABBRS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const QUORUM = 4;
const MAX_RAW = 120; // 50 + 30 + 20 + 20

function isCoordinateGroup(group) {
  if (group.schedule_type === 'coordinate') return true;
  if (!group.day_of_week || !group.time_slot) return true;
  if (typeof group.time_slot === 'string' && /coordinate/i.test(group.time_slot)) return true;
  return false;
}

function studentOverlapsGroup(availabilityDates, dayOfWeek, timeSlot) {
  return Object.entries(availabilityDates || {}).some(([dateKey, times]) => {
    const abbr = DAY_ABBRS[new Date(`${dateKey}T00:00:00`).getDay()];
    return abbr === dayOfWeek && (times || []).includes(timeSlot);
  });
}

function groupMajorityLocations(group) {
  const counts = {};
  (group.members || []).forEach((m) => {
    (m.preferred_locations || []).forEach((loc) => {
      counts[loc] = (counts[loc] || 0) + 1;
    });
  });
  if (!Object.keys(counts).length) return [];
  const max = Math.max(...Object.values(counts));
  return Object.keys(counts).filter((l) => counts[l] === max);
}

function scoreGroup(group, student) {
  if (!student) return 0;
  if (group.status === 'cancelled') return 0;

  const coordinate = isCoordinateGroup(group);

  if (!coordinate && !studentOverlapsGroup(
    student.availability_dates, group.day_of_week, group.time_slot
  )) {
    return 0;
  }

  let raw = 0;
  if ((student.classes || []).includes(group.class_code)) raw += 50;
  raw += Math.min((group.members?.length || 0) / QUORUM, 1) * 30;
  if (group.status === 'forming') raw += 20;
  const majority = groupMajorityLocations(group);
  if (majority.length && (student.preferred_locations || []).some((l) => majority.includes(l))) {
    raw += 20;
  }

  const normalized = (raw / MAX_RAW) * 100;
  return coordinate ? Math.min(normalized, 90) : normalized;
}

// Reads pre-computed group.matchScore, cancelled always last.
function sortByScore(groups) {
  return [...groups].sort((a, b) => {
    const aCancelled = a.status === 'cancelled';
    const bCancelled = b.status === 'cancelled';
    if (aCancelled !== bCancelled) return aCancelled ? 1 : -1;
    return (b.matchScore ?? 0) - (a.matchScore ?? 0);
  });
}

function getScoreMeta(score, status) {
  if (status === 'cancelled') return { label: 'Cancelled', cls: 'match-score-cancelled' };
  if (score === 0) return { label: 'No overlap', cls: 'match-score-none' };
  if (score >= 75) return { label: `${Math.round(score)}% match`, cls: 'match-score-high' };
  if (score >= 40) return { label: `${Math.round(score)}% match`, cls: 'match-score-med' };
  return { label: `${Math.round(score)}% match`, cls: 'match-score-low' };
}

// ─────────────────────────────────────────────────────────────────────────────
export default function MyGroup({ userId }) {
  const [groups, setGroups] = useState([]);
  const [userClasses, setUserClasses] = useState([]);
  const [studentProfile, setStudentProfile] = useState(null);
  const [potentialGroupsByClass, setPotentialGroupsByClass] = useState({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [calendarStatus, setCalendarStatus] = useState({});

  function getSharedAvailability(members) {
    if (!members || members.length === 0) return [];

    const availabilities = members.map((member) => member.availability_dates || {});
    if (availabilities.some((availability) => Object.keys(availability).length === 0)) {
      return [];
    }

    const firstDates = Object.keys(availabilities[0]);
    const shared = firstDates.reduce((acc, date) => {
      const initialTimes = availabilities[0][date] || [];
      if (initialTimes.length === 0) return acc;

      const commonTimes = availabilities.slice(1).reduce((times, availability) => {
        const nextTimes = availability[date] || [];
        return times.filter((time) => nextTimes.includes(time));
      }, initialTimes);

      if (commonTimes.length > 0) {
        acc.push({ date, times: commonTimes });
      }
      return acc;
    }, []);

    return shared;
  }

  const enrichGroups = useCallback(async (rawGroups) => {
    const enriched = await Promise.all(
      (rawGroups || []).map(async (group) => {
        const { data: members } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', group.id);

        const memberIds = (members || []).map((member) => member.user_id);
        const { data: studentDetails } = memberIds.length > 0
          ? await supabase
            .from('students')
            .select('user_id, first_name, last_name, instagram, phone, classes, availability_dates, preferred_locations, google_calendar_connected')
            .in('user_id', memberIds)
          : { data: [] };

        return {
          ...group,
          members: studentDetails || [],
          matched_availability: getSharedAvailability(studentDetails || []),
          isUserMember: memberIds.includes(userId),
        };
      })
    );

    return enriched;
  }, [userId]);

  const fetchMyGroups = useCallback(async () => {
    setLoading(true);

    const { data: student } = await supabase
      .from('students')
      .select('classes, availability_dates, preferred_locations')
      .eq('user_id', userId)
      .maybeSingle();

    const classes = student?.classes || [];
    setUserClasses(classes);
    setStudentProfile(student);

    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId);

    const groupIds = (memberships || []).map((membership) => membership.group_id);
    const { data: myGroupDetails } = groupIds.length > 0
      ? await supabase
        .from('study_groups')
        .select('*')
        .in('id', groupIds)
      : { data: [] };

    const myGroups = await enrichGroups(myGroupDetails || []);
    const scoredMyGroups = sortByScore(
      myGroups.map((g) => ({ ...g, matchScore: scoreGroup(g, student) }))
    );
    setGroups(scoredMyGroups);

    const { data: potentialGroupDetails } = classes.length > 0
      ? await supabase
        .from('study_groups')
        .select('*')
        .in('class_code', classes)
      : { data: [] };

    const allPotentialGroups = await enrichGroups(potentialGroupDetails || []);
    const potentialGroups = allPotentialGroups.filter((g) => !g.isUserMember);
    const groupedPotentialGroups = potentialGroups.reduce((acc, group) => {
      const classCode = group.class_code || 'Other';
      if (!acc[classCode]) acc[classCode] = [];
      acc[classCode].push({ ...group, matchScore: scoreGroup(group, student) });
      return acc;
    }, {});

    Object.keys(groupedPotentialGroups).forEach((classCode) => {
      groupedPotentialGroups[classCode] = sortByScore(groupedPotentialGroups[classCode]);
    });

    setPotentialGroupsByClass(groupedPotentialGroups);
    setLoading(false);
  }, [enrichGroups, userId]);

  useEffect(() => {
    fetchMyGroups();
  }, [fetchMyGroups]);

  async function runMatcher() {
    setRunning(true);
    const { error } = await supabase.rpc('auto_assign_groups');
    setRunning(false);
    if (error) showToast(`Error: ${error.message}`);
    else {
      showToast('Groups updated!');
      fetchMyGroups();
    }
  }

  function getEventStartEnd(dateKey, timeSlot) {
    const [timePart, meridiem] = timeSlot.split(' ');
    const [hourString, minuteString] = timePart.split(':');
    let hour = Number(hourString);
    const minute = Number(minuteString);

    if (meridiem === 'PM' && hour !== 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;

    const start = new Date(`${dateKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return { start, end };
  }

  const createCalendarEventForGroup = useCallback(async (group, storageKey) => {
    if (!group.matched_availability || group.matched_availability.length === 0) return;

    const [match] = group.matched_availability;
    if (!match?.times || match.times.length === 0) return;

    setCalendarStatus((prev) => ({
      ...prev,
      [group.id]: { loading: true, message: 'Creating calendar event...' },
    }));

    try {
      await connectGoogleCalendar();
      const { start, end } = getEventStartEnd(match.date, match.times[0]);
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      await createGoogleCalendarEvent({
        summary: `Study group: ${group.class_code}`,
        description: `Study group matched on ${match.date} at ${match.times[0]} with ${group.members.length} members.`,
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        timeZone,
      });

      const key = storageKey || `berklink_calendar_event_created_${group.id}`;
      localStorage.setItem(key, 'true');

      setCalendarStatus((prev) => ({
        ...prev,
        [group.id]: { loading: false, message: 'Added to Google Calendar' },
      }));
    } catch (err) {
      setCalendarStatus((prev) => ({
        ...prev,
        [group.id]: { loading: false, message: err.message || 'Unable to create calendar event' },
      }));
      console.error('Calendar event creation error:', err);
    }
  }, []);

  useEffect(() => {
    groups.forEach((group) => {
      const currentMember = group.members.find((member) => member.user_id === userId);
      if (!currentMember?.google_calendar_connected) return;
      if (!group.matched_availability || group.matched_availability.length === 0) return;

      const storageKey = `berklink_calendar_event_created_${group.id}`;
      if (localStorage.getItem(storageKey)) return;

      createCalendarEventForGroup(group, storageKey);
    });
  }, [createCalendarEventForGroup, groups, userId]);

  async function leaveGroup(groupId) {
    await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    fetchMyGroups();
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function formatExactTimes(sharedAvailability) {
    if (!sharedAvailability || sharedAvailability.length === 0) {
      return 'No exact times matched yet';
    }

    return sharedAvailability
      .map(({ date, times }) => {
        const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
        return `${dateLabel}: ${times.join(', ')}`;
      })
      .join(' · ');
  }

  function memberDisplayName(member) {
    const full = [member.first_name, member.last_name].filter(Boolean).join(' ');
    return full || member.instagram || 'unknown';
  }

  function renderMemberCard(member) {
    return (
      <div
        key={member.user_id}
        className={`member-tile ${member.user_id === userId ? 'is-you' : ''}`}
        onClick={() => member.user_id !== userId && setSelectedMember(member)}
      >
        <div className="m-avatar">
          {(member.first_name || member.instagram)?.[0]?.toUpperCase() || '?'}
          {member.user_id === userId && <span className="you-tag">YOU</span>}
        </div>
        <div className="m-name">{memberDisplayName(member)}</div>
        <div className="m-handle">@{member.instagram || 'unknown'}</div>
        {member.classes && member.classes.length > 0 && (
          <div className="m-class">{member.classes[0]}</div>
        )}
        {member.user_id !== userId && (
          <div className="m-tap">View profile →</div>
        )}
      </div>
    );
  }

  async function joinGroup(groupId) {
    await supabase.from('group_members').insert({ group_id: groupId, user_id: userId });
    fetchMyGroups();
  }

  function renderGroupCard(group, options = {}) {
    const { canLeave = false, showCalendarSync = false, canJoin = false } = options;

    return (
      <div key={group.id} className={`group-card ${group.isUserMember ? 'is-member' : 'is-potential'}`}>
        <div className="group-card-header">
          <div>
            <div className="group-class">{group.class_code}</div>
            <div className="group-meta">
              {group.day_of_week && <span>📅 {group.day_of_week}</span>}
              {group.time_slot && <span>🕐 {group.time_slot}</span>}
            </div>
            {group.matched_availability && group.matched_availability.length > 0 && (
              <div className="group-exact-times">
                Exact matches: {formatExactTimes(group.matched_availability)}
              </div>
            )}
            {showCalendarSync && (
              <div className="group-calendar-sync">
                {group.members.some((member) => member.user_id === userId && member.google_calendar_connected) ? (
                  <button
                    className="sync-calendar-btn"
                    type="button"
                    onClick={() => createCalendarEventForGroup(group)}
                    disabled={calendarStatus[group.id]?.loading}
                  >
                    {calendarStatus[group.id]?.loading ? 'Syncing...' : (calendarStatus[group.id]?.message || 'Sync to Google Calendar')}
                  </button>
                ) : (
                  <span className="calendar-sync-note">Connect Google Calendar from your profile to sync.</span>
                )}
              </div>
            )}
          </div>
          <div className="group-header-right">
            {group.matchScore !== undefined && (() => {
              const { label, cls } = getScoreMeta(group.matchScore, group.status);
              return <span className={`match-score-badge ${cls}`}>{label}</span>;
            })()}
            <span className="member-count-badge">{group.members.length} members</span>
            {canJoin && (
              <button className="join-btn" onClick={() => joinGroup(group.id)}>
                Join
              </button>
            )}
            {canLeave && (
              <button className="leave-btn" onClick={() => leaveGroup(group.id)}>
                Leave
              </button>
            )}
          </div>
        </div>

        <div className="members-row">
          {group.members.map(renderMemberCard)}
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="loading-container"><div className="loading-spinner">Loading...</div></div>;
  }

  // groups is already sorted by score; keep the availability filter, order is preserved.
  const matchedGroups = groups.filter((group) => group.matched_availability && group.matched_availability.length > 0);
  const classSections = userClasses.length > 0 ? userClasses : Object.keys(potentialGroupsByClass);

  return (
    <div className="mygroup-container">
      {toast && <div className="toast-message">{toast}</div>}

      {selectedMember && (
        <div className="profile-modal-overlay" onClick={() => setSelectedMember(null)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedMember(null)}>X</button>

            <div className="modal-avatar">
              {(selectedMember.first_name || selectedMember.instagram)?.[0]?.toUpperCase() || '?'}
            </div>
            <h2 className="modal-name">{memberDisplayName(selectedMember)}</h2>
            <div className="modal-instagram">@{selectedMember.instagram}</div>

            <div className="modal-section">
              <h4>Contact</h4>
              {selectedMember.instagram && (
                <a
                  href={`https://instagram.com/${selectedMember.instagram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="modal-link instagram"
                >
                  Instagram: @{selectedMember.instagram}
                </a>
              )}
              {selectedMember.phone && (
                <a href={`tel:${selectedMember.phone}`} className="modal-link phone">
                  Phone: {selectedMember.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}
                </a>
              )}
            </div>

            {selectedMember.classes && selectedMember.classes.length > 0 && (
              <div className="modal-section">
                <h4>Classes</h4>
                <div className="modal-classes">
                  {selectedMember.classes.map((cls) => (
                    <span key={cls} className="modal-class-tag">{cls}</span>
                  ))}
                </div>
              </div>
            )}

            {selectedMember.availability_dates && Object.keys(selectedMember.availability_dates).length > 0 && (
              <div className="modal-section">
                <h4>Availability</h4>
                <div className="modal-availability">
                  {Object.entries(selectedMember.availability_dates).map(([date, times]) => {
                    const label = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    });

                    return (
                      <div key={date} className="modal-avail-row">
                        <span className="modal-avail-date">{label}</span>
                        <span className="modal-avail-times">
                          {times.length > 0 ? times.join(', ') : 'No times set'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mygroup-header">
        <div className="section-header">
          <div className="section-title">My Study Groups</div>
          <button className="refresh-btn" onClick={runMatcher} disabled={running}>
            {running ? 'Finding...' : '⚡ Find My Groups'}
          </button>
        </div>
        <p className="groups-count">You're in {groups.length} group{groups.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="groups-section">
        <div className="section-heading">
          <h3>Your Groups</h3>
          <p>Groups that already match your class and exact time availability.</p>
        </div>

        {matchedGroups.length === 0 ? (
          <div className="empty-state compact">
            <div className="empty-icon">?</div>
            <h3>No matched groups yet</h3>
            <p>Click "Find / Refresh My Groups" above to get matched with students in your classes on the same dates and times.</p>
          </div>
        ) : (
          <div className="groups-list">
            {matchedGroups.map((group) => renderGroupCard(group, { canLeave: true, showCalendarSync: true }))}
          </div>
        )}
      </div>

      <div className="groups-section">
        <div className="section-heading">
          <h3>All Potential Groups For Your Classes</h3>
          <p>Each class has its own scrollable container so you can browse options separately.</p>
        </div>

        {classSections.length === 0 ? (
          <div className="empty-state compact">
            <div className="empty-icon">+</div>
            <h3>No classes added yet</h3>
            <p>Add your classes in onboarding or your profile to see potential study groups here.</p>
          </div>
        ) : (
          <div className="class-groups-sections">
            {classSections.map((classCode) => {
              const classGroups = potentialGroupsByClass[classCode] || [];

              return (
                <section key={classCode} className="class-groups-panel">
                  <div className="class-groups-header">
                    <span className="group-badge">{classCode}</span>
                    <p>{classGroups.length} potential group{classGroups.length !== 1 ? 's' : ''}</p>
                  </div>

                  {classGroups.length === 0 ? (
                    <div className="class-groups-empty">
                      No groups found for {classCode} yet.
                    </div>
                  ) : (
                    <div className="class-groups-scroll">
                      {classGroups.map((group) => renderGroupCard(group, { canJoin: true }))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

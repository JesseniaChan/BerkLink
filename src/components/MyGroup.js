import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function MyGroup({ userId }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { fetchMyGroups(); }, []);

  async function fetchMyGroups() {
    setLoading(true);

    // Get all group IDs this user belongs to
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId);

    if (!memberships || memberships.length === 0) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const groupIds = memberships.map(m => m.group_id);

    // Get group details
    const { data: groupDetails } = await supabase
      .from('study_groups')
      .select('*')
      .in('id', groupIds);

    // For each group, get members with their student info
    const enriched = await Promise.all(
      (groupDetails || []).map(async (group) => {
        const { data: members } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', group.id);

        const memberIds = (members || []).map(m => m.user_id);

        const { data: studentDetails } = await supabase
          .from('students')
          .select('user_id, instagram, phone')
          .in('user_id', memberIds);

        return { ...group, members: studentDetails || [] };
      })
    );

    setGroups(enriched);
    setLoading(false);
  }

  async function runMatcher() {
    setRunning(true);
    const { error } = await supabase.rpc('auto_assign_groups');
    setRunning(false);
    if (error) showToast('Error: ' + error.message);
    else {
      showToast('Groups updated!');
      fetchMyGroups();
    }
  }

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

  if (loading) return <div className="loading-container"><div className="loading-spinner">Loading...</div></div>;

  return (
    <div className="mygroup-container">
      {toast && <div className="toast">{toast}</div>}

      <div className="mygroup-header">
        <h2>My Study Groups</h2>
        <p>You're in {groups.length} group{groups.length !== 1 ? 's' : ''}</p>
        <button className="run-matcher-btn" onClick={runMatcher} disabled={running}>
          {running ? 'Finding groups...' : '⚡ Find / Refresh My Groups'}
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>No groups yet</h3>
          <p>Click "Find My Groups" above to get matched with students in your classes on the same dates and times.</p>
        </div>
      ) : (
        <div className="groups-list">
          {groups.map(group => (
            <div key={group.id} className="group-card">
              <div className="group-card-header">
                <div>
                  <span className="group-badge">{group.class_code}</span>
                  <div className="group-meta">
                    <span>📅 {group.day_of_week}</span>
                    <span>🕐 {group.time_slot}</span>
                    <span>👥 {group.members.length} members</span>
                  </div>
                </div>
                <button className="leave-btn" onClick={() => leaveGroup(group.id)}>
                  Leave
                </button>
              </div>

              <div className="members-list">
                {group.members.map(member => (
                  <div key={member.user_id} className={`member-card ${member.user_id === userId ? 'is-you' : ''}`}>
                    <div className="member-avatar">
                      {member.instagram?.[0]?.toUpperCase() || '?'}
                      {member.user_id === userId && <span className="you-badge">You</span>}
                    </div>
                    <div className="member-info">
                      {member.instagram && (
                        <div className="member-detail">
                          <span className="detail-label">Instagram:</span>
                          <a href={`https://instagram.com/${member.instagram}`} target="_blank" rel="noreferrer">
                            @{member.instagram}
                          </a>
                        </div>
                      )}
                      {member.phone && (
                        <div className="member-detail">
                          <span className="detail-label">Phone:</span>
                          <a href={`tel:${member.phone}`}>{member.phone}</a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/MyGroup.css';

export default function MyGroup({ userId }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState('');
  const [selectedMember, setSelectedMember] = useState(null); // for profile modal

  useEffect(() => { fetchMyGroups(); }, []);

  async function fetchMyGroups() {
    setLoading(true);

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

    const { data: groupDetails } = await supabase
      .from('study_groups')
      .select('*')
      .in('id', groupIds);

    const enriched = await Promise.all(
      (groupDetails || []).map(async (group) => {
        const { data: members } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', group.id);

        const memberIds = (members || []).map(m => m.user_id);

        const { data: studentDetails } = await supabase
          .from('students')
          .select('user_id, instagram, phone, classes, availability_dates')
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
    else { showToast('Groups updated!'); fetchMyGroups(); }
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

  function formatDates(availability_dates) {
    if (!availability_dates) return 'No availability set';
    return Object.entries(availability_dates)
      .map(([date, times]) => {
        const d = new Date(date + 'T00:00:00');
        const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        return times.length > 0 ? `${label}: ${times.join(', ')}` : label;
      })
      .join(' · ');
  }

  if (loading) return <div className="loading-container"><div className="loading-spinner">Loading...</div></div>;

  return (
    <div className="mygroup-container">
      {toast && <div className="toast-message">{toast}</div>}

      {/* Profile Modal */}
      {selectedMember && (
        <div className="profile-modal-overlay" onClick={() => setSelectedMember(null)}>
          <div className="profile-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedMember(null)}>✕</button>

            <div className="modal-avatar">
              {selectedMember.instagram?.[0]?.toUpperCase() || '?'}
            </div>
            <h2 className="modal-name">@{selectedMember.instagram}</h2>

            <div className="modal-section">
              <h4>Contact</h4>
              {selectedMember.instagram && (
                <a
                  href={`https://instagram.com/${selectedMember.instagram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="modal-link instagram"
                >
                  📸 @{selectedMember.instagram}
                </a>
              )}
              {selectedMember.phone && (
                <a href={`tel:${selectedMember.phone}`} className="modal-link phone">
                  📞 {selectedMember.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}
                </a>
              )}
            </div>

            {selectedMember.classes && selectedMember.classes.length > 0 && (
              <div className="modal-section">
                <h4>Classes</h4>
                <div className="modal-classes">
                  {selectedMember.classes.map(cls => (
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
                    const d = new Date(date + 'T00:00:00');
                    const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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

      {/* Header */}
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
          <p>Click "Find / Refresh My Groups" above to get matched with students in your classes on the same dates and times.</p>
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

              <div className="members-grid">
                {group.members.map(member => (
                  <div
                    key={member.user_id}
                    className={`member-card ${member.user_id === userId ? 'is-you' : ''}`}
                    onClick={() => member.user_id !== userId && setSelectedMember(member)}
                  >
                    <div className="member-avatar">
                      {member.instagram?.[0]?.toUpperCase() || '?'}
                      {member.user_id === userId && <span className="you-badge">You</span>}
                    </div>
                    <div className="member-info">
                      <div className="member-handle">@{member.instagram || 'unknown'}</div>
                      {member.classes && (
                        <div className="member-classes">
                          {member.classes.slice(0, 3).map(cls => (
                            <span key={cls} className="mini-class-tag">{cls}</span>
                          ))}
                        </div>
                      )}
                      {member.user_id !== userId && (
                        <span className="view-profile-hint">Tap to view profile →</span>
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

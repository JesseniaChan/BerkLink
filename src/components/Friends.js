import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/Friends.css';

const GIFTS = [
  { emoji: '☕', label: 'Coffee Run' },
  { emoji: '📚', label: 'Study Buddy' },
  { emoji: '⭐', label: 'Star Student' },
  { emoji: '🔥', label: 'On Fire' },
  { emoji: '🧠', label: 'Big Brain' },
  { emoji: '💪', label: 'Study Warrior' },
  { emoji: '🎯', label: 'Focused' },
  { emoji: '🏆', label: 'Champion' },
];

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function streakEmoji(count) {
  if (count >= 30) return '🌟';
  if (count >= 14) return '💎';
  if (count >= 7) return '🔥';
  return '🔥';
}

export default function Friends({ userId }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [friends, setFriends] = useState([]);         // { friendship, student, streak }
  const [incoming, setIncoming] = useState([]);        // pending where I'm addressee
  const [outgoing, setOutgoing] = useState([]);        // pending where I'm requester
  const [recentGifts, setRecentGifts] = useState([]);  // gifts received

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Gift modal
  const [giftTarget, setGiftTarget] = useState(null);  // { id, instagram }
  const [giftMessage, setGiftMessage] = useState('');
  const [selectedGift, setSelectedGift] = useState(null);
  const [sendingGift, setSendingGift] = useState(false);

  // Streak marking
  const [markingStreak, setMarkingStreak] = useState(null);

  // ── Data loading ───────────────────────────────────────────────────────
  const loadFriendsData = useCallback(async () => {
    setLoading(true);
    try {
      // All my friendship rows
      const { data: fships } = await supabase
        .from('friendships')
        .select('*')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

      const accepted = (fships || []).filter((f) => f.status === 'accepted');
      const pendingIn = (fships || []).filter((f) => f.status === 'pending' && f.addressee_id === userId);
      const pendingOut = (fships || []).filter((f) => f.status === 'pending' && f.requester_id === userId);

      // Resolve student profiles for accepted friends
      const friendIds = accepted.map((f) =>
        f.requester_id === userId ? f.addressee_id : f.requester_id
      );

      const incomingIds = pendingIn.map((f) => f.requester_id);

      const allIds = [...new Set([...friendIds, ...incomingIds])];
      const { data: students } = allIds.length > 0
        ? await supabase.from('students').select('user_id,first_name,last_name,instagram,classes').in('user_id', allIds)
        : { data: [] };

      const studentMap = Object.fromEntries((students || []).map((s) => [s.user_id, s]));

      // Load streaks for accepted friends
      const streakPromises = accepted.map(async (f) => {
        const friendId = f.requester_id === userId ? f.addressee_id : f.requester_id;
        const [u1, u2] = [userId, friendId].sort();
        const { data: streak } = await supabase
          .from('study_streaks')
          .select('*')
          .eq('user1_id', u1)
          .eq('user2_id', u2)
          .maybeSingle();
        return { friendId, streak };
      });
      const streakResults = await Promise.all(streakPromises);
      const streakMap = Object.fromEntries(streakResults.map(({ friendId, streak }) => [friendId, streak]));

      // Load recent gifts received (last 20)
      const { data: gifts } = await supabase
        .from('friend_gifts')
        .select('*')
        .eq('receiver_id', userId)
        .order('sent_at', { ascending: false })
        .limit(20);

      // Build friends list
      const enrichedFriends = accepted.map((f) => {
        const friendId = f.requester_id === userId ? f.addressee_id : f.requester_id;
        return { friendship: f, student: studentMap[friendId], streak: streakMap[friendId] };
      });

      const enrichedIncoming = pendingIn.map((f) => ({
        friendship: f,
        student: studentMap[f.requester_id],
      }));

      setFriends(enrichedFriends);
      setIncoming(enrichedIncoming);
      setOutgoing(pendingOut);
      setRecentGifts(gifts || []);
    } catch (err) {
      console.error('Error loading friends:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadFriendsData(); }, [loadFriendsData]);

  // ── Search ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('students')
        .select('user_id,first_name,last_name,instagram,classes')
        .ilike('instagram', `%${searchQuery.trim()}%`)
        .neq('user_id', userId)
        .limit(8);
      setSearchResults(data || []);
      setSearching(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, userId]);

  // ── Actions ────────────────────────────────────────────────────────────
  async function sendRequest(addresseeId) {
    await supabase.from('friendships').insert({ requester_id: userId, addressee_id: addresseeId });
    showToast('Friend request sent!');
    loadFriendsData();
    setSearchQuery('');
  }

  async function acceptRequest(friendshipId) {
    await supabase.from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendshipId);
    showToast('Friend added!');
    loadFriendsData();
  }

  async function declineRequest(friendshipId) {
    await supabase.from('friendships')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', friendshipId);
    loadFriendsData();
  }

  async function removeFriend(friendshipId) {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    showToast('Friend removed.');
    loadFriendsData();
  }

  async function markStudyDay(friendId) {
    setMarkingStreak(friendId);
    const today = todayStr();
    const [u1, u2] = [userId, friendId].sort();

    const { data: existing } = await supabase
      .from('study_streaks')
      .select('*')
      .eq('user1_id', u1)
      .eq('user2_id', u2)
      .maybeSingle();

    if (!existing) {
      await supabase.from('study_streaks').insert({
        user1_id: u1, user2_id: u2, streak_count: 1, last_study_date: today,
      });
      showToast('🔥 Streak started! Day 1!');
    } else {
      const last = existing.last_study_date;
      const diff = Math.floor((new Date(today) - new Date(last)) / 86400000);
      if (diff === 0) {
        showToast('Already logged today!');
        setMarkingStreak(null);
        return;
      }
      const newCount = diff === 1 ? existing.streak_count + 1 : 1;
      await supabase.from('study_streaks').update({
        streak_count: newCount, last_study_date: today, updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
      showToast(diff === 1 ? `🔥 Streak extended! ${newCount} days!` : '🔥 New streak started! Day 1!');
    }

    setMarkingStreak(null);
    loadFriendsData();
  }

  async function sendGift() {
    if (!selectedGift || !giftTarget) return;
    setSendingGift(true);
    await supabase.from('friend_gifts').insert({
      sender_id: userId,
      receiver_id: giftTarget.id,
      gift_emoji: selectedGift.emoji,
      gift_label: selectedGift.label,
      message: giftMessage.trim() || null,
    });
    setSendingGift(false);
    setGiftTarget(null);
    setGiftMessage('');
    setSelectedGift(null);
    showToast(`${selectedGift.emoji} Gift sent to @${giftTarget.instagram}!`);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  // ── Derived ────────────────────────────────────────────────────────────
  const requestedIds = new Set([
    ...outgoing.map((f) => f.addressee_id),
    ...friends.map((f) => f.friendship.requester_id === userId ? f.friendship.addressee_id : f.friendship.requester_id),
    ...incoming.map((f) => f.friendship.requester_id),
  ]);

  function friendStatus(studentId) {
    if (requestedIds.has(studentId)) return 'connected';
    return 'none';
  }

  function studentDisplayName(s) {
    const full = [s?.first_name, s?.last_name].filter(Boolean).join(' ');
    return full || s?.instagram || 'unknown';
  }

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="friends-loading"><div className="friends-spinner" /></div>;
  }

  return (
    <div className="friends-page">
      {toast && <div className="friends-toast">{toast}</div>}

      {/* Gift Modal */}
      {giftTarget && (
        <div className="gift-overlay" onClick={() => setGiftTarget(null)}>
          <div className="gift-modal" onClick={(e) => e.stopPropagation()}>
            <button className="gift-modal-close" onClick={() => setGiftTarget(null)}>×</button>
            <h3 className="gift-modal-title">Send a gift to @{giftTarget.instagram}</h3>
            <div className="gift-options">
              {GIFTS.map((g) => (
                <button
                  key={g.label}
                  type="button"
                  className={`gift-option${selectedGift?.label === g.label ? ' selected' : ''}`}
                  onClick={() => setSelectedGift(g)}
                >
                  <span className="gift-emoji">{g.emoji}</span>
                  <span className="gift-gift-label">{g.label}</span>
                </button>
              ))}
            </div>
            <textarea
              className="gift-message-input"
              placeholder="Add a message (optional)"
              value={giftMessage}
              onChange={(e) => setGiftMessage(e.target.value)}
              maxLength={120}
              rows={2}
            />
            <button
              className="gift-send-btn"
              onClick={sendGift}
              disabled={!selectedGift || sendingGift}
            >
              {sendingGift ? 'Sending...' : `Send ${selectedGift?.emoji || 'Gift'}`}
            </button>
          </div>
        </div>
      )}

      <div className="friends-layout">

        {/* ── LEFT: Search + Requests ── */}
        <div className="friends-sidebar">

          {/* Search */}
          <div className="friends-card">
            <div className="friends-card-label">Add Friends</div>
            <div className="friends-search-wrap">
              <input
                className="friends-search-input"
                placeholder="Search by @instagram handle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searching && <div className="search-spinner" />}
            </div>

            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((s) => {
                  const status = friendStatus(s.user_id);
                  return (
                    <div key={s.user_id} className="search-result-row">
                      <div className="sr-avatar">{(s.first_name || s.instagram)?.[0]?.toUpperCase() || '?'}</div>
                      <div className="sr-info">
                        <div className="sr-name">{studentDisplayName(s)}</div>
                        <div className="sr-handle">@{s.instagram}</div>
                        {s.classes?.length > 0 && (
                          <div className="sr-classes">{s.classes.slice(0, 3).join(' · ')}</div>
                        )}
                      </div>
                      {status === 'none' ? (
                        <button className="sr-add-btn" onClick={() => sendRequest(s.user_id)}>
                          Add
                        </button>
                      ) : (
                        <span className="sr-status-pill">
                          {status === 'connected' ? '✓ Connected' : 'Pending'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {searchQuery.trim() && !searching && searchResults.length === 0 && (
              <p className="no-results">No users found for "{searchQuery}"</p>
            )}
          </div>

          {/* Incoming requests */}
          {incoming.length > 0 && (
            <div className="friends-card">
              <div className="friends-card-label">Friend Requests ({incoming.length})</div>
              <div className="request-list">
                {incoming.map(({ friendship, student }) => (
                  <div key={friendship.id} className="request-row">
                    <div className="sr-avatar req-avatar">
                      {(student?.first_name || student?.instagram)?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="sr-info">
                      <div className="sr-name">{studentDisplayName(student)}</div>
                      <div className="sr-handle">@{student?.instagram || 'unknown'}</div>
                    </div>
                    <div className="req-actions">
                      <button className="req-accept" onClick={() => acceptRequest(friendship.id)}>Accept</button>
                      <button className="req-decline" onClick={() => declineRequest(friendship.id)}>Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent gifts received */}
          {recentGifts.length > 0 && (
            <div className="friends-card">
              <div className="friends-card-label">Recent Gifts 🎁</div>
              <div className="gifts-list">
                {recentGifts.slice(0, 5).map((g) => (
                  <div key={g.id} className="gift-row">
                    <span className="gift-row-emoji">{g.gift_emoji}</span>
                    <div className="gift-row-info">
                      <div className="gift-row-label">{g.gift_label}</div>
                      {g.message && <div className="gift-row-msg">"{g.message}"</div>}
                      <div className="gift-row-date">
                        {new Date(g.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Friends list ── */}
        <div className="friends-main">
          <div className="friends-list-header">
            <div className="friends-card-label" style={{ marginBottom: 0 }}>
              My Friends ({friends.length})
            </div>
          </div>

          {friends.length === 0 ? (
            <div className="friends-empty">
              <div className="friends-empty-icon">👋</div>
              <h3>No friends yet</h3>
              <p>Search for classmates by their Instagram handle and send them a friend request.</p>
            </div>
          ) : (
            <div className="friend-cards-grid">
              {friends.map(({ friendship, student, streak }) => {
                if (!student) return null;
                const friendId = friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id;
                const today = todayStr();
                const studiedToday = streak?.last_study_date === today;
                const isAlive = streak && (() => {
                  const diff = Math.floor((new Date(today) - new Date(streak.last_study_date)) / 86400000);
                  return diff <= 1;
                })();

                return (
                  <div key={friendship.id} className="friend-card">
                    <div className="friend-card-top">
                      <div className="friend-avatar">
                        {(student.first_name || student.instagram)?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="friend-info">
                        <div className="friend-name">{studentDisplayName(student)}</div>
                        <div className="friend-handle">@{student.instagram}</div>
                        {student.classes?.length > 0 && (
                          <div className="friend-classes">
                            {student.classes.slice(0, 3).map((c) => (
                              <span key={c} className="friend-class-pill">{c}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        className="friend-remove-btn"
                        onClick={() => removeFriend(friendship.id)}
                        title="Remove friend"
                      >
                        ×
                      </button>
                    </div>

                    {/* Streak */}
                    <div className={`friend-streak ${isAlive ? 'alive' : 'cold'}`}>
                      <span className="streak-fire">
                        {streak ? streakEmoji(streak.streak_count) : '🔥'}
                      </span>
                      <div className="streak-info">
                        <div className="streak-count">
                          {streak ? `${streak.streak_count} day streak` : 'No streak yet'}
                        </div>
                        {streak && (
                          <div className="streak-date">
                            Last studied: {new Date(streak.last_study_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="friend-actions">
                      <button
                        className={`friend-study-btn${studiedToday ? ' done' : ''}`}
                        onClick={() => !studiedToday && markStudyDay(friendId)}
                        disabled={markingStreak === friendId || studiedToday}
                      >
                        {markingStreak === friendId
                          ? '...'
                          : studiedToday
                          ? '✓ Studied Today!'
                          : '📖 We Studied Today!'}
                      </button>
                      <button
                        className="friend-gift-btn"
                        onClick={() => { setGiftTarget({ id: friendId, instagram: student.instagram }); setSelectedGift(null); setGiftMessage(''); }}
                      >
                        🎁 Gift
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { getOnboardingData, saveOnboardingStep } from '../services/onboardingService';
import { connectGoogleCalendar } from '../services/googleCalendarService';
import '../styles/ProfilePage.css';

const DEFAULT_CLASSES = [
  'CS61A',
  'DATA8',
  'MATH54',
  'MATH52',
  'DATA100',
];

const PRESET_LOCATIONS = [
  'Moffitt 4th',
  'Doe Library',
  'Soda 380',
  'Evans Hall',
  'Main Stacks',
  'Valley LSB',
  'Cory 299',
];

const MAX_LOCATIONS = 3;

const TIME_SLOTS = [
  '8:00 AM',
  '9:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '1:00 PM',
  '2:00 PM',
  '3:00 PM',
  '4:00 PM',
  '5:00 PM',
  '6:00 PM',
  '7:00 PM',
  '8:00 PM',
];

const TIME_ZONES = [
  { label: 'Pacific (PT)', abbr: 'PT' },
  { label: 'Mountain (MT)', abbr: 'MT' },
  { label: 'Central (CT)', abbr: 'CT' },
  { label: 'Eastern (ET)', abbr: 'ET' },
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS_PLURAL = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatDateKey = (date) => {
  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().split('T')[0];
};

const formatDateLabel = (dateKey) => {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
};

const formatPhone = (value) => {
  if (!value) return '';
  const digitsOnly = value.replace(/\D/g, '');
  if (digitsOnly.length <= 3) return `(${digitsOnly}`;
  if (digitsOnly.length <= 6) return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`;
  return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6, 10)}`;
};

const normalizePhone = (value) => value.replace(/\D/g, '');

const validateInstagram = (value) => {
  const instagramRegex = /^[a-zA-Z0-9._]{3,30}$/;
  return instagramRegex.test(value);
};

const validatePhone = (value) => normalizePhone(value).length === 10;
const normalizeClassName = (value = '') => value.replace(/\s+/g, '').toUpperCase().trim();
const normalizeClassList = (classes = []) => [...new Set(classes.map((className) => normalizeClassName(className)).filter(Boolean))];

export default function ProfilePage({ userId, onProfileUpdated, onGoToOnboarding }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [instagram, setInstagram] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [customClass, setCustomClass] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState({});
  const [activeDateKey, setActiveDateKey] = useState('');
  const [selectedTimeZone, setSelectedTimeZone] = useState('PT');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [gridMode, setGridMode] = useState(false);
  const [preferredLocations, setPreferredLocations] = useState([]);
  const [locCustomInput, setLocCustomInput] = useState('');
  const [locShaking, setLocShaking] = useState(false);
  const [locLimitMsg, setLocLimitMsg] = useState('');
  const isDraggingRef = useRef(false);
  const dragActionRef = useRef(null);
  const draggedCells = useRef(new Set());

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const savedData = await getOnboardingData(userId);
        setProfile(savedData);
        setGoogleConnected(!!savedData?.google_calendar_connected);
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  useEffect(() => {
    if (profile?.availability_dates) {
      const firstKey = Object.keys(profile.availability_dates).sort()[0];
      if (firstKey) setAvailCalDate(new Date(`${firstKey}T00:00:00`));
    }
  }, [profile]);

  useEffect(() => {
    if (profile && editMode) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setInstagram(profile.instagram || '');
      setPhone(formatPhone(profile.phone || ''));
      const classes = normalizeClassList(Array.isArray(profile.classes) ? profile.classes : []);
      setSelectedClasses(classes);
      setSelectedDates(profile.availability_dates || {});
      setActiveDateKey(Object.keys(profile.availability_dates || {})[0] || '');
      setSelectedTimeZone('PT');
      setPreferredLocations(Array.isArray(profile.preferred_locations) ? profile.preferred_locations : []);
      setLocCustomInput('');
      setLocLimitMsg('');
      setError('');
      setSuccess('');
    }
  }, [profile, editMode]);

  const addCustomClass = (e) => {
    e.preventDefault();
    const trimmed = normalizeClassName(customClass);
    if (!trimmed) {
      setError('Please enter a class name');
      return;
    }
    if (selectedClasses.includes(trimmed)) {
      setError('This class is already added');
      setCustomClass('');
      return;
    }
    if (DEFAULT_CLASSES.includes(trimmed)) {
      setError('This class is already added.');
      setCustomClass('');
      return;
    }
    setSelectedClasses([...selectedClasses, trimmed]);
    setCustomClass('');
    setError('');
  };

  const removeCustomClass = (className) => {
    setSelectedClasses((prev) => prev.filter((c) => c !== className));
  };

  const triggerLocShake = () => {
    setLocLimitMsg('Pick up to 3');
    setLocShaking(true);
    setTimeout(() => setLocShaking(false), 600);
  };

  const toggleLocation = (loc) => {
    if (preferredLocations.includes(loc)) {
      setPreferredLocations(preferredLocations.filter((l) => l !== loc));
      setLocLimitMsg('');
    } else if (preferredLocations.length >= MAX_LOCATIONS) {
      triggerLocShake();
    } else {
      setPreferredLocations([...preferredLocations, loc]);
      setLocLimitMsg('');
    }
  };

  const addCustomLocation = () => {
    const val = locCustomInput.trim();
    if (!val) return;
    if (preferredLocations.includes(val)) {
      setLocCustomInput('');
      return;
    }
    if (preferredLocations.length >= MAX_LOCATIONS) {
      triggerLocShake();
      setLocCustomInput('');
      return;
    }
    setPreferredLocations([...preferredLocations, val]);
    setLocCustomInput('');
    setLocLimitMsg('');
  };

  const handleConnectGoogleCalendar = async () => {
    setError('');
    setSuccess('');

    try {
      setSaving(true);
      await connectGoogleCalendar();
      const savedData = await saveOnboardingStep(userId, {
        google_calendar_connected: true,
      });
      setProfile(savedData);
      setGoogleConnected(true);
      setSuccess('Google Calendar connected successfully. You can now sync matched groups to your calendar.');
      if (typeof onProfileUpdated === 'function') {
        onProfileUpdated();
      }
    } catch (err) {
      const message =
        err?.error_description ||
        err?.result?.error?.message ||
        err?.message ||
        'Unable to connect Google Calendar. Please try again.';
      setError(message);
      console.error('Google Calendar connection error:', err);
    } finally {
      setSaving(false);
    }
  };

  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const toggleDate = (day) => {
    const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateKey = formatDateKey(dateObj);
    setSelectedDates((prev) => {
      if (prev[dateKey] && activeDateKey !== dateKey) {
        setActiveDateKey(dateKey);
        return prev;
      }
      if (prev[dateKey]) {
        const next = { ...prev };
        delete next[dateKey];
        if (activeDateKey === dateKey) {
          setActiveDateKey(Object.keys(next)[0] || '');
        }
        return next;
      }
      setActiveDateKey(dateKey);
      return { ...prev, [dateKey]: [] };
    });
  };

  const toggleTimeSlot = (dateKey, time) => {
    setSelectedDates((prev) => {
      const currentTimes = prev[dateKey] || [];
      const updatedTimes = currentTimes.includes(time)
        ? currentTimes.filter((slot) => slot !== time)
        : [...currentTimes, time];
      return { ...prev, [dateKey]: updatedTimes };
    });
  };

  const activeDateLabel = activeDateKey ? formatDateLabel(activeDateKey) : '';

  const pasteTimesToWeekday = () => {
    if (!activeDateKey || !(selectedDates[activeDateKey] || []).length) return;
    const sourceTimes = selectedDates[activeDateKey];
    const sourceWeekday = new Date(activeDateKey + 'T00:00:00').getDay();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = getDaysInMonth(currentDate);
    const updates = {};
    for (let d = 1; d <= totalDays; d++) {
      if (new Date(year, month, d).getDay() === sourceWeekday) {
        updates[formatDateKey(new Date(year, month, d))] = [...sourceTimes];
      }
    }
    setSelectedDates((prev) => ({ ...prev, ...updates }));
  };

  const getPasteButtonLabel = () => {
    if (!activeDateKey) return 'Paste times for all days';
    const weekday = new Date(activeDateKey + 'T00:00:00').getDay();
    return `Paste times for all ${FULL_DAYS_PLURAL[weekday]}`;
  };

  const handleGridMouseDown = (dateKey, time) => {
    const isCurrentlySelected = (selectedDates[dateKey] || []).includes(time);
    isDraggingRef.current = true;
    dragActionRef.current = isCurrentlySelected ? 'deselect' : 'select';
    draggedCells.current = new Set([`${dateKey}_${time}`]);
    toggleTimeSlot(dateKey, time);
  };

  const handleGridMouseEnter = (dateKey, time) => {
    if (!isDraggingRef.current) return;
    const cellKey = `${dateKey}_${time}`;
    if (draggedCells.current.has(cellKey)) return;
    draggedCells.current.add(cellKey);
    setSelectedDates((prev) => {
      const times = prev[dateKey] || [];
      const isSelected = times.includes(time);
      if (dragActionRef.current === 'select' && !isSelected) {
        return { ...prev, [dateKey]: [...times, time] };
      }
      if (dragActionRef.current === 'deselect' && isSelected) {
        return { ...prev, [dateKey]: times.filter((t) => t !== time) };
      }
      return prev;
    });
  };

  useEffect(() => {
    const stopDrag = () => { isDraggingRef.current = false; };
    window.addEventListener('mouseup', stopDrag);
    return () => window.removeEventListener('mouseup', stopDrag);
  }, []);

  const sortedDates = Object.keys(selectedDates).sort();

  const [availViewMode, setAvailViewMode] = useState('calendar');
  const [availCalDate, setAvailCalDate] = useState(() => new Date());
  const [availCalSelected, setAvailCalSelected] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!instagram.trim()) {
      setError('Please enter your Instagram handle.');
      return;
    }
    if (!validateInstagram(instagram.trim())) {
      setError('Instagram handle must be 3-30 characters and may include letters, numbers, dots, and underscores.');
      return;
    }
    if (!validatePhone(phone)) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    if (selectedClasses.length === 0) {
      setError('Please select at least one class.');
      return;
    }
    if (Object.keys(selectedDates).length === 0) {
      setError('Please select at least one availability date.');
      return;
    }

    try {
      setSaving(true);
      const savedData = await saveOnboardingStep(userId, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        instagram: instagram.trim().toLowerCase(),
        phone: normalizePhone(phone),
        classes: normalizeClassList(selectedClasses),
        availability_dates: selectedDates,
        preferred_locations: preferredLocations,
      });

      setProfile(savedData);
      setSuccess('Profile updated successfully.');
      setEditMode(false);
      if (typeof onProfileUpdated === 'function') {
        onProfileUpdated();
      }
    } catch (err) {
      setError(err.message || 'Unable to save profile. Please try again.');
      console.error('Profile save error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-page loading-container">
        <div className="loading-spinner">Loading profile...</div>
      </div>
    );
  }

  if (!profile && !editMode) {
    return (
      <div className="profile-page">
        <div className="profile-card">
          <div className="profile-header">
            <h2>Your Profile</h2>
          </div>
          <p className="profile-empty">No profile data found yet.</p>
          <button className="edit-profile-button" onClick={() => setEditMode(true)}>
            Create Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {success && <div className="success-message">{success}</div>}
      {error && <div className="error-message">{error}</div>}

      {!editMode ? (
        <>
          {/* Hero */}
          <div className="profile-hero">
            <div className="hero-avatar">
              {profile?.first_name?.[0]?.toUpperCase() || profile?.instagram?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="hero-info">
              <div className="hero-name">
                {profile?.first_name || profile?.last_name
                  ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
                  : profile?.instagram || 'unknown'}
              </div>
              {profile?.instagram && (
                <div className="hero-instagram">@{profile.instagram}</div>
              )}
              <div className="hero-badges">
                {(profile?.classes || []).map((cls) => (
                  <span key={cls} className="hero-badge">{cls}</span>
                ))}
              </div>
            </div>
            <button className="edit-btn" onClick={() => setEditMode(true)}>
              Edit Profile
            </button>
          </div>

          {/* Contact + Classes */}
          <div className="section-grid">
            <div className="card">
              <div className="card-label">Contact</div>
              {profile?.instagram && (
                <div className="contact-row">
                  <div className="contact-icon ig">📸</div>
                  <div>
                    <div className="contact-label">Instagram</div>
                    <div className="contact-value">@{profile.instagram}</div>
                  </div>
                </div>
              )}
              {profile?.phone && (
                <div className="contact-row">
                  <div className="contact-icon ph">📞</div>
                  <div>
                    <div className="contact-label">Phone</div>
                    <div className="contact-value">{formatPhone(profile.phone)}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-label">Classes</div>
              <div className="classes-wrap">
                {(profile?.classes || []).map((cls) => (
                  <span key={cls} className="class-pill">{cls}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Preferred Locations */}
          {(profile?.preferred_locations || []).length > 0 && (
            <div className="card pref-loc-view-card">
              <div className="card-label">Favorite Study Spots</div>
              <div className="pref-loc-view-chips">
                {profile.preferred_locations.map((loc) => (
                  <span key={loc} className="pref-loc-view-chip">{loc}</span>
                ))}
              </div>
            </div>
          )}

          {/* Calendar Sync */}
          <div className="calendar-card">
            <div className="calendar-left">
              <div className="cal-icon">📅</div>
              <div>
                <div className="cal-title">Google Calendar Sync</div>
                <div className="cal-sub">
                  {googleConnected
                    ? 'Connected to Google Calendar'
                    : 'Connect to auto-import your availability'}
                </div>
              </div>
            </div>
            <button className="cal-btn" onClick={handleConnectGoogleCalendar} disabled={saving}>
              {saving ? 'Connecting...' : googleConnected ? 'Reconnect Calendar' : 'Connect Calendar'}
            </button>
          </div>

          {/* Availability */}
          {profile?.availability_dates && Object.keys(profile.availability_dates).length > 0 && (
            <div className="card avail-card">
              <div className="avail-card-header">
                <div className="card-label">Availability</div>
                <div className="avail-view-toggle">
                  <button
                    type="button"
                    className={`avail-view-btn${availViewMode === 'list' ? ' active' : ''}`}
                    onClick={() => setAvailViewMode('list')}
                  >
                    List
                  </button>
                  <button
                    type="button"
                    className={`avail-view-btn${availViewMode === 'calendar' ? ' active' : ''}`}
                    onClick={() => {
                      setAvailViewMode('calendar');
                      const firstKey = Object.keys(profile.availability_dates).sort()[0];
                      if (firstKey) setAvailCalDate(new Date(`${firstKey}T00:00:00`));
                      setAvailCalSelected('');
                    }}
                  >
                    Calendar
                  </button>
                </div>
              </div>

              {availViewMode === 'list' ? (
                <div className="avail-list">
                  {Object.entries(profile.availability_dates)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([dateKey, times]) => (
                      <div key={dateKey} className="avail-row">
                        <div className="avail-date">{formatDateLabel(dateKey)}</div>
                        <div className="avail-times">
                          {(times || []).length > 0
                            ? times.map((t) => <span key={t} className="time-chip">{t}</span>)
                            : <span className="no-times">No times set</span>}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="avail-cal-wrapper">
                  <div className="avail-cal-left">
                    <div className="avail-cal-nav">
                      <button
                        type="button"
                        className="avail-cal-arrow"
                        onClick={() => setAvailCalDate(new Date(availCalDate.getFullYear(), availCalDate.getMonth() - 1, 1))}
                      >←</button>
                      <span className="avail-cal-month">{MONTHS[availCalDate.getMonth()]} {availCalDate.getFullYear()}</span>
                      <button
                        type="button"
                        className="avail-cal-arrow"
                        onClick={() => setAvailCalDate(new Date(availCalDate.getFullYear(), availCalDate.getMonth() + 1, 1))}
                      >→</button>
                    </div>
                    <div className="avail-cal-grid">
                      {DAYS_OF_WEEK.map((d) => (
                        <div key={d} className="avail-cal-day-hdr">{d}</div>
                      ))}
                      {Array.from({ length: getFirstDayOfMonth(availCalDate) }).map((_, i) => (
                        <div key={`e-${i}`} className="avail-cal-day empty" />
                      ))}
                      {Array.from({ length: getDaysInMonth(availCalDate) }).map((_, i) => {
                        const dayNum = i + 1;
                        const dateKey = formatDateKey(new Date(availCalDate.getFullYear(), availCalDate.getMonth(), dayNum));
                        const hasAvail = !!(profile.availability_dates[dateKey]?.length);
                        const isSelected = availCalSelected === dateKey;
                        return (
                          <button
                            key={i}
                            type="button"
                            className={`avail-cal-day${hasAvail ? ' has-avail' : ''}${isSelected ? ' selected' : ''}`}
                            onClick={() => hasAvail && setAvailCalSelected(isSelected ? '' : dateKey)}
                          >
                            {dayNum}
                          </button>
                        );
                      })}
                    </div>
                    <div className="avail-cal-legend">
                      <span className="avail-cal-legend-dot" /> Available dates
                    </div>
                  </div>
                  <div className="avail-cal-right">
                    {availCalSelected && profile.availability_dates[availCalSelected] ? (
                      <>
                        <div className="avail-cal-times-label">{formatDateLabel(availCalSelected)}</div>
                        <div className="avail-times">
                          {profile.availability_dates[availCalSelected].map((t) => (
                            <span key={t} className="time-chip">{t}</span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="avail-cal-side-empty">
                        <span className="avail-cal-legend-dot" />
                        <span>Select a highlighted date to see times</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dev shortcut */}
          {onGoToOnboarding && (
            <div className="onboarding-preview-row">
              <button className="onboarding-preview-btn" onClick={onGoToOnboarding}>
                Preview Onboarding Flow →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="profile-card">
          <div className="profile-header">
            <h2>Edit Profile</h2>
          </div>
          <form onSubmit={handleSave} className="profile-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First"
                  disabled={saving}
                />
              </div>
              <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="instagram">Instagram Handle</label>
              <input
                id="instagram"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="your.username"
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(555) 123-4567"
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label>Classes</label>
              <div className="custom-class-form">
                <input
                  type="text"
                  placeholder="Add a class (e.g. CS170)"
                  value={customClass}
                  onChange={(e) => {
                    setCustomClass(normalizeClassName(e.target.value));
                    setError('');
                  }}
                  disabled={saving}
                />
                <button type="button" onClick={addCustomClass} disabled={saving || !customClass.trim()}>
                  Add
                </button>
              </div>
              {selectedClasses.length > 0 && (
                <div className="custom-classes-list">
                  {selectedClasses.map((className) => (
                    <div key={className} className="custom-class-tag">
                      <span>{className}</span>
                      <button type="button" onClick={() => removeCustomClass(className)} disabled={saving}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Favorite Study Spots</label>
              <p className="pref-loc-form-hint">Pick up to 3</p>
              {locLimitMsg && <div className="pref-loc-limit-msg-inline">{locLimitMsg}</div>}
              <div className={`pref-loc-form-chips${locShaking ? ' pref-loc-shake' : ''}`}>
                {PRESET_LOCATIONS.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    className={`pref-loc-form-chip${preferredLocations.includes(loc) ? ' selected' : ''}`}
                    onClick={() => toggleLocation(loc)}
                    disabled={saving}
                  >
                    {loc}
                  </button>
                ))}
              </div>
              <div className="pref-loc-form-custom">
                <input
                  type="text"
                  placeholder="Or type your own spot..."
                  value={locCustomInput}
                  onChange={(e) => setLocCustomInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomLocation(); } }}
                  disabled={saving}
                  maxLength={50}
                />
                <button
                  type="button"
                  onClick={addCustomLocation}
                  disabled={saving || !locCustomInput.trim()}
                >
                  Add
                </button>
              </div>
              {preferredLocations.filter((l) => !PRESET_LOCATIONS.includes(l)).length > 0 && (
                <div className="pref-loc-custom-list">
                  {preferredLocations.filter((l) => !PRESET_LOCATIONS.includes(l)).map((loc) => (
                    <span key={loc} className="pref-loc-custom-tag">
                      {loc}
                      <button type="button" onClick={() => toggleLocation(loc)} disabled={saving}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group availability-editor">
              <label>Availability</label>

              <div className="view-toggle">
                <span className={!gridMode ? 'toggle-mode active' : 'toggle-mode'}>Date View</span>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={gridMode}
                    onChange={(e) => setGridMode(e.target.checked)}
                    disabled={saving}
                  />
                  <span className="toggle-slider" />
                </label>
                <span className={gridMode ? 'toggle-mode active' : 'toggle-mode'}>Grid View</span>
              </div>

              {gridMode ? (
                <div
                  className="wm-wrapper"
                  onMouseLeave={() => { isDraggingRef.current = false; }}
                >
                  {sortedDates.length === 0 ? (
                    <p className="wm-no-dates">Switch to Date View to select dates first.</p>
                  ) : (
                    <div
                      className="wm-grid"
                      style={{ gridTemplateColumns: `90px repeat(${sortedDates.length}, minmax(60px, 1fr))` }}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <div className="wm-corner" />
                      {sortedDates.map((dateKey) => (
                        <div key={dateKey} className="wm-date-header">
                          {new Date(dateKey + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'short', month: 'numeric', day: 'numeric',
                          })}
                        </div>
                      ))}
                      {TIME_SLOTS.map((time) => (
                        <React.Fragment key={time}>
                          <div className="wm-time-label">{time}</div>
                          {sortedDates.map((dateKey) => {
                            const isSelected = (selectedDates[dateKey] || []).includes(time);
                            return (
                              <div
                                key={dateKey}
                                className={`wm-cell${isSelected ? ' selected' : ''}`}
                                onMouseDown={() => handleGridMouseDown(dateKey, time)}
                                onMouseEnter={() => handleGridMouseEnter(dateKey, time)}
                              />
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="availability-panel">
                  <div className="calendar-panel">
                    <div className="calendar-header">
                      <button type="button" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} disabled={saving}>←</button>
                      <span>{MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
                      <button type="button" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} disabled={saving}>→</button>
                    </div>
                    <div className="calendar-grid">
                      {DAYS_OF_WEEK.map((day) => (
                        <div key={day} className="calendar-day-header">{day}</div>
                      ))}
                      {Array.from({ length: getFirstDayOfMonth(currentDate) }).map((_, index) => (
                        <div key={`empty-${index}`} className="calendar-day empty" />
                      ))}
                      {Array.from({ length: getDaysInMonth(currentDate) }).map((_, index) => {
                        const dayNum = index + 1;
                        const dateKey = formatDateKey(new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNum));
                        const isSelected = !!selectedDates[dateKey];
                        return (
                          <button
                            key={index}
                            type="button"
                            className={`calendar-day${isSelected ? ' selected' : ''}${activeDateKey === dateKey ? ' active' : ''}`}
                            onClick={() => toggleDate(dayNum)}
                            disabled={saving}
                          >
                            {dayNum}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="time-slot-panel">
                    <div className="timezone-row">
                      <label htmlFor="timezone-select">Time Zone</label>
                      <select
                        id="timezone-select"
                        value={selectedTimeZone}
                        onChange={(e) => setSelectedTimeZone(e.target.value)}
                        disabled={saving}
                      >
                        {TIME_ZONES.map((tz) => (
                          <option key={tz.abbr} value={tz.abbr}>{tz.label}</option>
                        ))}
                      </select>
                    </div>
                    {activeDateKey ? (
                      <>
                        <p>Editing time slots for {activeDateLabel}</p>
                        <div className="time-slots-grid">
                          {TIME_SLOTS.map((time) => (
                            <label key={time} className="time-slot-label">
                              <input
                                type="checkbox"
                                checked={(selectedDates[activeDateKey] || []).includes(time)}
                                onChange={() => toggleTimeSlot(activeDateKey, time)}
                                disabled={saving}
                              />
                              <span>{time}</span>
                            </label>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p>Select a date to edit its time slots.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="button-row">
              <button type="submit" className="save-button" disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
              {activeDateKey && (selectedDates[activeDateKey] || []).length > 0 && (
                <button type="button" className="paste-weekday-button" onClick={pasteTimesToWeekday} disabled={saving}>
                  {getPasteButtonLabel()}
                </button>
              )}
              <button type="button" className="cancel-button" onClick={() => setEditMode(false)} disabled={saving}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { getOnboardingData, saveOnboardingStep } from '../services/onboardingService';
import '../styles/ProfilePage.css';

const DEFAULT_CLASSES = [
  'CS61A',
  'Data8',
  'Math54',
  'Math52',
  'Data100',
];

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

export default function ProfilePage({ userId, onProfileUpdated }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [instagram, setInstagram] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [customClass, setCustomClass] = useState('');
  const [customClasses, setCustomClasses] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState({});
  const [selectedTimeZone, setSelectedTimeZone] = useState('PT');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const savedData = await getOnboardingData(userId);
        setProfile(savedData);
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
    if (profile && editMode) {
      setInstagram(profile.instagram || '');
      setPhone(formatPhone(profile.phone || ''));
      const classes = Array.isArray(profile.classes) ? profile.classes : [];
      setSelectedClasses(classes);
      setCustomClasses(classes.filter((className) => !DEFAULT_CLASSES.includes(className)));
      setSelectedDates(profile.availability_dates || {});
      setSelectedTimeZone('PT');
      setError('');
      setSuccess('');
    }
  }, [profile, editMode]);

  const handleToggleClass = (className) => {
    setSelectedClasses((prev) =>
      prev.includes(className) ? prev.filter((c) => c !== className) : [...prev, className]
    );
  };

  const addCustomClass = (e) => {
    e.preventDefault();
    const trimmed = customClass.trim().toUpperCase();
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
      setError('This class is already in the default list. Please select it above.');
      setCustomClass('');
      return;
    }
    setSelectedClasses([...selectedClasses, trimmed]);
    setCustomClasses([...customClasses, trimmed]);
    setCustomClass('');
    setError('');
  };

  const removeCustomClass = (className) => {
    setCustomClasses((prev) => prev.filter((c) => c !== className));
    setSelectedClasses((prev) => prev.filter((c) => c !== className));
  };

  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const toggleDate = (day) => {
    const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateKey = formatDateKey(dateObj);
    setSelectedDates((prev) => {
      if (prev[dateKey]) {
        const next = { ...prev };
        delete next[dateKey];
        return next;
      }
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
        instagram: instagram.trim().toLowerCase(),
        phone: normalizePhone(phone),
        classes: selectedClasses,
        availability_dates: selectedDates,
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
          <h2>Your Profile</h2>
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
      <div className="profile-card">
        <div className="profile-header">
          <h2>Your Profile</h2>
          {!editMode && (
            <button className="edit-profile-button" onClick={() => setEditMode(true)}>
              Edit Profile
            </button>
          )}
        </div>

        {success && <div className="success-message">{success}</div>}
        {error && <div className="error-message">{error}</div>}

        {!editMode ? (
          <div className="profile-summary">
            <div className="profile-field">
              <span className="field-label">Instagram</span>
              <span className="field-value">{profile?.instagram || 'Not set'}</span>
            </div>
            <div className="profile-field">
              <span className="field-label">Phone</span>
              <span className="field-value">{profile?.phone ? formatPhone(profile.phone) : 'Not set'}</span>
            </div>
            <div className="profile-field">
              <span className="field-label">Classes</span>
              {profile?.classes?.length > 0 ? (
                <div className="profile-tags">
                  {profile.classes.map((className) => (
                    <span className="profile-tag" key={className}>{className}</span>
                  ))}
                </div>
              ) : (
                <span className="field-value">Not set</span>
              )}
            </div>
            <div className="profile-field availability-summary">
              <span className="field-label">Availability</span>
              {profile?.availability_dates && Object.keys(profile.availability_dates).length > 0 ? (
                <div className="availability-list">
                  {Object.entries(profile.availability_dates).map(([dateKey, times]) => (
                    <div key={dateKey} className="availability-item">
                      <strong>{formatDateLabel(dateKey)}:</strong>{' '}
                      {times.length > 0 ? times.join(', ') : 'No times selected'}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="field-value">Not set</span>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="profile-form">
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
              <div className="classes-grid">
                {DEFAULT_CLASSES.map((className) => (
                  <button
                    key={className}
                    type="button"
                    className={`class-button ${selectedClasses.includes(className) ? 'selected' : ''}`}
                    onClick={() => handleToggleClass(className)}
                    disabled={saving}
                  >
                    {className}
                  </button>
                ))}
              </div>
              <div className="custom-class-form">
                <input
                  type="text"
                  placeholder="Add a class (e.g. CS170)"
                  value={customClass}
                  onChange={(e) => setCustomClass(e.target.value)}
                  disabled={saving}
                />
                <button type="button" onClick={addCustomClass} disabled={saving || !customClass.trim()}>
                  Add
                </button>
              </div>
              {customClasses.length > 0 && (
                <div className="custom-classes-list">
                  {customClasses.map((className) => (
                    <div key={className} className="custom-class-tag">
                      <span>{className}</span>
                      <button type="button" onClick={() => removeCustomClass(className)} disabled={saving}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group availability-editor">
              <label>Availability</label>
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
                          className={`calendar-day${isSelected ? ' selected' : ''}`}
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
                  <div className="time-slots-grid">
                    {TIME_SLOTS.map((time) => (
                      <label key={time} className="time-slot-label">
                        <input
                          type="checkbox"
                          checked={Object.keys(selectedDates).every((dateKey) => selectedDates[dateKey].includes(time)) && Object.keys(selectedDates).length > 0}
                          onChange={() => {
                            Object.keys(selectedDates).forEach((dateKey) => toggleTimeSlot(dateKey, time));
                          }}
                          disabled={saving || Object.keys(selectedDates).length === 0}
                        />
                        <span>{time}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="button-row">
              <button type="submit" className="save-button" disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
              <button type="button" className="cancel-button" onClick={() => setEditMode(false)} disabled={saving}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

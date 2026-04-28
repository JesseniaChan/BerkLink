import React, { useState, useRef, useEffect } from 'react';
import { saveOnboardingStep } from '../services/onboardingService';
import '../styles/Availability.css';

const TIME_SLOTS = [
  '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM',
];

const TIME_ZONES = [
  { label: 'Pacific (PT)', abbr: 'PT', offset: -7 },
  { label: 'Mountain (MT)', abbr: 'MT', offset: -6 },
  { label: 'Central (CT)', abbr: 'CT', offset: -5 },
  { label: 'Eastern (ET)', abbr: 'ET', offset: -4 },
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS_PLURAL = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKS_AHEAD = 6;

function formatDateKey(date) {
  return date.toISOString().split('T')[0];
}

// Expand a weekly schedule (dayIndex → times[]) into concrete dates for the next WEEKS_AHEAD weeks
function weeklyToAvailabilityDates(weeklySchedule) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result = {};
  for (let offset = 0; offset < WEEKS_AHEAD * 7; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    const dayIdx = d.getDay();
    const times = weeklySchedule[dayIdx];
    if (times && times.length > 0) {
      result[formatDateKey(d)] = [...times];
    }
  }
  return result;
}

export default function Availability({ userId, onNext, onSkip }) {
  const [activeTab, setActiveTab] = useState('monthly');

  // ── Monthly state ──────────────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState({});
  const [activeDate, setActiveDate] = useState(null);
  const [selectedTimeZone, setSelectedTimeZone] = useState('PT');

  // ── Weekly state ───────────────────────────────────────────────────────
  // { dayIndex (0-6): ['8:00 AM', ...] }
  const [weeklySchedule, setWeeklySchedule] = useState({});
  const isDraggingRef = useRef(false);
  const dragActionRef = useRef(null);
  const draggedCells = useRef(new Set());

  // ── Shared state ───────────────────────────────────────────────────────
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const stop = () => { isDraggingRef.current = false; };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  // ── Monthly helpers ────────────────────────────────────────────────────
  const getDaysInMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1).getDay();

  const toggleDate = (day) => {
    const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateKey = formatDateKey(dateObj);
    if (selectedDates[dateKey] !== undefined) {
      setSelectedDates((prev) => { const n = { ...prev }; delete n[dateKey]; return n; });
      setActiveDate((prev) => (prev === dateKey ? null : prev));
    } else {
      setSelectedDates((prev) => ({ ...prev, [dateKey]: [] }));
      setActiveDate(dateKey);
    }
  };

  const toggleTimeSlot = (dateKey, time) => {
    setSelectedDates((prev) => {
      const times = prev[dateKey] || [];
      const isSelected = times.includes(time);
      return { ...prev, [dateKey]: isSelected ? times.filter((t) => t !== time) : [...times, time] };
    });
  };

  const pasteTimesToWeekday = () => {
    if (!activeDate || !(selectedDates[activeDate] || []).length) return;
    const sourceTimes = selectedDates[activeDate];
    const sourceWeekday = new Date(activeDate + 'T00:00:00').getDay();
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
    if (!activeDate) return 'Paste times for all days';
    const weekday = new Date(activeDate + 'T00:00:00').getDay();
    return `Paste times for all ${FULL_DAYS_PLURAL[weekday]}`;
  };

  // ── Weekly helpers ─────────────────────────────────────────────────────
  const toggleWeeklyCell = (dayIdx, time) => {
    setWeeklySchedule((prev) => {
      const times = prev[dayIdx] || [];
      const isSelected = times.includes(time);
      return { ...prev, [dayIdx]: isSelected ? times.filter((t) => t !== time) : [...times, time] };
    });
  };

  const handleWeeklyMouseDown = (dayIdx, time) => {
    const isSelected = (weeklySchedule[dayIdx] || []).includes(time);
    isDraggingRef.current = true;
    dragActionRef.current = isSelected ? 'deselect' : 'select';
    draggedCells.current = new Set([`${dayIdx}_${time}`]);
    toggleWeeklyCell(dayIdx, time);
  };

  const handleWeeklyMouseEnter = (dayIdx, time) => {
    if (!isDraggingRef.current) return;
    const cellKey = `${dayIdx}_${time}`;
    if (draggedCells.current.has(cellKey)) return;
    draggedCells.current.add(cellKey);
    setWeeklySchedule((prev) => {
      const times = prev[dayIdx] || [];
      const isSelected = times.includes(time);
      if (dragActionRef.current === 'select' && !isSelected) return { ...prev, [dayIdx]: [...times, time] };
      if (dragActionRef.current === 'deselect' && isSelected) return { ...prev, [dayIdx]: times.filter((t) => t !== time) };
      return prev;
    });
  };

  // ── Derived ────────────────────────────────────────────────────────────
  const hasMonthlySelection = () => Object.keys(selectedDates).length > 0;
  const hasWeeklySelection = () => Object.values(weeklySchedule).some((t) => t.length > 0);
  const hasSelection = () => activeTab === 'monthly' ? hasMonthlySelection() : hasWeeklySelection();

  const weeklySlotCount = Object.values(weeklySchedule).reduce((s, t) => s + t.length, 0);
  const weeklyDayCount = Object.values(weeklySchedule).filter((t) => t.length > 0).length;

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  // ── Save ───────────────────────────────────────────────────────────────
  const handleNext = async (e) => {
    e.preventDefault();
    setError('');
    if (!hasSelection()) {
      setError(
        activeTab === 'monthly'
          ? 'Please select at least one date and time slot.'
          : 'Please select at least one time slot in the weekly grid.'
      );
      return;
    }
    setLoading(true);
    try {
      const availability_dates =
        activeTab === 'monthly' ? selectedDates : weeklyToAvailabilityDates(weeklySchedule);
      const savedData = await saveOnboardingStep(userId, { availability_dates });
      if (savedData) {
        setSuccess(true);
        if (onNext) onNext(savedData);
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="availability-container">
      <div className="availability-card">
        <h2>When Are You Available?</h2>
        <p className="availability-subtitle">
          Select the dates and times you're free to study with others
        </p>

        {/* ── TABS ── */}
        <div className="avail-tabs">
          <button
            type="button"
            className={`avail-tab ${activeTab === 'monthly' ? 'active' : ''}`}
            onClick={() => setActiveTab('monthly')}
          >
            📅 Monthly
          </button>
          <button
            type="button"
            className={`avail-tab ${activeTab === 'weekly' ? 'active' : ''}`}
            onClick={() => setActiveTab('weekly')}
          >
            📆 Weekly
          </button>
        </div>

        {success && (
          <div className="success-message">
            <span className="success-icon">✓</span>
            Availability saved successfully!
          </div>
        )}
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠</span>
            {error}
          </div>
        )}

        <form onSubmit={handleNext}>

          {/* ════════════════ MONTHLY TAB ════════════════ */}
          {activeTab === 'monthly' && (
            <div className="availability-layout">
              <div className="calendar-panel">
                <div className="calendar-section">
                  <div className="calendar-header">
                    <button type="button" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="month-nav-button" disabled={loading}>←</button>
                    <h3 className="month-year-title">
                      {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </h3>
                    <button type="button" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="month-nav-button" disabled={loading}>→</button>
                  </div>
                  <div className="calendar-wrapper">
                    <div className="calendar-grid">
                      {DAYS_OF_WEEK.map((day) => (
                        <div key={day} className="calendar-day-header">{day}</div>
                      ))}
                      {calendarDays.map((day, index) => {
                        const dateKey = day !== null
                          ? formatDateKey(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))
                          : null;
                        return (
                          <div
                            key={index}
                            className={`calendar-day ${day === null ? 'empty' : ''} ${dateKey && selectedDates[dateKey] !== undefined ? 'selected' : ''} ${dateKey === activeDate ? 'active' : ''}`}
                            onClick={() => day !== null && toggleDate(day)}
                            role="button"
                            tabIndex={0}
                          >
                            {day}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="time-zones-panel">
                {!(activeDate && selectedDates[activeDate] !== undefined) ? (
                  <div className="timezone-placeholder">
                    <p>{hasMonthlySelection() ? 'Click a selected date to edit its times' : 'Select a date on the left to view time slots'}</p>
                  </div>
                ) : (
                  <>
                    <div className="timezone-selector-group">
                      <label htmlFor="timezone-select" className="timezone-label">Time zone:</label>
                      <select
                        id="timezone-select"
                        value={selectedTimeZone}
                        onChange={(e) => setSelectedTimeZone(e.target.value)}
                        className="timezone-select"
                        disabled={loading}
                      >
                        {TIME_ZONES.map((tz) => (
                          <option key={tz.abbr} value={tz.abbr}>{tz.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="time-slots-container">
                      <h4 className="time-slots-title">
                        Available times for{' '}
                        {new Date(activeDate + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'long', month: 'short', day: 'numeric',
                        })}
                      </h4>
                      <div className="timezone-time-slots">
                        <div className="timezone-header">
                          <h5 className="timezone-time">
                            {TIME_ZONES.find((tz) => tz.abbr === selectedTimeZone)?.label}
                          </h5>
                        </div>
                        <div className="time-slots-grid">
                          {TIME_SLOTS.map((time) => (
                            <label key={`${selectedTimeZone}-${time}`} className="time-slot-checkbox">
                              <input
                                type="checkbox"
                                checked={(selectedDates[activeDate] || []).includes(time)}
                                onChange={() => toggleTimeSlot(activeDate, time)}
                                disabled={loading}
                              />
                              <span className="time-slot-display">{time}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    {(selectedDates[activeDate] || []).length > 0 && (
                      <button type="button" onClick={pasteTimesToWeekday} disabled={loading} className="paste-button">
                        {getPasteButtonLabel()}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ════════════════ WEEKLY TAB ════════════════ */}
          {activeTab === 'weekly' && (
            <div className="weekly-tab-content">
              <p className="weekly-subtitle">
                Click and drag to mark your recurring availability. These times will be applied to every matching day over the next {WEEKS_AHEAD} weeks.
              </p>

              <div
                className="weekly-grid-wrapper"
                onMouseLeave={() => { isDraggingRef.current = false; }}
              >
                <div
                  className="weekly-grid"
                  onMouseDown={(e) => e.preventDefault()}
                  style={{ gridTemplateColumns: `72px repeat(7, 1fr)` }}
                >
                  {/* Corner */}
                  <div className="wg-corner" />
                  {/* Day headers */}
                  {DAYS_OF_WEEK.map((day, idx) => (
                    <div
                      key={day}
                      className={`wg-day-header ${(weeklySchedule[idx] || []).length > 0 ? 'has-selection' : ''}`}
                    >
                      {day}
                    </div>
                  ))}
                  {/* Time rows */}
                  {TIME_SLOTS.map((time) => (
                    <React.Fragment key={time}>
                      <div className="wg-time-label">{time}</div>
                      {DAYS_OF_WEEK.map((_, dayIdx) => {
                        const isSelected = (weeklySchedule[dayIdx] || []).includes(time);
                        return (
                          <div
                            key={dayIdx}
                            className={`wg-cell${isSelected ? ' selected' : ''}`}
                            onMouseDown={() => handleWeeklyMouseDown(dayIdx, time)}
                            onMouseEnter={() => handleWeeklyMouseEnter(dayIdx, time)}
                          />
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {hasWeeklySelection() && (
                <div className="weekly-summary">
                  <span>
                    <strong>{weeklySlotCount}</strong> time slot{weeklySlotCount !== 1 ? 's' : ''} across <strong>{weeklyDayCount}</strong> day{weeklyDayCount !== 1 ? 's' : ''}
                  </span>
                  <span className="weekly-summary-note">
                    → Applied to all matching days for the next {WEEKS_AHEAD} weeks
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="button-group">
            <button type="submit" disabled={loading} className="next-button">
              {loading ? 'Saving...' : 'Next'}
            </button>
            <button type="button" onClick={() => onSkip && onSkip()} disabled={loading} className="skip-button">
              Skip for Now
            </button>
          </div>
        </form>

        <div className="info-note">
          <span className="note-icon">ℹ</span>
          <p>
            {activeTab === 'monthly'
              ? 'Click dates to select them, then pick your available time slots for each date.'
              : `Click and drag to select recurring time blocks. Each selected slot applies to every ${WEEKS_AHEAD === 6 ? 'six' : WEEKS_AHEAD} weeks of that weekday.`}
            {' '}You can update your availability anytime.
          </p>
        </div>
      </div>
    </div>
  );
}

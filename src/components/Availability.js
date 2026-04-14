import React, { useState} from 'react';
import { saveOnboardingStep } from '../services/onboardingService';
import '../styles/Availability.css';

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

export default function Availability({ userId, onNext, onSkip }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState({});
  const [activeDate, setActiveDate] = useState(null);
  const [selectedTimeZone, setSelectedTimeZone] = useState('PT');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDateKey = (date) => {
    return date.toISOString().split('T')[0];
  };

  const toggleDate = (day) => {
    const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateKey = formatDateKey(dateObj);
    if (selectedDates[dateKey] !== undefined) {
      // deselecting
      setSelectedDates((prev) => {
        const newDates = { ...prev };
        delete newDates[dateKey];
        return newDates;
      });
      setActiveDate((prev) => (prev === dateKey ? null : prev));
    } else {
      // selecting — also make it the active date
      setSelectedDates((prev) => ({ ...prev, [dateKey]: [] }));
      setActiveDate(dateKey);
    }
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

  const toggleTimeSlot = (dateKey, time) => {
    setSelectedDates((prev) => {
      const times = prev[dateKey] || [];
      const isSelected = times.includes(time);
      return {
        ...prev,
        [dateKey]: isSelected ? times.filter((t) => t !== time) : [...times, time],
      };
    });
  };

  const hasSelection = () => Object.keys(selectedDates).length > 0;

  const getSelectedDateDisplay = () => {
    return Object.keys(selectedDates)
      .map((dateKey) => {
        const date = new Date(dateKey + 'T00:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      })
      .join(', ');
  };

  const getTotalTimeSlots = () => {
    return Object.values(selectedDates).reduce((sum, times) => sum + times.length, 0);
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const handleNext = async (e) => {
    e.preventDefault();
    setError('');

    if (!hasSelection()) {
      setError('Please select at least one date and time slot');
      return;
    }

    setLoading(true);

    try {
      // ✅ Only save availability_dates — selected_dates column has been removed
      const savedData = await saveOnboardingStep(userId, {
        availability_dates: selectedDates,
      });

      if (savedData) {
        setSuccess(true);
        if (onNext) onNext(savedData);
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (onSkip) onSkip();
  };

  return (
    <div className="availability-container">
      <div className="availability-card">
        <h2>When Are You Available?</h2>
        <p className="availability-subtitle">
          Select specific dates and times you're free to study with others
        </p>

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
          <div className="availability-layout">
            {/* LEFT: Calendar */}
            <div className="calendar-panel">
              <div className="calendar-section">
                <div className="calendar-header">
                  <button type="button" onClick={previousMonth} className="month-nav-button" disabled={loading}>←</button>
                  <h3 className="month-year-title">
                    {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </h3>
                  <button type="button" onClick={nextMonth} className="month-nav-button" disabled={loading}>→</button>
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

            {/* RIGHT: Time Slots */}
            <div className="time-zones-panel">
              {!(activeDate && selectedDates[activeDate] !== undefined) ? (
                <div className="timezone-placeholder">
                  <p>{hasSelection() ? 'Click a selected date to edit its times' : 'Select a date on the left to view time slots'}</p>
                </div>
              ) : (
                <>
                  <div className="timezone-selector-group">
                    <label htmlFor="timezone-select" className="timezone-label">
                      Select your time zone:
                    </label>
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
                    <button
                      type="button"
                      onClick={pasteTimesToWeekday}
                      disabled={loading}
                      className="paste-button"
                    >
                      {getPasteButtonLabel()}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {hasSelection() && getTotalTimeSlots() > 0 && (
            <div className="selection-summary">
              <p className="summary-text">
                <strong>Selected dates:</strong> {getSelectedDateDisplay()}
              </p>
              <p className="summary-text">
                <strong>Total time slots:</strong> {getTotalTimeSlots()}
              </p>
              <p className="summary-text">
                <strong>Time zone:</strong> {TIME_ZONES.find((tz) => tz.abbr === selectedTimeZone)?.label}
              </p>
            </div>
          )}

          <div className="button-group">
            <button type="submit" disabled={loading} className="next-button">
              {loading ? 'Saving...' : 'Next'}
            </button>
            <button type="button" onClick={handleSkip} disabled={loading} className="skip-button">
              Skip for Now
            </button>
          </div>
        </form>

        <div className="info-note">
          <span className="note-icon">ℹ</span>
          <p>Click on dates to select them, then choose your available time slots. You can update your availability anytime.</p>
        </div>
      </div>
    </div>
  );
}

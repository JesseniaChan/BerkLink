import React, { useState, useEffect } from 'react';
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

// Time zones for inclusivity (PST/PDT, MST/MDT, CST/CDT, EST/EDT)
const TIME_ZONES = [
  { label: 'Pacific (PT)', abbr: 'PT', offset: -7 }, // PDT
  { label: 'Mountain (MT)', abbr: 'MT', offset: -6 }, // MDT
  { label: 'Central (CT)', abbr: 'CT', offset: -5 }, // CDT
  { label: 'Eastern (ET)', abbr: 'ET', offset: -4 }, // EDT
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function Availability({ userId, onNext, onSkip }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState({});
  const [selectedTimeZone, setSelectedTimeZone] = useState('PT');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Get calendar days for current month
  const convertTimeToTimeZone = (timeStr, toTimeZone) => {
    // Parse the time string (e.g., "8:00 AM")
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);

    // Convert to 24-hour format
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }

    // Get the target time zone offset
    const currentTZ = TIME_ZONES.find((tz) => tz.abbr === selectedTimeZone);
    const targetTZ = TIME_ZONES.find((tz) => tz.abbr === toTimeZone);
    const offsetDiff = targetTZ.offset - currentTZ.offset;

    // Adjust hours
    let newHours = hours + offsetDiff;
    if (newHours < 0) newHours += 24;
    if (newHours >= 24) newHours -= 24;

    // Convert back to 12-hour format
    const newPeriod = newHours >= 12 ? 'PM' : 'AM';
    const displayHours = newHours % 12 === 0 ? 12 : newHours % 12;

    return `${displayHours}:${String(minutes).padStart(2, '0')} ${newPeriod}`;
  };

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDateKey = (date) => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const toggleDate = (day) => {
    const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateKey = formatDateKey(dateObj);

    setSelectedDates((prev) => {
      if (prev[dateKey]) {
        const newDates = { ...prev };
        delete newDates[dateKey];
        return newDates;
      } else {
        return {
          ...prev,
          [dateKey]: [],
        };
      }
    });
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

  const hasSelection = () => {
    return Object.keys(selectedDates).length > 0;
  };

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
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    );
  };

  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    );
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const handleNext = async (e) => {
    e.preventDefault();
    setError('');

    if (!hasSelection()) {
      setError('Please select at least one date and time slot');
      return;
    }

    setLoading(true);

    try {
      // Format availability data
      const availabilityData = {};
      Object.entries(selectedDates).forEach(([dateKey, times]) => {
        availabilityData[dateKey] = times;
      });

      const savedData = await saveOnboardingStep(userId, {
        availability_dates: availabilityData,
        selected_dates: Object.keys(selectedDates),
      });

      if (savedData) {
        setSuccess(true);

        if (onNext) {
          onNext(savedData);
        }
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
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
                {/* Calendar Navigation */}
                <div className="calendar-header">
                  <button
                    type="button"
                    onClick={previousMonth}
                    className="month-nav-button"
                    disabled={loading}
                  >
                    ←
                  </button>
                  <h3 className="month-year-title">
                    {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </h3>
                  <button
                    type="button"
                    onClick={nextMonth}
                    className="month-nav-button"
                    disabled={loading}
                  >
                    →
                  </button>
                </div>

                {/* Calendar Grid */}
                <div className="calendar-wrapper">
                  {/* Day headers */}
                  <div className="calendar-grid">
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day} className="calendar-day-header">
                        {day}
                      </div>
                    ))}

                    {/* Calendar days */}
                    {calendarDays.map((day, index) => {
                      const dateKey =
                        day !== null
                          ? formatDateKey(
                              new Date(
                                currentDate.getFullYear(),
                                currentDate.getMonth(),
                                day
                              )
                            )
                          : null;

                      return (
                        <div
                          key={index}
                          className={`calendar-day ${
                            day === null ? 'empty' : ''
                          } ${dateKey && selectedDates[dateKey] ? 'selected' : ''}`}
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

            {/* RIGHT: Time Slots with Time Zones */}
            <div className="time-zones-panel">
              {!hasSelection() ? (
                <div className="timezone-placeholder">
                  <p>Select dates on the left to view time slots</p>
                </div>
              ) : (
                <>
                  {/* Time Zone Selector */}
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
                        <option key={tz.abbr} value={tz.abbr}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Time Slots for Selected Time Zone Only */}
                  <div className="time-slots-container">
                    <h4 className="time-slots-title">
                      Available times for {getSelectedDateDisplay()}
                    </h4>

                    <div className="timezone-time-slots">
                      <div className="timezone-header">
                        <h5 className="timezone-time">
                          {TIME_ZONES.find((tz) => tz.abbr === selectedTimeZone)?.label}
                        </h5>
                      </div>
                      <div className="time-slots-grid">
                        {TIME_SLOTS.map((time) => (
                          <label
                            key={`${selectedTimeZone}-${time}`}
                            className="time-slot-checkbox"
                          >
                            <input
                              type="checkbox"
                              onChange={() => {
                                Object.keys(selectedDates).forEach((dateKey) => {
                                  toggleTimeSlot(dateKey, time);
                                });
                              }}
                              disabled={loading}
                            />
                            <span className="time-slot-display">{time}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
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
            <button
              type="submit"
              disabled={loading}
              className="next-button"
            >
              {loading ? 'Saving...' : 'Next'}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={loading}
              className="skip-button"
            >
              Skip for Now
            </button>
          </div>
        </form>

        <div className="info-note">
          <span className="note-icon">ℹ</span>
          <p>
            Click on dates to select them, then choose your available time slots. You can update your availability anytime.
          </p>
        </div>
      </div>
    </div>
  );
}

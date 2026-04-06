import React, { useState } from 'react';
import { saveOnboardingStep } from '../services/onboardingService';
import '../styles/Classes.css';

const DEFAULT_CLASSES = [
  'CS61A',
  'Data8',
  'Math54',
  'Math52',
  'Data100',
];

export default function Classes({ userId, onNext, onSkip }) {
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [customClass, setCustomClass] = useState('');
  const [customClasses, setCustomClasses] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const toggleDefaultClass = (className) => {
    setSelectedClasses((prev) =>
      prev.includes(className) ? prev.filter((c) => c !== className) : [...prev, className]
    );
  };

  const addCustomClass = (e) => {
    e.preventDefault();
    const trimmedClass = customClass.trim().toUpperCase();
    if (!trimmedClass) { setError('Please enter a class name'); return; }
    if (selectedClasses.includes(trimmedClass) || customClasses.includes(trimmedClass)) {
      setError('This class is already added'); setCustomClass(''); return;
    }
    if (DEFAULT_CLASSES.includes(trimmedClass)) {
      setError('This class is already in the list. Please select it from above.');
      setCustomClass(''); return;
    }
    setCustomClasses([...customClasses, trimmedClass]);
    setSelectedClasses([...selectedClasses, trimmedClass]);
    setCustomClass('');
    setError('');
  };

  const removeCustomClass = (className) => {
    setCustomClasses(customClasses.filter((c) => c !== className));
    setSelectedClasses(selectedClasses.filter((c) => c !== className));
  };

  const hasSelection = () => selectedClasses.length > 0;

  const handleNext = async (e) => {
    e.preventDefault();
    setError('');
    if (!hasSelection()) { setError('Please select at least one class'); return; }
    setLoading(true);

    try {
      // ✅ Save classes as a plain array — column is now jsonb, no JSON.stringify needed
      const savedData = await saveOnboardingStep(userId, {
        classes: selectedClasses,
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

  const handleSkip = () => { if (onSkip) onSkip(); };

  return (
    <div className="classes-container">
      <div className="classes-card">
        <h2>What Classes Are You Taking?</h2>
        <p className="classes-subtitle">
          Select the courses you're currently enrolled in to find study group matches
        </p>

        {success && (
          <div className="success-message">
            <span className="success-icon">✓</span>
            Classes saved successfully!
          </div>
        )}

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠</span>
            {error}
          </div>
        )}

        <form onSubmit={handleNext}>
          {/* Default Classes */}
          <div className="classes-section">
            <h3 className="section-title">Popular Classes</h3>
            <div className="classes-grid">
              {DEFAULT_CLASSES.map((className) => (
                <button
                  key={className}
                  type="button"
                  className={`class-button ${selectedClasses.includes(className) ? 'selected' : ''}`}
                  onClick={() => toggleDefaultClass(className)}
                  disabled={loading}
                >
                  <span className="class-checkbox">{selectedClasses.includes(className) ? '✓' : ''}</span>
                  <span className="class-name">{className}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Class Input */}
          <div className="classes-section">
            <h3 className="section-title">Add Custom Class</h3>
            <p className="section-subtitle">Don't see your class? Add it manually below</p>
            <div className="custom-class-form">
              <input
                type="text"
                placeholder="Enter class name or code (e.g., CS170, PHYS7A)"
                value={customClass}
                onChange={(e) => setCustomClass(e.target.value.toUpperCase())}
                disabled={loading}
                className="custom-class-input"
                maxLength={50}
              />
              <button
                type="button"
                onClick={addCustomClass}
                disabled={loading || !customClass.trim()}
                className="add-class-button"
              >
                {loading ? 'Adding...' : 'Add'}
              </button>
            </div>

            {customClasses.length > 0 && (
              <div className="custom-classes-list">
                <h4 className="custom-classes-title">Your Custom Classes</h4>
                <div className="custom-classes-grid">
                  {customClasses.map((className) => (
                    <div key={className} className="custom-class-tag">
                      <span className="custom-class-text">{className}</span>
                      <button
                        type="button"
                        onClick={() => removeCustomClass(className)}
                        className="custom-class-remove"
                        disabled={loading}
                      >×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          {hasSelection() && (
            <div className="selection-summary">
              <p className="summary-text">
                <strong>Selected classes ({selectedClasses.length}):</strong>
              </p>
              <div className="selected-classes-display">
                {selectedClasses.map((className) => (
                  <span key={className} className="class-tag">{className}</span>
                ))}
              </div>
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
          <p>Your classes help us match you with other students taking the same courses.</p>
        </div>
      </div>
    </div>
  );
}

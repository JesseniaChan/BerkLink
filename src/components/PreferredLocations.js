import React, { useState } from 'react';
import { saveOnboardingStep } from '../services/onboardingService';
import '../styles/PreferredLocations.css';

const PRESET_LOCATIONS = [
  'Moffitt 4th',
  'Doe Library',
  'Soda 380',
  'Evans Hall',
  'Main Stacks',
  'Valley LSB',
  'Cory 299',
];

const MAX = 3;

export default function PreferredLocations({ userId, onNext, onSkip }) {
  const [selected, setSelected] = useState([]);
  const [customInput, setCustomInput] = useState('');
  const [shaking, setShaking] = useState(false);
  const [limitMsg, setLimitMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const triggerShake = () => {
    setLimitMsg('Pick up to 3');
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  };

  const toggle = (loc) => {
    if (selected.includes(loc)) {
      setSelected(selected.filter((l) => l !== loc));
      setLimitMsg('');
    } else if (selected.length >= MAX) {
      triggerShake();
    } else {
      setSelected([...selected, loc]);
      setLimitMsg('');
    }
  };

  const addCustom = () => {
    const val = customInput.trim();
    if (!val) return;
    if (selected.includes(val)) {
      setError('Already selected');
      setCustomInput('');
      return;
    }
    if (selected.length >= MAX) {
      triggerShake();
      setCustomInput('');
      return;
    }
    setSelected([...selected, val]);
    setCustomInput('');
    setError('');
    setLimitMsg('');
  };

  const handleNext = async () => {
    setError('');
    setLoading(true);
    try {
      const savedData = await saveOnboardingStep(userId, {
        preferred_locations: selected,
      });
      if (onNext) onNext(savedData);
    } catch (err) {
      setError(err.message || 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pref-loc-container">
      <div className="pref-loc-card">
        <h2>Where Do You Like to Study?</h2>
        <p className="pref-loc-subtitle">Pick up to 3 favorite spots on campus</p>

        {limitMsg && <div className="pref-loc-limit-msg">{limitMsg}</div>}
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠</span>
            {error}
          </div>
        )}

        <div className={`pref-loc-chips${shaking ? ' pref-loc-shake' : ''}`}>
          {PRESET_LOCATIONS.map((loc) => (
            <button
              key={loc}
              type="button"
              className={`pref-loc-chip${selected.includes(loc) ? ' selected' : ''}`}
              onClick={() => toggle(loc)}
              disabled={loading}
            >
              {loc}
            </button>
          ))}
        </div>

        <div className="pref-loc-custom">
          <input
            type="text"
            placeholder="Or type your own spot..."
            value={customInput}
            onChange={(e) => { setCustomInput(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            disabled={loading}
            maxLength={50}
            className="pref-loc-custom-input"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={loading || !customInput.trim()}
            className="pref-loc-add-btn"
          >
            Add
          </button>
        </div>

        {selected.length > 0 && (
          <div className="pref-loc-selected">
            <p className="pref-loc-selected-label">Selected ({selected.length}/3):</p>
            <div className="pref-loc-selected-chips">
              {selected.map((loc) => (
                <span key={loc} className="pref-loc-selected-chip">
                  {loc}
                  <button
                    type="button"
                    onClick={() => toggle(loc)}
                    className="pref-loc-remove"
                    disabled={loading}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="button-group">
          <button
            type="button"
            onClick={handleNext}
            disabled={loading}
            className="next-button"
          >
            {loading ? 'Saving...' : 'Finish'}
          </button>
          <button
            type="button"
            onClick={() => onSkip && onSkip()}
            disabled={loading}
            className="skip-button"
          >
            Skip for Now
          </button>
        </div>
      </div>
    </div>
  );
}

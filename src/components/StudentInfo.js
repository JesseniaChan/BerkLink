import React, { useState } from 'react';
import { saveOnboardingStep } from '../services/onboardingService';
import '../styles/StudentInfo.css';

export default function StudentInfo({ userId, onNext, onSkip }) {
  const [instagram, setInstagram] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [touched, setTouched] = useState({ instagram: false, phone: false });

  const validateInstagram = (value) => {
    // Instagram handle validation: alphanumeric, dots, underscores
    const instagramRegex = /^[a-zA-Z0-9._]{3,30}$/;
    return instagramRegex.test(value);
  };

  const validatePhone = (value) => {
    // Basic phone validation: removes non-digits for checking
    const digitsOnly = value.replace(/\D/g, '');
    return digitsOnly.length === 10;
  };

  const formatPhone = (value) => {
    // Format phone number as (XXX) XXX-XXXX
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length === 0) return '';
    if (digitsOnly.length <= 3) return `(${digitsOnly}`;
    if (digitsOnly.length <= 6) return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`;
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6, 10)}`;
  };

  const handleInstagramChange = (e) => {
    const value = e.target.value;
    // Allow typing without strict validation - only check on blur/submit
    setInstagram(value);
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    // Allow numeric input and formatting - only validate up to 10 digits
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length <= 10) {
      setPhone(formatPhone(value));
    }
  };

  const handleFieldBlur = (field) => {
    setTouched({ ...touched, [field]: true });
  };

  const isFormValid = () => {
    return instagram.trim() !== '' && phone.replace(/\D/g, '').length === 10;
  };

  const handleNext = async (e) => {
    e.preventDefault();
    setError('');

    // Mark all fields as touched for validation display
    setTouched({ instagram: true, phone: true });

    // Validate before saving
    if (!instagram.trim()) {
      setError('Please enter your Instagram handle');
      return;
    }

    if (phone.replace(/\D/g, '').length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);

    try {
      // Save Instagram and phone to the students table
      const savedData = await saveOnboardingStep(userId, {
        instagram: instagram.trim().toLowerCase(),
        phone: phone.replace(/\D/g, ''),
      });

      if (savedData) {
        setSuccess(true);
        // Reset form
        setInstagram('');
        setPhone('');

        // Call the onNext callback with saved data
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
    // Skip without saving
    if (onSkip) {
      onSkip();
    }
  };

  return (
    <div className="student-info-container">
      <div className="student-info-card">
        <h2>Complete Your Profile</h2>
        <p className="student-info-subtitle">Share your contact info to connect with study groups</p>

        <div className="info-note">
          <span className="note-icon">ℹ</span>
          <p>
            If you don't enter both your Instagram and phone number, it may be hard for other students to find you and create study groups.
          </p>
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠</span>
            {error}
          </div>
        )}

        <form onSubmit={handleNext}>
          <div className="form-group">
            <label htmlFor="instagram">Instagram Handle *</label>
            <input
              id="instagram"
              type="text"
              placeholder="your.username"
              value={instagram}
              onChange={handleInstagramChange}
              onBlur={() => handleFieldBlur('instagram')}
              disabled={loading}
              required
            />
            {touched.instagram && instagram && !validateInstagram(instagram) && (
              <span className="validation-hint">Invalid Instagram handle</span>
            )}
            {touched.instagram && !instagram && (
              <span className="validation-hint">Instagram handle is required</span>
            )}
            <span className="field-helper">
              {instagram.length}/30 characters
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number *</label>
            <input
              id="phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={phone}
              onChange={handlePhoneChange}
              onBlur={() => handleFieldBlur('phone')}
              disabled={loading}
              required
            />
            {touched.phone && phone && phone.replace(/\D/g, '').length !== 10 && (
              <span className="validation-hint">Please enter a valid 10-digit phone number</span>
            )}
            {touched.phone && !phone && (
              <span className="validation-hint">Phone number is required</span>
            )}
          </div>

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
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { saveOnboardingStep } from '../services/onboardingService';
import '../styles/StudentInfo.css';

export default function StudentInfo({ userId, onNext, onSkip }) {
  const [fullName, setFullName] = useState('');
  const [instagram, setInstagram] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ fullName: false, instagram: false, phone: false });

  const validateInstagram = (value) => {
    const instagramRegex = /^[a-zA-Z0-9._]{3,30}$/;
    return instagramRegex.test(value);
  };

  const formatPhone = (value) => {
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length === 0) return '';
    if (digitsOnly.length <= 3) return `(${digitsOnly}`;
    if (digitsOnly.length <= 6) return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`;
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6, 10)}`;
  };

  const handlePhoneChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '');
    if (digitsOnly.length <= 10) {
      setPhone(formatPhone(e.target.value));
    }
  };

  const handleFieldBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const splitName = (name) => {
    const trimmed = name.trim();
    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx === -1) return { first_name: trimmed, last_name: '' };
    return {
      first_name: trimmed.slice(0, spaceIdx).trim(),
      last_name: trimmed.slice(spaceIdx + 1).trim(),
    };
  };

  const handleNext = async (e) => {
    e.preventDefault();
    setError('');
    setTouched({ fullName: true, instagram: true, phone: true });

    if (!fullName.trim() || fullName.trim().indexOf(' ') === -1) {
      setError('Please enter your first and last name');
      return;
    }
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
      const { first_name, last_name } = splitName(fullName);
      const savedData = await saveOnboardingStep(userId, {
        first_name,
        last_name,
        instagram: instagram.trim().toLowerCase(),
        phone: phone.replace(/\D/g, ''),
      });

      if (savedData) {
        setFullName('');
        setInstagram('');
        setPhone('');
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
    <div className="student-info-container">
      <div className="student-info-card">
        <h2>Complete Your Profile</h2>
        <p className="student-info-subtitle">Share your info to connect with study groups</p>

        <div className="info-note">
          <span className="note-icon">ℹ</span>
          <p>
            Fill in your name, Instagram, and phone so other students can find and connect with you.
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
            <label htmlFor="fullName">Full Name *</label>
            <input
              id="fullName"
              type="text"
              placeholder="First Last"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={() => handleFieldBlur('fullName')}
              disabled={loading}
              required
            />
            {touched.fullName && !fullName.trim() && (
              <span className="validation-hint">Full name is required</span>
            )}
            {touched.fullName && fullName.trim() && fullName.trim().indexOf(' ') === -1 && (
              <span className="validation-hint">Please enter both first and last name</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="instagram">Instagram Handle *</label>
            <input
              id="instagram"
              type="text"
              placeholder="your.username"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
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
            <span className="field-helper">{instagram.length}/30 characters</span>
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
            <button type="submit" disabled={loading} className="next-button">
              {loading ? 'Saving...' : 'Next'}
            </button>
            <button type="button" onClick={handleSkip} disabled={loading} className="skip-button">
              Skip for Now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

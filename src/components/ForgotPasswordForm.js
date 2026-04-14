import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/ForgotPasswordForm.css';

export default function ForgotPasswordForm({ onSwitchToLogin }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validation checks
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    setLoading(true);

    try {
      // Call Supabase resetPasswordForEmail API
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}?type=recovery`,
      });

      if (resetError) {
        setError(resetError.message || 'Failed to send reset email. Please try again.');
        return;
      }

      setSuccess(true);
      setEmail('');
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Password reset error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-card">
        <h2>Forgot Password?</h2>
        <p className="forgot-password-subtitle">
          Enter your Berkeley email and we'll send you a link to reset your password
        </p>

        {success && (
          <div className="success-message">
            <span className="success-icon">✓</span>
            Check your email for the password reset link!
          </div>
        )}

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Berkeley Email *</label>
            <input
              id="email"
              type="email"
              placeholder="your-name@berkeley.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || success}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="reset-button"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="form-footer">
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="back-to-login-link"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}

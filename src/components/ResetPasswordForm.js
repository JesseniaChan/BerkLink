import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/ResetPasswordForm.css';

export default function ResetPasswordForm({ onResetComplete, onSwitchToLogin }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasValidSession, setHasValidSession] = useState(false);

  useEffect(() => {
    // Check if user has a valid recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setHasValidSession(true);
      } else {
        setError('Invalid or expired reset link. Please request a new one.');
      }
    });
  }, []);

  // Validate password requirements
  const validatePassword = (pwd) => {
    return pwd.length >= 8;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validation checks
    if (!password) {
      setError('Password is required');
      return;
    }

    if (!validatePassword(password)) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message || 'Failed to update password. Please try again.');
        return;
      }

      setSuccess(true);
      // Reset form
      setPassword('');
      setConfirmPassword('');

      // Auto-redirect after success
      setTimeout(() => {
        onResetComplete();
      }, 2000);
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Password update error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!hasValidSession && !error) {
    return (
      <div className="reset-password-container">
        <div className="reset-password-card">
          <div className="loading-spinner">Verifying reset link...</div>
        </div>
      </div>
    );
  }

  if (error && !hasValidSession) {
    return (
      <div className="reset-password-container">
        <div className="reset-password-card">
          <h2>Password Reset</h2>
          <div className="error-message">
            <span className="error-icon">⚠</span>
            {error}
          </div>
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="back-to-login-link"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-container">
      <div className="reset-password-card">
        <h2>Reset Password</h2>
        <p className="reset-password-subtitle">
          Enter your new password
        </p>

        {success && (
          <div className="success-message">
            <span className="success-icon">✓</span>
            Password updated successfully! Redirecting...
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
            <label htmlFor="password">New Password *</label>
            <input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || success}
              required
            />
            {password && !validatePassword(password) && (
              <span className="validation-hint">
                Must be at least 8 characters
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password *</label>
            <input
              id="confirmPassword"
              type="password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading || success}
              required
            />
            {confirmPassword && password !== confirmPassword && (
              <span className="validation-hint">Passwords do not match</span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="reset-button"
          >
            {loading ? 'Updating Password...' : 'Update Password'}
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

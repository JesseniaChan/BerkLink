import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/SignupForm.css';

export default function SignupForm({ onSwitchToLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Validate email ends with @berkeley.edu
  const validateEmail = (emailValue) => {
    return emailValue.endsWith('@berkeley.edu');
  };

  // Validate password requirements
  const validatePassword = (pwd) => {
    return pwd.length >= 8;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validation checks
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please use a Berkeley email address (@berkeley.edu)');
      return;
    }

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
      // Call Supabase signUp API
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (signupError) {
        setError(signupError.message || 'Signup failed. Please try again.');
        return;
      }

      if (data) {
        setSuccess(true);
        setSuccessMessage(
          'Signup successful! Please check your email to confirm your account.'
        );
        // Reset form
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Signup error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card">
        <h2>BerkLink Sign Up</h2>
        <p className="signup-subtitle">Join using your Berkeley email</p>

        {success && (
          <div className="success-message">
            <span className="success-icon">✓</span>
            {successMessage}
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Berkeley Email *</label>
            <input
              id="email"
              type="email"
              placeholder="your-name@berkeley.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
            {email && !validateEmail(email) && (
              <span className="validation-hint">
                Must end with @berkeley.edu
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
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
              disabled={loading}
              required
            />
            {confirmPassword && password !== confirmPassword && (
              <span className="validation-hint">Passwords do not match</span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="signup-button"
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <p className="login-link">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="switch-link"
          >
            Log in here
          </button>
        </p>
      </div>
    </div>
  );
}

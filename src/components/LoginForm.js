import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/LoginForm.css';

export default function LoginForm({ onSwitchToSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);

    try {
      // Call Supabase signInWithPassword API
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // Handle specific error cases
        if (signInError.message.toLowerCase().includes('invalid login credentials')) {
          setError('Invalid email or password. Please try again.');
        } else if (
          signInError.message.toLowerCase().includes('email not confirmed') ||
          signInError.message.toLowerCase().includes('unconfirmed')
        ) {
          setError(
            'Your email has not been confirmed yet. Please check your email for a confirmation link.'
          );
        } else {
          setError(signInError.message || 'Login failed. Please try again.');
        }
        return;
      }

      if (data?.user) {
        setSuccess(true);
        // Reset form
        setEmail('');
        setPassword('');
        // You can redirect here or perform other actions
        // For example: redirect to dashboard
        // window.location.href = '/dashboard';
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>BerkLink Login</h2>
        <p className="login-subtitle">Access your Berkeley community</p>

        {success && (
          <div className="success-message">
            <span className="success-icon">✓</span>
            Login successful! Redirecting...
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
            <label htmlFor="email">Email Address *</label>
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

          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || success}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="login-button"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="form-footer">
          <a href="/forgot-password" className="forgot-password-link">
            Forgot your password?
          </a>
        </div>

        <p className="signup-link">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignup}
            className="switch-link"
          >
            Sign up here
          </button>
        </p>
      </div>
    </div>
  );
}

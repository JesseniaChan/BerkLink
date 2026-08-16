import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/SignupForm.css';

export default function SignupForm({ onSwitchToLogin, authError }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignup = async () => {
    setError('');
    setLoading(true);

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          // Nudges Google's account chooser toward Berkeley accounts.
          // Not a security boundary — the app still verifies the email
          // domain after the redirect back.
          queryParams: {
            hd: 'berkeley.edu',
            prompt: 'select_account',
          },
        },
      });

      if (oauthError) {
        setError(oauthError.message || 'Could not start Google sign up. Please try again.');
        setLoading(false);
      }
      // On success, the browser redirects to Google, so no further
      // state update is needed here.
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Signup error:', err);
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card">
        <h2>BerkLink Sign Up</h2>
        <p className="signup-subtitle">Join using your Berkeley Google account</p>

        {(authError || error) && (
          <div className="error-message">{authError || error}</div>
        )}

        <button
          type="button"
          className="signup-button google-button"
          onClick={handleGoogleSignup}
          disabled={loading}
        >
          {loading ? 'Redirecting to Google...' : 'Continue with Google'}
        </button>

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

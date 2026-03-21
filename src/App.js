import { useState, useEffect } from 'react';
import './App.css';
import { supabase } from './supabaseClient';
import SignupForm from './components/SignupForm';
import LoginForm from './components/LoginForm';
import OnboardingWrapper from './components/OnboardingWrapper';

function App() {
  const [isLogin, setIsLogin] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    checkUser();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  const handleOnboardingComplete = () => {
    console.log('Onboarding completed for user:', user.id);
    // Redirect to dashboard or home page
    // window.location.href = '/dashboard';
  };

  if (loading) {
    return (
      <div className="App loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  // If user is logged in, show onboarding flow
  if (user) {
    return (
      <div className="App">
        <OnboardingWrapper 
          userId={user.id} 
          onComplete={handleOnboardingComplete}
        />
      </div>
    );
  }

  // Otherwise show login/signup forms
  return (
    <div className="App">
      {isLogin ? (
        <LoginForm onSwitchToSignup={() => setIsLogin(false)} />
      ) : (
        <SignupForm onSwitchToLogin={() => setIsLogin(true)} />
      )}
    </div>
  );
}

export default App;

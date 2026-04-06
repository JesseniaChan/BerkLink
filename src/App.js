import { useState, useEffect } from 'react';
import './App.css';
import { supabase } from './supabaseClient';
import SignupForm from './components/SignupForm';
import LoginForm from './components/LoginForm';
import OnboardingWrapper from './components/OnboardingWrapper';
import MyGroup from './components/MyGroup';

function App() {
  const [isLogin, setIsLogin] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [page, setPage] = useState('onboarding'); // 'onboarding' | 'mygroup'

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
      }
    );
    return () => subscription?.unsubscribe();
  }, []);

  const handleOnboardingComplete = () => {
    setOnboardingDone(true);
    setPage('mygroup');
  };

  if (loading) {
    return (
      <div className="App loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="App">
        {/* Nav */}
        <nav className="app-nav">
          <span className="nav-brand">◈ BerkLink</span>
          <div className="nav-links">
            <button
              className={`nav-btn ${page === 'onboarding' ? 'active' : ''}`}
              onClick={() => setPage('onboarding')}
            >
              My Profile
            </button>
            <button
              className={`nav-btn ${page === 'mygroup' ? 'active' : ''}`}
              onClick={() => setPage('mygroup')}
            >
              My Groups
            </button>
            <button className="nav-btn signout" onClick={() => supabase.auth.signOut()}>
              Sign Out
            </button>
          </div>
        </nav>

        {/* Page Content */}
        {page === 'onboarding' ? (
          <OnboardingWrapper
            userId={user.id}
            onComplete={handleOnboardingComplete}
          />
        ) : (
          <MyGroup userId={user.id} />
        )}
      </div>
    );
  }

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

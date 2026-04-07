import { useState, useEffect } from 'react';
import './App.css';
import { supabase } from './supabaseClient';
import SignupForm from './components/SignupForm';
import LoginForm from './components/LoginForm';
import OnboardingWrapper from './components/OnboardingWrapper';
import ProfilePage from './components/ProfilePage';
import MyGroup from './components/MyGroup';

function App() {
  const [isLogin, setIsLogin] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [page, setPage] = useState('onboarding');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        checkProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          checkProfile(session.user.id);
        } else {
          setUser(null);
          setHasProfile(false);
          setLoading(false);
        }
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  async function checkProfile(userId) {
    const { data } = await supabase
      .from('students')
      .select('user_id, instagram, classes, availability_dates')
      .eq('user_id', userId)
      .single();

    // Consider profile complete if they have instagram AND at least one class
    const complete = data && data.instagram && data.classes && data.classes.length > 0;
    setHasProfile(complete);
    setPage((currentPage) => (complete && currentPage !== 'profile' ? 'mygroup' : currentPage));
    setLoading(false);
  }

  const handleOnboardingComplete = (redirectPage = 'mygroup') => {
    setHasProfile(true);
    setPage(redirectPage);
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
        <nav className="app-nav">
          <span className="nav-brand">◈ BerkLink</span>
          <div className="nav-links">
            <button
              className={`nav-btn ${page === 'profile' ? 'active' : ''}`}
              onClick={() => setPage('profile')}
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

        {page === 'profile' ? (
          hasProfile ? (
            <ProfilePage userId={user.id} onProfileUpdated={() => checkProfile(user.id)} />
          ) : (
            <OnboardingWrapper
              userId={user.id}
              onComplete={() => handleOnboardingComplete('profile')}
            />
          )
        ) : page === 'onboarding' ? (
          <OnboardingWrapper
            userId={user.id}
            onComplete={() => handleOnboardingComplete('mygroup')}
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

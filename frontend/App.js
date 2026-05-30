import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Platform
} from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import AdminLayout from './src/components/AdminLayout';

export default function App() {
  const [screen, setScreen] = useState('login');
  const [sessionToken, setSessionToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Validate active session token from Local Storage on startup
  useEffect(() => {
    const checkSession = async () => {
      try {
        let storedToken = null;
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          storedToken = window.localStorage.getItem('cms_session_token');
        }

        if (!storedToken) {
          setLoading(false);
          return;
        }

        const response = await fetch('http://localhost:5000/api/auth/session', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${storedToken}`
          }
        });

        const json = await response.json();
        if (json.success) {
          setSessionToken(storedToken);
          setCurrentUser(json.user);
          setScreen('admin');
        } else {
          // Token invalid/expired, clear storage
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.localStorage.removeItem('cms_session_token');
          }
        }
      } catch (err) {
        console.error('Error establishing session with gateway:', err);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const handleLoginSuccess = (token, user) => {
    setSessionToken(token);
    setCurrentUser(user);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem('cms_session_token', token);
    }
    setScreen('admin');
  };

  const handleLogout = async () => {
    try {
      if (sessionToken) {
        await fetch('http://localhost:5000/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          }
        });
      }
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      setSessionToken(null);
      setCurrentUser(null);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.localStorage.removeItem('cms_session_token');
      }
      setScreen('login');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  // Gateway route switches
  switch (screen) {
    case 'login':
      return (
        <LoginScreen 
          onLoginSuccess={handleLoginSuccess}
          onNavigate={(target) => setScreen(target)}
        />
      );
    case 'signup':
      return (
        <SignupScreen 
          onNavigate={(target) => setScreen(target)}
        />
      );
    case 'forgot_password':
      return (
        <ForgotPasswordScreen 
          onNavigate={(target) => setScreen(target)}
        />
      );
    case 'reset_password':
      return (
        <ResetPasswordScreen 
          onNavigate={(target) => setScreen(target)}
        />
      );
    case 'admin':
      return (
        <AdminLayout 
          currentUser={currentUser} 
          onLogout={handleLogout} 
        />
      );
    default:
      return (
        <LoginScreen 
          onLoginSuccess={handleLoginSuccess}
          onNavigate={(target) => setScreen(target)}
        />
      );
  }
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center'
  }
});

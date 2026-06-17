import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Platform, ActivityIndicator, Text, useWindowDimensions, TouchableOpacity } from 'react-native';
import ToastContainer from './components/Toast';
import TelemedicineOnboardingScreen from './screens/TelemedicineOnboardingScreen';
import TelemedicineUserTypeScreen from './screens/TelemedicineUserTypeScreen';
import TelemedicineSignupScreen from './screens/TelemedicineSignupScreen';
import TelemedicineOtpScreen from './screens/TelemedicineOtpScreen';
import TelemedicineProfileScreen from './screens/TelemedicineProfileScreen';
import TelemedicineDashboardScreen from './screens/TelemedicineDashboardScreen';
import TelemedicineSignInScreen from './screens/TelemedicineSignInScreen';
import TelemedicineDoctorApplicationScreen from './screens/TelemedicineDoctorApplicationScreen';
import TelemedicineDoctorPendingScreen from './screens/TelemedicineDoctorPendingScreen';
import TelemedicineDoctorRejectedScreen from './screens/TelemedicineDoctorRejectedScreen';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export default function TelemedicineApp({
  isLoggedIn,
  sessionToken,
  currentUser,
  onBackToHub,
  onNavigateToAdmin,
  onTelemedicineLoginSuccess,
  onTelemedicineLogout,
  loginTrigger = 0
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [loading, setLoading] = useState(true);
  const [subsystemId, setSubsystemId] = useState(null);
  const [siteSettings, setSiteSettings] = useState({});
  const [subsystemData, setSubsystemData] = useState(null);
  const [currentScreen, setCurrentScreen] = useState(isLoggedIn ? 'dashboard' : 'onboarding');
  const [userType, setUserType] = useState('patient'); // 'patient' | 'doctor'
  const [routeParams, setRouteParams] = useState(null);

  // Toast notification state
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((message, type = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const navigateTo = (screenName, params = null) => {
    setCurrentScreen(screenName);
    setRouteParams(params);
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  };

  // Sync login status
  useEffect(() => {
    if (isLoggedIn) {
      const isDoctor = currentUser?.preferences?.user_type === 'doctor';
      const isProfileCompleted = currentUser?.preferences?.doctor_profile?.license?.license_number;
      const doctorStatus = currentUser?.preferences?.doctor_profile?.status;
      if (isDoctor) {
        if (!isProfileCompleted) {
          setCurrentScreen('doctor_apply');
        } else if (doctorStatus === 'pending') {
          setCurrentScreen('doctor_pending');
        } else if (doctorStatus === 'rejected') {
          setCurrentScreen('doctor_rejected');
        } else {
          setCurrentScreen('dashboard');
        }
      } else {
        setCurrentScreen('dashboard');
      }
    } else {
      if (currentScreen === 'dashboard' || currentScreen === 'doctor_pending' || currentScreen === 'doctor_rejected' || currentScreen === 'doctor_apply') {
        setCurrentScreen('onboarding');
      }
    }
  }, [isLoggedIn, currentUser]);

  // Handle header login trigger
  useEffect(() => {
    if (loginTrigger > 0) {
      setCurrentScreen('login');
    }
  }, [loginTrigger]);

  // Fetch Telemedicine subsystem settings
  useEffect(() => {
    const fetchTelemedicineSetup = async () => {
      try {
        setLoading(true);
        // 1. Fetch subsystems list to identify the Telemedicine ID dynamically
        const subRes = await fetch(`${API_URL}/api/subsystems?limit=100`);
        const subJson = await subRes.json();
        let telemedId = 'telemedicine-fallback-id';
        
        if (subJson.success && subJson.data?.subsystems) {
          const matchedSub = subJson.data.subsystems.find(
            (s) => s.slug === 'telemedicine'
          );
          if (matchedSub) {
            telemedId = matchedSub.id;
            setSubsystemData(matchedSub);
          }
        }
        setSubsystemId(telemedId);

        // 2. Fetch Site Settings for this subsystem
        const settingsRes = await fetch(`${API_URL}/api/site-settings?subsystemId=${telemedId}`);
        const settingsJson = await settingsRes.json();
        if (settingsJson.success && settingsJson.data?.settings) {
          const settingsMap = {};
          settingsJson.data.settings.forEach((s) => {
            settingsMap[s.setting_key] = s.setting_value;
          });
          setSiteSettings(settingsMap);
        }
      } catch (err) {
        console.error('Failed to load Telemedicine setup dynamically:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTelemedicineSetup();
  }, []);

  const handleGetStarted = () => {
    navigateTo('usertype');
  };

  const handleLogin = () => {
    navigateTo('login');
  };

  const renderActiveScreen = () => {
    const active = (isLoggedIn && (currentScreen === 'doctor_apply' || currentScreen === 'profile' || currentScreen === 'doctor_pending' || currentScreen === 'doctor_rejected')) 
      ? currentScreen 
      : (isLoggedIn ? 'dashboard' : currentScreen);

    switch (active) {
      case 'onboarding':
        return (
          <TelemedicineOnboardingScreen
            onGetStarted={handleGetStarted}
            onLogin={handleLogin}
            onBackToHub={onBackToHub}
            subsystemData={subsystemData}
            siteSettings={siteSettings}
          />
        );
      case 'usertype':
        return (
          <TelemedicineUserTypeScreen
            onNavigate={navigateTo}
            onSelectUserType={setUserType}
            subsystemData={subsystemData}
            siteSettings={siteSettings}
          />
        );
      case 'signup':
        return (
          <TelemedicineSignupScreen
            onNavigate={navigateTo}
            userType={userType}
            subsystemData={subsystemData}
            siteSettings={siteSettings}
          />
        );
      case 'verify_otp':
        return (
          <TelemedicineOtpScreen
            onNavigate={navigateTo}
            onLoginSuccess={onTelemedicineLoginSuccess}
            routeParams={routeParams}
            subsystemData={subsystemData}
            siteSettings={siteSettings}
          />
        );
      case 'profile':
        return (
          <TelemedicineProfileScreen
            onNavigate={navigateTo}
            sessionToken={sessionToken}
            onLoginSuccess={onTelemedicineLoginSuccess}
          />
        );
      case 'login':
        return (
          <TelemedicineSignInScreen
            onNavigate={navigateTo}
            onLoginSuccess={onTelemedicineLoginSuccess}
            subsystemData={subsystemData}
            siteSettings={siteSettings}
          />
        );
      case 'doctor_apply':
        return (
          <TelemedicineDoctorApplicationScreen
            onNavigate={navigateTo}
            currentUser={currentUser}
            sessionToken={sessionToken}
            onLoginSuccess={onTelemedicineLoginSuccess}
            subsystemData={subsystemData}
            siteSettings={siteSettings}
          />
        );
      case 'doctor_pending':
        return (
          <TelemedicineDoctorPendingScreen
            onLogout={onTelemedicineLogout}
            currentUser={currentUser}
            onNavigate={navigateTo}
            sessionToken={sessionToken}
            onLoginSuccess={onTelemedicineLoginSuccess}
          />
        );
      case 'doctor_rejected':
        return (
          <TelemedicineDoctorRejectedScreen
            onLogout={onTelemedicineLogout}
            onReapply={() => navigateTo('doctor_apply')}
            currentUser={currentUser}
          />
        );
      case 'dashboard':
        return (
          <TelemedicineDashboardScreen
            currentUser={currentUser}
            sessionToken={sessionToken}
            onLogout={onTelemedicineLogout}
            onNavigate={navigateTo}
          />
        );
      default:
        return (
          <TelemedicineOnboardingScreen
            onGetStarted={handleGetStarted}
            onLogin={handleLogin}
            onBackToHub={onBackToHub}
          />
        );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00d2ff" />
        <Text style={styles.loadingText}>Assembling dynamic elements for Telemedicine...</Text>
      </View>
    );
  }

  return (
    <View style={styles.appContainer}>
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Main viewport */}
      <View style={styles.screenWrapper}>
        {renderActiveScreen()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#0F0E17',
    flexDirection: 'column',
    width: '100%'
  },
  screenWrapper: {
    flex: 1,
    minHeight: '80vh',
    width: '100%'
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F0E17',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60
  },
  loadingText: {
    marginTop: 16,
    color: '#00d2ff',
    fontSize: 14.5,
    fontWeight: '500',
    textAlign: 'center'
  },
  // Subsystem inner screen styling (mock dashboard cards)
  contentCard: {
    flex: 1,
    backgroundColor: '#0F0E17',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    minHeight: '80vh',
    maxWidth: 500,
    alignSelf: 'center',
    textAlign: 'center'
  },
  cardEmoji: {
    fontSize: 48,
    marginBottom: 20
  },
  cardTitle: {
    color: '#FFFFF2',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center'
  },
  cardDesc: {
    color: '#A8A4CE',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 35,
    textAlign: 'center'
  },
  mockBtn: {
    width: '100%',
    height: 48,
    borderRadius: 10,
    backgroundColor: '#00d2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    cursor: 'pointer'
  },
  mockBtnText: {
    color: '#0F0E17',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1
  },
  backBtn: {
    padding: 10,
    cursor: 'pointer'
  },
  backBtnText: {
    color: '#A8A4CE',
    fontSize: 13.5,
    fontWeight: '600'
  }
});

import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform, useWindowDimensions, ActivityIndicator, Image } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export default function TelemedicineDoctorPendingScreen({ 
  onLogout, 
  currentUser, 
  onNavigate, 
  sessionToken, 
  onLoginSuccess,
  subsystemData,
  siteSettings 
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [loading, setLoading] = useState(false);
  const [notificationRequested, setNotificationRequested] = useState(false);

  // Pull brand assets from database
  const portalName = subsystemData?.name || 'Telemedicine Hub';
  const portalSubtitle = subsystemData?.settings?.badge || '24/7 Virtual Consultation';
  const doctorImage = subsystemData?.settings?.imageUrl || 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1000&auto=format&fit=crop&q=80';
  const portalDesc = subsystemData?.description || 'Skip the waiting rooms. Connect with a verified doctor in minutes right from your home or office. Secure, private, and convenient.';

  const handleBrowseAsPatient = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/complete-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          preferences: {
            ...currentUser.preferences,
            user_type: 'patient'
          }
        })
      });
      const json = await res.json();
      if (json.success) {
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.showToast) {
          window.showToast(
            'Switched to Patient View 🧑‍⚕️',
            'You can now browse the platform as a patient.',
            'success'
          );
        }
        onLoginSuccess(sessionToken, json.data.user);
      } else {
        console.error('Failed to switch role:', json.message);
      }
    } catch (err) {
      console.error('Failed to switch role:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNotifyMe = () => {
    setNotificationRequested(true);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.showToast) {
      window.showToast(
        'Notification Scheduled! 📬',
        `An email alert will be sent to ${currentUser.email} once your account is verified.`,
        'success'
      );
    }
  };

  const handleContactSupport = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.showToast) {
      window.showToast(
        'Support Contact 📞',
        'Support email: support@jonikwiria.com. Response within 24 hours.',
        'info'
      );
    }
  };

  const renderPendingCard = () => {
    return (
      <View style={isMobile ? styles.card : styles.glassCardDesktop} className="telemed-card">
        {/* Header Row */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={onLogout} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verification Status</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Verification Status Icon */}
        <View style={styles.badgePulseContainer}>
          <View style={styles.iconCircle}>
            <Text style={styles.badgeEmoji}>⏳</Text>
          </View>
          <Text style={styles.badgeLabel}>PENDING VERIFICATION</Text>
        </View>

        <Text style={styles.title}>Your application has been submitted successfully!</Text>
        <Text style={styles.subtitle}>Estimated review time: 1-3 business days</Text>

        {/* Application Status Details Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>📋 Application Status:</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>✅ Documents received</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>⏳ License verification in progress</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>⏳ Background check pending</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>⏳ Qualification verification pending</Text>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          You will receive an email once verified.
        </Text>

        {/* Action List Box */}
        <View style={styles.actionListBox}>
          <Text style={styles.actionListHeader}>In the meantime, you can:</Text>
          
          <TouchableOpacity 
            style={styles.actionListItem}
            onPress={() => onNavigate && onNavigate('profile')}
          >
            <Text style={styles.actionListBullet}>•</Text>
            <Text style={styles.actionListTextLink}>Complete your profile</Text>
          </TouchableOpacity>

          <View style={styles.actionListItem}>
            <Text style={styles.actionListBullet}>•</Text>
            <Text style={styles.actionListText}>Set up your payment details</Text>
          </View>

          <TouchableOpacity 
            style={styles.actionListItem}
            onPress={handleBrowseAsPatient}
            disabled={loading}
          >
            <Text style={styles.actionListBullet}>•</Text>
            {loading ? (
              <ActivityIndicator size="small" color="#00d2ff" style={{ marginLeft: 6 }} />
            ) : (
              <Text style={styles.actionListTextLink}>Browse the platform as a patient</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Side-by-side or stacked buttons */}
        <View style={styles.actionsBtnRow}>
          <TouchableOpacity 
            style={[styles.actionBtn, notificationRequested && styles.actionBtnDisabled]} 
            className="doctor-apply-btn"
            onPress={handleNotifyMe}
            disabled={notificationRequested}
          >
            <Text style={styles.actionBtnText}>
              {notificationRequested ? 'NOTIFY REQUESTED ✅' : 'NOTIFY ME WHEN DONE'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionBtn, styles.actionBtnSecondary]} 
            onPress={handleContactSupport}
          >
            <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>CONTACT SUPPORT</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' && (
        <style dangerouslySetInnerHTML={{__html: `
          .doctor-apply-btn {
            background: linear-gradient(135deg, #00d2ff 0%, #4facfe 100%) !important;
            transition: all 0.25s ease;
          }
          .doctor-apply-btn:hover {
            opacity: 0.95;
            box-shadow: 0 0 20px rgba(0, 210, 255, 0.45);
            transform: translateY(-1px);
          }
          .telemed-card {
            background: rgba(22, 21, 33, 0.8) !important;
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            border: 1px solid rgba(0, 210, 255, 0.15) !important;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 210, 255, 0.05);
            transition: all 0.3s ease;
          }
          .telemed-card:hover {
            border-color: rgba(0, 210, 255, 0.3) !important;
            box-shadow: 0 10px 45px rgba(0, 0, 0, 0.5), 0 0 25px rgba(0, 210, 255, 0.1);
          }
        `}} />
      )}

      {isMobile ? (
        // Mobile layout
        <ScrollView contentContainerStyle={styles.mobileContainer} keyboardShouldPersistTaps="handled">
          <Image source={{ uri: doctorImage }} style={styles.bgImageFull} resizeMode="cover" />
          <View style={styles.gradientOverlayFull} />
          {renderPendingCard()}
        </ScrollView>
      ) : (
        // Desktop split layout
        <View style={styles.desktopContainer}>
          {/* Left panel: imagery and branding */}
          <View style={styles.leftSplit}>
            <Image source={{ uri: doctorImage }} style={styles.splitImage} resizeMode="cover" />
            <View style={styles.gradientOverlaySplit} />
            <View style={styles.leftSplitContent}>
              <Text style={styles.leftSplitMiniHeader}>⚡ {portalSubtitle.toUpperCase()}</Text>
              <Text style={styles.leftSplitTitle}>{portalName}</Text>
              <Text style={styles.leftSplitDesc}>{portalDesc}</Text>
              <View style={styles.featureRow}>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>🛡️</Text>
                  <Text style={styles.featureText}>Secure Records</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>🚀</Text>
                  <Text style={styles.featureText}>Fast Diagnoses</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>📄</Text>
                  <Text style={styles.featureText}>E-Prescriptions</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Right panel: Card */}
          <ScrollView contentContainerStyle={styles.rightSplit} keyboardShouldPersistTaps="handled">
            {renderPendingCard()}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0E17',
    position: 'relative'
  },
  // Mobile layout styles
  mobileContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    paddingVertical: 40,
    minHeight: '100vh',
    position: 'relative'
  },
  bgImageFull: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.35
  },
  gradientOverlayFull: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 14, 23, 0.85)'
  },
  // Desktop layout styles
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    height: '100vh',
    minHeight: 650
  },
  leftSplit: {
    flex: 1.1,
    position: 'relative',
    justifyContent: 'flex-end',
    padding: 60,
    overflow: 'hidden'
  },
  splitImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0.6
  },
  gradientOverlaySplit: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(to top, #0F0E17 10%, rgba(15, 14, 23, 0.4) 100%)'
  },
  leftSplitContent: {
    zIndex: 10,
    maxWidth: 550
  },
  leftSplitMiniHeader: {
    color: '#00d2ff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12
  },
  leftSplitTitle: {
    color: '#FFFFF2',
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 42,
    marginBottom: 16
  },
  leftSplitDesc: {
    color: '#A8A4CE',
    fontSize: 14.5,
    lineHeight: 22,
    marginBottom: 30
  },
  featureRow: {
    flexDirection: 'row',
    gap: 20
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  featureIcon: {
    marginRight: 6,
    fontSize: 14
  },
  featureText: {
    color: '#FFFFF2',
    fontSize: 12,
    fontWeight: '600'
  },
  rightSplit: {
    flex: 1,
    backgroundColor: '#0A090E',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.03)'
  },
  glassCardDesktop: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 40,
    alignItems: 'center',
    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(0, 210, 255, 0.15)'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    width: '100%'
  },
  backBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    cursor: 'pointer'
  },
  backBtnText: {
    color: '#00d2ff',
    fontSize: 13.5,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#FFFFF2',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  card: {
    width: '100%',
    backgroundColor: '#14131D',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2C2B35',
    alignItems: 'center'
  },
  badgePulseContainer: {
    alignItems: 'center',
    marginBottom: 20
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  badgeEmoji: {
    fontSize: 28
  },
  badgeLabel: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase'
  },
  title: {
    color: '#FFFFF2',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 24
  },
  subtitle: {
    color: '#827E8C',
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20
  },
  infoBox: {
    width: '100%',
    backgroundColor: '#0F0E17',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2C2B35',
    marginBottom: 16
  },
  infoTitle: {
    color: '#FFFFF2',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4
  },
  detailLabel: {
    color: '#A8A4CE',
    fontSize: 13,
    fontWeight: '600'
  },
  disclaimer: {
    color: '#827E8C',
    fontSize: 12.5,
    textAlign: 'center',
    marginBottom: 20
  },
  actionListBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: '#2C2B35',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 8
  },
  actionListHeader: {
    color: '#FFFFF2',
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 4
  },
  actionListItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  actionListBullet: {
    color: '#00d2ff',
    marginRight: 8,
    fontSize: 14,
    fontWeight: '800'
  },
  actionListText: {
    color: '#A8A4CE',
    fontSize: 13,
    fontWeight: '500'
  },
  actionListTextLink: {
    color: '#00d2ff',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
    cursor: 'pointer'
  },
  actionsBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'space-between'
  },
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#00d2ff',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer'
  },
  actionBtnDisabled: {
    backgroundColor: 'rgba(0, 210, 255, 0.2)',
    borderColor: 'rgba(0, 210, 255, 0.3)',
    borderWidth: 1
  },
  actionBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2C2B35'
  },
  actionBtnText: {
    color: '#0A090E',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center'
  },
  actionBtnTextSecondary: {
    color: '#FFFFF2'
  }
});

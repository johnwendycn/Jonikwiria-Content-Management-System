import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform, useWindowDimensions, ActivityIndicator } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export default function TelemedicineDoctorPendingScreen({ 
  onLogout, 
  currentUser, 
  onNavigate, 
  sessionToken, 
  onLoginSuccess 
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [loading, setLoading] = useState(false);
  const [notificationRequested, setNotificationRequested] = useState(false);

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

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onLogout} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification Status</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={isMobile ? styles.card : styles.glassCardDesktop} className="telemed-card">
        
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#0F0E17'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 520,
    marginBottom: 20,
    paddingHorizontal: 10
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    cursor: 'pointer'
  },
  backBtnText: {
    color: '#00d2ff',
    fontSize: 14,
    fontWeight: '700'
  },
  headerTitle: {
    color: '#FFFFF2',
    fontSize: 16,
    fontWeight: '800'
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
  glassCardDesktop: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 24,
    paddingVertical: 35,
    paddingHorizontal: 35,
    alignItems: 'center',
    backgroundColor: 'rgba(20, 19, 29, 0.85)',
    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(0, 210, 255, 0.15)'
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

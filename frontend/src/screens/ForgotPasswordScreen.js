import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform
} from 'react-native';

export default function ForgotPasswordScreen({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [tokenInfo, setTokenInfo] = useState('');

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setTokenInfo('');

    try {
      const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      const json = await response.json();
      if (json.success) {
        setSuccessMsg('Recovery token generated successfully!');
        setTokenInfo(json.data.resetToken);
      } else {
        setErrorMsg(json.message || 'Verification email not found.');
      }
    } catch (err) {
      setErrorMsg('Unable to connect to gateway. Please check backend server.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' && (
        <style dangerouslySetInnerHTML={{__html: `
          .auth-input:focus {
            border-color: #6366F1 !important;
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
            transition: all 0.2s ease;
          }
          .auth-btn-gradient {
            background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%) !important;
            transition: all 0.25s ease;
          }
          .auth-btn-gradient:hover {
            opacity: 0.95;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
          }
        `}} />
      )}

      <View style={styles.card}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>C</Text>
        </View>

        <Text style={styles.title}>Recover Password</Text>
        <Text style={styles.subtitle}>Enter your email address to log a password reset token in the system database.</Text>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>❌ {errorMsg}</Text>
          </View>
        ) : null}

        {successMsg ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>✅ {successMsg}</Text>
          </View>
        ) : null}

        {tokenInfo ? (
          <View style={styles.tokenBox}>
            <Text style={styles.tokenLabel}>Test Reset Token (SQLite Audit log):</Text>
            <Text style={styles.tokenText} selectable={true}>{tokenInfo}</Text>
            <TouchableOpacity 
              style={styles.resetNavBtn} 
              onPress={() => onNavigate('reset_password')}
            >
              <Text style={styles.resetNavBtnText}>Go to Reset Page</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.formGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            className="auth-input"
            placeholder="operator@system.local"
            placeholderTextColor="#6B7280"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <TouchableOpacity 
          style={styles.button} 
          className="auth-btn-gradient"
          onPress={handleForgotPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Generate Token</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <TouchableOpacity onPress={() => onNavigate('login')}>
            <Text style={styles.linkText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    alignItems: 'center'
  },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold'
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 12.5,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18
  },
  errorBox: {
    width: '100%',
    backgroundColor: '#451A20',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    borderRadius: 6,
    padding: 10,
    marginBottom: 16
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '500'
  },
  successBox: {
    width: '100%',
    backgroundColor: '#1E3A2F',
    borderWidth: 1,
    borderColor: '#064E3B',
    borderRadius: 6,
    padding: 10,
    marginBottom: 16
  },
  successText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '500'
  },
  tokenBox: {
    width: '100%',
    backgroundColor: '#1E1B4B',
    borderWidth: 1,
    borderColor: '#312E81',
    borderRadius: 6,
    padding: 12,
    marginBottom: 18,
    alignItems: 'center'
  },
  tokenLabel: {
    fontSize: 11,
    color: '#818CF8',
    fontWeight: '600',
    marginBottom: 4
  },
  tokenText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'default',
    color: '#FFFFFF',
    textAlign: 'center',
    backgroundColor: '#0F172A',
    padding: 6,
    borderRadius: 4,
    width: '100%'
  },
  resetNavBtn: {
    marginTop: 10,
    backgroundColor: '#4F46E5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4
  },
  resetNavBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  },
  formGroup: {
    width: '100%',
    marginBottom: 18
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 6
  },
  input: {
    width: '100%',
    height: 40,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13.5,
    color: '#FFFFFF',
    outlineStyle: 'none'
  },
  button: {
    width: '100%',
    height: 40,
    backgroundColor: '#4F46E5',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600'
  },
  linkText: {
    fontSize: 12.5,
    color: '#818CF8'
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24
  }
});

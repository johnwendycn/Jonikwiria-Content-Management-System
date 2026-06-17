import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Alert
} from 'react-native';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000') + '/api/users';

export default function DoctorVerificationsScreen({ currentUser }) {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Tab states: 'pending' | 'approved' | 'rejected'
  const [activeTab, setActiveTab] = useState('pending');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch users with a high limit to ensure we load all doctors for filtering
      const res = await fetch(`${API_BASE_URL}?limit=1000`);
      const json = await res.json();
      if (json.success && json.data?.users) {
        setUsers(json.data.users);
      } else {
        setError(json.message || 'Failed to fetch users list.');
      }
    } catch (err) {
      setError('Could not connect to backend server. Verify the server is active on port 5000.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Filter users that are doctors
  const doctors = users.filter(user => user.preferences?.user_type === 'doctor');

  // Group doctors by status
  const pendingDoctors = doctors.filter(doc => doc.preferences?.doctor_profile?.status === 'pending');
  const approvedDoctors = doctors.filter(doc => doc.preferences?.doctor_profile?.status === 'approved' || (doc.preferences?.doctor_profile?.license?.license_number && !doc.preferences?.doctor_profile?.status));
  const rejectedDoctors = doctors.filter(doc => doc.preferences?.doctor_profile?.status === 'rejected');

  const getActiveList = () => {
    switch (activeTab) {
      case 'pending':
        return pendingDoctors;
      case 'approved':
        return approvedDoctors;
      case 'rejected':
        return rejectedDoctors;
      default:
        return [];
    }
  };

  const handleUpdateStatus = async (doctor, newStatus) => {
    const actionLabel = newStatus === 'approved' ? 'Approve' : 'Reject';
    const confirmMessage = `Are you sure you want to ${actionLabel.toLowerCase()} the application for ${doctor.display_name || doctor.email}?`;
    
    const proceed = Platform.OS === 'web' 
      ? window.confirm(confirmMessage) 
      : await new Promise(resolve => {
          Alert.alert(
            `${actionLabel} Doctor`,
            confirmMessage,
            [
              { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Yes', onPress: () => resolve(true) }
            ]
          );
        });

    if (!proceed) return;

    setLoading(true);
    try {
      const currentPrefs = doctor.preferences || {};
      const doctorProfile = currentPrefs.doctor_profile || {};
      
      const updatedPrefs = {
        ...currentPrefs,
        doctor_profile: {
          ...doctorProfile,
          status: newStatus
        }
      };

      const res = await fetch(`${API_BASE_URL}/${doctor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: updatedPrefs })
      });

      const json = await res.json();
      if (json.success) {
        if (Platform.OS === 'web' && window.showToast) {
          window.showToast(
            `Doctor ${actionLabel}d!`,
            `${doctor.display_name || 'Practitioner'} status updated successfully.`,
            newStatus === 'approved' ? 'success' : 'warning'
          );
        } else {
          Alert.alert('Success', `Doctor application ${newStatus} successfully.`);
        }
        fetchUsers();
      } else {
        Alert.alert('Error', json.message || 'Failed to update doctor status.');
      }
    } catch (err) {
      Alert.alert('Error', 'Connection error. Could not update doctor verification status.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>⚕️ Doctor Document Verification</Text>
          <Text style={styles.headerSubtitle}>
            Review professional credentials, medical license certificates, and payout settings submitted by applicants. Grant or reject telemedicine access to practitioners.
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'pending' && styles.tabButtonActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'pending' && styles.tabButtonTextActive]}>
            Pending Review ({pendingDoctors.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'approved' && styles.tabButtonActive]}
          onPress={() => setActiveTab('approved')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'approved' && styles.tabButtonTextActive]}>
            Approved Doctors ({approvedDoctors.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'rejected' && styles.tabButtonActive]}
          onPress={() => setActiveTab('rejected')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'rejected' && styles.tabButtonTextActive]}>
            Rejected Applications ({rejectedDoctors.length})
          </Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchUsers}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#00d2ff" />
          <Text style={styles.loaderText}>Syncing doctor applications...</Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {getActiveList().length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📁</Text>
              <Text style={styles.emptyText}>No applications found in this category.</Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {getActiveList().map(doc => {
                const profile = doc.preferences?.doctor_profile || {};
                const license = profile.license || {};
                const specs = profile.specializations || [];
                const payout = profile.payout || {};

                return (
                  <View key={doc.id} style={styles.doctorCard}>
                    
                    {/* Doctor Header Info */}
                    <View style={styles.cardHeader}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarEmoji}>⚕️</Text>
                      </View>
                      <View style={styles.cardHeaderMeta}>
                        <Text style={styles.doctorName}>{doc.display_name || 'Practitioner'}</Text>
                        <Text style={styles.doctorEmail}>📧 {doc.email}</Text>
                        <Text style={styles.doctorPhone}>📞 {profile.phone || doc.phone_number || 'N/A'}</Text>
                      </View>
                    </View>

                    {/* Bio */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Bio & Statement</Text>
                      <Text style={styles.bioText}>"{profile.bio || 'No professional bio submitted.'}"</Text>
                    </View>

                    {/* Credentials */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Licensing Credentials</Text>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>License Number:</Text>
                        <Text style={styles.metaValueHighlight}>{license.license_number || 'N/A'}</Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Licensing Board:</Text>
                        <Text style={styles.metaValue}>{license.board || 'N/A'}</Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Graduation Year:</Text>
                        <Text style={styles.metaValue}>{license.grad_year || 'N/A'}</Text>
                      </View>
                    </View>

                    {/* Documents */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Verification Documents</Text>
                      <View style={{ gap: 6 }}>
                        {license.uploaded_file ? (
                          <View style={styles.documentBox}>
                            <Text style={styles.docIcon}>📄</Text>
                            <Text style={styles.docName}>License: {license.uploaded_file}</Text>
                          </View>
                        ) : null}
                        {license.mdcn_certificate ? (
                          <View style={styles.documentBox}>
                            <Text style={styles.docIcon}>📜</Text>
                            <Text style={styles.docName}>MDCN Cert: {license.mdcn_certificate}</Text>
                          </View>
                        ) : null}
                        {license.id_document ? (
                          <View style={styles.documentBox}>
                            <Text style={styles.docIcon}>🪪</Text>
                            <Text style={styles.docName}>ID Doc: {license.id_document}</Text>
                          </View>
                        ) : null}
                        {license.cv_resume ? (
                          <View style={styles.documentBox}>
                            <Text style={styles.docIcon}>📝</Text>
                            <Text style={styles.docName}>CV/Resume: {license.cv_resume}</Text>
                          </View>
                        ) : null}
                        {license.profile_photo ? (
                          <View style={styles.documentBox}>
                            <Text style={styles.docIcon}>📷</Text>
                            <Text style={styles.docName}>Photo: {license.profile_photo}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Qualifications */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Qualifications</Text>
                      {profile.qualifications && profile.qualifications.length > 0 ? (
                        <View style={{ gap: 6 }}>
                          {profile.qualifications.map((q, idx) => (
                            <View key={idx} style={styles.documentBox}>
                              <Text style={styles.docIcon}>🎓</Text>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.docName}>{q.degree} — {q.institution} ({q.year})</Text>
                                <Text style={styles.subText}>Cert: {q.certificate}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.subText}>No qualifications listed.</Text>
                      )}
                    </View>

                    {/* Work Experience */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Work Experience</Text>
                      {profile.experience && profile.experience.length > 0 ? (
                        <View style={{ gap: 6 }}>
                          {profile.experience.map((e, idx) => (
                            <View key={idx} style={styles.documentBox}>
                              <Text style={styles.docIcon}>💼</Text>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.docName}>{e.position} at {e.hospital}</Text>
                                <Text style={styles.subText}>{e.from} — {e.to}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.subText}>No work experience listed.</Text>
                      )}
                    </View>

                    {/* Specializations */}
                    {specs.length > 0 ? (
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Specializations</Text>
                        <View style={styles.badgeRow}>
                          {specs.map((spec, i) => (
                            <View key={i} style={styles.specBadge}>
                              <Text style={styles.specBadgeText}>
                                {spec.name} ({spec.years} yrs)
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    {/* Consultation & Payout */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Consultation & Payout</Text>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Consultation Fee:</Text>
                        <Text style={styles.metaValueHighlight}>
                          {profile.consultation_fee ? `₦${parseFloat(profile.consultation_fee).toLocaleString()}` : 'N/A'}
                        </Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Live Stream Entry Fee:</Text>
                        <Text style={styles.metaValueHighlight}>
                          {profile.live_stream_fee ? `₦${parseFloat(profile.live_stream_fee).toLocaleString()}` : 'N/A'}
                        </Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Accept Points:</Text>
                        <Text style={styles.metaValue}>{profile.accept_points ? '✅ Yes' : '❌ No'}</Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Bank name:</Text>
                        <Text style={styles.metaValue}>{payout.bank || 'N/A'}</Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Account Number:</Text>
                        <Text style={styles.metaValue}>{payout.account || 'N/A'}</Text>
                      </View>
                    </View>

                    {/* Availability Schedule */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Availability Schedule</Text>
                      {profile.availability_schedule ? (
                        <View style={{ gap: 4 }}>
                          {Object.keys(profile.availability_schedule).map((day) => {
                            const sched = profile.availability_schedule[day];
                            return (
                              <View key={day} style={styles.metaRow}>
                                <Text style={styles.metaLabel}>{day}:</Text>
                                <Text style={sched.enabled ? styles.metaValueHighlight : styles.metaValueDisabled}>
                                  {sched.enabled ? `${sched.fromTime} - ${sched.toTime}` : 'Unavailable'}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <Text style={styles.subText}>No availability schedule listed.</Text>
                      )}
                    </View>

                    {/* Actions */}
                    <View style={styles.actionsRow}>
                      {activeTab !== 'approved' && (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.btnApprove]}
                          onPress={() => handleUpdateStatus(doc, 'approved')}
                        >
                          <Text style={styles.actionBtnText}>Approve Doctor ⚕️</Text>
                        </TouchableOpacity>
                      )}
                      
                      {activeTab !== 'rejected' && (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.btnReject]}
                          onPress={() => handleUpdateStatus(doc, 'rejected')}
                        >
                          <Text style={styles.actionBtnTextReject}>Reject Application ❌</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
  contentContainer: { padding: 24 },
  header: { marginBottom: 24 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 6 },
  headerSubtitle: { fontSize: 13.5, color: '#6B7280', lineHeight: 20, maxWidth: 800 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: '#E2E8F0', marginBottom: 20, flexWrap: 'wrap', gap: 4 },
  tabButton: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent', cursor: 'pointer' },
  tabButtonActive: { borderBottomColor: '#4F46E5' },
  tabButtonText: { fontSize: 13.5, color: '#64748B', fontWeight: '600' },
  tabButtonTextActive: { color: '#4F46E5', fontWeight: '800' },
  loaderContainer: { padding: 60, alignItems: 'center' },
  loaderText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
  errorContainer: { padding: 20, backgroundColor: '#FEF2F2', borderRadius: 10, borderWidth: 1, borderColor: '#FECACA', marginBottom: 16 },
  errorText: { color: '#DC2626', fontWeight: '600', marginBottom: 8 },
  retryBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#DC2626', borderRadius: 6, alignSelf: 'flex-start' },
  retryText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  emptyContainer: { padding: 60, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  listContainer: { width: '100%' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  doctorCard: { width: '100%', maxWidth: 500, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader: { flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 16 },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#C7D2FE' },
  avatarEmoji: { fontSize: 24 },
  cardHeaderMeta: { flex: 1, gap: 2 },
  doctorName: { fontSize: 16, fontWeight: '800', color: '#1F2937' },
  doctorEmail: { fontSize: 12, color: '#4B5563' },
  doctorPhone: { fontSize: 12, color: '#4B5563' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 11.5, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  bioText: { fontSize: 12.5, color: '#4B5563', fontStyle: 'italic', lineHeight: 18, backgroundColor: '#F8FAFC', padding: 8, borderRadius: 6, borderLeftWidth: 3, borderLeftColor: '#CBD5E1' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  metaLabel: { fontSize: 12.5, color: '#6B7280', fontWeight: '500' },
  metaValue: { fontSize: 12.5, color: '#1F2937', fontWeight: '600' },
  metaValueHighlight: { fontSize: 12.5, color: '#4F46E5', fontWeight: '800' },
  metaValueDisabled: { fontSize: 12.5, color: '#94A3B8', fontWeight: '500', fontStyle: 'italic' },
  documentBox: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  docIcon: { fontSize: 18 },
  docName: { fontSize: 12, color: '#374151', fontWeight: '600' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  specBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#C7D2FE' },
  specBadgeText: { fontSize: 11, color: '#4F46E5', fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  actionBtn: { flex: 1, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center', cursor: 'pointer' },
  btnApprove: { backgroundColor: '#10B981' },
  btnReject: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: '#EF4444' },
  actionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  actionBtnTextReject: { color: '#EF4444', fontSize: 13, fontWeight: '700' }
});

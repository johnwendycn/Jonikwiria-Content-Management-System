import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Switch,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Alert,
  Image
} from 'react-native';

// API configuration
const API_BASE_URL = 'http://localhost:5000/api/users';
const STATUS_TYPES_API_URL = 'http://localhost:5000/api/user-status-types';

// Custom dynamic SVG/CSS Icons
const CheckedIcon = ({ color = '#4F46E5', size = 16 }) => (
  <View style={[styles.checkboxInner, { backgroundColor: color, width: size, height: size }]} />
);

const TrashIcon = ({ color = '#EF4444', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size - 4, height: 2, backgroundColor: color, marginBottom: 2 }} />
    <View style={{ width: size - 6, height: size - 6, borderWidth: 1.5, borderColor: color, borderTopWidth: 0, borderBottomLeftRadius: 1, borderBottomRightRadius: 1 }} />
  </View>
);

const EditIcon = ({ color = '#4B5563', size = 16 }) => (
  <View style={{ width: size, height: size, borderWidth: 1.5, borderColor: color, borderRadius: 2, transform: [{ rotate: '45deg' }] }} />
);

const HelpIcon = ({ color = '#6B7280', size = 18 }) => (
  <View style={[styles.infoIcon, { borderColor: color }]}>
    <Text style={{ color, fontSize: size - 6, fontWeight: 'bold', textAlign: 'center' }}>?</Text>
  </View>
);

const RestoreIcon = ({ color = '#10B981', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' }}>
    <Text style={{ color, fontSize: 18, fontWeight: 'bold', lineHeight: 18 }}>↺</Text>
  </View>
);

// Cross-platform selector dropdown
const DropdownSelector = ({ label, options, selectedValue, onSelect, placeholder }) => {
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const selectedOption = options.find(o => o.value === selectedValue);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>{label}</Text>
        <select
          style={styles.webSelect}
          value={selectedValue || ''}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="">{placeholder || 'Select option...'}</option>
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </View>
    );
  }

  return (
    <View style={styles.formGroup}>
      <Text style={styles.formLabel}>{label}</Text>
      <TouchableOpacity 
        style={styles.pickerTrigger} 
        onPress={() => setShowOptionsModal(true)}
      >
        <Text style={[styles.pickerTriggerText, !selectedOption && { color: '#9CA3AF' }]}>
          {selectedOption ? selectedOption.label : (placeholder || 'Select option...')}
        </Text>
        <Text style={styles.pickerChevron}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={showOptionsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowOptionsModal(false)}
        >
          <View style={styles.pickerModalContent}>
            <Text style={styles.pickerModalTitle}>{label}</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity 
                style={styles.pickerModalOption}
                onPress={() => {
                  onSelect('');
                  setShowOptionsModal(false);
                }}
              >
                <Text style={{ color: '#9CA3AF' }}>{placeholder || 'Select option...'}</Text>
              </TouchableOpacity>
              {options.map(o => (
                <TouchableOpacity 
                  key={o.value} 
                  style={[styles.pickerModalOption, selectedValue === o.value && styles.pickerModalOptionSelected]}
                  onPress={() => {
                    onSelect(o.value);
                    setShowOptionsModal(false);
                  }}
                >
                  <Text style={[styles.pickerOptionText, selectedValue === o.value && styles.pickerOptionTextSelected]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default function UsersScreen() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 992;

  // Data States
  const [users, setUsers] = useState([]);
  const [statusTypesList, setStatusTypesList] = useState([]);
  
  // App States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Filtering & Pagination
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [showDeleted, setShowDeleted] = useState(false);

  // Guide Toggle
  const [isGuideVisible, setIsGuideVisible] = useState(true);

  // Checkbox selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Form State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    email: '',
    password_hash: '',
    display_name: '',
    first_name: '',
    last_name: '',
    avatar_url: '',
    status_id: '',
    status_reason: '',
    locked_until: '',
    mfa_enabled: false,
    phone_number: '',
    allowed_ips: '',
    cost_center: '',
    security_clearance: '0',
    pref_language: 'en',
    pref_timezone: 'UTC',
    pref_theme: 'light'
  });

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);

    return () => clearTimeout(handler);
  }, [search]);

  // Load dropdown lists (user status types)
  const loadRelationData = async () => {
    try {
      const stRes = await fetch(`${STATUS_TYPES_API_URL}?limit=100`);
      const stJson = await stRes.json();
      if (stJson.success) {
        setStatusTypesList(stJson.data.statusTypes || []);
      }
    } catch (err) {
      console.error('Failed to load status types dependencies:', err);
    }
  };

  useEffect(() => {
    loadRelationData();
  }, []);

  // Fetch Users list
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `${API_BASE_URL}?page=${page}&limit=${limit}&search=${encodeURIComponent(debouncedSearch)}&sortBy=${sortBy}&sortOrder=${sortOrder}&showDeleted=${showDeleted}`;
      const response = await fetch(url);
      const json = await response.json();
      
      if (json.success) {
        setUsers(json.data.users);
        setTotalPages(json.data.totalPages || 1);
        setTotalItems(json.data.totalItems || 0);
      } else {
        setError(json.message || 'Failed to fetch users.');
      }
    } catch (err) {
      setError('Could not connect to the backend server. Please verify the Express API is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, sortBy, sortOrder, showDeleted]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset checkboxes on list updates
  useEffect(() => {
    setSelectedIds(new Set());
  }, [users]);

  // Selections
  const toggleSelectAll = () => {
    const allOnPage = users.map(item => item.id);
    const hasAllSelected = allOnPage.every(id => selectedIds.has(id));
    
    const newSelected = new Set(selectedIds);
    if (hasAllSelected) {
      allOnPage.forEach(id => newSelected.delete(id));
    } else {
      allOnPage.forEach(id => newSelected.add(id));
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectRow = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Submit Save
  const handleSave = async () => {
    if (!formData.email.trim()) {
      showAlert('Validation Error', 'Please enter a valid email address.');
      return;
    }
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(formData.email.trim())) {
      showAlert('Validation Error', 'Please enter a valid email address.');
      return;
    }
    if (!isEditMode && !formData.password_hash.trim()) {
      showAlert('Validation Error', 'Password hash cannot be empty.');
      return;
    }
    if (!formData.status_id) {
      showAlert('Validation Error', 'Please select a User Status Type.');
      return;
    }

    // Process IP filters (comma separated to JSON array)
    let parsedAllowedIps = null;
    if (formData.allowed_ips && formData.allowed_ips.trim()) {
      parsedAllowedIps = formData.allowed_ips.split(',').map(ip => ip.trim()).filter(ip => ip !== '');
    }

    // Process Preferences
    const preferencesObject = {
      language: formData.pref_language,
      timezone: formData.pref_timezone,
      theme: formData.pref_theme
    };

    const payload = {
      email: formData.email.trim(),
      display_name: formData.display_name.trim() || null,
      first_name: formData.first_name.trim() || null,
      last_name: formData.last_name.trim() || null,
      avatar_url: formData.avatar_url.trim() || null,
      status_id: formData.status_id,
      status_reason: formData.status_reason.trim() || null,
      locked_until: formData.locked_until ? new Date(formData.locked_until).toISOString() : null,
      mfa_enabled: formData.mfa_enabled,
      phone_number: formData.phone_number.trim() || null,
      cost_center: formData.cost_center.trim() || null,
      security_clearance: parseInt(formData.security_clearance) || 0,
      allowed_ips: parsedAllowedIps ? JSON.stringify(parsedAllowedIps) : null,
      preferences: JSON.stringify(preferencesObject)
    };

    // If update, only attach password hash if they type something in it
    if (isEditMode) {
      if (formData.password_hash && formData.password_hash.trim() !== '') {
        payload.password_hash = formData.password_hash;
      }
    } else {
      payload.password_hash = formData.password_hash;
    }

    setLoading(true);
    try {
      const url = isEditMode ? `${API_BASE_URL}/${formData.id}` : API_BASE_URL;
      const method = isEditMode ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await response.json();

      if (json.success) {
        setIsFormModalOpen(false);
        fetchUsers();
        showAlert('Success', isEditMode ? 'User account updated successfully.' : 'User account created successfully.');
      } else {
        showAlert('Error', json.message || 'Operation failed.');
      }
    } catch (err) {
      showAlert('Error', 'Unable to perform request.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Delete single user (soft delete)
  const handleDelete = (item) => {
    confirmAction(
      'Confirm Soft Delete',
      `Are you sure you want to suspend/soft-delete user "${item.email}"? They will be removed from active systems but can be restored.`,
      async () => {
        setLoading(true);
        try {
          const response = await fetch(`${API_BASE_URL}/${item.id}`, { method: 'DELETE' });
          const json = await response.json();
          if (json.success) {
            fetchUsers();
            showAlert('Success', 'User soft-deleted successfully.');
          } else {
            showAlert('Error', json.message || 'Failed to delete user.');
          }
        } catch (err) {
          showAlert('Error', 'Unable to delete user.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Restore single user
  const handleRestore = (item) => {
    confirmAction(
      'Confirm Restore',
      `Are you sure you want to restore the account for "${item.email}"?`,
      async () => {
        setLoading(true);
        try {
          const response = await fetch(`${API_BASE_URL}/${item.id}/restore`, { method: 'POST' });
          const json = await response.json();
          if (json.success) {
            fetchUsers();
            showAlert('Success', 'User account restored successfully.');
          } else {
            showAlert('Error', json.message || 'Failed to restore user account.');
          }
        } catch (err) {
          showAlert('Error', 'Unable to restore user account.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Bulk delete selected users
  const handleBulkDelete = () => {
    confirmAction(
      'Confirm Bulk Soft-Delete',
      `Are you sure you want to soft-delete the ${selectedIds.size} selected users?`,
      async () => {
        setLoading(true);
        try {
          const response = await fetch(`${API_BASE_URL}/bulk-delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedIds) })
          });
          const json = await response.json();
          if (json.success) {
            setSelectedIds(new Set());
            fetchUsers();
            showAlert('Success', json.message);
          } else {
            showAlert('Error', json.message || 'Failed to execute bulk deletion.');
          }
        } catch (err) {
          showAlert('Error', 'Unable to perform bulk deletion.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Modal open helpers
  const openCreateModal = () => {
    setIsEditMode(false);
    setFormData({
      id: null,
      email: '',
      password_hash: '',
      display_name: '',
      first_name: '',
      last_name: '',
      avatar_url: '',
      status_id: statusTypesList.find(s => s.slug === 'active')?.id || '',
      status_reason: '',
      locked_until: '',
      mfa_enabled: false,
      phone_number: '',
      allowed_ips: '',
      cost_center: '',
      security_clearance: '0',
      pref_language: 'en',
      pref_timezone: 'UTC',
      pref_theme: 'light'
    });
    setIsFormModalOpen(true);
  };

  const openEditModal = (item) => {
    // Process IP list back to comma separated
    let ipsString = '';
    if (item.allowed_ips) {
      try {
        const parsed = typeof item.allowed_ips === 'string' ? JSON.parse(item.allowed_ips) : item.allowed_ips;
        if (Array.isArray(parsed)) {
          ipsString = parsed.join(', ');
        }
      } catch (e) {
        ipsString = '';
      }
    }

    // Process preferences
    let prefLang = 'en';
    let prefTz = 'UTC';
    let prefTh = 'light';
    if (item.preferences) {
      try {
        const parsedPref = typeof item.preferences === 'string' ? JSON.parse(item.preferences) : item.preferences;
        if (parsedPref) {
          prefLang = parsedPref.language || 'en';
          prefTz = parsedPref.timezone || 'UTC';
          prefTh = parsedPref.theme || 'light';
        }
      } catch (e) {}
    }

    // Lock date format split
    let lockDateStr = '';
    if (item.locked_until) {
      const d = new Date(item.locked_until);
      if (!isNaN(d.getTime())) {
        lockDateStr = d.toISOString().split('T')[0];
      }
    }

    setIsEditMode(true);
    setFormData({
      id: item.id,
      email: item.email,
      password_hash: '', // Keep empty on edit form unless they write a new hash
      display_name: item.display_name || '',
      first_name: item.first_name || '',
      last_name: item.last_name || '',
      avatar_url: item.avatar_url || '',
      status_id: item.status_id || '',
      status_reason: item.status_reason || '',
      locked_until: lockDateStr,
      mfa_enabled: !!item.mfa_enabled,
      phone_number: item.phone_number || '',
      allowed_ips: ipsString,
      cost_center: item.cost_center || '',
      security_clearance: String(item.security_clearance || 0),
      pref_language: prefLang,
      pref_timezone: prefTz,
      pref_theme: prefTh
    });
    setIsFormModalOpen(true);
  };

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const confirmAction = (title, message, onConfirm) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
    } else {
      Alert.alert(
        title,
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm', style: 'destructive', onPress: onConfirm }
        ]
      );
    }
  };

  // Convert relations into dropdown items
  const statusOptions = statusTypesList.map(st => ({ label: st.name, value: st.id }));
  
  // Format Date String helper
  const formatDate = (dateVal) => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      
      {/* Page Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>User Account Configuration</Text>
          <Text style={styles.headerSubtitle}>
            Administer system user profiles, enforce security clearance tiers, set IP accessibility constraints, and toggle soft-deleted states.
          </Text>
        </View>
        
        {/* Toggle Guide */}
        <TouchableOpacity 
          style={[styles.guideToggleBtn, isGuideVisible && styles.guideToggleBtnActive]} 
          onPress={() => setIsGuideVisible(!isGuideVisible)}
        >
          <HelpIcon color={isGuideVisible ? '#4F46E5' : '#4B5563'} />
          <Text style={[styles.guideToggleBtnText, isGuideVisible && styles.guideToggleBtnTextActive]}>
            {isGuideVisible ? 'Hide Help Guide' : 'Explain Users (Help)'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Guide Banner */}
      {isGuideVisible && (
        <View style={styles.guideCard}>
          <Text style={styles.guideCardTitle}>💡 Layman's Admin User Guide</Text>
          <Text style={styles.guideCardText}>
            This control center regulates accounts. Review key operational settings:
          </Text>
          
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#4F46E5' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>🔒 Security Clearance:</Text> Numeric hierarchy governing access. Users can only perform actions matching or below their clearance level (e.g. 0 to 100).
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>🌍 Allowed IP Address Filters:</Text> Enforce secure location boundaries. Restrict user logins to comma-separated IP strings. Leave empty to allow any connection.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>⚙️ User Preferences:</Text> Customize timezone, language, and theme selections. Saved as a flexible JSON configuration object.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>↺ Soft Deletion & Restoration:</Text> "Paranoid Deletes" mean accounts are deactivated rather than purged. Enable the "Show Deleted Accounts" toggle to inspect and restore profiles instantly.
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Control Actions Bar */}
      <View style={styles.controlBar}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search users by name, email, department, or status type..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#9CA3AF"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.clearSearchBtn}>
              <Text style={styles.clearSearchText}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Soft Deleted Toggle & Action Buttons */}
        <View style={styles.actionButtonsRow}>
          {/* Show Deleted Toggle */}
          <View style={styles.deletedToggleWrapper}>
            <Text style={styles.deletedToggleLabel}>Show Deleted</Text>
            <Switch
              value={showDeleted}
              onValueChange={(val) => {
                setShowDeleted(val);
                setPage(1);
              }}
              trackColor={{ false: '#D1D5DB', true: '#FCA5A5' }}
              thumbColor={showDeleted ? '#EF4444' : '#F3F4F6'}
            />
          </View>

          {selectedIds.size > 0 && (
            <TouchableOpacity 
              style={[styles.btn, styles.btnDanger, { marginRight: 8 }]} 
              onPress={handleBulkDelete}
            >
              <TrashIcon color="#FFFFFF" size={14} />
              <Text style={styles.btnText}>Soft-Delete ({selectedIds.size})</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={openCreateModal}>
            <Text style={[styles.btnText, { fontWeight: '600' }]}>+ Create User</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Loader */}
      {loading && users.length === 0 && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loaderText}>Loading system user accounts...</Text>
        </View>
      )}

      {/* Errors */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchUsers}>
            <Text style={styles.retryText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Table Grid */}
      {!loading && !error && users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No user accounts found matching this criteria.</Text>
        </View>
      ) : (
        <>
          {isLargeScreen ? (
            /* ================= DESKTOP TABLE VIEW ================= */
            <View style={styles.tableCard}>
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View style={styles.tableWrapper}>
                  {/* Table Header */}
                  <View style={styles.tableRowHeader}>
                    <TouchableOpacity onPress={toggleSelectAll} style={styles.checkboxCol}>
                      <View style={[styles.checkbox, users.length > 0 && users.every(item => selectedIds.has(item.id)) && styles.checkboxChecked]}>
                        {users.length > 0 && users.every(item => selectedIds.has(item.id)) && <CheckedIcon />}
                      </View>
                    </TouchableOpacity>
                    
                    <Text style={[styles.thCol, { width: 220 }]}>Display Name & Email</Text>
                    <Text style={[styles.thCol, { width: 130 }]}>Status State</Text>
                    <Text style={[styles.thCol, { width: 90, textAlign: 'center' }]}>Clearance</Text>
                    <Text style={[styles.thCol, { width: 120 }]}>Department</Text>
                    <Text style={[styles.thCol, { width: 80, textAlign: 'center' }]}>MFA</Text>
                    <Text style={[styles.thCol, { width: 170 }]}>Last Login</Text>
                    <Text style={[styles.thCol, { width: 110, textAlign: 'center' }]}>Actions</Text>
                  </View>

                  {/* Table Body */}
                  {users.map((item) => {
                    const isSoftDeleted = !!item.deleted_at;
                    return (
                      <View key={item.id} style={[styles.tableRowBody, selectedIds.has(item.id) && styles.tableRowSelected, isSoftDeleted && styles.tableRowDeleted]}>
                        
                        <TouchableOpacity onPress={() => toggleSelectRow(item.id)} style={styles.checkboxCol}>
                          <View style={[styles.checkbox, selectedIds.has(item.id) && styles.checkboxChecked]}>
                            {selectedIds.has(item.id) && <CheckedIcon />}
                          </View>
                        </TouchableOpacity>

                        {/* Avatar, Name & Email */}
                        <View style={[styles.tdCol, { width: 220, flexDirection: 'row', alignItems: 'center' }]}>
                          <View style={styles.avatarContainer}>
                            {item.avatar_url ? (
                              <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
                            ) : (
                              <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarPlaceholderText}>
                                  {item.display_name ? item.display_name.charAt(0).toUpperCase() : item.email.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            )}
                          </View>
                          <View style={{ marginLeft: 10, flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                              <Text style={styles.statusNameText} numberOfLines={1}>
                                {item.display_name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'No Name'}
                              </Text>
                              {isSoftDeleted && (
                                <View style={styles.deletedBadge}>
                                  <Text style={styles.deletedBadgeText}>Deleted</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.slugText} numberOfLines={1}>{item.email}</Text>
                          </View>
                        </View>

                        {/* Status Type badge */}
                        <View style={[styles.tdCol, { width: 130 }]}>
                          {item.statusType ? (
                            <View style={styles.badgeRow}>
                              <View style={[styles.badgeColorDot, { backgroundColor: item.statusType.color_class || '#E5E7EB' }]} />
                              <Text style={styles.relationText} numberOfLines={1}>{item.statusType.name}</Text>
                            </View>
                          ) : (
                            <Text style={styles.missingRelationText}>Missing status</Text>
                          )}
                        </View>

                        {/* Clearance */}
                        <View style={[styles.tdCol, { width: 90, alignItems: 'center' }]}>
                          <View style={styles.clearanceTag}>
                            <Text style={styles.clearanceTagText}>{item.security_clearance}</Text>
                          </View>
                        </View>

                        {/* Department & Cost Center */}
                        <View style={[styles.tdCol, { width: 120 }]}>
                          <Text style={{ fontSize: 13, color: '#374151', fontWeight: '500' }} numberOfLines={1}>
                            {item.cost_center || 'General'}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                            {item.department_id ? 'Dept Registered' : 'Corporate'}
                          </Text>
                        </View>

                        {/* MFA status */}
                        <View style={[styles.tdCol, { width: 80, alignItems: 'center' }]}>
                          <View style={[styles.mfaStateTag, item.mfa_enabled ? styles.mfaStateActive : styles.mfaStateDisabled]}>
                            <Text style={item.mfa_enabled ? styles.mfaStateActiveText : styles.mfaStateDisabledText}>
                              {item.mfa_enabled ? 'ON' : 'OFF'}
                            </Text>
                          </View>
                        </View>

                        {/* Last Login Info */}
                        <View style={[styles.tdCol, { width: 170 }]}>
                          <Text style={{ fontSize: 12, color: '#374151' }} numberOfLines={1}>
                            {formatDate(item.last_login_at)}
                          </Text>
                          {item.last_login_ip && (
                            <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>
                              IP: {item.last_login_ip}
                            </Text>
                          )}
                        </View>

                        {/* Actions (Standard Edit/Delete OR Restore if Deleted) */}
                        <View style={[styles.tdCol, { width: 110, flexDirection: 'row', justifyContent: 'center' }]}>
                          {isSoftDeleted ? (
                            <TouchableOpacity style={styles.restoreBtn} onPress={() => handleRestore(item)}>
                              <RestoreIcon color="#10B981" />
                              <Text style={styles.restoreBtnText}>Restore</Text>
                            </TouchableOpacity>
                          ) : (
                            <>
                              <TouchableOpacity style={[styles.actionBtn, { marginRight: 10 }]} onPress={() => openEditModal(item)}>
                                <EditIcon color="#4F46E5" />
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)}>
                                <TrashIcon color="#EF4444" />
                              </TouchableOpacity>
                            </>
                          )}
                        </View>

                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          ) : (
            /* ================= MOBILE CARD LIST VIEW ================= */
            <View style={styles.mobileListContainer}>
              {users.map((item) => {
                const isSoftDeleted = !!item.deleted_at;
                return (
                  <View key={item.id} style={[styles.mobileCard, selectedIds.has(item.id) && styles.tableRowSelected, isSoftDeleted && styles.tableRowDeleted]}>
                    
                    <View style={styles.cardHeader}>
                      <TouchableOpacity onPress={() => toggleSelectRow(item.id)} style={styles.mobileCheckboxContainer}>
                        <View style={[styles.checkbox, selectedIds.has(item.id) && styles.checkboxChecked]}>
                          {selectedIds.has(item.id) && <CheckedIcon />}
                        </View>
                        <Text style={[styles.statusNameText, { marginLeft: 8 }]} numberOfLines={1}>
                          {item.display_name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'No Name'}
                        </Text>
                        {isSoftDeleted && (
                          <View style={[styles.deletedBadge, { marginLeft: 6 }]}>
                            <Text style={styles.deletedBadgeText}>Deleted</Text>
                          </View>
                        )}
                      </TouchableOpacity>

                      <View style={styles.mobileActionsContainer}>
                        {isSoftDeleted ? (
                          <TouchableOpacity style={styles.restoreBtn} onPress={() => handleRestore(item)}>
                            <RestoreIcon color="#10B981" size={14} />
                            <Text style={styles.restoreBtnText}>Restore</Text>
                          </TouchableOpacity>
                        ) : (
                          <>
                            <TouchableOpacity style={[styles.actionBtn, { marginRight: 14 }]} onPress={() => openEditModal(item)}>
                              <EditIcon color="#4F46E5" size={18} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)}>
                              <TrashIcon color="#EF4444" size={18} />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>

                    <Text style={styles.mobileDescText}>{item.email}</Text>
                    
                    <View style={styles.mobileRelationRow}>
                      <Text style={styles.relationLabel}>Status: </Text>
                      <Text style={styles.relationValue}>{item.statusType ? item.statusType.name : 'Missing'}</Text>
                    </View>
                    
                    <View style={styles.mobileRelationRow}>
                      <Text style={styles.relationLabel}>Clearance: </Text>
                      <Text style={styles.relationValue}>{item.security_clearance}</Text>
                    </View>

                    <View style={styles.mobileRelationRow}>
                      <Text style={styles.relationLabel}>Cost Center: </Text>
                      <Text style={styles.relationValue}>{item.cost_center || 'General'}</Text>
                    </View>

                    <View style={styles.badgeWrapContainer}>
                      <View style={[styles.mfaStateTag, item.mfa_enabled ? styles.mfaStateActive : styles.mfaStateDisabled, { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }]}>
                        <Text style={item.mfa_enabled ? styles.mfaStateActiveText : styles.mfaStateDisabledText}>
                          MFA {item.mfa_enabled ? 'ON' : 'OFF'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ================= PAGINATION CONTROLS ================= */}
          <View style={styles.paginationContainer}>
            <Text style={styles.paginationText}>
              Showing <Text style={{ fontWeight: '600' }}>{users.length}</Text> of{' '}
              <Text style={{ fontWeight: '600' }}>{totalItems}</Text> items
            </Text>

            <View style={styles.paginationNav}>
              <TouchableOpacity 
                style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]} 
                onPress={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <Text style={[styles.pageBtnText, page === 1 && styles.pageBtnTextDisabled]}>Previous</Text>
              </TouchableOpacity>
              
              <View style={styles.pageIndicator}>
                <Text style={styles.pageIndicatorText}>Page {page} of {totalPages}</Text>
              </View>

              <TouchableOpacity 
                style={[styles.pageBtn, page === totalPages && styles.pageBtnDisabled]} 
                onPress={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <Text style={[styles.pageBtnText, page === totalPages && styles.pageBtnTextDisabled]}>Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* ================= CREATE/EDIT MODAL FORM ================= */}
      <Modal
        visible={isFormModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsFormModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditMode ? 'Edit System User Profile' : 'Register New User Account'}
              </Text>
              <TouchableOpacity onPress={() => setIsFormModalOpen(false)}>
                <Text style={styles.closeModalText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalFormScroll}>
              
              {/* Email (Validated unique) */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Email Address *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="name@organization.com"
                  value={formData.email}
                  onChangeText={(txt) => setFormData({ ...formData, email: txt })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Password hash */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {isEditMode ? 'Change Password Hash (optional)' : 'Password Hash *'}
                </Text>
                <TextInput
                  style={styles.formInput}
                  placeholder={isEditMode ? 'Leave blank to keep current password' : 'e.g. bcrypt or pbkdf2 hash'}
                  value={formData.password_hash}
                  onChangeText={(txt) => setFormData({ ...formData, password_hash: txt })}
                  autoCapitalize="none"
                />
              </View>

              {/* Display Name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Display Name</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. John Doe"
                  value={formData.display_name}
                  onChangeText={(txt) => setFormData({ ...formData, display_name: txt })}
                />
              </View>

              {/* First Name & Last Name (Row layout) */}
              <View style={styles.rowLayout}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.formLabel}>First Name</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. John"
                    value={formData.first_name}
                    onChangeText={(txt) => setFormData({ ...formData, first_name: txt })}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.formLabel}>Last Name</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Doe"
                    value={formData.last_name}
                    onChangeText={(txt) => setFormData({ ...formData, last_name: txt })}
                  />
                </View>
              </View>

              {/* Avatar URL & Phone Number */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Avatar Image URL</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="https://example.com/avatar.png"
                  value={formData.avatar_url}
                  onChangeText={(txt) => setFormData({ ...formData, avatar_url: txt })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Phone Number</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. +1 555-0199"
                  value={formData.phone_number}
                  onChangeText={(txt) => setFormData({ ...formData, phone_number: txt })}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Status Picker Selector */}
              <DropdownSelector
                label="User Lifecycle Status *"
                options={statusOptions}
                selectedValue={formData.status_id}
                onSelect={(val) => setFormData({ ...formData, status_id: val })}
                placeholder="Choose user status type..."
              />

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Status Change Reason (optional)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Explain status change (e.g. security suspension)"
                  value={formData.status_reason}
                  onChangeText={(txt) => setFormData({ ...formData, status_reason: txt })}
                />
              </View>

              {/* Lock bounds */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Locked Until Date (optional)</Text>
                <TextInput
                  style={Platform.OS === 'web' ? styles.webDateInput : styles.formInput}
                  type={Platform.OS === 'web' ? 'date' : 'default'}
                  placeholder="YYYY-MM-DD"
                  value={formData.locked_until}
                  onChangeText={(txt) => setFormData({ ...formData, locked_until: txt })}
                />
              </View>

              {/* Access Settings: Department & Security Clearance & IPs */}
              <Text style={styles.sectionHeader}>Access Clearance & Boundaries</Text>

              <View style={styles.rowLayout}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.formLabel}>Cost Center / ID</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. SALES-CORP"
                    value={formData.cost_center}
                    onChangeText={(txt) => setFormData({ ...formData, cost_center: txt })}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.formLabel}>Security Clearance Rank</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0"
                    keyboardType="numeric"
                    value={formData.security_clearance}
                    onChangeText={(txt) => setFormData({ ...formData, security_clearance: txt })}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Allowed IP Address Filters (Comma Separated)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 192.168.1.50, 10.0.0.12"
                  value={formData.allowed_ips}
                  onChangeText={(txt) => setFormData({ ...formData, allowed_ips: txt })}
                />
              </View>

              {/* MFA Toggle */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Enforce Multi-Factor Auth (MFA)</Text>
                  <Text style={styles.toggleDesc}>Require code check during verification processes?</Text>
                </View>
                <Switch
                  value={formData.mfa_enabled}
                  onValueChange={(val) => setFormData({ ...formData, mfa_enabled: val })}
                  trackColor={{ false: '#D1D5DB', true: '#C7D2FE' }}
                  thumbColor={formData.mfa_enabled ? '#4F46E5' : '#F3F4F6'}
                />
              </View>

              {/* JSON Preferences (Dropdowns serializing into object) */}
              <Text style={styles.sectionHeader}>Preferences (Saved as JSON)</Text>
              
              <DropdownSelector
                label="Language Code"
                options={[
                  { label: 'English (en)', value: 'en' },
                  { label: 'Spanish (es)', value: 'es' },
                  { label: 'French (fr)', value: 'fr' }
                ]}
                selectedValue={formData.pref_language}
                onSelect={(val) => setFormData({ ...formData, pref_language: val })}
              />

              <DropdownSelector
                label="Timezone Offset"
                options={[
                  { label: 'Coordinated Universal Time (UTC)', value: 'UTC' },
                  { label: 'Eastern Standard Time (EST)', value: 'EST' },
                  { label: 'Greenwich Mean Time (GMT)', value: 'GMT' }
                ]}
                selectedValue={formData.pref_timezone}
                onSelect={(val) => setFormData({ ...formData, pref_timezone: val })}
              />

              <DropdownSelector
                label="Visual Layout Theme"
                options={[
                  { label: 'Standard Light Mode', value: 'light' },
                  { label: 'Modern Dark Mode', value: 'dark' }
                ]}
                selectedValue={formData.pref_theme}
                onSelect={(val) => setFormData({ ...formData, pref_theme: val })}
              />

            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.btn, styles.btnCancel, { marginRight: 8 }]} 
                onPress={() => setIsFormModalOpen(false)}
              >
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.btn, styles.btnPrimary]} 
                onPress={handleSave}
              >
                <Text style={styles.btnText}>Save Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F9' // AdminLTE light gray bg
  },
  contentContainer: {
    padding: 20
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#212529' // AdminLTE dark font
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6C757D',
    marginTop: 4
  },
  guideToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CED4DA',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    gap: 6
  },
  guideToggleBtnActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE'
  },
  guideToggleBtnText: {
    fontSize: 12.5,
    color: '#495057',
    fontWeight: '500'
  },
  guideToggleBtnTextActive: {
    color: '#4F46E5'
  },
  infoIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center'
  },
  guideCard: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#4F46E5', // Slate Indigo
    borderRadius: 6,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  guideCardTitle: {
    fontSize: 14.5,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8
  },
  guideCardText: {
    fontSize: 13,
    color: '#495057',
    lineHeight: 18
  },
  bulletList: {
    marginTop: 10,
    gap: 8
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: 8
  },
  bulletText: {
    fontSize: 12.5,
    color: '#495057',
    flex: 1,
    lineHeight: 17
  },
  controlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12
  },
  searchContainer: {
    flex: 1,
    minWidth: 260,
    position: 'relative'
  },
  searchInput: {
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CED4DA',
    borderRadius: 4,
    paddingLeft: 12,
    paddingRight: 32,
    fontSize: 13,
    color: '#495057',
    outlineStyle: 'none'
  },
  clearSearchBtn: {
    position: 'absolute',
    right: 10,
    top: 8,
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center'
  },
  clearSearchText: {
    fontSize: 18,
    color: '#6C757D',
    fontWeight: 'bold'
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8
  },
  deletedToggleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    gap: 8
  },
  deletedToggleLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#495057'
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 4,
    justifyContent: 'center',
    gap: 6
  },
  btnPrimary: {
    backgroundColor: '#007BFF' // AdminLTE primary blue
  },
  btnDanger: {
    backgroundColor: '#DC3545' // AdminLTE primary red
  },
  btnCancel: {
    backgroundColor: '#6C757D'
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500'
  },
  btnCancelText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500'
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    overflow: 'hidden'
  },
  tableWrapper: {
    minWidth: 940
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 2,
    borderBottomColor: '#DEE2E6',
    paddingVertical: 10,
    alignItems: 'center'
  },
  tableRowBody: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#DEE2E6',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  tableRowSelected: {
    backgroundColor: '#F1F5F9'
  },
  tableRowDeleted: {
    backgroundColor: '#FFF5F5' // Soft red tint for deleted users
  },
  thCol: {
    fontSize: 12.5,
    fontWeight: 'bold',
    color: '#495057',
    paddingHorizontal: 12
  },
  tdCol: {
    paddingHorizontal: 12,
    justifyContent: 'center'
  },
  checkboxCol: {
    width: 46,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: '#CED4DA',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  checkboxChecked: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF'
  },
  checkboxInner: {
    borderRadius: 1
  },
  avatarContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    backgroundColor: '#E9ECEF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarImage: {
    width: '100%',
    height: '100%'
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007BFF'
  },
  avatarPlaceholderText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14
  },
  statusNameText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#212529'
  },
  slugText: {
    fontSize: 11.5,
    color: '#6C757D',
    marginTop: 2
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  badgeColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6
  },
  relationText: {
    fontSize: 12.5,
    color: '#212529',
    fontWeight: '500'
  },
  missingRelationText: {
    fontSize: 12,
    color: '#6C757D',
    fontStyle: 'italic'
  },
  clearanceTag: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  clearanceTagText: {
    color: '#2E7D32',
    fontSize: 11,
    fontWeight: 'bold'
  },
  mfaStateTag: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1
  },
  mfaStateActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD'
  },
  mfaStateActiveText: {
    color: '#0369A1',
    fontSize: 10,
    fontWeight: 'bold'
  },
  mfaStateDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB'
  },
  mfaStateDisabledText: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: 'bold'
  },
  deletedBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6
  },
  deletedBadgeText: {
    color: '#EF4444',
    fontSize: 9.5,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CED4DA',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4
  },
  restoreBtnText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: 'bold'
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    flexWrap: 'wrap',
    gap: 12
  },
  paginationText: {
    fontSize: 13,
    color: '#6C757D'
  },
  paginationNav: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  pageBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CED4DA',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4
  },
  pageBtnDisabled: {
    backgroundColor: '#E9ECEF',
    borderColor: '#DEE2E6'
  },
  pageBtnText: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '500'
  },
  pageBtnTextDisabled: {
    color: '#ADB5BD'
  },
  pageIndicator: {
    paddingHorizontal: 12
  },
  pageIndicatorText: {
    fontSize: 13,
    color: '#495057',
    fontWeight: '500'
  },
  mobileListContainer: {
    gap: 12
  },
  mobileCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 4,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  mobileCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  mobileActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  mobileDescText: {
    fontSize: 13,
    color: '#495057',
    lineHeight: 18,
    marginBottom: 10
  },
  mobileRelationRow: {
    flexDirection: 'row',
    marginBottom: 4
  },
  relationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C757D'
  },
  relationValue: {
    fontSize: 12,
    color: '#212529',
    fontWeight: '500'
  },
  badgeWrapContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    width: '100%',
    maxWidth: 580,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#DEE2E6',
    backgroundColor: '#F8F9FA'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212529'
  },
  closeModalText: {
    fontSize: 22,
    color: '#6C757D',
    fontWeight: 'bold',
    lineHeight: 22
  },
  modalFormScroll: {
    padding: 16,
    flex: 1
  },
  formGroup: {
    marginBottom: 14
  },
  formLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 4
  },
  formInput: {
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CED4DA',
    borderRadius: 4,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#495057',
    outlineStyle: 'none'
  },
  webSelect: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CED4DA',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#495057',
    outlineStyle: 'none',
    width: '100%',
    height: 38,
    marginTop: 4,
  },
  webDateInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CED4DA',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#495057',
    outlineStyle: 'none',
    width: '100%',
    height: 38,
    marginTop: 4,
  },
  pickerTrigger: {
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CED4DA',
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginTop: 4
  },
  pickerTriggerText: {
    fontSize: 13,
    color: '#495057'
  },
  pickerChevron: {
    fontSize: 10,
    color: '#6C757D'
  },
  pickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 16,
    width: '90%',
    maxWidth: 360,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5
  },
  pickerModalTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 12,
    textAlign: 'center'
  },
  pickerModalOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA'
  },
  pickerModalOptionSelected: {
    backgroundColor: '#E8F0FE'
  },
  pickerOptionText: {
    fontSize: 13,
    color: '#495057'
  },
  pickerOptionTextSelected: {
    color: '#007BFF',
    fontWeight: '600'
  },
  sectionHeader: {
    fontSize: 12.5,
    fontWeight: 'bold',
    color: '#6C757D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#DEE2E6',
    paddingBottom: 4
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA'
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 16
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#495057'
  },
  toggleDesc: {
    fontSize: 11,
    color: '#6C757D',
    marginTop: 2
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#DEE2E6',
    backgroundColor: '#F8F9FA'
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 4,
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyText: {
    color: '#6C757D',
    fontSize: 13.5
  },
  loaderContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loaderText: {
    marginTop: 12,
    color: '#495057',
    fontSize: 13.5
  },
  errorContainer: {
    backgroundColor: '#F8D7DA',
    borderColor: '#F5C6CB',
    borderWidth: 1,
    borderRadius: 4,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center'
  },
  errorText: {
    color: '#721C24',
    fontSize: 13.5,
    textAlign: 'center',
    fontWeight: '500'
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: '#721C24',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  }
});

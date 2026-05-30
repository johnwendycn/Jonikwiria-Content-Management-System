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
  Alert
} from 'react-native';

// API Configuration
const API_BASE_URL = 'http://localhost:5000/api/user-roles';
const USERS_API_URL = 'http://localhost:5000/api/users';
const ROLES_API_URL = 'http://localhost:5000/api/roles';

// Custom dynamic Icons
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

// Dropdown Selector (Supports Web native select and Mobile custom modals)
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

export default function UserRolesScreen() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 992;

  // Data States
  const [userRoles, setUserRoles] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [rolesList, setRolesList] = useState([]);
  
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

  // Help guide toggle
  const [isGuideVisible, setIsGuideVisible] = useState(true);

  // Checkbox multi-selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Form State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    user_id: '',
    role_id: '',
    valid_from: '',
    valid_until: '',
    is_active: true,
    assigned_by: '',
    reason: '',
    metadata: ''
  });

  // Date String Formatting helper
  const formatDateString = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  };

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);

    return () => clearTimeout(handler);
  }, [search]);

  // Load relation dropdown data
  const loadRelationData = async () => {
    try {
      // Fetch users
      const uRes = await fetch(`${USERS_API_URL}?limit=200`);
      const uJson = await uRes.json();
      if (uJson.success) {
        setUsersList(uJson.data.users || []);
      }

      // Fetch roles
      const rRes = await fetch(`${ROLES_API_URL}?limit=200`);
      const rJson = await rRes.json();
      if (rJson.success) {
        setRolesList(rJson.data.roles || []);
      }
    } catch (err) {
      console.error('Failed to load user-role dependencies:', err);
    }
  };

  useEffect(() => {
    loadRelationData();
  }, []);

  // Fetch Assignments List
  const fetchUserRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `${API_BASE_URL}?page=${page}&limit=${limit}&search=${encodeURIComponent(debouncedSearch)}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      const response = await fetch(url);
      const json = await response.json();
      
      if (json.success) {
        setUserRoles(json.data.userRoles);
        setTotalPages(json.data.totalPages || 1);
        setTotalItems(json.data.totalItems || 0);
      } else {
        setError(json.message || 'Failed to fetch user roles.');
      }
    } catch (err) {
      setError('Could not connect to the backend server. Please verify the Express API is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    fetchUserRoles();
  }, [fetchUserRoles]);

  // Reset checkboxes on list updates
  useEffect(() => {
    setSelectedIds(new Set());
  }, [userRoles]);

  // Bulk Selections
  const toggleSelectAll = () => {
    const allOnPage = userRoles.map(item => item.id);
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

  // Submit Save action
  const handleSave = async () => {
    if (!formData.user_id) {
      showAlert('Validation Error', 'Please select a User account.');
      return;
    }
    if (!formData.role_id) {
      showAlert('Validation Error', 'Please select a Role configuration.');
      return;
    }

    // JSON validation
    let parsedMetadata = null;
    if (formData.metadata && formData.metadata.trim()) {
      try {
        parsedMetadata = JSON.parse(formData.metadata);
      } catch (e) {
        showAlert('Validation Error', 'Metadata settings must be valid JSON syntax.');
        return;
      }
    }

    const payload = {
      user_id: formData.user_id,
      role_id: formData.role_id,
      valid_from: formData.valid_from ? new Date(formData.valid_from).toISOString() : new Date().toISOString(),
      valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
      is_active: formData.is_active,
      assigned_by: formData.assigned_by || null,
      reason: formData.reason.trim() || null,
      metadata: parsedMetadata
    };

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
        fetchUserRoles();
        showAlert('Success', isEditMode ? 'Role assignment updated successfully.' : 'Role assigned successfully.');
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

  // Delete single assignment
  const handleDelete = (item) => {
    confirmAction(
      'Confirm Delete',
      `Are you sure you want to remove role "${item.role ? item.role.name : 'Role'}" from user "${item.user ? item.user.email : 'User'}"?`,
      async () => {
        setLoading(true);
        try {
          const response = await fetch(`${API_BASE_URL}/${item.id}`, { method: 'DELETE' });
          const json = await response.json();
          if (json.success) {
            fetchUserRoles();
            showAlert('Success', 'Role assignment removed successfully.');
          } else {
            showAlert('Error', json.message || 'Failed to delete role assignment.');
          }
        } catch (err) {
          showAlert('Error', 'Unable to delete role assignment.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Bulk Delete assignments
  const handleBulkDelete = () => {
    confirmAction(
      'Confirm Bulk Delete',
      `Are you sure you want to delete the ${selectedIds.size} selected role assignments?`,
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
            fetchUserRoles();
            showAlert('Success', json.message);
          } else {
            showAlert('Error', json.message || 'Failed to delete selected assignments.');
          }
        } catch (err) {
          showAlert('Error', 'Unable to perform bulk deletion.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Form Modals Helpers
  const openCreateModal = () => {
    // Attempt to default assigned_by to the root administrator if seeded
    const rootAdmin = usersList.find(u => u.email === 'root-administrator@system.local');
    setIsEditMode(false);
    setFormData({
      id: null,
      user_id: '',
      role_id: '',
      valid_from: formatDateString(new Date()),
      valid_until: '',
      is_active: true,
      assigned_by: rootAdmin?.id || '',
      reason: '',
      metadata: ''
    });
    setIsFormModalOpen(true);
  };

  const openEditModal = (item) => {
    setIsEditMode(true);
    setFormData({
      id: item.id,
      user_id: item.user_id,
      role_id: item.role_id,
      valid_from: formatDateString(item.valid_from),
      valid_until: formatDateString(item.valid_until),
      is_active: !!item.is_active,
      assigned_by: item.assigned_by || '',
      reason: item.reason || '',
      metadata: item.metadata ? JSON.stringify(item.metadata, null, 2) : ''
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

  // Validity state calculations
  const getValidityBadge = (item) => {
    if (!item.is_active) {
      return { label: 'Inactive', bg: '#F3F4F6', text: '#6B7280' };
    }
    const now = new Date();
    const from = new Date(item.valid_from);
    const until = item.valid_until ? new Date(item.valid_until) : null;
    
    if (now < from) {
      return { label: 'Scheduled', bg: '#FEF3C7', text: '#D97706' };
    }
    if (until && now > until) {
      return { label: 'Expired', bg: '#FEE2E2', text: '#B91C1C' };
    }
    return { label: 'Active', bg: '#D1FAE5', text: '#065F46' };
  };

  // Convert relations lists into pickers options
  const userOptions = usersList.map(u => ({
    label: `${u.display_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'User'} (${u.email})`,
    value: u.id
  }));

  const roleOptions = rolesList.map(r => ({
    label: `${r.name} (Priority: ${r.priority})`,
    value: r.id
  }));

  const assignerOptions = usersList.map(u => ({
    label: u.display_name || u.email,
    value: u.id
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      
      {/* Page Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>User Roles Assignment</Text>
          <Text style={styles.headerSubtitle}>
            Link user profiles with role permission sets, configure active constraints, schedule expiration dates, and insert metadata configurations.
          </Text>
        </View>
        
        {/* Toggle Guide */}
        <TouchableOpacity 
          style={[styles.guideToggleBtn, isGuideVisible && styles.guideToggleBtnActive]} 
          onPress={() => setIsGuideVisible(!isGuideVisible)}
        >
          <HelpIcon color={isGuideVisible ? '#4F46E5' : '#4B5563'} />
          <Text style={[styles.guideToggleBtnText, isGuideVisible && styles.guideToggleBtnTextActive]}>
            {isGuideVisible ? 'Hide Help Guide' : 'Explain Mappings (Help)'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Help Guide Banner */}
      {isGuideVisible && (
        <View style={styles.guideCard}>
          <Text style={styles.guideCardTitle}>📚 Guide to Role Mappings</Text>
          <Text style={styles.guideCardText}>
            User roles bind security configurations together. Ensure you understand key rules:
          </Text>
          
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#4F46E5' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>⏱️ Temporal Bounds:</Text> Schedule a role to activate and expire at specific dates. Set `valid_until` to expire access automatically.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>⭐ Active Assignment Limit:</Text> A user can only be linked to a specific role once actively without an expiration date. If they have expired or inactive links, those can coexist.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>⚙️ Custom Metadata Context:</Text> Configure parameters inside a JSON input (e.g. {"{\"department_id\": \"99\"}"}) to restrict the role's scope to specific contexts.
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
            placeholder="Search assignments by user email, role name, or reason..."
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

        <View style={styles.actionButtonsRow}>
          {selectedIds.size > 0 && (
            <TouchableOpacity 
              style={[styles.btn, styles.btnDanger, { marginRight: 8 }]} 
              onPress={handleBulkDelete}
            >
              <TrashIcon color="#FFFFFF" size={14} />
              <Text style={styles.btnText}>Remove Mappings ({selectedIds.size})</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={openCreateModal}>
            <Text style={[styles.btnText, { fontWeight: '600' }]}>+ Assign Role</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Loader */}
      {loading && userRoles.length === 0 && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loaderText}>Loading user role mappings...</Text>
        </View>
      )}

      {/* Errors */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchUserRoles}>
            <Text style={styles.retryText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Table Grid */}
      {!loading && !error && userRoles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No user role assignments configured in the database.</Text>
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
                      <View style={[styles.checkbox, userRoles.length > 0 && userRoles.every(item => selectedIds.has(item.id)) && styles.checkboxChecked]}>
                        {userRoles.length > 0 && userRoles.every(item => selectedIds.has(item.id)) && <CheckedIcon />}
                      </View>
                    </TouchableOpacity>
                    
                    <Text style={[styles.thCol, { width: 220 }]}>User profile</Text>
                    <Text style={[styles.thCol, { width: 140 }]}>Assigned Role</Text>
                    <Text style={[styles.thCol, { width: 100, textAlign: 'center' }]}>Priority</Text>
                    <Text style={[styles.thCol, { width: 150 }]}>Validity Bounds</Text>
                    <Text style={[styles.thCol, { width: 90, textAlign: 'center' }]}>State</Text>
                    <Text style={[styles.thCol, { width: 150 }]}>Assigned By</Text>
                    <Text style={[styles.thCol, { width: 140 }]}>Reason / Notes</Text>
                    <Text style={[styles.thCol, { width: 90, textAlign: 'center' }]}>Actions</Text>
                  </View>

                  {/* Table Body */}
                  {userRoles.map((item) => {
                    const badge = getValidityBadge(item);
                    return (
                      <View key={item.id} style={[styles.tableRowBody, selectedIds.has(item.id) && styles.tableRowSelected]}>
                        
                        <TouchableOpacity onPress={() => toggleSelectRow(item.id)} style={styles.checkboxCol}>
                          <View style={[styles.checkbox, selectedIds.has(item.id) && styles.checkboxChecked]}>
                            {selectedIds.has(item.id) && <CheckedIcon />}
                          </View>
                        </TouchableOpacity>

                        {/* User email / Display Name */}
                        <View style={[styles.tdCol, { width: 220 }]}>
                          <Text style={styles.statusNameText} numberOfLines={1}>
                            {item.user ? (item.user.display_name || `${item.user.first_name || ''} ${item.user.last_name || ''}`.trim() || 'No Name') : 'Missing User'}
                          </Text>
                          <Text style={styles.slugText} numberOfLines={1}>
                            {item.user ? item.user.email : 'Deleted ID'}
                          </Text>
                        </View>

                        {/* Assigned Role */}
                        <View style={[styles.tdCol, { width: 140 }]}>
                          <Text style={{ fontSize: 13.5, fontWeight: '600', color: '#111827' }} numberOfLines={1}>
                            {item.role ? item.role.name : 'Missing Role'}
                          </Text>
                          <Text style={styles.slugText} numberOfLines={1}>
                            slug: /{item.role ? item.role.slug : 'deleted'}
                          </Text>
                        </View>

                        {/* Priority */}
                        <View style={[styles.tdCol, { width: 100, alignItems: 'center' }]}>
                          <View style={styles.priorityTag}>
                            <Text style={styles.priorityTagText}>{item.role ? item.role.priority : '-'}</Text>
                          </View>
                        </View>

                        {/* Dates */}
                        <View style={[styles.tdCol, { width: 150 }]}>
                          <Text style={{ fontSize: 12, color: '#374151' }}>From: {formatDateString(item.valid_from)}</Text>
                          <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                            {item.valid_until ? `Until: ${formatDateString(item.valid_until)}` : 'Until: Indefinite'}
                          </Text>
                        </View>

                        {/* State badge */}
                        <View style={[styles.tdCol, { width: 90, alignItems: 'center' }]}>
                          <View style={[styles.flagBadge, { backgroundColor: badge.bg }]}>
                            <Text style={{ color: badge.text, fontSize: 11, fontWeight: '600' }}>
                              {badge.label}
                            </Text>
                          </View>
                        </View>

                        {/* Assigner */}
                        <View style={[styles.tdCol, { width: 150 }]}>
                          <Text style={{ fontSize: 12.5, color: '#374151', fontWeight: '500' }} numberOfLines={1}>
                            {item.assigner ? (item.assigner.display_name || item.assigner.email) : 'System Seed'}
                          </Text>
                        </View>

                        {/* Reason / Metadata summary */}
                        <View style={[styles.tdCol, { width: 140 }]}>
                          <Text style={{ fontSize: 12.5, color: '#4B5563' }} numberOfLines={2}>
                            {item.reason || 'No assignment notes.'}
                          </Text>
                          {item.metadata && (
                            <Text style={{ fontSize: 10, color: '#4F46E5', fontWeight: '600', marginTop: 2 }} numberOfLines={1}>
                              [Metadata configured]
                            </Text>
                          )}
                        </View>

                        {/* Actions */}
                        <View style={[styles.tdCol, { width: 90, flexDirection: 'row', justifyContent: 'center' }]}>
                          <TouchableOpacity style={[styles.actionBtn, { marginRight: 8 }]} onPress={() => openEditModal(item)}>
                            <EditIcon color="#4F46E5" />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)}>
                            <TrashIcon color="#EF4444" />
                          </TouchableOpacity>
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
              {userRoles.map((item) => {
                const badge = getValidityBadge(item);
                return (
                  <View key={item.id} style={[styles.mobileCard, selectedIds.has(item.id) && styles.tableRowSelected]}>
                    
                    <View style={styles.cardHeader}>
                      <TouchableOpacity onPress={() => toggleSelectRow(item.id)} style={styles.mobileCheckboxContainer}>
                        <View style={[styles.checkbox, selectedIds.has(item.id) && styles.checkboxChecked]}>
                          {selectedIds.has(item.id) && <CheckedIcon />}
                        </View>
                        <Text style={[styles.statusNameText, { marginLeft: 8 }]} numberOfLines={1}>
                          {item.user ? (item.user.display_name || item.user.email) : 'Deleted User'}
                        </Text>
                      </TouchableOpacity>

                      <View style={styles.mobileActionsContainer}>
                        <TouchableOpacity style={[styles.actionBtn, { marginRight: 12 }]} onPress={() => openEditModal(item)}>
                          <EditIcon color="#4F46E5" size={18} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)}>
                          <TrashIcon color="#EF4444" size={18} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={styles.mobileDescText}>
                      Mapped Role: <Text style={{ fontWeight: '600', color: '#111827' }}>{item.role ? item.role.name : 'Missing Role'}</Text>
                    </Text>
                    
                    <View style={styles.mobileRelationRow}>
                      <Text style={styles.relationLabel}>From: </Text>
                      <Text style={styles.relationValue}>{formatDateString(item.valid_from)}</Text>
                    </View>
                    <View style={styles.mobileRelationRow}>
                      <Text style={styles.relationLabel}>Until: </Text>
                      <Text style={styles.relationValue}>{item.valid_until ? formatDateString(item.valid_until) : 'Indefinite'}</Text>
                    </View>
                    <View style={styles.mobileRelationRow}>
                      <Text style={styles.relationLabel}>Reason: </Text>
                      <Text style={styles.relationValue}>{item.reason || '-'}</Text>
                    </View>

                    <View style={styles.badgeWrapContainer}>
                      <View style={[styles.flagBadgeBadge, { backgroundColor: badge.bg }]}>
                        <Text style={{ color: badge.text, fontSize: 11, fontWeight: '600' }}>{badge.label}</Text>
                      </View>
                      <View style={[styles.priorityTag, { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }]}>
                        <Text style={styles.priorityTagText}>Priority: {item.role ? item.role.priority : '-'}</Text>
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
              Showing <Text style={{ fontWeight: '600' }}>{userRoles.length}</Text> of{' '}
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
                {isEditMode ? 'Edit User Role Assignment' : 'Assign Role to User Account'}
              </Text>
              <TouchableOpacity onPress={() => setIsFormModalOpen(false)}>
                <Text style={styles.closeModalText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalFormScroll}>
              
              {/* User Dropdown Selector */}
              <DropdownSelector
                label="Target User Profile *"
                options={userOptions}
                selectedValue={formData.user_id}
                onSelect={(val) => setFormData({ ...formData, user_id: val })}
                placeholder="Choose user profile..."
              />

              {/* Role Dropdown Selector */}
              <DropdownSelector
                label="Role Configuration *"
                options={roleOptions}
                selectedValue={formData.role_id}
                onSelect={(val) => setFormData({ ...formData, role_id: val })}
                placeholder="Choose role configuration..."
              />

              {/* Validity bounds (dates) */}
              <View style={styles.rowLayout}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.formLabel}>Valid From Date</Text>
                  <TextInput
                    style={Platform.OS === 'web' ? styles.webDateInput : styles.formInput}
                    type={Platform.OS === 'web' ? 'date' : 'default'}
                    placeholder="YYYY-MM-DD"
                    value={formData.valid_from}
                    onChangeText={(txt) => setFormData({ ...formData, valid_from: txt })}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.formLabel}>Valid Until Date (optional)</Text>
                  <TextInput
                    style={Platform.OS === 'web' ? styles.webDateInput : styles.formInput}
                    type={Platform.OS === 'web' ? 'date' : 'default'}
                    placeholder="YYYY-MM-DD"
                    value={formData.valid_until}
                    onChangeText={(txt) => setFormData({ ...formData, valid_until: txt })}
                  />
                </View>
              </View>

              {/* Assigner picker selector */}
              <DropdownSelector
                label="Assigned By Auditor"
                options={assignerOptions}
                selectedValue={formData.assigned_by}
                onSelect={(val) => setFormData({ ...formData, assigned_by: val })}
                placeholder="Select assigning auditor..."
              />

              {/* Reason */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Assignment Reason / Notes</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextarea]}
                  multiline={true}
                  numberOfLines={3}
                  placeholder="Explain why this role is being assigned to the user..."
                  value={formData.reason}
                  onChangeText={(txt) => setFormData({ ...formData, reason: txt })}
                />
              </View>

              {/* Active Toggle */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Is Mapping Active</Text>
                  <Text style={styles.toggleDesc}>Disable to manually suspend this role assignment.</Text>
                </View>
                <Switch
                  value={formData.is_active}
                  onValueChange={(val) => setFormData({ ...formData, is_active: val })}
                  trackColor={{ false: '#D1D5DB', true: '#C7D2FE' }}
                  thumbColor={formData.is_active ? '#4F46E5' : '#F3F4F6'}
                />
              </View>

              {/* Metadata JSON input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Custom Metadata JSON (e.g. {"{\"project_id\": \"99\"}"})</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextarea, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}
                  multiline={true}
                  numberOfLines={4}
                  placeholder='{\n  "project_id": "123",\n  "department": "IT"\n}'
                  value={formData.metadata}
                  onChangeText={(txt) => setFormData({ ...formData, metadata: txt })}
                />
              </View>

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
                <Text style={styles.btnText}>Save Assignment</Text>
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
    backgroundColor: '#F4F6F9'
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
    color: '#212529'
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
    borderLeftColor: '#4F46E5',
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
    backgroundColor: '#007BFF'
  },
  btnDanger: {
    backgroundColor: '#DC3545'
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
    minWidth: 1060
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
  priorityTag: {
    backgroundColor: '#EBF5FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  priorityTagText: {
    color: '#2563EB',
    fontSize: 11,
    fontWeight: 'bold'
  },
  flagBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4
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
  flagBadgeBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4
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
  formTextarea: {
    height: 72,
    paddingVertical: 8,
    textAlignVertical: 'top'
  },
  rowLayout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 0
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

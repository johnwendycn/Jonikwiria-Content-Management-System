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

// API configuration
const API_BASE_URL = 'http://localhost:5000/api/roles';
const ROLE_TYPES_API_URL = 'http://localhost:5000/api/role-types';

// Custom SVG Icons
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

export default function RolesScreen() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 992;

  // Data States
  const [roles, setRoles] = useState([]);
  const [roleTypesList, setRoleTypesList] = useState([]);
  const [parentRolesList, setParentRolesList] = useState([]);
  
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
  const [sortBy, setSortBy] = useState('priority');
  const [sortOrder, setSortOrder] = useState('DESC');

  // Help guides
  const [isGuideVisible, setIsGuideVisible] = useState(true);

  // Checkbox selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Form State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    slug: '',
    description: '',
    role_type_id: '',
    parent_role_id: '',
    is_active: true,
    is_default: false,
    priority: '0',
    valid_from: '',
    valid_until: '',
    metadata: ''
  });

  // Helper date conversions
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

  // Load dropdown lists (role-types and parent roles)
  const loadRelationData = async () => {
    try {
      // Fetch role types
      const rtRes = await fetch(`${ROLE_TYPES_API_URL}?limit=100`);
      const rtJson = await rtRes.json();
      if (rtJson.success) {
        setRoleTypesList(rtJson.data.roleTypes || []);
      }

      // Fetch all roles to act as potential parents
      const rRes = await fetch(`${API_BASE_URL}?limit=200`);
      const rJson = await rRes.json();
      if (rJson.success) {
        setParentRolesList(rJson.data.roles || []);
      }
    } catch (err) {
      console.error('Failed to load relation dependencies:', err);
    }
  };

  useEffect(() => {
    loadRelationData();
  }, []);

  // Fetch Roles list
  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `${API_BASE_URL}?page=${page}&limit=${limit}&search=${encodeURIComponent(debouncedSearch)}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      const response = await fetch(url);
      const json = await response.json();
      
      if (json.success) {
        setRoles(json.data.roles);
        setTotalPages(json.data.totalPages || 1);
        setTotalItems(json.data.totalItems || 0);
      } else {
        setError(json.message || 'Failed to fetch roles.');
      }
    } catch (err) {
      setError('Could not connect to the backend server. Please verify the Express API is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // Reset checkboxes on page change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [roles]);

  // Selections
  const toggleSelectAll = () => {
    const allOnPage = roles.map(item => item.id);
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
    if (!formData.name.trim()) {
      showAlert('Validation Error', 'Please enter a name for the role.');
      return;
    }
    if (!formData.role_type_id) {
      showAlert('Validation Error', 'Please select a Role Type.');
      return;
    }

    // JSON Validate
    let parsedMetadata = null;
    if (formData.metadata && formData.metadata.trim()) {
      try {
        parsedMetadata = JSON.parse(formData.metadata);
      } catch (e) {
        showAlert('Validation Error', 'Custom metadata must be in a valid JSON syntax.');
        return;
      }
    }

    const payload = {
      ...formData,
      priority: parseInt(formData.priority) || 0,
      metadata: parsedMetadata,
      parent_role_id: formData.parent_role_id || null,
      valid_from: formData.valid_from ? new Date(formData.valid_from).toISOString() : new Date().toISOString(),
      valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null
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
        fetchRoles();
        // Refresh parent roles list as well since the roles hierarchy set has changed
        loadRelationData();
        showAlert('Success', isEditMode ? 'Role updated successfully.' : 'Role created successfully.');
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

  // Delete single
  const handleDelete = (item) => {
    confirmAction(
      'Confirm Delete',
      `Are you sure you want to delete the role "${item.name}"?`,
      async () => {
        setLoading(true);
        try {
          const response = await fetch(`${API_BASE_URL}/${item.id}`, { method: 'DELETE' });
          const json = await response.json();
          if (json.success) {
            fetchRoles();
            loadRelationData();
            showAlert('Success', 'Role removed successfully.');
          } else {
            showAlert('Error', json.message || 'Failed to delete role.');
          }
        } catch (err) {
          showAlert('Error', 'Unable to delete role.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Bulk delete
  const handleBulkDelete = () => {
    confirmAction(
      'Confirm Bulk Delete',
      `Are you sure you want to delete the ${selectedIds.size} selected roles?`,
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
            fetchRoles();
            loadRelationData();
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

  // Modal open
  const openCreateModal = () => {
    setIsEditMode(false);
    setFormData({
      id: null,
      name: '',
      slug: '',
      description: '',
      role_type_id: '',
      parent_role_id: '',
      is_active: true,
      is_default: false,
      priority: '0',
      valid_from: formatDateString(new Date()),
      valid_until: '',
      metadata: ''
    });
    setIsFormModalOpen(true);
  };

  const openEditModal = (item) => {
    setIsEditMode(true);
    setFormData({
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description || '',
      role_type_id: item.role_type_id,
      parent_role_id: item.parent_role_id || '',
      is_active: !!item.is_active,
      is_default: !!item.is_default,
      priority: String(item.priority || 0),
      valid_from: formatDateString(item.valid_from),
      valid_until: formatDateString(item.valid_until),
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
          { text: 'Delete', style: 'destructive', onPress: onConfirm }
        ]
      );
    }
  };

  // Badges representing Validity state
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

  // Convert relations into dropdown items
  const roleTypeOptions = roleTypesList.map(rt => ({ label: rt.name, value: rt.id }));
  // When editing, exclude the role itself from the list of possible parents to prevent circular loops
  const filteredParentRoles = parentRolesList.filter(r => !isEditMode || r.id !== formData.id);
  const parentRoleOptions = filteredParentRoles.map(r => ({ label: `${r.name} (Priority: ${r.priority})`, value: r.id }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      
      {/* Page Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Role Configuration</Text>
          <Text style={styles.headerSubtitle}>
            Create specific roles in the system, set priority tiers, link inheritances, and enforce temporal bounds.
          </Text>
        </View>
        
        {/* Toggle Guide */}
        <TouchableOpacity 
          style={[styles.guideToggleBtn, isGuideVisible && styles.guideToggleBtnActive]} 
          onPress={() => setIsGuideVisible(!isGuideVisible)}
        >
          <HelpIcon color={isGuideVisible ? '#4F46E5' : '#4B5563'} />
          <Text style={[styles.guideToggleBtnText, isGuideVisible && styles.guideToggleBtnTextActive]}>
            {isGuideVisible ? 'Hide Help Guide' : 'Explain Roles (Help)'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Guide Banner */}
      {isGuideVisible && (
        <View style={styles.guideCard}>
          <Text style={styles.guideCardTitle}>💡 Simple Guide: What are System Roles?</Text>
          <Text style={styles.guideCardText}>
            Roles structure user permissions. Rather than assigning permissions to each user individually, they are assigned to Roles.
          </Text>
          
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#4F46E5' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>👑 Parent Role (Inheritance):</Text> A child role inherits all permissions of its parent role automatically. Cycles are blocked.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>⭐ Priority Order:</Text> When a user has multiple roles, the role with the higher priority number takes precedence.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>📅 Temporal Bounds:</Text> Schedule a role to activate and expire automatically on dates you choose (e.g. temporary guest roles).
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#8B5CF6' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>⚙️ Custom Metadata:</Text> Store extra configuration values in JSON format (e.g. department filters or API quotas).
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
            placeholder="Search roles by name, slug, description, parents, or role types..."
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
              <Text style={styles.btnText}>Delete Selected ({selectedIds.size})</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={openCreateModal}>
            <Text style={[styles.btnText, { fontWeight: '600' }]}>+ Create Role</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Loader */}
      {loading && roles.length === 0 && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loaderText}>Loading system roles...</Text>
        </View>
      )}

      {/* Errors */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchRoles}>
            <Text style={styles.retryText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Table Grid */}
      {!loading && !error && roles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No roles found.</Text>
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
                      <View style={[styles.checkbox, roles.length > 0 && roles.every(item => selectedIds.has(item.id)) && styles.checkboxChecked]}>
                        {roles.length > 0 && roles.every(item => selectedIds.has(item.id)) && <CheckedIcon />}
                      </View>
                    </TouchableOpacity>
                    
                    <Text style={[styles.thCol, { width: 160 }]}>Role Name</Text>
                    <Text style={[styles.thCol, { width: 140 }]}>Role Type</Text>
                    <Text style={[styles.thCol, { width: 140 }]}>Parent Role</Text>
                    <Text style={[styles.thCol, { width: 180 }]}>Description</Text>
                    <Text style={[styles.thCol, { width: 80, textAlign: 'center' }]}>Priority</Text>
                    <Text style={[styles.thCol, { width: 160 }]}>Validity Range</Text>
                    <Text style={[styles.thCol, { width: 100, textAlign: 'center' }]}>State</Text>
                    <Text style={[styles.thCol, { width: 80, textAlign: 'center' }]}>Default</Text>
                    <Text style={[styles.thCol, { width: 100, textAlign: 'center' }]}>Actions</Text>
                  </View>

                  {/* Table Body */}
                  {roles.map((item) => {
                    const badge = getValidityBadge(item);
                    return (
                      <View key={item.id} style={[styles.tableRowBody, selectedIds.has(item.id) && styles.tableRowSelected]}>
                        
                        <TouchableOpacity onPress={() => toggleSelectRow(item.id)} style={styles.checkboxCol}>
                          <View style={[styles.checkbox, selectedIds.has(item.id) && styles.checkboxChecked]}>
                            {selectedIds.has(item.id) && <CheckedIcon />}
                          </View>
                        </TouchableOpacity>

                        {/* Name & Slug */}
                        <View style={[styles.tdCol, { width: 160 }]}>
                          <Text style={styles.statusNameText} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.slugText} numberOfLines={1}>/{item.slug}</Text>
                        </View>

                        {/* Role Type */}
                        <View style={[styles.tdCol, { width: 140 }]}>
                          {item.roleType ? (
                            <View style={styles.badgeRow}>
                              <View style={[styles.badgeColorDot, { backgroundColor: item.roleType.color_class || '#E5E7EB' }]} />
                              <Text style={styles.relationText} numberOfLines={1}>{item.roleType.name}</Text>
                            </View>
                          ) : (
                            <Text style={styles.missingRelationText}>None</Text>
                          )}
                        </View>

                        {/* Parent Role */}
                        <View style={[styles.tdCol, { width: 140 }]}>
                          {item.parent ? (
                            <Text style={styles.relationText} numberOfLines={1}>
                              {item.parent.name}
                            </Text>
                          ) : (
                            <Text style={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: 12 }}>None (Root)</Text>
                          )}
                        </View>

                        {/* Description */}
                        <Text style={[styles.tdCol, { width: 180, fontSize: 13, color: '#4B5563' }]} numberOfLines={2}>
                          {item.description || 'No description provided.'}
                        </Text>

                        {/* Priority */}
                        <Text style={[styles.tdCol, { width: 80, textAlign: 'center', fontWeight: 'bold' }]}>
                          {item.priority}
                        </Text>

                        {/* Validity Dates */}
                        <View style={[styles.tdCol, { width: 160 }]}>
                          <Text style={{ fontSize: 12, color: '#374151' }}>From: {formatDateString(item.valid_from)}</Text>
                          <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                            {item.valid_until ? `Until: ${formatDateString(item.valid_until)}` : 'Until: Indefinite'}
                          </Text>
                        </View>

                        {/* Active Validity State Badge */}
                        <View style={[styles.tdCol, { width: 100, alignItems: 'center' }]}>
                          <View style={[styles.flagBadge, { backgroundColor: badge.bg }]}>
                            <Text style={{ color: badge.text, fontSize: 11, fontWeight: '600' }}>
                              {badge.label}
                            </Text>
                          </View>
                        </View>

                        {/* Default Assign */}
                        <View style={[styles.tdCol, { width: 80, alignItems: 'center' }]}>
                          {item.is_default ? (
                            <View style={styles.defaultTag}>
                              <Text style={styles.defaultTagText}>Default</Text>
                            </View>
                          ) : (
                            <Text style={{ color: '#9CA3AF', fontSize: 12 }}>-</Text>
                          )}
                        </View>

                        {/* Actions */}
                        <View style={[styles.tdCol, { width: 100, flexDirection: 'row', justifyContent: 'center' }]}>
                          <TouchableOpacity style={[styles.actionBtn, { marginRight: 8 }]} onPress={() => openEditModal(item)}>
                            <EditIcon color="#4F46E5" />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.actionBtn} 
                            onPress={() => handleDelete(item)}
                          >
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
              {roles.map((item) => {
                const badge = getValidityBadge(item);
                return (
                  <View key={item.id} style={[styles.mobileCard, selectedIds.has(item.id) && styles.tableRowSelected]}>
                    
                    <View style={styles.cardHeader}>
                      <TouchableOpacity onPress={() => toggleSelectRow(item.id)} style={styles.mobileCheckboxContainer}>
                        <View style={[styles.checkbox, selectedIds.has(item.id) && styles.checkboxChecked]}>
                          {selectedIds.has(item.id) && <CheckedIcon />}
                        </View>
                        <Text style={[styles.statusNameText, { marginLeft: 8 }]}>{item.name}</Text>
                      </TouchableOpacity>

                      <View style={styles.mobileActionsContainer}>
                        <TouchableOpacity style={[styles.actionBtn, { marginRight: 12 }]} onPress={() => openEditModal(item)}>
                          <EditIcon color="#4F46E5" size={18} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.actionBtn} 
                          onPress={() => handleDelete(item)}
                        >
                          <TrashIcon color="#EF4444" size={18} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={styles.mobileDescText}>{item.description || 'No description provided.'}</Text>
                    
                    <View style={styles.mobileRelationRow}>
                      <Text style={styles.relationLabel}>Type: </Text>
                      <Text style={styles.relationValue}>{item.roleType ? item.roleType.name : 'None'}</Text>
                    </View>
                    
                    <View style={styles.mobileRelationRow}>
                      <Text style={styles.relationLabel}>Parent: </Text>
                      <Text style={styles.relationValue}>{item.parent ? item.parent.name : 'None (Root)'}</Text>
                    </View>

                    <View style={styles.mobileRelationRow}>
                      <Text style={styles.relationLabel}>Priority: </Text>
                      <Text style={styles.relationValue}>{item.priority}</Text>
                    </View>

                    <View style={styles.badgeWrapContainer}>
                      <View style={[styles.flagBadgeBadge, { backgroundColor: badge.bg }]}>
                        <Text style={{ color: badge.text, fontSize: 11, fontWeight: '600' }}>{badge.label}</Text>
                      </View>
                      {item.is_default && (
                        <View style={[styles.defaultTag, { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }]}>
                          <Text style={styles.defaultTagText}>Default Role</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ================= PAGINATION CONTROLS ================= */}
          <View style={styles.paginationContainer}>
            <Text style={styles.paginationText}>
              Showing <Text style={{ fontWeight: '600' }}>{roles.length}</Text> of{' '}
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

      {/* ================= FORM MODAL ================= */}
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
                {isEditMode ? 'Edit System Role' : 'Create System Role'}
              </Text>
              <TouchableOpacity onPress={() => setIsFormModalOpen(false)} style={{ padding: 4 }}>
                <Text style={styles.closeModalText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalFormScroll}>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Role Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Level 2 Moderator"
                  value={formData.name}
                  onChangeText={(txt) => setFormData({ ...formData, name: txt })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Slug (URL Safe - auto-generated if blank)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. level-2-moderator"
                  value={formData.slug}
                  onChangeText={(txt) => setFormData({ ...formData, slug: txt })}
                />
              </View>

              {/* Role Type Dropdown */}
              <DropdownSelector
                label="Role Type *"
                placeholder="Select system role type..."
                options={roleTypeOptions}
                selectedValue={formData.role_type_id}
                onSelect={(val) => setFormData({ ...formData, role_type_id: val })}
              />

              {/* Parent Role Dropdown (Self-Referential) */}
              <DropdownSelector
                label="Parent Role (Inherits all permissions of parent)"
                placeholder="None (Root Role)"
                options={parentRoleOptions}
                selectedValue={formData.parent_role_id}
                onSelect={(val) => setFormData({ ...formData, parent_role_id: val })}
              />

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextarea]}
                  multiline={true}
                  numberOfLines={3}
                  placeholder="Describe scope of operations authorized for this role..."
                  value={formData.description}
                  onChangeText={(txt) => setFormData({ ...formData, description: txt })}
                />
              </View>

              {/* Priority & Temporal Ranges */}
              <View style={styles.rowLayout}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.formLabel}>Priority Tier Level</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0"
                    keyboardType="numeric"
                    value={formData.priority}
                    onChangeText={(txt) => setFormData({ ...formData, priority: txt })}
                  />
                </View>
              </View>

              <View style={styles.rowLayout}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.formLabel}>Valid From (Date)</Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      style={styles.webDateInput}
                      value={formData.valid_from}
                      onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                    />
                  ) : (
                    <TextInput
                      style={styles.formInput}
                      placeholder="YYYY-MM-DD"
                      value={formData.valid_from}
                      onChangeText={(txt) => setFormData({ ...formData, valid_from: txt })}
                    />
                  )}
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.formLabel}>Valid Until (Optional)</Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      style={styles.webDateInput}
                      value={formData.valid_until}
                      onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    />
                  ) : (
                    <TextInput
                      style={styles.formInput}
                      placeholder="YYYY-MM-DD"
                      value={formData.valid_until}
                      onChangeText={(txt) => setFormData({ ...formData, valid_until: txt })}
                    />
                  )}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Custom JSON Config Metadata</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextarea, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}
                  multiline={true}
                  numberOfLines={4}
                  placeholder={`{\n  "quota_limit": 500,\n  "dept": "support"\n}`}
                  value={formData.metadata}
                  onChangeText={(txt) => setFormData({ ...formData, metadata: txt })}
                />
              </View>

              {/* Switches */}
              <Text style={styles.sectionHeader}>Role Settings & Switches</Text>
              
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Is Active Role</Text>
                  <Text style={styles.toggleDesc}>Disable to lock all authorization policies linked to this role.</Text>
                </View>
                <Switch
                  value={formData.is_active}
                  onValueChange={(val) => setFormData({ ...formData, is_active: val })}
                  trackColor={{ false: '#D1D5DB', true: '#C7D2FE' }}
                  thumbColor={formData.is_active ? '#4F46E5' : '#F3F4F6'}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Auto-Assign on Registration</Text>
                  <Text style={styles.toggleDesc}>Automatically assign this role to every newly registered profile.</Text>
                </View>
                <Switch
                  value={formData.is_default}
                  onValueChange={(val) => setFormData({ ...formData, is_default: val })}
                  trackColor={{ false: '#D1D5DB', true: '#C7D2FE' }}
                  thumbColor={formData.is_default ? '#4F46E5' : '#F3F4F6'}
                />
              </View>

            </ScrollView>

            {/* Footer Operations */}
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.btn, styles.btnSecondary, { marginRight: 8 }]} 
                onPress={() => setIsFormModalOpen(false)}
              >
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.btn, styles.btnPrimary]} 
                onPress={handleSave}
              >
                <Text style={styles.btnText}>Save Changes</Text>
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
    backgroundColor: '#F9FAFB',
  },
  contentContainer: {
    padding: Platform.OS === 'web' ? 24 : 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    flexWrap: 'wrap',
    rowGap: 12
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    maxWidth: 550
  },
  guideToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  guideToggleBtnActive: {
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2F6'
  },
  guideToggleBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4B5563',
    marginLeft: 6
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

  /* Guide Banner */
  guideCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  guideCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8
  },
  guideCardText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20
  },
  bulletList: {
    marginTop: 12,
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
    fontSize: 13,
    color: '#4B5563',
    flex: 1,
    lineHeight: 18
  },

  /* Controls Panel */
  controlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12
  },
  searchContainer: {
    flex: 1,
    minWidth: 280,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center'
  },
  searchInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13.5,
    color: '#374151',
    outlineStyle: 'none'
  },
  clearSearchBtn: {
    position: 'absolute',
    right: 10,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center'
  },
  clearSearchText: {
    fontSize: 18,
    color: '#9CA3AF',
    fontWeight: 'bold'
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  btnPrimary: {
    backgroundColor: '#4F46E5',
  },
  btnDanger: {
    backgroundColor: '#EF4444',
  },
  btnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  btnSecondaryText: {
    color: '#374151',
    fontSize: 13.5,
    fontWeight: '500'
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '500',
    marginLeft: 4
  },

  /* Table Cards */
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden'
  },
  tableWrapper: {
    flexDirection: 'column'
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    height: 40,
    alignItems: 'center'
  },
  tableRowBody: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    height: 52,
    alignItems: 'center'
  },
  tableRowSelected: {
    backgroundColor: '#EEF2FF'
  },
  thCol: {
    color: '#4B5563',
    fontWeight: '600',
    fontSize: 12.5,
    paddingHorizontal: 12
  },
  tdCol: {
    paddingHorizontal: 12,
    justifyContent: 'center'
  },
  checkboxCol: {
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%'
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  checkboxChecked: {
    borderColor: '#4F46E5'
  },
  checkboxInner: {
    borderRadius: 2
  },
  statusNameText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#111827'
  },
  slugText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2
  },
  relationText: {
    fontSize: 13.5,
    color: '#374151',
    fontWeight: '500'
  },
  missingRelationText: {
    fontSize: 12,
    color: '#EF4444',
    fontStyle: 'italic'
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center'
  },

  /* Badges & Tags */
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
  flagBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 9999,
  },
  defaultTag: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4
  },
  defaultTagText: {
    color: '#4F46E5',
    fontSize: 10.5,
    fontWeight: 'bold'
  },

  /* Loader and Errors */
  loaderContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loaderText: {
    marginTop: 12,
    color: '#4B5563',
    fontSize: 14
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center'
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500'
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: '#B91C1C',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600'
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14
  },

  /* Pagination */
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
    color: '#4B5563'
  },
  paginationNav: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  pageBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6
  },
  pageBtnDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB'
  },
  pageBtnText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500'
  },
  pageBtnTextDisabled: {
    color: '#9CA3AF'
  },
  pageIndicator: {
    paddingHorizontal: 12
  },
  pageIndicatorText: {
    fontSize: 13.5,
    color: '#4B5563',
    fontWeight: '500'
  },

  /* Mobile Layout styles */
  mobileListContainer: {
    gap: 12
  },
  mobileCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
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
    color: '#4B5563',
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
    color: '#6B7280'
  },
  relationValue: {
    fontSize: 12,
    color: '#374151',
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
    borderRadius: 4,
  },

  /* Modals Layout */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    maxWidth: 540,
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
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB'
  },
  modalTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    color: '#111827'
  },
  closeModalText: {
    fontSize: 22,
    color: '#9CA3AF',
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
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4
  },
  formInput: {
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13.5,
    color: '#111827',
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
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13.5,
    color: '#111827',
    outlineStyle: 'none',
    width: '100%',
    height: 38,
    marginTop: 4,
  },
  webDateInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13.5,
    color: '#111827',
    outlineStyle: 'none',
    width: '100%',
    height: 38,
    marginTop: 4,
  },
  pickerTrigger: {
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginTop: 4
  },
  pickerTriggerText: {
    fontSize: 13.5,
    color: '#111827'
  },
  pickerChevron: {
    fontSize: 10,
    color: '#6B7280'
  },
  pickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
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
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center'
  },
  pickerModalOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  pickerModalOptionSelected: {
    backgroundColor: '#EEF2FF'
  },
  pickerOptionText: {
    fontSize: 13.5,
    color: '#374151'
  },
  pickerOptionTextSelected: {
    color: '#4F46E5',
    fontWeight: '600'
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 4
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 16
  },
  toggleTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#374151'
  },
  toggleDesc: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB'
  }
});

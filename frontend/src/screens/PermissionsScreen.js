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
const API_BASE_URL = 'http://localhost:5000/api/permissions';
const ACTIONS_API_URL = 'http://localhost:5000/api/action-types';
const RESOURCES_API_URL = 'http://localhost:5000/api/resource-types';

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

// Cross-platform selector component
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

export default function PermissionsScreen() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  // Data States
  const [permissions, setPermissions] = useState([]);
  const [actionsList, setActionsList] = useState([]);
  const [resourcesList, setResourcesList] = useState([]);
  
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

  // Help section
  const [isGuideVisible, setIsGuideVisible] = useState(true);

  // Table selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Form State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    resource_type_id: '',
    action_type_id: '',
    name: '',
    description: '',
    is_conditional: false,
    is_default: false
  });

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);

    return () => clearTimeout(handler);
  }, [search]);

  // Load Action Types & Resource Types once for dropdown choices
  const loadRelationData = async () => {
    try {
      // Fetch action types
      const actRes = await fetch(`${ACTIONS_API_URL}?limit=100`);
      const actJson = await actRes.json();
      if (actJson.success) {
        setActionsList(actJson.data.actionTypes || []);
      }

      // Fetch resource types
      const resRes = await fetch(`${RESOURCES_API_URL}?limit=100`);
      const resJson = await resRes.json();
      if (resJson.success) {
        setResourcesList(resJson.data.resourceTypes || []);
      }
    } catch (err) {
      console.error('Failed to load action/resource mappings:', err);
    }
  };

  useEffect(() => {
    loadRelationData();
  }, []);

  // Fetch Permissions list
  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `${API_BASE_URL}?page=${page}&limit=${limit}&search=${encodeURIComponent(debouncedSearch)}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      const response = await fetch(url);
      const json = await response.json();
      
      if (json.success) {
        setPermissions(json.data.permissions);
        setTotalPages(json.data.totalPages || 1);
        setTotalItems(json.data.totalItems || 0);
      } else {
        setError(json.message || 'Failed to fetch permissions.');
      }
    } catch (err) {
      setError('Could not connect to the backend server. Please verify the Express API is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Clear selections when page data updates
  useEffect(() => {
    setSelectedIds(new Set());
  }, [permissions]);

  // Selection actions
  const toggleSelectAll = () => {
    const allOnPage = permissions.map(item => item.id);
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

  // Save changes
  const handleSave = async () => {
    if (!formData.resource_type_id) {
      showAlert('Validation Error', 'Please select a Resource Type.');
      return;
    }
    if (!formData.action_type_id) {
      showAlert('Validation Error', 'Please select an Action Type.');
      return;
    }

    setLoading(true);
    try {
      const url = isEditMode ? `${API_BASE_URL}/${formData.id}` : API_BASE_URL;
      const method = isEditMode ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const json = await response.json();

      if (json.success) {
        setIsFormModalOpen(false);
        fetchPermissions();
        showAlert('Success', isEditMode ? 'Permission updated successfully.' : 'Permission mapped successfully.');
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

  // Delete single permission
  const handleDelete = (item) => {
    confirmAction(
      'Confirm Delete',
      `Are you sure you want to delete the permission mapping "${item.name}"?`,
      async () => {
        setLoading(true);
        try {
          const response = await fetch(`${API_BASE_URL}/${item.id}`, { method: 'DELETE' });
          const json = await response.json();
          if (json.success) {
            fetchPermissions();
            showAlert('Success', 'Permission mapping removed.');
          } else {
            showAlert('Error', json.message || 'Failed to delete permission.');
          }
        } catch (err) {
          showAlert('Error', 'Unable to delete permission.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Bulk delete selected
  const handleBulkDelete = () => {
    confirmAction(
      'Confirm Bulk Delete',
      `Are you sure you want to delete the ${selectedIds.size} selected permission mappings?`,
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
            fetchPermissions();
            showAlert('Success', json.message);
          } else {
            showAlert('Error', json.message || 'Failed to delete selected items.');
          }
        } catch (err) {
          showAlert('Error', 'Unable to execute bulk delete.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Modals operations
  const openCreateModal = () => {
    setIsEditMode(false);
    setFormData({
      id: null,
      resource_type_id: '',
      action_type_id: '',
      name: '',
      description: '',
      is_conditional: false,
      is_default: false
    });
    setIsFormModalOpen(true);
  };

  const openEditModal = (item) => {
    setIsEditMode(true);
    setFormData({
      id: item.id,
      resource_type_id: item.resource_type_id,
      action_type_id: item.action_type_id,
      name: item.name,
      description: item.description || '',
      is_conditional: !!item.is_conditional,
      is_default: !!item.is_default
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

  // Convert resources and actions to dropdown arrays
  const resourceOptions = resourcesList.map(r => ({ label: r.name, value: r.id }));
  const actionOptions = actionsList.map(a => ({ label: `${a.name} (${a.verb || 'GET'})`, value: a.id }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      
      {/* Page Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Permissions Manager</Text>
          <Text style={styles.headerSubtitle}>
            Configure mappings that bind Actions to Resources. Establish access rules and auto-assignment defaults.
          </Text>
        </View>
        
        {/* Toggle Guide */}
        <TouchableOpacity 
          style={[styles.guideToggleBtn, isGuideVisible && styles.guideToggleBtnActive]} 
          onPress={() => setIsGuideVisible(!isGuideVisible)}
        >
          <HelpIcon color={isGuideVisible ? '#4F46E5' : '#4B5563'} />
          <Text style={[styles.guideToggleBtnText, isGuideVisible && styles.guideToggleBtnTextActive]}>
            {isGuideVisible ? 'Hide Help Guide' : 'Explain Permissions (Help)'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Guide Banner */}
      {isGuideVisible && (
        <View style={styles.guideCard}>
          <Text style={styles.guideCardTitle}>💡 Simple Guide: What are Permissions?</Text>
          <Text style={styles.guideCardText}>
            A permission links an **Action** (what you want to do, like "Create") to a **Resource** (what item you are doing it to, like "Page Documents").
          </Text>
          
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>⚡ Requires ABAC Conditions:</Text> If checked, this permission is only active if specific conditions are met (e.g. "Only between 9am-5pm" or "only for your own department").
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>⭐ Auto-Assign to Roles:</Text> If checked, this permission is automatically given to newly created roles in the system.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>📝 Name Auto-Generation:</Text> If you leave the permission name blank, the system will automatically name it for you (e.g. "Read Details on User Accounts").
              </Text>
            </View>
          </View>
          
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ <Text style={{ fontWeight: 'bold' }}>Conflict Prevention:</Text> You cannot create multiple permissions for the same combination of Resource and Action.
            </Text>
          </View>
        </View>
      )}

      {/* Control Actions Bar */}
      <View style={styles.controlBar}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search permissions by name, description, actions or resources..."
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
            <Text style={[styles.btnText, { fontWeight: '600' }]}>+ Create Permission</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading state */}
      {loading && permissions.length === 0 && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loaderText}>Loading permissions...</Text>
        </View>
      )}

      {/* Connection Errors */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchPermissions}>
            <Text style={styles.retryText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Grid View */}
      {!loading && !error && permissions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No permissions mapped yet.</Text>
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
                      <View style={[styles.checkbox, permissions.length > 0 && permissions.every(item => selectedIds.has(item.id)) && styles.checkboxChecked]}>
                        {permissions.length > 0 && permissions.every(item => selectedIds.has(item.id)) && <CheckedIcon />}
                      </View>
                    </TouchableOpacity>
                    
                    <Text style={[styles.thCol, { width: 260 }]}>Permission Name</Text>
                    <Text style={[styles.thCol, { width: 150 }]}>Action Type</Text>
                    <Text style={[styles.thCol, { width: 150 }]}>Resource Type</Text>
                    <Text style={[styles.thCol, { width: 220 }]}>Description</Text>
                    <Text style={[styles.thCol, { width: 90, textAlign: 'center' }]}>Conditional</Text>
                    <Text style={[styles.thCol, { width: 90, textAlign: 'center' }]}>Auto-Assign</Text>
                    <Text style={[styles.thCol, { width: 100, textAlign: 'center' }]}>Actions</Text>
                  </View>

                  {/* Table Body */}
                  {permissions.map((item) => (
                    <View key={item.id} style={[styles.tableRowBody, selectedIds.has(item.id) && styles.tableRowSelected]}>
                      
                      <TouchableOpacity onPress={() => toggleSelectRow(item.id)} style={styles.checkboxCol}>
                        <View style={[styles.checkbox, selectedIds.has(item.id) && styles.checkboxChecked]}>
                          {selectedIds.has(item.id) && <CheckedIcon />}
                        </View>
                      </TouchableOpacity>

                      {/* Name */}
                      <View style={[styles.tdCol, { width: 260 }]}>
                        <Text style={styles.statusNameText} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.slugText} numberOfLines={1}>UUID: {item.id}</Text>
                      </View>

                      {/* Action Type */}
                      <View style={[styles.tdCol, { width: 150 }]}>
                        {item.actionType ? (
                          <View style={styles.badgeRow}>
                            <View style={[styles.badgeColorDot, { backgroundColor: item.actionType.color_class || '#E5E7EB' }]} />
                            <Text style={styles.relationText} numberOfLines={1}>{item.actionType.name}</Text>
                          </View>
                        ) : (
                          <Text style={styles.missingRelationText}>Missing Action</Text>
                        )}
                      </View>

                      {/* Resource Type */}
                      <View style={[styles.tdCol, { width: 150 }]}>
                        {item.resourceType ? (
                          <View style={styles.badgeRow}>
                            <View style={[styles.badgeColorDot, { backgroundColor: item.resourceType.color_class || '#E5E7EB' }]} />
                            <Text style={styles.relationText} numberOfLines={1}>{item.resourceType.name}</Text>
                          </View>
                        ) : (
                          <Text style={styles.missingRelationText}>Missing Resource</Text>
                        )}
                      </View>

                      {/* Description */}
                      <Text style={[styles.tdCol, { width: 220, fontSize: 13, color: '#4B5563' }]} numberOfLines={2}>
                        {item.description || 'No description provided.'}
                      </Text>

                      {/* Conditional Flag */}
                      <View style={[styles.tdCol, { width: 90, alignItems: 'center' }]}>
                        <View style={[styles.flagBadge, item.is_conditional ? styles.flagBadgeWarning : styles.flagBadgeEmpty]}>
                          <Text style={item.is_conditional ? styles.flagBadgeTextWarning : styles.flagBadgeTextEmpty}>
                            {item.is_conditional ? 'Conditional' : 'None'}
                          </Text>
                        </View>
                      </View>

                      {/* Auto-Assign Flag */}
                      <View style={[styles.tdCol, { width: 90, alignItems: 'center' }]}>
                        <View style={[styles.flagBadge, item.is_default ? styles.flagBadgeSuccess : styles.flagBadgeEmpty]}>
                          <Text style={item.is_default ? styles.flagBadgeTextSuccess : styles.flagBadgeTextEmpty}>
                            {item.is_default ? 'Default' : 'No'}
                          </Text>
                        </View>
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
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : (
            /* ================= MOBILE CARD LIST VIEW ================= */
            <View style={styles.mobileListContainer}>
              {permissions.map((item) => (
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
                    <Text style={styles.relationLabel}>Action: </Text>
                    <Text style={styles.relationValue}>{item.actionType ? item.actionType.name : 'Missing'}</Text>
                  </View>
                  <View style={styles.mobileRelationRow}>
                    <Text style={styles.relationLabel}>Resource: </Text>
                    <Text style={styles.relationValue}>{item.resourceType ? item.resourceType.name : 'Missing'}</Text>
                  </View>

                  <View style={styles.badgeWrapContainer}>
                    <View style={[styles.flagBadgeBadge, item.is_conditional ? styles.flagBadgeWarning : styles.flagBadgeEmpty]}>
                      <Text style={item.is_conditional ? styles.flagBadgeTextWarning : styles.flagBadgeTextEmpty}>Conditional</Text>
                    </View>
                    <View style={[styles.flagBadgeBadge, item.is_default ? styles.flagBadgeSuccess : styles.flagBadgeEmpty]}>
                      <Text style={item.is_default ? styles.flagBadgeTextSuccess : styles.flagBadgeTextEmpty}>Auto-Assign</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ================= PAGINATION CONTROLS ================= */}
          <View style={styles.paginationContainer}>
            <Text style={styles.paginationText}>
              Showing <Text style={{ fontWeight: '600' }}>{permissions.length}</Text> of{' '}
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
                {isEditMode ? 'Edit Permission Mapping' : 'Create Permission Mapping'}
              </Text>
              <TouchableOpacity onPress={() => setIsFormModalOpen(false)} style={{ padding: 4 }}>
                <Text style={styles.closeModalText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalFormScroll}>
              
              {/* Action Dropdown Selection */}
              <DropdownSelector
                label="Action Type *"
                placeholder="Select system action..."
                options={actionOptions}
                selectedValue={formData.action_type_id}
                onSelect={(val) => setFormData({ ...formData, action_type_id: val })}
              />

              {/* Resource Dropdown Selection */}
              <DropdownSelector
                label="Resource Type *"
                placeholder="Select system resource..."
                options={resourceOptions}
                selectedValue={formData.resource_type_id}
                onSelect={(val) => setFormData({ ...formData, resource_type_id: val })}
              />

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Custom Display Name (Auto-generated if blank)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Read Details on User Accounts"
                  value={formData.name}
                  onChangeText={(txt) => setFormData({ ...formData, name: txt })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextarea]}
                  multiline={true}
                  numberOfLines={3}
                  placeholder="Explain what user activities this permission manages..."
                  value={formData.description}
                  onChangeText={(txt) => setFormData({ ...formData, description: txt })}
                />
              </View>

              {/* Switches */}
              <Text style={styles.sectionHeader}>Permission Behavior Rules</Text>
              
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Requires ABAC Conditions</Text>
                  <Text style={styles.toggleDesc}>Does this access require attribute evaluation (department, hours, owner)?</Text>
                </View>
                <Switch
                  value={formData.is_conditional}
                  onValueChange={(val) => setFormData({ ...formData, is_conditional: val })}
                  trackColor={{ false: '#D1D5DB', true: '#C7D2FE' }}
                  thumbColor={formData.is_conditional ? '#4F46E5' : '#F3F4F6'}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Auto-Assign on Registrations</Text>
                  <Text style={styles.toggleDesc}>Should this permission auto-assign to all new roles created?</Text>
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
  warningBox: {
    marginTop: 12,
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 6,
    padding: 10
  },
  warningText: {
    fontSize: 12.5,
    color: '#D97706',
    lineHeight: 16
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
    fontSize: 13,
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

  /* Badges */
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
  flagBadgeSuccess: {
    backgroundColor: '#D1FAE5'
  },
  flagBadgeWarning: {
    backgroundColor: '#FEF3C7'
  },
  flagBadgeEmpty: {
    backgroundColor: '#F3F4F6'
  },
  flagBadgeTextSuccess: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '600'
  },
  flagBadgeTextWarning: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '600'
  },
  flagBadgeTextEmpty: {
    color: '#6B7280',
    fontSize: 11
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
    maxWidth: 520,
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

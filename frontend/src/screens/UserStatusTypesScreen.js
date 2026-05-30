import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  Switch,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Alert
} from 'react-native';

// API configuration - Change this to match your backend host
const API_BASE_URL = 'http://localhost:5000/api/user-status-types';

// Custom SVG Icons generated dynamically to avoid native icon dependency issues
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

export default function UserStatusTypesScreen() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768; // Desktop/Tablet breakpoint

  // State Management
  const [statusTypes, setStatusTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Filtering & Pagination
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [sortBy, setSortBy] = useState('sort_order');
  const [sortOrder, setSortOrder] = useState('ASC');

  // Interactive Panel visibility
  const [isGuideVisible, setIsGuideVisible] = useState(true);

  // Checkbox multi-selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Modal forms
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    slug: '',
    description: '',
    is_active_state: false,
    allows_login: false,
    allows_api_access: false,
    is_locked_state: false,
    is_terminal_state: false,
    color_class: '#10B981',
    icon_class: 'check-circle',
    sort_order: '0',
    next_allowed_statuses: [],
    requires_reason: false,
    auto_transition_after: ''
  });

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on search
    }, 400);

    return () => clearTimeout(handler);
  }, [search]);

  // Fetch status types from Express API
  const fetchStatusTypes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `${API_BASE_URL}?page=${page}&limit=${limit}&search=${encodeURIComponent(debouncedSearch)}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      const response = await fetch(url);
      const json = await response.json();
      
      if (json.success) {
        setStatusTypes(json.data.statusTypes);
        setTotalPages(json.data.totalPages || 1);
        setTotalItems(json.data.totalItems || 0);
      } else {
        setError(json.message || 'Failed to fetch user status types.');
      }
    } catch (err) {
      setError('Could not connect to the backend server. Please verify the Express API is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    fetchStatusTypes();
  }, [fetchStatusTypes]);

  // Refresh selection when list updates to prevent selecting stale IDs
  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusTypes]);

  // Bulk Select Toggle
  const toggleSelectAll = () => {
    const allOnPage = statusTypes.map(item => item.id);
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

  // Create or Update submit handler
  const handleSave = async () => {
    if (!formData.name.trim()) {
      showAlert('Validation Error', 'Please enter a name for the status.');
      return;
    }

    const payload = {
      ...formData,
      sort_order: parseInt(formData.sort_order) || 0,
      next_allowed_statuses: Array.isArray(formData.next_allowed_statuses) ? formData.next_allowed_statuses : []
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
        fetchStatusTypes();
        showAlert('Success', isEditMode ? 'Status updated successfully.' : 'Status created successfully.');
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

  // Delete single status type
  const handleDelete = (item) => {
    if (item.is_system) {
      showAlert('Action Blocked', 'System-defined status types cannot be deleted to prevent application errors.');
      return;
    }

    confirmAction(
      'Confirm Delete',
      `Are you sure you want to delete the status "${item.name}"?`,
      async () => {
        setLoading(true);
        try {
          const response = await fetch(`${API_BASE_URL}/${item.id}`, { method: 'DELETE' });
          const json = await response.json();
          if (json.success) {
            fetchStatusTypes();
            showAlert('Success', 'User status type deleted.');
          } else {
            showAlert('Error', json.message || 'Failed to delete user status.');
          }
        } catch (err) {
          showAlert('Error', 'Unable to delete user status.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Bulk delete selected
  const handleBulkDelete = () => {
    const selectedList = statusTypes.filter(s => selectedIds.has(s.id));
    const systemSelected = selectedList.filter(s => s.is_system);

    if (systemSelected.length > 0) {
      showAlert(
        'Action Blocked',
        `Your selection contains system status types (${systemSelected.map(s => s.name).join(', ')}). These cannot be deleted.`
      );
      return;
    }

    confirmAction(
      'Confirm Bulk Delete',
      `Are you sure you want to delete the ${selectedIds.size} selected status types?`,
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
            fetchStatusTypes();
            showAlert('Success', json.message);
          } else {
            showAlert('Error', json.message || 'Failed to delete selected statuses.');
          }
        } catch (err) {
          showAlert('Error', 'Unable to execute bulk delete.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Open modal in Create mode
  const openCreateModal = () => {
    setIsEditMode(false);
    setFormData({
      id: null,
      name: '',
      slug: '',
      description: '',
      is_active_state: false,
      allows_login: false,
      allows_api_access: false,
      is_locked_state: false,
      is_terminal_state: false,
      color_class: '#10B981',
      icon_class: 'check-circle',
      sort_order: '0',
      next_allowed_statuses: [],
      requires_reason: false,
      auto_transition_after: ''
    });
    setIsFormModalOpen(true);
  };

  // Open modal in Edit mode
  const openEditModal = (item) => {
    setIsEditMode(true);
    setFormData({
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description || '',
      is_active_state: !!item.is_active_state,
      allows_login: !!item.allows_login,
      allows_api_access: !!item.allows_api_access,
      is_locked_state: !!item.is_locked_state,
      is_terminal_state: !!item.is_terminal_state,
      color_class: item.color_class || '#10B981',
      icon_class: item.icon_class || 'check-circle',
      sort_order: String(item.sort_order || 0),
      next_allowed_statuses: item.next_allowed_statuses || [],
      requires_reason: !!item.requires_reason,
      auto_transition_after: item.auto_transition_after || ''
    });
    setIsFormModalOpen(true);
  };

  // Helper utility for alerts across mobile/web platforms
  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // Helper utility for confirmation prompts
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      
      {/* Top Banner / Breadcrumb */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>User Status Configurator</Text>
          <Text style={styles.headerSubtitle}>Configure lifecycle workflows, logins, and API access restrictions per user state.</Text>
        </View>
        
        {/* Toggle Guide Banner Button */}
        <TouchableOpacity 
          style={[styles.guideToggleBtn, isGuideVisible && styles.guideToggleBtnActive]} 
          onPress={() => setIsGuideVisible(!isGuideVisible)}
        >
          <HelpIcon color={isGuideVisible ? '#4F46E5' : '#4B5563'} />
          <Text style={[styles.guideToggleBtnText, isGuideVisible && styles.guideToggleBtnTextActive]}>
            {isGuideVisible ? 'Hide Guide' : 'Show Guide'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Collapsible Instruction Panel */}
      {isGuideVisible && (
        <View style={styles.guideCard}>
          <Text style={styles.guideCardTitle}>📚 Understanding User Status States</Text>
          <Text style={styles.guideCardText}>
            User status types control what actions are permitted in the client and backend. Use this configuration dashboard to orchestrate behavior policies:
          </Text>
          
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>Active States:</Text> Marks whether a user is in a general "healthy" system state.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>Login & API Access Flags:</Text> Explicitly toggles client login sessions and secure gateway permissions.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>Locked States:</Text> Disables transitions and locks details (used for suspended accounts).
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#7F1D1D' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>Terminal States:</Text> Endpoints of the lifecycle. Users cannot transition out of terminal states (e.g. Banned).
              </Text>
            </View>
          </View>
          
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ <Text style={{ fontWeight: 'bold' }}>Protected System Rows:</Text> Records tagged with "System" represent critical internal workflows. To protect your server processes, system configurations cannot be deleted or have their slugs renamed.
            </Text>
          </View>
        </View>
      )}

      {/* Main Control Panel: Search, Create, Bulk Delete */}
      <View style={styles.controlBar}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search status name, slug or description..."
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
            <Text style={[styles.btnText, { fontWeight: '600' }]}>+ Create Status</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading & Error States */}
      {loading && statusTypes.length === 0 && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loaderText}>Loading status configurations...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchStatusTypes}>
            <Text style={styles.retryText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* RESPONSIVE LAYOUT CONTAINER */}
      {!loading && !error && statusTypes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No status types match your query.</Text>
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
                      <View style={[styles.checkbox, statusTypes.length > 0 && statusTypes.every(item => selectedIds.has(item.id)) && styles.checkboxChecked]}>
                        {statusTypes.length > 0 && statusTypes.every(item => selectedIds.has(item.id)) && <CheckedIcon />}
                      </View>
                    </TouchableOpacity>
                    
                    <Text style={[styles.thCol, { width: 140 }]}>Status Name</Text>
                    <Text style={[styles.thCol, { width: 220 }]}>Description</Text>
                    <Text style={[styles.thCol, { width: 70, textAlign: 'center' }]}>Active</Text>
                    <Text style={[styles.thCol, { width: 70, textAlign: 'center' }]}>Login</Text>
                    <Text style={[styles.thCol, { width: 70, textAlign: 'center' }]}>API</Text>
                    <Text style={[styles.thCol, { width: 70, textAlign: 'center' }]}>Locked</Text>
                    <Text style={[styles.thCol, { width: 70, textAlign: 'center' }]}>Terminal</Text>
                    <Text style={[styles.thCol, { width: 60, textAlign: 'center' }]}>Order</Text>
                    <Text style={[styles.thCol, { width: 80, textAlign: 'center' }]}>System</Text>
                    <Text style={[styles.thCol, { width: 100, textAlign: 'center' }]}>Actions</Text>
                  </View>

                  {/* Table Body */}
                  {statusTypes.map((item) => (
                    <View key={item.id} style={[styles.tableRowBody, selectedIds.has(item.id) && styles.tableRowSelected]}>
                      {/* Checkbox */}
                      <TouchableOpacity onPress={() => toggleSelectRow(item.id)} style={styles.checkboxCol}>
                        <View style={[styles.checkbox, selectedIds.has(item.id) && styles.checkboxChecked]}>
                          {selectedIds.has(item.id) && <CheckedIcon />}
                        </View>
                      </TouchableOpacity>

                      {/* Name & Slug */}
                      <View style={[styles.tdCol, { width: 140 }]}>
                        <View style={styles.statusBadgeRow}>
                          <View style={[styles.badgeColorDot, { backgroundColor: item.color_class || '#E5E7EB' }]} />
                          <Text style={styles.statusNameText} numberOfLines={1}>{item.name}</Text>
                        </View>
                        <Text style={styles.slugText} numberOfLines={1}>/{item.slug}</Text>
                      </View>

                      {/* Description */}
                      <Text style={[styles.tdCol, { width: 220, fontSize: 13, color: '#4B5563' }]} numberOfLines={2}>
                        {item.description || 'No description provided.'}
                      </Text>

                      {/* Behavior Flags (Centered columns) */}
                      <View style={[styles.tdCol, { width: 70, alignItems: 'center' }]}>
                        <View style={[styles.flagBadge, item.is_active_state ? styles.flagBadgeSuccess : styles.flagBadgeEmpty]}>
                          <Text style={item.is_active_state ? styles.flagBadgeTextSuccess : styles.flagBadgeTextEmpty}>
                            {item.is_active_state ? 'Yes' : 'No'}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.tdCol, { width: 70, alignItems: 'center' }]}>
                        <View style={[styles.flagBadge, item.allows_login ? styles.flagBadgeSuccess : styles.flagBadgeEmpty]}>
                          <Text style={item.allows_login ? styles.flagBadgeTextSuccess : styles.flagBadgeTextEmpty}>
                            {item.allows_login ? 'Yes' : 'No'}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.tdCol, { width: 70, alignItems: 'center' }]}>
                        <View style={[styles.flagBadge, item.allows_api_access ? styles.flagBadgeSuccess : styles.flagBadgeEmpty]}>
                          <Text style={item.allows_api_access ? styles.flagBadgeTextSuccess : styles.flagBadgeTextEmpty}>
                            {item.allows_api_access ? 'Yes' : 'No'}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.tdCol, { width: 70, alignItems: 'center' }]}>
                        <View style={[styles.flagBadge, item.is_locked_state ? styles.flagBadgeDanger : styles.flagBadgeEmpty]}>
                          <Text style={item.is_locked_state ? styles.flagBadgeTextDanger : styles.flagBadgeTextEmpty}>
                            {item.is_locked_state ? 'Yes' : 'No'}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.tdCol, { width: 70, alignItems: 'center' }]}>
                        <View style={[styles.flagBadge, item.is_terminal_state ? styles.flagBadgeDanger : styles.flagBadgeEmpty]}>
                          <Text style={item.is_terminal_state ? styles.flagBadgeTextDanger : styles.flagBadgeTextEmpty}>
                            {item.is_terminal_state ? 'Yes' : 'No'}
                          </Text>
                        </View>
                      </View>

                      {/* Sort Order */}
                      <Text style={[styles.tdCol, { width: 60, textAlign: 'center', fontWeight: '500' }]}>
                        {item.sort_order}
                      </Text>

                      {/* System indicator */}
                      <View style={[styles.tdCol, { width: 80, alignItems: 'center' }]}>
                        {item.is_system ? (
                          <View style={styles.systemTag}>
                            <Text style={styles.systemTagText}>System</Text>
                          </View>
                        ) : (
                          <Text style={{ color: '#9CA3AF', fontSize: 12 }}>Custom</Text>
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
                          disabled={item.is_system}
                          opacity={item.is_system ? 0.3 : 1}
                        >
                          <TrashIcon color={item.is_system ? '#D1D5DB' : '#EF4444'} />
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
              {statusTypes.map((item) => (
                <View key={item.id} style={[styles.mobileCard, selectedIds.has(item.id) && styles.tableRowSelected]}>
                  {/* Card Top Title bar */}
                  <View style={styles.cardHeader}>
                    <TouchableOpacity onPress={() => toggleSelectRow(item.id)} style={styles.mobileCheckboxContainer}>
                      <View style={[styles.checkbox, selectedIds.has(item.id) && styles.checkboxChecked]}>
                        {selectedIds.has(item.id) && <CheckedIcon />}
                      </View>
                      <View style={[styles.badgeColorDot, { backgroundColor: item.color_class || '#E5E7EB', marginLeft: 8 }]} />
                      <Text style={styles.statusNameText}>{item.name}</Text>
                    </TouchableOpacity>

                    <View style={styles.mobileActionsContainer}>
                      <TouchableOpacity style={[styles.actionBtn, { marginRight: 12 }]} onPress={() => openEditModal(item)}>
                        <EditIcon color="#4F46E5" size={18} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.actionBtn} 
                        onPress={() => handleDelete(item)}
                        disabled={item.is_system}
                      >
                        <TrashIcon color={item.is_system ? '#D1D5DB' : '#EF4444'} size={18} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Card Description */}
                  <Text style={styles.mobileDescText}>{item.description || 'No description provided.'}</Text>
                  
                  <View style={styles.cardMetaDataRow}>
                    <Text style={styles.mobileSlugText}>slug: /{item.slug}</Text>
                    <Text style={styles.mobileOrderText}>order: {item.sort_order}</Text>
                  </View>

                  {/* Badges Flow */}
                  <View style={styles.badgeWrapContainer}>
                    {item.is_system && (
                      <View style={[styles.systemTag, { marginRight: 6, marginBottom: 6 }]}>
                        <Text style={styles.systemTagText}>System Lock</Text>
                      </View>
                    )}
                    <View style={[styles.flagBadgeBadge, item.is_active_state ? styles.flagBadgeSuccess : styles.flagBadgeEmpty]}>
                      <Text style={item.is_active_state ? styles.flagBadgeTextSuccess : styles.flagBadgeTextEmpty}>Active</Text>
                    </View>
                    <View style={[styles.flagBadgeBadge, item.allows_login ? styles.flagBadgeSuccess : styles.flagBadgeEmpty]}>
                      <Text style={item.allows_login ? styles.flagBadgeTextSuccess : styles.flagBadgeTextEmpty}>Login</Text>
                    </View>
                    <View style={[styles.flagBadgeBadge, item.allows_api_access ? styles.flagBadgeSuccess : styles.flagBadgeEmpty]}>
                      <Text style={item.allows_api_access ? styles.flagBadgeTextSuccess : styles.flagBadgeTextEmpty}>API</Text>
                    </View>
                    {item.is_locked_state && (
                      <View style={[styles.flagBadgeBadge, styles.flagBadgeDanger]}>
                        <Text style={styles.flagBadgeTextDanger}>Locked</Text>
                      </View>
                    )}
                    {item.is_terminal_state && (
                      <View style={[styles.flagBadgeBadge, styles.flagBadgeDanger]}>
                        <Text style={styles.flagBadgeTextDanger}>Terminal</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ================= PAGINATION FOOTER ================= */}
          <View style={styles.paginationContainer}>
            <Text style={styles.paginationText}>
              Showing <Text style={{ fontWeight: '600' }}>{statusTypes.length}</Text> of{' '}
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
                {isEditMode ? 'Edit User Status Type' : 'Create User Status Type'}
              </Text>
              <TouchableOpacity onPress={() => setIsFormModalOpen(false)}>
                <Text style={styles.closeModalText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalFormScroll}>
              
              {/* Basic Fields */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Status Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Account Verifying"
                  value={formData.name}
                  onChangeText={(txt) => setFormData({ ...formData, name: txt })}
                  disabled={isEditMode && formData.is_system}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Slug (URL Safe Name - auto-generated if blank)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. account-verifying"
                  value={formData.slug}
                  onChangeText={(txt) => setFormData({ ...formData, slug: txt })}
                  editable={!(isEditMode && formData.is_system)}
                  selectTextOnFocus={!(isEditMode && formData.is_system)}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextarea]}
                  multiline={true}
                  numberOfLines={3}
                  placeholder="Explain when this state is assigned to a user..."
                  value={formData.description}
                  onChangeText={(txt) => setFormData({ ...formData, description: txt })}
                />
              </View>

              {/* Settings: Color theme / Sort Order */}
              <View style={styles.rowLayout}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.formLabel}>UI Color Tag (Hex)</Text>
                  <View style={styles.colorPickerWrapper}>
                    <View style={[styles.colorPreview, { backgroundColor: formData.color_class }]} />
                    <TextInput
                      style={[styles.formInput, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
                      placeholder="#3B82F6"
                      value={formData.color_class}
                      onChangeText={(txt) => setFormData({ ...formData, color_class: txt })}
                    />
                  </View>
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.formLabel}>Sort Order Priority</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0"
                    keyboardType="numeric"
                    value={formData.sort_order}
                    onChangeText={(txt) => setFormData({ ...formData, sort_order: txt })}
                  />
                </View>
              </View>

              {/* Behavior Flags (Toggles) */}
              <Text style={styles.sectionHeader}>System Behavior Flags</Text>
              
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Active State</Text>
                  <Text style={styles.toggleDesc}>Is this state considered active and healthy?</Text>
                </View>
                <Switch
                  value={formData.is_active_state}
                  onValueChange={(val) => setFormData({ ...formData, is_active_state: val })}
                  trackColor={{ false: '#D1D5DB', true: '#C7D2FE' }}
                  thumbColor={formData.is_active_state ? '#4F46E5' : '#F3F4F6'}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Allows Login</Text>
                  <Text style={styles.toggleDesc}>Can users with this status authenticate into applications?</Text>
                </View>
                <Switch
                  value={formData.allows_login}
                  onValueChange={(val) => setFormData({ ...formData, allows_login: val })}
                  trackColor={{ false: '#D1D5DB', true: '#C7D2FE' }}
                  thumbColor={formData.allows_login ? '#4F46E5' : '#F3F4F6'}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Allows API Access</Text>
                  <Text style={styles.toggleDesc}>Are secure database/resource API accesses authorized?</Text>
                </View>
                <Switch
                  value={formData.allows_api_access}
                  onValueChange={(val) => setFormData({ ...formData, allows_api_access: val })}
                  trackColor={{ false: '#D1D5DB', true: '#C7D2FE' }}
                  thumbColor={formData.allows_api_access ? '#4F46E5' : '#F3F4F6'}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Is Locked State</Text>
                  <Text style={styles.toggleDesc}>Prevents details edit or status changes until unlocked?</Text>
                </View>
                <Switch
                  value={formData.is_locked_state}
                  onValueChange={(val) => setFormData({ ...formData, is_locked_state: val })}
                  trackColor={{ false: '#D1D5DB', true: '#C7D2FE' }}
                  thumbColor={formData.is_locked_state ? '#4F46E5' : '#F3F4F6'}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Is Terminal State</Text>
                  <Text style={styles.toggleDesc}>Lifecycle end. Users cannot transition out of terminal state.</Text>
                </View>
                <Switch
                  value={formData.is_terminal_state}
                  onValueChange={(val) => setFormData({ ...formData, is_terminal_state: val })}
                  trackColor={{ false: '#D1D5DB', true: '#C7D2FE' }}
                  thumbColor={formData.is_terminal_state ? '#4F46E5' : '#F3F4F6'}
                />
              </View>

              {/* Extra settings for future scaling */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Requires State Reason</Text>
                  <Text style={styles.toggleDesc}>Prompts administrator for explanation during transitions.</Text>
                </View>
                <Switch
                  value={formData.requires_reason}
                  onValueChange={(val) => setFormData({ ...formData, requires_reason: val })}
                  trackColor={{ false: '#D1D5DB', true: '#C7D2FE' }}
                  thumbColor={formData.requires_reason ? '#4F46E5' : '#F3F4F6'}
                />
              </View>
            </ScrollView>

            {/* Footer Form Operations */}
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
    backgroundColor: '#F9FAFB', // Premium soft white background
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
    color: '#111827', // Slate dark text
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

  /* Guide banner */
  guideCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  guideCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8
  },
  guideCardText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 12
  },
  bulletList: {
    marginBottom: 12
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingLeft: 4
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 10
  },
  bulletText: {
    fontSize: 13,
    color: '#4B5563'
  },
  warningBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5'
  },
  warningText: {
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 16
  },

  /* Control bar */
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
    minWidth: 260,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    alignItems: 'center',
    paddingHorizontal: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: '#111827',
    outlineStyle: 'none' // Remove default border on web inputs
  },
  clearSearchBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center'
  },
  clearSearchText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#9CA3AF',
    lineHeight: 20
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  btn: {
    flexDirection: 'row',
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  btnPrimary: {
    backgroundColor: '#4F46E5', // Indigo-600
  },
  btnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB'
  },
  btnDanger: {
    backgroundColor: '#EF4444',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4
  },
  btnSecondaryText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500'
  },

  /* Loading/Error/Empty states */
  loaderContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280'
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginVertical: 12
  },
  errorText: {
    fontSize: 14,
    color: '#991B1B',
    fontWeight: '500',
    textAlign: 'center'
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F87171',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6
  },
  retryText: {
    fontSize: 13,
    color: '#B91C1C',
    fontWeight: '600'
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center'
  },

  /* DESKTOP TABLE VIEW */
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden'
  },
  tableWrapper: {
    minWidth: 990,
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16
  },
  tableRowBody: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF'
  },
  tableRowSelected: {
    backgroundColor: '#EEF2FF', // Accent light indigo background when row checked
  },
  checkboxCol: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'flex-start'
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  checkboxChecked: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF'
  },
  checkboxInner: {
    borderRadius: 2
  },
  thCol: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 8
  },
  tdCol: {
    fontSize: 14,
    color: '#111827',
    paddingHorizontal: 8
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  badgeColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8
  },
  statusNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827'
  },
  slugText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace'
  },
  flagBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
    width: 46,
    alignItems: 'center',
    justifyContent: 'center'
  },
  flagBadgeSuccess: {
    backgroundColor: '#ECFDF5'
  },
  flagBadgeDanger: {
    backgroundColor: '#FEF2F2'
  },
  flagBadgeEmpty: {
    backgroundColor: '#F3F4F6'
  },
  flagBadgeTextSuccess: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669'
  },
  flagBadgeTextDanger: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626'
  },
  flagBadgeTextEmpty: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF'
  },
  systemTag: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8
  },
  systemTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151'
  },
  actionBtn: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },

  /* MOBILE CARD VIEW */
  mobileListContainer: {
    gap: 12,
    marginBottom: 16
  },
  mobileCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 10,
    marginBottom: 10
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
    fontSize: 13.5,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 10
  },
  cardMetaDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  mobileSlugText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace'
  },
  mobileOrderText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500'
  },
  badgeWrapContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  flagBadgeBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },

  /* PAGINATION FOOTER */
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexWrap: 'wrap',
    rowGap: 12
  },
  paginationText: {
    fontSize: 13,
    color: '#6B7280'
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
    borderRadius: 6,
  },
  pageBtnDisabled: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB'
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151'
  },
  pageBtnTextDisabled: {
    color: '#9CA3AF'
  },
  pageIndicator: {
    paddingHorizontal: 12
  },
  pageIndicatorText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500'
  },

  /* CREATE/EDIT MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.4)', // Dark transparent cover overlay
    justifyContent: 'center',
    alignItems: 'center',
    padding: Platform.OS === 'web' ? 24 : 12
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 580,
    maxHeight: '90%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
    overflow: 'hidden'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827'
  },
  closeModalText: {
    fontSize: 28,
    color: '#9CA3AF',
    lineHeight: 28,
    fontWeight: '300'
  },
  modalFormScroll: {
    padding: 16
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 4
  },
  formGroup: {
    marginBottom: 14
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 14,
    color: '#111827',
    outlineStyle: 'none'
  },
  formTextarea: {
    height: 80,
    paddingVertical: 10,
    textAlignVertical: 'top'
  },
  rowLayout: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  colorPickerWrapper: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRightWidth: 0,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8
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
    color: '#111827'
  },
  toggleDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB'
  }
});

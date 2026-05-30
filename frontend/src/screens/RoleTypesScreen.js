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
const API_BASE_URL = 'http://localhost:5000/api/role-types';

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

export default function RoleTypesScreen() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768; // Breakpoint for Web vs Mobile grid view

  // State Management
  const [roleTypes, setRoleTypes] = useState([]);
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

  // Help panel state
  const [isGuideVisible, setIsGuideVisible] = useState(true);

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Modal forms
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    slug: '',
    description: '',
    is_system_role: false,
    is_assignable: true,
    is_hierarchical: false,
    allows_custom_permissions: true,
    color_class: '#4F46E5',
    icon_class: 'shield',
    sort_order: '0',
    max_assignment_per_user: '',
    auto_assign_on_register: false
  });

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);

    return () => clearTimeout(handler);
  }, [search]);

  // Fetch roles
  const fetchRoleTypes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `${API_BASE_URL}?page=${page}&limit=${limit}&search=${encodeURIComponent(debouncedSearch)}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      const response = await fetch(url);
      const json = await response.json();
      
      if (json.success) {
        setRoleTypes(json.data.roleTypes);
        setTotalPages(json.data.totalPages || 1);
        setTotalItems(json.data.totalItems || 0);
      } else {
        setError(json.message || 'Failed to fetch role types.');
      }
    } catch (err) {
      setError('Could not connect to the backend server. Please verify the Express API is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    fetchRoleTypes();
  }, [fetchRoleTypes]);

  // Reset checkboxes on page update
  useEffect(() => {
    setSelectedIds(new Set());
  }, [roleTypes]);

  // Checkbox interactions
  const toggleSelectAll = () => {
    const allOnPage = roleTypes.map(item => item.id);
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

  // Submit Handler
  const handleSave = async () => {
    if (!formData.name.trim()) {
      showAlert('Validation Error', 'Please enter a name for the role.');
      return;
    }

    const payload = {
      ...formData,
      sort_order: parseInt(formData.sort_order) || 0,
      max_assignment_per_user: formData.max_assignment_per_user === '' ? null : parseInt(formData.max_assignment_per_user)
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
        fetchRoleTypes();
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

  // Delete single role
  const handleDelete = (item) => {
    if (item.is_system_role) {
      showAlert('Action Blocked', 'System-defined roles cannot be deleted to prevent application security issues.');
      return;
    }

    confirmAction(
      'Confirm Delete',
      `Are you sure you want to delete the role "${item.name}"?`,
      async () => {
        setLoading(true);
        try {
          const response = await fetch(`${API_BASE_URL}/${item.id}`, { method: 'DELETE' });
          const json = await response.json();
          if (json.success) {
            fetchRoleTypes();
            showAlert('Success', 'Role type deleted.');
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

  // Bulk delete roles
  const handleBulkDelete = () => {
    const selectedList = roleTypes.filter(s => selectedIds.has(s.id));
    const systemSelected = selectedList.filter(s => s.is_system_role);

    if (systemSelected.length > 0) {
      showAlert(
        'Action Blocked',
        `Your selection contains system roles (${systemSelected.map(s => s.name).join(', ')}). These cannot be deleted.`
      );
      return;
    }

    confirmAction(
      'Confirm Bulk Delete',
      `Are you sure you want to delete the ${selectedIds.size} selected role types?`,
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
            fetchRoleTypes();
            showAlert('Success', json.message);
          } else {
            showAlert('Error', json.message || 'Failed to delete selected roles.');
          }
        } catch (err) {
          showAlert('Error', 'Unable to execute bulk delete.');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const openCreateModal = () => {
    setIsEditMode(false);
    setFormData({
      id: null,
      name: '',
      slug: '',
      description: '',
      is_system_role: false,
      is_assignable: true,
      is_hierarchical: false,
      allows_custom_permissions: true,
      color_class: '#4F46E5',
      icon_class: 'shield',
      sort_order: '0',
      max_assignment_per_user: '',
      auto_assign_on_register: false
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
      is_system_role: !!item.is_system_role,
      is_assignable: !!item.is_assignable,
      is_hierarchical: !!item.is_hierarchical,
      allows_custom_permissions: !!item.allows_custom_permissions,
      color_class: item.color_class || '#4F46E5',
      icon_class: item.icon_class || 'shield',
      sort_order: String(item.sort_order || 0),
      max_assignment_per_user: item.max_assignment_per_user !== null && item.max_assignment_per_user !== undefined ? String(item.max_assignment_per_user) : '',
      auto_assign_on_register: !!item.auto_assign_on_register
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      
      {/* Top Banner */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Role Configurator</Text>
          <Text style={styles.headerSubtitle}>Define roles, assignability constraints, and permission properties for users.</Text>
        </View>
        
        {/* Toggle Guide */}
        <TouchableOpacity 
          style={[styles.guideToggleBtn, isGuideVisible && styles.guideToggleBtnActive]} 
          onPress={() => setIsGuideVisible(!isGuideVisible)}
        >
          <HelpIcon color={isGuideVisible ? '#4F46E5' : '#4B5563'} />
          <Text style={[styles.guideToggleBtnText, isGuideVisible && styles.guideToggleBtnTextActive]}>
            {isGuideVisible ? 'Hide Help Guide' : 'Explain Flags (Help)'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Layman Instructions Box */}
      {isGuideVisible && (
        <View style={styles.guideCard}>
          <Text style={styles.guideCardTitle}>💡 Simple Guide: What do these switches mean?</Text>
          <Text style={styles.guideCardText}>
            Roles tell the website what a user is allowed to see or edit. Use this page to customize the behaviors:
          </Text>
          
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>🔒 System Role:</Text> Built-in roles critical to the system (e.g. Super Admin). These cannot be deleted.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>👤 Assignable:</Text> If checked, administrators can manually assign this role to a user.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>📈 Hierarchical:</Text> Higher tier roles (e.g. Admin) can modify/override users with lower tier roles.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#8B5CF6' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>🔑 Custom Permissions:</Text> Allows you to give a specific user special overrides outside their standard role.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.bulletText}>
                <Text style={{ fontWeight: '600' }}>📝 Auto-Assign on Signup:</Text> New users who register accounts will automatically get this role (e.g. Subscriber).
              </Text>
            </View>
          </View>
          
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ <Text style={{ fontWeight: 'bold' }}>Important Limit Constraint:</Text> "Max Assignment" allows you to set a cap. For example, setting it to 1 ensures there is only ever exactly one user carrying that role in the database.
            </Text>
          </View>
        </View>
      )}

      {/* Main Control Panel */}
      <View style={styles.controlBar}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search role name, slug or description..."
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

      {/* Loader & Errors */}
      {loading && roleTypes.length === 0 && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loaderText}>Loading roles...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchRoleTypes}>
            <Text style={styles.retryText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Layout Grid */}
      {!loading && !error && roleTypes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No role types found.</Text>
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
                      <View style={[styles.checkbox, roleTypes.length > 0 && roleTypes.every(item => selectedIds.has(item.id)) && styles.checkboxChecked]}>
                        {roleTypes.length > 0 && roleTypes.every(item => selectedIds.has(item.id)) && <CheckedIcon />}
                      </View>
                    </TouchableOpacity>
                    
                    <Text style={[styles.thCol, { width: 150 }]}>Role Name</Text>
                    <Text style={[styles.thCol, { width: 220 }]}>Description</Text>
                    <Text style={[styles.thCol, { width: 80, textAlign: 'center' }]}>System</Text>
                    <Text style={[styles.thCol, { width: 90, textAlign: 'center' }]}>Assignable</Text>
                    <Text style={[styles.thCol, { width: 90, textAlign: 'center' }]}>Hierarchical</Text>
                    <Text style={[styles.thCol, { width: 100, textAlign: 'center' }]}>Custom Perms</Text>
                    <Text style={[styles.thCol, { width: 100, textAlign: 'center' }]}>Auto-Assign</Text>
                    <Text style={[styles.thCol, { width: 80, textAlign: 'center' }]}>Max Users</Text>
                    <Text style={[styles.thCol, { width: 60, textAlign: 'center' }]}>Order</Text>
                    <Text style={[styles.thCol, { width: 100, textAlign: 'center' }]}>Actions</Text>
                  </View>

                  {/* Table Body */}
                  {roleTypes.map((item) => (
                    <View key={item.id} style={[styles.tableRowBody, selectedIds.has(item.id) && styles.tableRowSelected]}>
                      
                      <TouchableOpacity onPress={() => toggleSelectRow(item.id)} style={styles.checkboxCol}>
                        <View style={[styles.checkbox, selectedIds.has(item.id) && styles.checkboxChecked]}>
                          {selectedIds.has(item.id) && <CheckedIcon />}
                        </View>
                      </TouchableOpacity>

                      {/* Name & Slug */}
                      <View style={[styles.tdCol, { width: 150 }]}>
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

                      {/* Flag Indicators */}
                      <View style={[styles.tdCol, { width: 80, alignItems: 'center' }]}>
                        <View style={[styles.flagBadge, item.is_system_role ? styles.flagBadgeDanger : styles.flagBadgeEmpty]}>
                          <Text style={item.is_system_role ? styles.flagBadgeTextDanger : styles.flagBadgeTextEmpty}>
                            {item.is_system_role ? 'Yes' : 'No'}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.tdCol, { width: 90, alignItems: 'center' }]}>
                        <View style={[styles.flagBadge, item.is_assignable ? styles.flagBadgeSuccess : styles.flagBadgeEmpty]}>
                          <Text style={item.is_assignable ? styles.flagBadgeTextSuccess : styles.flagBadgeTextEmpty}>
                            {item.is_assignable ? 'Yes' : 'No'}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.tdCol, { width: 90, alignItems: 'center' }]}>
                        <View style={[styles.flagBadge, item.is_hierarchical ? styles.flagBadgeSuccess : styles.flagBadgeEmpty]}>
                          <Text style={item.is_hierarchical ? styles.flagBadgeTextSuccess : styles.flagBadgeTextEmpty}>
                            {item.is_hierarchical ? 'Yes' : 'No'}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.tdCol, { width: 100, alignItems: 'center' }]}>
                        <View style={[styles.flagBadge, item.allows_custom_permissions ? styles.flagBadgeSuccess : styles.flagBadgeEmpty]}>
                          <Text style={item.allows_custom_permissions ? styles.flagBadgeTextSuccess : styles.flagBadgeTextEmpty}>
                            {item.allows_custom_permissions ? 'Yes' : 'No'}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.tdCol, { width: 100, alignItems: 'center' }]}>
                        <View style={[styles.flagBadge, item.auto_assign_on_register ? styles.flagBadgeSuccess : styles.flagBadgeEmpty]}>
                          <Text style={item.auto_assign_on_register ? styles.flagBadgeTextSuccess : styles.flagBadgeTextEmpty}>
                            {item.auto_assign_on_register ? 'Yes' : 'No'}
                          </Text>
                        </View>
                      </View>

                      {/* Max Assignment Constraint */}
                      <Text style={[styles.tdCol, { width: 80, textAlign: 'center', fontWeight: '500' }]}>
                        {item.max_assignment_per_user !== null ? item.max_assignment_per_user : '∞'}
                      </Text>

                      {/* Sort Order */}
                      <Text style={[styles.tdCol, { width: 60, textAlign: 'center', fontWeight: '500' }]}>
                        {item.sort_order}
                      </Text>

                      {/* Actions */}
                      <View style={[styles.tdCol, { width: 100, flexDirection: 'row', justifyContent: 'center' }]}>
                        <TouchableOpacity style={[styles.actionBtn, { marginRight: 8 }]} onPress={() => openEditModal(item)}>
                          <EditIcon color="#4F46E5" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.actionBtn} 
                          onPress={() => handleDelete(item)}
                          disabled={item.is_system_role}
                          opacity={item.is_system_role ? 0.3 : 1}
                        >
                          <TrashIcon color={item.is_system_role ? '#D1D5DB' : '#EF4444'} />
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
              {roleTypes.map((item) => (
                <View key={item.id} style={[styles.mobileCard, selectedIds.has(item.id) && styles.tableRowSelected]}>
                  
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
                        disabled={item.is_system_role}
                      >
                        <TrashIcon color={item.is_system_role ? '#D1D5DB' : '#EF4444'} size={18} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.mobileDescText}>{item.description || 'No description provided.'}</Text>
                  
                  <View style={styles.cardMetaDataRow}>
                    <Text style={styles.mobileSlugText}>slug: /{item.slug}</Text>
                    <Text style={styles.mobileOrderText}>Limit: {item.max_assignment_per_user !== null ? item.max_assignment_per_user : '∞'}</Text>
                  </View>

                  <View style={styles.badgeWrapContainer}>
                    {item.is_system_role && (
                      <View style={[styles.systemTag, { marginRight: 6, marginBottom: 6 }]}>
                        <Text style={styles.systemTagText}>System Lock</Text>
                      </View>
                    )}
                    <View style={[styles.flagBadgeBadge, item.is_assignable ? styles.flagBadgeSuccess : styles.flagBadgeEmpty]}>
                      <Text style={item.is_assignable ? styles.flagBadgeTextSuccess : styles.flagBadgeTextEmpty}>Assignable</Text>
                    </View>
                    <View style={[styles.flagBadgeBadge, item.is_hierarchical ? styles.flagBadgeSuccess : styles.flagBadgeEmpty]}>
                      <Text style={item.is_hierarchical ? styles.flagBadgeTextSuccess : styles.flagBadgeTextEmpty}>Hierarchical</Text>
                    </View>
                    <View style={[styles.flagBadgeBadge, item.allows_custom_permissions ? styles.flagBadgeSuccess : styles.flagBadgeEmpty]}>
                      <Text style={item.allows_custom_permissions ? styles.flagBadgeTextSuccess : styles.flagBadgeTextEmpty}>Custom Perms</Text>
                    </View>
                    <View style={[styles.flagBadgeBadge, item.auto_assign_on_register ? styles.flagBadgeSuccess : styles.flagBadgeEmpty]}>
                      <Text style={item.auto_assign_on_register ? styles.flagBadgeTextSuccess : styles.flagBadgeTextEmpty}>Auto-Assign</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ================= PAGINATION FOOTER ================= */}
          <View style={styles.paginationContainer}>
            <Text style={styles.paginationText}>
              Showing <Text style={{ fontWeight: '600' }}>{roleTypes.length}</Text> of{' '}
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
                {isEditMode ? 'Edit Role Type' : 'Create Role Type'}
              </Text>
              <TouchableOpacity onPress={() => setIsFormModalOpen(false)}>
                <Text style={styles.closeModalText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalFormScroll}>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Role Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Account Auditor"
                  value={formData.name}
                  onChangeText={(txt) => setFormData({ ...formData, name: txt })}
                  editable={!(isEditMode && formData.is_system_role)}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Slug (URL Safe - auto-generated if blank)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. account-auditor"
                  value={formData.slug}
                  onChangeText={(txt) => setFormData({ ...formData, slug: txt })}
                  editable={!(isEditMode && formData.is_system_role)}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextarea]}
                  multiline={true}
                  numberOfLines={3}
                  placeholder="Summarize the core privileges and access policies of this role..."
                  value={formData.description}
                  onChangeText={(txt) => setFormData({ ...formData, description: txt })}
                />
              </View>

              <View style={styles.rowLayout}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.formLabel}>UI Color Tag (Hex)</Text>
                  <View style={styles.colorPickerWrapper}>
                    <View style={[styles.colorPreview, { backgroundColor: formData.color_class }]} />
                    <TextInput
                      style={[styles.formInput, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
                      placeholder="#4F46E5"
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

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Max Assignment Cap (Leave blank for Unlimited)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Unlimited (e.g. 1, 5, etc.)"
                  keyboardType="numeric"
                  value={formData.max_assignment_per_user}
                  onChangeText={(txt) => setFormData({ ...formData, max_assignment_per_user: txt })}
                />
              </View>

              {/* Behavior switches */}
              <Text style={styles.sectionHeader}>Role Behavior Flags</Text>
              
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Assignable Role</Text>
                  <Text style={styles.toggleDesc}>Can administrators map this role to user profiles?</Text>
                </View>
                <Switch
                  value={formData.is_assignable}
                  onValueChange={(val) => setFormData({ ...formData, is_assignable: val })}
                  trackColor={{ false: '#D1D5DB', true: '#C7D2FE' }}
                  thumbColor={formData.is_assignable ? '#4F46E5' : '#F3F4F6'}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Hierarchical Relationship</Text>
                  <Text style={styles.toggleDesc}>Can users with higher roles modify members of this role?</Text>
                </View>
                <Switch
                  value={formData.is_hierarchical}
                  onValueChange={(val) => setFormData({ ...formData, is_hierarchical: val })}
                  trackColor={{ false: '#D1D5DB', true: '#C7D2FE' }}
                  thumbColor={formData.is_hierarchical ? '#4F46E5' : '#F3F4F6'}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Allows Custom Permissions</Text>
                  <Text style={styles.toggleDesc}>Can users holding this role get custom permission overrides?</Text>
                </View>
                <Switch
                  value={formData.allows_custom_permissions}
                  onValueChange={(val) => setFormData({ ...formData, allows_custom_permissions: val })}
                  trackColor={{ false: '#D1D5DB', true: '#C7D2FE' }}
                  thumbColor={formData.allows_custom_permissions ? '#4F46E5' : '#F3F4F6'}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Auto-Assign on Signup</Text>
                  <Text style={styles.toggleDesc}>Should new registrations automatically get this role?</Text>
                </View>
                <Switch
                  value={formData.auto_assign_on_register}
                  onValueChange={(val) => setFormData({ ...formData, auto_assign_on_register: val })}
                  trackColor={{ false: '#D1D5DB', true: '#C7D2FE' }}
                  thumbColor={formData.auto_assign_on_register ? '#4F46E5' : '#F3F4F6'}
                />
              </View>
            </ScrollView>

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

// Styling (matches UserStatusTypesScreen for a consistent layout dashboard)
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

  /* Guide card */
  guideCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
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
    marginBottom: 8,
    paddingLeft: 4
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 10
  },
  bulletText: {
    fontSize: 13.5,
    color: '#4B5563'
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FCD34D'
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
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
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: '#111827',
    outlineStyle: 'none'
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
  },
  btnPrimary: {
    backgroundColor: '#4F46E5',
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

  /* Loader States */
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

  /* TABLE */
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden'
  },
  tableWrapper: {
    minWidth: 1100,
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
    backgroundColor: '#EEF2FF',
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

  /* MODALS */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.4)',
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

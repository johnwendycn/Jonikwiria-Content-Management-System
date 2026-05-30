import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  useWindowDimensions,
  Platform,
  SafeAreaView
} from 'react-native';
import UserStatusTypesScreen from '../screens/UserStatusTypesScreen';
import RoleTypesScreen from '../screens/RoleTypesScreen';
import ActionTypesScreen from '../screens/ActionTypesScreen';
import ResourceTypesScreen from '../screens/ResourceTypesScreen';
import PermissionsScreen from '../screens/PermissionsScreen';
import RolesScreen from '../screens/RolesScreen';
import UsersScreen from '../screens/UsersScreen';
import UserRolesScreen from '../screens/UserRolesScreen';
import RolePermissionsScreen from '../screens/RolePermissionsScreen';
import UserPermissionsScreen from '../screens/UserPermissionsScreen';
import AuditLogsScreen from '../screens/AuditLogsScreen';

// Custom SVG Icons generated dynamically to avoid native icon dependencies
const HamburgerIcon = ({ color = '#374151', size = 20 }) => (
  <View style={{ width: size, height: size, justifyContent: 'space-around', paddingVertical: 2 }}>
    <View style={{ height: 2.5, backgroundColor: color, borderRadius: 1 }} />
    <View style={{ height: 2.5, backgroundColor: color, borderRadius: 1 }} />
    <View style={{ height: 2.5, backgroundColor: color, borderRadius: 1 }} />
  </View>
);

const SearchIcon = ({ color = '#9CA3AF', size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size - 6, height: size - 6, borderRadius: (size - 6) / 2, borderWidth: 1.5, borderColor: color }} />
    <View style={{ width: 1.5, height: 6, backgroundColor: color, transform: [{ rotate: '45deg' }], marginTop: -2, marginLeft: 6 }} />
  </View>
);

const DashboardIcon = ({ color = '#9CA3AF', size = 18 }) => (
  <View style={{ width: size, height: size, flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 1 }}>
    <View style={{ width: size / 2 - 2, height: size / 2 - 2, backgroundColor: color, borderRadius: 1 }} />
    <View style={{ width: size / 2 - 2, height: size / 2 - 2, backgroundColor: color, borderRadius: 1 }} />
    <View style={{ width: size / 2 - 2, height: size / 2 - 2, backgroundColor: color, borderRadius: 1 }} />
    <View style={{ width: size / 2 - 2, height: size / 2 - 2, backgroundColor: color, borderRadius: 1 }} />
  </View>
);

const UsersIcon = ({ color = '#9CA3AF', size = 18 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    {/* Head */}
    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginBottom: 2 }} />
    {/* Body */}
    <View style={{ width: 12, height: 6, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: color }} />
  </View>
);

const SettingsIcon = ({ color = '#9CA3AF', size = 18 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2, borderWidth: 2, borderColor: color, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
    </View>
  </View>
);

const BellIcon = ({ color = '#374151', size = 20 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: 10, height: 10, borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: color, marginBottom: 1 }} />
    <View style={{ width: 14, height: 2, backgroundColor: color, borderRadius: 1 }} />
    <View style={{ width: 4, height: 2, backgroundColor: color, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />
  </View>
);

// Stat Widget Component matching AdminLTE 3 Info Box styling
const InfoBox = ({ title, count, color, iconBg, progressText }) => (
  <View style={styles.infoBox}>
    <View style={[styles.infoBoxIcon, { backgroundColor: iconBg }]}>
      <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' }}>#</Text>
    </View>
    <View style={styles.infoBoxContent}>
      <Text style={styles.infoBoxText}>{title}</Text>
      <Text style={styles.infoBoxNumber}>{count}</Text>
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: color, width: '70%' }]} />
      </View>
      <Text style={styles.progressDescription}>{progressText}</Text>
    </View>
  </View>
);

// Placeholder Screens
const DashboardPlaceholder = () => (
  <ScrollView style={styles.placeholderContainer} contentContainerStyle={styles.placeholderContent}>
    <View style={styles.pageHeaderRow}>
      <Text style={styles.pageHeaderTitle}>Dashboard Overview</Text>
      <Text style={styles.pageHeaderBreadcrumb}>Home / Dashboard</Text>
    </View>
    
    {/* AdminLTE Stat Row */}
    <View style={styles.infoBoxRow}>
      <InfoBox title="ACTIVE LIFECYCLES" count="5" color="#10B981" iconBg="#10B981" progressText="Validated user lifecycles" />
      <InfoBox title="SYSTEM ROLES" count="3" color="#4F46E5" iconBg="#4F46E5" progressText="Configured roles & hierarchy" />
      <InfoBox title="DEFINED PERMISSIONS" count="3" color="#3B82F6" iconBg="#3B82F6" progressText="Action / Resource permissions" />
      <InfoBox title="USER OVERRIDES" count="1" color="#EF4444" iconBg="#EF4444" progressText="Direct user-specific overrides" />
    </View>

    {/* Welcome Card */}
    <View style={styles.welcomeCard}>
      <Text style={styles.welcomeTitle}>Welcome back, Administrator!</Text>
      <Text style={styles.welcomeText}>
        This is the CMS Management Portal. Use the sidebar menu or top navbar dropdown to administer user lifecycles, configure access control settings, map roles, and customize direct permission overrides.
      </Text>
      <Text style={styles.welcomeFooter}>AdminLTE 3 Styled Panel Backend System</Text>
    </View>
  </ScrollView>
);

const SettingsPlaceholder = () => (
  <ScrollView style={styles.placeholderContainer} contentContainerStyle={styles.placeholderContent}>
    <View style={styles.pageHeaderRow}>
      <Text style={styles.pageHeaderTitle}>Global Settings</Text>
      <Text style={styles.pageHeaderBreadcrumb}>Home / Settings</Text>
    </View>

    <View style={styles.welcomeCard}>
      <Text style={styles.welcomeTitle}>⚙️ System Configuration</Text>
      <Text style={styles.welcomeText}>
        Configure API endpoints, default user registrations, and system maintenance thresholds.
      </Text>
      
      <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 8 }}>General Settings</Text>
        <Text style={{ fontSize: 13, color: '#6B7280' }}>- API Target Gateway: http://localhost:5000/api</Text>
        <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>- Default New User Status: /pending-verification</Text>
        <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>- SQLite Database Target: backend/database.sqlite</Text>
      </View>

      <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 8 }}>Access Control Engine Settings</Text>
        <Text style={{ fontSize: 13, color: '#6B7280' }}>- Policy Mode: Explicit Deny Overrides Allow</Text>
        <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>- ABAC Context Validator: Enabled (deep check)</Text>
        <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>- Inheritance Traversal: Recursive Parent Roles</Text>
      </View>
    </View>
  </ScrollView>
);

export default function AdminLayout({ currentUser, onLogout }) {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 992; // Tablet/Desktop breakpoint matching AdminLTE layouts

  const displayName = currentUser?.display_name || currentUser?.email || 'Administrator';
  const getInitials = (name) => {
    if (!name) return 'A';
    return name.split(' ').map(part => part[0]).join('').substring(0, 2).toUpperCase();
  };
  const initials = getInitials(displayName);

  // State Management
  const [activeTab, setActiveTab] = useState('statuses'); // 'dashboard', 'statuses', 'settings'
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [isAuthMenuOpen, setIsAuthMenuOpen] = useState(false);
  const [showTopNavDropdown, setShowTopNavDropdown] = useState(false);

  // Sidebar Menu list
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon, component: DashboardPlaceholder },
    { id: 'users_list', label: 'Users', icon: UsersIcon, component: UsersScreen },
    { id: 'statuses', label: 'User Status Types', icon: UsersIcon, component: UserStatusTypesScreen },
    { id: 'audit_logs', label: 'Audit Logs', icon: SettingsIcon, component: AuditLogsScreen },
    
    // Authorization sub-menu components
    { id: 'roles', label: 'Role Types', icon: UsersIcon, component: RoleTypesScreen, isSub: true },
    { id: 'actions', label: 'Action Types', icon: SettingsIcon, component: ActionTypesScreen, isSub: true },
    { id: 'resources', label: 'Resource Types', icon: UsersIcon, component: ResourceTypesScreen, isSub: true },
    { id: 'permissions', label: 'Permissions', icon: SettingsIcon, component: PermissionsScreen, isSub: true },
    { id: 'roles_list', label: 'Roles', icon: UsersIcon, component: RolesScreen, isSub: true },
    { id: 'user_roles_list', label: 'User Roles', icon: UsersIcon, component: UserRolesScreen, isSub: true },
    { id: 'role_permissions_list', label: 'Role Permissions', icon: SettingsIcon, component: RolePermissionsScreen, isSub: true },
    { id: 'user_permissions_list', label: 'User Permissions', icon: SettingsIcon, component: UserPermissionsScreen, isSub: true },
    
    { id: 'settings', label: 'Global Settings', icon: SettingsIcon, component: SettingsPlaceholder },
  ];

  const authSubMenuIds = [
    'roles',
    'actions',
    'resources',
    'permissions',
    'roles_list',
    'user_roles_list',
    'role_permissions_list',
    'user_permissions_list'
  ];

  useEffect(() => {
    if (authSubMenuIds.includes(activeTab)) {
      setIsAuthMenuOpen(true);
    }
  }, [activeTab]);

  // Filter sidebar items based on query
  const filteredMenuItems = menuItems.filter(item =>
    item.label.toLowerCase().includes(sidebarSearchQuery.toLowerCase())
  );

  const toggleSidebar = () => {
    if (isLargeScreen) {
      setIsSidebarCollapsed(!isSidebarCollapsed);
    } else {
      setIsMobileSidebarOpen(!isMobileSidebarOpen);
    }
  };

  const handleMenuSelect = (tabId) => {
    setActiveTab(tabId);
    if (!isLargeScreen) {
      setIsMobileSidebarOpen(false); // Auto close mobile drawer
    }
  };

  // Find active component to render
  const ActiveComponent = menuItems.find(item => item.id === activeTab)?.component || DashboardPlaceholder;

  // Sidebar Render Logic
  const renderSidebarContent = () => (
    <View style={styles.sidebarInner}>
      {/* Brand Header */}
      <View style={styles.brandHeader}>
        <View style={styles.brandLogoCircle}>
          <Text style={styles.brandLogoText}>C</Text>
        </View>
        {(!isSidebarCollapsed || !isLargeScreen) && (
          <Text style={styles.brandNameText}>CMS AdminLTE</Text>
        )}
      </View>

      {/* User Info panel */}
      {(!isSidebarCollapsed || !isLargeScreen) && (
        <View style={styles.sidebarUserPanel}>
          <View style={styles.userAvatarMock}>
            <Text style={styles.userAvatarInitials}>{initials}</Text>
          </View>
          <View style={styles.userPanelInfo}>
            <Text style={styles.userPanelName}>{displayName}</Text>
            <View style={styles.userOnlineRow}>
              <View style={styles.userOnlineDot} />
              <Text style={styles.userOnlineText}>{currentUser?.email || 'Authorized Operator'}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Sidebar Search */}
      {(!isSidebarCollapsed || !isLargeScreen) && (
        <View style={styles.sidebarSearchWrapper}>
          <TextInput
            style={styles.sidebarSearchInput}
            placeholder="Search menu..."
            placeholderTextColor="#9CA3AF"
            value={sidebarSearchQuery}
            onChangeText={setSidebarSearchQuery}
          />
          <SearchIcon color="#9CA3AF" size={14} />
        </View>
      )}

      {/* Sidebar Navigation Links */}
      <ScrollView style={styles.sidebarLinksScroll}>
        <Text style={[styles.sidebarGroupHeader, (isSidebarCollapsed && isLargeScreen) && { opacity: 0 }]}>
          CORE NAVIGATION
        </Text>
        
        {(() => {
          const isSearchActive = sidebarSearchQuery.trim().length > 0;
          const isAuthExpanded = isAuthMenuOpen || isSearchActive || authSubMenuIds.includes(activeTab);
          
          const matchingTopItems = filteredMenuItems.filter(item => !item.isSub);
          const matchingSubItems = filteredMenuItems.filter(item => item.isSub);
          
          const renderLinkItem = (item, isNested = false) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.id}
                className={`sidebar-link ${isNested ? 'nested-link' : ''} ${isActive ? 'sidebar-link-active' : ''}`}
                style={[
                  styles.sidebarLink,
                  isNested && styles.sidebarLinkNested,
                  isActive && styles.sidebarLinkActive,
                  (isSidebarCollapsed && isLargeScreen) && { justifyContent: 'center', paddingHorizontal: 0, marginLeft: 0 }
                ]}
                onPress={() => handleMenuSelect(item.id)}
              >
                <View style={[styles.sidebarLinkIconContainer, isNested && { width: 20 }]}>
                  <Icon color={isActive ? '#FFFFFF' : '#C2C7D0'} size={isNested ? 14 : 18} />
                </View>
                {(!isSidebarCollapsed || !isLargeScreen) && (
                  <Text style={[
                    styles.sidebarLinkLabel,
                    isActive && styles.sidebarLinkLabelActive,
                    isNested && { fontSize: 13, color: isActive ? '#FFFFFF' : '#C2C7D0' }
                  ]}>
                    {item.label}
                  </Text>
                )}
              </TouchableOpacity>
            );
          };

          return (
            <View>
              {/* Dashboard, Users, Statuses, Audit Logs links */}
              {matchingTopItems.filter(item => item.id === 'dashboard' || item.id === 'users_list' || item.id === 'statuses' || item.id === 'audit_logs').map(item => renderLinkItem(item))}
              
              {/* Collapsible Authorization Header & Nested list */}
              {((!isSearchActive && menuItems.filter(item => item.isSub).length > 0) || (isSearchActive && matchingSubItems.length > 0)) && (
                <View>
                  <TouchableOpacity
                    className="sidebar-link auth-menu-trigger"
                    style={[
                      styles.sidebarLink,
                      authSubMenuIds.includes(activeTab) && styles.sidebarLinkAuthActive,
                      (isSidebarCollapsed && isLargeScreen) && { justifyContent: 'center', paddingHorizontal: 0 }
                    ]}
                    onPress={() => setIsAuthMenuOpen(!isAuthMenuOpen)}
                  >
                    <View style={styles.sidebarLinkIconContainer}>
                      <SettingsIcon color={authSubMenuIds.includes(activeTab) ? '#FFFFFF' : '#C2C7D0'} size={18} />
                    </View>
                    {(!isSidebarCollapsed || !isLargeScreen) && (
                      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[
                          styles.sidebarLinkLabel, 
                          authSubMenuIds.includes(activeTab) && styles.sidebarLinkLabelActive,
                          { color: authSubMenuIds.includes(activeTab) ? '#FFFFFF' : '#D0D4DB' }
                        ]}>
                          Access Control
                        </Text>
                        <Text style={{ color: '#A2A7AF', fontSize: 10, marginRight: 4 }}>
                          {isAuthExpanded ? '▼' : '▶'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  
                  {isAuthExpanded && (
                    <View style={[styles.submenuContainer, (isSidebarCollapsed && isLargeScreen) && { paddingLeft: 0 }]}>
                      {matchingSubItems.map(item => renderLinkItem(item, true))}
                    </View>
                  )}
                </View>
              )}
              
              {/* General settings and others at the bottom */}
              {matchingTopItems.filter(item => item.id !== 'dashboard' && item.id !== 'users_list' && item.id !== 'statuses' && item.id !== 'audit_logs').map(item => renderLinkItem(item))}
              
              <TouchableOpacity
                className="sidebar-link signout-link"
                style={[
                  styles.sidebarLink,
                  { marginTop: 20, backgroundColor: 'rgba(239, 68, 68, 0.08)' },
                  (isSidebarCollapsed && isLargeScreen) && { justifyContent: 'center', paddingHorizontal: 0, marginLeft: 0 }
                ]}
                onPress={onLogout}
              >
                <View style={styles.sidebarLinkIconContainer}>
                  <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: 'bold' }}>⎋</Text>
                </View>
                {(!isSidebarCollapsed || !isLargeScreen) && (
                  <Text style={[styles.sidebarLinkLabel, { color: '#EF4444', fontWeight: '600' }]}>
                    Sign Out
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })()}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {Platform.OS === 'web' && (
        <style dangerouslySetInnerHTML={{__html: `
          /* Premium Animations & Style Overrides */
          .sidebar-link {
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
          }
          .dropdown-itemText {
            transition: all 0.2s ease;
          }
          .dropdown-itemText:hover {
            background-color: #EEF2FF !important;
            color: #4F46E5 !important;
            padding-left: 16px !important;
          }
          .sidebar-link:hover {
            background-color: rgba(255, 255, 255, 0.04) !important;
            transform: translateX(4px);
          }
          .nested-link {
            transition: all 0.2s ease;
          }
          .nested-link:hover {
            border-left-color: #6366F1 !important;
            color: #FFFFFF !important;
            background-color: rgba(99, 102, 241, 0.08) !important;
          }
          .sidebar-link-active {
            background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%) !important;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
          }
          .auth-menu-trigger:hover {
            background-color: rgba(255, 255, 255, 0.05) !important;
          }
          .navbar-linkText {
            transition: all 0.2s ease;
          }
          .navbar-linkText:hover {
            color: #4F46E5 !important;
            transform: translateY(-1.5px);
          }
          /* Custom sleek scrollbar for sidebar */
          ::-webkit-scrollbar {
            width: 5px;
            height: 5px;
          }
          ::-webkit-scrollbar-track {
            background: #111827;
          }
          ::-webkit-scrollbar-thumb {
            background: #374151;
            border-radius: 4px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: #4B5563;
          }
        `}} />
      )}
      <View style={styles.layoutWrapper}>
        {/* ================= SIDEBAR ================= */}
        {isLargeScreen ? (
          /* Desktop Sidebar Drawer */
          <View
            style={[
              styles.desktopSidebar,
              isSidebarCollapsed && styles.desktopSidebarCollapsed
            ]}
          >
            {renderSidebarContent()}
          </View>
        ) : (
          /* Mobile Sidebar Modal/Overlay Drawer */
          isMobileSidebarOpen && (
            <View style={styles.mobileDrawerOverlay}>
              <TouchableOpacity
                style={styles.mobileDrawerBackdrop}
                onPress={() => setIsMobileSidebarOpen(false)}
              />
              <View style={styles.mobileDrawerContent}>
                {renderSidebarContent()}
              </View>
            </View>
          )
        )}

        {/* ================= MAIN CONTAINER ================= */}
        <View style={styles.mainWrapper}>
          {/* Header/Navbar */}
          <View style={styles.navbar}>
            <View style={styles.navbarLeft}>
              <TouchableOpacity style={styles.toggleMenuButton} onPress={toggleSidebar}>
                <HamburgerIcon color="#4B5563" size={20} />
              </TouchableOpacity>
              
              {isLargeScreen && (
                <View style={styles.navbarLinksRow}>
                  <TouchableOpacity onPress={() => setActiveTab('dashboard')}>
                    <Text style={styles.navbarLinkText}>Home</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setActiveTab('users_list')}>
                    <Text style={styles.navbarLinkText}>Users</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setActiveTab('statuses')}>
                    <Text style={styles.navbarLinkText}>Statuses</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setActiveTab('audit_logs')}>
                    <Text style={[styles.navbarLinkText, activeTab === 'audit_logs' && { color: '#4F46E5', fontWeight: 'bold' }]}>
                      Audit Logs
                    </Text>
                  </TouchableOpacity>

                  {/* Access Control Dropdown Menu */}
                  <View style={{ position: 'relative', zIndex: 1000 }}>
                    <TouchableOpacity 
                      onPress={() => setShowTopNavDropdown(!showTopNavDropdown)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Text style={[
                        styles.navbarLinkText,
                        authSubMenuIds.includes(activeTab) && { color: '#4F46E5', fontWeight: 'bold' }
                      ]}>
                        Access Control
                      </Text>
                      <Text style={{ fontSize: 9, color: '#4B5563' }}>
                        {showTopNavDropdown ? '▼' : '▶'}
                      </Text>
                    </TouchableOpacity>

                    {showTopNavDropdown && (
                      <View style={styles.topNavDropdown}>
                        <TouchableOpacity style={styles.topNavDropdownItem} onPress={() => { setActiveTab('roles'); setShowTopNavDropdown(false); }}>
                          <Text className="dropdown-itemText" style={styles.topNavDropdownItemText}>Role Types</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.topNavDropdownItem} onPress={() => { setActiveTab('actions'); setShowTopNavDropdown(false); }}>
                          <Text className="dropdown-itemText" style={styles.topNavDropdownItemText}>Action Types</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.topNavDropdownItem} onPress={() => { setActiveTab('resources'); setShowTopNavDropdown(false); }}>
                          <Text className="dropdown-itemText" style={styles.topNavDropdownItemText}>Resource Types</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.topNavDropdownItem} onPress={() => { setActiveTab('permissions'); setShowTopNavDropdown(false); }}>
                          <Text className="dropdown-itemText" style={styles.topNavDropdownItemText}>Permissions</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.topNavDropdownItem} onPress={() => { setActiveTab('roles_list'); setShowTopNavDropdown(false); }}>
                          <Text className="dropdown-itemText" style={styles.topNavDropdownItemText}>Roles</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.topNavDropdownItem} onPress={() => { setActiveTab('user_roles_list'); setShowTopNavDropdown(false); }}>
                          <Text className="dropdown-itemText" style={styles.topNavDropdownItemText}>User Roles</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.topNavDropdownItem} onPress={() => { setActiveTab('role_permissions_list'); setShowTopNavDropdown(false); }}>
                          <Text className="dropdown-itemText" style={styles.topNavDropdownItemText}>Role Permissions</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.topNavDropdownItem} onPress={() => { setActiveTab('user_permissions_list'); setShowTopNavDropdown(false); }}>
                          <Text className="dropdown-itemText" style={styles.topNavDropdownItemText}>User Permissions</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity onPress={() => setActiveTab('settings')}>
                    <Text style={styles.navbarLinkText}>Settings</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.navbarRight}>
              {/* Notifications bell with badge */}
              <TouchableOpacity style={styles.notificationBellContainer}>
                <BellIcon color="#4B5563" size={20} />
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>4</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.profileActionBox} onPress={onLogout} title="Click to Sign Out">
                <View style={styles.navbarAvatarMock}>
                  <Text style={styles.navbarAvatarInitials}>{initials}</Text>
                </View>
                {isLargeScreen && (
                  <Text style={styles.navbarProfileName}>{displayName} (Sign Out)</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Content Area */}
          <View style={styles.contentBody}>
            <ActiveComponent />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Copyright © 2026 <Text style={{ fontWeight: 'bold', color: '#3C8DBC' }}>Jonikwiria CMS</Text>. All rights reserved.
            </Text>
            <Text style={styles.footerVersion}>Version 1.0.0</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F9', // AdminLTE background color
  },
  layoutWrapper: {
    flex: 1,
    flexDirection: 'row',
  },

  /* DESKTOP SIDEBAR */
  desktopSidebar: {
    width: 250,
    backgroundColor: '#111827', // Premium dark background
    borderRightWidth: 1,
    borderRightColor: '#1F2937',
    height: '100%',
  },
  desktopSidebarCollapsed: {
    width: 60,
  },
  sidebarInner: {
    flex: 1,
  },

  /* BRAND HEADER */
  brandHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#4B545C',
  },
  brandLogoCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3C8DBC', // Primary theme color
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  brandLogoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  brandNameText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '300',
    letterSpacing: 0.5,
  },

  /* USER PANEL */
  sidebarUserPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 8,
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#4B545C',
  },
  userAvatarMock: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6C757D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  userPanelInfo: {
    flex: 1,
  },
  userPanelName: {
    color: '#D0D4DB',
    fontSize: 14,
    fontWeight: '600',
  },
  userOnlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  userOnlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#28A745',
    marginRight: 6,
  },
  userOnlineText: {
    color: '#C2C7D0',
    fontSize: 11,
  },

  /* SIDEBAR SEARCH */
  sidebarSearchWrapper: {
    flexDirection: 'row',
    backgroundColor: '#3F474E',
    borderRadius: 4,
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    height: 34,
  },
  sidebarSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    height: '100%',
    padding: 0,
    outlineStyle: 'none',
  },

  /* SIDEBAR LINKS */
  sidebarLinksScroll: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 8,
  },
  sidebarGroupHeader: {
    color: '#A2A7AF',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  sidebarLink: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 4,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  sidebarLinkActive: {
    backgroundColor: '#4F46E5', // Sleek Indigo accent
  },
  sidebarLinkNested: {
    marginLeft: 12,
    paddingLeft: 8,
    borderLeftWidth: 1.5,
    borderLeftColor: '#374151',
    height: 36,
    marginBottom: 2,
  },
  sidebarLinkAuthActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  topNavDropdown: {
    position: 'absolute',
    top: 30,
    left: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 4,
    paddingVertical: 4,
    width: 180,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  topNavDropdownItem: {
    width: '100%',
  },
  topNavDropdownItemText: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#4B5563',
  },
  submenuContainer: {
    marginTop: 2,
    marginBottom: 4,
  },
  sidebarLinkIconContainer: {
    width: 28,
    alignItems: 'center',
  },
  sidebarLinkLabel: {
    color: '#C2C7D0',
    fontSize: 14,
    marginLeft: 6,
  },
  sidebarLinkLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  /* MOBILE DRAWER LAYOUT */
  mobileDrawerOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    flexDirection: 'row',
  },
  mobileDrawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  mobileDrawerContent: {
    width: 250,
    backgroundColor: '#111827',
    height: '100%',
  },

  /* MAIN WRAPPER */
  mainWrapper: {
    flex: 1,
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#F4F6F9',
  },

  /* HEADER NAVBAR */
  navbar: {
    height: 56,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#DEE2E6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  navbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleMenuButton: {
    padding: 10,
    borderRadius: 4,
  },
  navbarLinksRow: {
    flexDirection: 'row',
    marginLeft: 16,
    gap: 16,
  },
  navbarLinkText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '500',
  },
  navbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  notificationBellContainer: {
    padding: 8,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    right: 2,
    top: 2,
    backgroundColor: '#DC3545', // Danger badge
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  profileActionBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navbarAvatarMock: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007BFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  navbarAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  navbarProfileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  /* CONTENT AREA */
  contentBody: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },

  /* FOOTER */
  footer: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#DEE2E6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    flexWrap: 'wrap',
  },
  footerText: {
    fontSize: 12.5,
    color: '#6B7280',
  },
  footerVersion: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },

  /* PLACEHOLDER SCREENS LAYOUT */
  placeholderContainer: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
  placeholderContent: {
    padding: 20,
  },
  pageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    rowGap: 8,
  },
  pageHeaderTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#4B545C',
  },
  pageHeaderBreadcrumb: {
    fontSize: 13.5,
    color: '#6B7280',
  },

  /* INFO BOX CARDS (AdminLTE Style Info Boxes) */
  infoBoxRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  infoBox: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
    height: 80,
  },
  infoBoxIcon: {
    width: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBoxContent: {
    flex: 1,
    padding: 8,
    justifyContent: 'center',
  },
  infoBoxText: {
    fontSize: 11,
    color: '#6C757D',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  infoBoxNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#343A40',
    marginTop: 2,
  },
  progressContainer: {
    height: 3,
    backgroundColor: '#E5E7EB',
    borderRadius: 1.5,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 1.5,
  },
  progressDescription: {
    fontSize: 10,
    color: '#6C757D',
    marginTop: 4,
  },

  /* WELCOME CARD */
  welcomeCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 6,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 10,
  },
  welcomeText: {
    fontSize: 14.5,
    color: '#495057',
    lineHeight: 22,
  },
  welcomeFooter: {
    fontSize: 11,
    color: '#6C757D',
    fontWeight: 'bold',
    marginTop: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

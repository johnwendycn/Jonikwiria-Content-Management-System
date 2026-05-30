const app = require('./app');
const { sequelize } = require('./config/database');
const UserStatusType = require('./models/userStatusType');
const RoleType = require('./models/roleType');
const ActionType = require('./models/actionType');
const ResourceType = require('./models/resourceType');
const Permission = require('./models/permission');
const Role = require('./models/role');
const User = require('./models/user');
const UserRole = require('./models/userRole');
const RolePermission = require('./models/rolePermission');
const UserPermission = require('./models/userPermission');
const Session = require('./models/session');
const PasswordReset = require('./models/passwordReset');
const EmailVerification = require('./models/emailVerification');
const LoginAttempt = require('./models/loginAttempt');
const AuditLog = require('./models/auditLog');

// User Roles associations
User.hasMany(UserRole, { foreignKey: 'user_id', as: 'userRoles' });
Role.hasMany(UserRole, { foreignKey: 'role_id', as: 'userRoles' });
UserRole.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
UserRole.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
UserRole.belongsTo(User, { foreignKey: 'assigned_by', as: 'assigner' });

// Role Permissions associations
Role.hasMany(RolePermission, { foreignKey: 'role_id', as: 'rolePermissions' });
Permission.hasMany(RolePermission, { foreignKey: 'permission_id', as: 'rolePermissions' });
RolePermission.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
RolePermission.belongsTo(Permission, { foreignKey: 'permission_id', as: 'permission' });
RolePermission.belongsTo(User, { foreignKey: 'granted_by', as: 'granter' });

// User Permissions associations
User.hasMany(UserPermission, { foreignKey: 'user_id', as: 'userPermissions' });
Permission.hasMany(UserPermission, { foreignKey: 'permission_id', as: 'userPermissions' });
UserPermission.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
UserPermission.belongsTo(Permission, { foreignKey: 'permission_id', as: 'permission' });
UserPermission.belongsTo(User, { foreignKey: 'granted_by', as: 'granter' });

// Auth & Session associations
User.hasMany(Session, { foreignKey: 'user_id', as: 'sessions' });
Session.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(PasswordReset, { foreignKey: 'user_id', as: 'passwordResets' });
PasswordReset.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(EmailVerification, { foreignKey: 'user_id', as: 'emailVerifications' });
EmailVerification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// AuditLog associations (soft reference — actor may be deleted, log is permanent)
User.hasMany(AuditLog, { foreignKey: 'actor_id', as: 'auditLogs', constraints: false });
AuditLog.belongsTo(User, { foreignKey: 'actor_id', as: 'actor', constraints: false });

require('dotenv').config();

const PORT = process.env.PORT || 5000;

// Function to seed database with beautiful initial data if empty
async function seedDatabase() {
  try {
    // 1. Seed User Status Types
    const statusCount = await UserStatusType.count();
    if (statusCount === 0) {
      console.log('Seeding database with initial user status types...');
      const statusSeedData = [
        {
          name: 'Active',
          slug: 'active',
          description: 'User account is fully active, verified, and has standard access rights. Logins and API actions are allowed.',
          is_active_state: true,
          allows_login: true,
          allows_api_access: true,
          is_locked_state: false,
          is_terminal_state: false,
          color_class: '#10B981', // Tailwind Emerald-500
          icon_class: 'check-circle',
          sort_order: 1,
          is_system: true,
          next_allowed_statuses: []
        },
        {
          name: 'Pending Verification',
          slug: 'pending-verification',
          description: 'Account created but pending verification. User can login but cannot access protected APIs.',
          is_active_state: false,
          allows_login: true,
          allows_api_access: false,
          is_locked_state: false,
          is_terminal_state: false,
          color_class: '#F59E0B', // Tailwind Amber-500
          icon_class: 'clock',
          sort_order: 2,
          is_system: true,
          next_allowed_statuses: []
        },
        {
          name: 'Suspended',
          slug: 'suspended',
          description: 'Account temporarily suspended due to suspicious activity. Logins and API access are blocked.',
          is_active_state: false,
          allows_login: false,
          allows_api_access: false,
          is_locked_state: true,
          is_terminal_state: false,
          color_class: '#EF4444', // Tailwind Red-500
          icon_class: 'lock',
          sort_order: 3,
          is_system: false,
          next_allowed_statuses: []
        },
        {
          name: 'Banned',
          slug: 'banned',
          description: 'Permanently blocked from the platform. Terminal state. No further login or transitions allowed.',
          is_active_state: false,
          allows_login: false,
          allows_api_access: false,
          is_locked_state: true,
          is_terminal_state: true,
          color_class: '#7F1D1D', // Tailwind Red-900 (Dark Red)
          icon_class: 'x-circle',
          sort_order: 4,
          is_system: true,
          next_allowed_statuses: []
        },
        {
          name: 'Maintenance Lock',
          slug: 'maintenance-lock',
          description: 'Temporary status for account audits. Admin API access is permitted but standard logins are disabled.',
          is_active_state: true,
          allows_login: false,
          allows_api_access: true,
          is_locked_state: true,
          is_terminal_state: false,
          color_class: '#6366F1', // Tailwind Indigo-500
          icon_class: 'shield',
          sort_order: 5,
          is_system: true,
          next_allowed_statuses: []
        }
      ];

      const createdStatuses = await UserStatusType.bulkCreate(statusSeedData);
      console.log(`Database seeded with ${createdStatuses.length} initial statuses.`);
      
      const activeStatus = createdStatuses.find(s => s.slug === 'active');
      const suspendedStatus = createdStatuses.find(s => s.slug === 'suspended');
      const bannedStatus = createdStatuses.find(s => s.slug === 'banned');
      
      if (activeStatus && suspendedStatus && bannedStatus) {
        await activeStatus.update({
          next_allowed_statuses: [suspendedStatus.id, bannedStatus.id]
        });
        await suspendedStatus.update({
          next_allowed_statuses: [activeStatus.id]
        });
      }
      console.log('Transition relations configured.');
    } else {
      console.log('User status types already seeded.');
    }

    // 2. Seed Role Types
    const roleCount = await RoleType.count();
    if (roleCount === 0) {
      console.log('Seeding database with initial role types...');
      const roleSeedData = [
        {
          name: 'Super Administrator',
          slug: 'super-admin',
          description: 'Full system master access role. Hardened configuration restricted from default deletion and direct manual mapping updates.',
          is_system_role: true,
          is_assignable: false,
          is_hierarchical: true,
          allows_custom_permissions: false,
          color_class: '#7F1D1D', // Dark Red
          icon_class: 'crown',
          sort_order: 1,
          max_assignment_per_user: 1,
          auto_assign_on_register: false
        },
        {
          name: 'Administrator',
          slug: 'admin',
          description: 'General platform administrator operations. Authorized to define custom permission overrides.',
          is_system_role: true,
          is_assignable: true,
          is_hierarchical: true,
          allows_custom_permissions: true,
          color_class: '#4F46E5', // Indigo
          icon_class: 'shield',
          sort_order: 2,
          max_assignment_per_user: null,
          auto_assign_on_register: false
        },
        {
          name: 'Content Manager',
          slug: 'content-manager',
          description: 'Custom moderator role scope for auditing platform pages, comments, and resource assets.',
          is_system_role: false,
          is_assignable: true,
          is_hierarchical: false,
          allows_custom_permissions: true,
          color_class: '#10B981', // Emerald
          icon_class: 'briefcase',
          sort_order: 3,
          max_assignment_per_user: null,
          auto_assign_on_register: false
        },
        {
          name: 'Standard Subscriber',
          slug: 'standard-subscriber',
          description: 'Regular platform user. Automatically assigned upon new profile registrations.',
          is_system_role: true,
          is_assignable: true,
          is_hierarchical: false,
          allows_custom_permissions: false,
          color_class: '#6B7280', // Slate Gray
          icon_class: 'user',
          sort_order: 4,
          max_assignment_per_user: 1,
          auto_assign_on_register: true
        }
      ];

      const createdRoles = await RoleType.bulkCreate(roleSeedData);
      console.log(`Database seeded with ${createdRoles.length} initial role types.`);
    } else {
      console.log('Role types already seeded.');
    }

    // 3. Seed Action Types
    const actionCount = await ActionType.count();
    if (actionCount === 0) {
      console.log('Seeding database with initial action types...');
      const actionSeedData = [
        {
          name: 'Read Details',
          slug: 'read-details',
          verb: 'GET',
          description: 'Retrieve details for a single target resource. Low privilege, general access.',
          is_destructive: false,
          requires_owner_permission: false,
          log_level: 'info',
          color_class: '#3B82F6', // Blue
          icon_class: 'eye',
          sort_order: 1,
          is_system: true
        },
        {
          name: 'Create Record',
          slug: 'create-record',
          verb: 'POST',
          description: 'Insert a new resource record. Moderate privilege.',
          is_destructive: false,
          requires_owner_permission: false,
          log_level: 'info',
          color_class: '#10B981', // Green
          icon_class: 'plus',
          sort_order: 2,
          is_system: true
        },
        {
          name: 'Modify Settings',
          slug: 'modify-settings',
          verb: 'PUT',
          description: 'Update parameters or mappings for a resource. High privilege.',
          is_destructive: false,
          requires_owner_permission: false,
          log_level: 'warn',
          color_class: '#F59E0B', // Amber
          icon_class: 'edit',
          sort_order: 3,
          is_system: true
        },
        {
          name: 'Purge Record',
          slug: 'purge-record',
          verb: 'DELETE',
          description: 'Permanently remove a resource record. Destructive action, highest privilege, error logged.',
          is_destructive: true,
          requires_owner_permission: true,
          log_level: 'error',
          color_class: '#EF4444', // Red
          icon_class: 'trash',
          sort_order: 4,
          is_system: true
        }
      ];

      const createdActions = await ActionType.bulkCreate(actionSeedData);
      console.log(`Database seeded with ${createdActions.length} initial action types.`);
    } else {
      console.log('Action types already seeded.');
    }

    // 4. Seed Resource Types
    const resourceCount = await ResourceType.count();
    if (resourceCount === 0) {
      console.log('Seeding database with initial resource types...');
      const resourceSeedData = [
        {
          name: 'User Accounts',
          slug: 'user-accounts',
          description: 'Standard system user profile records. Supports profile ownership tracking.',
          supports_conditions: false,
          supports_ownership: true,
          supports_hierarchy: false,
          requires_approval: false,
          icon_class: 'users',
          color_class: '#4F46E5', // Indigo
          table_name: 'users',
          sort_order: 1,
          is_system: true
        },
        {
          name: 'System Logs',
          slug: 'system-logs',
          description: 'Core audit logs tracking user operations. Restricts queries using ABAC attributes.',
          supports_conditions: true,
          supports_ownership: false,
          supports_hierarchy: false,
          requires_approval: true,
          icon_class: 'list',
          color_class: '#6B7280', // Gray
          table_name: 'logs',
          sort_order: 2,
          is_system: true
        },
        {
          name: 'Page Documents',
          slug: 'page-documents',
          description: 'Auditable content articles and assets layout templates. Supports parent-child hierarchical layouts.',
          supports_conditions: true,
          supports_ownership: true,
          supports_hierarchy: true,
          requires_approval: false,
          icon_class: 'file',
          color_class: '#10B981', // Emerald
          table_name: 'pages',
          sort_order: 3,
          is_system: false
        }
      ];

      const createdResources = await ResourceType.bulkCreate(resourceSeedData);
      console.log(`Database seeded with ${createdResources.length} initial resource types.`);
    } else {
      console.log('Resource types already seeded.');
    }

    // 5. Seed Permissions
    const permissionCount = await Permission.count();
    if (permissionCount === 0) {
      console.log('Seeding database with initial permissions...');
      
      const userAccounts = await ResourceType.findOne({ where: { slug: 'user-accounts' } });
      const systemLogs = await ResourceType.findOne({ where: { slug: 'system-logs' } });
      const pageDocuments = await ResourceType.findOne({ where: { slug: 'page-documents' } });
      
      const readDetails = await ActionType.findOne({ where: { slug: 'read-details' } });
      const createRecord = await ActionType.findOne({ where: { slug: 'create-record' } });
      const purgeRecord = await ActionType.findOne({ where: { slug: 'purge-record' } });
      
      if (userAccounts && systemLogs && pageDocuments && readDetails && createRecord && purgeRecord) {
        const permissionSeedData = [
          {
            resource_type_id: userAccounts.id,
            action_type_id: readDetails.id,
            name: 'Read Details on User Accounts',
            description: 'Allows querying and viewing details of system user profiles.',
            is_conditional: false,
            is_default: true
          },
          {
            resource_type_id: pageDocuments.id,
            action_type_id: createRecord.id,
            name: 'Create Record on Page Documents',
            description: 'Allows inserting new content articles and asset layout templates.',
            is_conditional: true,
            is_default: false
          },
          {
            resource_type_id: systemLogs.id,
            action_type_id: purgeRecord.id,
            name: 'Purge Record on System Logs',
            description: 'Allows destroying system audit trails permanently.',
            is_conditional: false,
            is_default: false
          }
        ];
        
        const createdPermissions = await Permission.bulkCreate(permissionSeedData);
        console.log(`Database seeded with ${createdPermissions.length} initial permissions.`);
      } else {
        console.warn('Could not find all required action/resource seeds to create default permissions.');
      }
    } else {
      console.log('Permissions already seeded.');
    }

    // 6. Seed Roles
    const rolesCount = await Role.count();
    if (rolesCount === 0) {
      console.log('Seeding database with initial roles...');
      
      const superAdminType = await RoleType.findOne({ where: { slug: 'super-admin' } });
      const adminType = await RoleType.findOne({ where: { slug: 'admin' } });
      const subscriberType = await RoleType.findOne({ where: { slug: 'standard-subscriber' } });
      
      if (superAdminType && adminType && subscriberType) {
        // Create Superuser first
        const superuser = await Role.create({
          name: 'Superuser',
          slug: 'superuser',
          description: 'System owner root role. Fully authorized.',
          role_type_id: superAdminType.id,
          parent_role_id: null,
          is_active: true,
          is_default: false,
          priority: 100,
          metadata: { system_managed: true }
        });
        
        // Create Staff Admin referencing Superuser as parent
        await Role.create({
          name: 'Staff Admin',
          slug: 'staff-admin',
          description: 'Platform operations manager role.',
          role_type_id: adminType.id,
          parent_role_id: superuser.id,
          is_active: true,
          is_default: false,
          priority: 80,
          metadata: { allowed_departments: ['operations', 'support'] }
        });
        
        // Create General Member
        await Role.create({
          name: 'General Member',
          slug: 'general-member',
          description: 'Regular subscriber role auto-assigned to registrations.',
          role_type_id: subscriberType.id,
          parent_role_id: null,
          is_active: true,
          is_default: true,
          priority: 10,
          metadata: {}
        });
        
        console.log('Database seeded with initial roles.');
      } else {
        console.warn('Could not find all required role types to seed default roles.');
      }
    } else {
      console.log('Roles already seeded.');
    }

    // 7. Seed Users
    const usersCountSeed = await User.count();
    if (usersCountSeed === 0) {
      console.log('Seeding database with initial users...');
      const activeStatus = await UserStatusType.findOne({ where: { slug: 'active' } });
      const pendingStatus = await UserStatusType.findOne({ where: { slug: 'pending-verification' } });
      
      if (activeStatus && pendingStatus) {
        const userSeedData = [
          {
            email: 'root-administrator@system.local',
            password_hash: '$2b$10$abcdefghijklmnopqrstuv', // Dummy password hash
            display_name: 'Root Administrator',
            first_name: 'Root',
            last_name: 'Administrator',
            status_id: activeStatus.id,
            security_clearance: 100,
            department_id: null,
            cost_center: 'SYSTEM-ROOT',
            preferences: {
              language: 'en',
              timezone: 'UTC',
              theme: 'dark'
            }
          },
          {
            email: 'staff-moderator@system.local',
            password_hash: '$2b$10$abcdefghijklmnopqrstuv', // Dummy password hash
            display_name: 'Staff Moderator',
            first_name: 'Staff',
            last_name: 'Moderator',
            status_id: activeStatus.id,
            security_clearance: 50,
            department_id: null,
            cost_center: 'SYSTEM-OPS',
            preferences: {
              language: 'en',
              timezone: 'UTC',
              theme: 'light'
            }
          }
        ];
        
        const createdUsers = await User.bulkCreate(userSeedData);
        console.log(`Database seeded with ${createdUsers.length} initial users.`);
      } else {
        console.warn('Could not find active/pending statuses to seed default users.');
      }
    } else {
      console.log('Users already seeded.');
    }

    // 8. Seed User Roles Mappings
    const userRolesCountSeed = await UserRole.count();
    if (userRolesCountSeed === 0) {
      console.log('Seeding database with initial user roles assignments...');
      const rootUser = await User.findOne({ where: { email: 'root-administrator@system.local' } });
      const staffUser = await User.findOne({ where: { email: 'staff-moderator@system.local' } });
      const superuserRole = await Role.findOne({ where: { slug: 'superuser' } });
      const staffAdminRole = await Role.findOne({ where: { slug: 'staff-admin' } });

      if (rootUser && staffUser && superuserRole && staffAdminRole) {
        const userRolesSeedData = [
          {
            user_id: rootUser.id,
            role_id: superuserRole.id,
            is_active: true,
            assigned_by: rootUser.id,
            reason: 'Bootstrap system: initial superuser role mapping.'
          },
          {
            user_id: staffUser.id,
            role_id: staffAdminRole.id,
            is_active: true,
            assigned_by: rootUser.id,
            reason: 'Bootstrap system: initial staff administrator role mapping.'
          }
        ];
        const createdUserRoles = await UserRole.bulkCreate(userRolesSeedData);
        console.log(`Database seeded with ${createdUserRoles.length} initial user roles assignments.`);
      } else {
        console.warn('Could not find all required users and roles to seed assignments.');
      }
    } else {
      console.log('User roles assignments already seeded.');
    }

    // 9. Seed Role Permissions Mappings
    const rolePermissionsCountSeed = await RolePermission.count();
    if (rolePermissionsCountSeed === 0) {
      console.log('Seeding database with initial role permissions assignments...');
      const rootUser = await User.findOne({ where: { email: 'root-administrator@system.local' } });
      
      const superuserRole = await Role.findOne({ where: { slug: 'superuser' } });
      const staffAdminRole = await Role.findOne({ where: { slug: 'staff-admin' } });
      const memberRole = await Role.findOne({ where: { slug: 'general-member' } });

      const readDetailsPerm = await Permission.findOne({ where: { name: 'Read Details on User Accounts' } });
      const createRecordPerm = await Permission.findOne({ where: { name: 'Create Record on Page Documents' } });
      const purgeRecordPerm = await Permission.findOne({ where: { name: 'Purge Record on System Logs' } });

      if (superuserRole && staffAdminRole && memberRole && readDetailsPerm && createRecordPerm && purgeRecordPerm) {
        const grants = [
          // Superuser gets all permissions (Allowed, Indefinite)
          {
            role_id: superuserRole.id,
            permission_id: readDetailsPerm.id,
            is_allowed: true,
            granted_by: rootUser?.id || null,
            reason: 'Full administrative access.'
          },
          {
            role_id: superuserRole.id,
            permission_id: createRecordPerm.id,
            is_allowed: true,
            granted_by: rootUser?.id || null,
            reason: 'Full administrative access.'
          },
          {
            role_id: superuserRole.id,
            permission_id: purgeRecordPerm.id,
            is_allowed: true,
            granted_by: rootUser?.id || null,
            reason: 'Full administrative access.'
          },
          // Staff Admin gets Read Details and Create Record
          {
            role_id: staffAdminRole.id,
            permission_id: readDetailsPerm.id,
            is_allowed: true,
            granted_by: rootUser?.id || null,
            reason: 'Operations support access.'
          },
          {
            role_id: staffAdminRole.id,
            permission_id: createRecordPerm.id,
            is_allowed: true,
            granted_by: rootUser?.id || null,
            reason: 'Operations content management.'
          },
          // Staff Admin explicitly Denied Purge logs
          {
            role_id: staffAdminRole.id,
            permission_id: purgeRecordPerm.id,
            is_allowed: false, // Deny overrides Allow
            granted_by: rootUser?.id || null,
            reason: 'Explicit lock on auditing logs deletion.'
          },
          // General Member gets Read Details with ABAC condition
          {
            role_id: memberRole.id,
            permission_id: readDetailsPerm.id,
            is_allowed: true,
            conditions: { owner_only: true },
            granted_by: rootUser?.id || null,
            reason: 'Self account read-only profile access.'
          }
        ];

        const createdGrants = await RolePermission.bulkCreate(grants);
        console.log(`Database seeded with ${createdGrants.length} initial role permissions assignments.`);
      } else {
        console.warn('Could not find all required roles and permissions to seed assignments.');
      }
    } else {
      console.log('Role permissions assignments already seeded.');
    }

    // 10. Seed User Permissions Mappings
    const userPermissionsCountSeed = await UserPermission.count();
    if (userPermissionsCountSeed === 0) {
      console.log('Seeding database with initial user permissions assignments...');
      const rootUser = await User.findOne({ where: { email: 'root-administrator@system.local' } });
      const purgeRecordPerm = await Permission.findOne({ where: { name: 'Purge Record on System Logs' } });

      if (rootUser && purgeRecordPerm) {
        await UserPermission.create({
          user_id: rootUser.id,
          permission_id: purgeRecordPerm.id,
          is_allowed: false, // Deny overrides Allow
          granted_by: rootUser.id,
          reason: 'Explicit lock on auditing logs deletion.'
        });
        console.log('Database seeded with initial user permissions assignments.');
      } else {
        console.warn('Could not find root user and purge permission for user permission seeding.');
      }
    } else {
      console.log('User permissions assignments already seeded.');
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

// Sync database and start Express Server
async function startServer() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Sync schemas (creates tables if they don't exist)
    await sequelize.sync({ force: false });
    console.log('Database schemas synchronized.');

    // Seed database
    await seedDatabase();

    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 ADMIN DASHBOARD BACKEND SERVER RUNNING ON PORT ${PORT}`);
      console.log(`👉 Health check: http://localhost:${PORT}/api/health`);
      console.log(`👉 API Endpoint: http://localhost:${PORT}/api/user-status-types`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

startServer();

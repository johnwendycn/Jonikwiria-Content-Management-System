const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },

  // Event Classification
  event_type: {
    type: DataTypes.ENUM('AUTH', 'USER', 'ROLE', 'PERMISSION', 'ACCESS_CONTROL', 'SYSTEM', 'DATA'),
    allowNull: false,
    defaultValue: 'SYSTEM'
  },
  action: {
    type: DataTypes.STRING(150),
    allowNull: false,
    comment: 'Dot-notation event descriptor, e.g. session.login, user.create, role.assign'
  },
  severity: {
    type: DataTypes.ENUM('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'),
    allowNull: false,
    defaultValue: 'INFO'
  },

  // Actor Context (snapshot at event time)
  actor_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'User who triggered the event (null = system/anonymous)'
  },
  actor_email: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  actor_display_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  actor_ip: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  actor_user_agent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  actor_session_id: {
    type: DataTypes.UUID,
    allowNull: true
  },

  // Target Resource
  resource_type: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Table or domain name, e.g. users, roles, sessions'
  },
  resource_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'UUID or identifier of the target record'
  },
  resource_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Human-readable label of the resource at event time'
  },

  // HTTP Request Context
  http_method: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  http_path: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  http_status: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  duration_ms: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  // Mutation Diff
  changes_before: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'State snapshot before the mutation'
  },
  changes_after: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'State snapshot after the mutation'
  },

  // Additional Context
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Arbitrary structured context: role_id, session_id, reason, etc.'
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Error detail if the action failed'
  },
  success: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },

  // Immutable timestamp — manually managed
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'audit_logs',
  timestamps: false, // We manage created_at manually; no updated_at ever
  indexes: [
    { fields: ['event_type'] },
    { fields: ['severity'] },
    { fields: ['actor_id'] },
    { fields: ['resource_type', 'resource_id'] },
    { fields: ['action'] },
    { fields: ['created_at'] },
    { fields: ['http_status'] },
    { fields: ['success'] }
  ]
});

// ─── IMMUTABILITY ENFORCEMENT ─────────────────────────────────────────────────
// Override all mutation methods to make audit logs truly append-only.
// Not even the Super Admin can modify or delete entries through the ORM.

const IMMUTABLE_ERROR = 'IMMUTABLE: Audit log records cannot be modified or deleted. This is a permanent security constraint.';

const originalDestroy = AuditLog.prototype.destroy;
AuditLog.prototype.destroy = function () {
  throw new Error(IMMUTABLE_ERROR);
};

// Static bulk destroy override
const originalStaticDestroy = AuditLog.destroy.bind(AuditLog);
AuditLog.destroy = function () {
  throw new Error(IMMUTABLE_ERROR);
};

// Instance update override
const originalUpdate = AuditLog.prototype.update;
AuditLog.prototype.update = function () {
  throw new Error(IMMUTABLE_ERROR);
};

// Static bulk update override
AuditLog.update = function () {
  throw new Error(IMMUTABLE_ERROR);
};

// Hook-level guards as double-protection
AuditLog.addHook('beforeUpdate', () => {
  throw new Error(IMMUTABLE_ERROR);
});
AuditLog.addHook('beforeDestroy', () => {
  throw new Error(IMMUTABLE_ERROR);
});
AuditLog.addHook('beforeBulkUpdate', () => {
  throw new Error(IMMUTABLE_ERROR);
});
AuditLog.addHook('beforeBulkDestroy', () => {
  throw new Error(IMMUTABLE_ERROR);
});

module.exports = AuditLog;

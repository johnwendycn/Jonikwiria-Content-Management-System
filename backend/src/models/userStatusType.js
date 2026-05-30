const { DataTypes } = require('sequelize');
const { sequelize, isPostgres } = require('../config/database');

const nextAllowedStatusesType = isPostgres 
  ? DataTypes.ARRAY(DataTypes.UUID) 
  : DataTypes.TEXT;

const UserStatusType = sequelize.define('UserStatusType', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  slug: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Behavior flags
  is_active_state: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  allows_login: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  allows_api_access: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_locked_state: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_terminal_state: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  
  // Visual/UI
  color_class: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  icon_class: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  
  // Workflow
  next_allowed_statuses: {
    type: nextAllowedStatusesType,
    allowNull: true,
    get() {
      const val = this.getDataValue('next_allowed_statuses');
      if (!val) return [];
      if (isPostgres) {
        return Array.isArray(val) ? val : [];
      }
      try {
        return typeof val === 'string' ? JSON.parse(val) : val;
      } catch (err) {
        return [];
      }
    },
    set(val) {
      if (isPostgres) {
        this.setDataValue('next_allowed_statuses', Array.isArray(val) ? val : []);
      } else {
        this.setDataValue('next_allowed_statuses', val ? JSON.stringify(val) : JSON.stringify([]));
      }
    }
  },
  requires_reason: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  auto_transition_after: {
    type: DataTypes.STRING(100), // Supports '24 hours', '7 days', etc.
    allowNull: true
  },
  
  // Auditing
  is_system: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'user_status_types',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = UserStatusType;

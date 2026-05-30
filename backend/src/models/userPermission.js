const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserPermission = sequelize.define('UserPermission', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  permission_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'permissions',
      key: 'id'
    }
  },
  is_allowed: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  conditions: {
    type: DataTypes.JSON,
    allowNull: true,
    validate: {
      isObject(value) {
        if (value && (typeof value !== 'object' || Array.isArray(value))) {
          throw new Error('Conditions must be a JSON object.');
        }
      }
    }
  },
  valid_from: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  valid_until: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isAfterValidFrom(value) {
        if (value && this.valid_from && new Date(value) <= new Date(this.valid_from)) {
          throw new Error('valid_until must be after valid_from.');
        }
      }
    }
  },
  granted_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  granted_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'user_permissions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['permission_id']
    },
    {
      name: 'idx_user_permissions_allowed',
      fields: ['is_allowed']
    },
    {
      fields: ['valid_from', 'valid_until']
    },
    {
      fields: ['granted_by']
    },
    // Unique constraint: only one active permission per user (allow or deny)
    // where valid_until IS NULL
    {
      name: 'idx_user_permissions_unique_active',
      fields: ['user_id', 'permission_id'],
      unique: true,
      where: {
        valid_until: null
      }
    },
    // Composite check index
    {
      name: 'idx_user_permissions_check',
      fields: ['user_id', 'permission_id', 'is_allowed', 'valid_from', 'valid_until']
    }
  ]
});

module.exports = UserPermission;

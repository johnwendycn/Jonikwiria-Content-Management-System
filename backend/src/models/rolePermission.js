const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RolePermission = sequelize.define('RolePermission', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  role_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'roles',
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
  tableName: 'role_permissions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['role_id']
    },
    {
      fields: ['permission_id']
    },
    {
      name: 'idx_role_permissions_allowed',
      fields: ['is_allowed'],
      where: {
        is_allowed: true
      }
    },
    {
      fields: ['valid_from', 'valid_until']
    },
    {
      fields: ['granted_by']
    },
    // Partial unique constraint mapping idx_role_permissions_unique:
    // Uniqueness on (role_id, permission_id) when is_allowed = true and valid_until is null
    {
      name: 'idx_role_permissions_unique_active',
      fields: ['role_id', 'permission_id'],
      unique: true,
      where: {
        is_allowed: true,
        valid_until: null
      }
    }
  ]
});

module.exports = RolePermission;

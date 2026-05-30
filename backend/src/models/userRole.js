const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserRole = sequelize.define('UserRole', {
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
  role_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'roles',
      key: 'id'
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
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  assigned_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  assigned_at: {
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
  tableName: 'user_roles',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['role_id']
    },
    {
      name: 'idx_user_roles_active',
      fields: ['is_active'],
      where: {
        is_active: true
      }
    },
    {
      fields: ['valid_from', 'valid_until']
    },
    {
      fields: ['assigned_by']
    },
    // Partial unique constraint matching chk_unique_active_role:
    // Uniqueness on (user_id, role_id) when is_active = true and valid_until is null
    {
      name: 'idx_user_roles_unique_active',
      fields: ['user_id', 'role_id'],
      unique: true,
      where: {
        is_active: true,
        valid_until: null
      }
    }
  ]
});

module.exports = UserRole;

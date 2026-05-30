const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const RoleType = require('./roleType');

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  slug: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  role_type_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'role_types',
      key: 'id'
    }
  },
  parent_role_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'roles',
      key: 'id'
    },
    onDelete: 'SET NULL'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  valid_from: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  valid_until: {
    type: DataTypes.DATE,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true
  },
  updated_by: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'roles',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['role_type_id']
    },
    {
      fields: ['parent_role_id']
    },
    {
      name: 'idx_roles_active',
      fields: ['is_active'],
      where: {
        is_active: true
      }
    },
    {
      name: 'idx_roles_default',
      fields: ['is_default'],
      where: {
        is_default: true
      }
    },
    {
      fields: ['slug']
    },
    {
      fields: ['valid_from', 'valid_until']
    }
  ]
});

// Establish associations
Role.belongsTo(RoleType, { foreignKey: 'role_type_id', as: 'roleType' });
RoleType.hasMany(Role, { foreignKey: 'role_type_id', as: 'roles' });

Role.belongsTo(Role, { foreignKey: 'parent_role_id', as: 'parent', onDelete: 'SET NULL' });
Role.hasMany(Role, { foreignKey: 'parent_role_id', as: 'children' });

module.exports = Role;

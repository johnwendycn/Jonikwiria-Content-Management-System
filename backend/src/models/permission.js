const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const ResourceType = require('./resourceType');
const ActionType = require('./actionType');

const Permission = sequelize.define('Permission', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  resource_type_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'resource_types',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  action_type_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'action_types',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_conditional: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'permissions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['resource_type_id', 'action_type_id']
    },
    {
      fields: ['resource_type_id']
    },
    {
      fields: ['action_type_id']
    },
    {
      fields: ['name']
    },
    {
      name: 'idx_permissions_default',
      fields: ['is_default'],
      where: {
        is_default: true
      }
    }
  ]
});

// Establish associations
Permission.belongsTo(ResourceType, { foreignKey: 'resource_type_id', as: 'resourceType', onDelete: 'CASCADE' });
Permission.belongsTo(ActionType, { foreignKey: 'action_type_id', as: 'actionType', onDelete: 'CASCADE' });

ResourceType.hasMany(Permission, { foreignKey: 'resource_type_id', as: 'permissions' });
ActionType.hasMany(Permission, { foreignKey: 'action_type_id', as: 'permissions' });

module.exports = Permission;

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ResourceType = sequelize.define('ResourceType', {
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
  
  // Behavior flags
  supports_conditions: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  supports_ownership: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  supports_hierarchy: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  requires_approval: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  
  // UI
  icon_class: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  color_class: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  table_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  
  // Metadata
  is_system: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'resource_types',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = ResourceType;

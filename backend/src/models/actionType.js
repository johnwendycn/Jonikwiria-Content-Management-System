const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ActionType = sequelize.define('ActionType', {
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
  verb: {
    type: DataTypes.STRING(20), // GET, POST, PUT, DELETE, PATCH
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Behavior flags
  is_destructive: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  requires_owner_permission: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  log_level: {
    type: DataTypes.STRING(20), // 'info', 'warn', 'error'
    defaultValue: 'info'
  },
  
  // UI
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  icon_class: {
    type: DataTypes.STRING(50),
    allowNull: true
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
  tableName: 'action_types',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = ActionType;

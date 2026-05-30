const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RoleType = sequelize.define('RoleType', {
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
  
  // Behavioral flags
  is_system_role: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_assignable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  is_hierarchical: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  allows_custom_permissions: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  
  // UI/Display
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
  
  // Constraints
  max_assignment_per_user: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  auto_assign_on_register: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  
  // Auditing
  created_by: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'role_types',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = RoleType;

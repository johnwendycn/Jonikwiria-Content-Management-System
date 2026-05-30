const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PasswordReset = sequelize.define('PasswordReset', {
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
  token_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  used_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'password_resets',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['token_hash'],
      unique: true
    }
  ]
});

module.exports = PasswordReset;

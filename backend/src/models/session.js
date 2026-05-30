const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Session = sequelize.define('Session', {
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
  ip_address: {
    type: DataTypes.STRING,
    allowNull: false
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  payload: {
    type: DataTypes.JSON,
    allowNull: true
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  last_activity: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  is_revoked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'sessions',
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
    },
    {
      fields: ['expires_at']
    }
  ]
});

module.exports = Session;

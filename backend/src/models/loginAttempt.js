const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LoginAttempt = sequelize.define('LoginAttempt', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  ip_address: {
    type: DataTypes.STRING,
    allowNull: false
  },
  was_successful: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  attempted_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'login_attempts',
  timestamps: false, // Explicitly no standard createdAt/updatedAt, we use attempted_at
  indexes: [
    {
      fields: ['email']
    },
    {
      fields: ['ip_address']
    },
    {
      fields: ['attempted_at']
    }
  ]
});

module.exports = LoginAttempt;

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const UserStatusType = require('./userStatusType');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: {
        msg: 'Please enter a valid email address.'
      }
    }
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Password hash cannot be empty.'
      }
    }
  },
  salt: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  display_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  first_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  last_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  avatar_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'user_status_types',
      key: 'id'
    }
  },
  status_reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  locked_until: {
    type: DataTypes.DATE,
    allowNull: true
  },
  failed_login_attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  last_failed_login_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_login_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_login_ip: {
    type: DataTypes.STRING,
    allowNull: true
  },
  last_password_change: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  mfa_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  mfa_secret: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  mfa_backup_codes: {
    type: DataTypes.JSON,
    allowNull: true
  },
  email_verified_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  phone_verified_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  current_session_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  max_concurrent_sessions: {
    type: DataTypes.INTEGER,
    defaultValue: 5
  },
  allowed_ips: {
    type: DataTypes.JSON,
    allowNull: true
  },
  allowed_devices: {
    type: DataTypes.JSON,
    allowNull: true
  },
  department_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  cost_center: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  security_clearance: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  geo_restrictions: {
    type: DataTypes.JSON,
    allowNull: true
  },
  preferences: {
    type: DataTypes.JSON,
    defaultValue: {
      language: 'en',
      timezone: 'UTC',
      theme: 'light'
    }
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  updated_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
  paranoid: true, // Enables soft deletes
  indexes: [
    {
      fields: ['email'],
      unique: true
    },
    {
      fields: ['status_id']
    },
    {
      fields: ['email', 'status_id']
    },
    {
      fields: ['department_id']
    },
    {
      fields: ['security_clearance']
    },
    {
      fields: ['last_login_at']
    }
  ]
});

// Associations
User.belongsTo(UserStatusType, { foreignKey: 'status_id', as: 'statusType' });
UserStatusType.hasMany(User, { foreignKey: 'status_id', as: 'users' });

User.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });

module.exports = User;

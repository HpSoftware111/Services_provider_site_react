const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PhoneVerification = sequelize.define('PhoneVerification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  code: {
    type: DataTypes.STRING(6),
    allowNull: false
  },
  verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'phone_verifications',
  timestamps: true,
  indexes: [
    {
      fields: ['userId', 'phone']
    },
    {
      fields: ['code']
    }
  ]
});

module.exports = PhoneVerification;

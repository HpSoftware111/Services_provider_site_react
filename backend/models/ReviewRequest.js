const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ReviewRequest = sequelize.define('ReviewRequest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  businessId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  customerEmail: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  customerName: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'completed', 'expired'),
    defaultValue: 'pending'
  },
  token: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true
  },
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  requestedBy: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'review_requests',
  timestamps: true
});

module.exports = ReviewRequest;


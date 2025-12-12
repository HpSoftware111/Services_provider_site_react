const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Lead = sequelize.define('Lead', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    customerId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    businessId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    providerId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    serviceType: {
        type: DataTypes.STRING(120),
        allowNull: false
    },
    categoryId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    locationCity: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    locationState: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    locationPostalCode: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    budgetRange: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    preferredContact: {
        type: DataTypes.ENUM('email', 'phone', 'either'),
        allowNull: true
    },
    customerName: {
        type: DataTypes.STRING(120),
        allowNull: true
    },
    customerEmail: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    customerPhone: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    membershipTierRequired: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('submitted', 'routed', 'accepted', 'rejected', 'cancelled'),
        allowNull: true
    },
    stripePaymentIntentId: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    leadCost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    statusHistory: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    metadata: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    routedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'leads',
    timestamps: true
});

module.exports = Lead;


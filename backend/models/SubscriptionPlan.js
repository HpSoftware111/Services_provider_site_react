const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SubscriptionPlan = sequelize.define('SubscriptionPlan', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: { msg: 'Plan name is required' }
        }
    },
    tier: {
        type: DataTypes.ENUM('BASIC', 'PRO', 'PREMIUM'),
        allowNull: false,
        unique: true
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: { args: [0], msg: 'Price must be non-negative' }
        }
    },
    billingCycle: {
        type: DataTypes.ENUM('MONTHLY', 'YEARLY'),
        allowNull: false,
        defaultValue: 'MONTHLY'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    features: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    displayOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    leadDiscountPercent: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: 0,
        validate: {
            min: { args: [0], msg: 'Lead discount percent must be non-negative' },
            max: { args: [100], msg: 'Lead discount percent cannot exceed 100' }
        }
    },
    priorityBoostPoints: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        validate: {
            min: { args: [0], msg: 'Priority boost points must be non-negative' }
        }
    },
    isFeatured: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    hasAdvancedAnalytics: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'subscription_plans',
    timestamps: true
});

module.exports = SubscriptionPlan;

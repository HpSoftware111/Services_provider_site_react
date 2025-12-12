const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserSubscription = sequelize.define('UserSubscription', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
    },
    subscriptionPlanId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('ACTIVE', 'CANCELLED', 'EXPIRED', 'TRIAL'),
        defaultValue: 'ACTIVE'
    },
    stripeSubscriptionId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true
    },
    stripeCustomerId: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    currentPeriodStart: {
        type: DataTypes.DATE,
        allowNull: true
    },
    currentPeriodEnd: {
        type: DataTypes.DATE,
        allowNull: true
    },
    cancelledAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    trialEndsAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'user_subscriptions',
    timestamps: true
});

module.exports = UserSubscription;



const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const NotificationPreference = sequelize.define('NotificationPreference', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        comment: 'User ID (references users.id)'
    },
    emailEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Enable/disable email notifications'
    },
    pushEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Enable/disable push notifications'
    },
    smsEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Enable/disable SMS notifications'
    },
    // Per-type preferences
    requestCreated: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    newLead: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    leadAccepted: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    leadPaymentFailed: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    leadMovedToAlternative: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    noProviderAvailable: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    newProposal: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    proposalAccepted: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    workCompleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    reviewRequest: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    reviewPosted: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    unsubscribeToken: {
        type: DataTypes.STRING(100),
        allowNull: true,
        unique: true,
        comment: 'Unique token for unsubscribe links'
    }
}, {
    tableName: 'notification_preferences',
    timestamps: true,
    indexes: [
        {
            fields: ['userId']
        },
        {
            fields: ['unsubscribeToken']
        }
    ]
});

module.exports = NotificationPreference;


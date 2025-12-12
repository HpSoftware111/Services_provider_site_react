const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const NotificationAudit = sequelize.define('NotificationAudit', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'User who should receive the notification'
    },
    type: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Notification type: request_created, new_lead, lead_accepted, etc.'
    },
    recipientEmail: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    subject: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('pending', 'sent', 'failed', 'retrying'),
        defaultValue: 'pending'
    },
    retryCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    maxRetries: {
        type: DataTypes.INTEGER,
        defaultValue: 3
    },
    errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    metadata: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'JSON string with additional context (projectTitle, providerName, etc.)'
    },
    sentAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    provider: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Email provider used: nodemailer, sendgrid, mailgun, ses'
    }
}, {
    tableName: 'notification_audit',
    timestamps: true,
    indexes: [
        {
            fields: ['userId']
        },
        {
            fields: ['type']
        },
        {
            fields: ['status']
        },
        {
            fields: ['recipientEmail']
        }
    ]
});

module.exports = NotificationAudit;


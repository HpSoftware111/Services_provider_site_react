const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Proposal = sequelize.define('Proposal', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    serviceRequestId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    providerId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    details: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('SENT', 'ACCEPTED', 'REJECTED'),
        defaultValue: 'SENT'
    },
    stripePaymentIntentId: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    paymentStatus: {
        type: DataTypes.ENUM('pending', 'succeeded', 'failed'),
        defaultValue: 'pending',
        allowNull: true
    },
    paidAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    providerPayoutAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    platformFeeAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    payoutStatus: {
        type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
        defaultValue: 'pending',
        allowNull: true
    },
    payoutProcessedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    stripeTransferId: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    rejectionReason: {
        type: DataTypes.ENUM('TOO_FAR', 'TOO_EXPENSIVE', 'NOT_RELEVANT', 'OTHER'),
        allowNull: true
    },
    rejectionReasonOther: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'proposals',
    timestamps: true
});

module.exports = Proposal;


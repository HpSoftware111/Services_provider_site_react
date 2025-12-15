const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ServiceRequest = sequelize.define('ServiceRequest', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    customerId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    categoryId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    subCategoryId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    zipCode: {
        type: DataTypes.STRING(10),
        allowNull: false
    },
    projectTitle: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Project title is required' }
        }
    },
    projectDescription: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Project description is required' }
        }
    },
    attachments: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
    },
    preferredDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    preferredTime: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM(
            'REQUEST_CREATED',
            'LEAD_ASSIGNED',
            'IN_PROGRESS',
            'COMPLETED',
            'APPROVED',
            'CLOSED',
            'CANCELLED_BY_CUSTOMER'
        ),
        defaultValue: 'REQUEST_CREATED'
    },
    primaryProviderId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    selectedBusinessIds: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
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
    tableName: 'service_requests',
    timestamps: true
});

module.exports = ServiceRequest;


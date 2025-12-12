const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WorkOrder = sequelize.define('WorkOrder', {
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
    status: {
        type: DataTypes.ENUM('IN_PROGRESS', 'COMPLETED'),
        defaultValue: 'IN_PROGRESS'
    },
    completedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'work_orders',
    timestamps: true
});

module.exports = WorkOrder;


const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ServiceCategory = sequelize.define('ServiceCategory', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Category name is required' }
        }
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    icon: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'tools'
    }
}, {
    tableName: 'service_categories',
    timestamps: true
});

module.exports = ServiceCategory;


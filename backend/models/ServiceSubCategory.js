const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ServiceSubCategory = sequelize.define('ServiceSubCategory', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    categoryId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Subcategory name is required' }
        }
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'service_subcategories',
    timestamps: true
});

module.exports = ServiceSubCategory;


const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BusinessSubCategory = sequelize.define('BusinessSubCategory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  businessId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'businesses',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  subCategoryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'subcategories',
      key: 'id'
    },
    onDelete: 'CASCADE'
  }
}, {
  tableName: 'business_subcategories',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['businessId', 'subCategoryId'],
      name: 'unique_business_subcategory'
    },
    {
      fields: ['businessId']
    },
    {
      fields: ['subCategoryId']
    }
  ]
});

module.exports = BusinessSubCategory;


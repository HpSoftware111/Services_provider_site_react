const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProviderProfile = sequelize.define('ProviderProfile', {
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
    // NOTE: Do NOT use serviceCategories, serviceSubCategories, zipCodesCovered JSON columns
    // Instead, use proper relational tables:
    // - Categories/SubCategories: via Business table (Business belongsTo Category/SubCategory)
    // - ZipCodes: via Business table or a separate junction table
    status: {
        type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
        defaultValue: 'ACTIVE'
    },
    ratingAverage: {
        type: DataTypes.DECIMAL(3, 2),
        defaultValue: 0,
        validate: {
            min: 0,
            max: 5
        }
    },
    ratingCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'provider_profiles',
    timestamps: true,
    // Define default scope to ensure non-existent columns are never selected
    defaultScope: {
        attributes: {
            exclude: ['serviceCategories', 'serviceSubCategories', 'zipCodesCovered']
        }
    }
});

module.exports = ProviderProfile;


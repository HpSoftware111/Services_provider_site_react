const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AlternativeProviderSelection = sequelize.define('AlternativeProviderSelection', {
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
    position: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
            max: 3
        }
    }
}, {
    tableName: 'alternative_provider_selections',
    timestamps: true
});

module.exports = AlternativeProviderSelection;


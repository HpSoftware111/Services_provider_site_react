const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ZipCode = sequelize.define('ZipCode', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    code: {
        type: DataTypes.STRING(10),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: { msg: 'Zip code is required' }
        }
    },
    city: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    state: {
        type: DataTypes.STRING(50),
        allowNull: false
    }
}, {
    tableName: 'zip_codes',
    timestamps: true
});

module.exports = ZipCode;


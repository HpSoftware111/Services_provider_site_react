const { sequelize } = require('../config/database');
require('dotenv').config();

const addSelectedBusinessesColumn = async () => {
    try {
        console.log('🔧 Adding selectedBusinessIds column to service_requests table...\n');

        await sequelize.authenticate();
        console.log('✅ Database connected\n');

        // Add selectedBusinessIds column
        await sequelize.query(`
            ALTER TABLE service_requests 
            ADD COLUMN selectedBusinessIds JSON NULL DEFAULT (JSON_ARRAY()) AFTER primaryProviderId
        `);

        console.log('✅ selectedBusinessIds column added successfully!\n');
        process.exit(0);
    } catch (error) {
        if (error.original && error.original.code === 'ER_DUP_FIELDNAME') {
            console.log('ℹ️  selectedBusinessIds column already exists, skipping...\n');
            process.exit(0);
        } else {
            console.error('❌ Error adding selectedBusinessIds column:', error.message);
            process.exit(1);
        }
    }
};

addSelectedBusinessesColumn();


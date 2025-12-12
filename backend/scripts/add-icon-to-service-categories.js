const { sequelize } = require('../config/database');
require('dotenv').config();

const addIconColumn = async () => {
    try {
        console.log('🔧 Adding icon column to service_categories table...\n');

        await sequelize.authenticate();
        console.log('✅ Database connected\n');

        // Add icon column
        await sequelize.query(`
            ALTER TABLE service_categories 
            ADD COLUMN icon VARCHAR(50) NULL DEFAULT 'tools' AFTER description
        `);

        console.log('✅ Icon column added successfully!\n');
        process.exit(0);
    } catch (error) {
        if (error.original && error.original.code === 'ER_DUP_FIELDNAME') {
            console.log('ℹ️  Icon column already exists, skipping...\n');
            process.exit(0);
        } else {
            console.error('❌ Error adding icon column:', error.message);
            process.exit(1);
        }
    }
};

addIconColumn();


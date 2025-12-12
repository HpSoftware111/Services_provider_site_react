/**
 * Migration script to add metadata column to reviews table
 * This allows storing serviceRequestId in review metadata
 */

const { sequelize } = require('../config/database');

async function addMetadataColumn() {
    try {
        console.log('Adding metadata column to reviews table...');

        // Check if column already exists
        const [results] = await sequelize.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'reviews' 
            AND COLUMN_NAME = 'metadata'
        `);

        if (results.length > 0) {
            console.log('✅ metadata column already exists in reviews table');
            return;
        }

        // Add metadata column
        await sequelize.query(`
            ALTER TABLE reviews 
            ADD COLUMN metadata TEXT NULL AFTER isReported
        `);

        console.log('✅ Successfully added metadata column to reviews table');
    } catch (error) {
        console.error('❌ Error adding metadata column:', error.message);
        throw error;
    }
}

// Run migration
if (require.main === module) {
    addMetadataColumn()
        .then(() => {
            console.log('Migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = addMetadataColumn;


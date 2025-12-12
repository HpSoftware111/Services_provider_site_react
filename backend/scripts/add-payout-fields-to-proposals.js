/**
 * Migration script to add payout fields to proposals table
 */

const { sequelize } = require('../config/database');

async function addPayoutFields() {
    try {
        console.log('Adding payout fields to proposals table...');

        // Check if columns already exist
        const [results] = await sequelize.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'proposals' 
            AND COLUMN_NAME IN ('providerPayoutAmount', 'platformFeeAmount', 'payoutStatus', 'payoutProcessedAt', 'stripeTransferId')
        `);

        const existingColumns = results.map(r => r.COLUMN_NAME);
        const columnsToAdd = [];

        if (!existingColumns.includes('providerPayoutAmount')) {
            columnsToAdd.push('ADD COLUMN providerPayoutAmount DECIMAL(10, 2) NULL AFTER price');
        }
        if (!existingColumns.includes('platformFeeAmount')) {
            columnsToAdd.push('ADD COLUMN platformFeeAmount DECIMAL(10, 2) NULL AFTER providerPayoutAmount');
        }
        if (!existingColumns.includes('payoutStatus')) {
            columnsToAdd.push("ADD COLUMN payoutStatus ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending' AFTER paymentStatus");
        }
        if (!existingColumns.includes('payoutProcessedAt')) {
            columnsToAdd.push('ADD COLUMN payoutProcessedAt DATETIME NULL AFTER paidAt');
        }
        if (!existingColumns.includes('stripeTransferId')) {
            columnsToAdd.push('ADD COLUMN stripeTransferId VARCHAR(255) NULL AFTER stripePaymentIntentId');
        }

        if (columnsToAdd.length === 0) {
            console.log('✅ All payout fields already exist in proposals table');
            return;
        }

        // Add columns
        await sequelize.query(`
            ALTER TABLE proposals 
            ${columnsToAdd.join(', ')}
        `);

        console.log('✅ Successfully added payout fields to proposals table');
    } catch (error) {
        console.error('❌ Error adding payout fields:', error.message);
        throw error;
    }
}

// Run migration
if (require.main === module) {
    addPayoutFields()
        .then(() => {
            console.log('Migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = addPayoutFields;


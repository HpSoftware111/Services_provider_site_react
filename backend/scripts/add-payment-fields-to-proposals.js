require('dotenv').config();
const { sequelize } = require('../config/database');

async function addPaymentFields() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected\n');

        console.log('Adding payment fields to proposals table...\n');

        // Check if columns already exist
        const [existingColumns] = await sequelize.query(`
            SELECT COLUMN_NAME 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'proposals'
            AND COLUMN_NAME IN ('stripePaymentIntentId', 'paymentStatus', 'paidAt')
        `);

        const existingColumnNames = existingColumns.map(col => col.COLUMN_NAME);

        // Add stripePaymentIntentId if it doesn't exist
        if (!existingColumnNames.includes('stripePaymentIntentId')) {
            await sequelize.query(`
                ALTER TABLE proposals 
                ADD COLUMN stripePaymentIntentId VARCHAR(255) NULL
            `);
            console.log('✅ Added stripePaymentIntentId column');
        } else {
            console.log('ℹ️  stripePaymentIntentId column already exists');
        }

        // Add paymentStatus if it doesn't exist
        if (!existingColumnNames.includes('paymentStatus')) {
            await sequelize.query(`
                ALTER TABLE proposals 
                ADD COLUMN paymentStatus ENUM('pending', 'succeeded', 'failed') DEFAULT 'pending'
            `);
            console.log('✅ Added paymentStatus column');
        } else {
            console.log('ℹ️  paymentStatus column already exists');
        }

        // Add paidAt if it doesn't exist
        if (!existingColumnNames.includes('paidAt')) {
            await sequelize.query(`
                ALTER TABLE proposals 
                ADD COLUMN paidAt DATETIME NULL
            `);
            console.log('✅ Added paidAt column');
        } else {
            console.log('ℹ️  paidAt column already exists');
        }

        console.log('\n✅ Migration completed successfully!');
        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration error:', error.message);
        if (error.stack) console.error(error.stack);
        await sequelize.close().catch(() => { });
        process.exit(1);
    }
}

addPaymentFields();


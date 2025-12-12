require('dotenv').config();
const { sequelize } = require('../config/database');

async function addLeadPaymentFields() {
    const queryInterface = sequelize.getQueryInterface();

    try {
        console.log('🌱 Adding payment fields to leads table...\n');

        // Test connection
        await sequelize.authenticate();
        console.log('✅ Database connected\n');

        // Check if leads table exists
        try {
            await queryInterface.describeTable('leads');
        } catch (error) {
            console.error('❌ Error: Leads table does not exist.');
            await sequelize.close();
            process.exit(1);
        }

        const tableDescription = await queryInterface.describeTable('leads');
        const fieldsToAdd = [];

        // Check and add stripePaymentIntentId
        if (!tableDescription.stripePaymentIntentId) {
            fieldsToAdd.push({
                name: 'stripePaymentIntentId',
                type: 'VARCHAR(255)',
                nullable: 'NULL',
                after: 'status'
            });
        }

        // Check and add leadCost
        if (!tableDescription.leadCost) {
            fieldsToAdd.push({
                name: 'leadCost',
                type: 'DECIMAL(10,2)',
                nullable: 'NULL',
                after: 'stripePaymentIntentId'
            });
        }

        if (fieldsToAdd.length === 0) {
            console.log('✅ All payment fields already exist in leads table\n');
            await sequelize.close();
            return;
        }

        // Add fields
        for (const field of fieldsToAdd) {
            try {
                await queryInterface.addColumn('leads', field.name, {
                    type: sequelize.Sequelize[field.type.includes('VARCHAR') ? 'STRING' : 'DECIMAL'](field.type.includes('VARCHAR') ? 255 : [10, 2]),
                    allowNull: true
                });
                console.log(`✅ Added column: ${field.name}`);
            } catch (error) {
                if (error.message.includes('Duplicate column')) {
                    console.log(`⚠️  Column ${field.name} already exists, skipping...`);
                } else {
                    throw error;
                }
            }
        }

        console.log('\n✅ Migration completed successfully!\n');
        await sequelize.close();
    } catch (error) {
        console.error('❌ Migration failed:', error);
        await sequelize.close();
        process.exit(1);
    }
}

// Run migration
addLeadPaymentFields();


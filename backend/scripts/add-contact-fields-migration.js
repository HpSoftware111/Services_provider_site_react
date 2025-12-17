/**
 * Migration script to add phone and businessId columns to contacts table
 * This allows storing phone numbers and linking contacts to businesses
 */

require('dotenv').config();
const { sequelize } = require('../config/database');

async function addContactFields() {
  try {
    console.log('🚀 Starting contact fields migration...\n');

    // Test connection first
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    const queryInterface = sequelize.getQueryInterface();
    const tableDescription = await queryInterface.describeTable('contacts');

    // Add phone column
    if (!tableDescription.phone) {
      console.log('Adding phone column to contacts table...');
      await sequelize.query(`
        ALTER TABLE contacts 
        ADD COLUMN phone VARCHAR(20) NULL AFTER email
      `);
      console.log('✅ Added phone column\n');
    } else {
      console.log('⚠️  phone column already exists\n');
    }

    // Add businessId column
    if (!tableDescription.businessId) {
      console.log('Adding businessId column to contacts table...');
      await sequelize.query(`
        ALTER TABLE contacts 
        ADD COLUMN businessId INT NULL AFTER message,
        ADD FOREIGN KEY (businessId) REFERENCES businesses(id) ON DELETE SET NULL
      `);
      console.log('✅ Added businessId column with foreign key\n');
    } else {
      console.log('⚠️  businessId column already exists\n');
    }

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Error during migration:', error.message);
    if (error.message.includes('Duplicate column')) {
      console.log('⚠️  Some columns may already exist. Migration skipped.');
    } else {
      throw error;
    }
  } finally {
    await sequelize.close();
  }
}

// Run migration
if (require.main === module) {
  addContactFields()
    .then(() => {
      console.log('\n✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = addContactFields;


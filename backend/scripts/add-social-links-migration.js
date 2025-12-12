const { sequelize } = require('../config/database');
const { QueryInterface } = require('sequelize');

async function migrate() {
  try {
    console.log('Running migration: Add socialLinks column to businesses table...');
    
    const queryInterface = sequelize.getQueryInterface();
    
    // Check if column already exists
    const tableDesc = await queryInterface.describeTable('businesses');
    
    if (!tableDesc.socialLinks) {
      await queryInterface.addColumn('businesses', 'socialLinks', {
        type: sequelize.Sequelize.JSON,
        allowNull: true,
        defaultValue: {}
      });
      console.log('✓ Added socialLinks column to businesses table');
    } else {
      console.log('✓ socialLinks column already exists');
    }
    
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();


const { sequelize } = require('../config/database');

async function migrate() {
  try {
    console.log('Running migration: Add rejectionReason and rejectedAt columns to businesses table...');
    
    const queryInterface = sequelize.getQueryInterface();
    
    // Check if columns already exist
    const tableDesc = await queryInterface.describeTable('businesses');
    
    if (!tableDesc.rejectionReason) {
      await queryInterface.addColumn('businesses', 'rejectionReason', {
        type: sequelize.Sequelize.TEXT,
        allowNull: true
      });
      console.log('✓ Added rejectionReason column to businesses table');
    } else {
      console.log('✓ rejectionReason column already exists');
    }
    
    if (!tableDesc.rejectedAt) {
      await queryInterface.addColumn('businesses', 'rejectedAt', {
        type: sequelize.Sequelize.DATE,
        allowNull: true
      });
      console.log('✓ Added rejectedAt column to businesses table');
    } else {
      console.log('✓ rejectedAt column already exists');
    }
    
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();


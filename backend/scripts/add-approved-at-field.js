const { sequelize } = require('../config/database');

async function addApprovedAtField() {
  try {
    console.log('🔄 Adding approvedAt field to businesses table...');
    
    // Check if column already exists
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'businesses' 
      AND COLUMN_NAME = 'approvedAt'
    `);

    if (results.length > 0) {
      console.log('✅ approvedAt field already exists');
      process.exit(0);
    }

    // Add the column
    await sequelize.query(`
      ALTER TABLE businesses 
      ADD COLUMN approvedAt DATETIME NULL AFTER rejectedAt
    `);

    console.log('✅ Successfully added approvedAt field to businesses table');
    
    // Update existing approved businesses (isActive = true and isVerified = true)
    await sequelize.query(`
      UPDATE businesses 
      SET approvedAt = updatedAt 
      WHERE isActive = 1 AND isVerified = 1 AND approvedAt IS NULL
    `);

    console.log('✅ Updated existing approved businesses with approvedAt timestamp');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding approvedAt field:', error);
    process.exit(1);
  }
}

addApprovedAtField();


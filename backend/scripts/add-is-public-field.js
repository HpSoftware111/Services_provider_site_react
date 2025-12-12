const { sequelize } = require('../config/database');

async function addIsPublicField() {
  try {
    // Check if column already exists
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'businesses' 
      AND COLUMN_NAME = 'isPublic'
    `);

    if (results.length === 0) {
      // Column doesn't exist, add it
      await sequelize.query(`
        ALTER TABLE businesses 
        ADD COLUMN isPublic BOOLEAN DEFAULT true;
      `);
      console.log('✅ Added isPublic field to businesses table');
    } else {
      console.log('✅ isPublic field already exists in businesses table');
    }
  } catch (error) {
    console.error('❌ Error adding isPublic field:', error);
  }
}

addIsPublicField().then(() => {
  process.exit(0);
});


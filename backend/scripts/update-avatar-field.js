require('dotenv').config();
const { sequelize } = require('../config/database');

async function updateAvatarField() {
  try {
    console.log('🌱 Updating avatar field to support larger images...\n');

    // Test connection first
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Check if avatar column exists
    const queryInterface = sequelize.getQueryInterface();
    const tableDescription = await queryInterface.describeTable('users');
    
    if (!tableDescription.avatar) {
      console.log('⚠️  Avatar column does not exist. Creating it...');
      await sequelize.query(`
        ALTER TABLE users 
        ADD COLUMN avatar LONGTEXT NULL
      `);
      console.log('✓ Avatar column created\n');
    } else {
      console.log('Updating existing avatar column...');
      
      // Change avatar column to LONGTEXT
      await sequelize.query(`
        ALTER TABLE users 
        MODIFY COLUMN avatar LONGTEXT NULL
      `);
      
      console.log('✓ Avatar field updated\n');
    }

    console.log('✅ Avatar field update completed successfully!');
    console.log('   - Avatar can now store large base64 images');
    console.log('   - You can now upload profile photos without errors\n');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    if (error.parent) {
      console.error('   Details:', error.parent.message);
    }
    
    if (error.message.includes("doesn't exist") || error.message.includes('Unknown column')) {
      console.log('\n💡 Note: Avatar column might not exist yet.');
      console.log('   The script will create it automatically.\n');
    }
    
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
}

updateAvatarField();


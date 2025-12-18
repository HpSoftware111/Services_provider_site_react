const { sequelize } = require('../config/database');

async function addColumns() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database');
    
    // Add logo column
    try {
      await sequelize.query('ALTER TABLE businesses ADD COLUMN logo LONGTEXT');
      console.log('Added logo column');
    } catch (e) {
      console.log('logo column already exists or error:', e.message);
    }
    
    // Add verificationMethod column
    try {
      await sequelize.query("ALTER TABLE businesses ADD COLUMN verificationMethod ENUM('none', 'google', 'facebook', 'document', 'phone') DEFAULT 'none'");
      console.log('Added verificationMethod column');
    } catch (e) {
      console.log('verificationMethod column already exists or error:', e.message);
    }
    
    // Add verificationData column
    try {
      await sequelize.query('ALTER TABLE businesses ADD COLUMN verificationData JSON');
      console.log('Added verificationData column');
    } catch (e) {
      console.log('verificationData column already exists or error:', e.message);
    }
    
    // Add verificationRequestedAt column
    try {
      await sequelize.query('ALTER TABLE businesses ADD COLUMN verificationRequestedAt DATETIME');
      console.log('Added verificationRequestedAt column');
    } catch (e) {
      console.log('verificationRequestedAt column already exists or error:', e.message);
    }
    
    // Add verificationStatus column
    try {
      await sequelize.query("ALTER TABLE businesses ADD COLUMN verificationStatus ENUM('none', 'pending', 'approved', 'rejected') DEFAULT 'none'");
      console.log('Added verificationStatus column');
    } catch (e) {
      console.log('verificationStatus column already exists or error:', e.message);
    }
    
    // Add services column
    try {
      await sequelize.query('ALTER TABLE businesses ADD COLUMN services JSON DEFAULT (JSON_ARRAY())');
      console.log('Added services column');
    } catch (e) {
      console.log('services column already exists or error:', e.message);
    }
    
    console.log('\nDone!');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

addColumns();


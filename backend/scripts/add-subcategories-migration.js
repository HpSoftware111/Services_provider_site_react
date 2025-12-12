/**
 * Migration script to add subcategories table and related fields
 * Run with: node scripts/add-subcategories-migration.js
 */

require('dotenv').config();
const { sequelize } = require('../config/database');

async function runMigration() {
  try {
    console.log('🚀 Starting migration...\n');

    // Create subcategories table
    console.log('Creating subcategories table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS subcategories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) NOT NULL,
        categoryId INT NOT NULL,
        icon VARCHAR(50) DEFAULT 'folder',
        description TEXT,
        isActive BOOLEAN DEFAULT TRUE,
        \`order\` INT DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Subcategories table created\n');

    // Add subCategoryId to businesses table
    console.log('Adding subCategoryId to businesses table...');
    try {
      await sequelize.query(`
        ALTER TABLE businesses ADD COLUMN subCategoryId INT DEFAULT NULL
      `);
      console.log('✅ subCategoryId column added\n');
    } catch (err) {
      if (err.message.includes('Duplicate column')) {
        console.log('⚠️ subCategoryId column already exists\n');
      } else {
        throw err;
      }
    }

    // Add videos column to businesses table
    console.log('Adding videos column to businesses table...');
    try {
      await sequelize.query(`
        ALTER TABLE businesses ADD COLUMN videos JSON DEFAULT NULL
      `);
      console.log('✅ videos column added\n');
    } catch (err) {
      if (err.message.includes('Duplicate column')) {
        console.log('⚠️ videos column already exists\n');
      } else {
        throw err;
      }
    }

    // Create review_requests table
    console.log('Creating review_requests table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS review_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        businessId INT NOT NULL,
        customerEmail VARCHAR(100) NOT NULL,
        customerName VARCHAR(100),
        status ENUM('pending', 'sent', 'completed', 'expired') DEFAULT 'pending',
        token VARCHAR(255) UNIQUE,
        sentAt DATETIME,
        completedAt DATETIME,
        expiresAt DATETIME,
        requestedBy INT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (businessId) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (requestedBy) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Review requests table created\n');

    // Add email verification fields to users table
    console.log('Adding email verification fields to users table...');
    try {
      await sequelize.query(`
        ALTER TABLE users 
        ADD COLUMN isEmailVerified BOOLEAN DEFAULT FALSE,
        ADD COLUMN emailVerificationToken VARCHAR(255),
        ADD COLUMN emailVerificationExpires DATETIME
      `);
      console.log('✅ Email verification fields added\n');
    } catch (err) {
      if (err.message.includes('Duplicate column')) {
        console.log('⚠️ Email verification fields already exist\n');
      } else {
        throw err;
      }
    }

    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();


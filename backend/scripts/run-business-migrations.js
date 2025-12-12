require('dotenv').config();
const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

async function runBusinessMigrations() {
  try {
    console.log('🌱 Starting business table migrations...\n');

    // Test connection first
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    const queryInterface = sequelize.getQueryInterface();

    // Check if businesses table exists
    try {
      await queryInterface.describeTable('businesses');
    } catch (error) {
      console.error('❌ Error: Businesses table does not exist.');
      console.log('   Please run: npm run seed (which will create tables)\n');
      await sequelize.close();
      process.exit(1);
    }

    // Get current table description
    const tableDesc = await queryInterface.describeTable('businesses');

    // Step 1: Add business columns (logo, verification fields)
    console.log('📋 Step 1: Adding business columns (logo, verification fields)...\n');
    
    if (!tableDesc.logo) {
      try {
        await sequelize.query('ALTER TABLE businesses ADD COLUMN logo LONGTEXT');
        console.log('  ✓ Added logo column');
      } catch (e) {
        console.log('  ⚠️  Error adding logo:', e.message);
      }
    } else {
      console.log('  - logo column already exists');
    }

    if (!tableDesc.verificationMethod) {
      try {
        await sequelize.query("ALTER TABLE businesses ADD COLUMN verificationMethod ENUM('none', 'google', 'facebook', 'document', 'phone') DEFAULT 'none'");
        console.log('  ✓ Added verificationMethod column');
      } catch (e) {
        console.log('  ⚠️  Error adding verificationMethod:', e.message);
      }
    } else {
      console.log('  - verificationMethod column already exists');
    }

    if (!tableDesc.verificationData) {
      try {
        await sequelize.query('ALTER TABLE businesses ADD COLUMN verificationData JSON');
        console.log('  ✓ Added verificationData column');
      } catch (e) {
        console.log('  ⚠️  Error adding verificationData:', e.message);
      }
    } else {
      console.log('  - verificationData column already exists');
    }

    if (!tableDesc.verificationRequestedAt) {
      try {
        await sequelize.query('ALTER TABLE businesses ADD COLUMN verificationRequestedAt DATETIME');
        console.log('  ✓ Added verificationRequestedAt column');
      } catch (e) {
        console.log('  ⚠️  Error adding verificationRequestedAt:', e.message);
      }
    } else {
      console.log('  - verificationRequestedAt column already exists');
    }

    if (!tableDesc.verificationStatus) {
      try {
        await sequelize.query("ALTER TABLE businesses ADD COLUMN verificationStatus ENUM('none', 'pending', 'approved', 'rejected') DEFAULT 'none'");
        console.log('  ✓ Added verificationStatus column');
      } catch (e) {
        console.log('  ⚠️  Error adding verificationStatus:', e.message);
      }
    } else {
      console.log('  - verificationStatus column already exists');
    }

    console.log('✅ Step 1 completed\n');

    // Step 2: Add rejection fields
    console.log('📋 Step 2: Adding rejection fields...\n');
    
    if (!tableDesc.rejectionReason) {
      try {
        await queryInterface.addColumn('businesses', 'rejectionReason', {
          type: DataTypes.TEXT,
          allowNull: true
        });
        console.log('  ✓ Added rejectionReason column');
      } catch (e) {
        console.log('  ⚠️  Error adding rejectionReason:', e.message);
      }
    } else {
      console.log('  - rejectionReason column already exists');
    }

    if (!tableDesc.rejectedAt) {
      try {
        await queryInterface.addColumn('businesses', 'rejectedAt', {
          type: DataTypes.DATE,
          allowNull: true
        });
        console.log('  ✓ Added rejectedAt column');
      } catch (e) {
        console.log('  ⚠️  Error adding rejectedAt:', e.message);
      }
    } else {
      console.log('  - rejectedAt column already exists');
    }

    console.log('✅ Step 2 completed\n');

    // Step 3: Add approvedAt field
    console.log('📋 Step 3: Adding approvedAt field...\n');
    
    if (!tableDesc.approvedAt) {
      try {
        await sequelize.query(`
          ALTER TABLE businesses 
          ADD COLUMN approvedAt DATETIME NULL
        `);
        console.log('  ✓ Added approvedAt column');
        
        // Update existing approved businesses
        await sequelize.query(`
          UPDATE businesses 
          SET approvedAt = updatedAt 
          WHERE isActive = 1 AND isVerified = 1 AND approvedAt IS NULL
        `);
        console.log('  ✓ Updated existing approved businesses');
      } catch (e) {
        console.log('  ⚠️  Error adding approvedAt:', e.message);
      }
    } else {
      console.log('  - approvedAt column already exists');
    }

    console.log('✅ Step 3 completed\n');

    // Step 4: Add isPublic field (THIS IS THE CRITICAL ONE)
    console.log('📋 Step 4: Adding isPublic field...\n');
    
    if (!tableDesc.isPublic) {
      try {
        await sequelize.query(`
          ALTER TABLE businesses 
          ADD COLUMN isPublic BOOLEAN DEFAULT true
        `);
        console.log('  ✓ Added isPublic column');
      } catch (e) {
        console.log('  ⚠️  Error adding isPublic:', e.message);
        throw e; // Re-throw as this is critical
      }
    } else {
      console.log('  - isPublic column already exists');
    }

    console.log('✅ Step 4 completed\n');

    // Step 5: Add social links
    console.log('📋 Step 5: Adding social links field...\n');
    
    if (!tableDesc.socialLinks) {
      try {
        await queryInterface.addColumn('businesses', 'socialLinks', {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: {}
        });
        console.log('  ✓ Added socialLinks column');
      } catch (e) {
        console.log('  ⚠️  Error adding socialLinks:', e.message);
      }
    } else {
      console.log('  - socialLinks column already exists');
    }

    console.log('✅ Step 5 completed\n');

    // Step 6: Add subCategoryId and videos
    console.log('📋 Step 6: Adding subCategoryId and videos fields...\n');
    
    if (!tableDesc.subCategoryId) {
      try {
        await sequelize.query(`
          ALTER TABLE businesses ADD COLUMN subCategoryId INT DEFAULT NULL
        `);
        console.log('  ✓ Added subCategoryId column');
      } catch (e) {
        console.log('  ⚠️  Error adding subCategoryId:', e.message);
      }
    } else {
      console.log('  - subCategoryId column already exists');
    }

    if (!tableDesc.videos) {
      try {
        await sequelize.query(`
          ALTER TABLE businesses ADD COLUMN videos JSON DEFAULT NULL
        `);
        console.log('  ✓ Added videos column');
      } catch (e) {
        console.log('  ⚠️  Error adding videos:', e.message);
      }
    } else {
      console.log('  - videos column already exists');
    }

    console.log('✅ Step 6 completed\n');

    console.log('✅ All business migrations completed successfully!\n');
    console.log('   You can now run: npm run seed\n');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration error:', error.message);
    if (error.parent) {
      console.error('   Details:', error.parent.message);
    }
    if (error.sql) {
      console.error('   SQL:', error.sql);
    }
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
}

runBusinessMigrations();


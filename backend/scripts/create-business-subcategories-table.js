/**
 * Migration script to create business_subcategories junction table
 * This enables many-to-many relationship between businesses and subcategories
 * 
 * Usage: node scripts/create-business-subcategories-table.js
 */

require('dotenv').config();
const { sequelize } = require('../config/database');

async function createBusinessSubcategoriesTable() {
  try {
    console.log('🚀 Starting migration: Creating business_subcategories table...\n');

    // Create business_subcategories junction table
    console.log('Creating business_subcategories table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS business_subcategories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        businessId INT NOT NULL,
        subCategoryId INT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (businessId) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (subCategoryId) REFERENCES subcategories(id) ON DELETE CASCADE,
        UNIQUE KEY unique_business_subcategory (businessId, subCategoryId),
        INDEX idx_businessId (businessId),
        INDEX idx_subCategoryId (subCategoryId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ business_subcategories table created successfully\n');

    // Migrate existing data: If businesses have subCategoryId, add them to the junction table
    console.log('Migrating existing subCategoryId data to junction table...');
    const [existingData] = await sequelize.query(`
      SELECT id, subCategoryId 
      FROM businesses 
      WHERE subCategoryId IS NOT NULL
    `);

    if (existingData.length > 0) {
      console.log(`   Found ${existingData.length} businesses with existing subCategoryId`);
      
      for (const business of existingData) {
        try {
          await sequelize.query(`
            INSERT IGNORE INTO business_subcategories (businessId, subCategoryId, createdAt, updatedAt)
            VALUES (?, ?, NOW(), NOW())
          `, {
            replacements: [business.id, business.subCategoryId]
          });
        } catch (error) {
          if (!error.message.includes('Duplicate entry')) {
            console.error(`   ⚠️  Error migrating business ${business.id}:`, error.message);
          }
        }
      }
      console.log(`✅ Migrated ${existingData.length} existing business-subcategory relationships\n`);
    } else {
      console.log('   No existing subCategoryId data to migrate\n');
    }

    // Migrate services array: If businesses have services in their services JSON field,
    // try to match them with subcategories by name
    console.log('Attempting to migrate services array to subcategories...');
    const [businessesWithServices] = await sequelize.query(`
      SELECT id, services 
      FROM businesses 
      WHERE services IS NOT NULL 
      AND services != '[]' 
      AND JSON_LENGTH(services) > 0
    `);

    if (businessesWithServices.length > 0) {
      console.log(`   Found ${businessesWithServices.length} businesses with services array`);
      
      // Get all subcategories
      const [subcategories] = await sequelize.query(`
        SELECT id, name FROM subcategories WHERE isActive = 1
      `);
      const subcategoryMap = new Map(subcategories.map(sub => [sub.name.toLowerCase().trim(), sub.id]));

      let migratedCount = 0;
      for (const business of businessesWithServices) {
        try {
          let services = business.services;
          if (typeof services === 'string') {
            services = JSON.parse(services);
          }
          
          if (Array.isArray(services)) {
            for (const serviceName of services) {
              if (typeof serviceName === 'string') {
                const normalizedName = serviceName.toLowerCase().trim();
                const subCategoryId = subcategoryMap.get(normalizedName);
                
                if (subCategoryId) {
                  try {
                    await sequelize.query(`
                      INSERT IGNORE INTO business_subcategories (businessId, subCategoryId, createdAt, updatedAt)
                      VALUES (?, ?, NOW(), NOW())
                    `, {
                      replacements: [business.id, subCategoryId]
                    });
                    migratedCount++;
                  } catch (error) {
                    // Ignore duplicate entries
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(`   ⚠️  Error processing business ${business.id} services:`, error.message);
        }
      }
      console.log(`✅ Migrated ${migratedCount} service-to-subcategory relationships\n`);
    } else {
      console.log('   No services array data to migrate\n');
    }

    console.log('✅ Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Created business_subcategories junction table');
    console.log('   - Migrated existing subCategoryId relationships');
    console.log('   - Migrated services array to subcategories (where names match)');
    console.log('\n💡 Note: The subCategoryId column in businesses table is kept for backward compatibility');
    console.log('   but new relationships should use the business_subcategories table.\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run migration
createBusinessSubcategoriesTable()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });


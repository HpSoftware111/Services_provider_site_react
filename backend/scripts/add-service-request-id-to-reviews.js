/**
 * Migration script to add serviceRequestId column to reviews table
 * and update unique constraint to allow multiple reviews per business+user
 * for different service requests
 */

const { sequelize } = require('../config/database');

async function migrate() {
  const transaction = await sequelize.transaction();

  try {
    console.log('Starting migration: Add serviceRequestId to reviews table...');

    // Check if serviceRequestId column already exists
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'reviews' 
      AND COLUMN_NAME = 'serviceRequestId'
    `, { transaction });

    if (results.length === 0) {
      // Add serviceRequestId column
      console.log('Adding serviceRequestId column...');
      await sequelize.query(`
        ALTER TABLE reviews 
        ADD COLUMN serviceRequestId INT NULL AFTER userId,
        ADD INDEX idx_reviews_service_request_id (serviceRequestId)
      `, { transaction });

      // Populate serviceRequestId from metadata for existing reviews
      console.log('Populating serviceRequestId from metadata...');
      await sequelize.query(`
        UPDATE reviews 
        SET serviceRequestId = CAST(JSON_EXTRACT(metadata, '$.serviceRequestId') AS UNSIGNED)
        WHERE metadata IS NOT NULL 
        AND metadata != ''
        AND JSON_EXTRACT(metadata, '$.serviceRequestId') IS NOT NULL
      `, { transaction });

      console.log('✅ serviceRequestId column added and populated');
    } else {
      console.log('⚠️  serviceRequestId column already exists, skipping...');
    }

    // Check for foreign keys using the unique index
    console.log('Checking for foreign keys using the unique index...');
    const [fkResults] = await sequelize.query(`
      SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'reviews'
      AND CONSTRAINT_NAME != 'PRIMARY'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `, { transaction });

    // Remove old unique constraint on businessId + userId
    // First, we need to check if it's used by a foreign key
    console.log('Removing old unique constraint on businessId + userId...');
    try {
      // Try to drop the index directly
      await sequelize.query(`
        ALTER TABLE reviews 
        DROP INDEX reviews_business_id_user_id
      `, { transaction });
      console.log('✅ Old unique constraint removed');
    } catch (error) {
      if (error.message.includes("Unknown key name") || error.message.includes("Can't DROP")) {
        console.log('⚠️  Old unique constraint not found, skipping...');
      } else if (error.message.includes("needed in a foreign key constraint")) {
        console.log('⚠️  Old unique constraint is used by a foreign key. Skipping removal.');
        console.log('⚠️  Note: The old constraint will remain, but new reviews will use serviceRequestId.');
        console.log('⚠️  You may need to manually drop foreign keys and recreate them if needed.');
      } else {
        throw error;
      }
    }

    // Add new unique constraint on businessId + userId + serviceRequestId
    // This allows multiple reviews per business+user for different service requests
    // Note: MySQL allows NULL values in unique constraints, so multiple NULLs are allowed
    // This means old reviews without serviceRequestId can coexist
    console.log('Adding new unique constraint on businessId + userId + serviceRequestId...');
    try {
      await sequelize.query(`
        ALTER TABLE reviews 
        ADD UNIQUE KEY reviews_business_user_service_request (businessId, userId, serviceRequestId)
      `, { transaction });
      console.log('✅ New unique constraint added');
      console.log('✅ Multiple reviews per business+user are now allowed for different service requests');
    } catch (error) {
      if (error.message.includes("Duplicate entry") || error.message.includes("Duplicate key")) {
        console.log('⚠️  Unique constraint already exists or duplicate data found');
        console.log('⚠️  You may need to clean up duplicate reviews manually');
      } else if (error.message.includes("Duplicate key name")) {
        console.log('⚠️  Unique constraint already exists, skipping...');
      } else {
        throw error;
      }
    }

    await transaction.commit();
    console.log('✅ Migration completed successfully!');

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

// Run migration
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = migrate;

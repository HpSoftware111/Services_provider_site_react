require('dotenv').config();
const { sequelize } = require('../config/database');

async function updateForeignKeys() {
    try {
        console.log('🌱 Updating service_requests foreign key constraints...\n');

        // Test connection first
        await sequelize.authenticate();
        console.log('✅ Database connected\n');

        // Step 1: Drop existing foreign key constraints
        console.log('📋 Step 1: Dropping existing foreign key constraints...\n');

        try {
            await sequelize.query(`
                ALTER TABLE service_requests 
                DROP FOREIGN KEY service_requests_ibfk_2
            `);
            console.log('  ✓ Dropped foreign key constraint for categoryId (service_requests_ibfk_2)');
        } catch (e) {
            if (e.message.includes("doesn't exist") || e.message.includes('Unknown key')) {
                console.log('  - Foreign key service_requests_ibfk_2 does not exist (may have been dropped already)');
            } else {
                console.log('  ⚠️  Error dropping service_requests_ibfk_2:', e.message);
            }
        }

        try {
            await sequelize.query(`
                ALTER TABLE service_requests 
                DROP FOREIGN KEY service_requests_ibfk_3
            `);
            console.log('  ✓ Dropped foreign key constraint for subCategoryId (service_requests_ibfk_3)');
        } catch (e) {
            if (e.message.includes("doesn't exist") || e.message.includes('Unknown key')) {
                console.log('  - Foreign key service_requests_ibfk_3 does not exist (may have been dropped already)');
            } else {
                console.log('  ⚠️  Error dropping service_requests_ibfk_3:', e.message);
            }
        }

        console.log('✅ Step 1 completed\n');

        // Step 2: Add new foreign key constraints pointing to categories and subcategories tables
        console.log('📋 Step 2: Adding new foreign key constraints...\n');

        try {
            await sequelize.query(`
                ALTER TABLE service_requests 
                ADD CONSTRAINT service_requests_categoryId_fk 
                FOREIGN KEY (categoryId) REFERENCES categories(id) 
                ON DELETE CASCADE ON UPDATE CASCADE
            `);
            console.log('  ✓ Added foreign key constraint: categoryId → categories.id');
        } catch (e) {
            if (e.message.includes('Duplicate key name') || e.message.includes('already exists')) {
                console.log('  - Foreign key for categoryId already exists');
            } else {
                console.log('  ⚠️  Error adding categoryId foreign key:', e.message);
            }
        }

        try {
            await sequelize.query(`
                ALTER TABLE service_requests 
                ADD CONSTRAINT service_requests_subCategoryId_fk 
                FOREIGN KEY (subCategoryId) REFERENCES subcategories(id) 
                ON DELETE SET NULL ON UPDATE CASCADE
            `);
            console.log('  ✓ Added foreign key constraint: subCategoryId → subcategories.id');
        } catch (e) {
            if (e.message.includes('Duplicate key name') || e.message.includes('already exists')) {
                console.log('  - Foreign key for subCategoryId already exists');
            } else {
                console.log('  ⚠️  Error adding subCategoryId foreign key:', e.message);
            }
        }

        console.log('✅ Step 2 completed\n');

        // Verify the changes
        console.log('📋 Step 3: Verifying foreign key constraints...\n');
        const [constraints] = await sequelize.query(`
            SELECT 
                CONSTRAINT_NAME,
                TABLE_NAME,
                COLUMN_NAME,
                REFERENCED_TABLE_NAME,
                REFERENCED_COLUMN_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'service_requests'
            AND CONSTRAINT_NAME LIKE '%category%'
            ORDER BY CONSTRAINT_NAME
        `);

        console.log('Current foreign key constraints on service_requests:');
        constraints.forEach(constraint => {
            console.log(`  - ${constraint.CONSTRAINT_NAME}: ${constraint.COLUMN_NAME} → ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME}`);
        });

        console.log('\n✨ Migration completed successfully!');
        console.log('   - service_requests.categoryId now references categories.id');
        console.log('   - service_requests.subCategoryId now references subcategories.id\n');

        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration error:', error.message);
        if (error.parent) {
            console.error('   Details:', error.parent.message);
        }
        await sequelize.close().catch(() => { });
        process.exit(1);
    }
}

// Run the migration
if (require.main === module) {
    updateForeignKeys();
}

module.exports = updateForeignKeys;



require('dotenv').config();
const { sequelize } = require('../config/database');

async function fixServiceRequestsCategories() {
    try {
        console.log('🌱 Fixing service_requests category references...\n');

        // Test connection first
        await sequelize.authenticate();
        console.log('✅ Database connected\n');

        // Step 1: Check existing service requests
        console.log('📋 Step 1: Checking existing service requests...\n');
        const [serviceRequests] = await sequelize.query('SELECT id, categoryId, subCategoryId FROM service_requests');
        console.log(`Found ${serviceRequests.length} service requests`);
        serviceRequests.forEach(sr => {
            console.log(`  ID: ${sr.id}, categoryId: ${sr.categoryId}, subCategoryId: ${sr.subCategoryId || 'NULL'}`);
        });

        // Step 2: Get available categories
        console.log('\n📋 Step 2: Checking available categories...\n');
        const [categories] = await sequelize.query('SELECT id, name FROM categories ORDER BY id');
        console.log(`Found ${categories.length} categories:`);
        categories.forEach(c => {
            console.log(`  ID: ${c.id}, Name: ${c.name}`);
        });

        // Step 3: Get available subcategories
        console.log('\n📋 Step 3: Checking available subcategories...\n');
        const [subcategories] = await sequelize.query('SELECT id, name, categoryId FROM subcategories ORDER BY categoryId, id');
        console.log(`Found ${subcategories.length} subcategories:`);
        subcategories.forEach(sc => {
            console.log(`  ID: ${sc.id}, Name: ${sc.name}, categoryId: ${sc.categoryId}`);
        });

        // Step 4: Find invalid categoryIds
        console.log('\n📋 Step 4: Finding invalid categoryIds...\n');
        const validCategoryIds = categories.map(c => c.id);
        const invalidRequests = serviceRequests.filter(sr => !validCategoryIds.includes(sr.categoryId));

        if (invalidRequests.length > 0) {
            console.log(`Found ${invalidRequests.length} service requests with invalid categoryIds:`);
            invalidRequests.forEach(sr => {
                console.log(`  ID: ${sr.id}, categoryId: ${sr.categoryId} (invalid)`);
            });

            // Step 5: Update invalid categoryIds to first available category
            if (categories.length > 0) {
                const defaultCategoryId = categories[0].id;
                console.log(`\n📋 Step 5: Updating invalid categoryIds to default category (ID: ${defaultCategoryId})...\n`);

                for (const req of invalidRequests) {
                    await sequelize.query(`
                        UPDATE service_requests 
                        SET categoryId = ? 
                        WHERE id = ?
                    `, {
                        replacements: [defaultCategoryId, req.id]
                    });
                    console.log(`  ✓ Updated service request ${req.id}: categoryId ${req.categoryId} → ${defaultCategoryId}`);
                }
            }
        } else {
            console.log('  ✓ All service requests have valid categoryIds');
        }

        // Step 6: Find invalid subCategoryIds
        console.log('\n📋 Step 6: Finding invalid subCategoryIds...\n');
        const validSubCategoryIds = subcategories.map(sc => sc.id);
        const invalidSubCategoryRequests = serviceRequests.filter(sr =>
            sr.subCategoryId !== null && !validSubCategoryIds.includes(sr.subCategoryId)
        );

        if (invalidSubCategoryRequests.length > 0) {
            console.log(`Found ${invalidSubCategoryRequests.length} service requests with invalid subCategoryIds:`);
            invalidSubCategoryRequests.forEach(sr => {
                console.log(`  ID: ${sr.id}, subCategoryId: ${sr.subCategoryId} (invalid)`);
            });

            // Step 7: Set invalid subCategoryIds to NULL
            console.log(`\n📋 Step 7: Setting invalid subCategoryIds to NULL...\n`);

            for (const req of invalidSubCategoryRequests) {
                await sequelize.query(`
                    UPDATE service_requests 
                    SET subCategoryId = NULL 
                    WHERE id = ?
                `, {
                    replacements: [req.id]
                });
                console.log(`  ✓ Updated service request ${req.id}: subCategoryId ${req.subCategoryId} → NULL`);
            }
        } else {
            console.log('  ✓ All service requests have valid subCategoryIds (or NULL)');
        }

        // Step 8: Verify subCategoryId matches categoryId
        console.log('\n📋 Step 8: Verifying subCategoryId matches categoryId...\n');
        const [allRequests] = await sequelize.query(`
            SELECT id, categoryId, subCategoryId 
            FROM service_requests 
            WHERE subCategoryId IS NOT NULL
        `);

        const mismatched = [];
        for (const req of allRequests) {
            const subCat = subcategories.find(sc => sc.id === req.subCategoryId);
            if (subCat && subCat.categoryId !== req.categoryId) {
                mismatched.push({ ...req, expectedCategoryId: subCat.categoryId });
            }
        }

        if (mismatched.length > 0) {
            console.log(`Found ${mismatched.length} service requests with mismatched subCategoryId:`);
            mismatched.forEach(req => {
                console.log(`  ID: ${req.id}, categoryId: ${req.categoryId}, subCategoryId: ${req.subCategoryId} (belongs to categoryId: ${req.expectedCategoryId})`);
            });

            // Set mismatched subCategoryIds to NULL
            console.log(`\n📋 Step 9: Setting mismatched subCategoryIds to NULL...\n`);
            for (const req of mismatched) {
                await sequelize.query(`
                    UPDATE service_requests 
                    SET subCategoryId = NULL 
                    WHERE id = ?
                `, {
                    replacements: [req.id]
                });
                console.log(`  ✓ Updated service request ${req.id}: subCategoryId set to NULL (mismatch with categoryId)`);
            }
        } else {
            console.log('  ✓ All subCategoryIds match their categoryIds');
        }

        console.log('\n✨ Data fix completed successfully!\n');
        console.log('   You can now run the foreign key migration script.\n');

        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.parent) {
            console.error('   Details:', error.parent.message);
        }
        await sequelize.close().catch(() => { });
        process.exit(1);
    }
}

// Run the fix
if (require.main === module) {
    fixServiceRequestsCategories();
}

module.exports = fixServiceRequestsCategories;



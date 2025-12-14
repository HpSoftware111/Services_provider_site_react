/**
 * Migration Script: Create Subscription Tables
 * 
 * Creates subscription_plans and user_subscriptions tables
 * Run with: node backend/scripts/create-subscription-tables.js
 */

require('dotenv').config();
const { sequelize } = require('../config/database');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const UserSubscription = require('../models/UserSubscription');

async function createSubscriptionTables() {
  try {
    console.log('Starting subscription tables creation...\n');

    // Check if table exists and handle existing data
    const [results] = await sequelize.query("SHOW TABLES LIKE 'subscription_plans'");
    const tableExists = results.length > 0;

    if (tableExists) {
      console.log('Table subscription_plans already exists. Checking for column updates...\n');

      // Check if tier column exists
      const [columns] = await sequelize.query("SHOW COLUMNS FROM subscription_plans LIKE 'tier'");
      const tierColumnExists = columns.length > 0;

      if (!tierColumnExists) {
        console.log('Adding tier column...');

        // Get existing plans to determine tier assignments
        const [existingPlans] = await sequelize.query("SELECT id, name FROM subscription_plans ORDER BY id");
        console.log(`Found ${existingPlans.length} existing plan(s)\n`);

        if (existingPlans.length > 0) {
          // First, add tier column as nullable
          await sequelize.query(`
            ALTER TABLE subscription_plans 
            ADD COLUMN tier ENUM('BASIC', 'PRO', 'PREMIUM') NULL
          `);

          // Assign tiers to existing plans
          const tiers = ['BASIC', 'PRO', 'PREMIUM'];
          const tierAssignments = new Map(); // Track which tier goes to which plan

          for (let i = 0; i < existingPlans.length; i++) {
            const plan = existingPlans[i];
            let assignedTier;

            // Try to infer tier from name first
            const nameUpper = (plan.name || '').toUpperCase();
            if (nameUpper.includes('PREMIUM')) {
              assignedTier = 'PREMIUM';
            } else if (nameUpper.includes('PRO') && !nameUpper.includes('PREMIUM')) {
              assignedTier = 'PRO';
            } else if (nameUpper.includes('BASIC')) {
              assignedTier = 'BASIC';
            } else {
              // Assign sequentially, but check for conflicts
              assignedTier = tiers[i % 3];

              // Check if this tier is already assigned
              const existingAssignments = Array.from(tierAssignments.values());
              if (existingAssignments.includes(assignedTier) && i < 3) {
                // Find next available tier
                assignedTier = tiers.find(t => !existingAssignments.includes(t)) || tiers[i % 3];
              }
            }

            tierAssignments.set(plan.id, assignedTier);

            await sequelize.query(
              `UPDATE subscription_plans SET tier = ? WHERE id = ?`,
              { replacements: [assignedTier, plan.id] }
            );
            console.log(`  - Assigned tier "${assignedTier}" to plan: ${plan.name} (ID: ${plan.id})`);
          }

          // Ensure no duplicate tiers before adding unique constraint
          const usedTiers = new Set();
          const tierMap = new Map(); // Map to track which plan has which tier

          for (const plan of existingPlans) {
            const [planData] = await sequelize.query(
              `SELECT tier FROM subscription_plans WHERE id = ?`,
              { replacements: [plan.id] }
            );
            const currentTier = planData[0].tier;

            if (usedTiers.has(currentTier)) {
              // Conflict detected - reassign to next available tier
              const availableTier = tiers.find(t => !usedTiers.has(t));
              if (availableTier) {
                await sequelize.query(
                  `UPDATE subscription_plans SET tier = ? WHERE id = ?`,
                  { replacements: [availableTier, plan.id] }
                );
                console.log(`  - Resolved conflict: Plan "${plan.name}" reassigned to tier "${availableTier}"`);
                usedTiers.add(availableTier);
                tierMap.set(plan.id, availableTier);
              } else {
                console.log(`  - ⚠️  Cannot assign unique tier to plan "${plan.name}" (ID: ${plan.id}) - all tiers taken`);
              }
            } else {
              usedTiers.add(currentTier);
              tierMap.set(plan.id, currentTier);
            }
          }

          // Verify we have unique tiers for all plans (max 3 plans can have unique tiers)
          const [duplicateCheck] = await sequelize.query(`
            SELECT tier, COUNT(*) as count 
            FROM subscription_plans 
            WHERE tier IS NOT NULL
            GROUP BY tier 
            HAVING count > 1
          `);

          if (duplicateCheck.length > 0) {
            console.log('\n⚠️  Warning: Still have duplicate tiers after reassignment.');
            console.log('   The unique constraint will not be applied to avoid data loss.');
            console.log('   Please manually review and update duplicate tiers.\n');
            // Don't add unique constraint if duplicates exist
          } else {
            // All tiers are unique, can add constraints
            // Now make it NOT NULL
            await sequelize.query(`
              ALTER TABLE subscription_plans 
              MODIFY COLUMN tier ENUM('BASIC', 'PRO', 'PREMIUM') NOT NULL
            `);

            // Remove existing unique constraint if it exists
            try {
              await sequelize.query(`ALTER TABLE subscription_plans DROP INDEX unique_tier`);
            } catch (e) {
              // Index doesn't exist, that's fine
            }

            // Add unique constraint
            try {
              await sequelize.query(`
                ALTER TABLE subscription_plans 
                ADD UNIQUE KEY unique_tier (tier)
              `);
              console.log('✅ Unique constraint on tier added successfully\n');
            } catch (e) {
              console.log('⚠️  Could not add unique constraint:', e.message);
              console.log('   Continuing without unique constraint...\n');
            }
          }

          console.log('✅ tier column added and populated\n');
        } else {
          // No existing data, can add column with constraint directly
          await sequelize.query(`
            ALTER TABLE subscription_plans 
            ADD COLUMN tier ENUM('BASIC', 'PRO', 'PREMIUM') NOT NULL UNIQUE
          `);
          console.log('✅ tier column added\n');
        }
      }
    }

    // Check and add new subscription feature fields if they don't exist
    console.log('Checking for subscription feature fields...');
    const [columns] = await sequelize.query("SHOW COLUMNS FROM subscription_plans");
    const columnNames = columns.map(col => col.Field);

    if (!columnNames.includes('leadDiscountPercent')) {
      console.log('Adding leadDiscountPercent column...');
      await sequelize.query(`
            ALTER TABLE subscription_plans 
            ADD COLUMN leadDiscountPercent DECIMAL(5, 2) DEFAULT 0
        `);
      console.log('✅ leadDiscountPercent column added\n');
    }

    if (!columnNames.includes('priorityBoostPoints')) {
      console.log('Adding priorityBoostPoints column...');
      await sequelize.query(`
            ALTER TABLE subscription_plans 
            ADD COLUMN priorityBoostPoints INTEGER DEFAULT 0
        `);
      console.log('✅ priorityBoostPoints column added\n');
    }

    if (!columnNames.includes('isFeatured')) {
      console.log('Adding isFeatured column...');
      await sequelize.query(`
            ALTER TABLE subscription_plans 
            ADD COLUMN isFeatured BOOLEAN DEFAULT FALSE
        `);
      console.log('✅ isFeatured column added\n');
    }

    if (!columnNames.includes('hasAdvancedAnalytics')) {
      console.log('Adding hasAdvancedAnalytics column...');
      await sequelize.query(`
            ALTER TABLE subscription_plans 
            ADD COLUMN hasAdvancedAnalytics BOOLEAN DEFAULT FALSE
        `);
      console.log('✅ hasAdvancedAnalytics column added\n');
    }

    // Sync SubscriptionPlan model to ensure all other columns exist
    console.log('Syncing subscription_plans table...');
    await SubscriptionPlan.sync({ alter: true });
    console.log('✅ subscription_plans table synced\n');

    // Sync UserSubscription model
    console.log('Creating/syncing user_subscriptions table...');
    await UserSubscription.sync({ alter: true });
    console.log('✅ user_subscriptions table created/updated\n');

    // Seed or update default subscription plans
    console.log('Checking for default subscription plans...');
    const existingPlans = await SubscriptionPlan.findAll({
      order: [['displayOrder', 'ASC'], ['id', 'ASC']]
    });

    const defaultPlans = [
      {
        name: 'Basic Plan',
        tier: 'BASIC',
        price: 0.00,
        billingCycle: 'MONTHLY',
        description: 'Perfect for getting started',
        features: [
          'Standard lead pricing',
          'Basic support',
          'Business listing',
          'Customer reviews'
        ],
        leadDiscountPercent: 0,
        priorityBoostPoints: 0,
        isFeatured: false,
        hasAdvancedAnalytics: false,
        isActive: true,
        displayOrder: 1
      },
      {
        name: 'Pro Plan',
        tier: 'PRO',
        price: 29.99,
        billingCycle: 'MONTHLY',
        description: 'Best for growing businesses',
        features: [
          '15% discount on leads',
          '+15 priority boost points',
          'Priority support',
          'Enhanced business profile',
          'Advanced analytics',
          'Featured listing'
        ],
        leadDiscountPercent: 15,
        priorityBoostPoints: 15,
        isFeatured: true,
        hasAdvancedAnalytics: true,
        isActive: true,
        displayOrder: 2
      },
      {
        name: 'Premium Plan',
        tier: 'PREMIUM',
        price: 79.99,
        billingCycle: 'MONTHLY',
        description: 'For established businesses',
        features: [
          '25% discount on leads',
          '+30 priority boost points',
          '24/7 priority support',
          'Premium business profile',
          'Advanced analytics & insights',
          'Top featured listing',
          'Custom branding',
          'Lead tracking & CRM tools'
        ],
        leadDiscountPercent: 25,
        priorityBoostPoints: 30,
        isFeatured: true,
        hasAdvancedAnalytics: true,
        isActive: true,
        displayOrder: 3
      }
    ];

    if (existingPlans.length === 0) {
      console.log('No plans found. Creating default plans...\n');

      for (const planData of defaultPlans) {
        await SubscriptionPlan.create(planData);
        console.log(`✅ Created plan: ${planData.name}`);
      }

      console.log('\n✅ Default subscription plans created successfully!');
    } else {
      console.log(`Found ${existingPlans.length} existing plan(s). Updating with new pricing and features...\n`);

      // Update existing plans based on tier or name match
      for (const existingPlan of existingPlans) {
        // Try to match by tier first, then by name
        let matchingPlan = defaultPlans.find(p => p.tier === existingPlan.tier);
        if (!matchingPlan) {
          // Try to match by name (case-insensitive)
          const nameUpper = (existingPlan.name || '').toUpperCase();
          if (nameUpper.includes('PREMIUM')) {
            matchingPlan = defaultPlans.find(p => p.tier === 'PREMIUM');
          } else if (nameUpper.includes('PRO') && !nameUpper.includes('PREMIUM')) {
            matchingPlan = defaultPlans.find(p => p.tier === 'PRO');
          } else if (nameUpper.includes('BASIC')) {
            matchingPlan = defaultPlans.find(p => p.tier === 'BASIC');
          } else {
            // Default to Basic if no match
            matchingPlan = defaultPlans.find(p => p.tier === 'BASIC');
          }
        }

        if (matchingPlan) {
          await existingPlan.update({
            price: matchingPlan.price,
            description: matchingPlan.description,
            features: matchingPlan.features,
            leadDiscountPercent: matchingPlan.leadDiscountPercent,
            priorityBoostPoints: matchingPlan.priorityBoostPoints,
            isFeatured: matchingPlan.isFeatured,
            hasAdvancedAnalytics: matchingPlan.hasAdvancedAnalytics,
            displayOrder: matchingPlan.displayOrder
          });
          console.log(`✅ Updated plan: ${existingPlan.name} (tier: ${existingPlan.tier}) - Price: $${matchingPlan.price.toFixed(2)}`);
        } else {
          console.log(`⚠️  Could not match plan: ${existingPlan.name} (tier: ${existingPlan.tier})`);
        }
      }

      console.log('\n✅ Existing subscription plans updated successfully!');
    }

    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run migration
createSubscriptionTables();

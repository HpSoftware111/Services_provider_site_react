/**
 * Migration Script: Create Subscription Tables
 * 
 * Creates subscription_plans and business_subscriptions tables
 * Run with: node backend/scripts/create-subscription-tables.js
 */

require('dotenv').config();
const { sequelize } = require('../config/database');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const BusinessSubscription = require('../models/BusinessSubscription');

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

    // Sync SubscriptionPlan model to ensure all other columns exist
    console.log('Syncing subscription_plans table...');
    await SubscriptionPlan.sync({ alter: true });
    console.log('✅ subscription_plans table synced\n');

    // Sync BusinessSubscription model
    console.log('Creating/syncing business_subscriptions table...');
    await BusinessSubscription.sync({ alter: true });
    console.log('✅ business_subscriptions table created/updated\n');

    // Seed default subscription plans if they don't exist
    console.log('Checking for default subscription plans...');
    const existingPlans = await SubscriptionPlan.count();

    if (existingPlans === 0) {
      console.log('No plans found. Creating default plans...\n');

      const defaultPlans = [
        {
          name: 'Basic Plan',
          tier: 'BASIC',
          price: 0.00,
          billingCycle: 'MONTHLY',
          description: 'Perfect for getting started',
          features: [
            'Unlimited leads',
            'Basic support',
            'Business listing',
            'Customer reviews'
          ],
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
            'Unlimited leads',
            'Priority support',
            'Enhanced business profile',
            'Advanced analytics',
            'Featured listing'
          ],
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
            'Unlimited leads',
            '24/7 priority support',
            'Premium business profile',
            'Advanced analytics & insights',
            'Top featured listing',
            'Custom branding',
            'Lead tracking & CRM tools'
          ],
          isActive: true,
          displayOrder: 3
        }
      ];

      for (const planData of defaultPlans) {
        await SubscriptionPlan.create(planData);
        console.log(`✅ Created plan: ${planData.name}`);
      }

      console.log('\n✅ Default subscription plans created successfully!');
    } else {
      console.log(`✅ Found ${existingPlans} existing plan(s). Skipping seed.\n`);
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

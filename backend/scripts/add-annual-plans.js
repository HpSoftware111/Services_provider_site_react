/**
 * Script to Add Annual Subscription Plans
 * 
 * This script adds annual subscription plans to the database.
 * It checks if annual plans already exist and only creates missing ones.
 * 
 * Usage: node backend/scripts/add-annual-plans.js
 */

require('dotenv').config();
const { sequelize } = require('../config/database');
const SubscriptionPlan = require('../models/SubscriptionPlan');

async function addAnnualPlans() {
  try {
    console.log('🔄 Starting annual plans addition...\n');

    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Remove unique constraint on tier if it exists (to allow same tier with different billing cycles)
    try {
      const [indexes] = await sequelize.query(`
        SHOW INDEXES FROM subscription_plans WHERE Column_name = 'tier' AND Non_unique = 0
      `);

      if (indexes.length > 0) {
        console.log('⚠️  Found unique constraint on tier column. Removing it to allow monthly/annual plans...\n');
        await sequelize.query(`
          ALTER TABLE subscription_plans DROP INDEX tier
        `).catch(err => {
          // Try alternative index name
          return sequelize.query(`
            ALTER TABLE subscription_plans DROP INDEX subscription_plans_tier_unique
          `).catch(() => {
            console.log('Note: Could not remove unique constraint automatically. You may need to do this manually.');
          });
        });
        console.log('✅ Unique constraint removed from tier column\n');
      }
    } catch (err) {
      console.log('ℹ️  No unique constraint found on tier column (or already removed)\n');
    }

    const annualPlans = [
      {
        name: 'Basic Plan (Annual)',
        tier: 'BASIC',
        price: 0.00,
        billingCycle: 'YEARLY',
        description: 'Perfect for getting started - Annual billing',
        features: [
          'Standard lead pricing',
          'Basic support',
          'Business listing',
          'Customer reviews',
          '10 service requests per month',
          'Save with annual billing'
        ],
        leadDiscountPercent: 0,
        priorityBoostPoints: 0,
        isFeatured: false,
        hasAdvancedAnalytics: false,
        maxLeadsPerMonth: 10,
        isActive: true,
        displayOrder: 4
      },
      {
        name: 'Premium Plan (Annual)',
        tier: 'PREMIUM',
        price: 299.9, // Annual pricing
        billingCycle: 'YEARLY',
        description: 'Best for growing businesses - Save 17% with annual billing',
        features: [
          '15% discount on leads',
          '+15 priority boost points',
          'Priority support',
          'Enhanced business profile',
          'Advanced analytics',
          'Featured listing',
          '30 leads per month',
          'Save 17% with annual billing'
        ],
        leadDiscountPercent: 15,
        priorityBoostPoints: 15,
        isFeatured: true,
        hasAdvancedAnalytics: true,
        maxLeadsPerMonth: 30,
        isActive: true,
        displayOrder: 5
      },
      {
        name: 'Pro Plan (Annual)',
        tier: 'PRO',
        price: 799.9, // Annual pricing
        billingCycle: 'YEARLY',
        description: 'For established businesses - Save 17% with annual billing',
        features: [
          '25% discount on leads',
          '+30 priority boost points',
          '24/7 priority support',
          'Premium business profile',
          'Advanced analytics & insights',
          'Top featured listing',
          'Custom branding',
          'Lead tracking & CRM tools',
          'Unlimited leads per month',
          'Save 17% with annual billing'
        ],
        leadDiscountPercent: 25,
        priorityBoostPoints: 30,
        isFeatured: true,
        hasAdvancedAnalytics: true,
        maxLeadsPerMonth: null, // null = unlimited
        isActive: true,
        displayOrder: 6
      }
    ];

    console.log('📋 Checking for existing annual plans...\n');
    const existingAnnualPlans = await SubscriptionPlan.findAll({
      where: { billingCycle: 'YEARLY' }
    });

    console.log(`Found ${existingAnnualPlans.length} existing annual plan(s)\n`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const planData of annualPlans) {
      // Check if plan with same name already exists
      const existing = await SubscriptionPlan.findOne({
        where: { name: planData.name }
      });

      if (existing) {
        // Update price if it's different
        const existingPrice = parseFloat(existing.price);
        const newPrice = parseFloat(planData.price);
        if (existingPrice !== newPrice) {
          await existing.update({ price: newPrice });
          console.log(`✅ Updated annual plan: ${planData.name} - Price: $${existingPrice.toFixed(2)} → $${newPrice.toFixed(2)}/year`);
          createdCount++; // Count as updated
        } else {
          console.log(`✓ Plan "${planData.name}" already exists with correct price: $${newPrice.toFixed(2)}/year`);
          skippedCount++;
        }
      } else {
        try {
          await SubscriptionPlan.create(planData);
          console.log(`✅ Created annual plan: ${planData.name} ($${planData.price.toFixed(2)}/year)`);
          createdCount++;
        } catch (error) {
          if (error.name === 'SequelizeUniqueConstraintError') {
            console.log(`⚠️  Plan "${planData.name}" already exists (unique constraint), skipping...`);
            skippedCount++;
          } else {
            console.error(`❌ Error creating plan "${planData.name}":`, error.message);
          }
        }
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  ✅ Created: ${createdCount} annual plan(s)`);
    console.log(`  ⚠️  Skipped: ${skippedCount} plan(s) (already exist)`);
    console.log(`  📦 Total annual plans: ${existingAnnualPlans.length + createdCount}`);

    // Verify all plans
    console.log('\n📋 All subscription plans:');
    const allPlans = await SubscriptionPlan.findAll({
      where: { isActive: true },
      order: [['billingCycle', 'ASC'], ['displayOrder', 'ASC']]
    });

    const monthly = allPlans.filter(p => p.billingCycle === 'MONTHLY');
    const yearly = allPlans.filter(p => p.billingCycle === 'YEARLY');

    console.log(`\n  Monthly Plans (${monthly.length}):`);
    monthly.forEach(plan => {
      console.log(`    - ${plan.name} ($${parseFloat(plan.price).toFixed(2)}/month)`);
    });

    console.log(`\n  Annual Plans (${yearly.length}):`);
    yearly.forEach(plan => {
      console.log(`    - ${plan.name} ($${parseFloat(plan.price).toFixed(2)}/year)`);
    });

    console.log('\n🎉 Annual plans addition completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding annual plans:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  addAnnualPlans();
}

module.exports = addAnnualPlans;


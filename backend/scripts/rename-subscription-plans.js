/**
 * Migration Script: Rename Subscription Plans
 * 
 * Renames existing subscription plans to match correct naming:
 * - "Growth Plan" (PREMIUM tier) → "Premium Plan"
 * - "Elite Plan" (PRO tier) → "Pro Plan"
 * 
 * Correct plan structure:
 * - Basic Plan (BASIC tier)
 * - Premium Plan (PREMIUM tier) - 30 leads/month
 * - Pro Plan (PRO tier) - Unlimited leads/month
 * 
 * Usage: node backend/scripts/rename-subscription-plans.js
 */

require('dotenv').config();
const { sequelize } = require('../config/database');
const { SubscriptionPlan } = require('../models');

async function renameSubscriptionPlans() {
  try {
    console.log('🔄 Starting subscription plan rename migration...\n');

    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Find PREMIUM tier plan (should be "Premium Plan", previously "Growth Plan")
    const premiumPlan = await SubscriptionPlan.findOne({
      where: {
        tier: 'PREMIUM'
      }
    });

    if (premiumPlan) {
      const oldName = premiumPlan.name;
      if (oldName !== 'Premium Plan') {
        await premiumPlan.update({ name: 'Premium Plan' });
        console.log(`✅ Renamed: "${oldName}" → "Premium Plan" (tier: PREMIUM, discount: ${premiumPlan.leadDiscountPercent}%)`);
      } else {
        console.log(`✓ Premium Plan (tier: PREMIUM) already correctly named`);
      }
    } else {
      console.log('⚠️  Premium Plan (tier: PREMIUM) not found');
    }

    // Find PRO tier plan (should be "Pro Plan", previously "Elite Plan")
    const proPlan = await SubscriptionPlan.findOne({
      where: {
        tier: 'PRO'
      }
    });

    if (proPlan) {
      const oldName = proPlan.name;
      if (oldName !== 'Pro Plan') {
        await proPlan.update({ name: 'Pro Plan' });
        console.log(`✅ Renamed: "${oldName}" → "Pro Plan" (tier: PRO, discount: ${proPlan.leadDiscountPercent}%)`);
      } else {
        console.log(`✓ Pro Plan (tier: PRO) already correctly named`);
      }
    } else {
      console.log('⚠️  Pro Plan (tier: PRO) not found');
    }

    // Verify all plans have correct discounts
    console.log('\n📊 Verifying plan discounts:');
    const allPlans = await SubscriptionPlan.findAll({
      order: [['displayOrder', 'ASC']]
    });

    for (const plan of allPlans) {
      console.log(`  - ${plan.name} (${plan.tier}): ${plan.leadDiscountPercent}% discount, ${plan.priorityBoostPoints} boost points`);

      // Warn if PRO or PREMIUM tier has no discount
      if ((plan.tier === 'PRO' || plan.tier === 'PREMIUM') && plan.leadDiscountPercent === 0) {
        console.log(`    ⚠️  WARNING: ${plan.tier} tier plan has 0% discount!`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
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
renameSubscriptionPlans();

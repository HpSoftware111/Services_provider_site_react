/**
 * Migration Script: Rename Subscription Plans
 * 
 * Renames existing subscription plans:
 * - "Pro Plan" → "Growth Plan"
 * - "Premium Plan" → "Elite Plan"
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

    // Find Pro Plan
    const proPlan = await SubscriptionPlan.findOne({
      where: {
        tier: 'PRO'
      }
    });

    if (proPlan) {
      const oldName = proPlan.name;
      await proPlan.update({ name: 'Growth Plan' });
      console.log(`✅ Renamed: "${oldName}" → "Growth Plan" (tier: PRO, discount: ${proPlan.leadDiscountPercent}%)`);
    } else {
      console.log('⚠️  Pro Plan (tier: PRO) not found');
    }

    // Find Premium Plan
    const premiumPlan = await SubscriptionPlan.findOne({
      where: {
        tier: 'PREMIUM'
      }
    });

    if (premiumPlan) {
      const oldName = premiumPlan.name;
      await premiumPlan.update({ name: 'Elite Plan' });
      console.log(`✅ Renamed: "${oldName}" → "Elite Plan" (tier: PREMIUM, discount: ${premiumPlan.leadDiscountPercent}%)`);
    } else {
      console.log('⚠️  Premium Plan (tier: PREMIUM) not found');
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

/**
 * Script to Update Annual Subscription Plan Prices
 * 
 * Updates annual plan prices:
 * - Premium Plan (Annual): $299.9
 * - Pro Plan (Annual): $799.9
 * 
 * Usage: node backend/scripts/update-annual-plan-prices.js
 */

require('dotenv').config();
const { sequelize } = require('../config/database');
const SubscriptionPlan = require('../models/SubscriptionPlan');

async function updateAnnualPlanPrices() {
  try {
    console.log('🔄 Starting annual plan price update...\n');

    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Update Premium Plan (Annual)
    const premiumAnnual = await SubscriptionPlan.findOne({
      where: {
        name: 'Premium Plan (Annual)',
        billingCycle: 'YEARLY',
        tier: 'PREMIUM'
      }
    });

    if (premiumAnnual) {
      const oldPrice = parseFloat(premiumAnnual.price);
      if (oldPrice !== 299.9) {
        await premiumAnnual.update({ price: 299.9 });
        console.log(`✅ Updated Premium Plan (Annual): $${oldPrice.toFixed(2)} → $299.90`);
      } else {
        console.log(`✓ Premium Plan (Annual) already has correct price: $299.90`);
      }
    } else {
      console.log('⚠️  Premium Plan (Annual) not found');
    }

    // Update Pro Plan (Annual)
    const proAnnual = await SubscriptionPlan.findOne({
      where: {
        name: 'Pro Plan (Annual)',
        billingCycle: 'YEARLY',
        tier: 'PRO'
      }
    });

    if (proAnnual) {
      const oldPrice = parseFloat(proAnnual.price);
      if (oldPrice !== 799.9) {
        await proAnnual.update({ price: 799.9 });
        console.log(`✅ Updated Pro Plan (Annual): $${oldPrice.toFixed(2)} → $799.90`);
      } else {
        console.log(`✓ Pro Plan (Annual) already has correct price: $799.90`);
      }
    } else {
      console.log('⚠️  Pro Plan (Annual) not found');
    }

    // Verify all annual plans
    console.log('\n📋 Verifying annual plan prices:');
    const allAnnualPlans = await SubscriptionPlan.findAll({
      where: { billingCycle: 'YEARLY', isActive: true },
      order: [['displayOrder', 'ASC']]
    });

    if (allAnnualPlans.length === 0) {
      console.log('⚠️  No annual plans found in database');
      console.log('💡 Run: node backend/scripts/add-annual-plans.js to create annual plans');
    } else {
      allAnnualPlans.forEach(plan => {
        console.log(`  - ${plan.name}: $${parseFloat(plan.price).toFixed(2)}/year`);
      });
    }

    console.log('\n🎉 Annual plan price update completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating annual plan prices:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  updateAnnualPlanPrices();
}

module.exports = updateAnnualPlanPrices;


/**
 * Script to Check Annual Plans in Database
 * 
 * This script checks if annual plans exist in the database and shows their status.
 * 
 * Usage: node backend/scripts/check-annual-plans.js
 */

require('dotenv').config();
const { sequelize } = require('../config/database');
const SubscriptionPlan = require('../models/SubscriptionPlan');

async function checkAnnualPlans() {
  try {
    console.log('🔍 Checking annual plans in database...\n');

    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Get all plans
    const allPlans = await SubscriptionPlan.findAll({
      order: [['billingCycle', 'ASC'], ['displayOrder', 'ASC']]
    });

    console.log(`📋 Total plans in database: ${allPlans.length}\n`);

    const monthlyPlans = allPlans.filter(p => {
      const cycle = String(p.billingCycle || '').toUpperCase().trim();
      return cycle === 'MONTHLY';
    });

    const yearlyPlans = allPlans.filter(p => {
      const cycle = String(p.billingCycle || '').toUpperCase().trim();
      return cycle === 'YEARLY';
    });

    console.log(`📅 Monthly Plans (${monthlyPlans.length}):`);
    if (monthlyPlans.length === 0) {
      console.log('  ⚠️  No monthly plans found');
    } else {
      monthlyPlans.forEach(plan => {
        const isActive = plan.isActive ? '✅' : '❌';
        console.log(`  ${isActive} ${plan.name} - $${parseFloat(plan.price).toFixed(2)}/month (Active: ${plan.isActive})`);
      });
    }

    console.log(`\n📅 Annual Plans (${yearlyPlans.length}):`);
    if (yearlyPlans.length === 0) {
      console.log('  ⚠️  No annual plans found!');
      console.log('\n💡 To create annual plans, run:');
      console.log('   node backend/scripts/add-annual-plans.js');
    } else {
      yearlyPlans.forEach(plan => {
        const isActive = plan.isActive ? '✅' : '❌';
        console.log(`  ${isActive} ${plan.name} - $${parseFloat(plan.price).toFixed(2)}/year (Active: ${plan.isActive})`);
      });
    }

    // Check active plans only (what API returns)
    const activePlans = allPlans.filter(p => p.isActive === true);
    const activeMonthly = activePlans.filter(p => {
      const cycle = String(p.billingCycle || '').toUpperCase().trim();
      return cycle === 'MONTHLY';
    });
    const activeYearly = activePlans.filter(p => {
      const cycle = String(p.billingCycle || '').toUpperCase().trim();
      return cycle === 'YEARLY';
    });

    console.log(`\n📊 Active Plans Summary (what API returns):`);
    console.log(`  - Monthly: ${activeMonthly.length}`);
    console.log(`  - Annual: ${activeYearly.length}`);
    console.log(`  - Total: ${activePlans.length}`);

    if (activeYearly.length === 0) {
      console.log('\n⚠️  WARNING: No active annual plans found!');
      console.log('   The API will only return monthly plans.');
      console.log('   Run: node backend/scripts/add-annual-plans.js');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking annual plans:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  checkAnnualPlans();
}

module.exports = checkAnnualPlans;

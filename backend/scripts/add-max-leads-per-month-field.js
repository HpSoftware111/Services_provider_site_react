const { sequelize } = require('../config/database');
const { SubscriptionPlan } = require('../models');

async function migrate() {
  try {
    console.log('Running migration: Add maxLeadsPerMonth column to subscription_plans table...');
    const queryInterface = sequelize.getQueryInterface();
    const { DataTypes } = require('sequelize');

    // Check if column already exists
    const tableDesc = await queryInterface.describeTable('subscription_plans');

    if (!tableDesc.maxLeadsPerMonth) {
      console.log('\n1. Adding maxLeadsPerMonth column...');
      await queryInterface.addColumn('subscription_plans', 'maxLeadsPerMonth', {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment: 'Maximum number of leads/service requests per month. null = unlimited'
      });
      console.log('✓ Added maxLeadsPerMonth column to subscription_plans table');
    } else {
      console.log('✓ maxLeadsPerMonth column already exists');
    }

    // Update existing plans with default values
    console.log('\n2. Updating existing plans with maxLeadsPerMonth values...');

    const basicPlan = await SubscriptionPlan.findOne({ where: { tier: 'BASIC' } });
    if (basicPlan && basicPlan.maxLeadsPerMonth === null) {
      await basicPlan.update({ maxLeadsPerMonth: 10 });
      console.log('✓ Updated Basic Plan: maxLeadsPerMonth = 10');
    }

    const proPlan = await SubscriptionPlan.findOne({ where: { tier: 'PRO' } });
    if (proPlan && proPlan.maxLeadsPerMonth === null) {
      await proPlan.update({ maxLeadsPerMonth: null }); // Unlimited
      console.log('✓ Updated Pro Plan: maxLeadsPerMonth = null (unlimited)');
    }

    const premiumPlan = await SubscriptionPlan.findOne({ where: { tier: 'PREMIUM' } });
    if (premiumPlan && premiumPlan.maxLeadsPerMonth === null) {
      await premiumPlan.update({ maxLeadsPerMonth: 30 });
      console.log('✓ Updated Premium Plan: maxLeadsPerMonth = 30');
    }

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();

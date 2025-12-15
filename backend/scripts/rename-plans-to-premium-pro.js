/**
 * SAFE rename of subscription plans with UNIQUE(tier)
 *
 * Final result:
 * - Basic Plan   → BASIC
 * - Premium Plan → PREMIUM (was Growth Plan)
 * - Pro Plan     → PRO (was Elite Plan)
 *
 * This version DOES NOT reference maxLeadsPerMonth at all.
 */

require('dotenv').config();
const { sequelize } = require('../config/database');
const { SubscriptionPlan } = require('../models');

const TEMP_TIER = 'TEMP_SWAP';

// Explicit safe attributes (NO maxLeadsPerMonth)
const SAFE_ATTRIBUTES = [
  'id',
  'name',
  'tier',
  'price',
  'billingCycle',
  'description',
  'features',
  'isActive',
  'displayOrder',
  'leadDiscountPercent',
  'priorityBoostPoints',
  'isFeatured',
  'hasAdvancedAnalytics',
  'createdAt',
  'updatedAt'
];

async function renamePlans() {
  console.log('\n🔄 Starting subscription plan rename migration...\n');

  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Load plans safely
    const growthPlan = await SubscriptionPlan.findOne({
      where: { name: 'Growth Plan' },
      attributes: SAFE_ATTRIBUTES
    });

    const elitePlan = await SubscriptionPlan.findOne({
      where: { name: 'Elite Plan' },
      attributes: SAFE_ATTRIBUTES
    });

    console.log('📋 Current plan state:');
    if (growthPlan) console.log(`  - Growth Plan → ${growthPlan.tier}`);
    if (elitePlan) console.log(`  - Elite Plan  → ${elitePlan.tier}`);
    console.log('');

    await sequelize.transaction(async (t) => {

      /**
       * CASE 1 — Swap Growth(PRO) ↔ Elite(PREMIUM)
       */
      if (
        growthPlan &&
        elitePlan &&
        growthPlan.tier === 'PRO' &&
        elitePlan.tier === 'PREMIUM'
      ) {
        console.log('🔄 Swapping tiers using TEMP_SWAP...');

        // Step 1 — Free PREMIUM
        await elitePlan.update(
          { tier: TEMP_TIER },
          { transaction: t }
        );
        console.log('  → Elite Plan → TEMP_SWAP');

        // Step 2 — Growth → Premium
        await growthPlan.update(
          {
            name: 'Premium Plan',
            tier: 'PREMIUM'
          },
          { transaction: t }
        );
        console.log('  → Growth Plan → Premium Plan');

        // Step 3 — Elite → Pro
        await elitePlan.update(
          {
            name: 'Pro Plan',
            tier: 'PRO'
          },
          { transaction: t }
        );
        console.log('  → Elite Plan → Pro Plan');
      }

      /**
       * CASE 2 — Only Growth Plan exists
       */
      else if (growthPlan) {
        console.log('ℹ️ Only Growth Plan found');

        const premium = await SubscriptionPlan.findOne({
          where: { tier: 'PREMIUM' },
          attributes: SAFE_ATTRIBUTES,
          transaction: t
        });

        if (premium && premium.id !== growthPlan.id) {
          await premium.update({ tier: TEMP_TIER }, { transaction: t });
        }

        await growthPlan.update(
          { name: 'Premium Plan', tier: 'PREMIUM' },
          { transaction: t }
        );
      }

      /**
       * CASE 3 — Only Elite Plan exists
       */
      else if (elitePlan) {
        console.log('ℹ️ Only Elite Plan found');

        const pro = await SubscriptionPlan.findOne({
          where: { tier: 'PRO' },
          attributes: SAFE_ATTRIBUTES,
          transaction: t
        });

        if (pro && pro.id !== elitePlan.id) {
          await pro.update({ tier: TEMP_TIER }, { transaction: t });
        }

        await elitePlan.update(
          { name: 'Pro Plan', tier: 'PRO' },
          { transaction: t }
        );
      }

      /**
       * CASE 4 — Fallback by tier
       */
      else {
        console.log('⚠️ No plans found by name — fixing by tier');

        const premium = await SubscriptionPlan.findOne({
          where: { tier: 'PREMIUM' },
          attributes: SAFE_ATTRIBUTES,
          transaction: t
        });

        const pro = await SubscriptionPlan.findOne({
          where: { tier: 'PRO' },
          attributes: SAFE_ATTRIBUTES,
          transaction: t
        });

        if (premium && premium.name !== 'Premium Plan') {
          await premium.update({ name: 'Premium Plan' }, { transaction: t });
        }

        if (pro && pro.name !== 'Pro Plan') {
          await pro.update({ name: 'Pro Plan' }, { transaction: t });
        }
      }
    });

    // Final verification
    console.log('\n📊 Final plan state:\n');

    const plans = await SubscriptionPlan.findAll({
      order: [['displayOrder', 'ASC']],
      attributes: SAFE_ATTRIBUTES
    });

    for (const p of plans) {
      console.log(`  - ${p.name} (${p.tier})`);
    }

    console.log('\n✅ Migration completed successfully\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed');
    console.error(error.message);
    process.exit(1);
  }
}

renamePlans();

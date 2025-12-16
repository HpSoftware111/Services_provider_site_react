const express = require('express');
const router = express.Router();
const { SubscriptionPlan, UserSubscription, User, Business } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const stripe = require('../config/stripe');
const getSubscriptionBenefits = require('../utils/getSubscriptionBenefits');
const getMonthlyServiceRequestCount = require('../utils/getMonthlyServiceRequestCount');

// @route   GET /api/subscriptions/plans
// @desc    Get all active subscription plans (for business owners only)
// @access  Private (Business owner only)
// @query   billingCycle - Optional filter by billing cycle (MONTHLY or YEARLY)
router.get('/plans', protect, async (req, res) => {
  try {
    // Only allow business owners to see subscription plans
    if (req.user.role !== 'business_owner' && req.user.role !== 'admin') {
      // Check if user has any businesses
      const userBusinesses = await Business.count({ where: { ownerId: req.user.id } });
      if (userBusinesses === 0 && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'You must have a business to view subscription plans'
        });
      }
    }

    // Build where clause with optional billing cycle filter
    const whereClause = { isActive: true };
    if (req.query.billingCycle && ['MONTHLY', 'YEARLY'].includes(req.query.billingCycle.toUpperCase())) {
      whereClause.billingCycle = req.query.billingCycle.toUpperCase();
    }

    // Use try-catch to handle missing columns gracefully if migration hasn't been run
    let plans;
    try {
      plans = await SubscriptionPlan.findAll({
        where: whereClause,
        order: [['displayOrder', 'ASC'], ['price', 'ASC']],
        attributes: ['id', 'name', 'tier', 'price', 'billingCycle', 'description', 'features', 'leadDiscountPercent', 'priorityBoostPoints', 'isFeatured', 'hasAdvancedAnalytics', 'maxLeadsPerMonth']
      });

      // Debug logging
      console.log(`📋 Found ${plans.length} active subscription plan(s)`);
      const monthlyCount = plans.filter(p => p.billingCycle === 'MONTHLY').length;
      const yearlyCount = plans.filter(p => p.billingCycle === 'YEARLY').length;
      console.log(`  - Monthly: ${monthlyCount}, Annual: ${yearlyCount}`);
      if (yearlyCount === 0 && !req.query.billingCycle) {
        console.log('⚠️  No annual plans found in database. Run: node backend/scripts/add-annual-plans.js');
      }
    } catch (dbError) {
      // If error is about missing columns, try with explicit attributes (migration not run yet)
      if (dbError.message && dbError.message.includes('Unknown column')) {
        console.log('Migration not run yet, using explicit attributes for subscription plans...');
        plans = await SubscriptionPlan.findAll({
          where: whereClause,
          order: [['displayOrder', 'ASC'], ['price', 'ASC']],
          attributes: ['id', 'name', 'tier', 'price', 'billingCycle', 'description', 'features', 'leadDiscountPercent', 'priorityBoostPoints', 'isFeatured', 'hasAdvancedAnalytics']
        });
        // Add default maxLeadsPerMonth for plans that don't have it in DB yet
        plans = plans.map(plan => {
          const planData = plan.toJSON();
          // Set default based on tier if maxLeadsPerMonth column doesn't exist
          if (planData.tier === 'BASIC') {
            planData.maxLeadsPerMonth = 10;
          } else if (planData.tier === 'PREMIUM') {
            planData.maxLeadsPerMonth = 30;
          } else if (planData.tier === 'PRO') {
            planData.maxLeadsPerMonth = null; // Unlimited
          } else {
            planData.maxLeadsPerMonth = 10; // Default
          }
          return planData;
        });
      } else {
        throw dbError;
      }
    }

    res.json({
      success: true,
      plans
    });
  } catch (error) {
    console.error('Get subscription plans error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   GET /api/subscriptions/my-subscription
// @desc    Get current user subscription for logged-in user
// @access  Private (Business owner only)
router.get('/my-subscription', protect, async (req, res) => {
  try {
    // Use try-catch to handle missing columns gracefully if migration hasn't been run
    let subscription;
    try {
      subscription = await UserSubscription.findOne({
        where: { userId: req.user.id },
        include: [
          {
            model: SubscriptionPlan,
            as: 'plan',
            attributes: ['id', 'name', 'tier', 'price', 'billingCycle', 'description', 'features', 'leadDiscountPercent', 'priorityBoostPoints', 'isFeatured', 'hasAdvancedAnalytics', 'maxLeadsPerMonth']
          }
        ]
      });
    } catch (dbError) {
      // If error is about missing columns, try with explicit attributes (migration not run yet)
      if (dbError.message && dbError.message.includes('Unknown column')) {
        console.log('Migration not run yet, using explicit attributes for subscription in my-subscription...');
        subscription = await UserSubscription.findOne({
          where: { userId: req.user.id },
          include: [
            {
              model: SubscriptionPlan,
              as: 'plan',
              attributes: ['id', 'name', 'tier', 'price', 'billingCycle', 'description', 'features', 'leadDiscountPercent', 'priorityBoostPoints', 'isFeatured', 'hasAdvancedAnalytics']
            }
          ]
        });
        // Add default maxLeadsPerMonth if plan exists
        if (subscription && subscription.plan) {
          const planData = subscription.plan.toJSON();
          if (planData.tier === 'BASIC') {
            planData.maxLeadsPerMonth = 10;
          } else if (planData.tier === 'PREMIUM') {
            planData.maxLeadsPerMonth = 30;
          } else if (planData.tier === 'PRO') {
            planData.maxLeadsPerMonth = null; // Unlimited
          } else {
            planData.maxLeadsPerMonth = 10; // Default
          }
          subscription.plan = planData;
        }
      } else {
        throw dbError;
      }
    }

    // Check if subscription has expired based on currentPeriodEnd (using UTC time)
    if (subscription && subscription.status === 'ACTIVE' && subscription.currentPeriodEnd) {
      const now = new Date();
      const periodEnd = new Date(subscription.currentPeriodEnd);
      
      // Compare dates in UTC to avoid timezone issues
      if (periodEnd < now) {
        // Subscription has expired - update status
        await subscription.update({ status: 'EXPIRED' });
        subscription.status = 'EXPIRED';
        console.log(`[my-subscription] Updated subscription ${subscription.id} to EXPIRED (period ended: ${periodEnd.toISOString()})`);
      }
    }

    res.json({
      success: true,
      subscription: subscription || null
    });
  } catch (error) {
    console.error('Get my subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   GET /api/subscriptions/debug-benefits
// @desc    Get detailed subscription benefits for debugging
// @access  Private (Business owner only)
router.get('/debug-benefits', protect, async (req, res) => {
  try {
    const getSubscriptionBenefits = require('../utils/getSubscriptionBenefits');
    const { getLeadCost, getLeadCostWithDiscount } = require('../config/leadPricing');

    // Get subscription details
    // Use try-catch to handle missing columns gracefully if migration hasn't been run
    let subscription;
    try {
      subscription = await UserSubscription.findOne({
        where: { userId: req.user.id },
        include: [
          {
            model: SubscriptionPlan,
            as: 'plan',
            attributes: ['id', 'name', 'tier', 'price', 'billingCycle', 'description', 'features', 'leadDiscountPercent', 'priorityBoostPoints', 'isFeatured', 'hasAdvancedAnalytics', 'maxLeadsPerMonth']
          }
        ]
      });
    } catch (dbError) {
      // If error is about missing columns, try with explicit attributes (migration not run yet)
      if (dbError.message && dbError.message.includes('Unknown column')) {
        console.log('Migration not run yet, using explicit attributes for subscription in debug...');
        subscription = await UserSubscription.findOne({
          where: { userId: req.user.id },
          include: [
            {
              model: SubscriptionPlan,
              as: 'plan',
              attributes: ['id', 'name', 'tier', 'price', 'billingCycle', 'description', 'features', 'leadDiscountPercent', 'priorityBoostPoints', 'isFeatured', 'hasAdvancedAnalytics']
            }
          ]
        });
        // Add default maxLeadsPerMonth if plan exists
        if (subscription && subscription.plan) {
          const planData = subscription.plan.toJSON();
          if (planData.tier === 'BASIC') {
            planData.maxLeadsPerMonth = 10;
          } else if (planData.tier === 'PREMIUM') {
            planData.maxLeadsPerMonth = 30;
          } else if (planData.tier === 'PRO') {
            planData.maxLeadsPerMonth = null; // Unlimited
          } else {
            planData.maxLeadsPerMonth = 10; // Default
          }
          subscription.plan = planData;
        }
      } else {
        throw dbError;
      }
    }

    // Get subscription benefits
    const benefits = await getSubscriptionBenefits(req.user.id);

    // Calculate example lead costs
    const baseLeadCost = getLeadCost(null);
    const discountedLeadCost = getLeadCostWithDiscount(null, benefits);

    const debugInfo = {
      userId: req.user.id,
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelledAt: subscription.cancelledAt,
        plan: subscription.plan ? {
          id: subscription.plan.id,
          name: subscription.plan.name,
          tier: subscription.plan.tier,
          price: subscription.plan.price,
          leadDiscountPercent: subscription.plan.leadDiscountPercent,
          priorityBoostPoints: subscription.plan.priorityBoostPoints
        } : null
      } : null,
      benefits: benefits,
      leadCosts: {
        baseCost: baseLeadCost / 100, // Convert cents to dollars
        discountedCost: discountedLeadCost / 100,
        savings: (baseLeadCost - discountedLeadCost) / 100,
        discountApplied: baseLeadCost !== discountedLeadCost
      },
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      debug: debugInfo
    });
  } catch (error) {
    console.error('Debug benefits error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
});

// @route   POST /api/subscriptions/create-payment-intent
// @desc    Create payment intent for subscription
// @access  Private (Business owner only)
router.post('/create-payment-intent', protect, async (req, res) => {
  try {
    const { subscriptionPlanId } = req.body;

    if (!subscriptionPlanId) {
      return res.status(400).json({
        success: false,
        error: 'Subscription plan ID is required'
      });
    }

    // Verify plan exists (handle possible missing columns like maxLeadsPerMonth by using explicit attributes)
    const plan = await SubscriptionPlan.findOne({
      where: {
        id: subscriptionPlanId,
        isActive: true
      },
      attributes: [
        'id',
        'name',
        'tier',
        'price',
        'billingCycle',
        'description',
        'features',
        'leadDiscountPercent',
        'priorityBoostPoints',
        'isFeatured',
        'hasAdvancedAnalytics'
      ]
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Subscription plan not found'
      });
    }

    // Skip payment for free plans
    const planPrice = parseFloat(plan.price || 0);
    if (planPrice === 0) {
      return res.status(400).json({
        success: false,
        error: 'Free plans do not require payment'
      });
    }

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Payment processing is not configured'
      });
    }

    // Get user information
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Calculate amount in cents
    const amountInCents = Math.round(planPrice * 100);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      metadata: {
        type: 'subscription',
        userId: req.user.id.toString(),
        subscriptionPlanId: subscriptionPlanId.toString(),
        planName: plan.name,
        planTier: plan.tier || '',
        billingCycle: plan.billingCycle || 'MONTHLY'
      },
      description: `Subscription payment for ${plan.name}`,
      automatic_payment_methods: {
        enabled: true
      }
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
});

// @route   POST /api/subscriptions/subscribe
// @desc    Subscribe user to a plan after payment
// @access  Private (Business owner only)
router.post('/subscribe', protect, async (req, res) => {
  try {
    const { subscriptionPlanId, paymentIntentId } = req.body;

    if (!subscriptionPlanId) {
      return res.status(400).json({
        success: false,
        error: 'Subscription plan ID is required'
      });
    }

    // Verify plan exists (use explicit attributes to avoid missing-column errors)
    const plan = await SubscriptionPlan.findOne({
      where: {
        id: subscriptionPlanId,
        isActive: true
      },
      attributes: [
        'id',
        'name',
        'tier',
        'price',
        'billingCycle',
        'description',
        'features',
        'leadDiscountPercent',
        'priorityBoostPoints',
        'isFeatured',
        'hasAdvancedAnalytics'
      ]
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Subscription plan not found'
      });
    }

    const planPrice = parseFloat(plan.price || 0);

    // For paid plans, verify payment
    if (planPrice > 0) {
      if (!paymentIntentId) {
        return res.status(400).json({
          success: false,
          error: 'Payment intent ID is required for paid plans'
        });
      }

      // Verify payment intent with Stripe
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        // Verify payment succeeded
        if (paymentIntent.status !== 'succeeded') {
          return res.status(400).json({
            success: false,
            error: `Payment not completed. Status: ${paymentIntent.status}`
          });
        }

        // Verify metadata matches
        if (paymentIntent.metadata.userId !== req.user.id.toString() ||
          paymentIntent.metadata.subscriptionPlanId !== subscriptionPlanId.toString()) {
          return res.status(400).json({
            success: false,
            error: 'Payment intent does not match subscription request'
          });
        }

        // Verify amount matches
        const expectedAmount = Math.round(planPrice * 100);
        if (paymentIntent.amount !== expectedAmount) {
          return res.status(400).json({
            success: false,
            error: 'Payment amount does not match plan price'
          });
        }
      } catch (stripeError) {
        console.error('Stripe payment verification error:', stripeError);
        return res.status(400).json({
          success: false,
          error: 'Payment verification failed'
        });
      }
    }

    // Check if user already has a subscription
    const existingSubscription = await UserSubscription.findOne({
      where: { userId: req.user.id }
    });

    if (existingSubscription) {
      // Update existing subscription
      await existingSubscription.update({
        subscriptionPlanId,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: plan.billingCycle === 'MONTHLY'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        cancelledAt: null
      });

      let updatedSubscription;
      try {
        updatedSubscription = await UserSubscription.findByPk(existingSubscription.id, {
          include: [
            {
              model: SubscriptionPlan,
              as: 'plan',
              attributes: [
                'id',
                'name',
                'tier',
                'price',
                'billingCycle',
                'description',
                'features',
                'leadDiscountPercent',
                'priorityBoostPoints',
                'isFeatured',
                'hasAdvancedAnalytics',
                'maxLeadsPerMonth'
              ]
            }
          ]
        });
      } catch (dbError) {
        // Handle case where maxLeadsPerMonth column does not exist yet
        if (dbError.message && dbError.message.includes('Unknown column')) {
          console.log('Migration not run yet, using explicit attributes for subscription plan in subscribe (update)...');
          updatedSubscription = await UserSubscription.findByPk(existingSubscription.id, {
            include: [
              {
                model: SubscriptionPlan,
                as: 'plan',
                attributes: [
                  'id',
                  'name',
                  'tier',
                  'price',
                  'billingCycle',
                  'description',
                  'features',
                  'leadDiscountPercent',
                  'priorityBoostPoints',
                  'isFeatured',
                  'hasAdvancedAnalytics'
                ]
              }
            ]
          });
          if (updatedSubscription && updatedSubscription.plan) {
            const planData = updatedSubscription.plan.toJSON();
            if (planData.tier === 'BASIC') {
              planData.maxLeadsPerMonth = 10;
            } else if (planData.tier === 'PREMIUM') {
              planData.maxLeadsPerMonth = 30;
            } else if (planData.tier === 'PRO') {
              planData.maxLeadsPerMonth = null;
            } else {
              planData.maxLeadsPerMonth = 10;
            }
            updatedSubscription.plan = planData;
          }
        } else {
          throw dbError;
        }
      }

      return res.json({
        success: true,
        message: 'Subscription updated successfully',
        subscription: updatedSubscription
      });
    } else {
      // Create new subscription
      const subscription = await UserSubscription.create({
        userId: req.user.id,
        subscriptionPlanId,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: plan.billingCycle === 'MONTHLY'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      });

      let newSubscription;
      try {
        newSubscription = await UserSubscription.findByPk(subscription.id, {
          include: [
            {
              model: SubscriptionPlan,
              as: 'plan',
              attributes: [
                'id',
                'name',
                'tier',
                'price',
                'billingCycle',
                'description',
                'features',
                'leadDiscountPercent',
                'priorityBoostPoints',
                'isFeatured',
                'hasAdvancedAnalytics',
                'maxLeadsPerMonth'
              ]
            }
          ]
        });
      } catch (dbError) {
        if (dbError.message && dbError.message.includes('Unknown column')) {
          console.log('Migration not run yet, using explicit attributes for subscription plan in subscribe (create)...');
          newSubscription = await UserSubscription.findByPk(subscription.id, {
            include: [
              {
                model: SubscriptionPlan,
                as: 'plan',
                attributes: [
                  'id',
                  'name',
                  'tier',
                  'price',
                  'billingCycle',
                  'description',
                  'features',
                  'leadDiscountPercent',
                  'priorityBoostPoints',
                  'isFeatured',
                  'hasAdvancedAnalytics'
                ]
              }
            ]
          });
          if (newSubscription && newSubscription.plan) {
            const planData = newSubscription.plan.toJSON();
            if (planData.tier === 'BASIC') {
              planData.maxLeadsPerMonth = 10;
            } else if (planData.tier === 'PREMIUM') {
              planData.maxLeadsPerMonth = 30;
            } else if (planData.tier === 'PRO') {
              planData.maxLeadsPerMonth = null;
            } else {
              planData.maxLeadsPerMonth = 10;
            }
            newSubscription.plan = planData;
          }
        } else {
          throw dbError;
        }
      }

      return res.status(201).json({
        success: true,
        message: 'Subscription created successfully',
        subscription: newSubscription
      });
    }
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
});

// @route   GET /api/subscriptions/monthly-usage
// @desc    Get monthly service request usage for current user
// @access  Private
router.get('/monthly-usage', protect, async (req, res) => {
  try {
    const subscriptionBenefits = await getSubscriptionBenefits(req.user.id);
    const monthlyCount = await getMonthlyServiceRequestCount(req.user.id);

    res.json({
      success: true,
      usage: {
        currentCount: monthlyCount,
        maxLimit: subscriptionBenefits.maxLeadsPerMonth,
        isUnlimited: subscriptionBenefits.maxLeadsPerMonth === null,
        planTier: subscriptionBenefits.tier,
        planName: subscriptionBenefits.planName || subscriptionBenefits.tier
      }
    });
  } catch (error) {
    console.error('Get monthly usage error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   POST /api/subscriptions/cancel
// @desc    Cancel user subscription
// @access  Private (Business owner only)
router.post('/cancel', protect, async (req, res) => {
  try {
    const subscription = await UserSubscription.findOne({
      where: { userId: req.user.id, status: 'ACTIVE' }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found'
      });
    }

    await subscription.update({
      status: 'CANCELLED',
      cancelledAt: new Date()
    });

    res.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;

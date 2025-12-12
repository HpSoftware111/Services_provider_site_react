const express = require('express');
const router = express.Router();
const { SubscriptionPlan, UserSubscription, User, Business } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const stripe = require('../config/stripe');

// @route   GET /api/subscriptions/plans
// @desc    Get all active subscription plans (for business owners only)
// @access  Private (Business owner only)
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

    const plans = await SubscriptionPlan.findAll({
      where: { isActive: true },
      order: [['displayOrder', 'ASC'], ['price', 'ASC']],
      attributes: ['id', 'name', 'tier', 'price', 'billingCycle', 'description', 'features', 'leadDiscountPercent', 'priorityBoostPoints', 'isFeatured', 'hasAdvancedAnalytics']
    });

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
    const subscription = await UserSubscription.findOne({
      where: { userId: req.user.id },
      include: [
        {
          model: SubscriptionPlan,
          as: 'plan',
          attributes: ['id', 'name', 'tier', 'price', 'billingCycle', 'description', 'features', 'leadDiscountPercent', 'priorityBoostPoints', 'isFeatured', 'hasAdvancedAnalytics']
        }
      ]
    });

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
    const subscription = await UserSubscription.findOne({
      where: { userId: req.user.id },
      include: [
        {
          model: SubscriptionPlan,
          as: 'plan',
          attributes: ['id', 'name', 'tier', 'price', 'billingCycle', 'description', 'features', 'leadDiscountPercent', 'priorityBoostPoints', 'isFeatured', 'hasAdvancedAnalytics']
        }
      ]
    });

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

    // Verify plan exists
    const plan = await SubscriptionPlan.findOne({
      where: {
        id: subscriptionPlanId,
        isActive: true
      }
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

    // Verify plan exists
    const plan = await SubscriptionPlan.findOne({
      where: {
        id: subscriptionPlanId,
        isActive: true
      }
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

      const updatedSubscription = await UserSubscription.findByPk(existingSubscription.id, {
        include: [
          {
            model: SubscriptionPlan,
            as: 'plan',
            attributes: ['id', 'name', 'tier', 'price', 'billingCycle', 'description', 'features', 'leadDiscountPercent', 'priorityBoostPoints', 'isFeatured', 'hasAdvancedAnalytics']
          }
        ]
      });

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

      const newSubscription = await UserSubscription.findByPk(subscription.id, {
        include: [
          {
            model: SubscriptionPlan,
            as: 'plan',
            attributes: ['id', 'name', 'tier', 'price', 'billingCycle', 'description', 'features', 'leadDiscountPercent', 'priorityBoostPoints', 'isFeatured', 'hasAdvancedAnalytics']
          }
        ]
      });

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

const { UserSubscription, SubscriptionPlan } = require('../models');

/**
 * Get subscription benefits for a user
 * @param {number} userId - The user ID
 * @returns {Promise<Object>} Subscription benefits object
 */
async function getSubscriptionBenefits(userId) {
    try {
        // Find active subscription for user
        const subscription = await UserSubscription.findOne({
            where: {
                userId: userId,
                status: 'ACTIVE'
            },
            include: [
                {
                    model: SubscriptionPlan,
                    as: 'plan',
                    attributes: [
                        'id',
                        'name',
                        'tier',
                        'leadDiscountPercent',
                        'priorityBoostPoints',
                        'isFeatured',
                        'hasAdvancedAnalytics',
                        'maxLeadsPerMonth'
                    ]
                }
            ]
        });

        // If no active subscription, return default values (BASIC plan limits)
        if (!subscription || !subscription.plan) {
            return {
                hasActiveSubscription: false,
                tier: 'BASIC',
                leadDiscountPercent: 0,
                priorityBoostPoints: 0,
                isFeatured: false,
                hasAdvancedAnalytics: false,
                maxLeadsPerMonth: 10 // Default BASIC plan limit
            };
        }

        // Check if subscription is still within current period
        const now = new Date();
        if (subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) < now) {
            // Subscription expired
            return {
                hasActiveSubscription: false,
                tier: 'BASIC',
                leadDiscountPercent: 0,
                priorityBoostPoints: 0,
                isFeatured: false,
                hasAdvancedAnalytics: false,
                maxLeadsPerMonth: 10 // Default BASIC plan limit
            };
        }

        const plan = subscription.plan;

        return {
            hasActiveSubscription: true,
            tier: plan.tier || 'BASIC',
            leadDiscountPercent: parseFloat(plan.leadDiscountPercent || 0),
            priorityBoostPoints: parseInt(plan.priorityBoostPoints || 0),
            isFeatured: plan.isFeatured || false,
            hasAdvancedAnalytics: plan.hasAdvancedAnalytics || false,
            maxLeadsPerMonth: plan.maxLeadsPerMonth !== null && plan.maxLeadsPerMonth !== undefined
                ? parseInt(plan.maxLeadsPerMonth)
                : null, // null means unlimited
            subscriptionId: subscription.id,
            planId: plan.id,
            planName: plan.name
        };
    } catch (error) {
        console.error('Error getting subscription benefits:', error);
        // Return default values on error
        return {
            hasActiveSubscription: false,
            tier: 'BASIC',
            leadDiscountPercent: 0,
            priorityBoostPoints: 0,
            isFeatured: false,
            hasAdvancedAnalytics: false,
            maxLeadsPerMonth: 10 // Default BASIC plan limit
        };
    }
}

module.exports = getSubscriptionBenefits;



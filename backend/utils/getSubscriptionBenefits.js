const { UserSubscription, SubscriptionPlan } = require('../models');

/**
 * Get subscription benefits for a user
 * @param {number} userId - The user ID
 * @returns {Promise<Object>} Subscription benefits object
 */
async function getSubscriptionBenefits(userId) {
    try {
        // Find active subscription for user
        // Use try-catch to handle missing columns gracefully if migration hasn't been run
        let subscription;
        try {
            subscription = await UserSubscription.findOne({
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
        } catch (dbError) {
            // If error is about missing columns, try with explicit attributes (migration not run yet)
            if (dbError.message && dbError.message.includes('Unknown column')) {
                console.log('Migration not run yet, using explicit attributes for subscription plan in getSubscriptionBenefits...');
                subscription = await UserSubscription.findOne({
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
                                'hasAdvancedAnalytics'
                            ]
                        }
                    ]
                });
            } else {
                throw dbError;
            }
        }

        // If no active subscription, return default values (BASIC plan limits)
        if (!subscription || !subscription.plan) {
            console.log(`[getSubscriptionBenefits] No active subscription found for user ${userId}`);
            return {
                hasActiveSubscription: false,
                tier: 'BASIC',
                leadDiscountPercent: 0,
                priorityBoostPoints: 0,
                isFeatured: false,
                hasAdvancedAnalytics: false,
                maxLeadsPerMonth: 10, // Default BASIC plan limit
                planName: 'Basic Plan'
            };
        }

        // Check if subscription is still within current period
        const now = new Date();
        if (subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) < now) {
            // Subscription expired
            console.log(`[getSubscriptionBenefits] Subscription expired for user ${userId}, period ended: ${subscription.currentPeriodEnd}`);
            return {
                hasActiveSubscription: false,
                tier: 'BASIC',
                leadDiscountPercent: 0,
                priorityBoostPoints: 0,
                isFeatured: false,
                hasAdvancedAnalytics: false,
                maxLeadsPerMonth: 10, // Default BASIC plan limit
                planName: 'Basic Plan'
            };
        }

        const plan = subscription.plan;
        const planData = plan.toJSON ? plan.toJSON() : plan;

        // Determine maxLeadsPerMonth based on tier if column doesn't exist
        let maxLeadsPerMonth;
        if (planData.maxLeadsPerMonth !== null && planData.maxLeadsPerMonth !== undefined) {
            maxLeadsPerMonth = parseInt(planData.maxLeadsPerMonth);
        } else {
            // Apply default based on tier if column doesn't exist
            const tier = (planData.tier || 'BASIC').toUpperCase();
            if (tier === 'BASIC') {
                maxLeadsPerMonth = 10;
            } else if (tier === 'PREMIUM') {
                maxLeadsPerMonth = 30;
            } else if (tier === 'PRO') {
                maxLeadsPerMonth = null; // Unlimited
            } else {
                maxLeadsPerMonth = 10; // Default
            }
        }

        // Format plan name for display (capitalize first letter, handle "Premium Plan", "Pro Plan", etc.)
        let planName = planData.name || planData.tier || 'Basic';
        // If plan name is just the tier, format it nicely
        if (planName.toUpperCase() === 'PREMIUM' || planName.toUpperCase() === 'PRO' || planName.toUpperCase() === 'BASIC') {
            planName = planName.charAt(0).toUpperCase() + planName.slice(1).toLowerCase() + ' Plan';
        }

        console.log(`[getSubscriptionBenefits] Found active subscription for user ${userId}:`, {
            planName: planName,
            tier: planData.tier,
            maxLeadsPerMonth: maxLeadsPerMonth,
            subscriptionId: subscription.id
        });

        return {
            hasActiveSubscription: true,
            tier: planData.tier || 'BASIC',
            leadDiscountPercent: parseFloat(planData.leadDiscountPercent || 0),
            priorityBoostPoints: parseInt(planData.priorityBoostPoints || 0),
            isFeatured: planData.isFeatured || false,
            hasAdvancedAnalytics: planData.hasAdvancedAnalytics || false,
            maxLeadsPerMonth: maxLeadsPerMonth,
            subscriptionId: subscription.id,
            planId: planData.id,
            planName: planName
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



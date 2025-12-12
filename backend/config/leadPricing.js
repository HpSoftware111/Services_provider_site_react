/**
 * Lead Pricing Configuration
 * 
 * Defines the cost for providers to accept leads.
 * Can be configured per category or globally.
 */

// Global default lead cost (in cents)
const DEFAULT_LEAD_COST = 2000; // $20.00

// Category-specific pricing (in cents)
// Key: categoryId, Value: cost in cents
const CATEGORY_PRICING = {
    // Example: category 1 costs $10.00
    // 1: 1000,
    // Example: category 2 costs $7.50
    // 2: 750,
};

/**
 * Get the lead cost for a given category
 * @param {number|null} categoryId - The category ID (optional)
 * @returns {number} Cost in cents
 */
function getLeadCost(categoryId = null) {
    if (categoryId && CATEGORY_PRICING[categoryId]) {
        return CATEGORY_PRICING[categoryId];
    }
    return DEFAULT_LEAD_COST;
}

/**
 * Get the lead cost in dollars
 * @param {number|null} categoryId - The category ID (optional)
 * @returns {number} Cost in dollars
 */
function getLeadCostInDollars(categoryId = null) {
    return getLeadCost(categoryId) / 100;
}

/**
 * Get the lead cost with subscription discount applied
 * @param {number|null} categoryId - The category ID (optional)
 * @param {Object} subscriptionBenefits - Subscription benefits object from getSubscriptionBenefits
 * @returns {number} Cost in cents after discount
 */
function getLeadCostWithDiscount(categoryId = null, subscriptionBenefits = null) {
    const baseCost = getLeadCost(categoryId);

    // If no subscription benefits or no active subscription, return base cost
    if (!subscriptionBenefits || !subscriptionBenefits.hasActiveSubscription) {
        return baseCost;
    }

    // Apply discount percentage
    const discountPercent = subscriptionBenefits.leadDiscountPercent || 0;
    if (discountPercent <= 0) {
        return baseCost;
    }

    // Calculate discounted cost
    const discountAmount = (baseCost * discountPercent) / 100;
    const discountedCost = baseCost - discountAmount;

    // Ensure cost is not negative and is at least 1 cent
    return Math.max(1, Math.round(discountedCost));
}

module.exports = {
    DEFAULT_LEAD_COST,
    CATEGORY_PRICING,
    getLeadCost,
    getLeadCostInDollars,
    getLeadCostWithDiscount
};


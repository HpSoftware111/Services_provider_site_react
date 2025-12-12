/**
 * Platform fee configuration
 * Platform keeps 10% fee, provider receives 90%
 */

const PLATFORM_FEE_PERCENTAGE = parseFloat(process.env.PLATFORM_FEE_PERCENTAGE) || 0.10; // 10%
const PLATFORM_FEE_MINIMUM = parseFloat(process.env.PLATFORM_FEE_MINIMUM) || 0; // Minimum fee in dollars (optional)

/**
 * Calculate provider payout and platform fee
 * @param {number} totalAmount - Total proposal price in dollars
 * @returns {Object} { providerAmount, platformFee, providerAmountCents, platformFeeCents, totalCents }
 */
function calculatePayouts(totalAmount) {
    if (!totalAmount || totalAmount <= 0) {
        throw new Error('Total amount must be greater than 0');
    }

    const totalCents = Math.round(totalAmount * 100);
    const platformFeeCents = Math.max(
        Math.round(totalCents * PLATFORM_FEE_PERCENTAGE),
        Math.round(PLATFORM_FEE_MINIMUM * 100)
    );
    const providerAmountCents = totalCents - platformFeeCents;

    return {
        providerAmount: providerAmountCents / 100, // Convert back to dollars
        platformFee: platformFeeCents / 100,
        providerAmountCents,
        platformFeeCents,
        totalCents
    };
}

/**
 * Format currency for display
 * @param {number} amount - Amount in dollars
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
    return `$${parseFloat(amount || 0).toFixed(2)}`;
}

module.exports = {
    PLATFORM_FEE_PERCENTAGE,
    PLATFORM_FEE_MINIMUM,
    calculatePayouts,
    formatCurrency
};


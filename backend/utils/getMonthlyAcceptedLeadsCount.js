const { Lead } = require('../models');
const { Op } = require('sequelize');

/**
 * Get the count of leads accepted (paid) by a provider in the current month
 * A lead is considered "accepted" when it has a successful payment (status = 'accepted' or has stripePaymentIntentId with succeeded status)
 * @param {number} providerId - The provider's User ID (Lead.providerId references User.id)
 * @returns {Promise<number>} Count of leads accepted this month
 */
async function getMonthlyAcceptedLeadsCount(providerId) {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        // Count leads that were accepted (status = 'accepted') in the current month
        // We count based on when the lead was accepted (routedAt or updatedAt when status changed to accepted)
        const count = await Lead.count({
            where: {
                providerId: providerId,
                status: 'accepted',
                // Count leads that were accepted this month
                // Use updatedAt as proxy for when lead was accepted (since we don't have acceptedAt field)
                updatedAt: {
                    [Op.between]: [startOfMonth, endOfMonth]
                },
                // Also ensure it has a payment intent (meaning it was paid for)
                stripePaymentIntentId: {
                    [Op.ne]: null
                }
            }
        });

        return count;
    } catch (error) {
        console.error('Error getting monthly accepted leads count:', error);
        return 0;
    }
}

module.exports = getMonthlyAcceptedLeadsCount;

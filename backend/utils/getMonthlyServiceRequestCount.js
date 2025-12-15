const { ServiceRequest } = require('../models');
const { Op } = require('sequelize');

/**
 * Get the count of service requests created by a user in the current month
 * @param {number} userId - The user ID
 * @returns {Promise<number>} Count of service requests created this month
 */
async function getMonthlyServiceRequestCount(userId) {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const count = await ServiceRequest.count({
            where: {
                customerId: userId,
                createdAt: {
                    [Op.between]: [startOfMonth, endOfMonth]
                }
            }
        });

        return count;
    } catch (error) {
        console.error('Error getting monthly service request count:', error);
        return 0;
    }
}

module.exports = getMonthlyServiceRequestCount;

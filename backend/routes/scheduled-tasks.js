const express = require('express');
const router = express.Router();
const { Lead, ServiceRequest } = require('../models');
const { Op } = require('sequelize');
const assignFallbackLeads = require('../utils/assignFallbackLeads');

/**
 * Scheduled task to assign fallback leads after 24 hours
 * This should be called by a cron job every hour (or as needed)
 * 
 * @route   POST /api/scheduled-tasks/assign-fallback-leads
 * @desc    Assign leads to fallback businesses after 24-hour priority period expires
 * @access  Private (Admin only, or can be called by cron with API key)
 */
router.post('/assign-fallback-leads', async (req, res) => {
    try {
        // Optional: Add API key authentication for cron jobs
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== process.env.SCHEDULED_TASKS_API_KEY && req.user?.role !== 'admin') {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        console.log('[Scheduled Task] Checking for expired priority leads...');

        // Find leads that:
        // 1. Are in 'submitted' or 'routed' status (not accepted/rejected)
        // 2. Have priorityExpiresAt in metadata
        // 3. Priority period has expired (more than 24 hours ago)
        const now = new Date();
        const expiredLeads = await Lead.findAll({
            where: {
                status: { [Op.in]: ['submitted', 'routed'] }
            },
            attributes: ['id', 'metadata', 'businessId', 'providerId']
        });

        let processedCount = 0;
        let assignedCount = 0;

        for (const lead of expiredLeads) {
            try {
                if (!lead.metadata) continue;

                const metadata = typeof lead.metadata === 'string'
                    ? JSON.parse(lead.metadata)
                    : lead.metadata;

                if (!metadata.priorityExpiresAt || !metadata.fallbackBusinessIds) continue;

                const expiresAt = new Date(metadata.priorityExpiresAt);
                if (expiresAt > now) continue; // Not expired yet

                // Check if lead was accepted (shouldn't happen, but double-check)
                const currentLead = await Lead.findByPk(lead.id);
                if (currentLead.status === 'accepted') {
                    console.log(`[Scheduled Task] Lead ${lead.id} already accepted, skipping`);
                    continue;
                }

                // Priority period expired - assign to fallback businesses
                console.log(`[Scheduled Task] Priority expired for lead ${lead.id}, assigning to fallback businesses`);
                const fallbackLeads = await assignFallbackLeads(
                    metadata.serviceRequestId,
                    metadata.fallbackBusinessIds
                );

                if (fallbackLeads.length > 0) {
                    assignedCount += fallbackLeads.length;
                    console.log(`[Scheduled Task] ✅ Assigned ${fallbackLeads.length} fallback leads for service request ${metadata.serviceRequestId}`);
                }

                processedCount++;
            } catch (error) {
                console.error(`[Scheduled Task] Error processing lead ${lead.id}:`, error);
            }
        }

        res.json({
            success: true,
            message: 'Fallback lead assignment completed',
            processed: processedCount,
            assigned: assignedCount
        });
    } catch (error) {
        console.error('[Scheduled Task] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server error'
        });
    }
});

module.exports = router;

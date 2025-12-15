const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { protect } = require('../middleware/auth');
const { Lead, ServiceRequest, Category, SubCategory, User, ProviderProfile, Business, Proposal, WorkOrder } = require('../models');
const logActivity = require('../utils/logActivity');
const sendEmail = require('../utils/sendEmail');
const stripe = require('../config/stripe');
const { getLeadCost, getLeadCostWithDiscount } = require('../config/leadPricing');
const getSubscriptionBenefits = require('../utils/getSubscriptionBenefits');
const getMonthlyAcceptedLeadsCount = require('../utils/getMonthlyAcceptedLeadsCount');
const AlternativeProviderSelection = require('../models/AlternativeProviderSelection');

/**
 * Assign lead to next alternative provider when a provider rejects
 * @param {number} serviceRequestId - The service request ID
 * @param {number} rejectedLeadId - The ID of the rejected lead
 * @param {number} rejectedProviderId - The user ID of the provider who rejected
 */
async function assignLeadToNextAlternative(serviceRequestId, rejectedLeadId, rejectedProviderId) {
    try {
        console.log(`[assignLeadToNextAlternative] Starting reassignment for service request ${serviceRequestId}, rejected lead ${rejectedLeadId}, rejected provider ${rejectedProviderId}`);

        // Find alternative provider selections for this service request
        const alternatives = await AlternativeProviderSelection.findAll({
            where: { serviceRequestId: serviceRequestId },
            order: [['position', 'ASC']]
        });

        if (alternatives.length === 0) {
            console.log(`[assignLeadToNextAlternative] No alternative providers found for service request ${serviceRequestId}`);
            return;
        }

        console.log(`[assignLeadToNextAlternative] Found ${alternatives.length} alternative providers`);

        // Find the first alternative that doesn't have an accepted/rejected lead and isn't the rejected provider
        for (const alt of alternatives) {
            // Get provider profile to find userId
            const providerProfile = await ProviderProfile.findByPk(alt.providerId, {
                attributes: ['id', 'userId'],
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'isActive']
                }]
            });

            if (!providerProfile || !providerProfile.user) {
                console.log(`[assignLeadToNextAlternative] Provider profile not found for alternative ${alt.id}`);
                continue;
            }

            const providerUserId = providerProfile.userId;

            // Skip if this is the provider who just rejected
            if (providerUserId === rejectedProviderId) {
                console.log(`[assignLeadToNextAlternative] Skipping provider ${providerUserId} - they just rejected the lead`);
                continue;
            }

            // Check if provider is active
            if (!providerProfile.user.isActive) {
                console.log(`[assignLeadToNextAlternative] Skipping inactive provider ${providerUserId}`);
                continue;
            }

            // Check if this provider already has a lead for this request (accepted, pending, or routed)
            const existingLeads = await Lead.findAll({
                where: {
                    providerId: providerUserId,
                    status: { [Op.in]: ['submitted', 'routed', 'accepted'] }
                }
            });

            let hasExistingLead = false;
            for (const existingLead of existingLeads) {
                try {
                    const metadata = typeof existingLead.metadata === 'string'
                        ? JSON.parse(existingLead.metadata)
                        : existingLead.metadata;
                    if (metadata && metadata.serviceRequestId === serviceRequestId) {
                        hasExistingLead = true;
                        console.log(`[assignLeadToNextAlternative] Provider ${providerUserId} already has a lead for this request`);
                        break;
                    }
                } catch (e) {
                    // Skip if metadata parsing fails
                }
            }

            if (!hasExistingLead) {
                // Create a new lead for this alternative provider
                const serviceRequest = await ServiceRequest.findByPk(serviceRequestId, {
                    attributes: ['id', 'customerId', 'categoryId', 'zipCode', 'projectTitle', 'projectDescription', 'preferredDate', 'preferredTime', 'attachments'],
                    include: [
                        { model: User, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] },
                        { model: Category, as: 'category', attributes: ['id', 'name'] }
                    ]
                });

                if (!serviceRequest) {
                    console.error(`[assignLeadToNextAlternative] Service request ${serviceRequestId} not found`);
                    continue;
                }

                // Get business for this provider
                const business = await Business.findOne({
                    where: { ownerId: providerUserId },
                    attributes: ['id', 'name']
                });

                if (!business) {
                    console.log(`[assignLeadToNextAlternative] No business found for provider ${providerUserId}`);
                    continue;
                }

                // Create lead
                const newLead = await Lead.create({
                    customerId: serviceRequest.customerId,
                    businessId: business.id,
                    providerId: providerUserId,
                    serviceType: serviceRequest.projectTitle || serviceRequest.category?.name || 'Service Request',
                    categoryId: serviceRequest.categoryId,
                    locationCity: null,
                    locationState: null,
                    locationPostalCode: serviceRequest.zipCode,
                    description: serviceRequest.projectDescription,
                    customerName: serviceRequest.customer.name,
                    customerEmail: serviceRequest.customer.email,
                    customerPhone: serviceRequest.customer.phone,
                    status: 'routed',
                    metadata: JSON.stringify({
                        serviceRequestId: serviceRequestId,
                        assignedFrom: rejectedLeadId,
                        position: alt.position,
                        reassigned: true,
                        reassignedAt: new Date().toISOString(),
                        projectTitle: serviceRequest.projectTitle || null,
                        projectDescription: serviceRequest.projectDescription || null,
                        preferredDate: serviceRequest.preferredDate || null,
                        preferredTime: serviceRequest.preferredTime || null,
                        attachments: serviceRequest.attachments || []
                    }),
                    routedAt: new Date()
                });

                // Send email to alternative provider
                if (providerProfile.user && providerProfile.user.email) {
                    await sendEmail({
                        to: providerProfile.user.email,
                        subject: `New lead: ${serviceRequest.projectTitle || 'Service Request'}`,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                                    <h1 style="margin: 0; font-size: 28px;">New Lead Available</h1>
                                </div>
                                <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                        Hi ${providerProfile.user.name || 'Provider'},
                                    </p>
                                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                        A new lead has been assigned to you as an alternative provider.
                                    </p>
                                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                        <h3 style="margin-top: 0; color: #333;">Lead Details</h3>
                                        <p style="margin: 5px 0;"><strong>Project:</strong> ${serviceRequest.projectTitle || 'Service Request'}</p>
                                        ${serviceRequest.category ? `<p style="margin: 5px 0;"><strong>Category:</strong> ${serviceRequest.category.name}</p>` : ''}
                                        ${serviceRequest.zipCode ? `<p style="margin: 5px 0;"><strong>Location:</strong> ${serviceRequest.zipCode}</p>` : ''}
                                    </div>
                                    <div style="text-align: center; margin-top: 30px;">
                                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-dashboard/leads" 
                                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                                  padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                                  font-weight: 600; font-size: 16px;">
                                            View Lead
                                        </a>
                                    </div>
                                </div>
                            </div>
                        `
                    }).catch(err => console.error('Failed to send alternative provider email:', err));
                }

                console.log(`[assignLeadToNextAlternative] ✅ Assigned lead ${newLead.id} to alternative provider ${providerUserId} (position ${alt.position}) for service request ${serviceRequestId}`);
                return; // Only assign to first available alternative
            }
        }

        console.log(`[assignLeadToNextAlternative] No available alternative providers for service request ${serviceRequestId}`);
    } catch (error) {
        console.error('[assignLeadToNextAlternative] Error:', error);
        throw error;
    }
}

// @route   GET /api/provider/lead-usage
// @desc    Get provider's monthly lead usage statistics
// @access  Private (Provider only)
router.get('/lead-usage', protect, async (req, res) => {
    try {
        // Get provider profile
        const providerProfile = await ProviderProfile.findOne({
            where: { userId: req.user.id },
            attributes: ['id', 'userId']
        });

        if (!providerProfile) {
            return res.status(404).json({
                success: false,
                error: 'Provider profile not found'
            });
        }

        // Get subscription benefits
        const subscriptionBenefits = await getSubscriptionBenefits(req.user.id);

        // Get current month's accepted leads count
        const currentMonthCount = await getMonthlyAcceptedLeadsCount(req.user.id);

        // Calculate remaining leads
        const maxLeads = subscriptionBenefits.maxLeadsPerMonth;
        const remainingLeads = maxLeads !== null
            ? Math.max(0, maxLeads - currentMonthCount)
            : null; // null means unlimited

        // Format plan name for display
        let planName = subscriptionBenefits.planName || subscriptionBenefits.tier || 'Basic';
        // If plan name is just the tier, format it nicely
        if (planName && (planName.toUpperCase() === 'PREMIUM' || planName.toUpperCase() === 'PRO' || planName.toUpperCase() === 'BASIC')) {
            planName = planName.charAt(0).toUpperCase() + planName.slice(1).toLowerCase() + ' Plan';
        } else if (!planName || planName === 'Basic') {
            planName = 'Basic Plan';
        }

        res.json({
            success: true,
            data: {
                currentCount: currentMonthCount,
                maxLeads: maxLeads,
                remainingLeads: remainingLeads,
                isUnlimited: maxLeads === null,
                planName: planName,
                tier: subscriptionBenefits.tier,
                hasActiveSubscription: subscriptionBenefits.hasActiveSubscription,
                limitReached: maxLeads !== null && currentMonthCount >= maxLeads
            }
        });
    } catch (error) {
        console.error('Get lead usage error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server error'
        });
    }
});

// @route   GET /api/provider/leads
// @desc    Get all leads for the logged-in provider
// @access  Private (Provider only)
router.get('/leads', protect, async (req, res) => {
    try {
        // Get provider profile for the logged-in user
        // Only select columns that exist in the database
        const providerProfile = await ProviderProfile.findOne({
            where: { userId: req.user.id },
            attributes: ['id', 'userId'] // Only select existing columns
        });

        if (!providerProfile) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'Provider profile not found. Please complete your provider profile setup to receive leads.',
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 0,
                    pages: 0
                }
            });
        }

        // Query parameters
        const statusFilter = req.query.status;
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        // Build where clause
        // NOTE: providerId in leads table references users.id (not provider_profiles.id)
        // So we use req.user.id (User ID) instead of providerProfile.id
        const where = {
            providerId: req.user.id // User ID, not ProviderProfile ID
        };

        // Map frontend status to database status values
        // Frontend: PENDING, PAYMENT_PENDING, ACCEPTED, REJECTED, PAYMENT_FAILED
        // Database: submitted, routed, accepted, rejected, cancelled
        if (statusFilter && statusFilter !== 'all') {
            if (statusFilter === 'PENDING') {
                // PENDING means no payment intent yet
                where.status = { [Op.in]: ['submitted', 'routed'] };
                where.stripePaymentIntentId = { [Op.is]: null };
            } else if (statusFilter === 'PAYMENT_PENDING') {
                // PAYMENT_PENDING means payment intent exists but not accepted yet
                // Must be submitted/routed status AND have payment intent AND NOT be rejected
                where.status = {
                    [Op.and]: [
                        { [Op.in]: ['submitted', 'routed'] },
                        { [Op.ne]: 'rejected' }
                    ]
                };
                where.stripePaymentIntentId = { [Op.ne]: null };
            } else if (statusFilter === 'ACCEPTED') {
                where.status = 'accepted';
            } else if (statusFilter === 'REJECTED') {
                where.status = 'rejected';
                console.log(`[Provider Leads] Filtering by REJECTED status`);
            } else if (statusFilter === 'PAYMENT_FAILED') {
                where.status = 'cancelled';
            }
        }

        // Query leads from leads table with includes
        // Use try-catch to handle missing columns gracefully if migration hasn't been run
        console.log(`[Provider Leads] Querying leads with where clause:`, JSON.stringify(where, null, 2));
        let count, leads;
        try {
            const result = await Lead.findAndCountAll({
                where,
                include: [
                    {
                        model: Category,
                        as: 'category',
                        attributes: ['id', 'name', 'icon'],
                        required: false
                    },
                    {
                        model: User,
                        as: 'customer',
                        attributes: ['id', 'name', 'email', 'firstName', 'lastName'],
                        required: false
                    },
                    {
                        model: Business,
                        as: 'business',
                        attributes: ['id', 'name'],
                        required: false
                    }
                ],
                order: [['createdAt', 'DESC']],
                limit: pageSize,
                offset: offset
            });
            count = result.count;
            leads = result.rows;
        } catch (dbError) {
            // If error is about missing columns, try with explicit attributes (migration not run yet)
            if (dbError.message && dbError.message.includes('Unknown column')) {
                console.log('Migration not run yet, using explicit attributes for leads...');
                const result = await Lead.findAndCountAll({
                    where,
                    attributes: [
                        'id', 'customerId', 'businessId', 'providerId', 'serviceType', 'categoryId',
                        'locationCity', 'locationState', 'locationPostalCode', 'description', 'budgetRange',
                        'preferredContact', 'customerName', 'customerEmail', 'customerPhone', 'membershipTierRequired',
                        'status', 'stripePaymentIntentId', 'leadCost', 'statusHistory', 'metadata', 'routedAt',
                        'createdAt', 'updatedAt'
                    ],
                    include: [
                        {
                            model: Category,
                            as: 'category',
                            attributes: ['id', 'name', 'icon'],
                            required: false
                        },
                        {
                            model: User,
                            as: 'customer',
                            attributes: ['id', 'name', 'email', 'firstName', 'lastName'],
                            required: false
                        },
                        {
                            model: Business,
                            as: 'business',
                            attributes: ['id', 'name'],
                            required: false
                        }
                    ],
                    order: [['createdAt', 'DESC']],
                    limit: pageSize,
                    offset: offset
                });
                count = result.count;
                leads = result.rows;
            } else {
                throw dbError;
            }
        }

        console.log(`[Provider Leads] Found ${count} leads, returning ${leads.length} leads`);

        // Format response with masked customer data
        // Note: providerProfile is already declared at the beginning of this route handler
        const formattedLeads = await Promise.all(leads.map(async (lead) => {
            // Hide customer contact details until lead is accepted
            // Only show contact details if lead status is 'accepted' (meaning payment succeeded)
            const isAccepted = lead.status === 'accepted';
            const customer = lead.customer;

            let customerName = null;
            let customerEmail = null;
            let customerPhone = null;

            if (isAccepted) {
                // Lead accepted - show full contact details
                customerName = lead.customerName || (customer?.name || customer?.firstName || 'Customer');
                customerEmail = lead.customerEmail || customer?.email;
                customerPhone = lead.customerPhone || customer?.phone;
            } else {
                // Lead not accepted - completely hide contact details
                customerName = null;
                customerEmail = null;
                customerPhone = null;
            }

            // Extract service request info from metadata if available
            let serviceRequestInfo = null;
            let serviceRequestId = null;
            if (lead.metadata) {
                try {
                    const metadata = typeof lead.metadata === 'string'
                        ? JSON.parse(lead.metadata)
                        : lead.metadata;

                    if (metadata.serviceRequestId) {
                        serviceRequestId = metadata.serviceRequestId;
                        serviceRequestInfo = {
                            id: metadata.serviceRequestId,
                            projectTitle: metadata.projectTitle || lead.serviceType,
                            preferredDate: metadata.preferredDate,
                            preferredTime: metadata.preferredTime,
                            attachments: metadata.attachments || []
                        };
                    }
                } catch (e) {
                    console.error('Error parsing lead metadata:', e);
                }
            }

            // If we have serviceRequestId but no projectTitle in metadata, fetch it from ServiceRequest
            let actualProjectTitle = serviceRequestInfo?.projectTitle || lead.serviceType || 'Service Request';
            if (serviceRequestId && (!serviceRequestInfo?.projectTitle || serviceRequestInfo.projectTitle === lead.serviceType)) {
                try {
                    const serviceRequest = await ServiceRequest.findByPk(serviceRequestId, {
                        attributes: ['id', 'projectTitle']
                    });
                    if (serviceRequest && serviceRequest.projectTitle) {
                        actualProjectTitle = serviceRequest.projectTitle;
                    }
                } catch (e) {
                    console.error('Error fetching service request for project title:', e);
                }
            }

            // Use service request info if available, otherwise use lead data
            const projectTitle = actualProjectTitle;
            const projectDescription = lead.description;
            const zipCode = lead.locationPostalCode || lead.locationCity || 'N/A';
            const preferredDate = serviceRequestInfo?.preferredDate || null;
            const preferredTime = serviceRequestInfo?.preferredTime || null;

            // Map database status to frontend status
            let frontendStatus = lead.status?.toUpperCase() || 'PENDING';

            // First, check if there's a rejected proposal (this takes precedence)
            let hasRejectedProposal = false;
            if (serviceRequestId && providerProfile && providerProfile.id) {
                try {
                    const proposal = await Proposal.findOne({
                        where: {
                            serviceRequestId: serviceRequestId,
                            providerId: providerProfile.id
                        },
                        attributes: ['id', 'status']
                    });
                    if (proposal && proposal.status === 'REJECTED') {
                        hasRejectedProposal = true;
                    }
                } catch (e) {
                    // Ignore errors, continue with lead status
                }

                // Also check metadata for rejected pending proposal
                if (!hasRejectedProposal && lead.metadata) {
                    try {
                        const metadata = typeof lead.metadata === 'string' ? JSON.parse(lead.metadata) : lead.metadata;
                        if (metadata.pendingProposal && metadata.pendingProposal.status === 'REJECTED') {
                            hasRejectedProposal = true;
                        }
                    } catch (e) {
                        // Ignore parsing errors
                    }
                }
            }

            // If proposal is rejected, lead status should be REJECTED
            if (hasRejectedProposal) {
                frontendStatus = 'REJECTED';
                // Also update lead status in database if it's not already rejected
                if (lead.status !== 'rejected') {
                    Lead.update({ status: 'rejected' }, { where: { id: lead.id } })
                        .catch(err => console.error(`Error updating lead ${lead.id} status to rejected:`, err));
                }
            } else if (lead.status === 'submitted' || lead.status === 'routed') {
                // If payment intent exists but status is still submitted/routed, it means payment is pending
                if (lead.stripePaymentIntentId) {
                    frontendStatus = 'PAYMENT_PENDING';
                } else {
                    frontendStatus = 'PENDING';
                }
            } else if (lead.status === 'accepted') {
                frontendStatus = 'ACCEPTED';
            } else if (lead.status === 'rejected') {
                frontendStatus = 'REJECTED';
            } else if (lead.status === 'cancelled') {
                frontendStatus = 'PAYMENT_FAILED';
            }

            // Get proposal price and payment status if lead is accepted and we have serviceRequestId and providerProfile
            let proposalPrice = null;
            let proposalPaymentStatus = null;
            if (lead.status === 'accepted' && serviceRequestId && providerProfile && providerProfile.id) {
                try {
                    const proposal = await Proposal.findOne({
                        where: {
                            serviceRequestId: serviceRequestId,
                            providerId: providerProfile.id
                        },
                        attributes: ['id', 'price', 'status', 'paymentStatus', 'paidAt']
                    });

                    if (proposal) {
                        if (proposal.price) {
                            proposalPrice = parseFloat(proposal.price);
                        }
                        proposalPaymentStatus = proposal.paymentStatus || null;
                    } else {
                        // Check if proposal is in lead metadata (pending proposal)
                        try {
                            const metadata = lead.metadata ? (typeof lead.metadata === 'string' ? JSON.parse(lead.metadata) : lead.metadata) : null;
                            if (metadata && metadata.pendingProposal) {
                                if (metadata.pendingProposal.price) {
                                    proposalPrice = parseFloat(metadata.pendingProposal.price);
                                }
                                // Pending proposals haven't been paid yet
                                proposalPaymentStatus = 'pending';
                            }
                        } catch (metaError) {
                            console.error('Error parsing lead metadata:', metaError);
                        }
                    }
                } catch (e) {
                    console.error('Error fetching proposal for lead:', e);
                }
            }

            // Calculate actual lead cost from category with subscription discount (in dollars)
            let actualLeadCost = 0;
            let baseLeadCost = 0;

            // Get user's subscription benefits to calculate discounted cost
            const subscriptionBenefits = await getSubscriptionBenefits(req.user.id);

            if (lead.categoryId) {
                const categoryId = lead.categoryId;
                const leadCostCents = getLeadCost(categoryId);
                baseLeadCost = leadCostCents / 100;

                // Apply subscription discount
                const discountedCostCents = getLeadCostWithDiscount(categoryId, subscriptionBenefits);
                actualLeadCost = discountedCostCents / 100;
            } else if (lead.leadCost) {
                // If leadCost is stored in database (in cents), convert to dollars
                baseLeadCost = typeof lead.leadCost === 'number' ? (lead.leadCost > 100 ? lead.leadCost / 100 : lead.leadCost) : parseFloat(lead.leadCost) / 100;

                // Apply subscription discount to stored lead cost
                const baseCostCents = Math.round(baseLeadCost * 100);
                const discountedCostCents = getLeadCostWithDiscount(null, subscriptionBenefits);
                // If stored cost differs from default, calculate discount from stored cost
                if (baseCostCents !== getLeadCost(null)) {
                    // Use stored cost as base for discount calculation
                    const discountPercent = subscriptionBenefits.hasActiveSubscription ? (subscriptionBenefits.leadDiscountPercent || 0) : 0;
                    if (discountPercent > 0) {
                        const discountAmount = (baseCostCents * discountPercent) / 100;
                        const discountedCost = Math.max(1, Math.round(baseCostCents - discountAmount));
                        actualLeadCost = discountedCost / 100;
                    } else {
                        actualLeadCost = baseLeadCost;
                    }
                } else {
                    actualLeadCost = discountedCostCents / 100;
                }
            } else {
                // Fallback: use default cost with discount
                const discountedCostCents = getLeadCostWithDiscount(null, subscriptionBenefits);
                actualLeadCost = discountedCostCents / 100;
                baseLeadCost = getLeadCost(null) / 100;
            }

            return {
                id: lead.id,
                status: frontendStatus,
                leadCost: actualLeadCost, // Discounted lead cost in dollars
                baseLeadCost: baseLeadCost, // Base lead cost before discount
                hasDiscount: subscriptionBenefits.hasActiveSubscription && subscriptionBenefits.leadDiscountPercent > 0,
                discountPercent: subscriptionBenefits.hasActiveSubscription ? subscriptionBenefits.leadDiscountPercent : 0,
                proposalPrice: proposalPrice, // Proposal price (if lead is accepted)
                proposalPaymentStatus: proposalPaymentStatus, // Proposal payment status (if lead is accepted)
                isPrimary: false, // Not in current table structure
                createdAt: lead.createdAt,
                updatedAt: lead.updatedAt,
                serviceRequest: {
                    id: serviceRequestInfo?.id || lead.id,
                    projectTitle: projectTitle,
                    projectDescription: projectDescription,
                    zipCode: zipCode,
                    preferredDate: preferredDate,
                    preferredTime: preferredTime,
                    status: frontendStatus,
                    category: lead.category ? {
                        id: lead.category.id,
                        name: lead.category.name,
                        icon: lead.category.icon
                    } : null,
                    subCategory: null, // Not in current table structure
                    customer: {
                        id: customer?.id || null,
                        name: customerName,
                        email: customerEmail,
                        phone: customerPhone,
                        contactDetailsVisible: isAccepted // Flag to indicate if contact details are visible
                    }
                }
            };
        }));

        res.json({
            success: true,
            data: formattedLeads,
            pagination: {
                page,
                pageSize,
                total: count,
                pages: Math.ceil(count / pageSize)
            }
        });
    } catch (error) {
        console.error('Get provider leads error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server error'
        });
    }
});

// @route   PATCH /api/provider/leads/:id/accept
// @desc    Accept a lead - Creates Stripe PaymentIntent for lead cost
// @access  Private (Provider only)
router.patch('/leads/:id/accept', protect, async (req, res) => {
    try {
        // Check Stripe configuration
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({
                success: false,
                error: 'Payment system not configured'
            });
        }

        // Get provider profile
        const providerProfile = await ProviderProfile.findOne({
            where: { userId: req.user.id },
            attributes: ['id', 'userId']
        });

        if (!providerProfile) {
            return res.status(404).json({
                success: false,
                error: 'Provider profile not found'
            });
        }

        // Find the lead
        // Use try-catch to handle missing columns gracefully if migration hasn't been run
        let lead;
        try {
            lead = await Lead.findOne({
                where: {
                    id: req.params.id,
                    providerId: req.user.id // User ID, not ProviderProfile ID
                }
            });
        } catch (dbError) {
            // If error is about missing columns, try with explicit attributes (migration not run yet)
            if (dbError.message && dbError.message.includes('Unknown column')) {
                console.log('Migration not run yet, using explicit attributes for lead detail...');
                lead = await Lead.findOne({
                    where: {
                        id: req.params.id,
                        providerId: req.user.id
                    },
                    attributes: [
                        'id', 'customerId', 'businessId', 'providerId', 'serviceType', 'categoryId',
                        'locationCity', 'locationState', 'locationPostalCode', 'description', 'budgetRange',
                        'preferredContact', 'customerName', 'customerEmail', 'customerPhone', 'membershipTierRequired',
                        'status', 'stripePaymentIntentId', 'leadCost', 'statusHistory', 'metadata', 'routedAt',
                        'createdAt', 'updatedAt'
                    ]
                });
            } else {
                throw dbError;
            }
        }

        if (!lead) {
            return res.status(404).json({
                success: false,
                error: 'Lead not found'
            });
        }

        // Verify lead is PENDING (submitted or routed in database)
        if (lead.status !== 'submitted' && lead.status !== 'routed') {
            return res.status(400).json({
                success: false,
                error: `Cannot accept lead. Current status: ${lead.status}`
            });
        }

        // Get proposal data and payment method from request body
        const { description, price, paymentMethodId } = req.body;

        // Payment method is required for automatic charging
        if (!paymentMethodId) {
            return res.status(400).json({
                success: false,
                error: 'Payment method is required to accept the lead. Payment will be charged automatically upon acceptance.'
            });
        }

        // Check if payment already in progress
        if (lead.stripePaymentIntentId) {
            // Check if payment intent exists and its status
            try {
                const existingIntent = await stripe.paymentIntents.retrieve(lead.stripePaymentIntentId);
                if (existingIntent.status === 'succeeded') {
                    return res.status(400).json({
                        success: false,
                        error: 'Lead has already been paid and accepted'
                    });
                }
                // Return existing client secret (for completing payment)
                return res.json({
                    success: true,
                    clientSecret: existingIntent.client_secret,
                    paymentIntentId: existingIntent.id,
                    leadCost: lead.leadCost ? (lead.leadCost / 100).toFixed(2) : null,
                    message: 'Payment intent already created. Complete payment to finalize.'
                });
            } catch (stripeError) {
                // Payment intent doesn't exist, continue to create new one
                console.log('Existing payment intent not found, creating new one');
            }
        }

        // First time accepting - validate proposal data
        if (!description || !description.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Proposal description is required'
            });
        }

        if (!price || parseFloat(price) <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Valid price (greater than 0) is required'
            });
        }

        // Extract serviceRequestId from metadata
        let serviceRequestId = null;
        if (lead.metadata) {
            try {
                const metadata = typeof lead.metadata === 'string'
                    ? JSON.parse(lead.metadata)
                    : lead.metadata;
                serviceRequestId = metadata.serviceRequestId;
            } catch (e) {
                console.error('Error parsing lead metadata:', e);
            }
        }

        // Get user's subscription benefits
        const subscriptionBenefits = await getSubscriptionBenefits(req.user.id);
        console.log(`[Accept Lead] Subscription benefits:`, {
            hasActiveSubscription: subscriptionBenefits.hasActiveSubscription,
            planName: subscriptionBenefits.planName,
            tier: subscriptionBenefits.tier,
            leadDiscountPercent: subscriptionBenefits.leadDiscountPercent,
            priorityBoostPoints: subscriptionBenefits.priorityBoostPoints,
            maxLeadsPerMonth: subscriptionBenefits.maxLeadsPerMonth
        });

        // Check monthly lead limit (only for providers, not customers)
        // Membership is only for providers, so we check limits here
        if (subscriptionBenefits.maxLeadsPerMonth !== null) {
            // Plan has a limit (not unlimited)
            const currentMonthCount = await getMonthlyAcceptedLeadsCount(req.user.id);
            console.log(`[Accept Lead] Current monthly accepted leads: ${currentMonthCount} / ${subscriptionBenefits.maxLeadsPerMonth}`);

            if (currentMonthCount >= subscriptionBenefits.maxLeadsPerMonth) {
                return res.status(403).json({
                    success: false,
                    error: `Monthly lead limit reached. You have accepted ${currentMonthCount} leads this month. Your ${subscriptionBenefits.planName || subscriptionBenefits.tier} plan allows ${subscriptionBenefits.maxLeadsPerMonth} leads per month. Please upgrade your plan to accept more leads.`,
                    limitReached: true,
                    currentCount: currentMonthCount,
                    maxLeads: subscriptionBenefits.maxLeadsPerMonth,
                    planName: subscriptionBenefits.planName || subscriptionBenefits.tier
                });
            }
        }

        // Calculate lead cost with subscription discount (in cents)
        // Handle null/undefined categoryId gracefully
        const categoryId = lead.categoryId || null;
        console.log(`[Accept Lead] Calculating lead cost for categoryId: ${categoryId}`);
        const leadCostCents = getLeadCostWithDiscount(categoryId, subscriptionBenefits);
        const leadCostDollars = leadCostCents / 100;
        const baseCostCents = getLeadCost(categoryId);
        const baseCostDollars = baseCostCents / 100;

        if (subscriptionBenefits.hasActiveSubscription) {
            if (subscriptionBenefits.leadDiscountPercent > 0) {
                const savings = baseCostDollars - leadCostDollars;
                console.log(`[Accept Lead] ✅ Discount applied! Lead cost: $${leadCostDollars.toFixed(2)} (base: $${baseCostDollars.toFixed(2)}, ${subscriptionBenefits.leadDiscountPercent}% discount, savings: $${savings.toFixed(2)})`);
            } else {
                console.log(`[Accept Lead] ⚠️  Active subscription found (${subscriptionBenefits.planName || subscriptionBenefits.tier}) but discount is 0%. Lead cost: $${leadCostDollars.toFixed(2)} (full price)`);
            }
        } else {
            console.log(`[Accept Lead] No active subscription. Lead cost: $${leadCostDollars.toFixed(2)} (full price)`);
        }

        // Create and automatically confirm Stripe PaymentIntent for lead cost
        // This charges the provider immediately when they accept the lead
        console.log(`[Accept Lead] Creating and auto-confirming Stripe PaymentIntent for lead ${lead.id}`);
        let paymentIntent;
        try {
            // Get customer info to store in lead after payment succeeds
            const customer = await User.findByPk(lead.customerId, {
                attributes: ['id', 'name', 'email', 'phone', 'firstName', 'lastName']
            });

            const customerName = customer?.firstName && customer?.lastName
                ? `${customer.firstName} ${customer.lastName}`
                : customer?.name || customer?.email || 'Customer';

            paymentIntent = await stripe.paymentIntents.create({
                amount: leadCostCents,
                currency: 'usd',
                confirm: true, // Automatically confirm and charge
                payment_method: paymentMethodId, // Payment method from frontend
                return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-dashboard/leads`,
                metadata: {
                    leadId: lead.id.toString(),
                    serviceRequestId: serviceRequestId ? serviceRequestId.toString() : '',
                    providerId: req.user.id.toString(),
                    type: 'lead_acceptance',
                    proposalDescription: description.trim().substring(0, 200), // Limit length
                    proposalPrice: parseFloat(price).toFixed(2),
                    customerName: customerName,
                    customerEmail: customer?.email || '',
                    customerPhone: customer?.phone || ''
                },
                description: `Lead acceptance fee - ${lead.serviceType || 'Service Request'}`,
                automatic_payment_methods: {
                    enabled: true
                }
            });
            console.log(`[Accept Lead] ✅ Stripe PaymentIntent created and confirmed: ${paymentIntent.id}, status: ${paymentIntent.status}`);

            // If payment succeeded immediately, update lead and show contact details
            if (paymentIntent.status === 'succeeded') {
                console.log(`[Accept Lead] ✅ Payment succeeded immediately, updating lead and revealing contact details`);

                // Update lead with customer contact details and accepted status
                await lead.update({
                    status: 'accepted',
                    stripePaymentIntentId: paymentIntent.id,
                    leadCost: leadCostCents,
                    customerName: customerName,
                    customerEmail: customer?.email || null,
                    customerPhone: customer?.phone || null
                });

                // Create proposal if serviceRequestId exists
                if (serviceRequestId) {
                    const proposal = await Proposal.create({
                        serviceRequestId: serviceRequestId,
                        providerId: providerProfile.id,
                        details: description.trim(),
                        price: parseFloat(price),
                        status: 'SENT'
                    });
                    console.log(`[Accept Lead] ✅ Proposal created: ID=${proposal.id}`);
                }

                return res.json({
                    success: true,
                    message: 'Lead accepted and payment processed successfully',
                    leadCost: leadCostDollars.toFixed(2),
                    paymentSucceeded: true,
                    contactDetailsVisible: true,
                    customer: {
                        name: customerName,
                        email: customer?.email,
                        phone: customer?.phone
                    }
                });
            }
        } catch (stripeError) {
            console.error('❌ Stripe PaymentIntent creation/confirmation failed:', stripeError);
            throw new Error(`Failed to process payment: ${stripeError.message}`);
        }

        // If payment requires action (3D Secure, etc.), return client secret for frontend confirmation
        if (paymentIntent.status === 'requires_action' || paymentIntent.status === 'requires_payment_method') {
            console.log(`[Accept Lead] Payment requires action: ${paymentIntent.status}`);

            // Update lead with payment intent ID and cost (but don't reveal contact details yet)
            try {
                let metadata = {};
                if (lead.metadata) {
                    try {
                        metadata = typeof lead.metadata === 'string' ? JSON.parse(lead.metadata) : lead.metadata;
                    } catch (e) {
                        console.error('Error parsing lead metadata:', e);
                    }
                }
                metadata.pendingProposal = {
                    description: description.trim(),
                    price: parseFloat(price)
                };

                await lead.update({
                    stripePaymentIntentId: paymentIntent.id,
                    leadCost: leadCostCents,
                    metadata: JSON.stringify(metadata)
                });
                console.log(`[Accept Lead] ✅ Lead updated with payment intent ID (awaiting payment confirmation)`);
            } catch (updateError) {
                console.error('❌ Failed to update lead:', updateError);
                throw new Error(`Failed to update lead: ${updateError.message}`);
            }

            // Return client secret for frontend to complete payment
            return res.json({
                success: true,
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
                leadCost: leadCostDollars.toFixed(2),
                requiresAction: true,
                message: 'Please complete payment to accept the lead'
            });
        }

        // If payment is still processing, return client secret
        if (paymentIntent.status === 'processing') {
            console.log(`[Accept Lead] Payment is processing`);
            return res.json({
                success: true,
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
                leadCost: leadCostDollars.toFixed(2),
                processing: true,
                message: 'Payment is processing. Contact details will be available once payment is confirmed.'
            });
        }

        // Log activity (non-blocking)
        logActivity({
            type: 'lead_payment_intent_created',
            description: `Payment intent created for lead "${lead.serviceType || lead.description?.substring(0, 50)}"`,
            userId: req.user.id,
            metadata: {
                leadId: lead.id,
                paymentIntentId: paymentIntent.id,
                leadCost: leadCostCents,
                serviceRequestId: serviceRequestId
            }
        }).catch(err => {
            console.error('Failed to log activity (non-critical):', err);
        });

        // Send customer notification when provider accepts lead (before payment)
        if (serviceRequestId) {
            try {
                const serviceRequest = await ServiceRequest.findByPk(serviceRequestId, {
                    include: [
                        { model: User, as: 'customer', attributes: ['id', 'name', 'email', 'firstName', 'lastName'] },
                        { model: Category, as: 'category', attributes: ['id', 'name'] }
                    ]
                });

                if (serviceRequest && serviceRequest.customer && serviceRequest.customer.email) {
                    const sendEmail = require('../utils/sendEmail');
                    const customer = serviceRequest.customer;
                    const customerName = customer.firstName && customer.lastName
                        ? `${customer.firstName} ${customer.lastName}`
                        : customer.name || 'Customer';

                    const providerName = req.user.firstName && req.user.lastName
                        ? `${req.user.firstName} ${req.user.lastName}`
                        : req.user.name || 'Provider';

                    await sendEmail({
                        to: customer.email,
                        subject: `New proposal received — ${serviceRequest.projectTitle}`,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                                    <h1 style="margin: 0; font-size: 28px;">New Proposal Received!</h1>
                                </div>
                                <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                        Hi ${customerName},
                                    </p>
                                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                        Great news! A service provider (${providerName}) has submitted a proposal for your service request.
                                    </p>
                                    
                                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                        <h3 style="margin-top: 0; color: #333;">Service Request</h3>
                                        <p style="margin: 5px 0;"><strong>Project:</strong> ${serviceRequest.projectTitle}</p>
                                        ${serviceRequest.category ? `<p style="margin: 5px 0;"><strong>Category:</strong> ${serviceRequest.category.name}</p>` : ''}
                                    </div>

                                    <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
                                        <h3 style="margin-top: 0; color: #004085;">Proposal Details</h3>
                                        <p style="margin: 5px 0; color: #333; white-space: pre-wrap;">${description.trim()}</p>
                                        <p style="margin: 15px 0 5px 0;"><strong>Price:</strong> $${parseFloat(price).toFixed(2)}</p>
                                    </div>

                                    <div style="background-color: #d1ecf1; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0c5460;">
                                        <h3 style="margin-top: 0; color: #0c5460;">What's Next?</h3>
                                        <p style="color: #333; line-height: 1.6;">
                                            You can review this proposal in your dashboard and accept it if it meets your needs. Once accepted, the provider will begin work on your project.
                                        </p>
                                    </div>

                                    <div style="text-align: center; margin-top: 30px; padding-top: 25px; border-top: 2px solid #e5e7eb;">
                                        <a href="${process.env.FRONTEND_URL || process.env.PROD_FRONTEND_URL || 'http://localhost:3000'}/user-dashboard/requests" 
                                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                                  padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                                  font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                                            View Proposal & Accept
                                        </a>
                                    </div>
                                </div>
                            </div>
                        `
                    }).catch(err => {
                        console.error('Failed to send customer notification email when provider accepts lead:', err);
                    });
                    console.log(`[Accept Lead] ✅ Customer notification email sent to ${customer.email}`);
                }
            } catch (emailError) {
                console.error('Error sending customer notification email:', emailError);
                // Don't fail the request if email fails
            }
        }

        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            leadCost: leadCostDollars.toFixed(2),
            message: 'Payment intent created. Please complete payment to accept the lead.'
        });
    } catch (error) {
        console.error('❌ Accept lead error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage
        });
        res.status(500).json({
            success: false,
            error: error.message || 'Server error',
            details: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : undefined
        });
    }
});

// @route   PATCH /api/provider/leads/:id/reject
// @desc    Reject a lead
// @access  Private (Provider only)
router.patch('/leads/:id/reject', protect, async (req, res) => {
    try {
        // Get provider profile
        // Only select columns that exist in the database
        const providerProfile = await ProviderProfile.findOne({
            where: { userId: req.user.id },
            attributes: ['id', 'userId'] // Only select existing columns
        });

        if (!providerProfile) {
            return res.status(404).json({
                success: false,
                error: 'Provider profile not found'
            });
        }

        // Find the lead
        // Note: Lead doesn't have direct association with ServiceRequest (it's in metadata)
        // Use try-catch to handle missing columns gracefully if migration hasn't been run
        let lead;
        try {
            lead = await Lead.findOne({
                where: {
                    id: req.params.id,
                    providerId: req.user.id // User ID, not ProviderProfile ID
                }
            });
        } catch (dbError) {
            // If error is about missing columns, try with explicit attributes (migration not run yet)
            if (dbError.message && dbError.message.includes('Unknown column')) {
                console.log('Migration not run yet, using explicit attributes for lead reject...');
                lead = await Lead.findOne({
                    where: {
                        id: req.params.id,
                        providerId: req.user.id
                    },
                    attributes: [
                        'id', 'customerId', 'businessId', 'providerId', 'serviceType', 'categoryId',
                        'locationCity', 'locationState', 'locationPostalCode', 'description', 'budgetRange',
                        'preferredContact', 'customerName', 'customerEmail', 'customerPhone', 'membershipTierRequired',
                        'status', 'stripePaymentIntentId', 'leadCost', 'statusHistory', 'metadata', 'routedAt',
                        'createdAt', 'updatedAt'
                    ]
                });
            } else {
                throw dbError;
            }
        }

        if (!lead) {
            return res.status(404).json({
                success: false,
                error: 'Lead not found'
            });
        }

        // Verify lead is PENDING (submitted or routed in database)
        if (lead.status !== 'submitted' && lead.status !== 'routed') {
            return res.status(400).json({
                success: false,
                error: `Cannot reject lead. Current status: ${lead.status}`
            });
        }

        // Get rejection reason from request body
        const { rejectionReason, rejectionReasonOther } = req.body;

        // Validate rejection reason
        const validReasons = ['TOO_FAR', 'TOO_EXPENSIVE', 'NOT_RELEVANT', 'OTHER'];
        if (rejectionReason && !validReasons.includes(rejectionReason)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid rejection reason. Must be one of: TOO_FAR, TOO_EXPENSIVE, NOT_RELEVANT, OTHER'
            });
        }

        // If reason is OTHER, rejectionReasonOther is required
        if (rejectionReason === 'OTHER' && (!rejectionReasonOther || !rejectionReasonOther.trim())) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a description when selecting "Other" as the rejection reason'
            });
        }

        // Extract serviceRequestId from metadata
        let serviceRequestId = null;
        let serviceRequest = null;
        if (lead.metadata) {
            try {
                const metadata = typeof lead.metadata === 'string'
                    ? JSON.parse(lead.metadata)
                    : lead.metadata;
                serviceRequestId = metadata.serviceRequestId;
            } catch (e) {
                console.error('Error parsing lead metadata:', e);
            }
        }

        // Get service request if available
        // Use try-catch to handle missing columns gracefully if migration hasn't been run
        if (serviceRequestId) {
            try {
                serviceRequest = await ServiceRequest.findByPk(serviceRequestId, {
                    include: [
                        { model: User, as: 'customer', attributes: ['id', 'name', 'email', 'firstName', 'lastName'] },
                        { model: Category, as: 'category', attributes: ['id', 'name'] }
                    ]
                });
            } catch (dbError) {
                // If error is about missing columns, try with explicit attributes (migration not run yet)
                if (dbError.message && dbError.message.includes('Unknown column')) {
                    console.log('Migration not run yet, using explicit attributes for service request in lead reject...');
                    serviceRequest = await ServiceRequest.findByPk(serviceRequestId, {
                        attributes: [
                            'id', 'customerId', 'categoryId', 'subCategoryId', 'zipCode',
                            'projectTitle', 'projectDescription', 'attachments', 'preferredDate',
                            'preferredTime', 'status', 'primaryProviderId', 'selectedBusinessIds',
                            'createdAt', 'updatedAt'
                        ],
                        include: [
                            { model: User, as: 'customer', attributes: ['id', 'name', 'email', 'firstName', 'lastName'] },
                            { model: Category, as: 'category', attributes: ['id', 'name'] }
                        ]
                    });
                } else {
                    throw dbError;
                }
            }
        }

        // Update lead status to rejected with rejection reason
        // Use try-catch to handle missing columns gracefully if migration hasn't been run
        try {
            await lead.update({
                status: 'rejected',
                rejectionReason: rejectionReason || null,
                rejectionReasonOther: rejectionReason === 'OTHER' ? rejectionReasonOther : null
            });
        } catch (updateError) {
            // If error is about missing columns, only update status (migration not run yet)
            if (updateError.message && updateError.message.includes('Unknown column')) {
                console.log('Migration not run yet, updating only status field...');
                await lead.update({
                    status: 'rejected'
                });
                // Log a warning that rejection reasons weren't saved
                console.warn('⚠️ Rejection reasons provided but not saved - migration not run yet');
            } else {
                throw updateError;
            }
        }

        // Get customer info for email
        const customer = serviceRequest?.customer || await User.findByPk(lead.customerId, {
            attributes: ['id', 'name', 'email', 'firstName', 'lastName']
        });

        // Send email notification to customer
        try {
            if (customer && customer.email) {
                const customerName = customer.firstName && customer.lastName
                    ? `${customer.firstName} ${customer.lastName}`
                    : customer.name || 'Customer';

                await sendEmail({
                    to: customer.email,
                    subject: 'Service Request Update - Provider Declined',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                            <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                                <h1 style="margin: 0; font-size: 28px;">Service Request Update</h1>
                            </div>
                            <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                    Hi ${customerName},
                                </p>
                                <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                    We wanted to inform you that a service provider has declined your service request.
                                </p>
                                
                                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                    <h3 style="margin-top: 0; color: #333;">Service Request Details</h3>
                                    <p style="margin: 5px 0;"><strong>Project:</strong> ${serviceRequest?.projectTitle || lead.serviceType || 'Service Request'}</p>
                                    <p style="margin: 5px 0;"><strong>Category:</strong> ${serviceRequest?.category?.name || lead.categoryId || 'N/A'}</p>
                                </div>

                                ${rejectionReason ? `
                                <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                                    <h3 style="margin-top: 0; color: #856404;">Rejection Reason</h3>
                                    <p style="margin: 5px 0; color: #856404;">
                                        <strong>Reason:</strong> ${rejectionReason === 'TOO_FAR' ? 'Too Far' :
                                rejectionReason === 'TOO_EXPENSIVE' ? 'Too Expensive' :
                                    rejectionReason === 'NOT_RELEVANT' ? 'Not Relevant Service Request' :
                                        'Other'}
                                    </p>
                                    ${rejectionReason === 'OTHER' && rejectionReasonOther ? `
                                    <p style="margin: 5px 0; color: #856404; white-space: pre-wrap;"><strong>Details:</strong> ${rejectionReasonOther}</p>
                                    ` : ''}
                                </div>
                                ` : ''}

                                <div style="background-color: #e7f3ff; padding: 16px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #007bff;">
                                    <p style="margin: 0; color: #004085; font-size: 14px; line-height: 1.6;">
                                        <strong>Don't worry!</strong><br>
                                        Your request has been sent to other service providers in your area. You'll receive responses from interested providers soon.
                                    </p>
                                </div>

                                <div style="text-align: center; margin-top: 30px; padding-top: 25px; border-top: 2px solid #e5e7eb;">
                                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-dashboard/requests" 
                                       style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                              padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                              font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                                        View My Requests
                                    </a>
                                </div>
                            </div>
                        </div>
                    `
                }).catch(err => {
                    console.error('Failed to send customer rejection notification email:', err);
                });
            }
        } catch (emailError) {
            console.error('Error sending rejection notification email:', emailError);
            // Don't fail the request if email fails
        }

        // Log activity
        await logActivity({
            type: 'lead_rejected',
            description: `Provider rejected lead "${lead.serviceType || lead.description?.substring(0, 50)}"`,
            userId: req.user.id,
            metadata: {
                leadId: lead.id,
                serviceRequestId: serviceRequestId,
                rejectionReason: rejectionReason || null,
                rejectionReasonOther: rejectionReason === 'OTHER' ? rejectionReasonOther : null
            }
        });

        // If service request exists, try to assign to next alternative provider
        if (serviceRequestId) {
            try {
                await assignLeadToNextAlternative(serviceRequestId, lead.id, req.user.id);
            } catch (assignError) {
                console.error('Error assigning lead to next alternative provider:', assignError);
                // Don't fail the rejection if reassignment fails
            }
        }

        res.json({
            success: true,
            message: 'Lead rejected successfully. Customer has been notified.',
            lead: {
                id: lead.id,
                status: lead.status
            }
        });
    } catch (error) {
        console.error('Reject lead error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server error'
        });
    }
});

// @route   GET /api/provider/service-requests
// @desc    Get all service requests for the logged-in provider
// @access  Private (Provider only)
router.get('/service-requests', protect, async (req, res) => {
    try {
        // Get provider profile for the logged-in user
        const providerProfile = await ProviderProfile.findOne({
            where: { userId: req.user.id },
            attributes: ['id', 'userId']
        });

        if (!providerProfile) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'Provider profile not found. Please complete your provider profile setup to view service requests.',
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 0,
                    pages: 0
                }
            });
        }

        // Query parameters
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;
        const statusFilter = req.query.status;

        // Get all leads for this provider to extract service request IDs
        const leads = await Lead.findAll({
            where: { providerId: req.user.id }, // User ID, not ProviderProfile ID
            attributes: ['id', 'metadata', 'status']
        });

        // Extract serviceRequestId from metadata
        const serviceRequestIds = [];
        const leadMap = new Map(); // Map serviceRequestId to lead info

        leads.forEach(lead => {
            if (lead.metadata) {
                try {
                    const metadata = typeof lead.metadata === 'string'
                        ? JSON.parse(lead.metadata)
                        : lead.metadata;
                    if (metadata.serviceRequestId) {
                        serviceRequestIds.push(metadata.serviceRequestId);
                        leadMap.set(metadata.serviceRequestId, {
                            leadId: lead.id,
                            leadStatus: lead.status
                        });
                    }
                } catch (e) {
                    console.error('Error parsing lead metadata:', e);
                }
            }
        });

        // Build where clause
        const where = {
            [Op.or]: [
                { primaryProviderId: providerProfile.id },
                { id: { [Op.in]: serviceRequestIds.length > 0 ? serviceRequestIds : [-1] } }
            ]
        };

        // Filter by status if provided
        if (statusFilter && statusFilter !== 'ALL') {
            where.status = statusFilter;
        }

        // Get total count
        const total = await ServiceRequest.count({ where });

        // Fetch service requests
        const serviceRequests = await ServiceRequest.findAll({
            where,
            include: [
                {
                    model: User,
                    as: 'customer',
                    attributes: ['id', 'name', 'email', 'phone', 'firstName', 'lastName']
                },
                {
                    model: Category,
                    as: 'category',
                    attributes: ['id', 'name', 'icon', 'description']
                },
                {
                    model: SubCategory,
                    as: 'subCategory',
                    attributes: ['id', 'name', 'description'],
                    required: false
                },
                {
                    model: ProviderProfile,
                    as: 'primaryProvider',
                    attributes: ['id', 'userId'],
                    include: [{
                        model: User,
                        as: 'user',
                        attributes: ['id', 'name', 'email'],
                        required: false
                    }],
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: pageSize,
            offset: offset
        });

        // Format response with lead information
        const formattedRequests = serviceRequests.map(request => {
            const leadInfo = leadMap.get(request.id);

            return {
                id: request.id,
                projectTitle: request.projectTitle,
                projectDescription: request.projectDescription,
                category: request.category ? {
                    id: request.category.id,
                    name: request.category.name,
                    icon: request.category.icon,
                    description: request.category.description
                } : null,
                subCategory: request.subCategory ? {
                    id: request.subCategory.id,
                    name: request.subCategory.name,
                    description: request.subCategory.description
                } : null,
                zipCode: request.zipCode,
                preferredDate: request.preferredDate,
                preferredTime: request.preferredTime,
                status: request.status,
                attachments: request.attachments ? (typeof request.attachments === 'string' ? JSON.parse(request.attachments) : request.attachments) : [],
                customer: request.customer ? {
                    id: request.customer.id,
                    name: request.customer.name || `${request.customer.firstName || ''} ${request.customer.lastName || ''}`.trim(),
                    email: request.customer.email,
                    phone: request.customer.phone
                } : null,
                primaryProvider: request.primaryProvider ? {
                    id: request.primaryProvider.id,
                    user: request.primaryProvider.user
                } : null,
                leadInfo: leadInfo ? {
                    leadId: leadInfo.leadId,
                    leadStatus: leadInfo.leadStatus
                } : null,
                createdAt: request.createdAt,
                updatedAt: request.updatedAt
            };
        });

        res.json({
            success: true,
            data: formattedRequests,
            pagination: {
                page,
                pageSize,
                total,
                pages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error('Get provider service requests error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server error'
        });
    }
});

// ==========================================
// WORK ORDERS ENDPOINTS
// ==========================================

// @route   GET /api/provider/work-orders
// @desc    Get all work orders for the logged-in provider
// @access  Private (Provider only)
router.get('/work-orders', protect, async (req, res) => {
    try {
        // Get provider profile for the logged-in user
        const providerProfile = await ProviderProfile.findOne({
            where: { userId: req.user.id },
            attributes: ['id', 'userId']
        });

        if (!providerProfile) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'Provider profile not found. Please complete your provider profile setup to view work orders.',
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 0,
                    pages: 0
                }
            });
        }

        // Get query parameters
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const statusFilter = req.query.status; // 'IN_PROGRESS', 'COMPLETED', or undefined for all

        // Build where clause
        const whereClause = {
            providerId: providerProfile.id
        };

        if (statusFilter && (statusFilter === 'IN_PROGRESS' || statusFilter === 'COMPLETED')) {
            whereClause.status = statusFilter;
        }

        // Calculate pagination
        const offset = (page - 1) * pageSize;

        // Get work orders with related data
        const { count, rows: workOrders } = await WorkOrder.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: ServiceRequest,
                    as: 'serviceRequest',
                    attributes: [
                        'id', 'projectTitle', 'projectDescription', 'zipCode',
                        'status', 'preferredDate', 'preferredTime', 'attachments',
                        'createdAt', 'updatedAt'
                    ],
                    include: [
                        {
                            model: Category,
                            as: 'category',
                            attributes: ['id', 'name', 'icon']
                        },
                        {
                            model: SubCategory,
                            as: 'subCategory',
                            attributes: ['id', 'name'],
                            required: false
                        },
                        {
                            model: User,
                            as: 'customer',
                            attributes: ['id', 'name', 'email', 'phone', 'avatar']
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: pageSize,
            offset: offset
        });

        // Get all service request IDs to fetch proposals
        const serviceRequestIds = workOrders
            .map(wo => wo.serviceRequest?.id)
            .filter(id => id !== undefined);

        // Fetch proposals for these service requests
        const proposals = serviceRequestIds.length > 0
            ? await Proposal.findAll({
                where: {
                    serviceRequestId: { [Op.in]: serviceRequestIds },
                    providerId: providerProfile.id,
                    status: 'ACCEPTED'
                },
                attributes: ['id', 'serviceRequestId', 'price', 'status', 'paymentStatus', 'paidAt']
            })
            : [];

        // Create a map of serviceRequestId -> proposal
        const proposalMap = {};
        proposals.forEach(proposal => {
            proposalMap[proposal.serviceRequestId] = {
                id: proposal.id,
                price: parseFloat(proposal.price),
                status: proposal.status,
                paymentStatus: proposal.paymentStatus,
                paidAt: proposal.paidAt
            };
        });

        // Format work orders for response
        const formattedWorkOrders = workOrders.map(workOrder => {
            const serviceRequest = workOrder.serviceRequest;
            const customer = serviceRequest?.customer;
            const proposalData = serviceRequest ? proposalMap[serviceRequest.id] || null : null;

            return {
                id: workOrder.id,
                status: workOrder.status,
                completedAt: workOrder.completedAt,
                createdAt: workOrder.createdAt,
                updatedAt: workOrder.updatedAt,
                serviceRequest: {
                    id: serviceRequest?.id,
                    projectTitle: serviceRequest?.projectTitle,
                    projectDescription: serviceRequest?.projectDescription,
                    zipCode: serviceRequest?.zipCode,
                    status: serviceRequest?.status,
                    preferredDate: serviceRequest?.preferredDate,
                    preferredTime: serviceRequest?.preferredTime,
                    attachments: serviceRequest?.attachments,
                    createdAt: serviceRequest?.createdAt,
                    category: serviceRequest?.category ? {
                        id: serviceRequest.category.id,
                        name: serviceRequest.category.name,
                        icon: serviceRequest.category.icon
                    } : null,
                    subCategory: serviceRequest?.subCategory ? {
                        id: serviceRequest.subCategory.id,
                        name: serviceRequest.subCategory.name
                    } : null
                },
                customer: customer ? {
                    id: customer.id,
                    name: customer.name,
                    email: customer.email,
                    phone: customer.phone,
                    avatar: customer.avatar
                } : null,
                proposal: proposalData
            };
        });

        // Calculate total pages
        const totalPages = Math.ceil(count / pageSize);

        res.json({
            success: true,
            data: formattedWorkOrders,
            pagination: {
                page,
                pageSize,
                total: count,
                pages: totalPages
            }
        });
    } catch (error) {
        console.error('Get work orders error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server error'
        });
    }
});

// @route   GET /api/provider/work-orders/:id
// @desc    Get single work order details
// @access  Private (Provider only)
router.get('/work-orders/:id', protect, async (req, res) => {
    try {
        const workOrderId = parseInt(req.params.id);

        if (isNaN(workOrderId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid work order ID'
            });
        }

        // Get provider profile
        const providerProfile = await ProviderProfile.findOne({
            where: { userId: req.user.id },
            attributes: ['id', 'userId']
        });

        if (!providerProfile) {
            return res.status(404).json({
                success: false,
                error: 'Provider profile not found'
            });
        }

        // Get work order with all related data
        const workOrder = await WorkOrder.findOne({
            where: {
                id: workOrderId,
                providerId: providerProfile.id
            },
            include: [
                {
                    model: ServiceRequest,
                    as: 'serviceRequest',
                    attributes: [
                        'id', 'projectTitle', 'projectDescription', 'zipCode',
                        'status', 'preferredDate', 'preferredTime', 'attachments',
                        'createdAt', 'updatedAt', 'categoryId', 'subCategoryId'
                    ],
                    include: [
                        {
                            model: Category,
                            as: 'category',
                            attributes: ['id', 'name', 'icon', 'description']
                        },
                        {
                            model: SubCategory,
                            as: 'subCategory',
                            attributes: ['id', 'name', 'description'],
                            required: false
                        },
                        {
                            model: User,
                            as: 'customer',
                            attributes: ['id', 'name', 'email', 'phone', 'avatar']
                        }
                    ]
                }
            ]
        });

        if (!workOrder) {
            return res.status(404).json({
                success: false,
                error: 'Work order not found'
            });
        }

        // Get proposal for this service request
        let proposalData = null;
        if (workOrder.serviceRequest) {
            const proposal = await Proposal.findOne({
                where: {
                    serviceRequestId: workOrder.serviceRequest.id,
                    providerId: providerProfile.id,
                    status: 'ACCEPTED'
                },
                attributes: ['id', 'details', 'price', 'status', 'paymentStatus', 'paidAt', 'createdAt']
            });

            if (proposal) {
                proposalData = {
                    id: proposal.id,
                    details: proposal.details,
                    price: parseFloat(proposal.price),
                    status: proposal.status,
                    paymentStatus: proposal.paymentStatus,
                    paidAt: proposal.paidAt,
                    createdAt: proposal.createdAt
                };
            }
        }

        // Format response
        const formattedWorkOrder = {
            id: workOrder.id,
            status: workOrder.status,
            completedAt: workOrder.completedAt,
            createdAt: workOrder.createdAt,
            updatedAt: workOrder.updatedAt,
            serviceRequest: {
                id: workOrder.serviceRequest?.id,
                projectTitle: workOrder.serviceRequest?.projectTitle,
                projectDescription: workOrder.serviceRequest?.projectDescription,
                zipCode: workOrder.serviceRequest?.zipCode,
                status: workOrder.serviceRequest?.status,
                preferredDate: workOrder.serviceRequest?.preferredDate,
                preferredTime: workOrder.serviceRequest?.preferredTime,
                attachments: workOrder.serviceRequest?.attachments,
                createdAt: workOrder.serviceRequest?.createdAt,
                updatedAt: workOrder.serviceRequest?.updatedAt,
                category: workOrder.serviceRequest?.category ? {
                    id: workOrder.serviceRequest.category.id,
                    name: workOrder.serviceRequest.category.name,
                    icon: workOrder.serviceRequest.category.icon,
                    description: workOrder.serviceRequest.category.description
                } : null,
                subCategory: workOrder.serviceRequest?.subCategory ? {
                    id: workOrder.serviceRequest.subCategory.id,
                    name: workOrder.serviceRequest.subCategory.name,
                    description: workOrder.serviceRequest.subCategory.description
                } : null
            },
            customer: workOrder.serviceRequest?.customer ? {
                id: workOrder.serviceRequest.customer.id,
                name: workOrder.serviceRequest.customer.name,
                email: workOrder.serviceRequest.customer.email,
                phone: workOrder.serviceRequest.customer.phone,
                avatar: workOrder.serviceRequest.customer.avatar
            } : null,
            proposal: proposalData
        };

        res.json({
            success: true,
            data: formattedWorkOrder
        });
    } catch (error) {
        console.error('Get work order detail error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server error'
        });
    }
});

// @route   PATCH /api/provider/work-orders/:id/complete
// @desc    Mark work order as completed
// @access  Private (Provider only)
router.patch('/work-orders/:id/complete', protect, async (req, res) => {
    try {
        const workOrderId = parseInt(req.params.id);

        if (isNaN(workOrderId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid work order ID'
            });
        }

        // Get provider profile
        const providerProfile = await ProviderProfile.findOne({
            where: { userId: req.user.id },
            attributes: ['id', 'userId']
        });

        if (!providerProfile) {
            return res.status(404).json({
                success: false,
                error: 'Provider profile not found'
            });
        }

        // Get work order
        const workOrder = await WorkOrder.findOne({
            where: {
                id: workOrderId,
                providerId: providerProfile.id
            },
            include: [
                {
                    model: ServiceRequest,
                    as: 'serviceRequest',
                    include: [
                        {
                            model: User,
                            as: 'customer',
                            attributes: ['id', 'name', 'email']
                        },
                        {
                            model: Category,
                            as: 'category',
                            attributes: ['id', 'name']
                        }
                    ]
                }
            ]
        });

        if (!workOrder) {
            return res.status(404).json({
                success: false,
                error: 'Work order not found'
            });
        }

        // Check if already completed
        if (workOrder.status === 'COMPLETED') {
            return res.status(400).json({
                success: false,
                error: 'Work order is already completed'
            });
        }

        // Check if service request is in valid state
        if (workOrder.serviceRequest.status !== 'IN_PROGRESS') {
            return res.status(400).json({
                success: false,
                error: `Cannot complete work order. Service request status is: ${workOrder.serviceRequest.status}`
            });
        }

        // Update work order
        await workOrder.update({
            status: 'COMPLETED',
            completedAt: new Date()
        });

        // Update service request status
        await workOrder.serviceRequest.update({
            status: 'COMPLETED'
        });

        // Prepare response data
        const responseData = {
            success: true,
            message: 'Work order marked as completed successfully',
            data: {
                workOrderId: workOrder.id,
                serviceRequestStatus: workOrder.serviceRequest.status,
                completedAt: workOrder.completedAt
            }
        };

        // Send response immediately
        res.json(responseData);

        // Send email notification to customer (non-blocking)
        if (workOrder.serviceRequest.customer) {
            const customer = workOrder.serviceRequest.customer;
            const projectTitle = workOrder.serviceRequest.projectTitle;
            const categoryName = workOrder.serviceRequest.category?.name || 'Service';

            sendEmail({
                to: customer.email,
                subject: `Work Completed: ${projectTitle}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; font-size: 28px;">✅ Work Completed!</h1>
                        </div>
                        <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                Hi ${customer.name || 'there'},
                            </p>
                            <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                Great news! The work for <strong>${projectTitle}</strong> has been completed by your service provider.
                            </p>
                            <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="color: #1e40af; margin-top: 0;">Project Details:</h3>
                                <p style="color: #333; margin: 5px 0;"><strong>Service:</strong> ${categoryName}</p>
                                <p style="color: #333; margin: 5px 0;"><strong>Status:</strong> <span style="color: #059669; font-weight: 600;">COMPLETED</span></p>
                            </div>
                            <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                Please review the completed work and approve it if you're satisfied. You can also leave a review to help other customers.
                            </p>
                            <div style="text-align: center; margin-top: 30px;">
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-dashboard/requests" 
                                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                          padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                          font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                                    Review & Approve
                                </a>
                            </div>
                        </div>
                    </div>
                `
            }).catch(err => console.error('Failed to send email to customer:', err));
        }

        // Log activity (non-blocking)
        logActivity({
            type: 'work_order_completed',
            description: `Work order completed for service request "${workOrder.serviceRequest.projectTitle}"`,
            userId: req.user.id,
            metadata: {
                workOrderId: workOrder.id,
                serviceRequestId: workOrder.serviceRequest.id,
                providerId: providerProfile.id
            }
        }).catch(err => console.error('Failed to log activity:', err));
    } catch (error) {
        console.error('Complete work order error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server error'
        });
    }
});

// ==========================================
// PROVIDER PAYOUTS ENDPOINT
// ==========================================

// @route   GET /api/provider/payouts
// @desc    Get provider payout history
// @access  Private (Provider only)
router.get('/payouts', protect, async (req, res) => {
    try {
        const providerProfile = await ProviderProfile.findOne({
            where: { userId: req.user.id },
            attributes: ['id', 'userId']
        });

        if (!providerProfile) {
            return res.status(404).json({
                success: false,
                error: 'Provider profile not found'
            });
        }

        // Define base attributes (columns that always exist)
        const baseAttributes = [
            'id', 'serviceRequestId', 'providerId', 'details', 'price',
            'status', 'stripePaymentIntentId', 'paymentStatus', 'paidAt',
            'createdAt', 'updatedAt'
        ];

        // Define payout attributes (may not exist if migration hasn't run)
        const payoutAttributes = [
            'providerPayoutAmount', 'platformFeeAmount', 'payoutStatus', 'payoutProcessedAt', 'stripeTransferId'
        ];

        // Try to include payout attributes, fallback to base if they don't exist
        let attributes = [...baseAttributes, ...payoutAttributes];
        let hasPayoutFields = true;

        // Get pagination parameters
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        // Get proposals with payment succeeded (paginated)
        let count, proposals;
        try {
            const result = await Proposal.findAndCountAll({
                where: {
                    providerId: providerProfile.id,
                    paymentStatus: 'succeeded'
                },
                attributes: attributes,
                include: [{
                    model: ServiceRequest,
                    as: 'serviceRequest',
                    attributes: ['id', 'projectTitle', 'status', 'createdAt'],
                    required: false
                }],
                order: [
                    // Order by payoutProcessedAt if available (DESC), otherwise by paidAt (DESC)
                    ['payoutProcessedAt', 'DESC'],
                    ['paidAt', 'DESC']
                ],
                limit: pageSize,
                offset: offset
            });
            count = result.count;
            proposals = result.rows;
        } catch (error) {
            // If error is due to missing payout columns, retry with base attributes only
            if (error.message && error.message.includes('Unknown column') &&
                (error.message.includes('payoutStatus') || error.message.includes('providerPayoutAmount') ||
                    error.message.includes('payoutProcessedAt'))) {
                console.log('⚠️  Payout columns not found, using base attributes only (migration may be pending)');
                hasPayoutFields = false;
                attributes = baseAttributes;
                const result = await Proposal.findAndCountAll({
                    where: {
                        providerId: providerProfile.id,
                        paymentStatus: 'succeeded'
                    },
                    attributes: baseAttributes,
                    include: [{
                        model: ServiceRequest,
                        as: 'serviceRequest',
                        attributes: ['id', 'projectTitle', 'status', 'createdAt'],
                        required: false
                    }],
                    order: [['paidAt', 'DESC']],
                    limit: pageSize,
                    offset: offset
                });
                count = result.count;
                proposals = result.rows;
            } else {
                throw error;
            }
        }

        const { calculatePayouts } = require('../config/platformFee');

        // Map proposals to payout objects with proper calculations
        const payouts = proposals.map(proposal => {
            const totalAmount = parseFloat(proposal.price) || 0;

            // Try to get payout amounts from proposal if fields exist and are set
            let providerAmount = null;
            let platformFee = null;

            if (hasPayoutFields && proposal.providerPayoutAmount != null) {
                providerAmount = parseFloat(proposal.providerPayoutAmount);
                platformFee = (proposal.platformFeeAmount != null) ? parseFloat(proposal.platformFeeAmount) : null;
            }

            // Calculate if not set (for older proposals or when fields don't exist)
            let calculatedProviderAmount = providerAmount;
            let calculatedPlatformFee = platformFee;

            if (providerAmount === null || platformFee === null) {
                const calculated = calculatePayouts(totalAmount);
                calculatedProviderAmount = calculated.providerAmount;
                calculatedPlatformFee = calculated.platformFee;
            }

            // Determine payout status
            // Default to 'pending' if not set, but respect existing status
            let payoutStatus = 'pending';
            if (hasPayoutFields && proposal.payoutStatus != null) {
                payoutStatus = proposal.payoutStatus;
            }

            // Normalize status - ensure it's a valid value
            const validStatuses = ['pending', 'processing', 'completed', 'failed'];
            if (!validStatuses.includes(payoutStatus)) {
                console.warn(`[Payouts] Invalid payout status '${payoutStatus}' for proposal ${proposal.id}, defaulting to 'pending'`);
                payoutStatus = 'pending';
            }

            // Debug: Log if we see a failed payout with CLOSED service request
            if (payoutStatus === 'failed' && proposal.serviceRequest?.status === 'CLOSED') {
                console.warn(`[Payouts] ⚠️ WARNING: Found failed payout for proposal ${proposal.id} with CLOSED service request. This may need manual review.`);
            }

            return {
                id: proposal.id,
                proposalId: proposal.id,
                serviceRequestId: proposal.serviceRequestId,
                projectTitle: proposal.serviceRequest?.projectTitle || 'Project',
                totalAmount: totalAmount,
                providerAmount: calculatedProviderAmount,
                platformFee: calculatedPlatformFee,
                payoutStatus: payoutStatus,
                paidAt: proposal.paidAt,
                payoutProcessedAt: (hasPayoutFields && proposal.payoutProcessedAt) ? proposal.payoutProcessedAt : null,
                serviceRequestStatus: proposal.serviceRequest?.status,
                createdAt: proposal.createdAt
            };
        });

        // Calculate stats from ALL payouts (not just current page) for accurate totals
        let allProposalsForStats;
        let statsHasPayoutFields = hasPayoutFields; // Track separately for stats query
        try {
            const statsAttributes = statsHasPayoutFields
                ? [...baseAttributes, 'providerPayoutAmount', 'platformFeeAmount', 'payoutStatus']
                : baseAttributes;
            allProposalsForStats = await Proposal.findAll({
                where: {
                    providerId: providerProfile.id,
                    paymentStatus: 'succeeded'
                },
                attributes: statsAttributes,
                raw: true
            });
        } catch (statsError) {
            // Fallback if payout fields don't exist
            if (statsError.message && statsError.message.includes('Unknown column')) {
                console.log('⚠️  Payout columns not found for stats query, using base attributes only');
                allProposalsForStats = await Proposal.findAll({
                    where: {
                        providerId: providerProfile.id,
                        paymentStatus: 'succeeded'
                    },
                    attributes: baseAttributes,
                    raw: true
                });
                statsHasPayoutFields = false;
            } else {
                throw statsError;
            }
        }

        const stats = {
            totalEarnings: 0,
            totalPayouts: 0,
            pendingPayouts: 0,
            completedPayouts: 0
        };

        // Debug: Count statuses for diagnostics
        const statusCounts = {
            completed: 0,
            pending: 0,
            processing: 0,
            failed: 0,
            null_or_missing: 0
        };

        allProposalsForStats.forEach(proposal => {
            const totalAmount = parseFloat(proposal.price) || 0;
            let providerAmount = null;
            let payoutStatus = 'pending';

            // Get payout amount and status if fields exist
            if (statsHasPayoutFields) {
                // Try to get payout status (may be null if not set)
                if (proposal.payoutStatus != null) {
                    payoutStatus = proposal.payoutStatus;
                    statusCounts[payoutStatus] = (statusCounts[payoutStatus] || 0) + 1;
                } else {
                    statusCounts.null_or_missing += 1;
                }

                // Try to get stored payout amount
                if (proposal.providerPayoutAmount != null) {
                    providerAmount = parseFloat(proposal.providerPayoutAmount);
                } else {
                    // Calculate if not stored
                    const calculated = calculatePayouts(totalAmount);
                    providerAmount = calculated.providerAmount;
                }
            } else {
                // Calculate payout amount if fields don't exist
                const calculated = calculatePayouts(totalAmount);
                providerAmount = calculated.providerAmount;
                // Status stays as 'pending' (default) when fields don't exist
                statusCounts.null_or_missing += 1;
            }

            // Update stats
            stats.totalEarnings += totalAmount;

            // Only count completed payouts in totalPayouts
            if (payoutStatus === 'completed' && providerAmount) {
                stats.totalPayouts += providerAmount;
                stats.completedPayouts += 1;
            }
            // Count pending and processing in pendingPayouts
            if ((payoutStatus === 'pending' || payoutStatus === 'processing') && providerAmount) {
                stats.pendingPayouts += providerAmount;
            }
            // Note: 'failed' status is not counted in either category
        });

        // Log diagnostic information for debugging
        console.log(`[Payouts Stats] Provider ${providerProfile.id}:`, {
            totalProposals: allProposalsForStats.length,
            hasPayoutFields: statsHasPayoutFields,
            statusBreakdown: statusCounts,
            stats: {
                totalEarnings: stats.totalEarnings.toFixed(2),
                totalPayouts: stats.totalPayouts.toFixed(2),
                pendingPayouts: stats.pendingPayouts.toFixed(2),
                completedPayouts: stats.completedPayouts
            }
        });

        // Log sample payout data for debugging
        if (payouts.length > 0) {
            console.log(`[Payouts Debug] Sample payout data (first 3):`, payouts.slice(0, 3).map(p => ({
                id: p.id,
                payoutStatus: p.payoutStatus,
                serviceRequestStatus: p.serviceRequestStatus,
                projectTitle: p.projectTitle
            })));
        }

        res.json({
            success: true,
            data: payouts,
            stats: stats,
            pagination: {
                page: page,
                pageSize: pageSize,
                total: count,
                pages: Math.ceil(count / pageSize)
            }
        });
    } catch (error) {
        console.error('Get payouts error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server error'
        });
    }
});

module.exports = router;



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
        console.log(`[Provider Leads] Querying leads with where clause:`, JSON.stringify(where, null, 2));
        const { count, rows: leads } = await Lead.findAndCountAll({
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

        console.log(`[Provider Leads] Found ${count} leads, returning ${leads.length} leads`);

        // Format response with masked customer data
        // Note: providerProfile is already declared at the beginning of this route handler
        const formattedLeads = await Promise.all(leads.map(async (lead) => {
            // Use customer from User association or from lead fields
            const customer = lead.customer;
            const customerName = lead.customerName || (customer?.name || customer?.firstName || 'Customer');
            const customerEmail = lead.customerEmail || customer?.email;

            let maskedName = 'Customer';
            let maskedEmail = null;

            // Mask customer name
            if (customerName) {
                const nameParts = customerName.split(' ');
                if (nameParts.length > 1) {
                    maskedName = `${nameParts[0]} ${nameParts[1].charAt(0)}***`;
                } else {
                    maskedName = `${nameParts[0].charAt(0)}***`;
                }
            }

            // Mask email
            if (customerEmail) {
                const emailParts = customerEmail.split('@');
                if (emailParts[0].length > 0) {
                    maskedEmail = `${emailParts[0].charAt(0)}***@${emailParts[1]}`;
                }
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

            // Use service request info if available, otherwise use lead data
            const projectTitle = serviceRequestInfo?.projectTitle || lead.serviceType || 'Service Request';
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
                        name: maskedName,
                        email: maskedEmail
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
        const lead = await Lead.findOne({
            where: {
                id: req.params.id,
                providerId: req.user.id // User ID, not ProviderProfile ID
            }
        });

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

        // Get proposal data from request body
        const { description, price } = req.body;

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
            priorityBoostPoints: subscriptionBenefits.priorityBoostPoints
        });

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

        // Create Stripe PaymentIntent for lead cost
        console.log(`[Accept Lead] Creating Stripe PaymentIntent for lead ${lead.id}`);
        let paymentIntent;
        try {
            paymentIntent = await stripe.paymentIntents.create({
                amount: leadCostCents,
                currency: 'usd',
                metadata: {
                    leadId: lead.id.toString(),
                    serviceRequestId: serviceRequestId ? serviceRequestId.toString() : '',
                    providerId: req.user.id.toString(),
                    type: 'lead_acceptance',
                    proposalDescription: description.trim().substring(0, 200), // Limit length
                    proposalPrice: parseFloat(price).toFixed(2)
                },
                description: `Lead acceptance fee - ${lead.serviceType || 'Service Request'}`,
                // Store proposal data temporarily in metadata (will be used after payment succeeds)
                automatic_payment_methods: {
                    enabled: true
                }
            });
            console.log(`[Accept Lead] ✅ Stripe PaymentIntent created: ${paymentIntent.id}`);
        } catch (stripeError) {
            console.error('❌ Stripe PaymentIntent creation failed:', stripeError);
            throw new Error(`Failed to create payment intent: ${stripeError.message}`);
        }

        // Update lead with payment intent ID and cost
        console.log(`[Accept Lead] Updating lead ${lead.id} with payment intent ${paymentIntent.id}`);
        try {
            // Store proposal data in lead metadata temporarily (will be used by webhook)
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

            // Update lead with payment intent ID, cost, and metadata in one call
            await lead.update({
                stripePaymentIntentId: paymentIntent.id,
                leadCost: leadCostCents,
                metadata: JSON.stringify(metadata)
            });
            console.log(`[Accept Lead] ✅ Lead updated with payment intent ID and proposal data`);
        } catch (updateError) {
            console.error('❌ Failed to update lead:', updateError);
            throw new Error(`Failed to update lead: ${updateError.message}`);
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
        const lead = await Lead.findOne({
            where: {
                id: req.params.id,
                providerId: req.user.id // User ID, not ProviderProfile ID
            }
        });

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
        const { reason } = req.body;

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
        if (serviceRequestId) {
            serviceRequest = await ServiceRequest.findByPk(serviceRequestId, {
                include: [
                    { model: User, as: 'customer', attributes: ['id', 'name', 'email', 'firstName', 'lastName'] },
                    { model: Category, as: 'category', attributes: ['id', 'name'] }
                ]
            });
        }

        // Update lead status to rejected
        await lead.update({
            status: 'rejected'
        });

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

                                ${reason ? `
                                <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                                    <h3 style="margin-top: 0; color: #856404;">Provider's Note</h3>
                                    <p style="margin: 5px 0; color: #856404; white-space: pre-wrap;">${reason}</p>
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
                reason: reason || null
            }
        });

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



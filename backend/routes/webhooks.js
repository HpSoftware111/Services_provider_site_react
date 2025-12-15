const express = require('express');
const router = express.Router();
const stripe = require('../config/stripe');
const { Proposal, ServiceRequest, WorkOrder, Lead, User, ProviderProfile, Category, Business, UserSubscription, SubscriptionPlan } = require('../models');
const sendEmail = require('../utils/sendEmail');
const logActivity = require('../utils/logActivity');
const { Op } = require('sequelize');

// Stripe webhook endpoint
// Note: For production, configure Stripe CLI or use a service like ngrok to forward webhooks
// In development, you can use: stripe listen --forward-to localhost:5000/api/webhooks/stripe

// @route   POST /api/webhooks/stripe
// @desc    Handle Stripe webhook events
// @access  Public (Stripe calls this directly)
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        if (!webhookSecret) {
            console.warn('⚠️  STRIPE_WEBHOOK_SECRET not configured. Webhook verification skipped.');
            // In development, parse the event without verification
            event = JSON.parse(req.body.toString());
        } else {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        }
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
        switch (event.type) {
            case 'payment_intent.succeeded':
                await handlePaymentIntentSucceeded(event.data.object);
                break;

            case 'payment_intent.payment_failed':
                await handlePaymentIntentFailed(event.data.object);
                break;

            case 'payment_intent.canceled':
                await handlePaymentIntentCanceled(event.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Error handling webhook event:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
});

// Handle successful payment
async function handlePaymentIntentSucceeded(paymentIntent) {
    try {
        const { metadata } = paymentIntent;

        console.log('[Webhook] Processing payment_intent.succeeded:', {
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount,
            metadata: metadata
        });

        // Check if this is a subscription payment, lead payment, or proposal payment
        if (metadata.type === 'subscription') {
            await handleSubscriptionPaymentSucceeded(paymentIntent);
        } else if (metadata.type === 'lead_acceptance') {
            await handleLeadPaymentSucceeded(paymentIntent);
        } else if (metadata.proposalId) {
            // Check if this is a pending proposal (string like "pending-6")
            if (metadata.proposalId.toString().startsWith('pending-')) {
                // This is a pending proposal payment - handle it as a lead payment
                // because the proposal hasn't been created in the database yet
                console.log('[Webhook] Detected pending proposal payment, handling as lead payment');
                await handleLeadPaymentSucceeded(paymentIntent);
            } else {
                // Regular proposal payment
                await handleProposalPaymentSucceeded(paymentIntent);
            }
        } else {
            console.error('[Webhook] Unknown payment type in metadata:', metadata);
        }
    } catch (error) {
        console.error('Error handling payment_intent.succeeded:', error);
        throw error; // Re-throw to trigger webhook retry
    }
}

// Handle lead payment success
async function handleLeadPaymentSucceeded(paymentIntent) {
    const { metadata } = paymentIntent;

    // For pending proposals, leadId might be in proposalId (format: "pending-{leadId}")
    let leadId = null;
    if (metadata.leadId) {
        leadId = parseInt(metadata.leadId);
    } else if (metadata.proposalId && metadata.proposalId.toString().startsWith('pending-')) {
        // Extract leadId from "pending-{leadId}"
        leadId = parseInt(metadata.proposalId.toString().replace('pending-', ''));
        console.log('[Webhook] Extracted leadId from pending proposal ID:', leadId);
    }

    const serviceRequestId = metadata.serviceRequestId ? parseInt(metadata.serviceRequestId) : null;
    const providerId = metadata.providerId ? parseInt(metadata.providerId) : null;

    if (!leadId || isNaN(leadId)) {
        console.error('[Webhook] No valid leadId in payment intent metadata:', {
            leadId: metadata.leadId,
            proposalId: metadata.proposalId,
            metadata: metadata
        });
        return;
    }

    // Find lead
    const lead = await Lead.findByPk(leadId);
    if (!lead) {
        console.error(`Lead ${leadId} not found`);
        return;
    }

    // Check if already processed (idempotency)
    if (lead.status === 'accepted') {
        console.log(`Lead ${leadId} already accepted, skipping webhook processing`);
        return;
    }

    // Get provider profile
    const providerProfile = await ProviderProfile.findOne({
        where: { userId: providerId },
        attributes: ['id', 'userId'],
        include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'firstName', 'lastName']
        }]
    });

    if (!providerProfile) {
        console.error(`Provider profile not found for user ${providerId}`);
        return;
    }

    // Get proposal data from metadata
    console.log(`[Webhook] Extracting proposal data from payment intent metadata:`, {
        proposalDescription: metadata.proposalDescription,
        proposalPrice: metadata.proposalPrice,
        hasMetadata: !!metadata
    });

    let proposalDescription = metadata.proposalDescription || '';
    let proposalPrice = parseFloat(metadata.proposalPrice) || 0;

    // Try to get from lead metadata if not in payment intent
    if (!proposalDescription || proposalPrice === 0) {
        console.log(`[Webhook] Proposal data missing from payment intent, checking lead metadata...`);
        try {
            const leadMetadata = typeof lead.metadata === 'string' ? JSON.parse(lead.metadata) : lead.metadata;
            if (leadMetadata && leadMetadata.pendingProposal) {
                proposalDescription = leadMetadata.pendingProposal.description || proposalDescription;
                proposalPrice = leadMetadata.pendingProposal.price || proposalPrice;
                console.log(`[Webhook] Found proposal data in lead metadata:`, {
                    description: proposalDescription.substring(0, 50) + '...',
                    price: proposalPrice
                });
            } else {
                console.log(`[Webhook] ⚠️ No pendingProposal found in lead metadata`);
            }
        } catch (e) {
            console.error('[Webhook] Error parsing lead metadata for proposal:', e);
        }
    } else {
        console.log(`[Webhook] ✅ Proposal data found in payment intent metadata:`, {
            description: proposalDescription.substring(0, 50) + '...',
            price: proposalPrice
        });
    }

    console.log(`[Webhook] Final proposal data:`, {
        description: proposalDescription ? `${proposalDescription.substring(0, 50)}...` : 'EMPTY',
        price: proposalPrice,
        serviceRequestId
    });

    // Get customer info to reveal contact details after payment succeeds
    const customer = await User.findByPk(lead.customerId, {
        attributes: ['id', 'name', 'email', 'phone', 'firstName', 'lastName']
    });

    const customerName = customer?.firstName && customer?.lastName
        ? `${customer.firstName} ${customer.lastName}`
        : customer?.name || customer?.email || 'Customer';

    // Update lead status to accepted and reveal customer contact details
    await lead.update({
        status: 'accepted',
        customerName: customerName,
        customerEmail: customer?.email || null,
        customerPhone: customer?.phone || null
    });
    console.log(`[Webhook] ✅ Lead updated to accepted status with customer contact details revealed`);

    // Create Proposal if serviceRequestId exists
    let proposal = null;
    if (serviceRequestId && proposalDescription && proposalPrice > 0) {
        console.log(`[Webhook] Creating proposal for serviceRequestId=${serviceRequestId}, providerId=${providerProfile.id}`);
        proposal = await Proposal.create({
            serviceRequestId: serviceRequestId,
            providerId: providerProfile.id,
            details: proposalDescription,
            price: proposalPrice,
            status: 'SENT'
        });
        console.log(`[Webhook] ✅ Proposal created: ID=${proposal.id}, status=${proposal.status}, price=$${proposalPrice}`);
    } else {
        console.log(`[Webhook] ⚠️ Skipping proposal creation:`, {
            serviceRequestId,
            hasDescription: !!proposalDescription,
            hasPrice: proposalPrice > 0
        });
    }

    // Update service request if exists
    if (serviceRequestId) {
        const serviceRequest = await ServiceRequest.findByPk(serviceRequestId, {
            include: [
                { model: User, as: 'customer', attributes: ['id', 'name', 'email', 'firstName', 'lastName'] },
                { model: Category, as: 'category', attributes: ['id', 'name'] }
            ]
        });

        if (serviceRequest) {
            // Update service request status and primary provider
            console.log(`[Webhook] Updating service request ${serviceRequestId}: primaryProviderId=${providerProfile.id}, status=LEAD_ASSIGNED`);
            await serviceRequest.update({
                primaryProviderId: providerProfile.id,
                status: 'LEAD_ASSIGNED' // Will change to IN_PROGRESS when customer accepts proposal
            });
            console.log(`[Webhook] ✅ Service request updated with primaryProviderId`);

            // Send emails
            await sendLeadAcceptedEmails(serviceRequest, providerProfile, lead, proposal);
        }
    } else {
        // Send emails without service request
        await sendLeadAcceptedEmails(null, providerProfile, lead, proposal);
    }

    // Log activity
    await logActivity({
        type: 'lead_payment_succeeded',
        description: `Lead payment succeeded and lead accepted - "${lead.serviceType || lead.description?.substring(0, 50)}"`,
        userId: providerId,
        metadata: {
            leadId: lead.id,
            paymentIntentId: paymentIntent.id,
            proposalId: proposal?.id,
            serviceRequestId: serviceRequestId
        }
    });

    console.log(`✅ Lead payment succeeded for lead ${leadId}`);
}

// Handle subscription payment success
async function handleSubscriptionPaymentSucceeded(paymentIntent) {
    try {
        const { metadata } = paymentIntent;
        const userId = parseInt(metadata.userId);
        const subscriptionPlanId = parseInt(metadata.subscriptionPlanId);

        if (!userId || !subscriptionPlanId) {
            console.error('[Webhook] Missing userId or subscriptionPlanId in payment intent metadata:', metadata);
            return;
        }

        // Get plan details
        const plan = await SubscriptionPlan.findByPk(subscriptionPlanId);
        if (!plan) {
            console.error(`[Webhook] Subscription plan ${subscriptionPlanId} not found`);
            return;
        }

        // Check if subscription already exists
        let subscription = await UserSubscription.findOne({
            where: { userId: userId }
        });

        const billingPeriodEnd = plan.billingCycle === 'MONTHLY'
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

        if (subscription) {
            // Update existing subscription
            await subscription.update({
                subscriptionPlanId,
                status: 'ACTIVE',
                currentPeriodStart: new Date(),
                currentPeriodEnd: billingPeriodEnd,
                cancelledAt: null
            });
            console.log(`[Webhook] ✅ Updated subscription for user ${userId}`);
        } else {
            // Create new subscription
            subscription = await UserSubscription.create({
                userId: userId,
                subscriptionPlanId: subscriptionPlanId,
                status: 'ACTIVE',
                currentPeriodStart: new Date(),
                currentPeriodEnd: billingPeriodEnd
            });
            console.log(`[Webhook] ✅ Created subscription for user ${userId}`);
        }

        // Get user info for email
        const user = await User.findByPk(userId);
        if (user && user.email) {
            const userName = user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.name || 'Customer';

            await sendEmail({
                to: user.email,
                subject: `Subscription Activated - ${plan.name}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; font-size: 28px;">Subscription Activated!</h1>
                        </div>
                        <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                Hi ${userName},
                            </p>
                            <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                Your subscription to <strong>${plan.name}</strong> has been successfully activated!
                            </p>
                            
                            <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                                <h3 style="margin-top: 0; color: #059669;">Subscription Details</h3>
                                <p style="margin: 5px 0;"><strong>Plan:</strong> ${plan.name}</p>
                                <p style="margin: 5px 0;"><strong>Price:</strong> $${parseFloat(plan.price).toFixed(2)}/${plan.billingCycle === 'MONTHLY' ? 'month' : 'year'}</p>
                                <p style="margin: 5px 0;"><strong>Status:</strong> Active</p>
                                <p style="margin: 5px 0;"><strong>Renewal Date:</strong> ${billingPeriodEnd.toLocaleDateString()}</p>
                            </div>

                            <div style="text-align: center; margin-top: 30px; padding-top: 25px; border-top: 2px solid #e5e7eb;">
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-dashboard/subscriptions" 
                                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                          padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                          font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                                    View My Subscription
                                </a>
                            </div>
                        </div>
                    </div>
                `
            }).catch(err => {
                console.error('Failed to send subscription activation email:', err);
            });
        }

        // Log activity
        await logActivity({
            type: 'subscription_activated',
            description: `Subscription activated - ${plan.name}`,
            userId: userId,
            metadata: {
                subscriptionPlanId: subscriptionPlanId,
                paymentIntentId: paymentIntent.id,
                subscriptionId: subscription.id
            }
        });

        console.log(`✅ Subscription payment succeeded for user ${userId}`);
    } catch (error) {
        console.error('Error handling subscription payment succeeded:', error);
        throw error; // Re-throw to trigger webhook retry
    }
}

// Handle proposal payment success (existing functionality)
async function handleProposalPaymentSucceeded(paymentIntent) {
    const { metadata } = paymentIntent;
    const proposalId = parseInt(metadata.proposalId);

    if (!proposalId) {
        console.error('No proposalId in payment intent metadata');
        return;
    }

    // Find proposal
    const proposal = await Proposal.findByPk(proposalId, {
        include: [{
            model: ProviderProfile,
            as: 'provider',
            attributes: ['id', 'userId'],
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'name', 'email']
            }]
        }]
    });

    if (!proposal) {
        console.error(`Proposal ${proposalId} not found`);
        return;
    }

    // Calculate payout amounts (90% to provider, 10% platform fee)
    const { calculatePayouts } = require('../config/platformFee');
    const proposalPrice = parseFloat(proposal.price);
    const { providerAmount, platformFee } = calculatePayouts(proposalPrice);

    // Update proposal payment status and payout information
    if (proposal.paymentStatus !== 'succeeded') {
        await proposal.update({
            paymentStatus: 'succeeded',
            paidAt: new Date(),
            providerPayoutAmount: providerAmount,
            platformFeeAmount: platformFee,
            payoutStatus: 'pending' // Will be processed after work approval
        });

        console.log(`✅ Payment succeeded for proposal ${proposalId}`);
        console.log(`💰 Payout calculated: Provider=${providerAmount.toFixed(2)}, Platform Fee=${platformFee.toFixed(2)}`);
    } else {
        // If already succeeded, just update payout amounts if not set
        if (!proposal.providerPayoutAmount || !proposal.platformFeeAmount) {
            await proposal.update({
                providerPayoutAmount: providerAmount,
                platformFeeAmount: platformFee
            });
        }
    }
}

// Send emails when lead is accepted after payment
async function sendLeadAcceptedEmails(serviceRequest, providerProfile, lead, proposal) {
    try {
        const provider = providerProfile.user;
        const providerName = provider.firstName && provider.lastName
            ? `${provider.firstName} ${provider.lastName}`
            : provider.name || 'Provider';

        // Email to provider
        if (provider && provider.email) {
            await sendEmail({
                to: provider.email,
                subject: `Lead confirmed — ${serviceRequest?.projectTitle || lead.serviceType || 'Service Request'}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; font-size: 28px;">Lead Confirmed!</h1>
                        </div>
                        <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                Hi ${providerName},
                            </p>
                            <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                Your payment has been processed successfully and the lead has been confirmed. You can now contact the customer.
                            </p>
                            
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin-top: 0; color: #333;">Lead Details</h3>
                                <p style="margin: 5px 0;"><strong>Service:</strong> ${serviceRequest?.projectTitle || lead.serviceType || 'Service Request'}</p>
                                ${serviceRequest?.category ? `<p style="margin: 5px 0;"><strong>Category:</strong> ${serviceRequest.category.name}</p>` : ''}
                                ${lead.locationCity ? `<p style="margin: 5px 0;"><strong>Location:</strong> ${lead.locationCity}, ${lead.locationState || ''}</p>` : ''}
                            </div>

                            ${proposal ? `
                            <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
                                <h3 style="margin-top: 0; color: #004085;">Your Proposal</h3>
                                <p style="margin: 5px 0; color: #333; white-space: pre-wrap;">${proposal.details}</p>
                                <p style="margin: 15px 0 5px 0;"><strong>Price:</strong> $${proposal.price.toFixed(2)}</p>
                            </div>
                            ` : ''}

                            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                                <h3 style="margin-top: 0; color: #856404;">Next Steps</h3>
                                <ul style="color: #333; line-height: 1.8;">
                                    <li>Contact the customer using the information provided in your dashboard</li>
                                    <li>Schedule a consultation or site visit</li>
                                    <li>Submit your work order when the project begins</li>
                                </ul>
                            </div>

                            <div style="text-align: center; margin-top: 30px; padding-top: 25px; border-top: 2px solid #e5e7eb;">
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-dashboard/leads" 
                                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                          padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                          font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                                    View My Leads
                                </a>
                            </div>
                        </div>
                    </div>
                `
            }).catch(err => {
                console.error('Failed to send provider confirmation email:', err);
            });
        }

        // Email to customer
        if (serviceRequest && serviceRequest.customer && serviceRequest.customer.email) {
            const customer = serviceRequest.customer;
            const customerName = customer.firstName && customer.lastName
                ? `${customer.firstName} ${customer.lastName}`
                : customer.name || 'Customer';

            await sendEmail({
                to: customer.email,
                subject: `A provider will contact you soon — ${serviceRequest.projectTitle}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; font-size: 28px;">Provider Assigned!</h1>
                        </div>
                        <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                Hi ${customerName},
                            </p>
                            <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                Great news! A service provider has accepted your request and will contact you soon.
                            </p>
                            
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin-top: 0; color: #333;">Service Request</h3>
                                <p style="margin: 5px 0;"><strong>Project:</strong> ${serviceRequest.projectTitle}</p>
                                ${serviceRequest.category ? `<p style="margin: 5px 0;"><strong>Category:</strong> ${serviceRequest.category.name}</p>` : ''}
                            </div>

                            ${proposal ? `
                            <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
                                <h3 style="margin-top: 0; color: #004085;">Proposal Details</h3>
                                <p style="margin: 5px 0; color: #333; white-space: pre-wrap;">${proposal.details}</p>
                                <p style="margin: 15px 0 5px 0;"><strong>Price:</strong> $${proposal.price.toFixed(2)}</p>
                            </div>
                            ` : ''}

                            <div style="background-color: #d1ecf1; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0c5460;">
                                <h3 style="margin-top: 0; color: #0c5460;">What's Next?</h3>
                                <p style="color: #333; line-height: 1.6;">
                                    The provider (${providerName}) will contact you within 24-48 hours to discuss your project and schedule a consultation.
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
                console.error('Failed to send customer notification email:', err);
            });
        }
    } catch (error) {
        console.error('Error sending lead accepted emails:', error);
    }
}

// Handle failed payment
async function handlePaymentIntentFailed(paymentIntent) {
    try {
        const { metadata } = paymentIntent;

        // Check if this is a lead payment or proposal payment
        if (metadata.type === 'lead_acceptance') {
            await handleLeadPaymentFailed(paymentIntent);
        } else if (metadata.proposalId) {
            await handleProposalPaymentFailed(paymentIntent);
        } else {
            console.error('Unknown payment type in metadata:', metadata);
        }
    } catch (error) {
        console.error('Error handling payment_intent.payment_failed:', error);
        throw error; // Re-throw to trigger webhook retry
    }
}

// Handle lead payment failure
async function handleLeadPaymentFailed(paymentIntent) {
    const { metadata } = paymentIntent;
    const leadId = parseInt(metadata.leadId);
    const serviceRequestId = metadata.serviceRequestId ? parseInt(metadata.serviceRequestId) : null;
    const providerId = parseInt(metadata.providerId);

    if (!leadId) {
        console.error('No leadId in payment intent metadata');
        return;
    }

    // Find lead
    const lead = await Lead.findByPk(leadId);
    if (!lead) {
        console.error(`Lead ${leadId} not found`);
        return;
    }

    // Update lead status to indicate payment failed
    // Note: We don't change status to 'cancelled' yet, allow retry
    // The status will remain 'submitted' or 'routed' so provider can retry

    // Get provider info
    const provider = await User.findByPk(providerId, {
        attributes: ['id', 'name', 'email', 'firstName', 'lastName']
    });

    // Send email to provider
    if (provider && provider.email) {
        const providerName = provider.firstName && provider.lastName
            ? `${provider.firstName} ${provider.lastName}`
            : provider.name || 'Provider';

        await sendEmail({
            to: provider.email,
            subject: 'Payment Failed - Lead Acceptance',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                    <div style="background: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                        <h1 style="margin: 0; font-size: 28px;">Payment Failed</h1>
                    </div>
                    <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <p style="color: #333; font-size: 16px; line-height: 1.6;">
                            Hi ${providerName},
                        </p>
                        <p style="color: #333; font-size: 16px; line-height: 1.6;">
                            Unfortunately, your payment for accepting the lead could not be processed.
                        </p>
                        <p style="color: #333; font-size: 16px; line-height: 1.6;">
                            Please check your payment method and try again. The lead is still available for you to accept.
                        </p>
                        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                            <h3 style="margin-top: 0; color: #856404;">What to do:</h3>
                            <ul style="color: #333; line-height: 1.8;">
                                <li>Verify your payment method is valid and has sufficient funds</li>
                                <li>Try accepting the lead again from your dashboard</li>
                                <li>Contact support if the issue persists</li>
                            </ul>
                        </div>
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-dashboard/leads" 
                               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                      padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                      font-weight: 600; font-size: 16px;">
                                View My Leads
                            </a>
                        </div>
                    </div>
                </div>
            `
        }).catch(err => console.error('Failed to send email:', err));
    }

    // Try to assign to next alternative provider if available
    if (serviceRequestId) {
        try {
            await assignLeadToNextAlternative(serviceRequestId, leadId);
        } catch (assignError) {
            console.error('Error assigning to next alternative:', assignError);
            // Don't fail the webhook if assignment fails
        }
    }

    // Log activity
    await logActivity({
        type: 'lead_payment_failed',
        description: `Lead payment failed for lead "${lead.serviceType || lead.description?.substring(0, 50)}"`,
        userId: providerId,
        metadata: {
            leadId: lead.id,
            paymentIntentId: paymentIntent.id,
            serviceRequestId: serviceRequestId
        }
    });

    console.log(`❌ Lead payment failed for lead ${leadId}`);
}

// Handle proposal payment failure (existing functionality)
async function handleProposalPaymentFailed(paymentIntent) {
    const { metadata } = paymentIntent;
    const proposalId = parseInt(metadata.proposalId);

    if (!proposalId) {
        console.error('No proposalId in payment intent metadata');
        return;
    }

    // Find proposal
    const proposal = await Proposal.findByPk(proposalId);

    if (!proposal) {
        console.error(`Proposal ${proposalId} not found`);
        return;
    }

    // Update proposal payment status
    proposal.paymentStatus = 'failed';
    await proposal.save();

    // Get customer info
    const customerId = parseInt(metadata.customerId);
    if (customerId) {
        const customer = await User.findByPk(customerId);
        if (customer) {
            // Send email notification
            sendEmail({
                to: customer.email,
                subject: 'Payment Failed - Proposal',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                        <div style="background: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; font-size: 28px;">Payment Failed</h1>
                        </div>
                        <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                Hi ${customer.name || 'there'},
                            </p>
                            <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                Unfortunately, your payment for the proposal could not be processed.
                            </p>
                            <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                Please check your payment method and try again, or contact support if the issue persists.
                            </p>
                            <div style="text-align: center; margin-top: 30px;">
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-dashboard/requests" 
                                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                          padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                          font-weight: 600; font-size: 16px;">
                                    View Requests
                                </a>
                            </div>
                        </div>
                    </div>
                `
            }).catch(err => console.error('Failed to send email:', err));
        }
    }

    console.log(`❌ Payment failed for proposal ${proposalId}`);
}

// Assign lead to next alternative provider
async function assignLeadToNextAlternative(serviceRequestId, failedLeadId) {
    try {
        const AlternativeProviderSelection = require('../models/AlternativeProviderSelection');

        // Find alternative provider selections for this service request
        const alternatives = await AlternativeProviderSelection.findAll({
            where: { serviceRequestId: serviceRequestId },
            order: [['position', 'ASC']]
        });

        if (alternatives.length === 0) {
            console.log(`No alternative providers found for service request ${serviceRequestId}`);
            return;
        }

        // Find the first alternative that doesn't have an accepted lead
        for (const alt of alternatives) {
            // Get provider profile to find userId
            const providerProfile = await ProviderProfile.findByPk(alt.providerId, {
                attributes: ['id', 'userId'],
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email']
                }]
            });

            if (!providerProfile || !providerProfile.user) {
                console.log(`Provider profile not found for alternative ${alt.id}`);
                continue;
            }

            const providerUserId = providerProfile.userId;

            // Check if this provider already has an accepted lead for this request
            // Note: We need to check metadata since serviceRequestId is stored there
            const existingLeads = await Lead.findAll({
                where: {
                    providerId: providerUserId,
                    status: 'accepted'
                }
            });

            let hasAcceptedLead = false;
            for (const existingLead of existingLeads) {
                try {
                    const metadata = typeof existingLead.metadata === 'string'
                        ? JSON.parse(existingLead.metadata)
                        : existingLead.metadata;
                    if (metadata && metadata.serviceRequestId === serviceRequestId) {
                        hasAcceptedLead = true;
                        break;
                    }
                } catch (e) {
                    // Skip if metadata parsing fails
                }
            }

            if (!hasAcceptedLead) {
                // Create a new lead for this alternative provider
                const serviceRequest = await ServiceRequest.findByPk(serviceRequestId, {
                    include: [
                        { model: User, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] },
                        { model: Category, as: 'category', attributes: ['id', 'name'] }
                    ]
                });

                if (!serviceRequest) {
                    console.error(`Service request ${serviceRequestId} not found`);
                    continue;
                }

                // Get business for this provider
                const business = await Business.findOne({
                    where: { ownerId: providerUserId },
                    attributes: ['id', 'name']
                });

                // Create lead
                const newLead = await Lead.create({
                    customerId: serviceRequest.customerId,
                    businessId: business?.id || null,
                    providerId: providerUserId,
                    serviceType: serviceRequest.category?.name || 'Service Request',
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
                        assignedFrom: failedLeadId,
                        position: alt.position
                    }),
                    routedAt: new Date()
                });

                // Send email to alternative provider
                if (providerProfile.user && providerProfile.user.email) {
                    await sendEmail({
                        to: providerProfile.user.email,
                        subject: `New lead: ${serviceRequest.projectTitle}`,
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
                                        <p style="margin: 5px 0;"><strong>Project:</strong> ${serviceRequest.projectTitle}</p>
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

                console.log(`✅ Assigned lead to alternative provider ${providerUserId} for service request ${serviceRequestId}`);
                return; // Only assign to first available alternative
            }
        }

        console.log(`No available alternative providers for service request ${serviceRequestId}`);
    } catch (error) {
        console.error('Error in assignLeadToNextAlternative:', error);
        throw error;
    }
}

// Handle canceled payment
async function handlePaymentIntentCanceled(paymentIntent) {
    try {
        const { metadata } = paymentIntent;
        const proposalId = parseInt(metadata.proposalId);

        if (!proposalId) {
            console.error('No proposalId in payment intent metadata');
            return;
        }

        // Find proposal
        const proposal = await Proposal.findByPk(proposalId);

        if (!proposal) {
            console.error(`Proposal ${proposalId} not found`);
            return;
        }

        // Update proposal payment status
        proposal.paymentStatus = 'failed';
        await proposal.save();

        console.log(`⚠️  Payment canceled for proposal ${proposalId}`);
    } catch (error) {
        console.error('Error handling payment_intent.canceled:', error);
    }
}

module.exports = router;


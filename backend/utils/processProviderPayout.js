/**
 * Process provider payout after work approval
 * Provider receives 90% of proposal price, platform keeps 10%
 */

const { calculatePayouts } = require('../config/platformFee');
const { Proposal, ProviderProfile, User, ServiceRequest } = require('../models');
const sendEmail = require('./sendEmail');
const logActivity = require('./logActivity');

/**
 * Process provider payout after work approval
 * @param {Object} proposal - Proposal instance
 * @param {Object} serviceRequest - ServiceRequest instance
 */
async function processProviderPayout(proposal, serviceRequest) {
    let freshProposal = null;

    try {
        // Reload proposal to ensure we have the latest data including payout fields
        // Use explicit attributes to handle cases where payout columns might not exist
        try {
            freshProposal = await Proposal.findByPk(proposal.id);
        } catch (queryError) {
            // If query fails due to missing columns, try with minimal attributes
            if (queryError.message && (
                queryError.message.includes('Unknown column') ||
                queryError.message.includes('column') ||
                queryError.message.includes('does not exist')
            )) {
                console.error(`[Process Payout] ⚠️ Database schema error - payout columns may not exist for proposal ${proposal.id}`);
                console.error(`[Process Payout] ⚠️ This usually means the migration hasn't been run. Skipping payout processing.`);
                return; // Exit early - can't process without schema
            }
            throw queryError; // Re-throw if it's a different error
        }

        if (!freshProposal) {
            throw new Error(`Proposal ${proposal.id} not found`);
        }

        // Verify payout is pending or null/undefined (null/undefined means not processed yet)
        // Handle case where payoutStatus might be undefined if column doesn't exist
        const payoutStatus = freshProposal.payoutStatus;
        if (payoutStatus && payoutStatus !== 'pending') {
            console.log(`[Process Payout] Proposal ${freshProposal.id} payout already processed or not ready. Status: ${payoutStatus}`);
            return;
        }

        // Verify payment was successful
        if (freshProposal.paymentStatus !== 'succeeded') {
            console.log(`[Process Payout] Proposal ${freshProposal.id} payment not succeeded yet. Status: ${freshProposal.paymentStatus}`);
            return;
        }

        // Get provider profile (explicitly specify attributes to avoid selecting non-existent columns)
        // Only select columns that actually exist in the database
        const providerProfile = await ProviderProfile.findByPk(freshProposal.providerId, {
            attributes: ['id', 'userId', 'status', 'ratingAverage', 'ratingCount'],
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'name', 'email', 'firstName', 'lastName'],
                required: false
            }]
        });

        if (!providerProfile) {
            throw new Error(`Provider profile ${freshProposal.providerId} not found`);
        }

        // Calculate payout amounts (if not already calculated)
        let providerAmount = freshProposal.providerPayoutAmount ? parseFloat(freshProposal.providerPayoutAmount) : null;
        let platformFee = freshProposal.platformFeeAmount ? parseFloat(freshProposal.platformFeeAmount) : null;

        if (!providerAmount || !platformFee) {
            const proposalPrice = parseFloat(freshProposal.price);
            const calculated = calculatePayouts(proposalPrice);
            providerAmount = calculated.providerAmount;
            platformFee = calculated.platformFee;
        }

        console.log(`[Process Payout] Processing payout for proposal ${freshProposal.id}: Provider $${providerAmount.toFixed(2)}, Platform fee $${platformFee.toFixed(2)}`);

        // Update proposal status to processing first (optional - helps prevent race conditions)
        // If this fails, we'll still try to complete the payout below
        try {
            // Build update object with payout amounts
            const processingUpdate = {
                payoutStatus: 'processing',
                providerPayoutAmount: providerAmount,
                platformFeeAmount: platformFee
            };

            await freshProposal.update(processingUpdate);
            console.log(`[Process Payout] Updated proposal ${freshProposal.id} to 'processing' status`);
        } catch (updateError) {
            // If update fails, check if it's a column error
            if (updateError.message && (
                updateError.message.includes('Unknown column') ||
                updateError.message.includes('column') ||
                updateError.message.includes('does not exist')
            )) {
                console.error(`[Process Payout] ⚠️ Database column error - payout columns may not exist in database`);
                console.error(`[Process Payout] This usually means the migration hasn't been run. Skipping payout processing.`);
                return;
            }

            // For other errors, log but continue - we'll still try to complete the payout
            console.warn(`[Process Payout] Update to 'processing' failed for proposal ${freshProposal.id}, but continuing...`);
            console.warn(`[Process Payout] Update error:`, updateError.message);

            // Check if already completed by another process
            const recheckProposal = await Proposal.findByPk(freshProposal.id);
            if (recheckProposal && recheckProposal.payoutStatus === 'completed') {
                console.log(`[Process Payout] Proposal ${freshProposal.id} already completed by another process, exiting`);
                return; // Already completed, exit gracefully
            }

            // Continue to completion update - don't throw, just log the warning
        }

        // Note: In production, you would use Stripe Connect or Transfers API here
        // For now, we'll mark it as completed and record the payout
        // TODO: Implement actual Stripe transfer when provider accounts are set up

        // CRITICAL: Update proposal with payout completion
        // This ensures the payout is marked as completed even if email/logging fails later
        // Reload proposal to get latest state before final update
        const latestProposal = await Proposal.findByPk(freshProposal.id);
        if (!latestProposal) {
            throw new Error(`Proposal ${freshProposal.id} not found during completion update`);
        }

        // Check if already completed (race condition check)
        if (latestProposal.payoutStatus === 'completed') {
            console.log(`[Process Payout] ✅ Proposal ${freshProposal.id} already completed by another process`);
            return;
        }

        // ALWAYS set completion status and amounts - ensure payout is marked as completed
        // Build completion update with all necessary fields
        const completionUpdate = {
            payoutStatus: 'completed',
            payoutProcessedAt: new Date(),
            providerPayoutAmount: providerAmount,
            platformFeeAmount: platformFee
        };

        console.log(`[Process Payout] Updating proposal ${latestProposal.id} to completed status...`);
        console.log(`[Process Payout] Update data:`, {
            payoutStatus: 'completed',
            providerPayoutAmount: providerAmount,
            platformFeeAmount: platformFee
        });

        // Perform the update - this is the critical operation
        try {
            await latestProposal.update(completionUpdate);

            // Verify the update succeeded by reloading
            await latestProposal.reload();
            const verifiedStatus = latestProposal.payoutStatus;

            if (verifiedStatus === 'completed') {
                console.log(`[Process Payout] ✅ SUCCESS: Proposal ${latestProposal.id} payout marked as completed`);
            } else {
                console.error(`[Process Payout] ❌ WARNING: Update appeared to succeed but status is still '${verifiedStatus}' for proposal ${latestProposal.id}`);
                // Try one more time with explicit save
                latestProposal.payoutStatus = 'completed';
                latestProposal.payoutProcessedAt = new Date();
                latestProposal.providerPayoutAmount = providerAmount;
                latestProposal.platformFeeAmount = platformFee;
                await latestProposal.save();
                console.log(`[Process Payout] Retried update for proposal ${latestProposal.id}`);
            }
        } catch (updateError) {
            console.error(`[Process Payout] ❌ CRITICAL: Failed to update proposal ${latestProposal.id} to completed status`);
            console.error(`[Process Payout] Update error:`, updateError.message);
            console.error(`[Process Payout] Error stack:`, updateError.stack);

            // If completion update fails, check if it's a column error
            if (updateError.message && (
                updateError.message.includes('Unknown column') ||
                updateError.message.includes('column') ||
                updateError.message.includes('does not exist')
            )) {
                console.error(`[Process Payout] ⚠️ Database column error during completion - payout columns may not exist`);
                console.error(`[Process Payout] This usually means the migration hasn't been run.`);
                console.warn(`[Process Payout] ⚠️ Cannot complete payout - database schema issue. Please run migrations.`);
                return;
            }

            // Last resort: Try direct Sequelize update query as fallback
            console.log(`[Process Payout] Attempting fallback update using direct Sequelize query...`);
            try {
                const { sequelize } = require('../config/database');
                await sequelize.query(
                    `UPDATE proposals SET payoutStatus = 'completed', payoutProcessedAt = :processedAt, providerPayoutAmount = :providerAmount, platformFeeAmount = :platformFee WHERE id = :proposalId`,
                    {
                        replacements: {
                            processedAt: new Date(),
                            providerAmount: providerAmount,
                            platformFee: platformFee,
                            proposalId: latestProposal.id
                        },
                        type: sequelize.QueryTypes.UPDATE
                    }
                );
                console.log(`[Process Payout] ✅ Fallback update succeeded for proposal ${latestProposal.id}`);
            } catch (fallbackError) {
                console.error(`[Process Payout] ❌ Fallback update also failed:`, fallbackError.message);
                // Re-throw original error so it's caught by outer catch block
                throw updateError;
            }
        }

        // Get provider name
        const provider = providerProfile.user;
        const providerName = provider.firstName && provider.lastName
            ? `${provider.firstName} ${provider.lastName}`
            : provider.name || 'Provider';

        // Send email to provider (non-critical - don't fail if email fails)
        if (provider && provider.email) {
            const proposalPrice = parseFloat(freshProposal.price);

            sendEmail({
                to: provider.email,
                subject: `💰 Payout Processed: $${providerAmount.toFixed(2)}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; font-size: 28px;">💰 Payout Processed!</h1>
                        </div>
                        <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                Hi ${providerName},
                            </p>
                            <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                Great news! Your payout for the completed project has been processed.
                            </p>
                            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                                <h3 style="color: #1e40af; margin-top: 0;">Payout Details:</h3>
                                <div style="margin: 15px 0;">
                                    <p style="color: #333; margin: 8px 0;">
                                        <strong>Project:</strong> ${serviceRequest.projectTitle || 'Service Request'}
                                    </p>
                                    <p style="color: #333; margin: 8px 0;">
                                        <strong>Total Amount:</strong> $${proposalPrice.toFixed(2)}
                                    </p>
                                    <p style="color: #333; margin: 8px 0;">
                                        <strong>Platform Fee (10%):</strong> $${platformFee.toFixed(2)}
                                    </p>
                                    <div style="background: #ecfdf5; padding: 15px; border-radius: 6px; margin-top: 15px; border: 2px solid #10b981;">
                                        <p style="color: #065f46; margin: 0; font-size: 18px; font-weight: 700;">
                                            <strong>Your Payout:</strong> $${providerAmount.toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                The payout has been processed and will be transferred to your account according to your payout schedule.
                            </p>
                            <div style="text-align: center; margin-top: 30px;">
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-dashboard/payouts" 
                                   style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; 
                                          padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                          font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">
                                    <i style="margin-right: 8px;">💰</i>
                                    View My Payouts
                                </a>
                            </div>
                            <p style="color: #718096; font-size: 14px; text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                                Thank you for your excellent work!
                            </p>
                        </div>
                    </div>
                `
            }).then(() => {
                console.log(`[Process Payout] ✅ Payout email sent to provider for proposal ${freshProposal.id}`);
            }).catch(err => {
                // Email failure is non-critical - payout is already marked as completed
                console.error(`[Process Payout] ⚠️ Failed to send payout email to provider (non-critical):`, err.message);
            });
        }

        // Log activity (non-critical - don't fail if logging fails)
        logActivity({
            type: 'provider_payout_processed',
            description: `Provider payout processed: $${providerAmount.toFixed(2)} for proposal ${freshProposal.id}`,
            userId: providerProfile.userId,
            metadata: {
                proposalId: freshProposal.id,
                serviceRequestId: serviceRequest.id,
                providerAmount,
                platformFee,
                totalAmount: parseFloat(freshProposal.price)
            }
        }).then(() => {
            console.log(`[Process Payout] ✅ Activity logged for proposal ${freshProposal.id}`);
        }).catch(err => {
            // Logging failure is non-critical - payout is already marked as completed
            console.error(`[Process Payout] ⚠️ Failed to log payout activity (non-critical):`, err.message);
        });

        console.log(`✅ Provider payout processed successfully: $${providerAmount.toFixed(2)} for proposal ${freshProposal.id}`);
    } catch (error) {
        // Get proposal ID safely (freshProposal might not exist if error occurred early)
        const proposalId = freshProposal ? freshProposal.id : (proposal ? proposal.id : null);
        const proposalIdForLog = proposalId || 'unknown';

        console.error(`[Process Payout] ❌ ERROR processing provider payout for proposal ${proposalIdForLog}:`, error);
        console.error('[Process Payout] Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });

        // IMPORTANT: Only set status to 'failed' if payout was NOT already completed
        // Also, be very careful - only set to failed for critical errors, not for non-critical issues or schema problems
        if (!proposalId) {
            console.error(`[Process Payout] ❌ Cannot determine proposal ID - cannot update status`);
            return;
        }

        try {
            const failedProposal = await Proposal.findByPk(proposalId);
            if (failedProposal) {
                const currentStatus = failedProposal.payoutStatus;

                // NEVER overwrite a completed payout
                if (currentStatus === 'completed') {
                    console.warn(`[Process Payout] ⚠️ Proposal ${proposalId} payout is already 'completed' - error occurred but payout status preserved`);
                    return; // Exit early - payout is already completed
                }

                // Check if this is a database schema/column error - don't mark as failed for these
                const isSchemaError = error.message && (
                    error.message.includes('Unknown column') ||
                    error.message.includes('column') ||
                    error.message.includes('does not exist') ||
                    error.message.includes('SQL syntax')
                );

                // Check if this is a non-critical error (email, logging, etc.)
                const isNonCriticalError = error.message && (
                    error.message.includes('email') ||
                    error.message.includes('log') ||
                    error.message.includes('activity') ||
                    error.message.includes('notification')
                );

                // Only set to 'failed' if it's a critical error (NOT schema error, NOT non-critical) AND status is still pending/processing
                const isCriticalError = !isSchemaError && !isNonCriticalError;

                if (isSchemaError) {
                    // Schema errors mean migrations haven't been run - don't mark as failed
                    console.warn(`[Process Payout] ⚠️ Database schema error for proposal ${proposalId} - payout columns may not exist. Please run migrations.`);
                    console.warn(`[Process Payout] ⚠️ Payout status unchanged (${currentStatus || 'pending'}) - will need manual review after migrations are run.`);
                    return; // Exit without marking as failed
                } else if (!isCriticalError) {
                    // Non-critical error (email/logging) - don't mark as failed, keep as processing or pending
                    console.warn(`[Process Payout] ⚠️ Non-critical error for proposal ${proposalId}, payout status unchanged (${currentStatus || 'pending'})`);
                    // If status is 'processing', we might want to leave it as is to allow retry
                    // Don't mark as failed for non-critical issues
                } else if (isCriticalError && (!currentStatus || currentStatus === 'pending' || currentStatus === 'processing')) {
                    // Only set to failed for truly critical errors (database connection, business logic errors, etc.)
                    // AND only if status is still pending/processing (not already completed)
                    try {
                        await failedProposal.update({
                            payoutStatus: 'failed'
                        });
                        console.error(`[Process Payout] ❌ Set proposal ${proposalId} payout status to 'failed' due to critical error: ${error.message}`);
                    } catch (updateError) {
                        console.error(`[Process Payout] ❌ Failed to update payout status to 'failed' for proposal ${proposalId}:`, updateError.message);
                        // If we can't even update to failed, there's a serious problem (maybe columns don't exist)
                    }
                } else {
                    console.warn(`[Process Payout] ⚠️ Proposal ${proposalId} payout status is '${currentStatus}', not changing to 'failed'`);
                }
            }
        } catch (updateError) {
            console.error('[Process Payout] Failed to check/update proposal payout status:', updateError);
        }

        // Don't throw error - log it but allow the system to continue
        // The payout can be retried later or manually fixed
        console.error(`[Process Payout] ⚠️ Payout processing encountered an error for proposal ${proposalId}. Check logs above for details.`);
    }
}

module.exports = processProviderPayout;


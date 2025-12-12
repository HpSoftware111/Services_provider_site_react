/**
 * Enhanced Email Notification System
 * 
 * Features:
 * - Template-based emails
 * - Retry logic (3 retries)
 * - Audit logging
 * - Notification preferences
 * - Unsubscribe support
 */

const sendEmail = require('./sendEmail');
const { renderTemplate } = require('./emailTemplates');
const NotificationAudit = require('../models/NotificationAudit');
const NotificationPreference = require('../models/NotificationPreference');
const crypto = require('crypto');

/**
 * Get or create notification preferences for a user
 */
async function getNotificationPreferences(userId) {
    let preferences = await NotificationPreference.findOne({
        where: { userId }
    });

    if (!preferences) {
        // Generate unsubscribe token
        const unsubscribeToken = crypto.randomBytes(32).toString('hex');

        preferences = await NotificationPreference.create({
            userId,
            unsubscribeToken
        });
    } else if (!preferences.unsubscribeToken) {
        // Generate token if missing
        preferences.unsubscribeToken = crypto.randomBytes(32).toString('hex');
        await preferences.save();
    }

    return preferences;
}

/**
 * Check if notification should be sent based on user preferences
 */
async function shouldSendNotification(userId, notificationType) {
    const preferences = await getNotificationPreferences(userId);

    // Check if email is enabled
    if (!preferences.emailEnabled) {
        return false;
    }

    // Check type-specific preference
    const typeMap = {
        'request_created': 'requestCreated',
        'new_lead': 'newLead',
        'lead_accepted_customer': 'leadAccepted',
        'lead_accepted_provider': 'leadAccepted',
        'lead_payment_failed': 'leadPaymentFailed',
        'lead_moved_to_alternative': 'leadMovedToAlternative',
        'no_provider_available': 'noProviderAvailable',
        'new_proposal': 'newProposal',
        'proposal_accepted_customer': 'proposalAccepted',
        'proposal_accepted_provider': 'proposalAccepted',
        'work_completed': 'workCompleted',
        'review_request': 'reviewRequest',
        'review_posted': 'reviewPosted'
    };

    const preferenceKey = typeMap[notificationType];
    if (preferenceKey && preferences[preferenceKey] === false) {
        return false;
    }

    return true;
}

/**
 * Create audit record for notification
 */
async function createAuditRecord(userId, type, recipientEmail, subject, metadata, status = 'pending') {
    return await NotificationAudit.create({
        userId,
        type,
        recipientEmail,
        subject,
        metadata: JSON.stringify(metadata),
        status,
        retryCount: 0,
        maxRetries: 3,
        provider: 'nodemailer' // Can be extended to support other providers
    });
}

/**
 * Update audit record
 */
async function updateAuditRecord(auditId, updates) {
    return await NotificationAudit.update(updates, {
        where: { id: auditId }
    });
}

/**
 * Retry sending email with exponential backoff
 */
async function retrySendEmail(auditRecord, emailOptions, retryDelay = 1000) {
    const maxRetries = auditRecord.maxRetries || 3;
    const retryCount = auditRecord.retryCount || 0;

    if (retryCount >= maxRetries) {
        await updateAuditRecord(auditRecord.id, {
            status: 'failed',
            errorMessage: 'Max retries exceeded'
        });
        return { success: false, error: 'Max retries exceeded' };
    }

    // Exponential backoff: 1s, 2s, 4s
    const delay = retryDelay * Math.pow(2, retryCount);

    // Update status to retrying
    await updateAuditRecord(auditRecord.id, {
        status: 'retrying',
        retryCount: retryCount + 1
    });

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
        const result = await sendEmail(emailOptions);

        if (result && result.messageId) {
            // Success
            await updateAuditRecord(auditRecord.id, {
                status: 'sent',
                sentAt: new Date(),
                errorMessage: null
            });
            return { success: true, messageId: result.messageId };
        } else {
            // Failed, try again if retries remaining
            if (retryCount + 1 < maxRetries) {
                return await retrySendEmail(auditRecord, emailOptions, retryDelay);
            } else {
                await updateAuditRecord(auditRecord.id, {
                    status: 'failed',
                    errorMessage: result?.error || 'Email send failed'
                });
                return { success: false, error: result?.error || 'Email send failed' };
            }
        }
    } catch (error) {
        // Error occurred, try again if retries remaining
        if (retryCount + 1 < maxRetries) {
            return await retrySendEmail(auditRecord, emailOptions, retryDelay);
        } else {
            await updateAuditRecord(auditRecord.id, {
                status: 'failed',
                errorMessage: error.message
            });
            return { success: false, error: error.message };
        }
    }
}

/**
 * Send notification email with template, retry, and audit logging
 * 
 * @param {object} options - Notification options
 * @param {number} options.userId - User ID (optional)
 * @param {string} options.to - Recipient email
 * @param {string} options.type - Notification type (template key)
 * @param {object} options.data - Template data (ProjectTitle, ProviderName, etc.)
 * @param {boolean} options.skipPreferences - Skip preference check (default: false)
 * @returns {Promise<object>} Result object
 */
async function sendNotification(options) {
    const { userId, to, type, data, skipPreferences = false } = options;

    try {
        // Check preferences if userId provided and not skipping
        if (userId && !skipPreferences) {
            const shouldSend = await shouldSendNotification(userId, type);
            if (!shouldSend) {
                console.log(`Notification skipped for user ${userId}, type ${type} (preferences disabled)`);
                return { success: true, skipped: true, reason: 'preferences_disabled' };
            }
        }

        // Get unsubscribe link if userId provided
        let unsubscribeLink = null;
        if (userId) {
            const preferences = await getNotificationPreferences(userId);
            if (preferences && preferences.unsubscribeToken) {
                const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
                unsubscribeLink = `${baseUrl}/unsubscribe?token=${preferences.unsubscribeToken}`;
            }
        }

        // Add unsubscribe link to data
        const templateData = {
            ...data,
            UnsubscribeLink: unsubscribeLink
        };

        // Render template
        const rendered = renderTemplate(type, templateData);

        // Create audit record
        const auditRecord = await createAuditRecord(
            userId || null,
            type,
            to,
            rendered.subject,
            templateData
        );

        // Prepare email options
        const emailOptions = {
            to,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text
        };

        // Try sending email
        try {
            const result = await sendEmail(emailOptions);

            if (result && result.messageId) {
                // Success
                await updateAuditRecord(auditRecord.id, {
                    status: 'sent',
                    sentAt: new Date()
                });
                return { success: true, messageId: result.messageId, auditId: auditRecord.id };
            } else {
                // Failed, start retry process
                console.log(`Email send failed, starting retry process for audit ${auditRecord.id}`);
                const retryResult = await retrySendEmail(auditRecord, emailOptions);
                return { ...retryResult, auditId: auditRecord.id };
            }
        } catch (error) {
            // Error occurred, start retry process
            console.error(`Email send error: ${error.message}, starting retry process for audit ${auditRecord.id}`);
            const retryResult = await retrySendEmail(auditRecord, emailOptions);
            return { ...retryResult, auditId: auditRecord.id };
        }
    } catch (error) {
        console.error('Send notification error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Process failed notifications (for admin dashboard or cron job)
 */
async function getFailedNotifications(limit = 100) {
    return await NotificationAudit.findAll({
        where: {
            status: 'failed'
        },
        order: [['createdAt', 'DESC']],
        limit
    });
}

/**
 * Retry failed notifications manually
 */
async function retryFailedNotification(auditId) {
    const auditRecord = await NotificationAudit.findByPk(auditId);
    if (!auditRecord) {
        throw new Error('Audit record not found');
    }

    if (auditRecord.status === 'sent') {
        return { success: true, message: 'Already sent' };
    }

    const metadata = JSON.parse(auditRecord.metadata || '{}');
    const rendered = renderTemplate(auditRecord.type, metadata);

    const emailOptions = {
        to: auditRecord.recipientEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text
    };

    // Reset retry count and try again
    auditRecord.retryCount = 0;
    await auditRecord.save();

    return await retrySendEmail(auditRecord, emailOptions);
}

module.exports = {
    sendNotification,
    getNotificationPreferences,
    shouldSendNotification,
    getFailedNotifications,
    retryFailedNotification,
    createAuditRecord,
    updateAuditRecord
};


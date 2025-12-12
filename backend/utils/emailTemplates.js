/**
 * Email Templates System
 * 
 * Provides HTML and plain-text templates for all notification types.
 * Templates use placeholders that are replaced with actual values.
 */

const templates = {
    // Request created (customer)
    request_created: {
        subject: 'We received your request — [ProjectTitle]',
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">Request Received!</h1>
                </div>
                <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Hi ${data.CustomerName || 'there'},
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        We received your request for <strong>${data.ProjectTitle || 'your project'}</strong>. We will match providers and update you shortly.
                    </p>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #333;">Request Details</h3>
                        <p style="margin: 5px 0;"><strong>Project:</strong> ${data.ProjectTitle || 'N/A'}</p>
                        ${data.CategoryName ? `<p style="margin: 5px 0;"><strong>Category:</strong> ${data.CategoryName}</p>` : ''}
                        ${data.ZipCode ? `<p style="margin: 5px 0;"><strong>Location:</strong> ${data.ZipCode}</p>` : ''}
                    </div>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${data.RequestLink || '#'}" 
                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                  padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                  font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                            View Details
                        </a>
                    </div>
                    ${data.UnsubscribeLink ? `
                    <p style="color: #718096; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <a href="${data.UnsubscribeLink}" style="color: #718096;">Unsubscribe from these emails</a>
                    </p>
                    ` : ''}
                </div>
            </div>
        `,
        text: (data) => `
Hi ${data.CustomerName || 'there'},

We received your request for ${data.ProjectTitle || 'your project'}. We will match providers and update you shortly.

Request Details:
- Project: ${data.ProjectTitle || 'N/A'}
${data.CategoryName ? `- Category: ${data.CategoryName}\n` : ''}
${data.ZipCode ? `- Location: ${data.ZipCode}\n` : ''}

View details: ${data.RequestLink || '#'}

${data.UnsubscribeLink ? `\nUnsubscribe: ${data.UnsubscribeLink}` : ''}
        `.trim()
    },

    // New lead (provider)
    new_lead: {
        subject: 'New lead — [ProjectTitle]',
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">New Lead Available!</h1>
                </div>
                <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Hi ${data.ProviderName || 'Provider'},
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        A new lead matches your services: <strong>${data.ProjectTitle || 'Service Request'}</strong>
                    </p>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #333;">Lead Details</h3>
                        <p style="margin: 5px 0;"><strong>Project:</strong> ${data.ProjectTitle || 'N/A'}</p>
                        ${data.CategoryName ? `<p style="margin: 5px 0;"><strong>Category:</strong> ${data.CategoryName}</p>` : ''}
                        ${data.ZipCode ? `<p style="margin: 5px 0;"><strong>Location:</strong> ${data.ZipCode}</p>` : ''}
                        ${data.ShortDetails ? `<p style="margin: 5px 0; color: #666; font-size: 14px;">${data.ShortDetails}</p>` : ''}
                    </div>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${data.RequestLink || '#'}" 
                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                  padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                  font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                            Accept or Reject Lead
                        </a>
                    </div>
                    ${data.UnsubscribeLink ? `
                    <p style="color: #718096; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <a href="${data.UnsubscribeLink}" style="color: #718096;">Unsubscribe from these emails</a>
                    </p>
                    ` : ''}
                </div>
            </div>
        `,
        text: (data) => `
Hi ${data.ProviderName || 'Provider'},

A new lead matches your services: ${data.ProjectTitle || 'Service Request'}

Lead Details:
- Project: ${data.ProjectTitle || 'N/A'}
${data.CategoryName ? `- Category: ${data.CategoryName}\n` : ''}
${data.ZipCode ? `- Location: ${data.ZipCode}\n` : ''}
${data.ShortDetails ? `- Details: ${data.ShortDetails}\n` : ''}

Accept or reject from your dashboard: ${data.RequestLink || '#'}

${data.UnsubscribeLink ? `\nUnsubscribe: ${data.UnsubscribeLink}` : ''}
        `.trim()
    },

    // Lead accepted (customer)
    lead_accepted_customer: {
        subject: 'Provider assigned for [ProjectTitle]',
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">Provider Assigned!</h1>
                </div>
                <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Hi ${data.CustomerName || 'there'},
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        <strong>${data.ProviderName || 'A provider'}</strong> accepted the lead and will contact you soon.
                    </p>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #333;">Provider Contact</h3>
                        ${data.ProviderContact ? `<p style="margin: 5px 0;">${data.ProviderContact}</p>` : ''}
                        ${data.ProviderEmail ? `<p style="margin: 5px 0;"><strong>Email:</strong> ${data.ProviderEmail}</p>` : ''}
                        ${data.ProviderPhone ? `<p style="margin: 5px 0;"><strong>Phone:</strong> ${data.ProviderPhone}</p>` : ''}
                    </div>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${data.RequestLink || '#'}" 
                           style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; 
                                  padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                  font-weight: 600; font-size: 16px;">
                            View Request
                        </a>
                    </div>
                    ${data.UnsubscribeLink ? `
                    <p style="color: #718096; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <a href="${data.UnsubscribeLink}" style="color: #718096;">Unsubscribe from these emails</a>
                    </p>
                    ` : ''}
                </div>
            </div>
        `,
        text: (data) => `
Hi ${data.CustomerName || 'there'},

${data.ProviderName || 'A provider'} accepted the lead and will contact you soon.

Provider Contact:
${data.ProviderContact || ''}
${data.ProviderEmail ? `Email: ${data.ProviderEmail}\n` : ''}
${data.ProviderPhone ? `Phone: ${data.ProviderPhone}\n` : ''}

View request: ${data.RequestLink || '#'}

${data.UnsubscribeLink ? `\nUnsubscribe: ${data.UnsubscribeLink}` : ''}
        `.trim()
    },

    // Lead accepted (provider)
    lead_accepted_provider: {
        subject: 'Lead confirmed — [ProjectTitle]',
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">Lead Confirmed!</h1>
                </div>
                <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Hi ${data.ProviderName || 'Provider'},
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Your payment has been processed successfully and the lead has been confirmed. You can now contact the customer.
                    </p>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #333;">Lead Details</h3>
                        <p style="margin: 5px 0;"><strong>Project:</strong> ${data.ProjectTitle || 'N/A'}</p>
                        ${data.CustomerName ? `<p style="margin: 5px 0;"><strong>Customer:</strong> ${data.CustomerName}</p>` : ''}
                        ${data.CustomerContact ? `<p style="margin: 5px 0;">${data.CustomerContact}</p>` : ''}
                    </div>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${data.RequestLink || '#'}" 
                           style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; 
                                  padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                  font-weight: 600; font-size: 16px;">
                            View Lead
                        </a>
                    </div>
                    ${data.UnsubscribeLink ? `
                    <p style="color: #718096; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <a href="${data.UnsubscribeLink}" style="color: #718096;">Unsubscribe from these emails</a>
                    </p>
                    ` : ''}
                </div>
            </div>
        `,
        text: (data) => `
Hi ${data.ProviderName || 'Provider'},

Your payment has been processed successfully and the lead has been confirmed. You can now contact the customer.

Lead Details:
- Project: ${data.ProjectTitle || 'N/A'}
${data.CustomerName ? `- Customer: ${data.CustomerName}\n` : ''}
${data.CustomerContact ? `- Contact: ${data.CustomerContact}\n` : ''}

View lead: ${data.RequestLink || '#'}

${data.UnsubscribeLink ? `\nUnsubscribe: ${data.UnsubscribeLink}` : ''}
        `.trim()
    },

    // Lead payment failed (provider)
    lead_payment_failed: {
        subject: 'Payment Failed - Lead Acceptance',
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">Payment Failed</h1>
                </div>
                <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Hi ${data.ProviderName || 'Provider'},
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
                        <a href="${data.RequestLink || '#'}" 
                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                  padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                  font-weight: 600; font-size: 16px;">
                            View My Leads
                        </a>
                    </div>
                    ${data.UnsubscribeLink ? `
                    <p style="color: #718096; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <a href="${data.UnsubscribeLink}" style="color: #718096;">Unsubscribe from these emails</a>
                    </p>
                    ` : ''}
                </div>
            </div>
        `,
        text: (data) => `
Hi ${data.ProviderName || 'Provider'},

Unfortunately, your payment for accepting the lead could not be processed.

Please check your payment method and try again. The lead is still available for you to accept.

What to do:
- Verify your payment method is valid and has sufficient funds
- Try accepting the lead again from your dashboard
- Contact support if the issue persists

View my leads: ${data.RequestLink || '#'}

${data.UnsubscribeLink ? `\nUnsubscribe: ${data.UnsubscribeLink}` : ''}
        `.trim()
    },

    // Lead moved to alternative (provider)
    lead_moved_to_alternative: {
        subject: 'New lead: [ProjectTitle]',
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">New Lead Available</h1>
                </div>
                <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Hi ${data.ProviderName || 'Provider'},
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        A new lead has been assigned to you as an alternative provider.
                    </p>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #333;">Lead Details</h3>
                        <p style="margin: 5px 0;"><strong>Project:</strong> ${data.ProjectTitle || 'N/A'}</p>
                        ${data.CategoryName ? `<p style="margin: 5px 0;"><strong>Category:</strong> ${data.CategoryName}</p>` : ''}
                        ${data.ZipCode ? `<p style="margin: 5px 0;"><strong>Location:</strong> ${data.ZipCode}</p>` : ''}
                    </div>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${data.RequestLink || '#'}" 
                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                  padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                  font-weight: 600; font-size: 16px;">
                            View Lead
                        </a>
                    </div>
                    ${data.UnsubscribeLink ? `
                    <p style="color: #718096; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <a href="${data.UnsubscribeLink}" style="color: #718096;">Unsubscribe from these emails</a>
                    </p>
                    ` : ''}
                </div>
            </div>
        `,
        text: (data) => `
Hi ${data.ProviderName || 'Provider'},

A new lead has been assigned to you as an alternative provider.

Lead Details:
- Project: ${data.ProjectTitle || 'N/A'}
${data.CategoryName ? `- Category: ${data.CategoryName}\n` : ''}
${data.ZipCode ? `- Location: ${data.ZipCode}\n` : ''}

View lead: ${data.RequestLink || '#'}

${data.UnsubscribeLink ? `\nUnsubscribe: ${data.UnsubscribeLink}` : ''}
        `.trim()
    },

    // No provider available (customer)
    no_provider_available: {
        subject: 'Update on your request — [ProjectTitle]',
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">Update on Your Request</h1>
                </div>
                <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Hi ${data.CustomerName || 'there'},
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        We're currently working on matching providers for your request: <strong>${data.ProjectTitle || 'your project'}</strong>.
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        We haven't found a suitable provider yet, but we're actively searching and will notify you as soon as we find a match.
                    </p>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${data.RequestLink || '#'}" 
                           style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; 
                                  padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                  font-weight: 600; font-size: 16px;">
                            View Request
                        </a>
                    </div>
                    ${data.UnsubscribeLink ? `
                    <p style="color: #718096; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <a href="${data.UnsubscribeLink}" style="color: #718096;">Unsubscribe from these emails</a>
                    </p>
                    ` : ''}
                </div>
            </div>
        `,
        text: (data) => `
Hi ${data.CustomerName || 'there'},

We're currently working on matching providers for your request: ${data.ProjectTitle || 'your project'}.

We haven't found a suitable provider yet, but we're actively searching and will notify you as soon as we find a match.

View request: ${data.RequestLink || '#'}

${data.UnsubscribeLink ? `\nUnsubscribe: ${data.UnsubscribeLink}` : ''}
        `.trim()
    },

    // New proposal (customer)
    new_proposal: {
        subject: 'New proposal from [ProviderName] for [ProjectTitle]',
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">New Proposal Received!</h1>
                </div>
                <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Hi ${data.CustomerName || 'there'},
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Great news! <strong>${data.ProviderName || 'A provider'}</strong> has sent you a proposal for your service request: <strong>${data.ProjectTitle || 'Service Request'}</strong>.
                    </p>
                    <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
                        <h3 style="margin-top: 0; color: #004085;">Proposal Details</h3>
                        ${data.ProposalDetails ? `<p style="margin: 5px 0; color: #333; white-space: pre-wrap;">${data.ProposalDetails}</p>` : ''}
                        ${data.ProposalPrice ? `<p style="margin: 15px 0 5px 0;"><strong>Price:</strong> $${parseFloat(data.ProposalPrice).toFixed(2)}</p>` : ''}
                    </div>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${data.RequestLink || '#'}" 
                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                  padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                  font-weight: 600; font-size: 16px;">
                            View Proposal
                        </a>
                    </div>
                    ${data.UnsubscribeLink ? `
                    <p style="color: #718096; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <a href="${data.UnsubscribeLink}" style="color: #718096;">Unsubscribe from these emails</a>
                    </p>
                    ` : ''}
                </div>
            </div>
        `,
        text: (data) => `
Hi ${data.CustomerName || 'there'},

Great news! ${data.ProviderName || 'A provider'} has sent you a proposal for your service request: ${data.ProjectTitle || 'Service Request'}.

Proposal Details:
${data.ProposalDetails ? `${data.ProposalDetails}\n` : ''}
${data.ProposalPrice ? `Price: $${parseFloat(data.ProposalPrice).toFixed(2)}\n` : ''}

View proposal: ${data.RequestLink || '#'}

${data.UnsubscribeLink ? `\nUnsubscribe: ${data.UnsubscribeLink}` : ''}
        `.trim()
    },

    // Proposal accepted (both)
    proposal_accepted_customer: {
        subject: 'Proposal Accepted - Work Started: [ProjectTitle]',
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">🎉 Proposal Accepted!</h1>
                </div>
                <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Hi ${data.CustomerName || 'there'},
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Great news! Your payment has been processed and the proposal for <strong>${data.ProjectTitle || 'your project'}</strong> has been accepted.
                    </p>
                    <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #1e40af; margin-top: 0;">Service Details:</h3>
                        ${data.CategoryName ? `<p style="color: #333; margin: 5px 0;"><strong>Category:</strong> ${data.CategoryName}</p>` : ''}
                        <p style="color: #333; margin: 5px 0;"><strong>Provider:</strong> ${data.ProviderName || 'N/A'}</p>
                        ${data.ProposalPrice ? `<p style="color: #333; margin: 5px 0;"><strong>Amount Paid:</strong> $${parseFloat(data.ProposalPrice).toFixed(2)}</p>` : ''}
                        <p style="color: #333; margin: 5px 0;"><strong>Status:</strong> <span style="color: #059669; font-weight: 600;">IN PROGRESS</span></p>
                    </div>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${data.RequestLink || '#'}" 
                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                  padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                  font-weight: 600; font-size: 16px;">
                            View Request
                        </a>
                    </div>
                    ${data.UnsubscribeLink ? `
                    <p style="color: #718096; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <a href="${data.UnsubscribeLink}" style="color: #718096;">Unsubscribe from these emails</a>
                    </p>
                    ` : ''}
                </div>
            </div>
        `,
        text: (data) => `
Hi ${data.CustomerName || 'there'},

Great news! Your payment has been processed and the proposal for ${data.ProjectTitle || 'your project'} has been accepted.

Service Details:
${data.CategoryName ? `Category: ${data.CategoryName}\n` : ''}
Provider: ${data.ProviderName || 'N/A'}
${data.ProposalPrice ? `Amount Paid: $${parseFloat(data.ProposalPrice).toFixed(2)}\n` : ''}
Status: IN PROGRESS

Your service provider will now begin working on your project. You can track the progress in your dashboard.

View request: ${data.RequestLink || '#'}

${data.UnsubscribeLink ? `\nUnsubscribe: ${data.UnsubscribeLink}` : ''}
        `.trim()
    },

    proposal_accepted_provider: {
        subject: '🎉 Proposal Accepted - New Work Order: [ProjectTitle]',
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">✅ Proposal Accepted!</h1>
                </div>
                <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Hi ${data.ProviderName || 'Provider'},
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        <strong>Great news!</strong> Your proposal for <strong>${data.ProjectTitle || 'the project'}</strong> has been accepted by the customer and payment has been successfully processed.
                    </p>
                    <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                        <h3 style="color: #1e40af; margin-top: 0;">📋 Project Details:</h3>
                        <p style="color: #333; margin: 8px 0;"><strong>Customer:</strong> ${data.CustomerName || 'N/A'}</p>
                        ${data.CategoryName ? `<p style="color: #333; margin: 8px 0;"><strong>Service Category:</strong> ${data.CategoryName}</p>` : ''}
                        <p style="color: #333; margin: 8px 0;"><strong>Project Title:</strong> ${data.ProjectTitle || 'N/A'}</p>
                        ${data.ProposalPrice ? `<p style="color: #333; margin: 8px 0;"><strong>Proposal Amount:</strong> <span style="color: #10b981; font-weight: 700; font-size: 1.1em;">$${parseFloat(data.ProposalPrice).toFixed(2)}</span></p>` : ''}
                        <p style="color: #333; margin: 8px 0;"><strong>Status:</strong> <span style="color: #059669; font-weight: 600; background: #d1fae5; padding: 4px 12px; border-radius: 12px; display: inline-block;">IN PROGRESS</span></p>
                    </div>
                    <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                        <p style="color: #065f46; margin: 0; font-weight: 600;">
                            <i style="margin-right: 8px;">💼</i>
                            A new work order has been created for you. Please begin working on this project.
                        </p>
                    </div>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${data.RequestLink || '#'}" 
                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                  padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                  font-weight: 600; font-size: 16px;">
                            View Work Orders
                        </a>
                    </div>
                    ${data.UnsubscribeLink ? `
                    <p style="color: #718096; font-size: 12px; text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <a href="${data.UnsubscribeLink}" style="color: #718096;">Unsubscribe from these emails</a>
                    </p>
                    ` : ''}
                </div>
            </div>
        `,
        text: (data) => `
Hi ${data.ProviderName || 'Provider'},

Great news! Your proposal for ${data.ProjectTitle || 'the project'} has been accepted by the customer and payment has been successfully processed.

Project Details:
- Customer: ${data.CustomerName || 'N/A'}
${data.CategoryName ? `- Service Category: ${data.CategoryName}\n` : ''}
- Project Title: ${data.ProjectTitle || 'N/A'}
${data.ProposalPrice ? `- Proposal Amount: $${parseFloat(data.ProposalPrice).toFixed(2)}\n` : ''}
- Status: IN PROGRESS

A new work order has been created for you. Please begin working on this project.

View work orders: ${data.RequestLink || '#'}

${data.UnsubscribeLink ? `\nUnsubscribe: ${data.UnsubscribeLink}` : ''}
        `.trim()
    },

    // Work completed (customer)
    work_completed: {
        subject: 'Work Completed: [ProjectTitle]',
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">✅ Work Completed!</h1>
                </div>
                <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Hi ${data.CustomerName || 'there'},
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Great news! The work for <strong>${data.ProjectTitle || 'your project'}</strong> has been completed by your service provider.
                    </p>
                    <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #1e40af; margin-top: 0;">Project Details:</h3>
                        ${data.CategoryName ? `<p style="color: #333; margin: 5px 0;"><strong>Service:</strong> ${data.CategoryName}</p>` : ''}
                        <p style="color: #333; margin: 5px 0;"><strong>Status:</strong> <span style="color: #059669; font-weight: 600;">COMPLETED</span></p>
                    </div>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Please review the completed work and approve it if you're satisfied. You can also leave a review to help other customers.
                    </p>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${data.RequestLink || '#'}" 
                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; 
                                  padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                  font-weight: 600; font-size: 16px;">
                            Review & Approve
                        </a>
                    </div>
                    ${data.UnsubscribeLink ? `
                    <p style="color: #718096; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <a href="${data.UnsubscribeLink}" style="color: #718096;">Unsubscribe from these emails</a>
                    </p>
                    ` : ''}
                </div>
            </div>
        `,
        text: (data) => `
Hi ${data.CustomerName || 'there'},

Great news! The work for ${data.ProjectTitle || 'your project'} has been completed by your service provider.

Project Details:
${data.CategoryName ? `Service: ${data.CategoryName}\n` : ''}
Status: COMPLETED

Please review the completed work and approve it if you're satisfied. You can also leave a review to help other customers.

Review & approve: ${data.RequestLink || '#'}

${data.UnsubscribeLink ? `\nUnsubscribe: ${data.UnsubscribeLink}` : ''}
        `.trim()
    },

    // Review request (customer)
    review_request: {
        subject: 'Please review your completed service — [ProjectTitle]',
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">⭐ Review Request</h1>
                </div>
                <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Hi ${data.CustomerName || 'there'},
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Your service for <strong>${data.ProjectTitle || 'your project'}</strong> has been completed and approved. We'd love to hear about your experience!
                    </p>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${data.RequestLink || '#'}" 
                           style="display: inline-block; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: white; 
                                  padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                  font-weight: 600; font-size: 16px;">
                            Leave a Review
                        </a>
                    </div>
                    ${data.UnsubscribeLink ? `
                    <p style="color: #718096; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <a href="${data.UnsubscribeLink}" style="color: #718096;">Unsubscribe from these emails</a>
                    </p>
                    ` : ''}
                </div>
            </div>
        `,
        text: (data) => `
Hi ${data.CustomerName || 'there'},

Your service for ${data.ProjectTitle || 'your project'} has been completed and approved. We'd love to hear about your experience!

Leave a review: ${data.RequestLink || '#'}

${data.UnsubscribeLink ? `\nUnsubscribe: ${data.UnsubscribeLink}` : ''}
        `.trim()
    },

    // Review posted (provider)
    review_posted: {
        subject: '⭐ New Review Received: [Title]',
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">⭐ New Review Received!</h1>
                </div>
                <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Hi ${data.ProviderName || 'Provider'},
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                        Great news! You've received a new review from <strong>${data.CustomerName || 'a customer'}</strong> for your work on <strong>${data.ProjectTitle || 'a project'}</strong>.
                    </p>
                    <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                        <h3 style="color: #92400e; margin-top: 0;">Review Details:</h3>
                        <div style="margin: 10px 0;">
                            <strong style="color: #78350f;">Rating:</strong>
                            <div style="font-size: 1.5rem; color: #f59e0b; margin: 5px 0;">
                                ${'⭐'.repeat(parseInt(data.Rating) || 0)} (${data.Rating || 'N/A'}/5)
                            </div>
                        </div>
                        ${data.ReviewTitle ? `
                        <div style="margin: 10px 0;">
                            <strong style="color: #78350f;">Title:</strong>
                            <p style="color: #92400e; margin: 5px 0;">${data.ReviewTitle}</p>
                        </div>
                        ` : ''}
                        ${data.ReviewComment ? `
                        <div style="margin: 10px 0;">
                            <strong style="color: #78350f;">Comment:</strong>
                            <p style="color: #92400e; margin: 5px 0; line-height: 1.6;">${data.ReviewComment}</p>
                        </div>
                        ` : ''}
                    </div>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${data.RequestLink || '#'}" 
                           style="display: inline-block; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: white; 
                                  padding: 14px 32px; text-decoration: none; border-radius: 8px; 
                                  font-weight: 600; font-size: 16px;">
                            View Work Orders
                        </a>
                    </div>
                    ${data.UnsubscribeLink ? `
                    <p style="color: #718096; font-size: 12px; text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <a href="${data.UnsubscribeLink}" style="color: #718096;">Unsubscribe from these emails</a>
                    </p>
                    ` : ''}
                </div>
            </div>
        `,
        text: (data) => `
Hi ${data.ProviderName || 'Provider'},

Great news! You've received a new review from ${data.CustomerName || 'a customer'} for your work on ${data.ProjectTitle || 'a project'}.

Review Details:
- Rating: ${'⭐'.repeat(parseInt(data.Rating) || 0)} (${data.Rating || 'N/A'}/5)
${data.ReviewTitle ? `- Title: ${data.ReviewTitle}\n` : ''}
${data.ReviewComment ? `- Comment: ${data.ReviewComment}\n` : ''}

Thank you for your excellent service! Keep up the great work.

View work orders: ${data.RequestLink || '#'}

${data.UnsubscribeLink ? `\nUnsubscribe: ${data.UnsubscribeLink}` : ''}
        `.trim()
    }
};

/**
 * Get template by type
 * @param {string} type - Template type
 * @returns {object|null} Template object with subject, html, and text functions
 */
function getTemplate(type) {
    return templates[type] || null;
}

/**
 * Replace placeholders in a string
 * @param {string} str - String with placeholders
 * @param {object} data - Data object with replacement values
 * @returns {string} String with placeholders replaced
 */
function replacePlaceholders(str, data) {
    if (!str || typeof str !== 'string') return str;
    
    let result = str;
    Object.keys(data).forEach(key => {
        const value = data[key] || '';
        const placeholder = `[${key}]`;
        result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });
    
    return result;
}

/**
 * Render template with data
 * @param {string} type - Template type
 * @param {object} data - Data object
 * @returns {object} Object with subject, html, and text
 */
function renderTemplate(type, data) {
    const template = getTemplate(type);
    if (!template) {
        throw new Error(`Template not found: ${type}`);
    }

    return {
        subject: replacePlaceholders(template.subject, data),
        html: typeof template.html === 'function' ? template.html(data) : replacePlaceholders(template.html, data),
        text: typeof template.text === 'function' ? template.text(data) : replacePlaceholders(template.text, data)
    };
}

module.exports = {
    templates,
    getTemplate,
    replacePlaceholders,
    renderTemplate
};


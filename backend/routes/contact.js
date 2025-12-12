const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { Contact } = require('../models');
const { protect } = require('../middleware/auth');
const sendEmail = require('../utils/sendEmail');
const logActivity = require('../utils/logActivity');

// @route   POST /api/contact
// @desc    Submit contact/support form
// @access  Public
router.post('/', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('message').trim().notEmpty().withMessage('Message is required')
], async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Save to database
    const contact = await Contact.create({
      name,
      email,
      subject,
      message,
      status: 'new'
    });

    // Log activity
    await logActivity({
      type: 'contact_submitted',
      description: `New support request from "${name}" - ${subject}`,
      metadata: { contactName: name, contactEmail: email, subject }
    });

    // Send email to admin (non-blocking)
    sendEmail({
      to: process.env.ADMIN_EMAIL || 'admin@citylocal101.com',
      subject: `Support Request: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: #4A90E2; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 24px;">New Support Request</h2>
            <p style="margin: 10px 0 0 0; font-size: 14px;">CityLocal 101</p>
          </div>
          <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="margin-bottom: 20px;">
              <strong style="color: #333; display: block; margin-bottom: 5px;">Name:</strong>
              <span style="color: #666;">${name}</span>
            </div>
            <div style="margin-bottom: 20px;">
              <strong style="color: #333; display: block; margin-bottom: 5px;">Email:</strong>
              <span style="color: #666;">${email}</span>
            </div>
            <div style="margin-bottom: 20px;">
              <strong style="color: #333; display: block; margin-bottom: 5px;">Subject:</strong>
              <span style="color: #666;">${subject}</span>
            </div>
            <div style="margin-bottom: 20px;">
              <strong style="color: #333; display: block; margin-bottom: 5px;">Message:</strong>
              <div style="color: #666; background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin-top: 10px; line-height: 1.6;">
                ${message.replace(/\n/g, '<br>')}
              </div>
            </div>
          </div>
        </div>
      `,
      message: `
New support request from CityLocal 101:

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}

---
Sent from CityLocal 101 Support System
      `
    }).catch(() => {});

    res.json({
      success: true,
      message: 'Your message has been sent successfully. We will respond within 24 hours.',
      contact
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to send message. Please try again or call us directly.' 
    });
  }
});

// @route   GET /api/contact/my-tickets
// @desc    Get current user's support tickets
// @access  Private
router.get('/my-tickets', protect, async (req, res) => {
  try {
    const contacts = await Contact.findAll({
      where: { email: req.user.email },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      contacts
    });
  } catch (error) {
    console.log('Get tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

module.exports = router;


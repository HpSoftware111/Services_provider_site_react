const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const PhoneVerification = require('../models/PhoneVerification');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// Generate a 6-digit verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// @route   POST /api/phone-verification/send-code
// @desc    Send verification code to phone number
// @access  Private
router.post('/send-code', protect, async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format'
      });
    }

    // Get user
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Invalidate any existing unverified codes for this user and phone
    await PhoneVerification.update(
      { verified: true }, // Mark as verified to invalidate
      {
        where: {
          userId: user.id,
          phone: phone,
          verified: false
        }
      }
    );

    // Create new verification record
    await PhoneVerification.create({
      userId: user.id,
      phone: phone,
      code: code,
      verified: false,
      expiresAt: expiresAt
    });

    // Send verification code via email (since SMS requires Twilio setup)
    // In production, you can integrate Twilio here for SMS
    try {
      await sendEmail({
        to: user.email,
        subject: 'Phone Verification Code - Home Services',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 28px;">Phone Verification</h1>
            </div>
            <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <p style="color: #333; font-size: 16px; line-height: 1.6;">
                Hi ${user.name || 'User'},
              </p>
              <p style="color: #333; font-size: 16px; line-height: 1.6;">
                Your phone verification code is:
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <div style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                            color: white; padding: 20px 40px; border-radius: 8px; 
                            font-weight: 600; font-size: 32px; letter-spacing: 8px;">
                  ${code}
                </div>
              </div>
              <p style="color: #333; font-size: 16px; line-height: 1.6;">
                This code will expire in 10 minutes.
              </p>
              <p style="color: #7f8c8d; font-size: 14px; margin-top: 30px; text-align: center;">
                If you didn't request this code, please ignore this email.
              </p>
            </div>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail the request if email fails - code is still generated
    }

    res.json({
      success: true,
      message: 'Verification code sent successfully',
      // In development, return code for testing (remove in production)
      ...(process.env.NODE_ENV === 'development' && { code: code })
    });
  } catch (error) {
    console.error('Send verification code error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send verification code'
    });
  }
});

// @route   POST /api/phone-verification/verify-code
// @desc    Verify phone number with code
// @access  Private
router.post('/verify-code', protect, async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and verification code are required'
      });
    }

    // Find verification record
    const verification = await PhoneVerification.findOne({
      where: {
        userId: req.user.id,
        phone: phone,
        code: code,
        verified: false
      },
      order: [['createdAt', 'DESC']]
    });

    if (!verification) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code'
      });
    }

    // Check if code has expired
    if (new Date() > verification.expiresAt) {
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please request a new code.'
      });
    }

    // Mark as verified
    await verification.update({ verified: true });

    // Update user's phone number if it's different
    const user = await User.findByPk(req.user.id);
    if (user && user.phone !== phone) {
      await user.update({ phone: phone });
    }

    res.json({
      success: true,
      message: 'Phone number verified successfully',
      verified: true
    });
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify code'
    });
  }
});

// @route   GET /api/phone-verification/check-verification
// @desc    Check if phone is verified for current user
// @access  Private
router.get('/check-verification', protect, async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // Check if there's a verified record for this phone
    const verification = await PhoneVerification.findOne({
      where: {
        userId: req.user.id,
        phone: phone,
        verified: true
      },
      order: [['updatedAt', 'DESC']]
    });

    // Check if verification is still valid (within last 30 days)
    const isValid = verification && verification.updatedAt &&
      (new Date() - new Date(verification.updatedAt)) < (30 * 24 * 60 * 60 * 1000);

    res.json({
      success: true,
      verified: !!isValid,
      verifiedAt: verification?.updatedAt || null
    });
  } catch (error) {
    console.error('Check verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check verification status'
    });
  }
});

module.exports = router;

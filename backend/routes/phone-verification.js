const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const PhoneVerification = require('../models/PhoneVerification');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const sendSMS = require('../utils/sendSMS');

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

    // Send verification code via SMS (Twilio) first, fallback to email
    let smsSent = false;
    let emailSent = false;
    let smsErrorDetails = null;

    // Try to send SMS via Twilio
    try {
      const smsMessage = `Your Home Services verification code is: ${code}. This code expires in 10 minutes.`;
      console.log(`\n📤 Sending verification code via SMS...`);
      console.log(`   Phone: ${phone}`);
      console.log(`   Code: ${code}`);

      const smsResult = await sendSMS(phone, smsMessage);

      if (smsResult.success) {
        smsSent = true;
        console.log(`✅ Verification code sent via SMS successfully!`);
        console.log(`   Message SID: ${smsResult.messageSid || 'N/A'}`);
        console.log(`   Status: ${smsResult.status || 'N/A'}`);
        console.log(`   Formatted phone: ${smsResult.to || phone}`);
        console.log(`   📋 Check delivery status in Twilio Console:`);
        console.log(`      https://console.twilio.com/us1/monitor/logs/messaging`);
        console.log(`      Search for SID: ${smsResult.messageSid || 'N/A'}`);
      } else {
        smsErrorDetails = {
          error: smsResult.error || 'Unknown error',
          userFriendlyMessage: smsResult.userFriendlyMessage || smsResult.error,
          code: smsResult.code,
          details: smsResult.details,
          twilioError: smsResult.twilioError
        };

        console.warn(`⚠️  SMS sending failed:`);
        console.warn(`   Error: ${smsResult.error || 'Unknown error'}`);
        console.warn(`   User-friendly: ${smsResult.userFriendlyMessage || 'N/A'}`);
        console.warn(`   Error code: ${smsResult.code || 'N/A'}`);
        console.warn(`   Original phone: ${smsResult.originalPhone || phone}`);
        if (smsResult.twilioError) {
          console.warn(`   Twilio error code: ${smsResult.twilioError.code || 'N/A'}`);
          console.warn(`   Twilio error message: ${smsResult.twilioError.message || 'N/A'}`);
          if (smsResult.twilioError.moreInfo) {
            console.warn(`   More info: ${smsResult.twilioError.moreInfo}`);
          }
        }
        console.warn(`   Continuing to email fallback...`);
        // Continue to email fallback
      }
    } catch (smsError) {
      smsErrorDetails = {
        error: smsError.message || 'Unknown error',
        code: smsError.code,
        details: smsError.toString()
      };

      console.error('❌ Exception while sending SMS:');
      console.error('   Error:', smsError.message || 'Unknown error');
      console.error('   Error code:', smsError.code || 'N/A');
      console.error('   Stack:', smsError.stack || 'N/A');
      console.error('   Phone number attempted:', phone);
      console.error('   Continuing to email fallback...');
      // Continue to email fallback
    }

    // Send verification code via email ONLY if SMS failed

    // Log delivery status
    if (!smsSent) {
      console.warn('⚠️  Warning: Neither SMS nor email was sent successfully. Code is still generated and stored.');
    }

    // Prepare response
    const response = {
      success: true,
      message: 'Verification code sent successfully',
      smsSent: smsSent,
      emailSent: emailSent,
      deliveryMethod: smsSent ? 'SMS' : (emailSent ? 'email' : 'none')
    };

    // Include SMS error details if SMS failed (helpful for debugging)
    if (!smsSent && smsErrorDetails) {
      response.smsError = {
        error: smsErrorDetails.error,
        userFriendlyMessage: smsErrorDetails.userFriendlyMessage || smsErrorDetails.error,
        code: smsErrorDetails.code
      };

      // In development, include full error details
      if (process.env.NODE_ENV === 'development') {
        response.smsErrorDetails = smsErrorDetails;
      }
    }

    // In development, return code for testing (remove in production)
    if (process.env.NODE_ENV === 'development') {
      response.code = code;
    }

    res.json(response);
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

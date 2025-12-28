const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const PhoneVerification = require('../models/PhoneVerification');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const sendSMS = require('../utils/sendSMS');
const { formatPhoneNumber, isValidPhoneNumber } = require('../utils/sendSMS');
const twilio = require('twilio');
require('dotenv').config();

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

// @route   POST /api/phone-verification/verify-number
// @desc    Request verification of a phone number in Twilio (for trial accounts)
// @access  Private
router.post('/verify-number', protect, async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // Check if Twilio credentials are configured
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return res.status(500).json({
        success: false,
        error: 'Twilio credentials not configured',
        message: 'Twilio credentials are required for phone number verification'
      });
    }

    // Format phone number to E.164 format
    const formattedPhone = formatPhoneNumber(phone);

    if (!formattedPhone) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format',
        details: `Could not format phone number: ${phone}`,
        originalPhone: phone
      });
    }

    if (!isValidPhoneNumber(formattedPhone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format',
        details: `Phone number "${formattedPhone}" does not match E.164 format`,
        originalPhone: phone,
        formattedPhone: formattedPhone
      });
    }

    console.log(`\n📞 Requesting phone number verification...`);
    console.log(`   User ID: ${req.user.id}`);
    console.log(`   Original phone: ${phone}`);
    console.log(`   Formatted phone: ${formattedPhone}`);

    // Initialize Twilio client
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Check account status
    let accountType = 'Unknown';
    let isTrialAccount = false;
    try {
      const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      accountType = account.type || 'Unknown';
      isTrialAccount = account.type === 'Trial';
      
      console.log(`   Account type: ${accountType}`);
      
      if (isTrialAccount) {
        console.log(`   ⚠️  Trial account detected - verification required for SMS`);
      }
    } catch (accountError) {
      console.warn('⚠️  Could not fetch Twilio account info:', accountError.message);
    }

    // Try to use Twilio Verify Service API (if available)
    // First, check if a Verify Service is configured
    let verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    
    if (verifyServiceSid) {
      // Use Twilio Verify Service API
      try {
        console.log(`   Using Twilio Verify Service: ${verifyServiceSid}`);
        
        const verification = await client.verify.v2
          .services(verifyServiceSid)
          .verifications
          .create({
            to: formattedPhone,
            channel: 'sms'
          });

        console.log(`✅ Verification request sent successfully!`);
        console.log(`   Verification SID: ${verification.sid}`);
        console.log(`   Status: ${verification.status}`);
        console.log(`   Channel: ${verification.channel}`);

        return res.json({
          success: true,
          message: 'Verification code sent to phone number',
          verificationSid: verification.sid,
          status: verification.status,
          phone: formattedPhone,
          originalPhone: phone,
          channel: verification.channel,
          accountType: accountType,
          isTrialAccount: isTrialAccount,
          instructions: isTrialAccount 
            ? 'Check your phone for the verification code. Enter it to complete verification.'
            : 'Check your phone for the verification code.'
        });
      } catch (verifyError) {
        console.error('❌ Error using Twilio Verify Service:', verifyError.message);
        console.error('   Error code:', verifyError.code || 'N/A');
        
        // If Verify Service fails, fall through to manual verification instructions
        console.log('   Falling back to manual verification instructions...');
      }
    }

    // Fallback: Use Outgoing Caller ID validation (for trial accounts)
    // This sends a verification code via SMS or call
    try {
      console.log(`   Using Outgoing Caller ID validation...`);
      
      const validation = await client.validationRequests.create({
        friendlyName: `User ${req.user.id} - ${req.user.name || req.user.email || 'Phone'}`,
        phoneNumber: formattedPhone
      });

      console.log(`✅ Verification request sent successfully!`);
      console.log(`   Validation SID: ${validation.sid}`);
      console.log(`   Status: ${validation.status}`);
      console.log(`   Phone: ${validation.phoneNumber}`);

      return res.json({
        success: true,
        message: 'Verification code sent to phone number',
        validationSid: validation.sid,
        status: validation.status,
        phone: formattedPhone,
        originalPhone: phone,
        accountType: accountType,
        isTrialAccount: isTrialAccount,
        instructions: 'Check your phone for the verification code. Enter it in Twilio Console or use it to verify your number.',
        twilioConsoleUrl: 'https://console.twilio.com/us1/develop/phone-numbers/manage/verified'
      });
    } catch (validationError) {
      console.error('❌ Error requesting phone validation:', validationError.message);
      console.error('   Error code:', validationError.code || 'N/A');
      console.error('   Error details:', validationError);

      // Provide helpful error messages
      let errorMessage = 'Failed to request phone verification';
      let userFriendlyMessage = 'Failed to request phone verification. Please try again.';
      let instructions = null;

      switch (validationError.code) {
        case 21211:
          errorMessage = 'Invalid phone number format';
          userFriendlyMessage = 'The phone number format is invalid. Please check and try again.';
          break;
        case 21608:
          errorMessage = 'Phone number already verified or verification in progress';
          userFriendlyMessage = 'This phone number may already be verified or a verification is already in progress.';
          instructions = 'Check your phone for the verification code, or verify manually in Twilio Console.';
          break;
        case 21614:
          errorMessage = 'Invalid phone number';
          userFriendlyMessage = 'The phone number is invalid or cannot receive verification codes.';
          break;
        case 21408:
          errorMessage = 'Permission denied';
          userFriendlyMessage = 'You do not have permission to verify this phone number.';
          break;
        default:
          if (validationError.message) {
            errorMessage = validationError.message;
            userFriendlyMessage = validationError.message;
          }
      }

      // If verification API fails, provide manual instructions
      if (!instructions) {
        instructions = isTrialAccount
          ? 'For trial accounts, you can verify the number manually in Twilio Console: https://console.twilio.com/us1/develop/phone-numbers/manage/verified'
          : 'You can verify the number manually in Twilio Console: https://console.twilio.com/us1/develop/phone-numbers/manage/verified';
      }

      return res.status(400).json({
        success: false,
        error: errorMessage,
        userFriendlyMessage: userFriendlyMessage,
        code: validationError.code || null,
        phone: formattedPhone,
        originalPhone: phone,
        accountType: accountType,
        isTrialAccount: isTrialAccount,
        instructions: instructions,
        twilioConsoleUrl: 'https://console.twilio.com/us1/develop/phone-numbers/manage/verified',
        twilioError: process.env.NODE_ENV === 'development' ? {
          code: validationError.code,
          message: validationError.message,
          status: validationError.status,
          moreInfo: validationError.moreInfo
        } : undefined
      });
    }
  } catch (error) {
    console.error('❌ Error in phone verification request:', error);
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);

    res.status(500).json({
      success: false,
      error: 'Failed to request phone verification',
      message: error.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
    });
  }
});

// @route   POST /api/phone-verification/confirm-verification
// @desc    Confirm phone number verification with code (for Twilio Verify Service)
// @access  Private
router.post('/confirm-verification', protect, async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and verification code are required'
      });
    }

    // Check if Twilio credentials are configured
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return res.status(500).json({
        success: false,
        error: 'Twilio credentials not configured'
      });
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone || !isValidPhoneNumber(formattedPhone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format'
      });
    }

    // Check if Verify Service is configured
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!verifyServiceSid) {
      return res.status(400).json({
        success: false,
        error: 'Twilio Verify Service not configured',
        message: 'TWILIO_VERIFY_SERVICE_SID is required in .env file for code verification'
      });
    }

    console.log(`\n🔐 Confirming phone verification...`);
    console.log(`   User ID: ${req.user.id}`);
    console.log(`   Phone: ${formattedPhone}`);
    console.log(`   Code: ${code}`);

    // Initialize Twilio client
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Verify the code using Twilio Verify Service
    try {
      const verificationCheck = await client.verify.v2
        .services(verifyServiceSid)
        .verificationChecks
        .create({
          to: formattedPhone,
          code: code
        });

      console.log(`✅ Verification check result:`);
      console.log(`   Status: ${verificationCheck.status}`);
      console.log(`   Valid: ${verificationCheck.status === 'approved'}`);

      if (verificationCheck.status === 'approved') {
        // Update user's phone number
        const user = await User.findByPk(req.user.id);
        if (user && user.phone !== formattedPhone) {
          await user.update({ phone: formattedPhone });
        }

        // Create verification record in our database
        await PhoneVerification.create({
          userId: req.user.id,
          phone: formattedPhone,
          code: code,
          verified: true,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        });

        return res.json({
          success: true,
          message: 'Phone number verified successfully',
          verified: true,
          status: verificationCheck.status,
          phone: formattedPhone
        });
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid verification code',
          message: 'The verification code is incorrect or has expired',
          status: verificationCheck.status
        });
      }
    } catch (verifyError) {
      console.error('❌ Error verifying code:', verifyError.message);
      console.error('   Error code:', verifyError.code || 'N/A');

      let errorMessage = 'Failed to verify code';
      let userFriendlyMessage = 'Failed to verify code. Please try again.';

      switch (verifyError.code) {
        case 20429:
          errorMessage = 'Too many verification attempts';
          userFriendlyMessage = 'Too many verification attempts. Please request a new code.';
          break;
        case 20404:
          errorMessage = 'Verification not found';
          userFriendlyMessage = 'Verification code not found or expired. Please request a new code.';
          break;
        default:
          if (verifyError.message) {
            errorMessage = verifyError.message;
            userFriendlyMessage = verifyError.message;
          }
      }

      return res.status(400).json({
        success: false,
        error: errorMessage,
        userFriendlyMessage: userFriendlyMessage,
        code: verifyError.code || null
      });
    }
  } catch (error) {
    console.error('❌ Error in confirm verification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm verification',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

// @route   GET /api/phone-verification/check-twilio-status
// @desc    Check if a phone number is verified in Twilio
// @access  Private
router.get('/check-twilio-status', protect, async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // Check if Twilio credentials are configured
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return res.status(500).json({
        success: false,
        error: 'Twilio credentials not configured'
      });
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone || !isValidPhoneNumber(formattedPhone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format'
      });
    }

    // Initialize Twilio client
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Check account type
    let accountType = 'Unknown';
    let isTrialAccount = false;
    try {
      const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      accountType = account.type || 'Unknown';
      isTrialAccount = account.type === 'Trial';
    } catch (accountError) {
      console.warn('⚠️  Could not fetch Twilio account info:', accountError.message);
    }

    // Try to fetch outgoing caller IDs (verified numbers)
    try {
      const outgoingCallerIds = await client.outgoingCallerIds.list({
        phoneNumber: formattedPhone,
        limit: 1
      });

      const isVerified = outgoingCallerIds.length > 0;

      return res.json({
        success: true,
        verified: isVerified,
        phone: formattedPhone,
        originalPhone: phone,
        accountType: accountType,
        isTrialAccount: isTrialAccount,
        verifiedInTwilio: isVerified,
        message: isVerified 
          ? 'Phone number is verified in Twilio'
          : 'Phone number is not verified in Twilio. Verification may be required for trial accounts.'
      });
    } catch (error) {
      console.error('❌ Error checking Twilio verification status:', error.message);
      
      return res.json({
        success: true,
        verified: false,
        phone: formattedPhone,
        originalPhone: phone,
        accountType: accountType,
        isTrialAccount: isTrialAccount,
        verifiedInTwilio: false,
        message: 'Could not check verification status. The number may need to be verified.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  } catch (error) {
    console.error('❌ Error in check Twilio status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check Twilio verification status',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

module.exports = router;

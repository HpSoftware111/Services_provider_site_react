const twilio = require('twilio');
require('dotenv').config();

/**
 * Format phone number to E.164 format
 * @param {string} phone - Phone number to format
 * @returns {string} - Formatted phone number in E.164 format
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;

  // Remove all whitespace and special characters except +
  let cleaned = phone.trim().replace(/[\s\-\(\)\.]/g, '');

  // If already in E.164 format, return as is
  if (cleaned.startsWith('+')) {
    // Validate E.164 format (starts with +, followed by 1-15 digits)
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (e164Regex.test(cleaned)) {
      return cleaned;
    }
  }

  // Remove all non-digit characters
  let digits = cleaned.replace(/\D/g, '');

  // Handle US/Canada numbers (10 or 11 digits)
  if (digits.length === 10) {
    // 10 digits: assume US/Canada, add +1
    return '+1' + digits;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // 11 digits starting with 1: US/Canada with country code
    return '+' + digits;
  } else if (digits.length > 0) {
    // International number: add + prefix
    return '+' + digits;
  }

  return null;
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidPhoneNumber(phone) {
  if (!phone) return false;
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * Send SMS using Twilio
 * @param {string} to - Phone number to send SMS to (E.164 format)
 * @param {string} message - Message to send
 * @returns {Promise<Object>} - Twilio message object or error
 */
const sendSMS = async (to, message) => {
  const startTime = Date.now();
  const originalPhone = to;

  try {
    // Check if Twilio credentials are configured
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
      console.warn('⚠️  Twilio credentials not configured. SMS sending is disabled.');
      console.warn('   To enable SMS, set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env file');
      return {
        success: false,
        error: 'Twilio credentials not configured',
        message: 'Twilio credentials not configured'
      };
    }

    // Validate and format phone number
    const formattedPhone = formatPhoneNumber(to);

    if (!formattedPhone) {
      console.error(`❌ Invalid phone number format: "${originalPhone}"`);
      return {
        success: false,
        error: 'Invalid phone number format',
        details: `Could not format phone number: ${originalPhone}`,
        originalPhone: originalPhone
      };
    }

    if (!isValidPhoneNumber(formattedPhone)) {
      console.error(`❌ Phone number does not match E.164 format: "${formattedPhone}"`);
      return {
        success: false,
        error: 'Invalid phone number format',
        details: `Phone number "${formattedPhone}" does not match E.164 format`,
        originalPhone: originalPhone,
        formattedPhone: formattedPhone
      };
    }

    // Validate Twilio phone number format
    const twilioFromNumber = process.env.TWILIO_PHONE_NUMBER.trim();
    if (!isValidPhoneNumber(twilioFromNumber)) {
      console.error(`❌ Twilio phone number is not in E.164 format: "${twilioFromNumber}"`);
      return {
        success: false,
        error: 'Twilio configuration error',
        details: `Twilio phone number "${twilioFromNumber}" is not in E.164 format. Please update TWILIO_PHONE_NUMBER in .env file.`
      };
    }

    console.log(`📱 Attempting to send SMS:`);
    console.log(`   From: ${twilioFromNumber}`);
    console.log(`   To: ${formattedPhone} (original: ${originalPhone})`);
    console.log(`   Message length: ${message.length} characters`);

    // Initialize Twilio client
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Check account status (optional, but helpful for debugging)
    try {
      const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      const isTrialAccount = account.type === 'Trial';

      if (isTrialAccount) {
        console.warn(`⚠️  Twilio Trial Account detected. SMS can only be sent to verified numbers.`);
        console.warn(`   To verify numbers, go to: https://console.twilio.com/us1/develop/phone-numbers/manage/verified`);
      }
    } catch (accountError) {
      // Non-critical, just log for debugging
      console.warn('⚠️  Could not fetch Twilio account info:', accountError.message);
    }

    // Send SMS
    const result = await client.messages.create({
      body: message,
      from: twilioFromNumber,
      to: formattedPhone
    });

    const duration = Date.now() - startTime;

    console.log(`✅ SMS sent successfully!`);
    console.log(`   Message SID: ${result.sid}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   To: ${formattedPhone}`);
    console.log(`   From: ${result.from}`);
    console.log(`   Date Created: ${result.dateCreated}`);
    console.log(`   Duration: ${duration}ms`);

    // Log additional details if available
    if (result.errorCode) {
      console.warn(`   ⚠️  Error Code: ${result.errorCode}`);
    }
    if (result.errorMessage) {
      console.warn(`   ⚠️  Error Message: ${result.errorMessage}`);
    }

    return {
      success: true,
      messageSid: result.sid,
      status: result.status,
      to: formattedPhone,
      originalPhone: originalPhone,
      from: result.from,
      dateCreated: result.dateCreated,
      errorCode: result.errorCode || null,
      errorMessage: result.errorMessage || null
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(`❌ Error sending SMS via Twilio (${duration}ms):`);
    console.error(`   Original phone: ${originalPhone}`);
    console.error(`   Error code: ${error.code || 'N/A'}`);
    console.error(`   Error message: ${error.message || 'Unknown error'}`);
    console.error(`   Error details:`, error);

    // Handle specific Twilio error codes
    let errorMessage = 'Failed to send SMS';
    let userFriendlyMessage = 'Failed to send SMS. Please try again.';

    switch (error.code) {
      case 21211:
        errorMessage = 'Invalid phone number format';
        userFriendlyMessage = 'The phone number format is invalid. Please check and try again.';
        break;
      case 21608:
        errorMessage = 'Unverified phone number (Trial account restriction)';
        userFriendlyMessage = 'This phone number is not verified in your Twilio account. If you\'re using a Twilio trial account, you must verify recipient numbers first.';
        break;
      case 21614:
        errorMessage = 'Invalid phone number';
        userFriendlyMessage = 'The phone number is invalid or cannot receive SMS messages.';
        break;
      case 21408:
        errorMessage = 'Permission denied';
        userFriendlyMessage = 'You do not have permission to send SMS to this number.';
        break;
      case 21610:
        errorMessage = 'Unsubscribed recipient';
        userFriendlyMessage = 'This phone number has unsubscribed from receiving messages.';
        break;
      case 30003:
        errorMessage = 'Unreachable destination';
        userFriendlyMessage = 'The destination phone number is unreachable. Please verify the number is correct.';
        break;
      case 30004:
        errorMessage = 'Message blocked';
        userFriendlyMessage = 'The message was blocked. This may be due to carrier restrictions or spam filters.';
        break;
      case 30005:
        errorMessage = 'Unknown destination';
        userFriendlyMessage = 'The destination phone number is unknown or invalid.';
        break;
      case 30006:
        errorMessage = 'Landline or unreachable';
        userFriendlyMessage = 'The phone number appears to be a landline or cannot receive SMS messages.';
        break;
      default:
        if (error.message) {
          errorMessage = error.message;
          userFriendlyMessage = error.message;
        }
    }

    return {
      success: false,
      error: errorMessage,
      userFriendlyMessage: userFriendlyMessage,
      code: error.code || null,
      details: error.toString(),
      originalPhone: originalPhone,
      twilioError: {
        code: error.code,
        message: error.message,
        status: error.status,
        moreInfo: error.moreInfo
      }
    };
  }
};

/**
 * Check SMS delivery status
 * @param {string} messageSid - Twilio message SID
 * @returns {Promise<Object>} - Message status object
 */
const checkSMSStatus = async (messageSid) => {
  try {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return { error: 'Twilio credentials not configured' };
    }

    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const message = await client.messages(messageSid).fetch();

    return {
      success: true,
      sid: message.sid,
      status: message.status,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
      dateSent: message.dateSent,
      dateUpdated: message.dateUpdated,
      to: message.to,
      from: message.from
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
};

module.exports = sendSMS;
module.exports.checkSMSStatus = checkSMSStatus;


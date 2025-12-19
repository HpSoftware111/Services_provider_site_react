const plivo = require('plivo');
require('dotenv').config();

/**
 * Send SMS using Plivo
 * @param {string} to - Phone number to send SMS to (E.164 format)
 * @param {string} message - Message to send
 * @returns {Promise<Object>} - Plivo message response or error
 */
const sendSMS = async (to, message) => {
  try {
    // Check if Plivo credentials are configured
    if (!process.env.PLIVO_AUTH_ID || !process.env.PLIVO_AUTH_TOKEN || !process.env.PLIVO_PHONE_NUMBER) {
      console.warn('⚠️  Plivo credentials not configured. SMS sending is disabled.');
      console.warn('   To enable SMS, set PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, and PLIVO_PHONE_NUMBER in .env file');
      return Promise.resolve({
        success: false,
        message: 'Plivo credentials not configured'
      });
    }

    // Validate Auth ID format
    const authId = process.env.PLIVO_AUTH_ID.trim();
    if (!authId || authId.length < 10) {
      console.error('❌ Invalid PLIVO_AUTH_ID format. Auth ID must be a valid Plivo Auth ID');
      console.error(`   Current value: ${authId.substring(0, 10)}...`);
      return {
        success: false,
        error: 'Invalid Plivo Auth ID format. Please check your .env file.',
        details: 'The PLIVO_AUTH_ID in your .env file is not in the correct format.'
      };
    }

    // Validate Plivo phone number format
    const plivoPhone = process.env.PLIVO_PHONE_NUMBER.trim();
    console.log(`📱 Using Plivo phone number: ${plivoPhone}`);

    if (!plivoPhone.startsWith('+')) {
      console.error('❌ Invalid PLIVO_PHONE_NUMBER format. Phone number must start with "+"');
      console.error(`   Current value: ${plivoPhone}`);
      return {
        success: false,
        error: 'Invalid Plivo phone number format. Phone number must start with "+" and include country code.',
        details: 'The PLIVO_PHONE_NUMBER in your .env file must be in E.164 format (e.g., +1234567890).'
      };
    }

    // Log the phone number being used (for debugging)
    console.log(`📞 Attempting to send SMS from: ${plivoPhone}`);

    // Initialize Plivo client
    const client = new plivo.Client(
      authId,
      process.env.PLIVO_AUTH_TOKEN.trim()
    );

    // Format phone number to E.164 format if needed
    let formattedPhone = to.trim();

    // If phone doesn't start with +, try to format it
    if (!formattedPhone.startsWith('+')) {
      // Remove all non-digit characters except +
      formattedPhone = formattedPhone.replace(/\D/g, '');

      // If it starts with 1 (US/Canada), keep it, otherwise add +1
      if (formattedPhone.length === 10) {
        formattedPhone = '+1' + formattedPhone;
      } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
        formattedPhone = '+' + formattedPhone;
      } else {
        // For international numbers, add + if not present
        formattedPhone = '+' + formattedPhone;
      }
    }

    // Send SMS using Plivo (promise-based API)
    const result = await client.messages.create(
      plivoPhone, // Source phone number (your Plivo number)
      formattedPhone, // Destination phone number
      message // Message content
    );

    console.log(`✅ SMS sent successfully to ${formattedPhone}. Message UUID: ${result.messageUuid || 'N/A'}`);

    return {
      success: true,
      messageUuid: result.messageUuid,
      status: result.status || 'sent',
      to: formattedPhone
    };
  } catch (error) {
    console.error('❌ Error sending SMS via Plivo:', error);

    // Extract error message and details
    const errorMessage = error.message || error.toString();
    const errorDetails = error.response?.data || error.body || errorMessage;

    // Handle specific Plivo errors
    if (errorMessage.includes('Invalid number') || errorMessage.includes('invalid destination')) {
      return {
        success: false,
        error: 'Invalid phone number format',
        details: errorMessage
      };
    } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('authentication failed') || errorMessage.includes('401')) {
      return {
        success: false,
        error: 'Invalid Plivo credentials. Please check your PLIVO_AUTH_ID and PLIVO_AUTH_TOKEN.',
        details: errorMessage
      };
    } else if (errorMessage.includes('not found') || errorMessage.includes('does not exist') || errorMessage.includes('404')) {
      const plivoPhone = process.env.PLIVO_PHONE_NUMBER?.trim() || 'NOT SET';
      console.error(`❌ Plivo Error: Phone number "${plivoPhone}" is not a valid Plivo number`);
      console.error('   This means the number is not in your Plivo account.');
      console.error('   Steps to fix:');
      console.error('   1. Go to https://console.plivo.com/ → Phone Numbers → Manage Numbers');
      console.error('   2. Find your actual Plivo phone number');
      console.error('   3. Copy it exactly (should be in format +1234567890)');
      console.error('   4. Update PLIVO_PHONE_NUMBER in .env file');
      console.error('   5. Restart your server');
      return {
        success: false,
        error: `Invalid Plivo phone number. "${plivoPhone}" is not a valid Plivo number in your account.`,
        details: `The phone number "${plivoPhone}" is not associated with your Plivo account. Please: 1) Go to Plivo Console → Phone Numbers → Manage Numbers, 2) Find your actual Plivo number, 3) Copy it exactly to your .env file, 4) Restart your server. If you don't have a number, purchase one from Plivo Console.`
      };
    } else if (errorMessage.includes('insufficient') || errorMessage.includes('balance') || errorMessage.includes('credit')) {
      return {
        success: false,
        error: 'Insufficient Plivo account balance. Please add credits to your Plivo account.',
        details: errorMessage
      };
    }

    return {
      success: false,
      error: errorMessage || 'Failed to send SMS',
      details: typeof errorDetails === 'object' ? JSON.stringify(errorDetails) : errorDetails
    };
  }
};

module.exports = sendSMS;

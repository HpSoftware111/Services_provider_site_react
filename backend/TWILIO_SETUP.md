# Twilio SMS Setup Guide

This guide explains how to set up Twilio for SMS verification in the Home Services application.

## Prerequisites

1. A Twilio account (sign up at https://www.twilio.com/)
2. A Twilio phone number (you can get a trial number for free)
3. Your Twilio Account SID and Auth Token

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### How to Get Your Twilio Credentials

1. **Account SID**: 
   - Log in to your Twilio Console
   - Your Account SID is displayed on the dashboard
   - Format: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

2. **Auth Token**:
   - Log in to your Twilio Console
   - Click on "Auth Token" in the dashboard
   - Click "Show" to reveal your Auth Token
   - Format: `your_auth_token_string`

3. **Phone Number**:
   - In Twilio Console, go to "Phone Numbers" > "Manage" > "Active Numbers"
   - Copy your Twilio phone number
   - Format: `+1234567890` (must include country code with +)

## Installation

Install the Twilio package:

```bash
npm install twilio
```

## How It Works

1. **Phone Verification Flow**:
   - User requests a verification code
   - System generates a 6-digit code
   - Code is sent via SMS using Twilio (primary method)
   - Code is also sent via email as a fallback/backup
   - Code expires in 10 minutes

2. **Fallback Mechanism**:
   - If SMS fails (Twilio not configured or error), email is still sent
   - If both fail, the code is still generated and stored (can be retrieved manually if needed)
   - The system logs all delivery attempts for debugging

## Phone Number Format

The system automatically formats phone numbers to E.164 format:
- US/Canada numbers: `+1XXXXXXXXXX` (10 digits)
- International numbers: `+[country code][number]`

Examples:
- `(555) 123-4567` → `+15551234567`
- `5551234567` → `+15551234567`
- `+44 20 7946 0958` → `+442079460958`

## Testing

### Trial Account Limitations

If you're using a Twilio trial account:
- You can only send SMS to verified phone numbers
- Add verified numbers in Twilio Console > Phone Numbers > Verified Caller IDs

### Production

For production:
- Upgrade your Twilio account
- Remove phone number verification restrictions
- All phone numbers can receive SMS

## Troubleshooting

### Common Errors

1. **"Twilio credentials not configured"**
   - Check that all three environment variables are set in `.env`
   - Restart your server after adding environment variables

2. **"Invalid phone number format"**
   - Ensure phone number includes country code
   - Format: `+[country code][number]`

3. **"Unverified phone number" (Error 21608)**
   - If using trial account, verify the recipient number in Twilio Console
   - Or upgrade to a paid account

4. **"Invalid phone number" (Error 21614)**
   - Check that the phone number is valid
   - Ensure it's in E.164 format

### Debugging

Check server logs for:
- `✅ SMS sent successfully` - SMS was sent
- `⚠️ SMS sending failed` - SMS failed, email sent as fallback
- `❌ Error sending SMS` - Error details

## Security Notes

- Never commit your `.env` file to version control
- Keep your Auth Token secret
- Use environment variables for all sensitive data
- Consider using Twilio's webhook verification for production

## Support

For Twilio-specific issues:
- Twilio Documentation: https://www.twilio.com/docs
- Twilio Support: https://support.twilio.com/


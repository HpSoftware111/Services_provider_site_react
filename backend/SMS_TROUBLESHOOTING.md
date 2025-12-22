# SMS Troubleshooting Guide

This guide helps you diagnose and fix SMS delivery issues with Twilio.

## Recent Improvements

The SMS sending functionality has been significantly enhanced with:

1. **Better Phone Number Formatting**: Automatic conversion to E.164 format with validation
2. **Detailed Logging**: Comprehensive console logs showing exactly what's happening
3. **Error Handling**: Specific error messages for different Twilio error codes
4. **Trial Account Detection**: Automatic detection and warnings for Twilio trial accounts
5. **User-Friendly Messages**: Clear error messages for users

## Common Issues and Solutions

### 1. SMS Not Received - Check Server Logs

When you click "Send verification code", check your backend server console for detailed logs:

**Success Logs:**
```
📱 Attempting to send SMS:
   From: +1234567890
   To: +19876543210 (original: 9876543210)
   Message length: 75 characters
✅ SMS sent successfully!
   Message SID: SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   Status: queued
   To: +19876543210
   From: +1234567890
```

**Error Logs:**
```
❌ Error sending SMS via Twilio:
   Original phone: 9876543210
   Error code: 21608
   Error message: The number +19876543210 is unverified.
```

### 2. Twilio Trial Account Limitations

**Problem**: If you're using a Twilio trial account, SMS can only be sent to **verified phone numbers**.

**Solution**:
1. Log in to [Twilio Console](https://console.twilio.com/)
2. Go to **Phone Numbers** > **Manage** > **Verified Caller IDs**
3. Click **Add a new number**
4. Enter the phone number you want to verify
5. Enter the verification code sent to that number
6. Once verified, you can send SMS to that number

**Alternative**: Upgrade your Twilio account to remove this limitation.

### 3. Invalid Phone Number Format

**Error Code**: `21211` or `21614`

**Problem**: Phone number is not in the correct format.

**Solution**: 
- Ensure phone numbers are entered correctly
- The system automatically formats to E.164 format (e.g., `+1234567890`)
- For US/Canada: Enter 10 digits (e.g., `9876543210`) or with country code (`19876543210`)
- For international: Include country code (e.g., `+441234567890`)

### 4. Unverified Phone Number (Trial Account)

**Error Code**: `21608`

**Problem**: Using a Twilio trial account and the recipient number is not verified.

**Solution**: 
- Verify the phone number in Twilio Console (see #2 above)
- Or upgrade your Twilio account

### 5. Unreachable Destination

**Error Code**: `30003`, `30005`, or `30006`

**Problem**: The phone number cannot receive SMS (landline, invalid, or unreachable).

**Solution**:
- Verify the phone number is correct
- Ensure it's a mobile number (not a landline)
- Check if the number is active and can receive SMS

### 6. Message Blocked

**Error Code**: `30004`

**Problem**: The message was blocked by carrier or spam filters.

**Solution**:
- Wait a few minutes and try again
- Check if the recipient has blocked your number
- Contact Twilio support if the issue persists

### 7. Twilio Credentials Not Configured

**Problem**: Environment variables are missing or incorrect.

**Solution**:
1. Check your `.env` file in the `backend` directory
2. Ensure these variables are set:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid_here
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_PHONE_NUMBER=+1234567890
   ```
3. Restart your backend server after updating `.env`

### 8. Check Twilio Phone Number Format

**Problem**: `TWILIO_PHONE_NUMBER` is not in E.164 format.

**Solution**: 
- Format: `+1234567890` (with country code and + prefix)
- Get your number from: Twilio Console > Phone Numbers > Manage > Active Numbers

## Debugging Steps

### Step 1: Check Backend Logs

When you send a verification code, immediately check your backend console. Look for:

1. **Phone number formatting**: Does it show the formatted number correctly?
2. **Twilio account status**: Does it detect trial account?
3. **SMS result**: Does it show success or error?
4. **Error details**: What specific error code and message?

### Step 2: Verify Twilio Configuration

```bash
# Check if environment variables are set
cd backend
node -e "require('dotenv').config(); console.log('SID:', process.env.TWILIO_ACCOUNT_SID ? 'Set' : 'Missing'); console.log('Token:', process.env.TWILIO_AUTH_TOKEN ? 'Set' : 'Missing'); console.log('Phone:', process.env.TWILIO_PHONE_NUMBER || 'Missing');"
```

### Step 3: Test Twilio Connection

You can test your Twilio credentials directly:

```javascript
const twilio = require('twilio');
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Fetch account info
client.api.accounts(process.env.TWILIO_ACCOUNT_SID)
  .fetch()
  .then(account => {
    console.log('Account Type:', account.type);
    console.log('Account Status:', account.status);
  })
  .catch(err => console.error('Error:', err));
```

### Step 4: Check Twilio Console

1. Log in to [Twilio Console](https://console.twilio.com/)
2. Go to **Monitor** > **Logs** > **Messaging**
3. Look for your SMS attempts
4. Check the status of each message:
   - **Queued**: Message is waiting to be sent
   - **Sent**: Message was sent successfully
   - **Delivered**: Message was delivered to recipient
   - **Failed**: Message failed (check error details)
   - **Undelivered**: Message could not be delivered

### Step 5: Verify Phone Number in Twilio

If using a trial account:
1. Go to **Phone Numbers** > **Manage** > **Verified Caller IDs**
2. Check if the recipient number is listed
3. If not, add and verify it

## Error Code Reference

| Code | Meaning | Solution |
|------|---------|----------|
| 21211 | Invalid phone number format | Check phone number format |
| 21608 | Unverified number (trial account) | Verify number in Twilio Console |
| 21614 | Invalid phone number | Verify number is correct |
| 21408 | Permission denied | Check Twilio account permissions |
| 21610 | Unsubscribed recipient | Recipient has opted out |
| 30003 | Unreachable destination | Verify number is active |
| 30004 | Message blocked | Check carrier/spam filters |
| 30005 | Unknown destination | Verify number is correct |
| 30006 | Landline or unreachable | Use a mobile number |

## Testing SMS Delivery

### Test with a Verified Number

1. Add your test phone number to Twilio Verified Caller IDs
2. Send a verification code
3. Check server logs for success/error
4. Check Twilio Console > Monitor > Logs > Messaging

### Test Phone Number Formatting

The system automatically formats phone numbers. Test these formats:

- `9876543210` → `+19876543210` ✅
- `19876543210` → `+19876543210` ✅
- `+19876543210` → `+19876543210` ✅
- `(987) 654-3210` → `+19876543210` ✅
- `987-654-3210` → `+19876543210` ✅

## Getting Help

If SMS still doesn't work after trying these solutions:

1. **Check Twilio Console Logs**: Most detailed error information
2. **Review Backend Logs**: Detailed logging has been added
3. **Contact Twilio Support**: For account-specific issues
4. **Check Twilio Status**: [status.twilio.com](https://status.twilio.com/)

## Email Fallback

Even if SMS fails, the verification code is always sent via email as a backup. Users will receive the code in their email address associated with their account.


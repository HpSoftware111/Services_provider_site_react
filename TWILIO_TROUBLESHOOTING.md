# Twilio SMS Troubleshooting Guide

If you're not receiving SMS verification codes, follow these steps:

## Step 1: Check Server Logs

Check your backend server console/logs when you click "Send verification code". Look for:

### ✅ Success Messages:
- `✅ SMS sent successfully to +1XXXXXXXXXX. SID: SMxxxxx`
- `✅ Verification code sent via SMS to +1XXXXXXXXXX`

### ⚠️ Warning Messages:
- `⚠️ Twilio credentials not configured` - Twilio env variables missing
- `⚠️ SMS sending failed: [error message]` - SMS failed, email sent instead
- `⚠️ Unverified phone number` - Trial account limitation

### ❌ Error Messages:
- `❌ Error sending SMS via Twilio` - Check error details below

## Step 2: Verify Twilio Configuration

Check your `.env` file has these variables set:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

**Important:** 
- Restart your backend server after adding/updating these variables
- The phone number MUST include country code with `+` (e.g., `+1` for US)

## Step 3: Check Twilio Account Status

### Trial Account Limitations:
If you're using a **Twilio Trial Account**:
- You can ONLY send SMS to **verified phone numbers**
- Go to Twilio Console → Phone Numbers → Verified Caller IDs
- Add your phone number there
- Or upgrade to a paid account to send to any number

### Check Your Twilio Console:
1. Log in to https://console.twilio.com/
2. Go to **Monitor** → **Logs** → **Messaging**
3. Check if messages are being sent
4. Look for error codes:
   - **21211**: Invalid phone number format
   - **21608**: Unverified phone number (trial account)
   - **21614**: Invalid phone number

## Step 4: Verify Phone Number Format

The system automatically formats phone numbers, but ensure:
- US/Canada: `+1XXXXXXXXXX` (10 digits after +1)
- International: `+[country code][number]`

Examples:
- ✅ `+15551234567`
- ✅ `(555) 123-4567` (auto-formatted to +15551234567)
- ✅ `555-123-4567` (auto-formatted to +15551234567)
- ❌ `5551234567` (missing country code - will be auto-formatted)

## Step 5: Test Twilio Directly

You can test if Twilio is working by checking the server logs:

1. Click "Send verification code"
2. Check backend console for:
   - `✅ SMS sent successfully` = Working!
   - `⚠️ SMS sending failed` = Check error message
   - `⚠️ Twilio credentials not configured` = Add env variables

## Step 6: Common Issues & Solutions

### Issue: "Twilio credentials not configured"
**Solution:** Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` to `.env` and restart server

### Issue: "Unverified phone number" (Error 21608)
**Solution:** 
- If using trial account: Verify your phone number in Twilio Console
- Or upgrade to paid account

### Issue: "Invalid phone number format" (Error 21211)
**Solution:** 
- Ensure phone number includes country code
- Format: `+1XXXXXXXXXX` for US/Canada

### Issue: SMS not received but no error
**Solution:**
- Check Twilio Console → Monitor → Logs → Messaging
- Check if message was sent successfully
- Check phone carrier/network issues
- Check spam/junk folder (some carriers filter SMS)

## Step 7: Check Email Fallback

Even if SMS fails, the code is **always sent via email** as a backup. Check your email inbox for the verification code.

## Still Not Working?

1. **Check backend server logs** - Look for error messages
2. **Check Twilio Console** - Monitor → Logs → Messaging
3. **Verify Twilio credentials** - Make sure they're correct in `.env`
4. **Test with a verified number** - If using trial account
5. **Check phone number format** - Must include country code

## Quick Test

To quickly test if Twilio is configured:

1. Check backend logs when clicking "Send verification code"
2. Look for: `✅ SMS sent successfully` or `⚠️ SMS sending failed`
3. If you see the success message but no SMS:
   - Check Twilio Console logs
   - Verify phone number in Twilio (trial accounts)
   - Check phone carrier/network


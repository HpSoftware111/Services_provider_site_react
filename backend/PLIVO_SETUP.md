# Plivo SMS Setup Guide

This guide will help you configure Plivo for sending SMS verification codes in the Home Services application.

## Prerequisites

1. A Plivo account (sign up at https://www.plivo.com/)
2. A Plivo phone number with SMS capability
3. Your Plivo Auth ID and Auth Token

## Step 1: Get Your Plivo Credentials

1. Log in to your Plivo account at https://console.plivo.com/
2. Navigate to **Settings** → **API Keys**
3. You'll find:
   - **Auth ID**: Your Plivo Auth ID (e.g., `MAXXXXXXXXXXXXXXXXXX`)
   - **Auth Token**: Your Plivo Auth Token (keep this secret!)

## Step 2: Get Your Plivo Phone Number

1. Go to **Phone Numbers** → **Manage Numbers** in your Plivo Console
2. Find your active phone number
3. Copy the phone number in E.164 format (e.g., `+1234567890`)
   - Make sure it includes the `+` sign and country code
   - The number must have SMS capability enabled

## Step 3: Configure Environment Variables

Add the following variables to your `.env` file in the `backend` directory:

```env
# Plivo Configuration
PLIVO_AUTH_ID=your_auth_id_here
PLIVO_AUTH_TOKEN=your_auth_token_here
PLIVO_PHONE_NUMBER=+1234567890
```

**Important:**
- Replace `your_auth_id_here` with your actual Plivo Auth ID
- Replace `your_auth_token_here` with your actual Plivo Auth Token
- Replace `+1234567890` with your actual Plivo phone number (must include `+` and country code)
- Never commit your `.env` file to version control

## Step 4: Install Dependencies

The Plivo package should already be installed. If not, run:

```bash
cd backend
npm install plivo
```

## Step 5: Restart Your Server

After updating your `.env` file, restart your backend server:

```bash
cd backend
npm start
# or for development
npm run dev
```

## Step 6: Test SMS Sending

1. Navigate to the phone verification page in your application
2. Enter a phone number
3. Click "Send Verification Code"
4. Check your server logs for confirmation messages
5. The verification code should be received via SMS

## Troubleshooting

### Error: "Plivo credentials not configured"
- **Solution**: Make sure all three environment variables (`PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`, `PLIVO_PHONE_NUMBER`) are set in your `.env` file
- Restart your server after updating `.env`

### Error: "Invalid Plivo Auth ID format"
- **Solution**: Verify your `PLIVO_AUTH_ID` is correct. It should be a valid Plivo Auth ID from your Plivo Console

### Error: "Phone number is not a valid Plivo number"
- **Solution**: 
  1. Go to Plivo Console → Phone Numbers → Manage Numbers
  2. Verify the phone number exists in your account
  3. Copy the exact number (including `+` and country code) to your `.env` file
  4. Make sure the number has SMS capability enabled

### Error: "Unauthorized" or "Invalid credentials"
- **Solution**: 
  1. Double-check your `PLIVO_AUTH_ID` and `PLIVO_AUTH_TOKEN` in the Plivo Console
  2. Make sure there are no extra spaces or quotes in your `.env` file
  3. Regenerate your Auth Token if needed

### SMS Not Being Received
- Check your Plivo account balance (you need credits to send SMS)
- Verify the destination phone number format is correct
- Check Plivo Console → Logs for delivery status
- Ensure your Plivo account is not in trial mode with restrictions

## Plivo Console Links

- **Dashboard**: https://console.plivo.com/dashboard/
- **Phone Numbers**: https://console.plivo.com/phone-numbers/
- **API Keys**: https://console.plivo.com/settings/api-keys/
- **Logs**: https://console.plivo.com/logs/
- **Account Settings**: https://console.plivo.com/settings/

## Support

- **Plivo Documentation**: https://www.plivo.com/docs/
- **Plivo Support**: https://support.plivo.com/


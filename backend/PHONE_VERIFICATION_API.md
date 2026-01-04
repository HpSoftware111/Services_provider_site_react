# Phone Number Verification API

This document describes the phone number verification endpoints that allow programmatic verification of phone numbers in Twilio.

## Overview

The phone verification API provides endpoints to:
1. Request verification of a phone number (sends verification code)
2. Confirm verification with the code received
3. Check if a phone number is verified in Twilio

## Endpoints

### 1. Request Phone Number Verification

**Endpoint:** `POST /api/phone-verification/verify-number`

**Description:** Requests Twilio to send a verification code to the specified phone number. This is useful for trial accounts that need to verify phone numbers before sending SMS.

**Authentication:** Required (Protected route)

**Request Body:**
```json
{
  "phone": "16414559023"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Verification code sent to phone number",
  "verificationSid": "VExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "status": "pending",
  "phone": "+16414559023",
  "originalPhone": "16414559023",
  "channel": "sms",
  "accountType": "Trial",
  "isTrialAccount": true,
  "instructions": "Check your phone for the verification code. Enter it to complete verification."
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Invalid phone number format",
  "userFriendlyMessage": "The phone number format is invalid. Please check and try again.",
  "code": 21211,
  "phone": "+16414559023",
  "originalPhone": "16414559023",
  "instructions": "For trial accounts, you can verify the number manually in Twilio Console..."
}
```

**Usage Example:**
```javascript
// Frontend
const response = await api.post('/phone-verification/verify-number', {
  phone: '16414559023'
});

if (response.data.success) {
  console.log('Verification code sent!');
  console.log('Check your phone for the code');
}
```

### 2. Confirm Phone Number Verification

**Endpoint:** `POST /api/phone-verification/confirm-verification`

**Description:** Confirms phone number verification by submitting the verification code received via SMS. This endpoint requires Twilio Verify Service to be configured.

**Authentication:** Required (Protected route)

**Request Body:**
```json
{
  "phone": "16414559023",
  "code": "123456"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Phone number verified successfully",
  "verified": true,
  "status": "approved",
  "phone": "+16414559023"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Invalid verification code",
  "message": "The verification code is incorrect or has expired",
  "status": "pending"
}
```

**Usage Example:**
```javascript
// Frontend
const response = await api.post('/phone-verification/confirm-verification', {
  phone: '16414559023',
  code: '123456'
});

if (response.data.success) {
  console.log('Phone number verified!');
}
```

### 3. Check Twilio Verification Status

**Endpoint:** `GET /api/phone-verification/check-twilio-status?phone=16414559023`

**Description:** Checks if a phone number is verified in Twilio (useful for checking verification status before sending SMS).

**Authentication:** Required (Protected route)

**Query Parameters:**
- `phone` (required): Phone number to check

**Response (Success):**
```json
{
  "success": true,
  "verified": true,
  "phone": "+16414559023",
  "originalPhone": "16414559023",
  "accountType": "Trial",
  "isTrialAccount": true,
  "verifiedInTwilio": true,
  "message": "Phone number is verified in Twilio"
}
```

**Usage Example:**
```javascript
// Frontend
const response = await api.get('/phone-verification/check-twilio-status', {
  params: { phone: '16414559023' }
});

if (response.data.verified) {
  console.log('Phone is verified, can send SMS');
} else {
  console.log('Phone needs verification');
}
```

## Configuration

### Required Environment Variables

Add these to your `.env` file:

```env
# Required for all endpoints
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here

# Optional: For code confirmation (recommended)
TWILIO_VERIFY_SERVICE_SID=your_verify_service_sid_here
```

### Setting Up Twilio Verify Service (Optional but Recommended)

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Verify** > **Services**
3. Click **Create new Verify Service**
4. Give it a name (e.g., "Phone Verification")
5. Copy the **Service SID**
6. Add it to your `.env` file as `TWILIO_VERIFY_SERVICE_SID`

**Benefits of using Verify Service:**
- Better delivery rates
- Automatic retry logic
- Better error handling
- Code expiration management

## How It Works

### Method 1: Using Twilio Verify Service (Recommended)

If `TWILIO_VERIFY_SERVICE_SID` is configured:

1. **Request Verification:**
   - Call `POST /api/phone-verification/verify-number`
   - Twilio sends verification code via SMS
   - Returns `verificationSid`

2. **Confirm Verification:**
   - User receives code on their phone
   - Call `POST /api/phone-verification/confirm-verification` with the code
   - If code is correct, phone is verified

### Method 2: Using Outgoing Caller ID Validation (Fallback)

If `TWILIO_VERIFY_SERVICE_SID` is not configured:

1. **Request Verification:**
   - Call `POST /api/phone-verification/verify-number`
   - Twilio sends verification code via SMS or call
   - User must enter code in Twilio Console to complete verification

2. **Manual Verification:**
   - Go to [Twilio Console](https://console.twilio.com/us1/develop/phone-numbers/manage/verified)
   - Enter the verification code received
   - Phone number is now verified

## Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 21211 | Invalid phone number format | Check phone number format |
| 21608 | Phone already verified or verification in progress | Check if verification is already in progress |
| 21614 | Invalid phone number | Verify number is correct and active |
| 21408 | Permission denied | Check Twilio account permissions |
| 20429 | Too many verification attempts | Wait and request new code |
| 20404 | Verification not found | Request new verification code |

## Complete Flow Example

```javascript
// Step 1: Request verification
const verifyResponse = await api.post('/phone-verification/verify-number', {
  phone: '16414559023'
});

if (verifyResponse.data.success) {
  // Step 2: User enters code from SMS
  const code = prompt('Enter verification code from SMS:');
  
  // Step 3: Confirm verification
  const confirmResponse = await api.post('/phone-verification/confirm-verification', {
    phone: '16414559023',
    code: code
  });
  
  if (confirmResponse.data.success) {
    console.log('Phone verified successfully!');
  }
}
```

## Integration with SMS Sending

After verifying a phone number, you can send SMS to it:

```javascript
// Check if verified before sending SMS
const statusResponse = await api.get('/phone-verification/check-twilio-status', {
  params: { phone: '16414559023' }
});

if (statusResponse.data.verified) {
  // Phone is verified, safe to send SMS
  await sendSMS('16414559023', 'Your message here');
} else {
  // Phone not verified, request verification first
  await api.post('/phone-verification/verify-number', {
    phone: '16414559023'
  });
}
```

## Troubleshooting

### Verification Code Not Received

1. **Check Twilio Console:**
   - Go to Monitor > Logs > Messaging
   - Look for the verification message
   - Check delivery status

2. **Check Phone Number:**
   - Ensure number is correct
   - Ensure it's a mobile number (not landline)
   - Check for carrier blocking

3. **Trial Account:**
   - Verify the number is in Verified Caller IDs
   - Or upgrade to paid account

### Code Verification Fails

1. **Code Expired:**
   - Verification codes expire after a few minutes
   - Request a new verification code

2. **Too Many Attempts:**
   - Wait a few minutes before trying again
   - Request a new verification code

3. **Invalid Code:**
   - Double-check the code entered
   - Ensure no extra spaces or characters

## Notes

- **Trial Accounts:** Must verify phone numbers before sending SMS
- **Paid Accounts:** Can send SMS to any valid number, but verification is still recommended
- **Phone Format:** All phone numbers are automatically formatted to E.164 format (`+16414559023`)
- **Security:** All endpoints require authentication (protected routes)




# Email Configuration Guide

## Quick Setup for Development

### Option 1: Bypass Email Verification (Recommended for Development)

Add to your `.env` file:
```
BYPASS_EMAIL_VERIFICATION=true
```

This will allow users to login without email verification.

### Option 2: Configure Gmail SMTP (For Production)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
   - Copy the 16-character password

3. **Add to your `.env` file**:
```
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_FROM=Home Services <your-email@gmail.com>
FRONTEND_URL=http://localhost:3000
```

### Option 3: Use Other SMTP Services

For other email providers, update your `.env`:

**Outlook/Hotmail:**
```
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
```

**Custom SMTP:**
```
EMAIL_USER=your-email@yourdomain.com
EMAIL_PASSWORD=your-password
EMAIL_HOST=smtp.yourdomain.com
EMAIL_PORT=587
EMAIL_FROM=Home Services <your-email@yourdomain.com>
```

## Troubleshooting

### Error: "getaddrinfo ENOTFOUND smtp.franchisenavigator.net"
- This means the SMTP host is not configured correctly
- Set `EMAIL_HOST` in your `.env` file (e.g., `smtp.gmail.com`)
- Or set `BYPASS_EMAIL_VERIFICATION=true` to skip email verification

### Error: "403 Forbidden" on Login
- Your email is not verified
- Set `BYPASS_EMAIL_VERIFICATION=true` in `.env` to bypass
- Or click "Resend Verification" to get a new verification email

### Email Not Sending
- Check that `EMAIL_USER` and `EMAIL_PASSWORD` are set in `.env`
- For Gmail, use an App Password (not your regular password)
- Check that the SMTP host and port are correct
- Check your firewall/network settings


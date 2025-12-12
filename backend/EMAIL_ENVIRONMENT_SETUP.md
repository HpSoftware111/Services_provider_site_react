# Email Configuration for Different Environments

This guide explains how to configure SMTP settings for local development and production server environments.

## Overview

The email system now supports environment-specific SMTP configuration, allowing you to use different email servers for local development and production.

## Configuration Options

### Option 1: Environment-Specific Variables (Recommended)

Use separate SMTP settings for development and production:

#### Local Development (`.env` or `.env.development`)
```env
NODE_ENV=development

# Development SMTP (for local testing)
DEV_EMAIL_HOST=smtp.gmail.com
DEV_EMAIL_PORT=587
EMAIL_USER=yourname@gmail.com
EMAIL_PASSWORD=your_gmail_app_password
EMAIL_FROM=Home Services <yourname@gmail.com>
```

#### Production Server (`.env.production` or server environment variables)
```env
NODE_ENV=production

# Production SMTP (your actual domain)
PROD_EMAIL_HOST=smtp.franchisenavigator.net
PROD_EMAIL_PORT=465
EMAIL_USER=contact@franchisenavigator.net
EMAIL_PASSWORD=your_production_password
EMAIL_FROM=Home Services <contact@franchisenavigator.net>
```

### Option 2: Single Configuration (Legacy)

If you don't set `DEV_EMAIL_HOST` or `PROD_EMAIL_HOST`, the system will use the standard `EMAIL_HOST`:

```env
EMAIL_HOST=smtp.franchisenavigator.net
EMAIL_PORT=465
EMAIL_USER=contact@franchisenavigator.net
EMAIL_PASSWORD=your_password
EMAIL_FROM=Home Services <contact@franchisenavigator.net>
```

### Option 3: Auto-Detection

If no `EMAIL_HOST` is set, the system will auto-detect based on your email address:
- Gmail addresses → `smtp.gmail.com`
- Outlook/Hotmail addresses → `smtp-mail.outlook.com`
- Yahoo addresses → `smtp.mail.yahoo.com`

## Priority Order

The system checks SMTP configuration in this order:

1. **`DEV_EMAIL_HOST`** (if `NODE_ENV=development`)
2. **`PROD_EMAIL_HOST`** (if `NODE_ENV=production`)
3. **`EMAIL_HOST`** (fallback for both environments)
4. **Auto-detection** (based on email domain)

## Recommended Setup

### For Local Development

Use Gmail or Outlook for easy testing:

```env
NODE_ENV=development
DEV_EMAIL_HOST=smtp.gmail.com
DEV_EMAIL_PORT=587
EMAIL_USER=yourname@gmail.com
EMAIL_PASSWORD=your_gmail_app_password
```

**Gmail Setup:**
1. Enable 2-Factor Authentication
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the App Password (not your regular password)

### For Production Server

Use your domain's SMTP server:

```env
NODE_ENV=production
PROD_EMAIL_HOST=smtp.franchisenavigator.net
PROD_EMAIL_PORT=465
EMAIL_USER=contact@franchisenavigator.net
EMAIL_PASSWORD=your_production_password
```

## Troubleshooting

### DNS Error (ENOTFOUND)

**Problem:** `smtp.franchisenavigator.net` cannot be resolved

**Solutions:**
1. **Local Development:** Use `DEV_EMAIL_HOST=smtp.gmail.com` instead
2. **Production:** Verify the SMTP hostname is correct
3. **Check DNS:** The SMTP server must exist and be accessible

### Connection Timeout

**Problem:** Cannot connect to SMTP server

**Solutions:**
1. Check firewall settings
2. Verify the port (587 for TLS, 465 for SSL)
3. Ensure the SMTP server is accessible from your network

### Authentication Failed

**Problem:** Invalid credentials

**Solutions:**
1. Verify `EMAIL_USER` and `EMAIL_PASSWORD` are correct
2. For Gmail, use App Password (not regular password)
3. Check if the account has "Less secure app access" enabled (if required)

## Environment Detection

The system automatically detects the environment:
- **Development:** `NODE_ENV=development` → Uses `DEV_EMAIL_HOST` if set
- **Production:** `NODE_ENV=production` → Uses `PROD_EMAIL_HOST` if set
- **Unknown:** Falls back to `EMAIL_HOST` or auto-detection

## Logging

The system logs which SMTP server is being used:
- `📧 [DEVELOPMENT] Using development SMTP: smtp.gmail.com:587`
- `📧 [PRODUCTION] Using production SMTP: smtp.franchisenavigator.net:465`

Check your server logs to verify which SMTP configuration is active.

## Security Notes

1. **Never commit `.env` files to git**
2. **Use environment variables on your hosting platform** (Heroku, AWS, etc.)
3. **Use App Passwords for Gmail** (more secure than regular passwords)
4. **Rotate passwords regularly**

## Example Configurations

### Complete Development Setup
```env
NODE_ENV=development
DEV_EMAIL_HOST=smtp.gmail.com
DEV_EMAIL_PORT=587
EMAIL_USER=dev@example.com
EMAIL_PASSWORD=app_password_here
EMAIL_FROM=Home Services Dev <dev@example.com>
```

### Complete Production Setup
```env
NODE_ENV=production
PROD_EMAIL_HOST=smtp.franchisenavigator.net
PROD_EMAIL_PORT=465
EMAIL_USER=contact@franchisenavigator.net
EMAIL_PASSWORD=production_password_here
EMAIL_FROM=Home Services <contact@franchisenavigator.net>
```


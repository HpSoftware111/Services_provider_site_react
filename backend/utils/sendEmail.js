const nodemailer = require('nodemailer');
require('dotenv').config();

const sendEmail = async (options) => {
  // Declare variables outside try block for error handling
  let smtpHost;
  let smtpPort;
  let environment = 'unknown';

  try {
    // Check if email credentials are configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.warn('⚠️  Email credentials not configured. Email sending is disabled.');
      console.warn('   To enable email, set EMAIL_USER and EMAIL_PASSWORD in .env file');
      return Promise.resolve({
        success: false,
        message: 'Email credentials not configured'
      });
    }

    // Detect environment
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isProduction = process.env.NODE_ENV === 'production';
    environment = isDevelopment ? 'development' : (isProduction ? 'production' : 'unknown');

    // Determine SMTP host based on email provider
    const emailUser = process.env.EMAIL_USER.toLowerCase();
    const isGmail = emailUser.includes('@gmail.com');
    const isOutlook = emailUser.includes('@outlook.com') || emailUser.includes('@hotmail.com') || emailUser.includes('@live.com');
    const isYahoo = emailUser.includes('@yahoo.com') || emailUser.includes('@ymail.com');

    // Check if EMAIL_HOST is explicitly set
    const hasExplicitEmailHost = process.env.EMAIL_HOST && process.env.EMAIL_HOST.trim() !== '';

    // Check for environment-specific SMTP settings
    const devEmailHost = process.env.DEV_EMAIL_HOST;
    const prodEmailHost = process.env.PROD_EMAIL_HOST;
    const useDevSmtp = isDevelopment && devEmailHost;
    const useProdSmtp = isProduction && prodEmailHost;

    // Determine SMTP settings
    let smtpSource = 'auto-detected';

    if (useDevSmtp) {
      // Use development-specific SMTP if set
      smtpHost = devEmailHost.trim();
      smtpPort = process.env.DEV_EMAIL_PORT ? parseInt(process.env.DEV_EMAIL_PORT) : 587;
      smtpSource = 'development config';
      console.log(`📧 [${environment.toUpperCase()}] Using development SMTP: ${smtpHost}:${smtpPort} for ${emailUser}`);
    } else if (useProdSmtp) {
      // Use production-specific SMTP if set
      smtpHost = prodEmailHost.trim();
      smtpPort = process.env.PROD_EMAIL_PORT ? parseInt(process.env.PROD_EMAIL_PORT) : 587;
      smtpSource = 'production config';
      console.log(`📧 [${environment.toUpperCase()}] Using production SMTP: ${smtpHost}:${smtpPort} for ${emailUser}`);
    } else if (hasExplicitEmailHost) {
      // Use provided EMAIL_HOST if explicitly set
      smtpHost = process.env.EMAIL_HOST.trim();
      smtpPort = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587;
      smtpSource = 'explicit config';

      // Warn in development if using custom domain SMTP that might not be accessible
      if (isDevelopment && !isGmail && !isOutlook && !isYahoo) {
        console.warn(`⚠️  [${environment.toUpperCase()}] Using custom SMTP in development: ${smtpHost}`);
        console.warn(`   If this fails, consider using DEV_EMAIL_HOST for local testing (e.g., smtp.gmail.com)`);
      }

      console.log(`📧 [${environment.toUpperCase()}] Using custom SMTP: ${smtpHost}:${smtpPort} for ${emailUser}`);
    } else if (isGmail) {
      smtpHost = 'smtp.gmail.com';
      smtpPort = 587;
      smtpSource = 'auto-detected (Gmail)';
    } else if (isOutlook) {
      smtpHost = 'smtp-mail.outlook.com';
      smtpPort = 587;
      smtpSource = 'auto-detected (Outlook)';
    } else if (isYahoo) {
      smtpHost = 'smtp.mail.yahoo.com';
      smtpPort = 587;
      smtpSource = 'auto-detected (Yahoo)';
    } else {
      // For custom domains without EMAIL_HOST, warn and skip
      console.warn('⚠️  Cannot determine SMTP server for custom domain email.');
      console.warn(`   Email: ${emailUser}`);
      console.warn(`   EMAIL_HOST: ${process.env.EMAIL_HOST || 'not set'}`);
      console.warn(`   Environment: ${environment}`);
      console.warn('   Please set a valid EMAIL_HOST in .env file (e.g., smtp.yourdomain.com)');
      console.warn('   Or use DEV_EMAIL_HOST for development and PROD_EMAIL_HOST for production');
      return Promise.resolve({
        success: false,
        message: 'SMTP server not configured for custom domain email. Please set EMAIL_HOST in .env file.'
      });
    }

    const useSecure = smtpPort === 465;

    console.log(`📧 [${environment.toUpperCase()}] Using SMTP: ${smtpHost}:${smtpPort} (${smtpSource}) for ${emailUser}`);

    // Create transporter with proper SMTP settings
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: useSecure, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      tls: {
        // Do not fail on invalid certificates
        rejectUnauthorized: false
      },
      // Connection timeout
      connectionTimeout: 10000,
      // Greeting timeout
      greetingTimeout: 10000,
      // Socket timeout
      socketTimeout: 10000
    });

    // Email options
    const mailOptions = {
      from: process.env.EMAIL_FROM || `Home Services <${process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text || options.message,
      html: options.html || options.message?.replace(/\n/g, '<br>')
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [${environment.toUpperCase()}] Email sent successfully: ${info.messageId}`);
    return info;
  } catch (error) {
    // Log error but don't throw - email failure shouldn't break the app
    const isDevelopment = process.env.NODE_ENV === 'development';
    const environment = isDevelopment ? 'development' : (process.env.NODE_ENV === 'production' ? 'production' : 'unknown');

    console.error(`❌ [${environment.toUpperCase()}] Email sending error:`, error);

    // Provide more helpful error messages
    let errorMessage = error.message;
    let shouldSuggestFallback = false;

    if (error.code === 'EDNS' || error.code === 'ENOTFOUND') {
      const hostDisplay = smtpHost || process.env.EMAIL_HOST || 'unknown';
      errorMessage = `SMTP server "${hostDisplay}" not found. Please check your EMAIL_HOST configuration in .env file.`;
      console.error(`⚠️  DNS Error: Cannot resolve SMTP host "${hostDisplay}"`);
      console.error(`   This usually means:`);
      console.error(`   1. The SMTP hostname is incorrect`);
      console.error(`   2. The SMTP server doesn't exist`);
      console.error(`   3. There's a network/DNS issue`);
      console.error(`   Current EMAIL_HOST: ${process.env.EMAIL_HOST || 'not set'}`);
      console.error(`   DEV_EMAIL_HOST: ${process.env.DEV_EMAIL_HOST || 'not set'}`);
      console.error(`   PROD_EMAIL_HOST: ${process.env.PROD_EMAIL_HOST || 'not set'}`);

      // Suggest fallback for development
      if (isDevelopment) {
        shouldSuggestFallback = true;
        console.error(`   💡 Development Tip: Set DEV_EMAIL_HOST=smtp.gmail.com for local testing`);
        console.error(`   💡 Or use a Gmail/Outlook account that's accessible from your local machine`);
      }
    } else if (error.code === 'EAUTH') {
      errorMessage = 'SMTP authentication failed. Please check your EMAIL_USER and EMAIL_PASSWORD in .env file.';
      console.error(`⚠️  Authentication Error: Invalid email credentials`);
      console.error(`   Current EMAIL_USER: ${process.env.EMAIL_USER || 'not set'}`);
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      const hostDisplay = smtpHost || process.env.EMAIL_HOST || 'unknown';
      const portDisplay = smtpPort || process.env.EMAIL_PORT || 'unknown';
      errorMessage = `Cannot connect to SMTP server "${hostDisplay}". Please check your EMAIL_HOST and EMAIL_PORT configuration.`;
      console.error(`⚠️  Connection Error: Cannot reach SMTP server "${hostDisplay}:${portDisplay}"`);

      if (isDevelopment) {
        shouldSuggestFallback = true;
        console.error(`   💡 Development Tip: The SMTP server may not be accessible from your local machine`);
        console.error(`   💡 Consider using DEV_EMAIL_HOST for local development`);
      }
    }

    return Promise.resolve({
      success: false,
      error: errorMessage,
      code: error.code,
      suggestion: shouldSuggestFallback ? 'Consider using DEV_EMAIL_HOST for local development' : null
    });
  }
};

module.exports = sendEmail;


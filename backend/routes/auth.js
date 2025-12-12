const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');
const generateToken = require('../utils/generateToken');
const { protect } = require('../middleware/auth');
const logActivity = require('../utils/logActivity');
const sendEmail = require('../utils/sendEmail');

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name, email, password } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }


    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const bypassVerification = process.env.BYPASS_EMAIL_VERIFICATION === 'true' ||
      process.env.BYPASS_EMAIL_VERIFICATION === '1' ||
      process.env.BYPASS_EMAIL_VERIFICATION === 'True' ||
      process.env.BYPASS_EMAIL_VERIFICATION === 'TRUE';
    const autoVerify = bypassVerification;

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: 'user',
      isEmailVerified: autoVerify,
      emailVerificationToken: autoVerify ? null : emailVerificationToken,
      emailVerificationExpires: autoVerify ? null : emailVerificationExpires
    });

    if (!autoVerify) {
      // Determine frontend URL based on environment
      // In development: use FRONTEND_URL, in production: use PROD_FRONTEND_URL
      const isDevelopment = process.env.NODE_ENV === 'development';
      const frontendUrl = isDevelopment
        ? (process.env.FRONTEND_URL || 'http://localhost:3000')
        : (process.env.PROD_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000');
      // Ensure the URL is properly formatted and token is URL-encoded
      const encodedToken = encodeURIComponent(emailVerificationToken);
      const verificationLink = `${frontendUrl}/verify-email?token=${encodedToken}`;
      await sendEmail({
        to: email,
        subject: 'Verify Your Email - Home Services',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 28px;">Welcome to Home Services!</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px;">Please verify your email address</p>
            </div>
            <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <p style="color: #333; font-size: 16px; line-height: 1.6;">
                Hi ${name},
              </p>
              <p style="color: #333; font-size: 16px; line-height: 1.6;">
                Thank you for registering! Please click the button below to verify your email address.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationLink}" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; 
                          font-weight: 600; font-size: 16px;">
                  Verify Email
                </a>
              </div>
              <p style="color: #7f8c8d; font-size: 14px; margin-top: 30px; text-align: center;">
                This link will expire in 24 hours. If you didn't create an account, please ignore this email.
              </p>
            </div>
          </div>
        `
      }).catch(() => { });
    }
    // END OF EMAIL SENDING - Uncomment above block to re-enable email sending

    // Log activity
    await logActivity({
      type: 'user_registered',
      description: `New user "${user.name}" registered`,
      userId: user.id,
      metadata: { userName: user.name, userEmail: user.email }
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account before logging in.',
      needsVerification: true,
      email: user.email
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user (NO ADMIN - use /api/auth/admin/login)
// @access  Public
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => {
        if (err.param === 'email') {
          return 'Please enter a valid email address.';
        } else if (err.param === 'password') {
          return 'Password is required.';
        }
        return err.msg;
      });
      return res.status(400).json({
        success: false,
        error: errorMessages[0] || 'Please check your input and try again.',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Check for user (include password for comparison)
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password. Please check your credentials and try again.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // BLOCK ADMIN LOGIN ON MAIN SITE - Return generic error
    if (user.role === 'admin') {
      return res.status(401).json({
        error: 'Invalid email or password. Please check your credentials and try again.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        error: 'Your account has been deactivated. Please contact support for assistance.',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // ============================================================
    // EMAIL VERIFICATION BYPASS FOR TESTING
    // ============================================================
    // To BYPASS email verification (for testing only):
    //   1. Comment out the entire if block below (lines with "Check if email is verified")
    //   2. OR set BYPASS_EMAIL_VERIFICATION=true in your .env file
    //
    // To ENABLE email verification again:
    //   1. Uncomment the if block below
    //   2. OR remove BYPASS_EMAIL_VERIFICATION from .env or set it to false
    // ============================================================

    // Check if email is verified
    // BYPASS: Set BYPASS_EMAIL_VERIFICATION=true in .env to bypass email verification
    const bypassVerification = process.env.BYPASS_EMAIL_VERIFICATION === 'true' ||
      process.env.BYPASS_EMAIL_VERIFICATION === '1' ||
      process.env.BYPASS_EMAIL_VERIFICATION === 'True' ||
      process.env.BYPASS_EMAIL_VERIFICATION === 'TRUE';

    if (!bypassVerification && !user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        error: 'Please verify your email before logging in. Check your inbox for the verification link.',
        needsVerification: true,
        email: user.email,
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid email or password. Please check your credentials and try again.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Update last login
    await user.updateLastLogin();

    // Generate token
    const token = generateToken(user.id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        avatar: user.avatar,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.log('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// @route   POST /api/auth/admin/login
// @desc    Admin login (ONLY ADMIN)
// @access  Public (Admin only)
router.post('/admin/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Check for user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    // ONLY ALLOW ADMIN ROLE
    if (user.role !== 'admin') {
      return res.status(403).json({
        error: 'This is an admin login. Regular users should login at /login'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ error: 'Admin account is deactivated' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    // Update last login
    await user.updateLastLogin();

    // Generate token
    const token = generateToken(user.id);

    res.json({
      success: true,
      message: 'Admin login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        avatar: user.avatar,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.log('Admin login error:', error);
    res.status(500).json({ error: 'Server error during admin login' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
        firstName: user.firstName,
        lastName: user.lastName,
        gender: user.gender,
        username: user.username,
        secondEmail: user.secondEmail,
        address: user.address,
        city: user.city,
        state: user.state,
        country: user.country,
        zipCode: user.zipCode,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.log('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/auth/updateprofile
// @desc    Update user profile
// @access  Private
router.put('/updateprofile', protect, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    // Check for username uniqueness if username is being changed
    if (req.body.username && req.body.username !== user.username) {
      const existingUser = await User.findOne({
        where: {
          username: req.body.username,
          id: { [Op.ne]: user.id }
        }
      });

      if (existingUser) {
        return res.status(400).json({
          error: 'Username already taken. Please choose another.'
        });
      }
    }

    // Update allowed fields
    const allowedFields = [
      'name', 'phone', 'firstName', 'lastName', 'gender',
      'username', 'secondEmail', 'address', 'city',
      'state', 'country', 'zipCode'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== null) {
        user[field] = req.body[field];
      }
    });

    // Handle avatar separately with validation
    if (req.body.avatar !== undefined) {
      if (req.body.avatar === '' || req.body.avatar === null) {
        user.avatar = null;
      } else if (typeof req.body.avatar === 'string' && req.body.avatar.startsWith('data:image')) {
        // Validate base64 size (max 500KB after encoding)
        if (req.body.avatar.length > 500000) {
          return res.status(400).json({
            error: 'Image is too large. Please use a smaller image (max 500KB).'
          });
        }
        user.avatar = req.body.avatar;
      }
    }

    await user.save();

    // Log activity
    await logActivity({
      type: 'profile_updated',
      description: `User "${user.name}" updated their profile`,
      userId: user.id,
      metadata: { userName: user.name }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        gender: user.gender,
        username: user.username,
        secondEmail: user.secondEmail,
        address: user.address,
        city: user.city,
        state: user.state,
        country: user.country,
        zipCode: user.zipCode,
        avatar: user.avatar,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);

    // Handle specific database errors
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        error: 'Username already exists. Please choose another.'
      });
    }

    if (error.name === 'SequelizeDatabaseError' && error.message.includes('Data too long')) {
      return res.status(400).json({
        error: 'Image data is too large for database. Please use a smaller image.'
      });
    }

    res.status(500).json({
      error: 'Failed to update profile. Please try again.'
    });
  }
});

// @route   PUT /api/auth/changepassword
// @desc    Change password
// @access  Private
router.put('/changepassword', protect, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    // Check current password
    if (!(await user.comparePassword(req.body.currentPassword))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.password = req.body.newPassword;
    await user.save();

    const token = generateToken(user.id);

    res.json({
      success: true,
      message: 'Password changed successfully',
      token
    });
  } catch (error) {
    console.log('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', protect, (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// @route   GET /api/auth/verify-email/:token
// @route   GET /api/auth/verify-email?token=xxx
// @desc    Verify user email
// @access  Public
router.get('/verify-email/:token?', async (req, res) => {
  try {
    // Support both path parameter and query parameter
    const token = req.params.token || req.query.token;

    if (!token) {
      console.log('Email verification: No token provided');
      return res.status(400).json({
        error: 'Verification token is required'
      });
    }

    console.log('Email verification attempt for token:', token.substring(0, 10) + '...');

    // First, check if user with this token exists (even if expired)
    const userWithToken = await User.findOne({
      where: {
        emailVerificationToken: token
      }
    });

    // If user exists but token is expired
    if (userWithToken && userWithToken.emailVerificationExpires && userWithToken.emailVerificationExpires <= new Date()) {
      console.log('Email verification: Token expired');
      return res.status(400).json({
        error: 'Verification token has expired. Please request a new verification email.'
      });
    }

    // If user exists and is already verified, return success (idempotent)
    if (userWithToken && userWithToken.isEmailVerified) {
      console.log('Email verification: Email already verified');
      return res.json({
        success: true,
        message: 'Email is already verified. You can log in to your account.'
      });
    }

    // Find user with valid (non-expired) token
    const user = await User.findOne({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: { [Op.gt]: new Date() }
      }
    });

    if (!user) {
      console.log('Email verification: Token not found');
      return res.status(400).json({
        error: 'Invalid verification token. Please check your email link or request a new verification email.'
      });
    }

    await user.update({
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null
    });

    await logActivity({
      type: 'email_verified',
      description: `User "${user.name}" verified their email`,
      userId: user.id,
      metadata: { userName: user.name, userEmail: user.email }
    });

    res.json({
      success: true,
      message: 'Email verified successfully! You can now access all features.'
    });
  } catch (error) {
    console.log('Email verification error:', error);
    res.status(500).json({ error: 'Server error during email verification' });
  }
});

// @route   POST /api/auth/resend-verification-public
// @desc    Resend verification email (public - for login page)
// @access  Public
router.post('/resend-verification-public', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      // Don't reveal if user exists
      return res.json({ success: true, message: 'If an account exists, a verification email has been sent.' });
    }

    if (user.isEmailVerified) {
      return res.json({ success: true, message: 'Email is already verified. You can log in.' });
    }

    // Generate new token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await user.update({
      emailVerificationToken,
      emailVerificationExpires
    });

    // Send verification email (non-blocking - don't fail if email fails)
    // Determine frontend URL based on environment
    // In development: use FRONTEND_URL, in production: use PROD_FRONTEND_URL
    const isDevelopment = process.env.NODE_ENV === 'development';
    const frontendUrl = isDevelopment
      ? (process.env.FRONTEND_URL || 'http://localhost:3000')
      : (process.env.PROD_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000');
    // Ensure the URL is properly formatted and token is URL-encoded
    const encodedToken = encodeURIComponent(emailVerificationToken);
    const verificationLink = `${frontendUrl}/verify-email?token=${encodedToken}`;
    const emailResult = await sendEmail({
      to: user.email,
      subject: 'Verify Your Email - Home Services',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Verify Your Email</h1>
          </div>
          <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              Hi ${user.name},
            </p>
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              Click the button below to verify your email address.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; 
                        font-weight: 600; font-size: 16px;">
                Verify Email
              </a>
            </div>
            <p style="color: #7f8c8d; font-size: 14px; margin-top: 30px; text-align: center;">
              This link will expire in 24 hours.
            </p>
          </div>
        </div>
      `
    }).catch(err => {
      console.error('Failed to send verification email:', err.message);
      return { success: false, error: err.message };
    });

    // Log email result but don't fail the request
    if (!emailResult || !emailResult.success) {
      console.warn('⚠️  Verification email could not be sent. Email may not be configured.');
    }

    res.json({
      success: true,
      message: 'Verification email sent successfully!'
    });
  } catch (error) {
    console.log('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

// @route   POST /api/auth/resend-verification
// @desc    Resend verification email
// @access  Private
router.post('/resend-verification', protect, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (user.isEmailVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Generate new token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await user.update({
      emailVerificationToken,
      emailVerificationExpires
    });

    // Send verification email
    // Determine frontend URL based on environment
    // In development: use FRONTEND_URL, in production: use PROD_FRONTEND_URL
    const isDevelopment = process.env.NODE_ENV === 'development';
    const frontendUrl = isDevelopment
      ? (process.env.FRONTEND_URL || 'http://localhost:3000')
      : (process.env.PROD_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000');
    // Ensure the URL is properly formatted and token is URL-encoded
    const encodedToken = encodeURIComponent(emailVerificationToken);
    const verificationLink = `${frontendUrl}/verify-email?token=${encodedToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Verify Your Email - Home Services',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Verify Your Email</h1>
          </div>
          <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              Hi ${user.name},
            </p>
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              Click the button below to verify your email address.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; 
                        font-weight: 600; font-size: 16px;">
                Verify Email
              </a>
            </div>
            <p style="color: #7f8c8d; font-size: 14px; margin-top: 30px; text-align: center;">
              This link will expire in 24 hours.
            </p>
          </div>
        </div>
      `
    });

    res.json({
      success: true,
      message: 'Verification email sent successfully!'
    });
  } catch (error) {
    console.log('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

module.exports = router;


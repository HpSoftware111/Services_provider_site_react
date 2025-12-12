const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const { connectDB } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const businessRoutes = require('./routes/businesses');
const categoryRoutes = require('./routes/categories');
const reviewRoutes = require('./routes/reviews');
const blogRoutes = require('./routes/blogs');
const adminRoutes = require('./routes/admin');
const searchRoutes = require('./routes/search');
const contactRoutes = require('./routes/contact');
const subcategoryRoutes = require('./routes/subcategories');
const serviceRequestRoutes = require('./routes/service-requests');
const webhookRoutes = require('./routes/webhooks');
const providerRoutes = require('./routes/provider');
const subscriptionRoutes = require('./routes/subscriptions');

// Initialize Express app
const app = express();

// Security middleware
// Adjust helmet settings based on whether using HTTPS
const isHttps = process.env.NODE_ENV === 'production' && process.env.USE_HTTPS === 'true';

app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
  crossOriginOpenerPolicy: isHttps ? { policy: "same-origin" } : false, // Only enable on HTTPS
  crossOriginResourcePolicy: false, // More permissive for HTTP
  originAgentCluster: false // Disable to avoid HTTP warnings
}));

// Rate limiting - More lenient in development
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: process.env.NODE_ENV === 'development'
    ? (process.env.RATE_LIMIT_MAX_REQUESTS || 1000)  // 1000 requests per 15 min in dev
    : (process.env.RATE_LIMIT_MAX_REQUESTS || 100),  // 100 requests per 15 min in production
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/api/health',
  // Custom handler to provide better error messages
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
    });
  }
});
app.use('/api/', limiter);

// CORS configuration - Allow multiple origins for domain and IP access
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL]
    : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
    if (!origin) return callback(null, true);

    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1 ||
      allowedOrigins.some(allowed => origin && origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      // For production, be more permissive - allow any origin from same domain/IP pattern
      // This handles cases where domain and IP both need to work
      const originHost = origin.replace(/^https?:\/\//, '').split(':')[0];
      const allowedHosts = allowedOrigins.map(o => o.replace(/^https?:\/\//, '').split(':')[0]);

      // Allow if origin matches any allowed host (for domain/IP flexibility)
      if (allowedHosts.some(host => originHost.includes(host) || host.includes(originHost))) {
        callback(null, true);
      } else {
        // In development, allow all origins
        if (process.env.NODE_ENV === 'development') {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser middleware with increased limit for images
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/subcategories', subcategoryRoutes);
app.use('/api/service-requests', serviceRequestRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/provider', providerRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Serve static files (React build) - works in both dev and production
const frontendBuildPath = path.join(__dirname, '../frontend/dist');
const fs = require('fs');

if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));

  // Serve React app for all non-API routes
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 API: http://localhost:${PORT}/api`);
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔧 Frontend: http://localhost:3000`);
    }
    console.log('');
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log('Unhandled Rejection! Shutting down...');
  console.error(err);
  process.exit(1);
});

module.exports = app;


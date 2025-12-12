/**
 * Environment Variable Validation Script
 * Run this before starting the server in production
 */

require('dotenv').config();

const requiredVars = [
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'JWT_SECRET'
];

const optionalVars = [
  'DB_HOST',
  'DB_PORT',
  'PORT',
  'JWT_EXPIRE',
  'CORS_ORIGIN',
  'FRONTEND_URL',
  'EMAIL_USER',
  'EMAIL_PASSWORD'
];

let hasErrors = false;

console.log('🔍 Validating environment variables...\n');

// Check required variables
requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (!value || value.trim() === '') {
    console.error(`❌ Required variable missing: ${varName}`);
    hasErrors = true;
  } else {
    console.log(`✅ ${varName}: Set`);
  }
});

// Check JWT_SECRET strength
if (process.env.JWT_SECRET) {
  if (process.env.JWT_SECRET === 'your-secret-key' || process.env.JWT_SECRET.length < 32) {
    console.error('❌ JWT_SECRET is too weak or using default value. Must be at least 32 characters.');
    hasErrors = true;
  } else {
    console.log(`✅ JWT_SECRET: Strong (${process.env.JWT_SECRET.length} characters)`);
  }
}

// Check optional variables
console.log('\n📋 Optional variables:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`   ✅ ${varName}: Set`);
  } else {
    console.log(`   ⚠️  ${varName}: Not set (using default)`);
  }
});

// Check NODE_ENV
console.log(`\n🌍 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
if (process.env.NODE_ENV === 'production') {
  if (process.env.SYNC_DB === 'true') {
    console.warn('⚠️  WARNING: SYNC_DB is set to true in production. This is not recommended.');
  }
}

if (hasErrors) {
  console.error('\n❌ Environment validation failed. Please fix the errors above.\n');
  process.exit(1);
} else {
  console.log('\n✅ Environment variables validated successfully!\n');
  process.exit(0);
}


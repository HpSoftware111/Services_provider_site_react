const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('⚠️  STRIPE_SECRET_KEY not found in environment variables. Stripe functionality will not work.');
} else {
    // Log first few characters to verify key format (without exposing full key)
    const keyPreview = process.env.STRIPE_SECRET_KEY.substring(0, 7);
    console.log(`✅ Stripe initialized with key starting with: ${keyPreview}...`);

    // Verify key format
    if (process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
        console.log('ℹ️  Using Stripe TEST mode');
    } else if (process.env.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
        console.log('ℹ️  Using Stripe LIVE mode');
    } else {
        console.warn('⚠️  Stripe key format may be incorrect. Expected sk_test_ or sk_live_');
    }
}

module.exports = stripe;


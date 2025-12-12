const express = require('express');
const app = express();

// Test if routes are being loaded
try {
    const serviceRequestRoutes = require('../routes/service-requests');
    console.log('✅ Service request routes loaded successfully');
    console.log('Routes in router:', serviceRequestRoutes.stack.map(r => r.route?.path || 'N/A'));
} catch (error) {
    console.error('❌ Error loading service request routes:', error.message);
}

// Test if models are available
try {
    const { ServiceCategory, ServiceSubCategory } = require('../models');
    console.log('✅ ServiceCategory model:', !!ServiceCategory);
    console.log('✅ ServiceSubCategory model:', !!ServiceSubCategory);
} catch (error) {
    console.error('❌ Error loading models:', error.message);
}

console.log('\n📋 Route order check:');
console.log('1. /categories/all (should be first)');
console.log('2. / (root)');
console.log('3. /:id (should be last)');


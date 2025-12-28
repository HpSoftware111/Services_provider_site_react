/**
 * Diagnostic script to check why a business is not appearing in search results
 * 
 * Usage: node scripts/check-business-visibility.js <businessId> [zipCode] [categoryId]
 * 
 * Example: node scripts/check-business-visibility.js 123 10001 5
 */

const { Business, Category } = require('../models');
const { getCoordinatesFromZipCode, calculateDistance, getBoundingBox } = require('../utils/geolocation');
const { Op } = require('sequelize');

async function checkBusinessVisibility() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: node scripts/check-business-visibility.js <businessId> [zipCode] [categoryId]');
    process.exit(1);
  }

  const businessId = parseInt(args[0]);
  const zipCode = args[1] || null;
  const categoryId = args[2] ? parseInt(args[2]) : null;

  try {
    console.log(`\n🔍 Checking visibility for business ID: ${businessId}`);
    if (zipCode) console.log(`   Zip code: ${zipCode}`);
    if (categoryId) console.log(`   Category ID: ${categoryId}`);
    console.log('');

    // Load business
    const business = await Business.findByPk(businessId, {
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name'] }
      ]
    });

    if (!business) {
      console.error(`❌ Business with ID ${businessId} not found!`);
      process.exit(1);
    }

    const businessData = business.toJSON();
    console.log(`✅ Business found: "${businessData.name}"`);
    console.log(`   Category: ${businessData.category?.name || 'N/A'} (ID: ${businessData.categoryId})`);
    console.log(`   Zip Code: ${businessData.zipCode || 'N/A'}`);
    console.log(`   Location: ${businessData.city || 'N/A'}, ${businessData.state || 'N/A'}`);
    console.log(`   Coordinates: lat=${businessData.latitude || 'N/A'}, lng=${businessData.longitude || 'N/A'}`);
    console.log('');

    // Check status flags
    console.log('📊 Status Checks:');
    console.log(`   isActive: ${businessData.isActive} ${businessData.isActive ? '✅' : '❌ (REQUIRED: true)'}`);
    console.log(`   isPublic: ${businessData.isPublic} ${businessData.isPublic ? '✅' : '❌ (REQUIRED: true)'}`);
    console.log(`   isVerified: ${businessData.isVerified || false}`);
    console.log(`   approvedAt: ${businessData.approvedAt || 'N/A'}`);
    console.log(`   rejectedAt: ${businessData.rejectedAt || 'N/A'}`);
    if (businessData.rejectionReason) {
      console.log(`   rejectionReason: ${businessData.rejectionReason}`);
    }
    console.log('');

    // Check if business would pass status filters
    const passesStatusFilters = businessData.isActive === true && businessData.isPublic === true;
    if (!passesStatusFilters) {
      console.log('❌ BUSINESS WILL NOT APPEAR IN SEARCH - Status filters failed!');
      console.log('   Fix: Ensure isActive=true and isPublic=true');
      console.log('');
    } else {
      console.log('✅ Business passes status filters (isActive=true, isPublic=true)');
      console.log('');
    }

    // Check category match if categoryId provided
    if (categoryId) {
      console.log(`📋 Category Check:`);
      console.log(`   Business categoryId: ${businessData.categoryId}`);
      console.log(`   Search categoryId: ${categoryId}`);
      const categoryMatch = businessData.categoryId === categoryId;
      console.log(`   Match: ${categoryMatch ? '✅' : '❌'}`);
      console.log('');
    }

    // Check zip code and radius if zipCode provided
    if (zipCode) {
      console.log(`📍 Zip Code & Radius Check:`);
      console.log(`   Business zipCode: ${businessData.zipCode || 'N/A'}`);
      console.log(`   Search zipCode: ${zipCode}`);
      
      const exactZipMatch = businessData.zipCode === zipCode;
      console.log(`   Exact zip match: ${exactZipMatch ? '✅' : '❌'}`);

      // Check radius search
      if (businessData.latitude && businessData.longitude) {
        console.log(`   Business has coordinates: ✅`);
        
        try {
          const zipCoordinates = await getCoordinatesFromZipCode(zipCode);
          if (zipCoordinates && !isNaN(zipCoordinates.lat) && !isNaN(zipCoordinates.lng)) {
            const distance = calculateDistance(
              zipCoordinates.lat,
              zipCoordinates.lng,
              parseFloat(businessData.latitude),
              parseFloat(businessData.longitude)
            );
            const radiusMiles = 20;
            const inRadius = distance <= radiusMiles;
            
            console.log(`   Distance from search zip: ${distance.toFixed(2)} miles`);
            console.log(`   Within ${radiusMiles} miles: ${inRadius ? '✅' : '❌'}`);
          } else {
            console.log(`   ⚠️  Could not geocode search zip code`);
          }
        } catch (error) {
          console.log(`   ⚠️  Error calculating distance: ${error.message}`);
        }
      } else {
        console.log(`   Business has coordinates: ❌ (latitude/longitude are null)`);
        console.log(`   ⚠️  Business will only match if zip code matches exactly`);
      }
      console.log('');
    }

    // Check services
    console.log(`🔧 Services:`);
    let services = businessData.services || [];
    if (typeof services === 'string') {
      try {
        services = JSON.parse(services);
      } catch (e) {
        services = [];
      }
    }
    if (Array.isArray(services) && services.length > 0) {
      console.log(`   Services (${services.length}): ${services.join(', ')}`);
    } else {
      console.log(`   No services configured`);
    }
    console.log('');

    // Summary
    console.log('📋 SUMMARY:');
    const issues = [];
    if (!businessData.isActive) issues.push('isActive is false');
    if (!businessData.isPublic) issues.push('isPublic is false');
    if (categoryId && businessData.categoryId !== categoryId) {
      issues.push(`Category mismatch (business: ${businessData.categoryId}, search: ${categoryId})`);
    }
    if (zipCode && !businessData.zipCode) {
      issues.push('Business has no zip code');
    }
    if (zipCode && businessData.zipCode !== zipCode && (!businessData.latitude || !businessData.longitude)) {
      issues.push('Business zip code does not match and has no coordinates for radius search');
    }

    if (issues.length === 0) {
      console.log('✅ Business should appear in search results!');
    } else {
      console.log('❌ Issues preventing business from appearing:');
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

checkBusinessVisibility();


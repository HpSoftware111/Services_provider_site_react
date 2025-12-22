/**
 * Script to populate latitude and longitude for all businesses based on their zip codes
 * 
 * Usage: node scripts/populate-business-coordinates.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');
const { Business } = require('../models');
const { getCoordinatesFromZipCode } = require('../utils/geolocation');

async function populateCoordinates() {
  try {
    console.log('🚀 Starting to populate business coordinates...\n');
    
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');
    
    // Find all businesses that have a zip code but no coordinates (or incomplete coordinates)
    const { Op } = require('sequelize');
    const businesses = await Business.findAll({
      where: {
        zipCode: { 
          [Op.ne]: null,
          [Op.ne]: '' // Also exclude empty strings
        },
        [Op.or]: [
          { latitude: null },
          { longitude: null },
          { latitude: { [Op.eq]: 0 } }, // Also handle 0 values as invalid
          { longitude: { [Op.eq]: 0 } }
        ]
      },
      attributes: ['id', 'name', 'zipCode', 'latitude', 'longitude'],
      order: [['id', 'ASC']]
    });
    
    console.log(`📊 Found ${businesses.length} businesses that need coordinates\n`);
    
    if (businesses.length === 0) {
      console.log('✅ All businesses already have coordinates!');
      await sequelize.close();
      return;
    }
    
    let successCount = 0;
    let failCount = 0;
    const failedBusinesses = [];
    
    // Process each business
    for (let i = 0; i < businesses.length; i++) {
      const business = businesses[i];
      let zipCode = business.zipCode;
      
      // Clean zip code
      if (zipCode) {
        zipCode = zipCode.toString().trim();
        // Remove any non-digit characters except dash (for ZIP+4 format)
        zipCode = zipCode.replace(/[^\d-]/g, '');
        // Extract just the 5-digit zip code (before dash if ZIP+4)
        if (zipCode.includes('-')) {
          zipCode = zipCode.split('-')[0];
        }
      }
      
      console.log(`[${i + 1}/${businesses.length}] Processing: ${business.name} (ID: ${business.id}, Zip: ${zipCode || 'NULL'})`);
      
      // Skip if zip code is invalid
      if (!zipCode || zipCode.length < 5) {
        console.log(`   ⚠️  Invalid zip code format: "${business.zipCode}"\n`);
        failCount++;
        failedBusinesses.push({
          id: business.id,
          name: business.name,
          zipCode: business.zipCode,
          reason: `Invalid zip code format: "${business.zipCode}"`
        });
        continue;
      }
      
      try {
        // Geocode the zip code (with retry logic)
        let coordinates = null;
        let retries = 2; // Try up to 3 times (initial + 2 retries)
        
        while (retries >= 0 && !coordinates) {
          try {
            coordinates = await getCoordinatesFromZipCode(zipCode);
            if (coordinates && !isNaN(coordinates.lat) && !isNaN(coordinates.lng)) {
              break; // Success!
            }
            coordinates = null; // Reset for retry
          } catch (geocodeError) {
            console.log(`   ⚠️  Geocoding attempt failed: ${geocodeError.message}`);
            if (retries > 0) {
              console.log(`   🔄 Retrying... (${retries} attempts left)`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            }
          }
          retries--;
        }
        
        if (coordinates && !isNaN(coordinates.lat) && !isNaN(coordinates.lng)) {
          // Validate coordinates are reasonable (US bounds approximately)
          if (coordinates.lat >= 24 && coordinates.lat <= 50 && 
              coordinates.lng >= -125 && coordinates.lng <= -66) {
            // Update the business with coordinates
            await Business.update(
              {
                latitude: coordinates.lat,
                longitude: coordinates.lng
              },
              {
                where: { id: business.id }
              }
            );
            
            console.log(`   ✅ Updated: lat=${coordinates.lat.toFixed(6)}, lng=${coordinates.lng.toFixed(6)}\n`);
            successCount++;
          } else {
            console.log(`   ⚠️  Coordinates out of US bounds: lat=${coordinates.lat}, lng=${coordinates.lng}\n`);
            failCount++;
            failedBusinesses.push({
              id: business.id,
              name: business.name,
              zipCode: zipCode,
              reason: `Coordinates out of US bounds: lat=${coordinates.lat}, lng=${coordinates.lng}`
            });
          }
        } else {
          console.log(`   ⚠️  Could not geocode zip code ${zipCode} after retries\n`);
          failCount++;
          failedBusinesses.push({
            id: business.id,
            name: business.name,
            zipCode: zipCode,
            reason: 'Geocoding failed after retries'
          });
        }
      } catch (error) {
        console.error(`   ❌ Error processing business ${business.id}:`, error.message);
        failCount++;
        failedBusinesses.push({
          id: business.id,
          name: business.name,
          zipCode: zipCode,
          reason: error.message
        });
      }
      
      // Add a small delay to avoid rate limiting (especially for Google API)
      if (i < businesses.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully updated: ${successCount} businesses`);
    console.log(`❌ Failed: ${failCount} businesses`);
    console.log(`📈 Total processed: ${businesses.length} businesses\n`);
    
    if (failedBusinesses.length > 0) {
      console.log('\n❌ Failed businesses:');
      failedBusinesses.forEach(biz => {
        console.log(`   - ${biz.name} (ID: ${biz.id}, Zip: ${biz.zipCode || 'NULL'}): ${biz.reason}`);
      });
      console.log('');
    }
    
    // Show businesses that still need coordinates
    const remainingBusinesses = await Business.findAll({
      where: {
        [Op.or]: [
          { latitude: null },
          { longitude: null },
          { latitude: { [Op.eq]: 0 } },
          { longitude: { [Op.eq]: 0 } }
        ]
      },
      attributes: ['id', 'name', 'zipCode', 'latitude', 'longitude'],
      limit: 20 // Show first 20
    });
    
    if (remainingBusinesses.length > 0) {
      console.log(`⚠️  There are still ${remainingBusinesses.length} businesses without coordinates:`);
      remainingBusinesses.forEach(biz => {
        console.log(`   - ${biz.name} (ID: ${biz.id}, Zip: ${biz.zipCode || 'NULL'}, Lat: ${biz.latitude || 'NULL'}, Lng: ${biz.longitude || 'NULL'})`);
      });
      if (remainingBusinesses.length >= 20) {
        console.log(`   ... and more (showing first 20)`);
      }
      console.log('');
    }
    
    // Close database connection
    await sequelize.close();
    console.log('✅ Script completed successfully!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    console.error(error.stack);
    await sequelize.close();
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  populateCoordinates()
    .then(() => {
      console.log('\n✅ Script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { populateCoordinates };


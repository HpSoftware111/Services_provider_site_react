const axios = require('axios');

/**
 * Get latitude and longitude from zip code using a geocoding service
 * @param {string} zipCode - Zip code to geocode
 * @returns {Promise<{lat: number, lng: number}|null>} - Coordinates or null if not found
 */
async function getCoordinatesFromZipCode(zipCode) {
  try {
    // Clean zip code (remove dashes, spaces)
    const cleanZipCode = zipCode.replace(/[\s\-]/g, '');

    // Use Nominatim (OpenStreetMap) - free geocoding service
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        postalcode: cleanZipCode,
        country: 'USA',
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'HomeServicesApp/1.0' // Required by Nominatim
      },
      timeout: 5000 // 5 second timeout
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon)
      };
    }

    // Fallback: Try Google Geocoding API if API key is available
    if (process.env.GOOGLE_GEOCODING_API_KEY) {
      try {
        const googleResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
          params: {
            address: cleanZipCode,
            key: process.env.GOOGLE_GEOCODING_API_KEY
          },
          timeout: 5000
        });

        if (googleResponse.data.results && googleResponse.data.results.length > 0) {
          const location = googleResponse.data.results[0].geometry.location;
          return {
            lat: location.lat,
            lng: location.lng
          };
        }
      } catch (googleError) {
        console.warn('Google Geocoding API error:', googleError.message);
      }
    }

    return null;
  } catch (error) {
    console.error('Error geocoding zip code:', error.message);
    return null;
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} - Distance in miles
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  // Validate inputs
  if (
    typeof lat1 !== 'number' || typeof lng1 !== 'number' ||
    typeof lat2 !== 'number' || typeof lng2 !== 'number' ||
    isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)
  ) {
    return Infinity; // Return large distance if invalid
  }

  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Convert degrees to radians
 * @param {number} degrees - Degrees to convert
 * @returns {number} - Radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate bounding box for radius search (approximate)
 * This creates a square that contains the circle, for faster database queries
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} radiusMiles - Radius in miles
 * @returns {{minLat: number, maxLat: number, minLng: number, maxLng: number}}
 */
function getBoundingBox(lat, lng, radiusMiles) {
  // Approximate: 1 degree latitude ≈ 69 miles
  // 1 degree longitude ≈ 69 * cos(latitude) miles
  const latDelta = radiusMiles / 69;
  const lngDelta = radiusMiles / (69 * Math.cos(toRadians(lat)));

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta
  };
}

module.exports = {
  getCoordinatesFromZipCode,
  calculateDistance,
  getBoundingBox,
  toRadians
};


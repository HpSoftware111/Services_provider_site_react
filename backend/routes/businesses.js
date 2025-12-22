const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { Business, Category, User, Contact } = require('../models');
const { protect, optionalAuth } = require('../middleware/auth');
const logActivity = require('../utils/logActivity');
const { getCoordinatesFromZipCode, calculateDistance, getBoundingBox } = require('../utils/geolocation');

// @route   GET /api/businesses/geocode/:zipCode
// @desc    Geocode a zip code to get latitude and longitude
// @access  Public
router.get('/geocode/:zipCode', async (req, res) => {
  try {
    const { zipCode } = req.params;
    
    if (!zipCode) {
      return res.status(400).json({
        success: false,
        error: 'Zip code is required'
      });
    }
    
    const coordinates = await getCoordinatesFromZipCode(zipCode);
    
    if (coordinates && !isNaN(coordinates.lat) && !isNaN(coordinates.lng)) {
      return res.json({
        success: true,
        coordinates: {
          latitude: coordinates.lat,
          longitude: coordinates.lng
        }
      });
    } else {
      return res.status(404).json({
        success: false,
        error: 'Could not geocode zip code'
      });
    }
  } catch (error) {
    console.error('Error geocoding zip code:', error);
    return res.status(500).json({
      success: false,
      error: 'Error geocoding zip code'
    });
  }
});

// Helper function to build order from sort query
const buildOrderFromQuery = (sort) => {
  switch (sort) {
    case 'rating':
      return [
        ['isFeatured', 'DESC'],
        ['ratingAverage', 'DESC'],
        ['ratingCount', 'DESC'],
        ['createdAt', 'DESC']
      ];
    case 'name':
      return [['name', 'ASC']];
    case 'views':
      return [['views', 'DESC']];
    case 'newest':
      return [['createdAt', 'DESC']];
    case 'oldest':
      return [['createdAt', 'ASC']];
    default:
      return [
        ['isFeatured', 'DESC'],
        ['ratingAverage', 'DESC'],
        ['ratingCount', 'DESC'],
        ['createdAt', 'DESC']
      ];
  }
};

// @route   GET /api/businesses
// @desc    Get all businesses
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Check if user is authenticated and is a business owner or admin
    const isBusinessOwner = req.user && (req.user.role === 'business_owner' || req.user.role === 'admin');

    // Build base where clause
    const baseWhere = {};
    
    // Track if we have a zip code filter to apply later
    let zipCodeFilter = null;

    // Search by name or description - works independently
    if (req.query.search && req.query.search.trim()) {
      const searchTerm = req.query.search.trim();
      baseWhere[Op.or] = [
        { name: { [Op.like]: `%${searchTerm}%` } },
        { description: { [Op.like]: `%${searchTerm}%` } }
      ];
    }

    // Filter by category - support multiple categories (accept both singular and plural)
    const categoryParam = req.query.category || req.query.categories;
    if (categoryParam) {
      const categories = Array.isArray(categoryParam) ? categoryParam : categoryParam.split(',').filter(c => c);
      if (categories.length > 0) {
        baseWhere.categoryId = { [Op.in]: categories.map(c => parseInt(c)) };
        console.log(`📋 Added category filter: categoryId in [${categories.map(c => parseInt(c)).join(', ')}]`);
      }
    }

    // Filter by city - support multiple cities (accept both singular and plural)
    // Use exact match or prefix match for better accuracy
    const cityParam = req.query.city || req.query.cities;
    if (cityParam) {
      const cities = Array.isArray(cityParam) ? cityParam : cityParam.split(',').filter(c => c);
      if (cities.length > 0) {
        const trimmedCities = cities.map(c => c.trim());
        if (trimmedCities.length === 1) {
          // Single city - use exact match or prefix match (match from start to avoid partial matches)
          const city = trimmedCities[0];
          baseWhere.city = {
            [Op.or]: [
              { city: city }, // Exact match
              { city: { [Op.like]: `${city}%` } } // Match from start
            ]
          };
        } else {
          // Multiple cities - use OR with exact or prefix match for each
          const cityConditions = trimmedCities.flatMap(city => [
            { city: city }, // Exact match
            { city: { [Op.like]: `${city}%` } } // Match from start
          ]);
          baseWhere.city = {
            [Op.or]: cityConditions
          };
        }
      }
    }

    // Filter by state - support multiple states (accept both singular and plural)
    // Use exact match for states (they should be 2-letter codes or full names)
    const stateParam = req.query.state || req.query.states;
    if (stateParam) {
      const states = Array.isArray(stateParam) ? stateParam : stateParam.split(',').filter(s => s);
      if (states.length > 0) {
        const trimmedStates = states.map(s => s.trim().toUpperCase());
        baseWhere.state = { [Op.in]: trimmedStates };
      }
    }

    // Search by location (city or state) - works independently
    // Only process if cities/states filters are NOT already set (to avoid conflicts)
    if (req.query.location && req.query.location.trim() && !cityParam && !stateParam) {
      const locationSearch = req.query.location.trim();
      let locationCondition;

      // Parse location string - handle formats like "Detroit, MI", "Detroit", "MI", etc.
      if (locationSearch.includes(',')) {
        // Format: "City, State" - split and search both parts
        const parts = locationSearch.split(',').map(p => p.trim()).filter(p => p);
        if (parts.length >= 2) {
          // We have both city and state parts - prioritize exact match
          const cityPart = parts[0];
          const statePart = parts.slice(1).join(' ').trim().toUpperCase();

          // Search for: (city matches AND state matches) - prioritize this combination
          locationCondition = {
            [Op.and]: [
              {
                [Op.or]: [
                  { city: cityPart }, // Exact match
                  { city: { [Op.like]: `${cityPart}%` } } // Match from start
                ]
              },
              { state: statePart } // Exact state match
            ]
          };
        } else {
          // Only one part after comma - treat as city or state
          const part = parts[0];
          locationCondition = {
            [Op.or]: [
              { city: part }, // Exact match
              { city: { [Op.like]: `${part}%` } }, // Match from start
              { state: part.toUpperCase() } // Exact state match
            ]
          };
        }
      } else {
        // No comma - check if it's a state code (2 letters) or city name
        const locationUpper = locationSearch.toUpperCase();
        const isStateCode = locationUpper.length === 2 && /^[A-Z]{2}$/.test(locationUpper);

        if (isStateCode) {
          // Likely a state code - search state field with exact match
          locationCondition = {
            state: locationUpper
          };
        } else {
          // Likely a city name - search city field (match from start for better accuracy)
          locationCondition = {
            [Op.or]: [
              { city: locationSearch }, // Exact match
              { city: { [Op.like]: `${locationSearch}%` } } // Match from start
            ]
          };
        }
      }

      // If search is also provided, combine with AND logic
      if (baseWhere[Op.or]) {
        // We have both search and location - combine with AND
        const searchCondition = { [Op.or]: baseWhere[Op.or] };
        baseWhere[Op.and] = baseWhere[Op.and] || [];
        baseWhere[Op.and].push(searchCondition, locationCondition);
        delete baseWhere[Op.or];
      } else {
        // Only location is provided - merge location condition into baseWhere
        if (baseWhere[Op.and]) {
          baseWhere[Op.and].push(locationCondition);
        } else {
          Object.assign(baseWhere, locationCondition);
        }
      }
    }

    // Filter by zip code with radius search (20 miles default)
    let zipCoordinates = null;
    let radiusMiles = 20; // Default radius
    
    if (req.query.zipCode) {
      const zipCode = Array.isArray(req.query.zipCode) ? req.query.zipCode[0] : req.query.zipCode;
      radiusMiles = parseFloat(req.query.radius) || 20; // Allow custom radius via query param
      
      console.log(`🔍 Searching businesses for zip code: ${zipCode} (radius: ${radiusMiles} miles)`);
      
      // Always include exact zip code match as fallback
      // This ensures businesses show up even if geocoding fails or they don't have coordinates
      const zipCodeExactMatch = { zipCode: zipCode };
      
      // Get coordinates for the zip code
      try {
        console.log(`📍 Geocoding zip code: ${zipCode}...`);
        zipCoordinates = await getCoordinatesFromZipCode(zipCode);
        
        if (zipCoordinates && !isNaN(zipCoordinates.lat) && !isNaN(zipCoordinates.lng)) {
          console.log(`✅ Zip code geocoded successfully: lat=${zipCoordinates.lat}, lng=${zipCoordinates.lng}`);
          
          // Get bounding box for faster database query
          const boundingBox = getBoundingBox(zipCoordinates.lat, zipCoordinates.lng, radiusMiles);
          console.log(`📦 Bounding box: lat[${boundingBox.minLat.toFixed(4)}, ${boundingBox.maxLat.toFixed(4)}], lng[${boundingBox.minLng.toFixed(4)}, ${boundingBox.maxLng.toFixed(4)}]`);
          
          // Create OR condition: businesses with coordinates in radius OR exact zip code match
          // IMPORTANT: We use OR so businesses without coordinates can still match by exact zip
          const zipCodeCondition = {
            [Op.or]: [
              // Businesses with coordinates within bounding box
              {
                [Op.and]: [
                  { latitude: { [Op.between]: [boundingBox.minLat, boundingBox.maxLat] } },
                  { latitude: { [Op.ne]: null } },
                  { longitude: { [Op.between]: [boundingBox.minLng, boundingBox.maxLng] } },
                  { longitude: { [Op.ne]: null } }
                ]
              },
              // Always include exact zip code match as fallback (for businesses without coordinates)
              zipCodeExactMatch
            ]
          };
          
          console.log(`🔍 Zip code condition created with OR logic (coordinates in box OR exact zip match)`);
          console.log(`📋 zipCodeCondition:`, JSON.stringify(zipCodeCondition, null, 2));
          
          // Store zip code filter to apply later (after all other filters are set)
          zipCodeFilter = zipCodeCondition;
          console.log(`✅ zipCodeFilter stored:`, zipCodeFilter ? 'YES' : 'NO');
          console.log(`📋 zipCodeFilter value:`, JSON.stringify(zipCodeFilter, null, 2));
          
          // Store for post-processing
          req.zipCoordinates = zipCoordinates;
          req.radiusMiles = radiusMiles;
        } else {
          // If geocoding fails or returns invalid data, use exact zip code match only
          console.warn(`⚠️  Could not geocode zip code ${zipCode} or invalid coordinates, using exact match only`);
          if (baseWhere[Op.or]) {
            // Combine with existing Op.or using Op.and
            const existingOr = baseWhere[Op.or];
            delete baseWhere[Op.or];
            baseWhere[Op.and] = baseWhere[Op.and] || [];
            baseWhere[Op.and].push({ [Op.or]: existingOr }, zipCodeExactMatch);
          } else {
            baseWhere.zipCode = zipCode;
          }
        }
      } catch (error) {
        console.error('❌ Error in zip code geocoding:', error.message);
        console.error('   Stack:', error.stack);
        // Fallback to exact match on error
        if (baseWhere[Op.or]) {
          const existingOr = baseWhere[Op.or];
          delete baseWhere[Op.or];
          baseWhere[Op.and] = baseWhere[Op.and] || [];
          baseWhere[Op.and].push({ [Op.or]: existingOr }, zipCodeExactMatch);
        } else {
          baseWhere.zipCode = zipCode;
        }
      }
    }

    // Filter by subCategory - support multiple subcategories (accept both singular and plural)
    const subCategoryParam = req.query.subCategory || req.query.subCategories;
    if (subCategoryParam) {
      const subCategories = Array.isArray(subCategoryParam) ? subCategoryParam : subCategoryParam.split(',').filter(s => s);
      if (subCategories.length > 0) {
        baseWhere.subCategoryId = { [Op.in]: subCategories.map(s => parseInt(s)) };
      }
    }

    // Filter by rating - show businesses with rating >= selected value
    // If user selects 3 stars, show all businesses with 3+ stars
    if (req.query.ratings) {
      const ratings = Array.isArray(req.query.ratings) ? req.query.ratings : [req.query.ratings];
      if (ratings.length > 0) {
        // Get the minimum rating from selected ratings
        const minRating = Math.min(...ratings.map(r => parseFloat(r)));
        baseWhere.ratingAverage = { [Op.gte]: minRating };
      }
    } else if (req.query.minRating) {
      // Legacy support for single minRating
      baseWhere.ratingAverage = { [Op.gte]: parseFloat(req.query.minRating) };
    }

    // Featured only
    if (req.query.featured === 'true') {
      baseWhere.isFeatured = true;
    }

    // Filter by ownerId (for viewing a specific user's businesses)
    if (req.query.ownerId) {
      const ownerId = parseInt(req.query.ownerId);
      if (!isNaN(ownerId)) {
        baseWhere.ownerId = ownerId;
      }
    }

    // Apply zip code filter if it was set earlier
    console.log(`🔍 Checking zipCodeFilter:`, zipCodeFilter ? 'EXISTS' : 'NULL/UNDEFINED');
    if (zipCodeFilter) {
      console.log(`📋 Applying zip code filter to baseWhere`);
      console.log(`📋 baseWhere before zip filter:`, JSON.stringify(baseWhere, null, 2));
      console.log(`📋 zipCodeFilter to apply:`, JSON.stringify(zipCodeFilter, null, 2));
      
      // Check if baseWhere has any conditions
      const hasConditions = Object.keys(baseWhere).length > 0 || baseWhere[Op.or] || baseWhere[Op.and];
      console.log(`📋 hasConditions:`, hasConditions);
      
      if (hasConditions) {
        // Combine existing conditions with zip code filter using Op.and
        if (baseWhere[Op.and]) {
          // Already have Op.and, just add to it
          console.log(`📋 Adding zipCodeFilter to existing Op.and array`);
          baseWhere[Op.and].push(zipCodeFilter);
        } else if (baseWhere[Op.or]) {
          // Have Op.or, need to wrap both in Op.and
          console.log(`📋 Wrapping existing Op.or with zipCodeFilter in Op.and`);
          const existingOr = baseWhere[Op.or];
          delete baseWhere[Op.or];
          baseWhere[Op.and] = [{ [Op.or]: existingOr }, zipCodeFilter];
        } else {
          // Have simple conditions, wrap them with zip filter in Op.and
          console.log(`📋 Wrapping simple conditions with zipCodeFilter in Op.and`);
          const existingConditions = { ...baseWhere };
          Object.keys(baseWhere).forEach(key => delete baseWhere[key]);
          baseWhere[Op.and] = [existingConditions, zipCodeFilter];
        }
      } else {
        // No existing conditions, just use zip code filter directly
        console.log(`📋 No existing conditions, using zipCodeFilter directly`);
        // Copy the entire zipCodeFilter structure
        Object.assign(baseWhere, zipCodeFilter);
      }
      
      console.log(`📋 baseWhere after zip filter:`, JSON.stringify(baseWhere, null, 2));
      console.log(`📋 baseWhere keys after zip filter:`, Object.keys(baseWhere));
    } else {
      console.warn(`⚠️  zipCodeFilter is null/undefined! Cannot apply zip code filter.`);
    }

    // Build final where clause
    let whereClause;
    const statusFilters = { isActive: true, isPublic: true };

    // Helper function to merge conditions with status filters
    const mergeWithStatusFilters = (conditions) => {
      if (conditions[Op.and]) {
        // If we have Op.and, add status filters to the array
        return {
          [Op.and]: [...conditions[Op.and], statusFilters]
        };
      } else if (conditions[Op.or]) {
        // If we have Op.or, combine with status using Op.and
        return {
          [Op.and]: [
            { [Op.or]: conditions[Op.or] },
            statusFilters
          ]
        };
      } else {
        // No special operators, just merge
        return { ...conditions, ...statusFilters };
      }
    };

    if (req.query.ownerId) {
      // If filtering by ownerId, show businesses for that owner (respect publicOnly flag)
      if (req.query.publicOnly === 'true') {
        whereClause = mergeWithStatusFilters(baseWhere);
      } else {
        // Show all businesses for that owner regardless of status
        whereClause = baseWhere;
      }
    } else if (isBusinessOwner && !req.query.publicOnly) {
      // For business owners/admins: show all their businesses (any status) OR active public businesses
      const ownerCondition = { ...baseWhere, ownerId: req.user.id };
      const publicCondition = mergeWithStatusFilters(baseWhere);
      whereClause = {
        [Op.or]: [ownerCondition, publicCondition]
      };
    } else {
      // For non-business owners or public-only requests: only show active public businesses
      whereClause = mergeWithStatusFilters(baseWhere);
    }

    // Safety check: if zip code was provided but baseWhere is empty, add exact zip match
    if (req.query.zipCode && Object.keys(baseWhere).length === 0) {
      console.warn(`⚠️  baseWhere is empty but zipCode was provided! Adding exact zip match as fallback.`);
      const zipCode = Array.isArray(req.query.zipCode) ? req.query.zipCode[0] : req.query.zipCode;
      baseWhere.zipCode = zipCode;
    }

    // Log the where clause for debugging
    if (req.query.zipCode) {
      console.log(`📋 baseWhere before merge:`, JSON.stringify(baseWhere, null, 2));
      console.log(`📋 Final WHERE clause:`, JSON.stringify(whereClause, null, 2));
      console.log(`📋 whereClause keys:`, Object.keys(whereClause));
      console.log(`📋 whereClause type:`, typeof whereClause);
    }

    let { count, rows: businesses } = await Business.findAndCountAll({
      where: whereClause,
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'icon'] },
        { model: User, as: 'owner', attributes: ['id', 'name', 'email', 'avatar'] }
      ],
      order: buildOrderFromQuery(req.query.sort),
      limit: req.query.zipCode && req.zipCoordinates ? 200 : limit, // Get more results for radius filtering
      offset: req.query.zipCode && req.zipCoordinates ? 0 : offset // Don't paginate before radius filter
    });

    console.log(`📊 Database query returned ${businesses.length} businesses (total count: ${count})`);
    
    // Log sample businesses for debugging
    if (businesses.length > 0 && req.query.zipCode) {
      const sample = businesses[0].toJSON();
      console.log(`   Sample business:`, {
        id: sample.id,
        name: sample.name,
        zipCode: sample.zipCode,
        latitude: sample.latitude,
        longitude: sample.longitude,
        categoryId: sample.categoryId
      });
    }

    // If radius search was used, filter by exact distance and add distance to results
    if (req.zipCoordinates && businesses.length > 0) {
      const zipLat = req.zipCoordinates.lat;
      const zipLng = req.zipCoordinates.lng;
      const radiusMiles = req.radiusMiles;
      const zipCode = Array.isArray(req.query.zipCode) ? req.query.zipCode[0] : req.query.zipCode;

      console.log(`📊 Processing ${businesses.length} businesses for radius search (${radiusMiles} miles)`);
      console.log(`   Center: lat=${zipLat}, lng=${zipLng}`);

      // Calculate distance for each business and filter
      let businessesWithCoordinates = 0;
      let businessesWithoutCoordinates = 0;
      let businessesInRadius = 0;
      let businessesExactZip = 0;

      const businessesWithDistance = businesses
        .map(business => {
          const businessData = business.toJSON();
          
          // If business has coordinates, calculate distance
          if (business.latitude != null && business.longitude != null) {
            const businessLat = parseFloat(business.latitude);
            const businessLng = parseFloat(business.longitude);
            
            // Validate coordinates
            if (isNaN(businessLat) || isNaN(businessLng)) {
              // Invalid coordinates but exact zip match - include it
              if (business.zipCode === zipCode) {
                businessesExactZip++;
                return {
                  ...businessData,
                  distance: null // No distance available
                };
              }
              return null;
            }

            businessesWithCoordinates++;
            const distance = calculateDistance(
              zipLat,
              zipLng,
              businessLat,
              businessLng
            );

            // Include businesses within radius OR exact zip match
            if (distance <= radiusMiles || business.zipCode === zipCode) {
              if (distance <= radiusMiles) {
                businessesInRadius++;
              } else {
                businessesExactZip++;
              }
              return {
                ...businessData,
                distance: distance <= radiusMiles ? parseFloat(distance.toFixed(2)) : null
              };
            }
            
            // Outside radius and not exact zip match - exclude
            return null;
          } else {
            // Business has no coordinates - include if exact zip code match
            businessesWithoutCoordinates++;
            if (business.zipCode === zipCode) {
              businessesExactZip++;
              return {
                ...businessData,
                distance: null // No distance available
              };
            }
            return null;
          }
        })
        .filter(business => business !== null) // Remove null entries
        .sort((a, b) => {
          // Sort: businesses with distance first (by distance), then businesses without distance
          if (a.distance !== null && b.distance !== null) {
            return a.distance - b.distance; // Sort by distance (closest first)
          } else if (a.distance !== null) {
            return -1; // Businesses with distance come first
          } else if (b.distance !== null) {
            return 1;
          }
          return 0; // Both have no distance, maintain order
        });

      console.log(`✅ Found ${businessesWithDistance.length} businesses:`);
      console.log(`   - ${businessesWithCoordinates} with coordinates`);
      console.log(`   - ${businessesWithoutCoordinates} without coordinates`);
      console.log(`   - ${businessesInRadius} within ${radiusMiles} miles`);
      console.log(`   - ${businessesExactZip} with exact zip match`);

      // If no businesses found with radius search, log detailed info
      if (businessesWithDistance.length === 0) {
        console.warn(`⚠️  No businesses found with radius search after filtering`);
        console.warn(`   Original businesses from DB: ${businesses.length}`);
        console.warn(`   Businesses with coordinates: ${businessesWithCoordinates}`);
        console.warn(`   Businesses without coordinates: ${businessesWithoutCoordinates}`);
      } else {
        // Apply pagination after radius filtering
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedBusinesses = businessesWithDistance.slice(startIndex, endIndex);

        // Update businesses array and count
        businesses = paginatedBusinesses;
        count = businessesWithDistance.length;
      }
    } else if (req.query.zipCode) {
      // No radius search but zip code provided - log results
      console.log(`📊 Found ${businesses.length} businesses with exact zip code match`);
    }

    // Final logging
    if (req.query.zipCode) {
      console.log(`✅ Final response: ${businesses.length} businesses returned`);
      if (businesses.length === 0) {
        console.warn(`⚠️  No businesses found! Check:`);
        console.warn(`   1. Do businesses exist with zipCode="${req.query.zipCode}"?`);
        console.warn(`   2. Do businesses have coordinates within 20 miles?`);
        console.warn(`   3. Are businesses active and public?`);
        console.warn(`   4. Do businesses match the category filter?`);
      }
    }

    res.json({
      success: true,
      count: businesses.length,
      total: count,
      page,
      pages: Math.ceil(count / limit),
      businesses
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/businesses/filter-options
// @desc    Get filter options (cities, states, categories, etc.)
// @access  Public
router.get('/filter-options', async (req, res) => {
  try {
    // Base where clause for filtering
    const baseWhere = {
      isActive: true,
      isPublic: true
    };

    // If categoryId is provided, filter by category
    if (req.query.categoryId) {
      const categoryId = parseInt(req.query.categoryId);
      if (!isNaN(categoryId)) {
        baseWhere.categoryId = categoryId;
      }
    }

    // Get unique cities using Sequelize.literal for DISTINCT
    // Only show locations from active, public businesses (optionally filtered by category)
    const cityResults = await Business.findAll({
      attributes: [
        [sequelize.fn('DISTINCT', sequelize.col('city')), 'city']
      ],
      where: {
        ...baseWhere,
        city: { [Op.ne]: null }
      },
      order: [[sequelize.literal('city'), 'ASC']],
      raw: true
    });

    // Get unique states
    const stateResults = await Business.findAll({
      attributes: [
        [sequelize.fn('DISTINCT', sequelize.col('state')), 'state']
      ],
      where: {
        ...baseWhere,
        state: { [Op.ne]: null }
      },
      order: [[sequelize.literal('state'), 'ASC']],
      raw: true
    });

    // Get unique zip codes
    const zipResults = await Business.findAll({
      attributes: [
        [sequelize.fn('DISTINCT', sequelize.col('zipCode')), 'zipCode']
      ],
      where: {
        ...baseWhere,
        zipCode: { [Op.ne]: null }
      },
      order: [[sequelize.literal('zipCode'), 'ASC']],
      raw: true
    });

    // Get cities by state for hierarchical filtering
    const citiesByState = await Business.findAll({
      attributes: ['state', 'city'],
      where: {
        ...baseWhere,
        city: { [Op.ne]: null },
        state: { [Op.ne]: null }
      },
      group: ['state', 'city'],
      order: [['state', 'ASC'], ['city', 'ASC']],
      raw: true
    });

    // Organize cities by state
    const statesWithCities = {};
    citiesByState.forEach(item => {
      if (!statesWithCities[item.state]) {
        statesWithCities[item.state] = [];
      }
      if (item.city && !statesWithCities[item.state].includes(item.city)) {
        statesWithCities[item.state].push(item.city);
      }
    });

    // Extract unique cities and filter out null/empty values
    const uniqueCities = [...new Set(cityResults.map(c => c.city).filter(c => c && c.trim()))].sort();
    const uniqueStates = [...new Set(stateResults.map(s => s.state).filter(s => s && s.trim()))].sort();
    const uniqueZipCodes = [...new Set(zipResults.map(z => z.zipCode).filter(z => z && z.trim()))].sort();

    // Get only categories that have active, public businesses
    // (Don't filter by categoryId here since we want all categories)
    const categoriesWithBusinesses = await Business.findAll({
      attributes: ['categoryId'],
      where: {
        categoryId: { [Op.ne]: null },
        isActive: true,
        isPublic: true
      },
      group: ['categoryId'],
      raw: true
    });

    const categoryIds = [...new Set(categoriesWithBusinesses.map(c => c.categoryId))];

    const categories = categoryIds.length > 0 ? await Category.findAll({
      where: {
        id: { [Op.in]: categoryIds },
        isActive: true
      },
      attributes: ['id', 'name', 'slug', 'icon'],
      order: [['name', 'ASC']]
    }) : [];

    res.json({
      success: true,
      cities: uniqueCities,
      states: uniqueStates,
      zipCodes: uniqueZipCodes,
      statesWithCities,
      categories
    });
  } catch (error) {
    console.log('Get filter options error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/businesses/my-businesses
// @desc    Get current user's businesses
// @access  Private
router.get('/my-businesses', protect, async (req, res) => {
  const startTime = Date.now();
  try {
    console.log(`[my-businesses] Fetching businesses for user ID: ${req.user.id}`);

    // Use a simpler query first - get businesses without includes to test
    const businesses = await Business.findAll({
      where: { ownerId: req.user.id },
      attributes: [
        'id', 'name', 'slug', 'description', 'categoryId', 'ownerId',
        'address', 'city', 'state', 'zipCode', 'phone', 'email', 'website',
        'ratingAverage', 'ratingCount', 'subCategoryId', 'logo', 'images',
        'services', 'isVerified', 'isActive', 'isFeatured', 'isPublic', 'createdAt', 'updatedAt'
      ],
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug', 'icon'],
          required: false // LEFT JOIN instead of INNER JOIN
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 100 // Add limit to prevent huge queries
    });

    const queryTime = Date.now() - startTime;
    console.log(`[my-businesses] Found ${businesses.length} businesses for user ${req.user.id} (took ${queryTime}ms)`);

    res.json({
      success: true,
      businesses
    });
  } catch (error) {
    const queryTime = Date.now() - startTime;
    console.error(`[my-businesses] Error after ${queryTime}ms:`, error.message);
    console.error('Error stack:', error.stack);

    // Don't let the error hang the server
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
});

// @route   POST /api/businesses
// @desc    Create a business (allows anonymous users)
// @access  Public (optional auth)
router.post('/', optionalAuth, async (req, res) => {
  try {
    // Validate category exists
    if (!req.body.categoryId) {
      return res.status(400).json({
        success: false,
        error: 'Please select a valid category'
      });
    }

    const category = await Category.findByPk(req.body.categoryId);
    if (!category) {
      return res.status(400).json({
        success: false,
        error: 'Selected category does not exist'
      });
    }

    // Validate required fields
    if (!req.body.name || !req.body.description) {
      return res.status(400).json({
        success: false,
        error: 'Business name and description are required'
      });
    }

    if (!req.body.address || !req.body.city || !req.body.state) {
      return res.status(400).json({
        success: false,
        error: 'Address, city, and state are required'
      });
    }

    if (!req.body.phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // Generate slug from business name
    const generateSlug = (name) => {
      return name
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim() + '-' + Date.now();
    };

    const slug = generateSlug(req.body.name);

    // Create business (ownerId is optional for anonymous users)
    const business = await Business.create({
      name: req.body.name,
      slug: slug,
      description: req.body.description,
      categoryId: req.body.categoryId,
      ownerId: req.user ? req.user.id : null, // Allow null for anonymous users
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      zipCode: req.body.zipCode || null,
      country: req.body.country || 'USA',
      phone: req.body.phone,
      email: req.body.email || null,
      website: req.body.website || null,
      hours: req.body.hours || null,
      socialLinks: req.body.socialLinks || null,
      isActive: false, // New businesses need approval
      isVerified: false,
      tags: req.body.tags || null,
      latitude: req.body.latitude || null,
      longitude: req.body.longitude || null
    });

    // Update user role to business_owner if user is logged in (but don't change admin role)
    if (req.user) {
      if (req.user.role !== 'admin') {
        await User.update(
          { role: 'business_owner', businessId: business.id },
          { where: { id: req.user.id } }
        );
      } else {
        // Admin adding a business - just link it but keep admin role
        await User.update(
          { businessId: business.id },
          { where: { id: req.user.id } }
        );
      }

      // Log activity
      await logActivity({
        type: 'business_submitted',
        description: `New business "${business.name}" was submitted for approval`,
        userId: req.user.id,
        metadata: { businessName: business.name, ownerName: req.user.name, businessId: business.id }
      });
    }

    // Send notification email to admin
    const sendEmail = require('../utils/sendEmail');
    const ownerInfo = req.user ? `${req.user.name} (${req.user.email})` : 'Anonymous User';
    await sendEmail({
      to: process.env.ADMIN_EMAIL || 'admin@citylocal101.com',
      subject: `New Business Listing Submission: ${business.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: #667eea; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 24px;">New Business Submission</h2>
            <p style="margin: 10px 0 0 0; font-size: 14px;">CityLocal 101 Admin Panel</p>
          </div>
          <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <p style="color: #333; margin-bottom: 20px;">A new business listing has been submitted and is awaiting approval:</p>
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 15px 0; color: #2c3e50;">${business.name}</h3>
              <p style="margin: 5px 0; color: #555;"><strong>Category:</strong> ${category.name}</p>
              <p style="margin: 5px 0; color: #555;"><strong>Location:</strong> ${business.city}, ${business.state}</p>
              <p style="margin: 5px 0; color: #555;"><strong>Owner:</strong> ${ownerInfo}</p>
              <p style="margin: 5px 0; color: #555;"><strong>Phone:</strong> ${business.phone}</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/businesses" 
                 style="display: inline-block; background: #667eea; color: white; 
                        padding: 12px 30px; text-decoration: none; border-radius: 8px; 
                        font-weight: 600;">
                Review in Admin Panel
              </a>
            </div>
          </div>
        </div>
      `
    }).catch(() => { });

    res.status(201).json({
      success: true,
      message: req.user
        ? 'Business created successfully. It will be reviewed and approved soon.'
        : 'Business created successfully. It will be reviewed and approved soon. Create an account to manage your business listing.',
      business,
      requiresAuth: !req.user // Indicate if user needs to create account
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create business'
    });
  }
});

// @route   GET /api/businesses/profiles
// @desc    Get all business profiles (users with public businesses)
// @access  Public
router.get('/profiles', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;

    // Get all users who have public businesses
    const { Business, User } = require('../models');
    const { Op } = require('sequelize');

    // Find all businesses that are public and active
    const publicBusinesses = await Business.findAll({
      where: {
        isPublic: true,
        isActive: true,
        ownerId: { [Op.ne]: null }
      },
      attributes: ['ownerId'],
      raw: true
    });

    const ownerIds = [...new Set(publicBusinesses.map(b => b.ownerId).filter(id => id !== null))];

    if (ownerIds.length === 0) {
      return res.json({
        success: true,
        count: 0,
        total: 0,
        page,
        pages: 0,
        profiles: []
      });
    }

    // Get users with their business count (exclude admin users)
    const { count, rows: users } = await User.findAndCountAll({
      where: {
        id: { [Op.in]: ownerIds },
        role: { [Op.ne]: 'admin' } // Exclude admin users
      },
      attributes: ['id', 'name', 'email', 'phone', 'avatar', 'createdAt'],
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    // Get business count for each user
    const profiles = await Promise.all(
      users.map(async (user) => {
        const businessCount = await Business.count({
          where: {
            ownerId: user.id,
            isPublic: true,
            isActive: true
          }
        });
        return {
          ...user.toJSON(),
          businessCount
        };
      })
    );

    res.json({
      success: true,
      count: profiles.length,
      total: count,
      page,
      pages: Math.ceil(count / limit),
      profiles
    });
  } catch (error) {
    console.error('Get profiles error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/businesses/:id
// @desc    Get single business
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const business = await Business.findByPk(req.params.id, {
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'icon'] },
        { model: User, as: 'owner', attributes: ['id', 'name', 'email'] }
      ],
      attributes: {
        include: ['latitude', 'longitude', 'services'] // Explicitly include latitude, longitude, and services
      }
    });

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Increment views
    await business.incrementViews();

    // Convert latitude and longitude to numbers if they exist (they come as Decimal from DB)
    const businessData = business.toJSON();
    if (businessData.latitude !== null && businessData.latitude !== undefined) {
      businessData.latitude = parseFloat(businessData.latitude);
    }
    if (businessData.longitude !== null && businessData.longitude !== undefined) {
      businessData.longitude = parseFloat(businessData.longitude);
    }

    res.json({
      success: true,
      business: businessData
    });
  } catch (error) {
    console.error('Get business detail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/businesses/link-to-account
// @desc    Link anonymous businesses to user account
// @access  Private
router.post('/link-to-account', protect, async (req, res) => {
  try {
    const { businessIds } = req.body;

    if (!businessIds || !Array.isArray(businessIds) || businessIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide business IDs to link'
      });
    }

    // Find businesses that don't have an owner and belong to the user's email/phone
    const businesses = await Business.findAll({
      where: {
        id: { [Op.in]: businessIds },
        ownerId: null // Only link businesses without owners
      }
    });

    if (businesses.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No anonymous businesses found to link'
      });
    }

    // Link businesses to user account
    await Business.update(
      { ownerId: req.user.id },
      { where: { id: { [Op.in]: businesses.map(b => b.id) } } }
    );

    // Update user role to business_owner if not admin
    if (req.user.role !== 'admin' && req.user.role !== 'business_owner') {
      await User.update(
        { role: 'business_owner' },
        { where: { id: req.user.id } }
      );
    }

    // Log activity
    await logActivity({
      type: 'businesses_linked',
      description: `${businesses.length} business(es) linked to user account`,
      userId: req.user.id,
      metadata: { businessIds: businesses.map(b => b.id), businessNames: businesses.map(b => b.name) }
    });

    res.json({
      success: true,
      message: `Successfully linked ${businesses.length} business(es) to your account`,
      businessesLinked: businesses.length
    });
  } catch (error) {
    console.log('Link businesses error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to link businesses'
    });
  }
});

// @route   PUT /api/businesses/:id
// @desc    Update business
// @access  Private (Owner or Admin)
router.put('/:id', protect, async (req, res) => {
  try {
    const business = await Business.findByPk(req.params.id);

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Check ownership
    if (business.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update this business' });
    }

    // Prepare update data
    const updateData = { ...req.body };

    // Validate services field if provided (should be an array of strings)
    if (updateData.services !== undefined) {
      if (!Array.isArray(updateData.services)) {
        return res.status(400).json({ error: 'Services must be an array' });
      }
      // Ensure all services are strings
      updateData.services = updateData.services.filter(service => 
        typeof service === 'string' && service.trim().length > 0
      ).map(service => service.trim());
    }

    // If business was rejected and owner is updating, clear rejection fields and set to pending
    if (business.rejectionReason && business.ownerId === req.user.id && req.user.role !== 'admin') {
      updateData.rejectionReason = null;
      updateData.rejectedAt = null;
      updateData.isActive = false; // Set back to pending for review

      // Log activity for resubmission
      await logActivity({
        type: 'business_resubmitted',
        description: `Business "${business.name}" was resubmitted for review after rejection`,
        userId: req.user.id,
        metadata: { businessName: business.name, businessId: business.id }
      });
    }

    // Update business
    await business.update(updateData);

    // Reload business with associations
    const updatedBusiness = await Business.findByPk(business.id, {
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'icon'] },
        { model: User, as: 'owner', attributes: ['id', 'name', 'email'] }
      ],
      attributes: {
        include: ['services'] // Ensure services field is included in response
      }
    });

    res.json({
      success: true,
      message: business.rejectionReason && business.ownerId === req.user.id
        ? 'Business updated and resubmitted for review'
        : 'Business updated successfully',
      business: updatedBusiness
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/businesses/:id
// @desc    Delete business
// @access  Private (Owner or Admin)
router.delete('/:id', protect, async (req, res) => {
  try {
    const business = await Business.findByPk(req.params.id);

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Check ownership
    if (business.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this business' });
    }

    await business.destroy();

    res.json({
      success: true,
      message: 'Business deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/businesses/geocode/:zipCode
// @desc    Geocode a zip code to get latitude and longitude
// @access  Public
router.get('/geocode/:zipCode', async (req, res) => {
  try {
    const { zipCode } = req.params;
    
    if (!zipCode) {
      return res.status(400).json({
        success: false,
        error: 'Zip code is required'
      });
    }
    
    // Clean zip code
    const cleanZipCode = zipCode.replace(/[\s\-]/g, '');
    if (cleanZipCode.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Invalid zip code format'
      });
    }
    
    const coordinates = await getCoordinatesFromZipCode(cleanZipCode);
    
    if (coordinates && !isNaN(coordinates.lat) && !isNaN(coordinates.lng)) {
      return res.json({
        success: true,
        coordinates: {
          latitude: coordinates.lat,
          longitude: coordinates.lng
        }
      });
    } else {
      return res.status(404).json({
        success: false,
        error: 'Could not geocode zip code'
      });
    }
  } catch (error) {
    console.error('Error geocoding zip code:', error);
    return res.status(500).json({
      success: false,
      error: 'Error geocoding zip code'
    });
  }
});

// @route   POST /api/businesses/:id/contact
// @desc    Send contact message to admin (regarding a business)
// @access  Public
router.post('/:id/contact', async (req, res) => {
  try {
    const business = await Business.findByPk(req.params.id);

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const { name, email, phone, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    // Create subject with business information
    const subject = `Message about ${business.name} - ${business.city}, ${business.state}`;

    // Save to Contact model for admin management
    const contact = await Contact.create({
      name,
      email,
      phone: phone || null,
      subject,
      message,
      businessId: business.id,
      status: 'new'
    });

    // Send email to admin
    const sendEmail = require('../utils/sendEmail');
    await sendEmail({
      to: process.env.ADMIN_EMAIL || 'admin@citylocal101.com',
      subject: `New Message About Business: ${business.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: #4A90E2; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 24px;">New Business Inquiry</h2>
            <p style="margin: 10px 0 0 0; font-size: 14px;">CityLocal 101</p>
          </div>
          <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="background-color: #f0f7ff; padding: 15px; border-radius: 4px; margin-bottom: 20px; border-left: 4px solid #4A90E2;">
              <strong style="color: #333; display: block; margin-bottom: 5px;">Business:</strong>
              <span style="color: #666; font-size: 16px;">${business.name}</span>
              <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">${business.address}, ${business.city}, ${business.state}</p>
            </div>
            <p style="color: #333; margin-bottom: 20px;">You have received a new inquiry about this business:</p>
            <div style="margin-bottom: 20px;">
              <strong style="color: #333; display: block; margin-bottom: 5px;">Name:</strong>
              <span style="color: #666;">${name}</span>
            </div>
            <div style="margin-bottom: 20px;">
              <strong style="color: #333; display: block; margin-bottom: 5px;">Email:</strong>
              <span style="color: #666;">${email}</span>
            </div>
            ${phone ? `
            <div style="margin-bottom: 20px;">
              <strong style="color: #333; display: block; margin-bottom: 5px;">Phone:</strong>
              <span style="color: #666;">${phone}</span>
            </div>
            ` : ''}
            <div style="margin-bottom: 20px;">
              <strong style="color: #333; display: block; margin-bottom: 5px;">Message:</strong>
              <div style="color: #666; background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin-top: 10px; line-height: 1.6;">
                ${message.replace(/\n/g, '<br>')}
              </div>
            </div>
            <p style="color: #7f8c8d; font-size: 14px; margin-top: 30px;">
              This message has been saved to the admin panel for your review.
            </p>
          </div>
        </div>
      `,
      message: `
New business inquiry from CityLocal 101:

Business: ${business.name}
Address: ${business.address}, ${business.city}, ${business.state}

From:
Name: ${name}
Email: ${email}
${phone ? `Phone: ${phone}` : ''}

Message:
${message}

---
Sent from CityLocal 101 Support System
      `
    }).catch(() => {});

    // Log activity
    await logActivity({
      type: 'business_contact',
      description: `Contact inquiry about ${business.name} from ${name}`,
      metadata: { businessId: business.id, businessName: business.name, contactId: contact.id, senderEmail: email }
    });

    res.json({
      success: true,
      message: 'Your message has been sent to the administrator.'
    });
  } catch (error) {
    console.error('Business contact error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// @route   POST /api/businesses/:id/claim
// @desc    Claim a business listing
// @access  Private
router.post('/:id/claim', protect, async (req, res) => {
  try {
    const business = await Business.findByPk(req.params.id);

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    if (business.ownerId) {
      return res.status(400).json({ error: 'This business has already been claimed' });
    }

    // Update business with claim info
    await business.update({
      ownerId: req.user.id,
      claimedAt: new Date(),
      isActive: false // Requires admin approval
    });

    // Update user role (but don't change admin role)
    if (req.user.role !== 'admin') {
      await User.update(
        { role: 'business_owner', businessId: business.id },
        { where: { id: req.user.id } }
      );
    } else {
      // Admin claiming a business - just link it but keep admin role
      await User.update(
        { businessId: business.id },
        { where: { id: req.user.id } }
      );
    }

    // Log activity
    await logActivity({
      type: 'business_claimed',
      description: `Business "${business.name}" was claimed by ${req.user.name}`,
      userId: req.user.id,
      metadata: { businessName: business.name, businessId: business.id, claimerName: req.user.name }
    });

    // Send email to admin
    const sendEmail = require('../utils/sendEmail');
    await sendEmail({
      to: process.env.ADMIN_EMAIL || 'admin@citylocal101.com',
      subject: `Business Claim Request: ${business.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Business Claim Request</h2>
          <p><strong>${req.user.name}</strong> (${req.user.email}) has claimed the business listing:</p>
          <h3>${business.name}</h3>
          <p>${business.address}, ${business.city}, ${business.state}</p>
          <p>Please review and approve this claim in the admin dashboard.</p>
        </div>
      `
    });

    res.json({
      success: true,
      message: 'Claim request submitted successfully. An admin will review it shortly.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to claim business' });
  }
});

// @route   POST /api/businesses/:id/request-verification
// @desc    Request business verification
// @access  Private (Owner only)
router.post('/:id/request-verification', protect, async (req, res) => {
  try {
    const { method, data } = req.body;
    const business = await Business.findByPk(req.params.id);

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    if (business.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (business.isVerified) {
      return res.status(400).json({ error: 'Business is already verified' });
    }

    const validMethods = ['google', 'facebook', 'document', 'phone'];
    if (!validMethods.includes(method)) {
      return res.status(400).json({ error: 'Invalid verification method' });
    }

    await business.update({
      verificationMethod: method,
      verificationData: data || {},
      verificationStatus: 'pending',
      verificationRequestedAt: new Date()
    });

    // Send notification to admin
    const sendEmail = require('../utils/sendEmail');
    await sendEmail({
      to: process.env.ADMIN_EMAIL || 'admin@citylocal101.com',
      subject: `Business Verification Request - ${business.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>New Business Verification Request</h2>
          <p><strong>Business:</strong> ${business.name}</p>
          <p><strong>Method:</strong> ${method}</p>
          <p><strong>Owner:</strong> ${req.user.name} (${req.user.email})</p>
          <p>Please review this verification request in the admin panel.</p>
        </div>
      `
    }).catch(() => { });

    await logActivity({
      type: 'verification_requested',
      description: `Verification requested for "${business.name}" via ${method}`,
      userId: req.user.id,
      metadata: { businessId: business.id, method }
    });

    res.json({
      success: true,
      message: 'Verification request submitted. You will be notified once reviewed.',
      business
    });
  } catch (error) {
    console.log('Request verification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/businesses/:id/resubmit
// @desc    Resubmit rejected business for review
// @access  Private (Owner only)
router.post('/:id/resubmit', protect, async (req, res) => {
  try {
    const business = await Business.findByPk(req.params.id);

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Check ownership
    if (business.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to resubmit this business' });
    }

    // Check if business is actually rejected
    if (!business.rejectedAt) {
      return res.status(400).json({ error: 'Business is not rejected' });
    }

    // Reset rejection status
    await business.update({
      isActive: false,
      approvedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      resubmittedAt: new Date()
    });

    // Log activity
    await logActivity({
      type: 'business_resubmitted',
      description: `Business "${business.name}" was resubmitted for review`,
      userId: req.user.id,
      metadata: { businessName: business.name, businessId: business.id }
    });

    res.json({
      success: true,
      message: 'Business resubmitted successfully. Awaiting admin approval.',
      business
    });
  } catch (error) {
    console.log('Resubmit business error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


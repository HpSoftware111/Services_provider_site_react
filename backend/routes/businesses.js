const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { Business, Category, User } = require('../models');
const { protect, optionalAuth } = require('../middleware/auth');
const logActivity = require('../utils/logActivity');

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

    // Filter by zip code
    if (req.query.zipCode) {
      const zipCodes = Array.isArray(req.query.zipCode) ? req.query.zipCode : [req.query.zipCode];
      if (zipCodes.length > 0) {
        baseWhere.zipCode = { [Op.in]: zipCodes };
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

    const { count, rows: businesses } = await Business.findAndCountAll({
      where: whereClause,
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'icon'] },
        { model: User, as: 'owner', attributes: ['id', 'name', 'email', 'avatar'] }
      ],
      order: buildOrderFromQuery(req.query.sort),
      limit,
      offset
    });

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
        'isVerified', 'isActive', 'isFeatured', 'isPublic', 'createdAt', 'updatedAt'
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
      tags: req.body.tags || null
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
        include: ['latitude', 'longitude'] // Explicitly include latitude and longitude
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
      ]
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

// @route   POST /api/businesses/:id/contact
// @desc    Send contact message to business
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

    // Send email to business
    const sendEmail = require('../utils/sendEmail');
    await sendEmail({
      to: business.email || process.env.ADMIN_EMAIL,
      subject: `New inquiry for ${business.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: #667eea; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 24px;">New Customer Inquiry</h2>
            <p style="margin: 10px 0 0 0; font-size: 14px;">${business.name}</p>
          </div>
          <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <p style="color: #333; margin-bottom: 20px;">You have received a new inquiry from a potential customer:</p>
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
              Please respond to this inquiry as soon as possible.
            </p>
          </div>
        </div>
      `
    });

    // Log activity
    await logActivity({
      type: 'business_contact',
      description: `Contact inquiry sent to ${business.name}`,
      metadata: { businessId: business.id, businessName: business.name, senderEmail: email }
    });

    res.json({
      success: true,
      message: 'Your message has been sent to the business'
    });
  } catch (error) {
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


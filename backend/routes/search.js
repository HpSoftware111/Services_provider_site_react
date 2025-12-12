const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Business, Category } = require('../models');

// @route   GET /api/search
// @desc    Search businesses
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { q, category, city, state, minRating, sort } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const where = { isActive: true };

    // Build search conditions
    const searchConditions = [];
    
    // Search by name or description
    if (q) {
      searchConditions.push(
        { name: { [Op.like]: `%${q}%` } },
        { description: { [Op.like]: `%${q}%` } }
      );
    }

    // Filter by category
    if (category) {
      where.categoryId = category;
    }

    // Filter by location - parse city,state format
    let locationCondition = null;
    if (city) {
      const citySearch = city.trim();
      if (citySearch.includes(',')) {
        // Format: "City, State" - split and search both
        const parts = citySearch.split(',').map(p => p.trim()).filter(p => p);
        if (parts.length >= 2) {
          const cityPart = parts[0];
          const statePart = parts.slice(1).join(' ').trim();
          // Search for: (city AND state) OR city OR state
          locationCondition = {
            [Op.or]: [
              {
                [Op.and]: [
                  { city: { [Op.like]: `%${cityPart}%` } },
                  { state: { [Op.like]: `%${statePart}%` } }
                ]
              },
              { city: { [Op.like]: `%${cityPart}%` } },
              { state: { [Op.like]: `%${statePart}%` } }
            ]
          };
        } else {
          // Single part after comma
          locationCondition = {
            [Op.or]: [
              { city: { [Op.like]: `%${parts[0]}%` } },
              { state: { [Op.like]: `%${parts[0]}%` } }
            ]
          };
        }
      } else {
        // No comma - search both city and state
        locationCondition = {
          [Op.or]: [
            { city: { [Op.like]: `%${citySearch}%` } },
            { state: { [Op.like]: `%${citySearch}%` } }
          ]
        };
      }
    }
    if (state && !city) {
      // Only state provided (not combined with city)
      locationCondition = {
        state: { [Op.like]: `%${state}%` }
      };
    }

    // Combine search and location conditions
    if (searchConditions.length > 0 && locationCondition) {
      // Both search and location - combine with AND
      where[Op.and] = [
        { [Op.or]: searchConditions },
        locationCondition
      ];
    } else if (searchConditions.length > 0) {
      // Only search
      where[Op.or] = searchConditions;
    } else if (locationCondition) {
      // Only location - merge into where
      if (locationCondition[Op.or]) {
        where[Op.or] = locationCondition[Op.or];
      } else {
        Object.assign(where, locationCondition);
      }
    }

    // Filter by rating
    if (minRating) {
      where.ratingAverage = { [Op.gte]: parseFloat(minRating) };
    }

    // Sorting
    let order = [['createdAt', 'DESC']];
    if (sort === 'rating') {
      order = [['ratingAverage', 'DESC'], ['ratingCount', 'DESC']];
    } else if (sort === 'name') {
      order = [['name', 'ASC']];
    } else if (sort === 'views') {
      order = [['views', 'DESC']];
    }

    const { count, rows: businesses } = await Business.findAndCountAll({
      where,
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'icon'] }
      ],
      order,
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
    console.log('Search error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/search/suggestions
// @desc    Get search suggestions
// @access  Public
router.get('/suggestions', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ success: true, suggestions: [] });
    }

    // Search in business names
    const businesses = await Business.findAll({
      where: {
        name: { [Op.like]: `%${q}%` },
        isActive: true
      },
      attributes: ['id', 'name', 'slug', 'city', 'state'],
      limit: 8
    });

    // Search in categories
    const categories = await Category.findAll({
      where: {
        name: { [Op.like]: `%${q}%` },
        isActive: true
      },
      attributes: ['id', 'name', 'slug', 'icon'],
      limit: 5
    });

    const suggestions = [
      ...categories.map(cat => ({
        type: 'category',
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        id: cat.id
      })),
      ...businesses.map(biz => ({
        type: 'business',
        name: biz.name,
        slug: biz.slug,
        icon: 'building',
        city: biz.city,
        state: biz.state,
        id: biz.id
      }))
    ];

    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.log('Suggestions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/search/location-suggestions
// @desc    Get location suggestions (cities/states)
// @access  Public
router.get('/location-suggestions', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ success: true, suggestions: [] });
    }

    const searchQuery = q.trim();

    // Get unique city/state combinations
    const businesses = await Business.findAll({
      where: {
        isActive: true,
        [Op.or]: [
          { city: { [Op.like]: `%${searchQuery}%` } },
          { state: { [Op.like]: `%${searchQuery}%` } }
        ]
      },
      attributes: ['city', 'state'],
      limit: 150,
      raw: true
    });

    // Create unique location strings
    const locationMap = new Map();
    
    businesses.forEach(b => {
      if (b.city && b.state) {
        const key = `${b.city}, ${b.state}`.toLowerCase();
        if (!locationMap.has(key)) {
          locationMap.set(key, {
            name: `${b.city}, ${b.state}`,
            city: b.city,
            state: b.state
          });
        }
      }
    });

    // Convert to array and filter/sort
    let locations = Array.from(locationMap.values())
      .filter(loc => {
        const searchLower = searchQuery.toLowerCase();
        return loc.city.toLowerCase().includes(searchLower) || 
               loc.state.toLowerCase().includes(searchLower) ||
               loc.name.toLowerCase().includes(searchLower);
      })
      .sort((a, b) => {
        // Prioritize matches at the start of city name
        const aCityStart = a.city.toLowerCase().startsWith(searchQuery.toLowerCase());
        const bCityStart = b.city.toLowerCase().startsWith(searchQuery.toLowerCase());
        if (aCityStart && !bCityStart) return -1;
        if (!aCityStart && bCityStart) return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 10);

    res.json({
      success: true,
      suggestions: locations.map(loc => ({
        type: 'location',
        name: loc.name,
        city: loc.city,
        state: loc.state
      }))
    });
  } catch (error) {
    console.log('Location suggestions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


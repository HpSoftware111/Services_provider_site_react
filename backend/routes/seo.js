const express = require('express');
const router = express.Router();
const { Category, Business, Review } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Generate slug from text
 */
function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * @route   GET /api/seo/:serviceSlug/:locationType/:locationSlug
 * @desc    Get SEO landing page data for service type in location
 * @access  Public
 * @params  serviceSlug - Category slug (e.g., "electricians")
 * @params  locationType - "city" or "zipcode"
 * @params  locationSlug - City name or ZIP code
 */
router.get('/:serviceSlug/:locationType/:locationSlug', async (req, res) => {
  try {
    const { serviceSlug, locationType, locationSlug } = req.params;

    // Find category by slug
    const category = await Category.findOne({
      where: {
        slug: serviceSlug,
        isActive: true
      }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Service category not found'
      });
    }

    // Parse location
    let location = null;
    let locationQuery = {};

    if (locationType === 'city') {
      // City slug format: "miami-fl" or "miami"
      const cityParts = locationSlug.split('-');
      const cityName = cityParts[0].charAt(0).toUpperCase() + cityParts[0].slice(1);
      const stateCode = cityParts.length > 1 ? cityParts[cityParts.length - 1].toUpperCase() : null;

      locationQuery.city = { [Op.like]: `${cityName}%` };
      if (stateCode && stateCode.length === 2) {
        locationQuery.state = stateCode;
      }

      // Get actual location from database
      const locationData = await Business.findOne({
        where: {
          ...locationQuery,
          isActive: true,
          isPublic: true
        },
        attributes: ['city', 'state', 'zipCode'],
        raw: true
      });

      if (locationData) {
        location = {
          city: locationData.city,
          state: locationData.state,
          zipCode: locationData.zipCode
        };
      } else {
        // Fallback: use parsed values
        location = {
          city: cityName,
          state: stateCode || '',
          zipCode: null
        };
      }
    } else if (locationType === 'zipcode') {
      // ZIP code
      locationQuery.zipCode = locationSlug;

      const locationData = await Business.findOne({
        where: {
          zipCode: locationSlug,
          isActive: true,
          isPublic: true
        },
        attributes: ['city', 'state', 'zipCode'],
        raw: true
      });

      if (locationData) {
        location = locationData;
      } else {
        location = {
          city: '',
          state: '',
          zipCode: locationSlug
        };
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid location type. Use "city" or "zipcode"'
      });
    }

    // Get businesses for this category and location
    const businesses = await Business.findAll({
      where: {
        categoryId: category.id,
        ...locationQuery,
        isActive: true,
        isPublic: true
      },
      attributes: [
        'id', 'name', 'slug', 'description', 'city', 'state', 'zipCode',
        'phone', 'ratingAverage', 'isFeatured', 'address'
      ],
      order: [
        ['isFeatured', 'DESC'],
        ['ratingAverage', 'DESC'],
        ['name', 'ASC']
      ],
      limit: 50
    });

    // Calculate average rating
    const ratings = businesses
      .map(b => parseFloat(b.ratingAverage) || 0)
      .filter(r => r > 0);
    const averageRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0;

    // Get popular locations (cities with most businesses in this category)
    const popularLocations = await Business.findAll({
      attributes: [
        'city',
        'state',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        categoryId: category.id,
        isActive: true,
        isPublic: true,
        city: { [Op.ne]: null }
      },
      group: ['city', 'state'],
      order: [[sequelize.literal('count'), 'DESC']],
      limit: 10,
      raw: true
    });

    const popularLocationsFormatted = popularLocations.map(loc => ({
      name: `${loc.city}, ${loc.state}`,
      slug: generateSlug(`${loc.city}-${loc.state}`)
    }));

    // Get related services (other categories)
    const relatedServices = await Category.findAll({
      where: {
        id: { [Op.ne]: category.id },
        isActive: true
      },
      attributes: ['id', 'name', 'slug'],
      limit: 8,
      order: [['order', 'ASC']]
    });

    // Generate SEO metadata
    const locationName = locationType === 'city'
      ? `${location.city}, ${location.state}`
      : location.zipCode;

    const meta = {
      title: `Best ${category.name} in ${locationName} | Find Local Professionals`,
      description: `Find the best ${category.name.toLowerCase()} services in ${locationName}. Browse verified professionals, read reviews, and get quotes. ${businesses.length} businesses available.`,
      keywords: `${category.name.toLowerCase()}, ${locationName}, local services, professional ${category.name.toLowerCase()}, ${location.city || ''} ${category.name.toLowerCase()}`,
      image: '/logo.png' // You can customize this
    };

    res.json({
      success: true,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description
      },
      location,
      businesses: businesses.map(b => ({
        ...b.toJSON(),
        ratingAverage: parseFloat(b.ratingAverage) || 0
      })),
      averageRating,
      popularLocations: popularLocationsFormatted,
      relatedServices: relatedServices.map(s => ({
        id: s.id,
        name: s.name,
        slug: s.slug
      })),
      meta
    });
  } catch (error) {
    console.error('SEO page error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @route   GET /api/seo/sitemap-data
 * @desc    Get all data needed for sitemap generation
 * @access  Public
 */
router.get('/sitemap-data', async (req, res) => {
  try {
    // Get all active categories
    const categories = await Category.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'slug']
    });

    // Get all unique city/state combinations
    const cities = await Business.findAll({
      attributes: [
        'city',
        'state',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        isActive: true,
        isPublic: true,
        city: { [Op.ne]: null },
        state: { [Op.ne]: null }
      },
      group: ['city', 'state'],
      having: sequelize.literal('count > 0'),
      raw: true
    });

    // Get all unique ZIP codes
    const zipCodes = await Business.findAll({
      attributes: [
        'zipCode',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        isActive: true,
        isPublic: true,
        zipCode: { [Op.ne]: null }
      },
      group: ['zipCode'],
      having: sequelize.literal('count > 0'),
      raw: true
    });

    res.json({
      success: true,
      categories: categories.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug
      })),
      cities: cities.map(c => ({
        city: c.city,
        state: c.state,
        slug: generateSlug(`${c.city}-${c.state}`)
      })),
      zipCodes: zipCodes.map(z => z.zipCode)
    });
  } catch (error) {
    console.error('Sitemap data error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;

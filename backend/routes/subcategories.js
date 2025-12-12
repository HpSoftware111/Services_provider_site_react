const express = require('express');
const router = express.Router();
const { SubCategory, Category, Business } = require('../models');
const { sequelize } = require('../config/database');

// @route   GET /api/subcategories
// @desc    Get all subcategories
// @access  Public
router.get('/', async (req, res) => {
  try {
    const where = { isActive: true };
    
    // Filter by category if provided
    if (req.query.categoryId) {
      where.categoryId = req.query.categoryId;
    }

    // Get only subcategories that have active businesses
    const { Op } = require('sequelize');
    const subcategoriesWithBusinesses = await Business.findAll({
      attributes: ['subCategoryId'],
      where: { 
        subCategoryId: { [Op.ne]: null },
        isActive: true 
      },
      group: ['subCategoryId'],
      raw: true
    });

    const subcategoryIds = [...new Set(subcategoriesWithBusinesses.map(b => b.subCategoryId))];

    // If no businesses with subcategories, return empty array
    if (subcategoryIds.length === 0) {
      return res.json({
        success: true,
        count: 0,
        subcategories: []
      });
    }

    // Filter to only subcategories that have businesses
    where.id = { [Op.in]: subcategoryIds };

    const subcategories = await SubCategory.findAll({
      where,
      include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'icon'] }],
      order: [['order', 'ASC'], ['name', 'ASC']]
    });

    // Get business counts for each subcategory
    const businessCounts = await Business.findAll({
      attributes: [
        'subCategoryId',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: { isActive: true, subCategoryId: { [require('sequelize').Op.ne]: null } },
      group: ['subCategoryId'],
      raw: true
    });

    const countMap = new Map(
      businessCounts.map(item => [item.subCategoryId, parseInt(item.count)])
    );

    const responseSubcategories = subcategories.map(sub => ({
      ...sub.toJSON(),
      businessCount: countMap.get(sub.id) || 0
    }));

    res.json({
      success: true,
      count: responseSubcategories.length,
      subcategories: responseSubcategories
    });
  } catch (error) {
    console.log('Get subcategories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/subcategories/:id
// @desc    Get single subcategory
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const subcategory = await SubCategory.findByPk(req.params.id, {
      include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'icon'] }]
    });

    if (!subcategory) {
      return res.status(404).json({ error: 'Subcategory not found' });
    }

    res.json({
      success: true,
      subcategory
    });
  } catch (error) {
    console.log('Get subcategory error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


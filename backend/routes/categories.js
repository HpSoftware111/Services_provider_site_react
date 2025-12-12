const express = require('express');
const router = express.Router();
const { Category, Business } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const logActivity = require('../utils/logActivity');
const { sequelize } = require('../config/database');

// @route   GET /api/categories
// @desc    Get all categories
// @access  Public
router.get('/', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const where = includeInactive ? {} : { isActive: true };

    const categories = await Category.findAll({
      where,
      order: [['order', 'ASC'], ['name', 'ASC']]
    });

    // Get business counts for each category
    const businessCounts = await Business.findAll({
      attributes: [
        'categoryId',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: includeInactive ? {} : { isActive: true },
      group: ['categoryId'],
      raw: true
    });

    const countMap = new Map(
      businessCounts.map(item => [item.categoryId, parseInt(item.count)])
    );

    const responseCategories = categories.map(category => ({
      ...category.toJSON(),
      businessCount: countMap.get(category.id) || 0
    }));

    res.json({
      success: true,
      count: responseCategories.length,
      categories: responseCategories
    });
  } catch (error) {
('Get categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/categories/:id
// @desc    Get single category
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Get businesses in this category
    const businesses = await Business.findAll({
      where: { 
        categoryId: category.id,
        isActive: true 
      },
      limit: 10,
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug', 'icon'] }
      ]
    });

    res.json({
      success: true,
      category,
      businesses
    });
  } catch (error) {
('Get category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/categories
// @desc    Create category
// @access  Private (Admin only)
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const category = await Category.create(req.body);

    // Log activity
    await logActivity({
      type: 'category_created',
      description: `Category "${category.name}" was created by admin`,
      userId: req.user.id,
      metadata: { categoryName: category.name, categoryId: category.id }
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category
    });
  } catch (error) {
('Create category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/categories/:id
// @desc    Update category
// @access  Private (Admin only)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await category.update(req.body);

    // Log activity
    await logActivity({
      type: 'category_updated',
      description: `Category "${category.name}" was updated by admin`,
      userId: req.user.id,
      metadata: { categoryName: category.name, categoryId: category.id }
    });

    res.json({
      success: true,
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
('Update category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/categories/:id
// @desc    Delete category
// @access  Private (Admin only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if category has businesses
    const businessCount = await Business.count({ where: { categoryId: category.id } });
    
    // Set businesses to null category (uncategorized)
    if (businessCount > 0) {
      await Business.update(
        { categoryId: null },
        { where: { categoryId: category.id } }
      );
    }

    const categoryName = category.name;
    await category.destroy();

    // Log activity
    await logActivity({
      type: 'category_deleted',
      description: `Category "${categoryName}" was deleted by admin`,
      userId: req.user.id,
      metadata: { categoryName }
    });

    res.json({
      success: true,
      message: 'Category deleted successfully' + (businessCount > 0 ? ` (${businessCount} businesses uncategorized)` : '')
    });
  } catch (error) {
('Delete category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


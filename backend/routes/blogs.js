const express = require('express');
const router = express.Router();
const { Blog } = require('../models');

// @route   GET /api/blogs
// @desc    Get published blog posts
// @access  Public
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const blogs = await Blog.findAll({
      where: { isPublished: true },
      order: [['publishedAt', 'DESC'], ['createdAt', 'DESC']],
      limit,
      attributes: ['id', 'title', 'summary', 'author', 'coverImage', 'tags', 'slug', 'publishedAt', 'createdAt']
    });

    res.json({
      success: true,
      count: blogs.length,
      blogs
    });
  } catch (error) {
('Get blogs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/blogs/:slug
// @desc    Get single published blog post by slug
// @access  Public
router.get('/:slug', async (req, res) => {
  try {
    const blog = await Blog.findOne({
      where: {
        slug: req.params.slug.toLowerCase(),
        isPublished: true
      }
    });

    if (!blog) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    res.json({
      success: true,
      blog
    });
  } catch (error) {
('Get blog error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


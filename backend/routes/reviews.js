const express = require('express');
const router = express.Router();
const { Review, Business, User } = require('../models');
const { protect } = require('../middleware/auth');
const logActivity = require('../utils/logActivity');

// @route   GET /api/reviews
// @desc    Get all reviews or reviews for a business
// @access  Public
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const where = { isApproved: true };

    if (req.query.business) {
      where.businessId = req.query.business;
    }

    const { count, rows: reviews } = await Review.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'avatar'] },
        { model: Business, as: 'business', attributes: ['id', 'name', 'slug'] }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    res.json({
      success: true,
      count: reviews.length,
      total: count,
      page,
      pages: Math.ceil(count / limit),
      reviews
    });
  } catch (error) {
    console.log('Get reviews error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/reviews/my-reviews
// @desc    Get current user's reviews
// @access  Private
router.get('/my-reviews', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    const { count, rows: reviews } = await Review.findAndCountAll({
      where: { userId: req.user.id },
      include: [
        { model: Business, as: 'business', attributes: ['id', 'name', 'slug'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: offset
    });

    // Map to match frontend expectations
    const formattedReviews = reviews.map(r => {
      const json = r.toJSON();
      return {
        ...json,
        Business: json.business
      };
    });

    res.json({
      success: true,
      reviews: formattedReviews,
      pagination: {
        page: page,
        pageSize: pageSize,
        total: count,
        pages: Math.ceil(count / pageSize)
      }
    });
  } catch (error) {
    console.log('Get my reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// @route   GET /api/reviews/:id
// @desc    Get single review
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'avatar'] },
        { model: Business, as: 'business', attributes: ['id', 'name', 'slug'] }
      ]
    });

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.json({
      success: true,
      review
    });
  } catch (error) {
    console.log('Get review error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/reviews
// @desc    Create a review
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.businessId) {
      return res.status(400).json({
        success: false,
        error: 'Please select a business'
      });
    }

    if (!req.body.rating || req.body.rating < 1 || req.body.rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid rating (1-5 stars)'
      });
    }

    if (!req.body.title || !req.body.comment) {
      return res.status(400).json({
        success: false,
        error: 'Review title and comment are required'
      });
    }

    // Check if business exists
    const business = await Business.findByPk(req.body.businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      });
    }

    // Check if user already reviewed this business
    const existingReview = await Review.findOne({
      where: {
        businessId: req.body.businessId,
        userId: req.user.id
      }
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: 'You have already reviewed this business'
      });
    }

    // Create review
    const review = await Review.create({
      businessId: req.body.businessId,
      userId: req.user.id,
      rating: req.body.rating,
      title: req.body.title,
      comment: req.body.comment,
      isApproved: false // Reviews need admin approval
    });

    // Log activity
    await logActivity({
      type: 'review_submitted',
      description: `New ${review.rating}-star review for "${business.name}" was submitted`,
      userId: req.user.id,
      metadata: {
        businessName: business.name,
        rating: review.rating,
        reviewerName: req.user.name,
        reviewId: review.id,
        businessId: business.id
      }
    });

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      review
    });
  } catch (error) {
    console.log('Create review error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create review'
    });
  }
});

// @route   PUT /api/reviews/:id
// @desc    Update review
// @access  Private (Owner only)
router.put('/:id', protect, async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check ownership
    if (review.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this review' });
    }

    await review.update({
      rating: req.body.rating,
      title: req.body.title,
      comment: req.body.comment
    });

    res.json({
      success: true,
      message: 'Review updated successfully',
      review
    });
  } catch (error) {
    console.log('Update review error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/reviews/:id
// @desc    Delete review
// @access  Private (Owner or Admin)
router.delete('/:id', protect, async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check ownership
    if (review.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this review' });
    }

    await review.destroy();

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.log('Delete review error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/reviews/:id/helpful
// @desc    Mark review as helpful
// @access  Private
router.post('/:id/helpful', protect, async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const helpfulBy = review.helpfulBy || [];
    const userIndex = helpfulBy.indexOf(req.user.id);

    if (userIndex > -1) {
      // Remove from helpful
      helpfulBy.splice(userIndex, 1);
      review.helpfulCount = Math.max(0, review.helpfulCount - 1);
    } else {
      // Add to helpful
      helpfulBy.push(req.user.id);
      review.helpfulCount += 1;
    }

    review.helpfulBy = helpfulBy;
    await review.save();

    res.json({
      success: true,
      message: 'Review helpful status updated',
      helpfulCount: review.helpfulCount
    });
  } catch (error) {
    console.log('Mark helpful error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/reviews/request
// @desc    Request review from customer
// @access  Private (Business Owner)
router.post('/request', protect, async (req, res) => {
  try {
    const { businessId, customerEmail, customerName } = req.body;

    if (!businessId || !customerEmail) {
      return res.status(400).json({ error: 'Business ID and customer email are required' });
    }

    // Verify user owns this business
    const business = await Business.findByPk(businessId);
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    if (business.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only request reviews for your own businesses' });
    }

    // Send email
    const sendEmail = require('../utils/sendEmail');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const reviewLink = `${frontendUrl}/write-review?businessId=${businessId}`;

    await sendEmail({
      to: customerEmail,
      subject: `We'd love your feedback on ${business.name}!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">How was your experience?</h1>
          </div>
          <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
              Hi${customerName ? ` ${customerName}` : ''},
            </p>
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
              Thank you for choosing <strong>${business.name}</strong>! We hope you had a great experience with us.
            </p>
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
              We would really appreciate it if you could take a moment to share your feedback by leaving us a review.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${reviewLink}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Leave a Review
              </a>
            </div>
            <p style="color: #64748b; font-size: 14px; text-align: center;">
              Your feedback helps us improve and helps other customers make informed decisions.
            </p>
          </div>
        </div>
      `
    });

    await logActivity({
      type: 'review_request',
      description: `Review request sent to ${customerEmail} for ${business.name}`,
      userId: req.user.id,
      metadata: { businessId, customerEmail }
    });

    res.json({
      success: true,
      message: 'Review request sent successfully!'
    });
  } catch (error) {
    console.log('Request review error:', error);
    res.status(500).json({ error: 'Failed to send review request' });
  }
});

// @route   POST /api/reviews/:id/respond
// @desc    Business owner responds to review
// @access  Private (Business Owner)
router.post('/:id/respond', protect, async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id, {
      include: [{ model: Business, as: 'business' }]
    });

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check if user is business owner
    if (review.business.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only business owner can respond to reviews'
      });
    }

    await review.update({
      responseComment: req.body.comment,
      respondedAt: new Date(),
      respondedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Response added successfully',
      review
    });
  } catch (error) {
    console.log('Respond to review error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


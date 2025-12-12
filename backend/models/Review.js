const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Business = require('./Business');

const Review = sequelize.define('Review', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  businessId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  serviceRequestId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'service_requests',
      key: 'id'
    }
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    }
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Please provide a review title' },
      len: [1, 100]
    }
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Please provide a review comment' },
      len: [1, 1000]
    }
  },
  images: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  helpfulCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  helpfulBy: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  responseComment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  respondedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  respondedBy: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  isApproved: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isReported: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  metadata: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'reviews',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['businessId', 'userId', 'serviceRequestId'],
      name: 'reviews_business_user_service_request'
    },
    {
      fields: ['serviceRequestId'],
      name: 'idx_reviews_service_request_id'
    }
  ]
});

// Static method to calculate average rating
// This function should be called AFTER transactions commit to avoid lock timeouts
Review.calculateAverageRating = async function (businessId, retryCount = 0) {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second

  try {
    // Get stats in a single query (more efficient)
    const stats = await this.findAll({
      where: {
        businessId,
        isApproved: true
      },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalCount']
      ],
      raw: true
    });

    const averageRating = stats && stats.length > 0 && stats[0].avgRating
      ? parseFloat(stats[0].avgRating).toFixed(2)
      : 0;
    const count = stats && stats.length > 0 && stats[0].totalCount
      ? parseInt(stats[0].totalCount) || 0
      : 0;

    // Update business rating with retry logic for lock timeouts
    try {
      await Business.update(
        {
          ratingAverage: averageRating,
          ratingCount: count
        },
        {
          where: { id: businessId }
        }
      );
    } catch (updateError) {
      // Handle lock timeout - retry with exponential backoff
      if (updateError.message && updateError.message.includes('Lock wait timeout') && retryCount < maxRetries) {
        const delay = retryDelay * Math.pow(2, retryCount); // Exponential backoff
        console.warn(`[Review.calculateAverageRating] Lock timeout for business ${businessId}, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return await Review.calculateAverageRating(businessId, retryCount + 1);
      } else {
        throw updateError;
      }
    }
  } catch (error) {
    // If all retries fail, log error but don't throw (non-critical operation)
    if (retryCount >= maxRetries) {
      console.error(`[Review.calculateAverageRating] Failed to update rating for business ${businessId} after ${maxRetries} retries:`, error.message);
      // Don't throw - this is a non-critical operation that can be retried later
    } else {
      throw error;
    }
  }
};

// Hooks to update business rating
Review.addHook('afterCreate', async (review) => {
  await Review.calculateAverageRating(review.businessId);
});

Review.addHook('afterUpdate', async (review) => {
  if (review.changed('rating') || review.changed('isApproved')) {
    await Review.calculateAverageRating(review.businessId);
  }
});

Review.addHook('afterDestroy', async (review) => {
  await Review.calculateAverageRating(review.businessId);
});

module.exports = Review;


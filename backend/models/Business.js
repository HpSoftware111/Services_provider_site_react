const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Business = sequelize.define('Business', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Please provide a business name' },
      len: [1, 100]
    }
  },
  slug: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Please provide a description' },
      len: [1, 2000]
    }
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  ownerId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  address: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  state: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  zipCode: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  country: {
    type: DataTypes.STRING(50),
    defaultValue: 'USA'
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  website: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  hours: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  },
  socialLinks: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  },
  ratingAverage: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0,
    validate: {
      min: 0,
      max: 5
    }
  },
  ratingCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  subCategoryId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  logo: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  images: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  videos: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  services: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  verificationMethod: {
    type: DataTypes.ENUM('none', 'google', 'facebook', 'document', 'phone'),
    defaultValue: 'none'
  },
  verificationData: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  },
  verificationRequestedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  verificationStatus: {
    type: DataTypes.ENUM('none', 'pending', 'approved', 'rejected'),
    defaultValue: 'none'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isFeatured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  claimedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  rejectedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'businesses',
  timestamps: true,
  hooks: {
    beforeCreate: (business) => {
      if (!business.slug && business.name) {
        business.slug = business.name
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim() + '-' + Date.now();
      }
    },
    beforeUpdate: (business) => {
      if (business.changed('name') && !business.slug) {
        business.slug = business.name
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim() + '-' + Date.now();
      }
    }
  }
});

// Instance methods
Business.prototype.incrementViews = async function() {
  this.views += 1;
  return await this.save();
};

Business.prototype.isOpenNow = function() {
  const now = new Date();
  const day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  const hours = this.hours && this.hours[day];
  
  if (!hours || hours.closed) {
    return false;
  }
  
  return true;
};

module.exports = Business;


const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Blog = sequelize.define('Blog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(150),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Please provide a blog title' },
      len: [1, 150]
    }
  },
  slug: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: true
  },
  summary: {
    type: DataTypes.STRING(300),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Please provide a summary' },
      len: [1, 300]
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Please provide blog content' }
    }
  },
  coverImage: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  author: {
    type: DataTypes.STRING(100),
    defaultValue: 'CityLocal 101 Team'
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  isPublished: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  publishedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'blogs',
  timestamps: true,
  hooks: {
    beforeCreate: (blog) => {
      if (!blog.slug && blog.title) {
        blog.slug = blog.title
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
      }
      if (blog.isPublished && !blog.publishedAt) {
        blog.publishedAt = new Date();
      }
    },
    beforeUpdate: (blog) => {
      if (blog.changed('title') && !blog.slug) {
        blog.slug = blog.title
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
      }
      if (blog.changed('isPublished')) {
        if (blog.isPublished && !blog.publishedAt) {
          blog.publishedAt = new Date();
        }
        if (!blog.isPublished) {
          blog.publishedAt = null;
        }
      }
    }
  }
});

module.exports = Blog;


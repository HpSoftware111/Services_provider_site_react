const { Sequelize } = require('sequelize');
require('dotenv').config();

// Database configuration
const sequelize = new Sequelize(
  process.env.DB_NAME || 'citylocal101',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
      evict: 1000 // Check for idle connections every second
    },
    dialectOptions: {
      connectTimeout: 10000, // 10 second connection timeout
      requestTimeout: 30000, // 30 second query timeout
    },
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: true
    }
  }
);

// Test connection
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL Connected Successfully');
    console.log(`📊 Database: ${process.env.DB_NAME || 'citylocal101'}`);

    // NEVER sync/alter in production - use migrations instead
    // Only sync in development when explicitly enabled
    if (process.env.NODE_ENV === 'development' && process.env.SYNC_DB === 'true') {
      console.log('⚠️  SYNC_DB is enabled - syncing models (NOT RECOMMENDED FOR PRODUCTION)');
      await sequelize.sync({ alter: false }); // Disabled alter to prevent index issues
      console.log('🔄 Database models synchronized');
    } else if (process.env.NODE_ENV !== 'production') {
      console.log('💡 Database sync disabled. Use migrations for schema changes.');
    }
  } catch (error) {
    console.error('❌ MySQL Connection Error:', error.message);
    console.error('\n⚠️  Troubleshooting Tips:');
    console.error('   1. Make sure MySQL server is running');
    console.error('   2. Check your database credentials in .env file');
    console.error('   3. Create the database if it doesn\'t exist:');
    console.error('      CREATE DATABASE citylocal101;');
    console.error('   4. Verify MySQL is accessible on the specified host/port');
    console.error('   5. If you see "Too many keys" error, run migrations instead of sync\n');
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };


require('dotenv').config();
const { sequelize } = require('../config/database');

async function addUserProfileFields() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('🌱 Starting user profile fields migration...\n');

    // Test connection first
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Check if columns exist before adding
    const tableDescription = await queryInterface.describeTable('users');

    const fieldsToAdd = [
      { name: 'firstName', type: 'VARCHAR(50)', nullable: 'NULL' },
      { name: 'lastName', type: 'VARCHAR(50)', nullable: 'NULL' },
      { name: 'gender', type: 'ENUM("male", "female", "other")', nullable: 'NULL' },
      { name: 'username', type: 'VARCHAR(50)', nullable: 'NULL' },
      { name: 'secondEmail', type: 'VARCHAR(100)', nullable: 'NULL' },
      { name: 'address', type: 'VARCHAR(255)', nullable: 'NULL' },
      { name: 'city', type: 'VARCHAR(100)', nullable: 'NULL' },
      { name: 'state', type: 'VARCHAR(100)', nullable: 'NULL' },
      { name: 'country', type: 'VARCHAR(100)', nullable: 'NULL' },
      { name: 'zipCode', type: 'VARCHAR(20)', nullable: 'NULL' }
    ];

    for (const field of fieldsToAdd) {
      if (!tableDescription[field.name]) {
        console.log(`Adding column: ${field.name}...`);
        await sequelize.query(
          `ALTER TABLE users ADD COLUMN ${field.name} ${field.type} ${field.nullable}`
        );
        console.log(`✓ Added ${field.name}\n`);
      } else {
        console.log(`- Column ${field.name} already exists, skipping\n`);
      }
    }

    // Add unique constraint to username if it doesn't exist
    try {
      // Check if unique index already exists
      const [indexes] = await sequelize.query(
        `SHOW INDEX FROM users WHERE Key_name = 'users_username_unique'`
      );
      
      if (indexes.length === 0) {
        await sequelize.query(
          `ALTER TABLE users ADD UNIQUE INDEX users_username_unique (username)`
        );
        console.log('✓ Added unique constraint to username\n');
      } else {
        console.log('- Unique constraint on username already exists, skipping\n');
      }
    } catch (error) {
      if (error.message.includes('Duplicate key name') || error.message.includes('already exists')) {
        console.log('- Unique constraint on username already exists, skipping\n');
      } else {
        throw error;
      }
    }

    console.log('✅ User profile fields migration completed successfully!');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    if (error.parent) {
      console.error('   Details:', error.parent.message);
    }
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
}

addUserProfileFields();


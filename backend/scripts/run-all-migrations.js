require('dotenv').config();
const { sequelize } = require('../config/database');

async function runAllMigrations() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('🌱 Starting all database migrations...\n');

    // Test connection first
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Check if users table exists
    try {
      await queryInterface.describeTable('users');
    } catch (error) {
      console.error('❌ Error: Users table does not exist.');
      console.log('   Please run: npm run seed (which will create tables)\n');
      await sequelize.close();
      process.exit(1);
    }

    console.log('📋 Step 1: Adding user profile fields...\n');
    
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

    let fieldsAdded = 0;
    for (const field of fieldsToAdd) {
      if (!tableDescription[field.name]) {
        console.log(`  Adding column: ${field.name}...`);
        await sequelize.query(
          `ALTER TABLE users ADD COLUMN ${field.name} ${field.type} ${field.nullable}`
        );
        console.log(`  ✓ Added ${field.name}\n`);
        fieldsAdded++;
      } else {
        console.log(`  - Column ${field.name} already exists\n`);
      }
    }

    if (fieldsAdded > 0) {
      console.log(`✅ Added ${fieldsAdded} new columns\n`);
    } else {
      console.log('✅ All profile fields already exist\n');
    }

    // Add unique constraint to username if it doesn't exist
    console.log('📋 Step 2: Checking username unique constraint...\n');
    try {
      const [indexes] = await sequelize.query(
        `SHOW INDEX FROM users WHERE Key_name = 'users_username_unique'`
      );
      
      if (indexes.length === 0) {
        await sequelize.query(
          `ALTER TABLE users ADD UNIQUE INDEX users_username_unique (username)`
        );
        console.log('  ✓ Added unique constraint to username\n');
      } else {
        console.log('  - Unique constraint on username already exists\n');
      }
    } catch (error) {
      if (error.message.includes('Duplicate key name') || error.message.includes('already exists')) {
        console.log('  - Unique constraint on username already exists\n');
      } else {
        throw error;
      }
    }

    // Update avatar field
    console.log('📋 Step 3: Updating avatar field...\n');
    const updatedTableDescription = await queryInterface.describeTable('users');
    
    if (!updatedTableDescription.avatar) {
      console.log('  Avatar column does not exist. Creating it...');
      await sequelize.query(`
        ALTER TABLE users 
        ADD COLUMN avatar LONGTEXT NULL
      `);
      console.log('  ✓ Avatar column created\n');
    } else {
      // Check current type
      const [columns] = await sequelize.query(
        `SHOW COLUMNS FROM users WHERE Field = 'avatar'`
      );
      
      const currentType = columns[0].Type.toUpperCase();
      
      if (!currentType.includes('TEXT')) {
        console.log('  Updating avatar column type to LONGTEXT...');
        await sequelize.query(`
          ALTER TABLE users 
          MODIFY COLUMN avatar LONGTEXT NULL
        `);
        console.log('  ✓ Avatar field updated to LONGTEXT\n');
      } else {
        console.log('  - Avatar field is already LONGTEXT\n');
      }
    }

    console.log('✅ All migrations completed successfully!\n');
    console.log('   You can now run: npm run seed\n');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration error:', error.message);
    if (error.parent) {
      console.error('   Details:', error.parent.message);
    }
    if (error.sql) {
      console.error('   SQL:', error.sql);
    }
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
}

runAllMigrations();


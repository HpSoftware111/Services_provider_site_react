require('dotenv').config();
const { sequelize } = require('../config/database');

async function checkIndexes() {
  try {
    console.log('🔍 Checking indexes on users table...\n');
    
    await sequelize.authenticate();
    console.log('✅ Database connected\n');
    
    // Get all indexes on users table
    const [indexes] = await sequelize.query(`
      SHOW INDEXES FROM users
    `);
    
    console.log(`📊 Found ${indexes.length} indexes on users table:\n`);
    
    // Group by index name
    const indexGroups = {};
    indexes.forEach(idx => {
      if (!indexGroups[idx.Key_name]) {
        indexGroups[idx.Key_name] = [];
      }
      indexGroups[idx.Key_name].push(idx);
    });
    
    console.log('Indexes by name:\n');
    Object.keys(indexGroups).forEach(keyName => {
      const group = indexGroups[keyName];
      console.log(`  ${keyName}: ${group.length} column(s)`);
      group.forEach(idx => {
        console.log(`    - Column: ${idx.Column_name} (Unique: ${idx.Non_unique === 0 ? 'Yes' : 'No'})`);
      });
    });
    
    console.log(`\n⚠️  MySQL limit: 64 indexes per table`);
    console.log(`   Current count: ${indexes.length} indexes\n`);
    
    if (indexes.length > 60) {
      console.log('⚠️  WARNING: Approaching MySQL index limit!');
      console.log('   Consider removing duplicate or unused indexes.\n');
    }
    
    // Check for duplicate unique indexes
    console.log('🔍 Checking for duplicate unique constraints...\n');
    const uniqueIndexes = indexes.filter(idx => idx.Non_unique === 0);
    const uniqueColumns = {};
    
    uniqueIndexes.forEach(idx => {
      if (!uniqueColumns[idx.Column_name]) {
        uniqueColumns[idx.Column_name] = [];
      }
      uniqueColumns[idx.Column_name].push(idx.Key_name);
    });
    
    const duplicates = Object.entries(uniqueColumns).filter(([col, keys]) => keys.length > 1);
    
    if (duplicates.length > 0) {
      console.log('⚠️  Found potential duplicate unique constraints:\n');
      duplicates.forEach(([col, keys]) => {
        console.log(`   Column: ${col}`);
        console.log(`   Indexes: ${keys.join(', ')}\n`);
        console.log(`   💡 Consider dropping duplicate indexes:`);
        keys.slice(1).forEach(keyName => {
          console.log(`      DROP INDEX ${keyName} ON users;\n`);
        });
      });
    } else {
      console.log('✅ No duplicate unique constraints found\n');
    }
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.parent) {
      console.error('   Details:', error.parent.message);
    }
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
}

checkIndexes();


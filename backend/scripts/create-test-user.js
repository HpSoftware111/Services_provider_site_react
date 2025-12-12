require('dotenv').config();
const { User } = require('../models');

async function createTestUser() {
  try {
    console.log('Creating test user account...');

    const testUser = {
      name: 'Test User',
      email: 'testuser@example.com',
      password: 'password123',
      role: 'user',
      firstName: 'John',
      lastName: 'Doe',
      phone: '1234567890',
      country: 'USA'
    };

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email: testUser.email } });
    
    if (existingUser) {
      console.log('❌ User already exists!');
      console.log('\nLogin credentials:');
      console.log('Email: testuser@example.com');
      console.log('Password: password123');
      process.exit(0);
    }

    // Create new user
    const user = await User.create(testUser);
    
    console.log('✅ Test user created successfully!');
    console.log('\n📋 Login credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Email:    testuser@example.com');
    console.log('Password: password123');
    console.log('Role:     user');
    console.log('━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✨ Now login with these credentials to access the User Dashboard!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createTestUser();


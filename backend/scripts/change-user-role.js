require('dotenv').config();
const { sequelize } = require('../config/database');
const { User } = require('../models');

async function changeUserRole() {
  try {
    console.log('Changing user role...');

    // Change the email to match your account
    const email = 'test2@example.com'; // UPDATE THIS EMAIL!
    
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      console.log(`❌ User with email "${email}" not found!`);
      console.log('\nPlease update the email in this script to match your account.');
      process.exit(1);
    }

    console.log(`\nFound user: ${user.name} (${user.email})`);
    console.log(`Current role: ${user.role}`);
    
    // Change role to 'user'
    user.role = 'user';
    await user.save();
    
    console.log(`✅ Role changed to: ${user.role}`);
    console.log('\n✨ Success! Now logout and login again to see the User Dashboard!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

changeUserRole();


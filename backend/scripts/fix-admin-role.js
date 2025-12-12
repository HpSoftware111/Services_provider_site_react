const { User } = require('../models');
require('dotenv').config();

const fixAdminRole = async () => {
  try {
    console.log('🔧 Fixing admin user role...\n');

    // Find admin user by email
    const adminUser = await User.findOne({
      where: { email: 'admin@citylocal101.com' }
    });

    if (!adminUser) {
      console.log('❌ Admin user not found. Creating admin user...');
      const newAdmin = await User.create({
        name: 'Admin User',
        email: 'admin@citylocal101.com',
        password: 'admin123',
        role: 'admin',
        isActive: true
      });
      console.log('✅ Admin user created with role: admin');
      process.exit(0);
      return;
    }

    console.log(`📋 Current admin user role: ${adminUser.role}`);
    
    if (adminUser.role !== 'admin') {
      // Update role to admin
      await adminUser.update({ role: 'admin', businessId: null });
      console.log('✅ Admin user role updated to: admin');
      console.log('✅ Business ID cleared');
    } else {
      console.log('✅ Admin user already has correct role');
    }

    // Also check for admin@example.com if it exists
    const altAdmin = await User.findOne({
      where: { email: 'admin@example.com' }
    });

    if (altAdmin && altAdmin.role !== 'admin') {
      await altAdmin.update({ role: 'admin', businessId: null });
      console.log('✅ Alternative admin user role also updated');
    }

    console.log('\n🎉 Admin role fix completed!\n');
    console.log('📝 You can now login with:');
    console.log('   Email: admin@citylocal101.com');
    console.log('   Password: admin123\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing admin role:', error);
    process.exit(1);
  }
};

fixAdminRole();


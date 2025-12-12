const { sequelize, User, Category, Business, Review, Blog } = require('../models');
require('dotenv').config();

// Helper function to generate slug from name
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seed...\n');

    // Sync database
    await sequelize.sync({ force: false });
    console.log('✅ Database synced\n');

    // Create admin user
    const admin = await User.findOrCreate({
      where: { email: 'admin@citylocal101.com' },
      defaults: {
        name: 'Admin User',
        email: 'admin@citylocal101.com',
        password: 'admin123',
        role: 'admin',
        isActive: true
      }
    });
    console.log('✅ Admin user created/verified');

    // Create categories
    const categories = [
      { name: 'Restaurants & Dining', icon: 'utensils', description: 'Food and dining establishments' },
      { name: 'Professional Services', icon: 'briefcase', description: 'Professional and business services' },
      { name: 'Retail & Shopping', icon: 'shopping-bag', description: 'Retail stores and shopping' },
      { name: 'Health & Wellness', icon: 'heart', description: 'Health and wellness services' },
      { name: 'Home Services', icon: 'home', description: 'Home improvement and services' },
      { name: 'Auto Services', icon: 'car', description: 'Automotive services' },
      { name: 'Beauty & Spa', icon: 'spa', description: 'Beauty and spa services' },
      { name: 'Education', icon: 'graduation-cap', description: 'Educational services' }
    ];

    const createdCategories = [];
    for (const cat of categories) {
      const [category] = await Category.findOrCreate({
        where: { name: cat.name },
        defaults: cat
      });
      createdCategories.push(category);
    }
    console.log(`✅ Created ${createdCategories.length} categories`);

    // Create sample businesses with more diverse content
    const sampleBusinesses = [
      // Restaurants & Dining
      {
        name: 'Downtown Pizza Co.',
        slug: generateSlug('Downtown Pizza Co.'),
        description: 'Authentic Italian pizza with fresh ingredients and traditional recipes. Family-owned since 1995.',
        categoryId: createdCategories[0].id,
        address: '123 Main Street',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        phone: '(555) 123-4567',
        email: 'info@downtownpizza.com',
        website: 'https://downtownpizza.com',
        isActive: true,
        isFeatured: true,
        ratingAverage: 4.5,
        ratingCount: 125
      },
      {
        name: 'Sushi Palace',
        slug: generateSlug('Sushi Palace'),
        description: 'Premium sushi and Japanese cuisine prepared by experienced chefs. Fresh seafood daily.',
        categoryId: createdCategories[0].id,
        address: '456 Ocean Drive',
        city: 'Miami',
        state: 'FL',
        zipCode: '33139',
        phone: '(555) 987-6543',
        email: 'info@sushipalace.com',
        website: 'https://sushipalace.com',
        isActive: true,
        isFeatured: false,
        ratingAverage: 4.7,
        ratingCount: 89
      },
      {
        name: 'Burger Heaven',
        slug: generateSlug('Burger Heaven'),
        description: 'Gourmet burgers made with locally sourced ingredients. Best burgers in town!',
        categoryId: createdCategories[0].id,
        address: '789 Food Court',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60601',
        phone: '(555) 456-7890',
        email: 'contact@burgerheaven.com',
        isActive: true,
        isFeatured: true,
        ratingAverage: 4.6,
        ratingCount: 156
      },
      {
        name: 'Cafe Mocha',
        slug: generateSlug('Cafe Mocha'),
        description: 'Cozy coffee shop with artisan coffee, pastries, and light lunch options.',
        categoryId: createdCategories[0].id,
        address: '321 Coffee Lane',
        city: 'Seattle',
        state: 'WA',
        zipCode: '98101',
        phone: '(555) 234-8901',
        email: 'hello@cafemocha.com',
        isActive: true,
        isFeatured: false,
        ratingAverage: 4.4,
        ratingCount: 78
      },
      
      // Professional Services
      {
        name: 'Tech Solutions Inc.',
        slug: generateSlug('Tech Solutions Inc.'),
        description: 'Professional IT services and consulting for businesses of all sizes. 24/7 support available.',
        categoryId: createdCategories[1].id,
        address: '456 Tech Avenue',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94102',
        phone: '(555) 234-5678',
        email: 'contact@techsolutions.com',
        website: 'https://techsolutions.com',
        isActive: true,
        isFeatured: true,
        ratingAverage: 4.8,
        ratingCount: 142
      },
      {
        name: 'Legal Associates',
        slug: generateSlug('Legal Associates'),
        description: 'Experienced attorneys specializing in business law, contracts, and litigation.',
        categoryId: createdCategories[1].id,
        address: '100 Law Plaza',
        city: 'Boston',
        state: 'MA',
        zipCode: '02101',
        phone: '(555) 111-2222',
        email: 'info@legalassociates.com',
        isActive: true,
        isFeatured: false,
        ratingAverage: 4.9,
        ratingCount: 67
      },
      {
        name: 'Financial Advisors Pro',
        slug: generateSlug('Financial Advisors Pro'),
        description: 'Expert financial planning and investment advice for individuals and businesses.',
        categoryId: createdCategories[1].id,
        address: '200 Wall Street',
        city: 'New York',
        state: 'NY',
        zipCode: '10005',
        phone: '(555) 333-4444',
        email: 'contact@financialadvisorspro.com',
        isActive: true,
        isFeatured: true,
        ratingAverage: 4.7,
        ratingCount: 93
      },
      
      // Retail & Shopping
      {
        name: 'Fashion Boutique',
        slug: generateSlug('Fashion Boutique'),
        description: 'Trendy clothing and accessories for men and women. Latest fashion collections.',
        categoryId: createdCategories[2].id,
        address: '500 Shopping Mall',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90001',
        phone: '(555) 555-6666',
        email: 'info@fashionboutique.com',
        isActive: true,
        isFeatured: true,
        ratingAverage: 4.5,
        ratingCount: 112
      },
      {
        name: 'Electronics World',
        slug: generateSlug('Electronics World'),
        description: 'Latest gadgets, computers, and electronics at competitive prices.',
        categoryId: createdCategories[2].id,
        address: '600 Tech Plaza',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        phone: '(555) 777-8888',
        email: 'sales@electronicsworld.com',
        isActive: true,
        isFeatured: false,
        ratingAverage: 4.3,
        ratingCount: 88
      },
      
      // Health & Wellness
      {
        name: 'City Gym & Fitness',
        slug: generateSlug('City Gym & Fitness'),
        description: 'State-of-the-art fitness center with personal trainers and group classes.',
        categoryId: createdCategories[3].id,
        address: '700 Fitness Ave',
        city: 'Denver',
        state: 'CO',
        zipCode: '80201',
        phone: '(555) 999-0000',
        email: 'info@citygym.com',
        isActive: true,
        isFeatured: true,
        ratingAverage: 4.6,
        ratingCount: 134
      },
      {
        name: 'Wellness Medical Center',
        slug: generateSlug('Wellness Medical Center'),
        description: 'Comprehensive healthcare services with experienced medical professionals.',
        categoryId: createdCategories[3].id,
        address: '800 Health Street',
        city: 'Phoenix',
        state: 'AZ',
        zipCode: '85001',
        phone: '(555) 222-3333',
        email: 'contact@wellnessmedical.com',
        isActive: true,
        isFeatured: false,
        ratingAverage: 4.8,
        ratingCount: 76
      },
      
      // Home Services
      {
        name: 'Green Thumb Landscaping',
        slug: generateSlug('Green Thumb Landscaping'),
        description: 'Expert landscaping and garden design services for residential and commercial properties.',
        categoryId: createdCategories[4].id,
        address: '789 Garden Lane',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        phone: '(555) 345-6789',
        email: 'info@greenthumb.com',
        isActive: true,
        isFeatured: false,
        ratingAverage: 4.3,
        ratingCount: 98
      },
      {
        name: 'Quick Plumbing Solutions',
        slug: generateSlug('Quick Plumbing Solutions'),
        description: 'Fast, reliable plumbing services. Emergency repairs available 24/7.',
        categoryId: createdCategories[4].id,
        address: '900 Service Road',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75201',
        phone: '(555) 444-5555',
        email: 'help@quickplumbing.com',
        isActive: true,
        isFeatured: true,
        ratingAverage: 4.7,
        ratingCount: 145
      },
      
      // Auto Services
      {
        name: 'Pro Auto Repair',
        slug: generateSlug('Pro Auto Repair'),
        description: 'Full-service auto repair shop. Honest pricing and quality work guaranteed.',
        categoryId: createdCategories[5].id,
        address: '1000 Auto Lane',
        city: 'Detroit',
        state: 'MI',
        zipCode: '48201',
        phone: '(555) 666-7777',
        email: 'service@proautorepair.com',
        isActive: true,
        isFeatured: true,
        ratingAverage: 4.8,
        ratingCount: 167
      },
      {
        name: 'Express Car Wash',
        slug: generateSlug('Express Car Wash'),
        description: 'Quick and thorough car wash services. Interior and exterior detailing available.',
        categoryId: createdCategories[5].id,
        address: '1100 Wash Street',
        city: 'Las Vegas',
        state: 'NV',
        zipCode: '89101',
        phone: '(555) 888-9999',
        email: 'info@expresscarwash.com',
        isActive: true,
        isFeatured: false,
        ratingAverage: 4.4,
        ratingCount: 92
      },
      
      // Beauty & Spa
      {
        name: 'Serenity Spa & Salon',
        slug: generateSlug('Serenity Spa & Salon'),
        description: 'Luxurious spa treatments and professional salon services in a relaxing environment.',
        categoryId: createdCategories[6].id,
        address: '1200 Beauty Blvd',
        city: 'Miami',
        state: 'FL',
        zipCode: '33140',
        phone: '(555) 111-3333',
        email: 'hello@serenityspa.com',
        isActive: true,
        isFeatured: true,
        ratingAverage: 4.9,
        ratingCount: 203
      },
      {
        name: 'The Hair Studio',
        slug: generateSlug('The Hair Studio'),
        description: 'Modern hair salon offering cuts, color, and styling by expert stylists.',
        categoryId: createdCategories[6].id,
        address: '1300 Style Street',
        city: 'San Diego',
        state: 'CA',
        zipCode: '92101',
        phone: '(555) 222-4444',
        email: 'info@thehairstudio.com',
        isActive: true,
        isFeatured: false,
        ratingAverage: 4.6,
        ratingCount: 118
      },
      
      // Education
      {
        name: 'Bright Future Academy',
        slug: generateSlug('Bright Future Academy'),
        description: 'Quality education and tutoring services for students of all ages.',
        categoryId: createdCategories[7].id,
        address: '1400 Education Way',
        city: 'Atlanta',
        state: 'GA',
        zipCode: '30301',
        phone: '(555) 333-5555',
        email: 'info@brightfutureacademy.com',
        isActive: true,
        isFeatured: true,
        ratingAverage: 4.8,
        ratingCount: 145
      },
      {
        name: 'Music School of Excellence',
        slug: generateSlug('Music School of Excellence'),
        description: 'Professional music lessons for all instruments and skill levels.',
        categoryId: createdCategories[7].id,
        address: '1500 Harmony Lane',
        city: 'Nashville',
        state: 'TN',
        zipCode: '37201',
        phone: '(555) 444-6666',
        email: 'contact@musicschool.com',
        isActive: true,
        isFeatured: false,
        ratingAverage: 4.7,
        ratingCount: 87
      }
    ];

    const createdBusinesses = [];
    for (const biz of sampleBusinesses) {
      const [business] = await Business.findOrCreate({
        where: { slug: biz.slug },
        defaults: biz
      });
      createdBusinesses.push(business);
    }
    console.log(`✅ Created ${createdBusinesses.length} sample businesses`);

    // Create sample blog posts
    const sampleBlogs = [
      {
        title: 'How to Choose the Right Local Business',
        slug: generateSlug('How to Choose the Right Local Business'),
        summary: 'Finding the perfect local business for your needs doesn\'t have to be difficult.',
        content: 'Finding the perfect local business for your needs doesn\'t have to be difficult. Here are our top tips for making the right choice...',
        author: 'CityLocal 101 Team',
        isPublished: true,
        publishedAt: new Date()
      },
      {
        title: 'The Power of Online Reviews',
        slug: generateSlug('The Power of Online Reviews'),
        summary: 'Online reviews have become one of the most powerful tools for both businesses and consumers.',
        content: 'Online reviews have become one of the most powerful tools for both businesses and consumers. Learn how to write effective reviews...',
        author: 'CityLocal 101 Team',
        isPublished: true,
        publishedAt: new Date()
      }
    ];

    for (const blog of sampleBlogs) {
      await Blog.findOrCreate({
        where: { slug: blog.slug },
        defaults: blog
      });
    }
    console.log(`✅ Created sample blog posts`);

    console.log('\n🎉 Database seeding completed successfully!\n');
    console.log('📝 Login credentials:');
    console.log('   Email: admin@citylocal101.com');
    console.log('   Password: admin123\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();


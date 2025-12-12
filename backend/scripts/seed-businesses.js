const { Business, Category, User } = require('../models');
const { sequelize } = require('../config/database');
require('dotenv').config();

// Helper function to generate slug from name
const generateSlug = (name) => {
    return name
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim() + '-' + Date.now();
};

// Helper function to generate random rating
const randomRating = (min = 3.5, max = 5.0) => {
    return parseFloat((Math.random() * (max - min) + min).toFixed(1));
};

// Helper function to generate random rating count
const randomRatingCount = (min = 5, max = 200) => {
    return Math.floor(Math.random() * (max - min) + min);
};

const seedBusinesses = async () => {
    try {
        console.log('🌱 Starting to seed businesses...\n');

        // Connect to database
        await sequelize.authenticate();
        console.log('✅ Database connected\n');

        // Get existing categories
        const categories = await Category.findAll();

        console.log(`📦 Found ${categories.length} categories\n`);

        // Get or create a test user for business owners
        let testUser = await User.findOne({ where: { email: 'businessowner@test.com' } });
        if (!testUser) {
            testUser = await User.create({
                name: 'Business Owner',
                email: 'businessowner@test.com',
                password: 'test123',
                role: 'business_owner',
                isActive: true,
                isEmailVerified: true
            });
            console.log('✅ Created test business owner user\n');
        }

        // Sample businesses data - diverse locations and categories
        const businessesData = [
            // Plumbing Services
            {
                name: 'Quick Fix Plumbing',
                description: '24/7 emergency plumbing services. Licensed and insured. We fix leaks, clogs, and all plumbing issues fast!',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '123 Main Street',
                city: 'New York',
                state: 'NY',
                zipCode: '10001',
                phone: '(555) 111-2222',
                email: 'info@quickfixplumbing.com',
                website: 'https://quickfixplumbing.com',
                isActive: true,
                isPublic: true,
                isFeatured: true,
                ratingAverage: randomRating(4.0, 5.0),
                ratingCount: randomRatingCount(50, 150)
            },
            {
                name: 'Pro Plumbing Solutions',
                description: 'Professional plumbing services for residential and commercial properties. Expert technicians available.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '456 Oak Avenue',
                city: 'Los Angeles',
                state: 'CA',
                zipCode: '90001',
                phone: '(555) 222-3333',
                email: 'contact@proplumbingsolutions.com',
                isActive: true,
                isPublic: true,
                isFeatured: false,
                ratingAverage: randomRating(4.2, 4.9),
                ratingCount: randomRatingCount(30, 100)
            },
            {
                name: 'Emergency Plumbers 24/7',
                description: 'Round-the-clock plumbing emergency services. Fast response time, quality work guaranteed.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '789 Pine Road',
                city: 'Chicago',
                state: 'IL',
                zipCode: '60601',
                phone: '(555) 333-4444',
                email: 'emergency@plumbers247.com',
                isActive: true,
                isPublic: true,
                isFeatured: true,
                ratingAverage: randomRating(4.3, 5.0),
                ratingCount: randomRatingCount(40, 120)
            },

            // Electrical Services
            {
                name: 'Bright Electric Co.',
                description: 'Licensed electricians for all your electrical needs. Installation, repair, and maintenance services.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '321 Elm Street',
                city: 'Houston',
                state: 'TX',
                zipCode: '77001',
                phone: '(555) 444-5555',
                email: 'info@brightelectric.com',
                website: 'https://brightelectric.com',
                isActive: true,
                isPublic: true,
                isFeatured: true,
                ratingAverage: randomRating(4.1, 4.8),
                ratingCount: randomRatingCount(35, 110)
            },
            {
                name: 'Safe Wire Electrical',
                description: 'Expert electrical services with safety as our priority. Residential and commercial projects.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '654 Maple Drive',
                city: 'Phoenix',
                state: 'AZ',
                zipCode: '85001',
                phone: '(555) 555-6666',
                email: 'contact@safewire.com',
                isActive: true,
                isPublic: true,
                isFeatured: false,
                ratingAverage: randomRating(4.0, 4.7),
                ratingCount: randomRatingCount(25, 90)
            },

            // HVAC Services
            {
                name: 'Cool Air HVAC',
                description: 'Heating and cooling specialists. AC installation, repair, and maintenance. Energy-efficient solutions.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '987 Cedar Lane',
                city: 'Miami',
                state: 'FL',
                zipCode: '33101',
                phone: '(555) 666-7777',
                email: 'info@coolairhvac.com',
                website: 'https://coolairhvac.com',
                isActive: true,
                isPublic: true,
                isFeatured: true,
                ratingAverage: randomRating(4.2, 4.9),
                ratingCount: randomRatingCount(45, 130)
            },
            {
                name: 'Comfort Zone Heating & Cooling',
                description: 'Your trusted HVAC partner. We keep your home comfortable year-round with quality service.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '147 Birch Boulevard',
                city: 'Seattle',
                state: 'WA',
                zipCode: '98101',
                phone: '(555) 777-8888',
                email: 'hello@comfortzonehvac.com',
                isActive: true,
                isPublic: true,
                isFeatured: false,
                ratingAverage: randomRating(4.1, 4.8),
                ratingCount: randomRatingCount(30, 95)
            },

            // Cleaning Services
            {
                name: 'Sparkle Clean Services',
                description: 'Professional cleaning services for homes and offices. Deep cleaning, regular maintenance, move-in/out.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '258 Spruce Street',
                city: 'Boston',
                state: 'MA',
                zipCode: '02101',
                phone: '(555) 888-9999',
                email: 'info@sparkleclean.com',
                website: 'https://sparkleclean.com',
                isActive: true,
                isPublic: true,
                isFeatured: true,
                ratingAverage: randomRating(4.0, 4.9),
                ratingCount: randomRatingCount(40, 140)
            },
            {
                name: 'Elite Cleaning Professionals',
                description: 'Premium cleaning services with eco-friendly products. Residential and commercial cleaning experts.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '369 Willow Way',
                city: 'Denver',
                state: 'CO',
                zipCode: '80201',
                phone: '(555) 999-0000',
                email: 'contact@elitecleaning.com',
                isActive: true,
                isPublic: true,
                isFeatured: false,
                ratingAverage: randomRating(4.2, 4.8),
                ratingCount: randomRatingCount(28, 85)
            },

            // Landscaping Services
            {
                name: 'Green Thumb Landscaping',
                description: 'Complete landscaping services. Design, installation, and maintenance. Transform your outdoor space!',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '741 Garden Path',
                city: 'Atlanta',
                state: 'GA',
                zipCode: '30301',
                phone: '(555) 101-2020',
                email: 'info@greenthumb.com',
                website: 'https://greenthumb.com',
                isActive: true,
                isPublic: true,
                isFeatured: true,
                ratingAverage: randomRating(4.1, 4.9),
                ratingCount: randomRatingCount(35, 125)
            },
            {
                name: 'Perfect Lawn Care',
                description: 'Lawn mowing, garden design, tree services, and seasonal cleanup. Your yard maintenance experts.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '852 Meadow Drive',
                city: 'Dallas',
                state: 'TX',
                zipCode: '75201',
                phone: '(555) 202-3030',
                email: 'hello@perfectlawn.com',
                isActive: true,
                isPublic: true,
                isFeatured: false,
                ratingAverage: randomRating(3.9, 4.7),
                ratingCount: randomRatingCount(20, 75)
            },

            // Painting Services
            {
                name: 'Color Masters Painting',
                description: 'Interior and exterior painting services. Professional painters with attention to detail. Free estimates.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '963 Painters Lane',
                city: 'Philadelphia',
                state: 'PA',
                zipCode: '19101',
                phone: '(555) 303-4040',
                email: 'info@colormasters.com',
                website: 'https://colormasters.com',
                isActive: true,
                isPublic: true,
                isFeatured: true,
                ratingAverage: randomRating(4.0, 4.8),
                ratingCount: randomRatingCount(32, 105)
            },
            {
                name: 'Pro Painters Plus',
                description: 'Expert painting and staining services. Residential and commercial. Quality workmanship guaranteed.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '159 Brush Street',
                city: 'San Diego',
                state: 'CA',
                zipCode: '92101',
                phone: '(555) 404-5050',
                email: 'contact@propainters.com',
                isActive: true,
                isPublic: true,
                isFeatured: false,
                ratingAverage: randomRating(4.1, 4.9),
                ratingCount: randomRatingCount(25, 88)
            },

            // Carpentry Services
            {
                name: 'Master Craftsmen Carpentry',
                description: 'Custom carpentry and woodworking. Cabinets, shelves, trim work, and custom furniture.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '357 Woodwork Way',
                city: 'Portland',
                state: 'OR',
                zipCode: '97201',
                phone: '(555) 505-6060',
                email: 'info@mastercraftsmen.com',
                website: 'https://mastercraftsmen.com',
                isActive: true,
                isPublic: true,
                isFeatured: true,
                ratingAverage: randomRating(4.2, 5.0),
                ratingCount: randomRatingCount(18, 65)
            },
            {
                name: 'Precision Carpentry',
                description: 'Expert carpentry services. Deck building, custom cabinets, and fine woodworking.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '468 Sawmill Road',
                city: 'Nashville',
                state: 'TN',
                zipCode: '37201',
                phone: '(555) 606-7070',
                email: 'hello@precisioncarpentry.com',
                isActive: true,
                isPublic: true,
                isFeatured: false,
                ratingAverage: randomRating(4.0, 4.8),
                ratingCount: randomRatingCount(15, 55)
            },

            // Flooring Services
            {
                name: 'Floor Experts',
                description: 'Professional flooring installation and repair. Hardwood, tile, carpet, and laminate specialists.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '579 Floor Street',
                city: 'Las Vegas',
                state: 'NV',
                zipCode: '89101',
                phone: '(555) 707-8080',
                email: 'info@floorexperts.com',
                website: 'https://floorexperts.com',
                isActive: true,
                isPublic: true,
                isFeatured: true,
                ratingAverage: randomRating(4.1, 4.9),
                ratingCount: randomRatingCount(30, 95)
            },
            {
                name: 'Quality Floors Inc.',
                description: 'Expert flooring services. Installation, repair, and refinishing. All types of flooring available.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '680 Tile Avenue',
                city: 'Minneapolis',
                state: 'MN',
                zipCode: '55401',
                phone: '(555) 808-9090',
                email: 'contact@qualityfloors.com',
                isActive: true,
                isPublic: true,
                isFeatured: false,
                ratingAverage: randomRating(3.9, 4.7),
                ratingCount: randomRatingCount(22, 70)
            },

            // Roofing Services
            {
                name: 'Top Roof Solutions',
                description: 'Roof installation, repair, and maintenance. Licensed roofers with years of experience.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '791 Roof Top Drive',
                city: 'Detroit',
                state: 'MI',
                zipCode: '48201',
                phone: '(555) 909-1010',
                email: 'info@toproofsolutions.com',
                website: 'https://toproofsolutions.com',
                isActive: true,
                isPublic: true,
                isFeatured: true,
                ratingAverage: randomRating(4.0, 4.8),
                ratingCount: randomRatingCount(28, 100)
            },
            {
                name: 'Reliable Roofing Co.',
                description: 'Trusted roofing services. Installation, repair, and gutter services. Free inspections.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '802 Shingle Lane',
                city: 'Baltimore',
                state: 'MD',
                zipCode: '21201',
                phone: '(555) 101-2021',
                email: 'hello@reliableroofing.com',
                isActive: true,
                isPublic: true,
                isFeatured: false,
                ratingAverage: randomRating(4.1, 4.9),
                ratingCount: randomRatingCount(20, 80)
            },

            // Handyman Services
            {
                name: 'Fix It All Handyman',
                description: 'General handyman services. Furniture assembly, TV mounting, repairs, and more. No job too small!',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '913 Fix It Street',
                city: 'Indianapolis',
                state: 'IN',
                zipCode: '46201',
                phone: '(555) 202-3031',
                email: 'info@fixitall.com',
                website: 'https://fixitall.com',
                isActive: true,
                isPublic: true,
                isFeatured: true,
                ratingAverage: randomRating(4.0, 4.9),
                ratingCount: randomRatingCount(35, 120)
            },
            {
                name: 'Handy Helpers',
                description: 'Professional handyman services for all your home repair needs. Quick, reliable, and affordable.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '124 Helper Way',
                city: 'Charlotte',
                state: 'NC',
                zipCode: '28201',
                phone: '(555) 303-4041',
                email: 'contact@handyhelpers.com',
                isActive: true,
                isPublic: true,
                isFeatured: false,
                ratingAverage: randomRating(3.9, 4.7),
                ratingCount: randomRatingCount(25, 85)
            },

            // Additional businesses in various zip codes for testing
            {
                name: 'Ace Plumbing Services',
                description: 'Professional plumbing solutions. Licensed, bonded, and insured. Same-day service available.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '235 Service Road',
                city: 'New York',
                state: 'NY',
                zipCode: '10001',
                phone: '(555) 111-2233',
                email: 'info@aceplumbing.com',
                isActive: true,
                isPublic: true,
                isFeatured: false,
                ratingAverage: randomRating(4.0, 4.8),
                ratingCount: randomRatingCount(30, 90)
            },
            {
                name: 'City Electric Services',
                description: 'Full-service electrical contractor. Residential and commercial electrical work.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '346 Power Street',
                city: 'New York',
                state: 'NY',
                zipCode: '10001',
                phone: '(555) 111-2244',
                email: 'contact@cityelectric.com',
                isActive: true,
                isPublic: true,
                isFeatured: false,
                ratingAverage: randomRating(4.1, 4.9),
                ratingCount: randomRatingCount(25, 75)
            },
            {
                name: 'Metro Cleaning Co.',
                description: 'Professional cleaning services. Residential, commercial, and move-in/out cleaning.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '457 Clean Avenue',
                city: 'New York',
                state: 'NY',
                zipCode: '10001',
                phone: '(555) 111-2255',
                email: 'info@metrocleaning.com',
                isActive: true,
                isPublic: true,
                isFeatured: false,
                ratingAverage: randomRating(3.8, 4.6),
                ratingCount: randomRatingCount(20, 65)
            },
            {
                name: 'Sunshine HVAC',
                description: 'Heating and air conditioning services. Installation, repair, and maintenance.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '568 Climate Drive',
                city: 'Los Angeles',
                state: 'CA',
                zipCode: '90001',
                phone: '(555) 222-3344',
                email: 'hello@sunshinehvac.com',
                isActive: true,
                isPublic: true,
                isFeatured: false,
                ratingAverage: randomRating(4.0, 4.8),
                ratingCount: randomRatingCount(28, 88)
            },
            {
                name: 'Pacific Landscaping',
                description: 'Complete landscaping services. Design, installation, and maintenance.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '679 Garden Way',
                city: 'Los Angeles',
                state: 'CA',
                zipCode: '90001',
                phone: '(555) 222-3355',
                email: 'info@pacificlandscaping.com',
                isActive: true,
                isPublic: true,
                isFeatured: false,
                ratingAverage: randomRating(4.2, 4.9),
                ratingCount: randomRatingCount(22, 70)
            },
            {
                name: 'Windy City Painters',
                description: 'Professional painting services. Interior and exterior painting with quality materials.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '780 Paint Street',
                city: 'Chicago',
                state: 'IL',
                zipCode: '60601',
                phone: '(555) 333-4455',
                email: 'contact@windycitypainters.com',
                isActive: true,
                isPublic: true,
                isFeatured: false,
                ratingAverage: randomRating(3.9, 4.7),
                ratingCount: randomRatingCount(18, 60)
            },
            {
                name: 'Chicago Flooring Experts',
                description: 'Expert flooring installation and repair. All types of flooring available.',
                categoryId: categories.find(c => c.name === 'Home Services')?.id || categories[0]?.id,
                address: '891 Floor Lane',
                city: 'Chicago',
                state: 'IL',
                zipCode: '60601',
                phone: '(555) 333-4466',
                email: 'info@chicagoflooring.com',
                isActive: true,
                isPublic: true,
                isFeatured: false,
                ratingAverage: randomRating(4.1, 4.9),
                ratingCount: randomRatingCount(25, 82)
            }
        ];

        console.log(`📝 Creating ${businessesData.length} businesses...\n`);

        let createdCount = 0;
        let skippedCount = 0;

        for (const businessData of businessesData) {
            try {
                // Check if business already exists
                const existing = await Business.findOne({
                    where: { name: businessData.name }
                });

                if (existing) {
                    console.log(`⏭️  Skipped: ${businessData.name} (already exists)`);
                    skippedCount++;
                    continue;
                }

                // Generate unique slug
                const slug = generateSlug(businessData.name);

                // Create business
                const business = await Business.create({
                    ...businessData,
                    slug,
                    ownerId: testUser.id,
                    approvedAt: new Date(),
                    isVerified: true
                });

                createdCount++;
                console.log(`✅ Created: ${business.name} (${business.city}, ${business.state} ${business.zipCode})`);
            } catch (error) {
                console.error(`❌ Error creating ${businessData.name}:`, error.message);
            }
        }

        // Count total businesses
        const totalBusinesses = await Business.count({ where: { isActive: true, isPublic: true } });

        console.log('\n✨ Seeding completed!');
        console.log(`📊 Statistics:`);
        console.log(`   - Businesses created: ${createdCount}`);
        console.log(`   - Businesses skipped: ${skippedCount}`);
        console.log(`   - Total active businesses: ${totalBusinesses}\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding businesses:', error);
        process.exit(1);
    }
};

// Run the seed function
if (require.main === module) {
    seedBusinesses();
}

module.exports = seedBusinesses;


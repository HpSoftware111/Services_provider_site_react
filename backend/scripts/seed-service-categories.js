const { ServiceCategory, ServiceSubCategory } = require('../models');
const { sequelize } = require('../config/database');
require('dotenv').config();

const serviceCategoriesData = [
    {
        name: 'Plumbing',
        icon: 'droplet',
        description: 'Professional plumbing services including repairs, installations, and maintenance',
        subCategories: [
            { name: 'Leak Repair', description: 'Fix water leaks in pipes, faucets, and fixtures' },
            { name: 'Drain Cleaning', description: 'Unclog and clean drains, sewers, and pipes' },
            { name: 'Water Heater', description: 'Installation, repair, and maintenance of water heaters' },
            { name: 'Pipe Installation', description: 'New pipe installation and replacement' },
            { name: 'Fixture Installation', description: 'Install sinks, toilets, showers, and faucets' },
            { name: 'Emergency Plumbing', description: '24/7 emergency plumbing services' }
        ]
    },
    {
        name: 'Electrical',
        icon: 'bolt',
        description: 'Electrical services for homes and businesses',
        subCategories: [
            { name: 'Electrical Repair', description: 'Fix electrical issues and faulty wiring' },
            { name: 'Panel Upgrade', description: 'Upgrade electrical panels and circuit breakers' },
            { name: 'Outlet Installation', description: 'Install new electrical outlets and switches' },
            { name: 'Lighting Installation', description: 'Install indoor and outdoor lighting' },
            { name: 'Ceiling Fan Installation', description: 'Install and repair ceiling fans' },
            { name: 'Electrical Inspection', description: 'Safety inspections and code compliance' }
        ]
    },
    {
        name: 'HVAC',
        icon: 'snowflake',
        description: 'Heating, ventilation, and air conditioning services',
        subCategories: [
            { name: 'AC Installation', description: 'Install new air conditioning systems' },
            { name: 'AC Repair', description: 'Repair and maintain air conditioning units' },
            { name: 'Heating Installation', description: 'Install furnaces and heating systems' },
            { name: 'Heating Repair', description: 'Repair and maintain heating systems' },
            { name: 'Duct Cleaning', description: 'Clean air ducts and ventilation systems' },
            { name: 'Thermostat Installation', description: 'Install and program smart thermostats' }
        ]
    },
    {
        name: 'Cleaning',
        icon: 'broom',
        description: 'Professional cleaning services for homes and offices',
        subCategories: [
            { name: 'Deep Cleaning', description: 'Thorough deep cleaning of entire property' },
            { name: 'Regular Cleaning', description: 'Weekly or monthly regular cleaning service' },
            { name: 'Move-in/Move-out Cleaning', description: 'Cleaning before moving in or out' },
            { name: 'Carpet Cleaning', description: 'Professional carpet and rug cleaning' },
            { name: 'Window Cleaning', description: 'Interior and exterior window cleaning' },
            { name: 'Office Cleaning', description: 'Commercial office cleaning services' }
        ]
    },
    {
        name: 'Landscaping',
        icon: 'leaf',
        description: 'Landscape design, installation, and maintenance',
        subCategories: [
            { name: 'Lawn Mowing', description: 'Regular lawn mowing and trimming' },
            { name: 'Garden Design', description: 'Design and plan new gardens' },
            { name: 'Tree Services', description: 'Tree planting, pruning, and removal' },
            { name: 'Irrigation', description: 'Install and repair sprinkler systems' },
            { name: 'Hardscaping', description: 'Patios, walkways, and retaining walls' },
            { name: 'Seasonal Cleanup', description: 'Spring and fall yard cleanup' }
        ]
    },
    {
        name: 'Painting',
        icon: 'paint-brush',
        description: 'Interior and exterior painting services',
        subCategories: [
            { name: 'Interior Painting', description: 'Paint interior walls, ceilings, and trim' },
            { name: 'Exterior Painting', description: 'Paint exterior walls and surfaces' },
            { name: 'Cabinet Painting', description: 'Paint and refinish kitchen cabinets' },
            { name: 'Deck Staining', description: 'Stain and seal decks and patios' },
            { name: 'Pressure Washing', description: 'Clean exterior surfaces before painting' },
            { name: 'Color Consultation', description: 'Help choose paint colors and schemes' }
        ]
    },
    {
        name: 'Carpentry',
        icon: 'hammer',
        description: 'Custom carpentry and woodworking services',
        subCategories: [
            { name: 'Custom Cabinets', description: 'Build custom kitchen and bathroom cabinets' },
            { name: 'Shelving Installation', description: 'Install custom shelves and storage' },
            { name: 'Trim Work', description: 'Install crown molding, baseboards, and trim' },
            { name: 'Deck Building', description: 'Build and repair decks and porches' },
            { name: 'Furniture Building', description: 'Custom furniture construction' },
            { name: 'Door Installation', description: 'Install interior and exterior doors' }
        ]
    },
    {
        name: 'Flooring',
        icon: 'th',
        description: 'Flooring installation and repair services',
        subCategories: [
            { name: 'Hardwood Installation', description: 'Install hardwood flooring' },
            { name: 'Tile Installation', description: 'Install ceramic, porcelain, and stone tiles' },
            { name: 'Carpet Installation', description: 'Install new carpeting' },
            { name: 'Laminate Installation', description: 'Install laminate and vinyl flooring' },
            { name: 'Floor Repair', description: 'Repair damaged floors' },
            { name: 'Floor Refinishing', description: 'Refinish and restore hardwood floors' }
        ]
    },
    {
        name: 'Roofing',
        icon: 'home',
        description: 'Roof installation, repair, and maintenance',
        subCategories: [
            { name: 'Roof Installation', description: 'Install new roofs and replace old ones' },
            { name: 'Roof Repair', description: 'Repair leaks and damaged roofing' },
            { name: 'Gutter Installation', description: 'Install and repair gutters' },
            { name: 'Gutter Cleaning', description: 'Clean and maintain gutters' },
            { name: 'Roof Inspection', description: 'Professional roof inspections' },
            { name: 'Siding Installation', description: 'Install and repair exterior siding' }
        ]
    },
    {
        name: 'Handyman',
        icon: 'tools',
        description: 'General handyman services for various home repairs',
        subCategories: [
            { name: 'General Repairs', description: 'Various small repairs and fixes' },
            { name: 'Furniture Assembly', description: 'Assemble furniture and equipment' },
            { name: 'TV Mounting', description: 'Mount TVs and install wall brackets' },
            { name: 'Picture Hanging', description: 'Hang pictures, mirrors, and artwork' },
            { name: 'Door Repair', description: 'Repair doors, locks, and hinges' },
            { name: 'Window Repair', description: 'Repair windows and screens' }
        ]
    }
];

const seedServiceCategories = async () => {
    try {
        console.log('🌱 Starting to seed service categories...\n');

        // Connect to database
        await sequelize.authenticate();
        console.log('✅ Database connected\n');

        // Clear existing data (optional - comment out if you want to keep existing data)
        console.log('🗑️  Clearing existing service categories...');
        await ServiceSubCategory.destroy({ where: {}, force: true });
        await ServiceCategory.destroy({ where: {}, force: true });
        console.log('✅ Cleared existing data\n');

        // Create categories and subcategories
        for (const categoryData of serviceCategoriesData) {
            const { subCategories, ...categoryInfo } = categoryData;

            console.log(`📦 Creating category: ${categoryInfo.name}`);
            const category = await ServiceCategory.create(categoryInfo);

            if (subCategories && subCategories.length > 0) {
                console.log(`   └─ Creating ${subCategories.length} subcategories...`);
                for (const subCategoryData of subCategories) {
                    await ServiceSubCategory.create({
                        ...subCategoryData,
                        categoryId: category.id
                    });
                }
                console.log(`   ✅ Created ${subCategories.length} subcategories for ${categoryInfo.name}\n`);
            }
        }

        // Count results
        const categoryCount = await ServiceCategory.count();
        const subCategoryCount = await ServiceSubCategory.count();

        console.log('\n✨ Seeding completed successfully!');
        console.log(`📊 Statistics:`);
        console.log(`   - Categories created: ${categoryCount}`);
        console.log(`   - Subcategories created: ${subCategoryCount}\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding service categories:', error);
        process.exit(1);
    }
};

// Run the seed function
if (require.main === module) {
    seedServiceCategories();
}

module.exports = seedServiceCategories;


/**
 * Generate XML Sitemap for SEO
 * 
 * This script generates a sitemap.xml file with all SEO landing pages
 * 
 * Usage: node backend/scripts/generate-sitemap.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');
const Category = require('../models/Category');
const Business = require('../models/Business');
const { Op } = require('sequelize');

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

async function generateSitemap() {
  try {
    console.log('🗺️  Generating sitemap...\n');

    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Get sitemap data directly from database
    const categories = await Category.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'slug']
    });

    const cities = await Business.findAll({
      attributes: [
        'city',
        'state',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        isActive: true,
        isPublic: true,
        city: { [Op.ne]: null },
        state: { [Op.ne]: null }
      },
      group: ['city', 'state'],
      having: sequelize.literal('count > 0'),
      raw: true
    });

    const zipCodes = await Business.findAll({
      attributes: [
        'zipCode',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        isActive: true,
        isPublic: true,
        zipCode: { [Op.ne]: null }
      },
      group: ['zipCode'],
      having: sequelize.literal('count > 0'),
      raw: true
    });

    const sitemapData = {
      categories: categories.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug
      })),
      cities: cities.map(c => ({
        city: c.city,
        state: c.state,
        slug: generateSlug(`${c.city}-${c.state}`)
      })),
      zipCodes: zipCodes.map(z => z.zipCode)
    };

    console.log(`📊 Found:`);
    console.log(`  - ${sitemapData.categories.length} categories`);
    console.log(`  - ${sitemapData.cities.length} cities`);
    console.log(`  - ${sitemapData.zipCodes.length} ZIP codes\n`);

    // Start building sitemap
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n`;

    // Add homepage
    sitemap += `  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>\n`;

    // Add main category pages
    sitemapData.categories.forEach(category => {
      sitemap += `  <url>
    <loc>${BASE_URL}/category/${category.slug}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
    });

    // Add SEO landing pages: service-in-city
    let cityPageCount = 0;
    sitemapData.categories.forEach(category => {
      sitemapData.cities.forEach(city => {
        sitemap += `  <url>
    <loc>${BASE_URL}/seo/${category.slug}/city/${city.slug}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
        cityPageCount++;
      });
    });

    console.log(`✅ Generated ${cityPageCount} city-based SEO pages`);

    // Add SEO landing pages: service-in-zipcode (limit to top ZIP codes to avoid huge sitemap)
    const topZipCodes = sitemapData.zipCodes.slice(0, 50); // Limit to top 50 ZIP codes per category
    let zipPageCount = 0;
    sitemapData.categories.forEach(category => {
      topZipCodes.forEach(zipCode => {
        sitemap += `  <url>
    <loc>${BASE_URL}/seo/${category.slug}/zipcode/${zipCode}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>\n`;
        zipPageCount++;
      });
    });

    console.log(`✅ Generated ${zipPageCount} ZIP code-based SEO pages`);

    // Close sitemap
    sitemap += '</urlset>';

    // Write sitemap to public directory
    const publicDir = path.join(__dirname, '../../frontend/public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const sitemapPath = path.join(publicDir, 'sitemap.xml');
    fs.writeFileSync(sitemapPath, sitemap, 'utf8');

    const totalUrls = 1 + categories.length + cityPageCount + zipPageCount;
    console.log(`\n✅ Sitemap generated successfully!`);
    console.log(`   Total URLs: ${totalUrls}`);
    console.log(`   Location: ${sitemapPath}`);
    console.log(`\n💡 Upload sitemap.xml to Google Search Console`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating sitemap:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  generateSitemap();
}

module.exports = generateSitemap;

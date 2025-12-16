# SEO Setup Guide - Milestone 7

This guide covers the SEO implementation for the home services directory platform.

## Features Implemented

### 1. SEO Landing Pages
- **Service Type + City**: `/seo/{service-slug}/city/{city-slug}`
  - Example: `/seo/electricians/city/miami-fl`
- **Service Type + ZIP Code**: `/seo/{service-slug}/zipcode/{zipcode}`
  - Example: `/seo/electricians/zipcode/33101`

### 2. Metadata & SEO Tags
- Title tags optimized for search
- Meta descriptions
- Open Graph tags (Facebook)
- Twitter Card tags
- Canonical URLs
- Structured data (JSON-LD)

### 3. Sitemap Generation
- Automated sitemap.xml generation
- Includes all SEO landing pages
- Updates automatically

### 4. Google Analytics Integration
- Page view tracking
- Route change tracking
- Ready for conversion tracking

## Setup Instructions

### Step 1: Install Dependencies
```bash
cd frontend
npm install react-helmet-async
```

### Step 2: Configure Environment Variables

Add to `frontend/.env`:
```env
VITE_GA_TRACKING_ID=G-XXXXXXXXXX  # Your Google Analytics tracking ID
```

Add to `backend/.env`:
```env
FRONTEND_URL=https://yourdomain.com  # Your production domain
```

### Step 3: Generate Sitemap

Run the sitemap generation script:
```bash
node backend/scripts/generate-sitemap.js
```

This creates `frontend/public/sitemap.xml` with all SEO landing pages.

### Step 4: Update robots.txt

Edit `frontend/public/robots.txt` and replace:
```
Sitemap: https://yourdomain.com/sitemap.xml
```
with your actual domain.

### Step 5: Add Google Analytics to App

In `frontend/src/App.jsx`, add:
```jsx
import GoogleAnalytics from './components/GoogleAnalytics';

// Inside your App component:
<GoogleAnalytics />
```

### Step 6: Submit to Google Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add your property (website)
3. Verify ownership
4. Submit sitemap: `https://yourdomain.com/sitemap.xml`

## SEO Landing Page Structure

Each SEO landing page includes:

1. **Hero Section**
   - Service name + location
   - Business count
   - Average rating

2. **Business Listings**
   - Top businesses in that location
   - Ratings and reviews
   - Contact information

3. **SEO Content**
   - Optimized text content
   - Local keywords
   - Internal links

4. **Sidebar**
   - Popular locations
   - Related services

## API Endpoints

### Get SEO Page Data
```
GET /api/seo/:serviceSlug/:locationType/:locationSlug
```

**Parameters:**
- `serviceSlug`: Category slug (e.g., "electricians")
- `locationType`: "city" or "zipcode"
- `locationSlug`: City slug or ZIP code

**Response:**
```json
{
  "success": true,
  "category": { ... },
  "location": { ... },
  "businesses": [ ... ],
  "averageRating": 4.5,
  "popularLocations": [ ... ],
  "relatedServices": [ ... ],
  "meta": {
    "title": "...",
    "description": "...",
    "keywords": "..."
  }
}
```

### Get Sitemap Data
```
GET /api/seo/sitemap-data
```

Returns all categories, cities, and ZIP codes for sitemap generation.

## Expected SEO Pages

With typical data:
- **3-5 categories** × **20-30 cities** = **60-150 city pages**
- **3-5 categories** × **50 ZIP codes** = **150-250 ZIP pages**
- **Total: 210-400 SEO landing pages**

## Best Practices

1. **Update Sitemap Regularly**
   - Run sitemap generation weekly or when new locations are added
   - Consider automating with cron job

2. **Monitor Performance**
   - Check Google Search Console for indexing status
   - Monitor page views in Google Analytics
   - Track keyword rankings

3. **Content Quality**
   - Ensure each landing page has unique, valuable content
   - Keep business listings up to date
   - Add local business hours, services, etc.

4. **Link Building**
   - Internal links between related pages
   - External links from local directories
   - Social media sharing

## Troubleshooting

### Sitemap Not Generating
- Ensure backend server is running
- Check API endpoint: `/api/seo/sitemap-data`
- Verify database has categories and businesses

### Google Analytics Not Tracking
- Verify tracking ID in `.env`
- Check browser console for errors
- Ensure GoogleAnalytics component is added to App

### Pages Not Indexing
- Submit sitemap to Google Search Console
- Check robots.txt allows crawling
- Verify pages are accessible (no 404 errors)
- Wait 1-2 weeks for initial indexing

## Next Steps

1. **Content Enhancement**
   - Add more detailed descriptions
   - Include local landmarks/references
   - Add FAQ sections

2. **Schema Markup**
   - Add LocalBusiness schema
   - Add Review schema
   - Add FAQ schema

3. **Performance Optimization**
   - Image optimization
   - Lazy loading
   - CDN setup

4. **Link Building**
   - Local directory submissions
   - Social media profiles
   - Content marketing

## Support

For issues or questions, check:
- Backend logs: `backend/logs/`
- Browser console for frontend errors
- Google Search Console for indexing issues

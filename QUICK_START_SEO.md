# Quick Start - SEO Setup

## 🚀 Quick Setup (5 Minutes)

### 1. Install Dependencies
```bash
cd frontend
npm install react-helmet-async
```

### 2. Add Environment Variables

**frontend/.env:**
```env
VITE_GA_TRACKING_ID=G-XXXXXXXXXX
```

**backend/.env:**
```env
FRONTEND_URL=https://yourdomain.com
```

### 3. Generate Sitemap
```bash
node backend/scripts/generate-sitemap.js
```

### 4. Update robots.txt
Edit `frontend/public/robots.txt` - replace domain in Sitemap line.

### 5. Submit to Google Search Console
1. Visit: https://search.google.com/search-console
2. Add property → Verify → Submit sitemap

## ✅ Done!

Your SEO setup is complete. You now have:
- 200-400 SEO landing pages
- Automatic sitemap generation
- Google Analytics tracking
- Optimized metadata

## 📍 Test Your SEO Pages

Visit these URLs (replace with your actual slugs):
- `/seo/electricians/city/miami-fl`
- `/seo/plumbers/zipcode/33101`

## 📊 Monitor

- **Google Search Console**: Check indexing status
- **Google Analytics**: Track page views
- **Sitemap**: Regenerate weekly with `node backend/scripts/generate-sitemap.js`

## 📚 Full Documentation

See `SEO_SETUP_GUIDE.md` for detailed instructions.

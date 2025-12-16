import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Google Analytics Component
 * 
 * Add your Google Analytics tracking ID to .env:
 * REACT_APP_GA_TRACKING_ID=G-XXXXXXXXXX
 * 
 * Usage: Add <GoogleAnalytics /> to your App.jsx
 */
const GoogleAnalytics = () => {
  const location = useLocation();
  const trackingId = import.meta.env.VITE_GA_TRACKING_ID || process.env.REACT_APP_GA_TRACKING_ID;

  useEffect(() => {
    // Initialize Google Analytics
    if (trackingId && typeof window !== 'undefined') {
      // Load gtag script
      const script1 = document.createElement('script');
      script1.async = true;
      script1.src = `https://www.googletagmanager.com/gtag/js?id=${trackingId}`;
      document.head.appendChild(script1);

      // Initialize gtag
      window.dataLayer = window.dataLayer || [];
      function gtag(...args) {
        window.dataLayer.push(args);
      }
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', trackingId, {
        page_path: location.pathname + location.search,
      });
    }
  }, []);

  // Track page views on route change
  useEffect(() => {
    if (trackingId && typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', trackingId, {
        page_path: location.pathname + location.search,
        page_title: document.title,
      });
    }
  }, [location, trackingId]);

  return null;
};

export default GoogleAnalytics;

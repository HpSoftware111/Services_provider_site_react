import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import api from '../services/api';
import './SEOLandingPage.css';

const SEOLandingPage = () => {
  const { serviceSlug, locationType, locationSlug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSEOPageData();
  }, [serviceSlug, locationType, locationSlug]);

  const loadSEOPageData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/seo/${serviceSlug}/${locationType}/${locationSlug}`);
      setData(response.data);
      setBusinesses(response.data.businesses || []);
    } catch (err) {
      console.error('Error loading SEO page:', err);
      setError('Page not found');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="seo-landing-page">
        <div className="loading">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="seo-landing-page">
        <div className="error-message">
          <h1>Page Not Found</h1>
          <p>The page you're looking for doesn't exist.</p>
          <Link to="/">Go to Home</Link>
        </div>
      </div>
    );
  }

  const { category, location, meta } = data;
  const locationName = locationType === 'city' ? location.city : location.zipCode;
  const locationFull = locationType === 'city'
    ? `${location.city}, ${location.state}`
    : `${location.zipCode}`;

  // Generate structured data (JSON-LD)
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": `${category.name} in ${locationFull}`,
    "description": meta.description,
    "url": window.location.href,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": location.city,
      "addressRegion": location.state,
      "postalCode": location.zipCode || ""
    }
  };

  return (
    <>
      <Helmet>
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        <meta name="keywords" content={meta.keywords} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:image" content={meta.image || '/logo.png'} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={window.location.href} />
        <meta name="twitter:title" content={meta.title} />
        <meta name="twitter:description" content={meta.description} />
        <meta name="twitter:image" content={meta.image || '/logo.png'} />

        {/* Canonical URL */}
        <link rel="canonical" href={window.location.href} />

        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <div className="seo-landing-page">
        {/* Hero Section */}
        <section className="seo-hero">
          <div className="container">
            <h1 className="seo-title">
              {category.name} in {locationFull}
            </h1>
            <p className="seo-subtitle">
              Find the best {category.name.toLowerCase()} professionals in {locationFull}.
              Browse verified businesses, read reviews, and get quotes.
            </p>
            {businesses.length > 0 && (
              <div className="seo-stats">
                <span className="stat-item">
                  <strong>{businesses.length}</strong> {businesses.length === 1 ? 'Business' : 'Businesses'}
                </span>
                <span className="stat-item">
                  <strong>{data.averageRating?.toFixed(1) || '4.5'}</strong> Average Rating
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Main Content */}
        <div className="container seo-content">
          <div className="seo-main">
            {/* Featured Businesses */}
            {businesses.length > 0 ? (
              <section className="seo-businesses">
                <h2>Top {category.name} in {locationFull}</h2>
                <div className="businesses-grid">
                  {businesses.slice(0, 12).map((business) => (
                    <div key={business.id} className="business-card">
                      <Link to={`/business/${business.slug}`} className="business-link">
                        <div className="business-header">
                          <h3>{business.name}</h3>
                          {business.ratingAverage > 0 && (
                            <div className="business-rating">
                              <span className="stars">
                                {'★'.repeat(Math.floor(business.ratingAverage))}
                                {'☆'.repeat(5 - Math.floor(business.ratingAverage))}
                              </span>
                              <span className="rating-value">{business.ratingAverage.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                        {business.description && (
                          <p className="business-description">
                            {business.description.substring(0, 150)}...
                          </p>
                        )}
                        <div className="business-info">
                          <span className="business-location">
                            <i className="fas fa-map-marker-alt"></i>
                            {business.city}, {business.state}
                          </span>
                          {business.phone && (
                            <span className="business-phone">
                              <i className="fas fa-phone"></i>
                              {business.phone}
                            </span>
                          )}
                        </div>
                        {business.isFeatured && (
                          <span className="featured-badge">Featured</span>
                        )}
                      </Link>
                    </div>
                  ))}
                </div>
                {businesses.length > 12 && (
                  <div className="view-all">
                    <Link to={`/category/${category.slug}?city=${location.city}&state=${location.state}`} className="btn-view-all">
                      View All {businesses.length} Businesses
                    </Link>
                  </div>
                )}
              </section>
            ) : (
              <section className="seo-no-businesses">
                <h2>No businesses found</h2>
                <p>We don't have any {category.name.toLowerCase()} businesses listed in {locationFull} yet.</p>
                <Link to="/add-business" className="btn-add-business">
                  Add Your Business
                </Link>
              </section>
            )}

            {/* SEO Content Section */}
            <section className="seo-article">
              <h2>Find the Best {category.name} Services in {locationFull}</h2>
              <div className="article-content">
                <p>
                  Looking for reliable {category.name.toLowerCase()} services in {locationFull}?
                  You've come to the right place. Our directory features verified professionals
                  who are ready to help with your needs.
                </p>

                <h3>Why Choose Our {category.name} Directory?</h3>
                <ul>
                  <li>Verified businesses with real reviews</li>
                  <li>Easy comparison of services and prices</li>
                  <li>Direct contact with service providers</li>
                  <li>Local professionals you can trust</li>
                </ul>

                <h3>How to Find the Right {category.name} Professional</h3>
                <p>
                  Browse through our listings to find {category.name.toLowerCase()} professionals
                  in {locationFull}. Check their ratings, read customer reviews, and compare
                  services to find the best match for your needs.
                </p>
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="seo-sidebar">
            <div className="sidebar-widget">
              <h3>Popular Locations</h3>
              <ul className="location-links">
                {data.popularLocations?.map((loc, idx) => (
                  <li key={idx}>
                    <Link to={`/seo/${serviceSlug}/city/${loc.slug}`}>
                      {loc.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="sidebar-widget">
              <h3>Related Services</h3>
              <ul className="service-links">
                {data.relatedServices?.map((service, idx) => (
                  <li key={idx}>
                    <Link to={`/seo/${service.slug}/${locationType}/${locationSlug}`}>
                      {service.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
};

export default SEOLandingPage;

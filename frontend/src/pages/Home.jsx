import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('');
  const [categories, setCategories] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [businessSuggestions, setBusinessSuggestions] = useState([]);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showBusinessSuggestions, setShowBusinessSuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const businessInputRef = useRef(null);
  const locationInputRef = useRef(null);
  const carouselRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [categoriesRes, businessesRes, profilesRes] = await Promise.all([
        api.get('/categories'),
        api.get('/businesses?limit=6&featured=true'),
        api.get('/businesses/profiles?limit=100').catch(() => ({ data: { profiles: [] } }))
      ]);
      setCategories(categoriesRes.data.categories || []);
      setBusinesses(businessesRes.data.businesses || []);
      setProfiles(profilesRes.data.profiles || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.append('q', searchQuery);
    if (location) params.append('city', location);
    navigate(`/search?${params.toString()}`);
    setShowBusinessSuggestions(false);
    setShowLocationSuggestions(false);
  };

  const handleBusinessInputChange = async (value) => {
    setSearchQuery(value);

    if (value.length > 1) {
      try {
        const response = await api.get(`/businesses?limit=5&search=${value}`);
        setBusinessSuggestions(response.data.businesses || []);
        setShowBusinessSuggestions(true);
      } catch (error) {
      }
    } else {
      setBusinessSuggestions([]);
      setShowBusinessSuggestions(false);
    }
  };

  const handleLocationInputChange = async (value) => {
    setLocation(value);

    if (value.length > 1) {
      try {
        const response = await api.get(`/businesses?limit=100`);
        const uniqueLocations = [...new Set(
          response.data.businesses.map(b => `${b.city}, ${b.state}`)
        )].filter(loc =>
          loc.toLowerCase().includes(value.toLowerCase())
        ).slice(0, 5);

        setLocationSuggestions(uniqueLocations);
        setShowLocationSuggestions(true);
      } catch (error) {
      }
    } else {
      setLocationSuggestions([]);
      setShowLocationSuggestions(false);
    }
  };

  const selectBusinessSuggestion = (business) => {
    setSearchQuery(business.name);
    setShowBusinessSuggestions(false);
    navigate(`/businesses/${business.id}`);
  };

  const selectLocationSuggestion = (location) => {
    setLocation(location);
    setShowLocationSuggestions(false);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (businessInputRef.current && !businessInputRef.current.contains(e.target)) {
        setShowBusinessSuggestions(false);
      }
      if (locationInputRef.current && !locationInputRef.current.contains(e.target)) {
        setShowLocationSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <h1>Discover Businesses Near You</h1>
            <p>Helping you find the best service providers in your area</p>
            <div className="hero-action-buttons">
              <button
                className="btn-request-service"
                onClick={() => navigate('/service-request')}
              >
                <i className="fas fa-plus-circle"></i>
                Request a Service
              </button>
            </div>
            <form onSubmit={handleSearch} className="search-box">
              <div className="search-input-wrapper" ref={businessInputRef}>
                <input
                  type="text"
                  placeholder="Search for businesses..."
                  value={searchQuery}
                  onChange={(e) => handleBusinessInputChange(e.target.value)}
                  onFocus={() => searchQuery.length > 1 && setShowBusinessSuggestions(true)}
                />
                {showBusinessSuggestions && businessSuggestions.length > 0 && (
                  <div className="suggestions-dropdown">
                    {businessSuggestions.map((business) => (
                      <div
                        key={business.id}
                        className="suggestion-item"
                        onClick={() => selectBusinessSuggestion(business)}
                      >
                        <i className="fas fa-building"></i>
                        <div className="suggestion-content">
                          <strong>{business.name}</strong>
                          <span>{business.city}, {business.state}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="search-input-wrapper" ref={locationInputRef}>
                <input
                  type="text"
                  placeholder="Location (City, State)"
                  value={location}
                  onChange={(e) => handleLocationInputChange(e.target.value)}
                  onFocus={() => location.length > 1 && setShowLocationSuggestions(true)}
                />
                {showLocationSuggestions && locationSuggestions.length > 0 && (
                  <div className="suggestions-dropdown">
                    {locationSuggestions.map((loc, index) => (
                      <div
                        key={index}
                        className="suggestion-item"
                        onClick={() => selectLocationSuggestion(loc)}
                      >
                        <i className="fas fa-map-marker-alt"></i>
                        <div className="suggestion-content">
                          <strong>{loc}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" className="search-btn">
                <i className="fas fa-search"></i> Search
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="categories">
        <div className="container">
          <div className="section-header-with-action">
            <div className="section-title-group">
              <h2>Browse Categories</h2>
              <p>Explore businesses by category</p>
            </div>
            {categories.length > 8 && (
              <button className="btn-view-all" onClick={() => navigate('/categories')}>
                <span>View All Categories</span>
                <i className="fas fa-arrow-right"></i>
              </button>
            )}
          </div>
          {loading ? (
            <div className="loading"><div className="spinner"></div></div>
          ) : (
            <>
              <div className="categories-grid">
                {categories.slice(0, 8).map((category) => (
                  <div key={category.id} className="category-card" onClick={() => navigate(`/category/${category.slug}`)}>
                    <i className={`fas fa-${category.icon || 'briefcase'}`}></i>
                    <h3>{category.name}</h3>
                    <p>{category.businessCount || 0} businesses</p>
                  </div>
                ))}
              </div>
              {categories.length > 8 && (
                <div className="view-all-footer">
                  <p className="items-count">
                    <i className="fas fa-info-circle"></i> Showing 8 of {categories.length} categories
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Business Profiles Section */}
      {profiles.length > 0 && (
        <section className="business-profiles">
          <div className="container">
            <div className="section-header-with-action">
              <div className="section-title-group">
                <h2>Business Profiles</h2>
                <p>Discover business owners and their portfolios</p>
              </div>
              <button className="btn-view-all" onClick={() => navigate('/profiles')}>
                <span>View All Profiles</span>
                <i className="fas fa-arrow-right"></i>
              </button>
            </div>
            {loading ? (
              <div className="loading"><div className="spinner"></div></div>
            ) : (
              <div className="profiles-grid">
                {profiles.slice(0, 8).map((profile) => (
                  <div
                    key={profile.id}
                    className="profile-card"
                    onClick={() => navigate(`/profile/${profile.id}`)}
                  >
                    <div className="profile-card-avatar">
                      {profile.avatar ? (
                        <img src={profile.avatar} alt={profile.name} />
                      ) : (
                        <i className="fas fa-user-circle"></i>
                      )}
                    </div>
                    <div className="profile-card-content">
                      <h3>{profile.name}</h3>
                      <div className="profile-card-stats">
                        <span>
                          <i className="fas fa-building"></i>
                          {profile.businessCount} {profile.businessCount === 1 ? 'Business' : 'Businesses'}
                        </span>
                      </div>
                    </div>
                    <div className="profile-card-action">
                      <i className="fas fa-arrow-right"></i>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Top Businesses */}
      <section className="business-listings">
        <div className="container">
          <div className="section-header-with-action">
            <div className="section-title-group">
              <h2>Top Rated Business Listings</h2>
              <p>Discover the best businesses in your area</p>
            </div>
            {businesses.length > 0 && (
              <button className="btn-view-all" onClick={() => navigate('/businesses')}>
                <span>View All Businesses</span>
                <i className="fas fa-arrow-right"></i>
              </button>
            )}
          </div>
          {loading ? (
            <div className="loading"><div className="spinner"></div></div>
          ) : businesses.length > 0 ? (
            <div className="carousel-container">
              <button 
                className="carousel-btn carousel-btn-prev"
                onClick={() => {
                  const cardWidth = carouselRef.current?.querySelector('.carousel-card')?.offsetWidth || 325;
                  const gap = 25;
                  const scrollAmount = cardWidth + gap;
                  if (carouselRef.current) {
                    carouselRef.current.scrollBy({
                      left: -scrollAmount,
                      behavior: 'smooth'
                    });
                  }
                }}
                aria-label="Previous businesses"
              >
                <i className="fas fa-chevron-left"></i>
              </button>
              
              <div className="carousel-wrapper" ref={carouselRef}>
                <div className="carousel-track">
                  {businesses.map((business) => (
                    <div key={business.id} className="carousel-card" onClick={() => navigate(`/businesses/${business.id}`)}>
                      {business.owner && (
                        <div
                          className="listing-owner-avatar"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/profile/${business.owner.id}`);
                          }}
                          title={`View ${business.owner.name}'s profile`}
                        >
                          {business.owner.avatar ? (
                            <img src={business.owner.avatar} alt={business.owner.name} />
                          ) : (
                            <i className="fas fa-user-circle"></i>
                          )}
                        </div>
                      )}
                      <div className="listing-header">
                        <h3>{business.name}</h3>
                        <div className="rating">
                          <span className="stars">{'★'.repeat(Math.floor(parseFloat(business.ratingAverage) || 0))}</span>
                          <span className="rating-value">{parseFloat(business.ratingAverage) || 0}</span>
                        </div>
                      </div>
                      <p className="listing-description">{business.description?.substring(0, 100)}...</p>
                      <div className="listing-info">
                        <p><i className="fas fa-map-marker-alt"></i> {business.city}, {business.state}</p>
                        {business.category && <p><i className="fas fa-tag"></i> {business.category.name}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                className="carousel-btn carousel-btn-next"
                onClick={() => {
                  const cardWidth = carouselRef.current?.querySelector('.carousel-card')?.offsetWidth || 325;
                  const gap = 25;
                  const scrollAmount = cardWidth + gap;
                  if (carouselRef.current) {
                    carouselRef.current.scrollBy({
                      left: scrollAmount,
                      behavior: 'smooth'
                    });
                  }
                }}
                aria-label="Next businesses"
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          ) : (
            <div className="no-businesses">
              <p>No businesses available at the moment.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;


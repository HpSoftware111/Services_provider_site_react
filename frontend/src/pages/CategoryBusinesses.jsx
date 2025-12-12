import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './CategoryBusinesses.css';

const CategoryBusinesses = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [category, setCategory] = useState(null);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Search state
  const [searchName, setSearchName] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const nameInputRef = useRef(null);
  const locationInputRef = useRef(null);
  
  // Filter options from API
  const [filterOptions, setFilterOptions] = useState({
    states: [],
    statesWithCities: {},
    categories: []
  });
  
  // Selected filters - now arrays for multiple selection
  const [selectedStates, setSelectedStates] = useState([]);
  const [selectedCities, setSelectedCities] = useState([]);
  const [selectedRatings, setSelectedRatings] = useState([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState([]);
  const [sortBy, setSortBy] = useState('rating');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  
  // Expanded sections
  const [expandedSections, setExpandedSections] = useState({
    location: true,
    subcategory: true,
    rating: true,
    sort: false,
    featured: false
  });
  
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    // First load categories
    const loadInitialData = async () => {
      try {
        const categoriesResponse = await api.get('/categories');
        setCategories(categoriesResponse.data.categories || []);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };
    loadInitialData();
  }, []);

  // Load filter options when category changes (filtered by current category)
  useEffect(() => {
    if (categories.length > 0) {
      loadFilterOptions();
    }
  }, [categories, slug]);

  useEffect(() => {
    if (categories.length > 0) {
      loadCategoryAndBusinesses();
    }
  }, [categories, slug, page, selectedStates, selectedCities, selectedRatings, selectedSubcategories, sortBy, featuredOnly, searchName, searchLocation]);

  // Fetch name suggestions
  useEffect(() => {
    const fetchNameSuggestions = async () => {
      if (searchName.length < 2) {
        setNameSuggestions([]);
        return;
      }
      try {
        const foundCategory = categories.find(c => c.slug === slug);
        const params = { search: searchName, limit: 5 };
        if (foundCategory) params.category = foundCategory.id;
        const response = await api.get('/businesses', { params });
        setNameSuggestions(response.data.businesses || []);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      }
    };
    const debounce = setTimeout(fetchNameSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [searchName, categories, slug]);

  // Fetch location suggestions
  useEffect(() => {
    const fetchLocationSuggestions = async () => {
      if (searchLocation.length < 2) {
        setLocationSuggestions([]);
        return;
      }
      const allLocations = [];
      filterOptions.states.forEach(state => {
        if (state.toLowerCase().includes(searchLocation.toLowerCase())) {
          allLocations.push({ type: 'state', value: state });
        }
      });
      Object.entries(filterOptions.statesWithCities || {}).forEach(([state, cities]) => {
        cities.forEach(city => {
          if (city.toLowerCase().includes(searchLocation.toLowerCase())) {
            allLocations.push({ type: 'city', value: city, state });
          }
        });
      });
      setLocationSuggestions(allLocations.slice(0, 6));
    };
    const debounce = setTimeout(fetchLocationSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [searchLocation, filterOptions]);

  const loadFilterOptions = async () => {
    try {
      // Find the current category to filter locations by category
      const foundCategory = categories.find(c => c.slug === slug);
      const params = {};
      if (foundCategory) {
        params.categoryId = foundCategory.id;
      }
      
      const filterResponse = await api.get('/businesses/filter-options', { params });
      
      setFilterOptions({
        states: filterResponse.data.states || [],
        statesWithCities: filterResponse.data.statesWithCities || {},
        categories: filterResponse.data.categories || []
      });
      // Use categories from filter-options (already filtered to only show categories with businesses)
      if (categories.length === 0) {
        setCategories(filterResponse.data.categories || []);
      }
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const loadCategoryAndBusinesses = async () => {
    try {
      setLoading(true);
      
      const foundCategory = categories.find(c => c.slug === slug);
      
      if (!foundCategory && slug && categories.length > 0) {
        navigate('/');
        return;
      }
      
      if (foundCategory) {
        setCategory(foundCategory);
        
        // Load subcategories for this category
        try {
          const subResponse = await api.get(`/subcategories?categoryId=${foundCategory.id}`);
          setSubcategories(subResponse.data.subcategories || []);
        } catch (err) {
          setSubcategories([]);
        }
      }
      
      // Build query params
      const params = { page, limit: 12 };
      
      if (foundCategory) {
        params.category = foundCategory.id;
      }
      
      if (searchName) params.search = searchName;
      if (searchLocation) params.location = searchLocation;
      if (selectedStates.length > 0) params.states = selectedStates.join(',');
      if (selectedCities.length > 0) params.cities = selectedCities.join(',');
      if (selectedRatings.length > 0) params.ratings = selectedRatings.join(',');
      if (selectedSubcategories.length > 0) params.subCategories = selectedSubcategories.join(',');
      if (sortBy) params.sort = sortBy;
      if (featuredOnly) params.featured = 'true';
      
      const bizResponse = await api.get('/businesses', { params });
      setBusinesses(bizResponse.data.businesses || []);
      setTotalPages(bizResponse.data.pages || 1);
    } catch (error) {
      console.error('Error loading businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle functions for multiple selection
  const toggleState = (state) => {
    setSelectedStates(prev => {
      if (prev.includes(state)) {
        // Remove state and its cities
        const newStates = prev.filter(s => s !== state);
        setSelectedCities(prevCities => {
          const citiesInState = filterOptions.statesWithCities[state] || [];
          return prevCities.filter(city => !citiesInState.includes(city));
        });
        return newStates;
      } else {
        return [...prev, state];
      }
    });
    setPage(1);
  };

  const toggleCity = (city) => {
    setSelectedCities(prev => {
      if (prev.includes(city)) {
        return prev.filter(c => c !== city);
      } else {
        return [...prev, city];
      }
    });
    setPage(1);
  };

  const toggleRating = (rating) => {
    setSelectedRatings(prev => {
      if (prev.includes(rating)) {
        return prev.filter(r => r !== rating);
      } else {
        return [...prev, rating];
      }
    });
    setPage(1);
  };

  const toggleSubcategory = (subcategoryId) => {
    setSelectedSubcategories(prev => {
      if (prev.includes(subcategoryId)) {
        return prev.filter(s => s !== subcategoryId);
      } else {
        return [...prev, subcategoryId];
      }
    });
    setPage(1);
  };

  const clearAllFilters = () => {
    setSelectedStates([]);
    setSelectedCities([]);
    setSelectedRatings([]);
    setSelectedSubcategories([]);
    setSortBy('rating');
    setFeaturedOnly(false);
    setSearchName('');
    setSearchLocation('');
    setPage(1);
  };

  const handleNameSelect = (business) => {
    setSearchName(business.name);
    setShowNameSuggestions(false);
  };

  const handleLocationSelect = (location) => {
    if (location.type === 'state') {
      toggleState(location.value);
      setSearchLocation('');
    } else {
      toggleState(location.state);
      toggleCity(location.value);
      setSearchLocation('');
    }
    setShowLocationSuggestions(false);
    setPage(1);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setShowNameSuggestions(false);
    setShowLocationSuggestions(false);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Get cities from all selected states
  const availableCities = selectedStates.length > 0
    ? selectedStates.flatMap(state => filterOptions.statesWithCities[state] || [])
    : [];

  const hasActiveFilters = selectedStates.length > 0 || selectedCities.length > 0 || selectedRatings.length > 0 || selectedSubcategories.length > 0 || featuredOnly;

  const renderStars = (rating) => {
    const numRating = parseFloat(rating) || 0;
    const fullStars = Math.floor(numRating);
    const hasHalfStar = numRating % 1 >= 0.5;
    const stars = [];
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<i key={`full-${i}`} className="fas fa-star golden-star"></i>);
    }
    if (hasHalfStar) {
      stars.push(<i key="half" className="fas fa-star-half-alt golden-star"></i>);
    }
    const emptyStars = 5 - Math.ceil(numRating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<i key={`empty-${i}`} className="far fa-star empty-star"></i>);
    }
    
    return stars;
  };

  if (loading && !category && categories.length === 0) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="category-businesses-page">
      <div className="category-header">
        <div className="container">
          <button onClick={() => navigate('/')} className="back-button">
            <i className="fas fa-arrow-left"></i> Back to Home
          </button>
          <div className="category-title">
            <i className={`fas fa-${category?.icon || 'briefcase'}`}></i>
            <h1>{category?.name || 'Businesses'}</h1>
          </div>
          <p className="category-description">{category?.description || 'Browse our directory of businesses'}</p>
          
          {/* Search Bar */}
          <form className="search-bar" onSubmit={handleSearch}>
            <div className="search-input-group">
              <div className="search-field" ref={nameInputRef}>
                <i className="fas fa-search"></i>
              <input
                type="text"
                  placeholder="Business name or keyword..."
                  value={searchName}
                  onChange={(e) => { setSearchName(e.target.value); setShowNameSuggestions(true); }}
                  onFocus={() => setShowNameSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
                />
                {searchName && (
                  <button type="button" className="clear-input" onClick={() => setSearchName('')}>
                    <i className="fas fa-times"></i>
                  </button>
                )}
                {showNameSuggestions && nameSuggestions.length > 0 && (
                <div className="suggestions-dropdown">
                    {nameSuggestions.map((biz) => (
                      <div key={biz.id} className="suggestion-item" onMouseDown={() => handleNameSelect(biz)}>
                        <i className="fas fa-building"></i>
                        <div className="suggestion-info">
                          <span className="suggestion-name">{biz.name}</span>
                          <span className="suggestion-location">{biz.city}, {biz.state}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
              
              <div className="search-divider"></div>
              
              <div className="search-field" ref={locationInputRef}>
                <i className="fas fa-map-marker-alt"></i>
              <input
                type="text"
                  placeholder="City or State..."
                  value={searchLocation}
                  onChange={(e) => { setSearchLocation(e.target.value); setShowLocationSuggestions(true); }}
                  onFocus={() => setShowLocationSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                />
                {searchLocation && (
                  <button type="button" className="clear-input" onClick={() => setSearchLocation('')}>
                    <i className="fas fa-times"></i>
                  </button>
                )}
              {showLocationSuggestions && locationSuggestions.length > 0 && (
                <div className="suggestions-dropdown">
                    {locationSuggestions.map((loc, idx) => (
                      <div key={idx} className="suggestion-item" onMouseDown={() => handleLocationSelect(loc)}>
                        <i className={`fas fa-${loc.type === 'state' ? 'flag' : 'city'}`}></i>
                        <div className="suggestion-info">
                          <span className="suggestion-name">{loc.value}</span>
                          {loc.type === 'city' && <span className="suggestion-location">{loc.state}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>
            
            <button type="submit" className="search-btn">
              <i className="fas fa-search"></i> Search
            </button>
          </form>
          
          <div className="category-stats">
            <span><i className="fas fa-building"></i> {businesses.length} businesses found</span>
          </div>
        </div>
        </div>

      <div className="container">
        {/* Mobile Overlay */}
        {showFilters && (
          <div 
            className="filter-overlay"
            onClick={() => setShowFilters(false)}
          ></div>
        )}
        
        <div className="content-layout">
          {/* Filter Sidebar */}
          <aside className={`filter-sidebar ${showFilters ? 'show' : ''}`}>
            <div className="filter-header-row">
              <h2 className="filter-title">Filters</h2>
              {hasActiveFilters && (
                <button className="clear-all-btn" onClick={clearAllFilters}>
                  <i className="fas fa-undo"></i> Reset All
                </button>
              )}
            </div>

            {/* 1. Location Filter - State & City */}
            <div className="filter-section">
              <div className="filter-section-header" onClick={() => toggleSection('location')}>
                <h3 className="filter-section-title">
                  <i className="fas fa-map-marker-alt"></i> Location
                </h3>
                <i className={`fas fa-chevron-${expandedSections.location ? 'up' : 'down'}`}></i>
              </div>
              
              {expandedSections.location && (
                <div className="filter-section-content">
                  {/* State Selection */}
                  <div className="filter-subsection">
                    <div className="filter-subsection-header">
                      <span className="filter-label">State</span>
                      {selectedStates.length > 0 && (
                        <button className="clear-filter-btn" onClick={() => { setSelectedStates([]); setSelectedCities([]); setPage(1); }}>
                          <i className="fas fa-times-circle"></i>
                        </button>
                      )}
                    </div>
                    <div className="filter-options-list">
                      {filterOptions.states.map(state => (
                        <label key={state} className={`filter-checkbox-label ${selectedStates.includes(state) ? 'selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={selectedStates.includes(state)}
                            onChange={() => toggleState(state)}
                          />
                          <span className="checkbox-custom"></span>
                          <span className="filter-option-text">{state}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  {/* City Selection - Shows right after state is selected */}
                  {selectedStates.length > 0 && availableCities.length > 0 && (
                    <div className="filter-subsection city-subsection">
                      <div className="filter-subsection-header">
                        <span className="filter-label">
                          <i className="fas fa-angle-right"></i> City {selectedStates.length > 1 ? '(Multiple States)' : `in ${selectedStates[0]}`}
                        </span>
                        {selectedCities.length > 0 && (
                          <button className="clear-filter-btn" onClick={() => { setSelectedCities([]); setPage(1); }}>
                            <i className="fas fa-times-circle"></i>
                          </button>
                        )}
                      </div>
                      <div className="filter-options-list">
                        {availableCities.map(city => (
                          <label key={city} className={`filter-checkbox-label ${selectedCities.includes(city) ? 'selected' : ''}`}>
                            <input
                              type="checkbox"
                              checked={selectedCities.includes(city)}
                              onChange={() => toggleCity(city)}
                            />
                            <span className="checkbox-custom"></span>
                            <span className="filter-option-text">{city}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Subcategories */}
            {subcategories.length > 0 && (
            <div className="filter-section">
                <div className="filter-section-header" onClick={() => toggleSection('subcategory')}>
                  <h3 className="filter-section-title">
                    <i className="fas fa-folder"></i> Subcategory
                  </h3>
                  <i className={`fas fa-chevron-${expandedSections.subcategory ? 'up' : 'down'}`}></i>
                </div>
                
                {expandedSections.subcategory && (
                  <div className="filter-section-content">
                    <div className="filter-subsection">
                      <div className="filter-subsection-header">
                        <span className="filter-label">Type</span>
                        {selectedSubcategories.length > 0 && (
                          <button className="clear-filter-btn" onClick={() => { setSelectedSubcategories([]); setPage(1); }}>
                            <i className="fas fa-times-circle"></i>
                          </button>
                        )}
                      </div>
                      <div className="filter-options-list">
                        {subcategories.map(sub => (
                          <label key={sub.id} className={`filter-checkbox-label ${selectedSubcategories.includes(sub.id.toString()) ? 'selected' : ''}`}>
                            <input
                              type="checkbox"
                              checked={selectedSubcategories.includes(sub.id.toString())}
                              onChange={() => toggleSubcategory(sub.id.toString())}
                            />
                            <span className="checkbox-custom"></span>
                            <span className="filter-option-text">
                              <i className={`fas fa-${sub.icon || 'tag'}`}></i> {sub.name}
                              {sub.businessCount > 0 && <span className="count-badge">{sub.businessCount}</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. Rating Filter */}
            <div className="filter-section">
              <div className="filter-section-header" onClick={() => toggleSection('rating')}>
                <h3 className="filter-section-title">
                  <i className="fas fa-star"></i> Rating
                </h3>
                <i className={`fas fa-chevron-${expandedSections.rating ? 'up' : 'down'}`}></i>
              </div>
              
              {expandedSections.rating && (
                <div className="filter-section-content">
                  <div className="filter-subsection">
                    <div className="filter-subsection-header">
                      <span className="filter-label">Rating</span>
                      {selectedRatings.length > 0 && (
                        <button className="clear-filter-btn" onClick={() => { setSelectedRatings([]); setPage(1); }}>
                          <i className="fas fa-times-circle"></i>
                        </button>
                      )}
                    </div>
                    <div className="filter-options-list rating-options">
                      {[5, 4, 3, 2, 1].map(rating => (
                        <label key={rating} className={`filter-checkbox-label rating-label ${selectedRatings.includes(rating.toString()) ? 'selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={selectedRatings.includes(rating.toString())}
                            onChange={() => toggleRating(rating.toString())}
                          />
                          <span className="checkbox-custom"></span>
                          <span className="star-rating-display">
                            {Array(rating).fill(0).map((_, i) => (
                              <i key={i} className="fas fa-star"></i>
                            ))}
                            {Array(5 - rating).fill(0).map((_, i) => (
                              <i key={i} className="far fa-star"></i>
                            ))}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Sort Options */}
            <div className="filter-section">
              <div className="filter-section-header" onClick={() => toggleSection('sort')}>
                <h3 className="filter-section-title">
                  <i className="fas fa-sort"></i> Sort By
                </h3>
                <i className={`fas fa-chevron-${expandedSections.sort ? 'up' : 'down'}`}></i>
              </div>
              
              {expandedSections.sort && (
                <div className="filter-section-content">
              <select
                className="filter-select"
                    value={sortBy}
                    onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
              >
                <option value="rating">Highest Rated</option>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name">Name (A-Z)</option>
                <option value="views">Most Viewed</option>
              </select>
                </div>
              )}
            </div>

            {/* 5. Featured Filter */}
            <div className="filter-section">
              <div className="filter-section-header" onClick={() => toggleSection('featured')}>
                <h3 className="filter-section-title">
                  <i className="fas fa-crown"></i> Featured
                </h3>
                <i className={`fas fa-chevron-${expandedSections.featured ? 'up' : 'down'}`}></i>
              </div>
              
              {expandedSections.featured && (
                <div className="filter-section-content">
              <label className="filter-checkbox-label">
                <input
                  type="checkbox"
                      checked={featuredOnly}
                      onChange={(e) => { setFeaturedOnly(e.target.checked); setPage(1); }}
                />
                    <span className="checkbox-custom"></span>
                    <span>Show Featured Only</span>
              </label>
            </div>
              )}
            </div>

            {/* Mobile close button */}
            <button 
              className="mobile-filter-close"
              onClick={() => setShowFilters(false)}
            >
              <i className="fas fa-times"></i>
            </button>
          </aside>
          
          {/* Business Grid */}
          <main className="businesses-content">
            {/* Mobile Filter Toggle */}
            <button 
              className="mobile-filter-toggle"
              onClick={() => setShowFilters(!showFilters)}
            >
              <i className="fas fa-sliders-h"></i> Filters
              {hasActiveFilters && <span className="filter-count-badge"></span>}
            </button>
            
            {loading ? (
              <div className="loading"><div className="spinner"></div></div>
            ) : businesses.length === 0 ? (
              <div className="no-results">
                <i className="fas fa-search"></i>
                <h3>No businesses found</h3>
                <p>Try adjusting your filters to see more results</p>
                <button onClick={clearAllFilters} className="btn-primary">
                  <i className="fas fa-undo"></i> Reset Filters
                </button>
              </div>
            ) : (
              <>
                <div className="businesses-grid">
                  {businesses.map((business) => (
                    <div
                      key={business.id}
                      className="business-card"
                      onClick={() => navigate(`/businesses/${business.id}`)}
                    >
                      {business.isFeatured && (
                        <div className="featured-badge">
                          <i className="fas fa-crown"></i> Featured
                        </div>
                      )}
                      <h3>{business.name}</h3>
                      <div className="rating">
                        <div className="stars golden">{renderStars(business.ratingAverage)}</div>
                        <span className="rating-value">
                          {(parseFloat(business.ratingAverage) || 0).toFixed(1)}
                        </span>
                        <span className="rating-count">({business.ratingCount || 0} reviews)</span>
                      </div>
                      <p className="description">{business.description}</p>
                      <div className="business-info">
                        <div className="info-item">
                          <i className="fas fa-map-marker-alt"></i>
                          {business.city}, {business.state}
                        </div>
                        <div className="info-item">
                          <i className="fas fa-phone"></i>
                          {business.phone}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <i className="fas fa-chevron-left"></i> Previous
                    </button>
                    <span className="page-info">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next <i className="fas fa-chevron-right"></i>
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default CategoryBusinesses;

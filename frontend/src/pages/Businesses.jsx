import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import './Businesses.css';

const Businesses = () => {
  const navigate = useNavigate();
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
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);

  // Selected filters - now arrays for multiple selection
  const [selectedStates, setSelectedStates] = useState([]);
  const [selectedCities, setSelectedCities] = useState([]);
  const [selectedZip, setSelectedZip] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState([]);
  const [selectedRatings, setSelectedRatings] = useState([]);
  const [sortBy, setSortBy] = useState('rating');
  const [featuredOnly, setFeaturedOnly] = useState(false);

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState({
    location: true,
    category: true,
    rating: true,
    sort: false,
    featured: false
  });

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadBusinesses();
  }, [page, selectedStates, selectedCities, selectedZip, selectedCategories, selectedSubcategories, selectedRatings, sortBy, featuredOnly, searchName, searchLocation]);

  // Fetch name suggestions
  useEffect(() => {
    const fetchNameSuggestions = async () => {
      if (searchName.length < 2) {
        setNameSuggestions([]);
        return;
      }
      try {
        const response = await api.get(`/businesses?search=${searchName}&limit=5`);
        setNameSuggestions(response.data.businesses || []);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      }
    };
    const debounce = setTimeout(fetchNameSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [searchName]);

  // Fetch location suggestions
  useEffect(() => {
    const fetchLocationSuggestions = async () => {
      if (searchLocation.length < 2) {
        setLocationSuggestions([]);
        return;
      }
      try {
        const response = await api.get('/businesses/filter-options');
        const allLocations = [];
        (response.data.states || []).forEach(state => {
          if (state.toLowerCase().includes(searchLocation.toLowerCase())) {
            allLocations.push({ type: 'state', value: state });
          }
        });
        Object.entries(response.data.statesWithCities || {}).forEach(([state, cities]) => {
          cities.forEach(city => {
            if (city.toLowerCase().includes(searchLocation.toLowerCase())) {
              allLocations.push({ type: 'city', value: city, state });
            }
          });
        });
        setLocationSuggestions(allLocations.slice(0, 6));
      } catch (error) {
        console.error('Error fetching location suggestions:', error);
      }
    };
    const debounce = setTimeout(fetchLocationSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [searchLocation]);

  const loadFilterOptions = async () => {
    try {
      const [filterResponse, subcategoriesResponse] = await Promise.all([
        api.get('/businesses/filter-options'),
        api.get('/subcategories')
      ]);

      setFilterOptions({
        states: filterResponse.data.states || [],
        statesWithCities: filterResponse.data.statesWithCities || {},
        zipCodes: filterResponse.data.zipCodes || []
      });
      // Use categories from filter-options (already filtered to only show categories with businesses)
      setCategories(filterResponse.data.categories || []);
      setSubcategories(subcategoriesResponse.data.subcategories || []);
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const loadBusinesses = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 12 };

      // Send search parameters only if they are not empty
      if (searchName) params.search = searchName;
      if (searchLocation) params.location = searchLocation;

      if (selectedStates.length > 0) params.states = selectedStates.join(',');
      if (selectedCities.length > 0) params.cities = selectedCities.join(',');
      if (selectedZip) params.zipCode = selectedZip;
      if (selectedCategories.length > 0) params.categories = selectedCategories.join(',');
      if (selectedSubcategories.length > 0) params.subCategories = selectedSubcategories.join(',');
      if (selectedRatings.length > 0) params.ratings = selectedRatings.join(',');
      if (sortBy) params.sort = sortBy;
      if (featuredOnly) params.featured = 'true';

      const response = await api.get('/businesses', { params });
      setBusinesses(response.data.businesses || []);
      setTotalPages(response.data.pages || 1);
    } catch (error) {
      console.error('Error loading businesses:', error);
    } finally {
      setLoading(false);
    }
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

  const clearSearch = () => {
    setSearchName('');
    setSearchLocation('');
    setPage(1);
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
    setSelectedZip('');
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
    setSelectedZip('');
    setPage(1);
  };

  const toggleCategory = (categoryId) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        // Remove category and its subcategories
        const newCategories = prev.filter(c => c !== categoryId);
        setSelectedSubcategories(prevSubs => {
          const subsInCategory = subcategories
            .filter(sub => sub.categoryId === parseInt(categoryId))
            .map(sub => sub.id.toString());
          return prevSubs.filter(subId => !subsInCategory.includes(subId));
        });
        return newCategories;
      } else {
        return [...prev, categoryId];
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

  const clearAllFilters = () => {
    setSelectedStates([]);
    setSelectedCities([]);
    setSelectedZip('');
    setSelectedCategories([]);
    setSelectedSubcategories([]);
    setSelectedRatings([]);
    setSortBy('rating');
    setFeaturedOnly(false);
    setPage(1);
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

  // Get subcategories from all selected categories
  const filteredSubcategories = selectedCategories.length > 0
    ? subcategories.filter(sub => selectedCategories.includes(sub.categoryId.toString()))
    : subcategories;

  const hasActiveFilters = selectedStates.length > 0 || selectedCities.length > 0 || selectedZip ||
    selectedCategories.length > 0 || selectedSubcategories.length > 0 || selectedRatings.length > 0 || featuredOnly;

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

  return (
    <div className="businesses-page">
      <div className="page-header">
        <div className="container">
          <h1><i className="fas fa-building"></i> Business Directory</h1>
          <p>Discover and connect with local businesses</p>

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

            {/* 1. Location Filter */}
            <div className="filter-section">
              <div className="filter-section-header" onClick={() => toggleSection('location')}>
                <h3 className="filter-section-title">
                  <i className="fas fa-map-marker-alt"></i> Location
                </h3>
                <i className={`fas fa-chevron-${expandedSections.location ? 'up' : 'down'}`}></i>
              </div>

              {expandedSections.location && (
                <div className="filter-section-content">
                  {/* State */}
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

                  {/* City - Shows after state selection */}
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

                  {/* Zip Code */}
                  {selectedCities.length > 0 && (
                    <div className="filter-subsection">
                      <div className="filter-subsection-header">
                        <span className="filter-label">
                          <i className="fas fa-angle-right"></i> Zip Code
                        </span>
                        {selectedZip && (
                          <button className="clear-filter-btn" onClick={() => { setSelectedZip(''); setPage(1); }}>
                            <i className="fas fa-times-circle"></i>
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        className="filter-input"
                        placeholder="Enter zip code"
                        value={selectedZip}
                        onChange={(e) => { setSelectedZip(e.target.value); setPage(1); }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Category Filter */}
            <div className="filter-section">
              <div className="filter-section-header" onClick={() => toggleSection('category')}>
                <h3 className="filter-section-title">
                  <i className="fas fa-folder"></i> Category
                </h3>
                <i className={`fas fa-chevron-${expandedSections.category ? 'up' : 'down'}`}></i>
              </div>

              {expandedSections.category && (
                <div className="filter-section-content">
                  <div className="filter-subsection">
                    <div className="filter-subsection-header">
                      <span className="filter-label">Main Category</span>
                      {selectedCategories.length > 0 && (
                        <button className="clear-filter-btn" onClick={() => { setSelectedCategories([]); setSelectedSubcategories([]); setPage(1); }}>
                          <i className="fas fa-times-circle"></i>
                        </button>
                      )}
                    </div>
                    <div className="filter-options-list">
                      {categories.map(cat => (
                        <label key={cat.id} className={`filter-checkbox-label ${selectedCategories.includes(cat.id.toString()) ? 'selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(cat.id.toString())}
                            onChange={() => toggleCategory(cat.id.toString())}
                          />
                          <span className="checkbox-custom"></span>
                          <span className="filter-option-text">
                            <i className={`fas fa-${cat.icon || 'folder'}`}></i> {cat.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Subcategory */}
                  {selectedCategories.length > 0 && filteredSubcategories.length > 0 && (
                    <div className="filter-subsection city-subsection">
                      <div className="filter-subsection-header">
                        <span className="filter-label">
                          <i className="fas fa-angle-right"></i> Subcategory
                        </span>
                        {selectedSubcategories.length > 0 && (
                          <button className="clear-filter-btn" onClick={() => { setSelectedSubcategories([]); setPage(1); }}>
                            <i className="fas fa-times-circle"></i>
                          </button>
                        )}
                      </div>
                      <div className="filter-options-list">
                        {filteredSubcategories.map(sub => (
                          <label key={sub.id} className={`filter-checkbox-label ${selectedSubcategories.includes(sub.id.toString()) ? 'selected' : ''}`}>
                            <input
                              type="checkbox"
                              checked={selectedSubcategories.includes(sub.id.toString())}
                              onChange={() => toggleSubcategory(sub.id.toString())}
                            />
                            <span className="checkbox-custom"></span>
                            <span className="filter-option-text">
                              <i className={`fas fa-${sub.icon || 'tag'}`}></i> {sub.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

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
                      {business.owner && (
                        <div
                          className="business-owner-avatar"
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

export default Businesses;

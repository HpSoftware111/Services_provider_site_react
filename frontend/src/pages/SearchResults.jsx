import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Businesses.css';

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    performSearch();
  }, [searchParams]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(searchParams);
      const response = await api.get(`/search?${params.toString()}`);
      setBusinesses(response.data.businesses || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="businesses-page">
      <div className="container">
        <h1>Search Results</h1>
        {loading ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : businesses.length === 0 ? (
          <p>No businesses found matching your search.</p>
        ) : (
          <div className="businesses-grid">
            {businesses.map((business) => (
              <div key={business.id} className="business-card" onClick={() => navigate(`/businesses/${business.id}`)}>
                <h3>{business.name}</h3>
                <div className="rating">
                  <span className="stars">{'★'.repeat(Math.floor(parseFloat(business.ratingAverage) || 0))}</span>
                  <span className="rating-value">{parseFloat(business.ratingAverage) || 0}</span>
                </div>
                <p className="description">{business.description?.substring(0, 150)}...</p>
                <div className="business-info">
                  <p><i className="fas fa-map-marker-alt"></i> {business.city}, {business.state}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResults;


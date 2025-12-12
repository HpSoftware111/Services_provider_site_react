import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Home.css';

const AllCategories = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await api.get('/categories');
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="home">
      <section className="categories" style={{ paddingTop: '40px' }}>
        <div className="container">
          <div className="section-header-with-action">
            <div className="section-title-group">
              <h2>All Categories</h2>
              <p>Browse all available business categories</p>
            </div>
          </div>

          {/* Search Bar */}
          <div style={{ marginBottom: '30px', maxWidth: '500px' }}>
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px',
                transition: 'border-color 0.3s ease'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
            />
          </div>

          {loading ? (
            <div className="loading"><div className="spinner"></div></div>
          ) : (
            <>
              {filteredCategories.length > 0 ? (
                <div className="categories-grid">
                  {filteredCategories.map((category) => (
                    <div 
                      key={category.id} 
                      className="category-card" 
                      onClick={() => navigate(`/category/${category.slug}`)}
                    >
                      <i className={`fas fa-${category.icon || 'briefcase'}`}></i>
                      <h3>{category.name}</h3>
                      <p>{category.businessCount || 0} businesses</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#7f8c8d' }}>
                  <i className="fas fa-search" style={{ fontSize: '48px', marginBottom: '20px', opacity: 0.5 }}></i>
                  <p style={{ fontSize: '16px' }}>No categories found matching "{searchQuery}"</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default AllCategories;


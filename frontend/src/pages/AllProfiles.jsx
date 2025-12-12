import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Home.css';

const AllProfiles = () => {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const response = await api.get('/businesses/profiles?limit=100').catch(() => ({ data: { profiles: [] } }));
      setProfiles(response.data.profiles || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProfiles = profiles.filter(profile =>
    profile.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="home">
      <section className="business-profiles" style={{ paddingTop: '40px' }}>
        <div className="container">
          <div className="section-header-with-action">
            <div className="section-title-group">
              <h2>All Business Profiles</h2>
              <p>Discover all business owners and their portfolios</p>
            </div>
          </div>

          {/* Search Bar */}
          <div style={{ marginBottom: '30px', maxWidth: '500px' }}>
            <input
              type="text"
              placeholder="Search profiles..."
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
              {filteredProfiles.length > 0 ? (
                <div className="profiles-grid">
                  {filteredProfiles.map((profile) => (
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
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#7f8c8d' }}>
                  <i className="fas fa-user-circle" style={{ fontSize: '48px', marginBottom: '20px', opacity: 0.5 }}></i>
                  <p style={{ fontSize: '16px' }}>No profiles found matching "{searchQuery}"</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default AllProfiles;


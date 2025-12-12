import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './AdminTable.css';

const AdminBusinessProfiles = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    loadProfiles();
  }, [currentPage]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/businesses/profiles?page=${currentPage}&limit=20`);
      setProfiles(response.data.profiles || []);
      setTotalPages(response.data.pages || 1);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('Error loading profiles:', error);
      alert('Failed to load business profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleViewProfile = (userId) => {
    window.open(`/profile/${userId}`, '_blank');
  };

  if (loading) {
    return (
      <div className="admin-table-container">
        <div className="loading"><div className="spinner"></div></div>
      </div>
    );
  }

  return (
    <div className="admin-table-container">
      <div className="admin-table-header">
        <div>
          <h1>Business Profiles</h1>
          <p>Manage and view all provider profiles ({total} total)</p>
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-user-slash"></i>
          <p>No business profiles found</p>
        </div>
      ) : (
        <>
          <div className="profiles-grid-admin">
            {profiles.map((profile) => (
              <div key={profile.id} className="profile-card-admin">
                <div className="profile-card-header">
                  <div className="profile-avatar-admin">
                    {profile.avatar ? (
                      <img src={profile.avatar} alt={profile.name} />
                    ) : (
                      <i className="fas fa-user-circle"></i>
                    )}
                  </div>
                  <div className="profile-info-admin">
                    <h3>{profile.name}</h3>
                    <p className="profile-email-admin">{profile.email}</p>
                    {profile.phone && (
                      <p className="profile-phone-admin">
                        <i className="fas fa-phone"></i> {profile.phone}
                      </p>
                    )}
                  </div>
                </div>
                <div className="profile-stats-admin">
                  <div className="stat-item-admin">
                    <i className="fas fa-building"></i>
                    <span>{profile.businessCount} {profile.businessCount === 1 ? 'Business' : 'Businesses'}</span>
                  </div>
                  <div className="stat-item-admin">
                    <i className="fas fa-calendar"></i>
                    <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="profile-actions-admin">
                  <button
                    className="btn-view-profile"
                    onClick={() => handleViewProfile(profile.id)}
                  >
                    <i className="fas fa-eye"></i> View Profile
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="pagination-btn"
              >
                <i className="fas fa-chevron-left"></i> Previous
              </button>
              <span className="pagination-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="pagination-btn"
              >
                Next <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminBusinessProfiles;


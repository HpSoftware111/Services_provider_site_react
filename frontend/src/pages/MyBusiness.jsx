import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './MyBusiness.css';

const MyBusiness = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const messageRef = useRef(null);

  useEffect(() => {
    fetchBusinesses();
  }, []);

  // Scroll error into view when it appears
  useEffect(() => {
    if (message.text && messageRef.current) {
      messageRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  }, [message.text]);

  const fetchBusinesses = async () => {
    try {
      const response = await api.get('/businesses/my-businesses');
      const businessesList = response.data.businesses || [];
      setBusinesses(businessesList);
    } catch (error) {
      console.error('Error fetching businesses:', error);
      setMessage({ type: 'error', text: 'Failed to load businesses' });
    } finally {
      setLoading(false);
    }
  };

  const handleView = (businessId) => {
    window.open(`/businesses/${businessId}`, '_blank');
  };

  const handleEdit = (businessId) => {
    navigate(`/user-dashboard/business-information?businessId=${businessId}`);
  };

  const handleDelete = async (businessId, businessName) => {
    if (window.confirm(`Are you sure you want to delete "${businessName}"? This action cannot be undone.`)) {
      try {
        await api.delete(`/businesses/${businessId}`);
        setMessage({ type: 'success', text: 'Business deleted successfully!' });
        fetchBusinesses();
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } catch (error) {
        setMessage({ type: 'error', text: 'Failed to delete business' });
      }
    }
  };

  const getStatusBadge = (business) => {
    if (business.rejectionReason || business.rejectedAt) {
      return { text: 'Rejected', class: 'rejected' };
    } else if (business.isActive && business.approvedAt) {
      return { text: 'Active', class: 'approved' };
    } else {
      return { text: 'Pending', class: 'pending' };
    }
  };

  if (loading) {
    return (
      <div className="my-business-page">
        <div className="loading-state">Loading...</div>
      </div>
    );
  }

  return (
    <div className="my-business-page">
      <div className="page-header-section">
        <h1 className="page-title">My Businesses</h1>
        <button className="add-business-btn" onClick={() => navigate('/add-business')}>
          <i className="fas fa-plus"></i> Add Your Business for FREE
        </button>
      </div>

      {message.text && (
        <div ref={messageRef} className={`alert alert-${message.type} alert-visible`}>
          <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="alert-close">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {businesses.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-store-slash"></i>
          <h2>No Businesses Found</h2>
          <p>Create your first business listing to get started.</p>
          <button className="add-business-btn primary" onClick={() => navigate('/add-business')}>
            <i className="fas fa-plus"></i> Add Your Business for FREE
          </button>
        </div>
      ) : (
        <div className="businesses-grid">
          {businesses.map(business => {
            const status = getStatusBadge(business);
            return (
              <div key={business.id} className="business-card">
                <div className="business-card-image">
                  {business.logo ? (
                    <img src={business.logo} alt={business.name} />
                  ) : (
                    <div className="business-card-placeholder">
                      <i className="fas fa-building"></i>
                    </div>
                  )}
                  <div className={`status-badge-corner ${status.class}`}>
                    {status.text}
                  </div>
                </div>
                <div className="business-card-content">
                  <h3 className="business-card-name">{business.name}</h3>
                  {business.description && (
                    <p className="business-card-description">
                      {business.description.length > 120
                        ? `${business.description.substring(0, 120)}...`
                        : business.description}
                    </p>
                  )}
                  <div className="business-card-stats">
                    <div className="stat-item">
                      <i className="fas fa-star"></i>
                      <span>{(parseFloat(business.ratingAverage) || 0).toFixed(1)}</span>
                    </div>
                    <div className="stat-item">
                      <i className="fas fa-comments"></i>
                      <span>{business.ratingCount || 0}</span>
                    </div>
                    <div className="stat-item">
                      <i className="fas fa-eye"></i>
                      <span>{business.views || 0}</span>
                    </div>
                  </div>
                  {business.rejectionReason && (
                    <div className="rejection-notice">
                      <i className="fas fa-exclamation-triangle"></i>
                      <span>{business.rejectionReason}</span>
                    </div>
                  )}
                  <div className="business-card-actions">
                    <button className="action-btn view" onClick={() => handleView(business.id)}>
                      <i className="fas fa-eye"></i> View
                    </button>
                    <button className="action-btn edit" onClick={() => handleEdit(business.id)}>
                      <i className="fas fa-edit"></i> Edit
                    </button>
                    <button className="action-btn delete" onClick={() => handleDelete(business.id, business.name)}>
                      <i className="fas fa-trash"></i> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyBusiness;

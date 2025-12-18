import React, { useContext, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './BusinessHeader.css';

const BusinessHeader = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBusinessesList, setShowBusinessesList] = useState(false);
  const [showRequestReviewModal, setShowRequestReviewModal] = useState(false);
  const [requestForm, setRequestForm] = useState({
    customerEmail: '',
    customerName: ''
  });
  const [requestLoading, setRequestLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    fetchBusinesses();
  }, []);

  useEffect(() => {
    if (businesses.length > 0 && !selectedBusiness) {
      setSelectedBusiness(businesses[0]);
    }
  }, [businesses]);

  const fetchBusinesses = async () => {
    try {
      const response = await api.get('/businesses/my-businesses');
      const businessesList = response.data.businesses || [];
      setBusinesses(businessesList);
      if (businessesList.length > 0) {
        setSelectedBusiness(businessesList[0]);
      }
    } catch (error) {
      console.error('Error fetching businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBusinessSelect = (business) => {
    setSelectedBusiness(business);
    setShowBusinessesList(false);
  };

  const handleEditName = () => {
    if (selectedBusiness) {
      navigate(`/user-dashboard/business-information/${selectedBusiness.id}`);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBusiness) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image size must be less than 2MB' });
      return;
    }

    setUploadingLogo(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        await api.put(`/businesses/${selectedBusiness.id}`, {
          logo: reader.result
        });
        setMessage({ type: 'success', text: 'Logo updated successfully!' });
        fetchBusinesses();
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } catch (error) {
        setMessage({ type: 'error', text: 'Failed to upload logo' });
      } finally {
        setUploadingLogo(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleView = (businessId) => {
    window.open(`/businesses/${businessId}`, '_blank');
  };

  const handleEdit = (businessId) => {
    navigate('/user-dashboard/business-information');
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

  const handleResubmit = async (businessId) => {
    try {
      await api.post(`/businesses/${businessId}/resubmit`);
      setMessage({ type: 'success', text: 'Business resubmitted for review!' });
      fetchBusinesses();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to resubmit business' });
    }
  };

  const handleRequestReview = async (e) => {
    e.preventDefault();
    if (!selectedBusiness || !requestForm.customerEmail) {
      setMessage({ type: 'error', text: 'Please enter customer email' });
      return;
    }

    setRequestLoading(true);
    try {
      await api.post('/reviews/request', {
        businessId: selectedBusiness.id,
        customerEmail: requestForm.customerEmail,
        customerName: requestForm.customerName
      });
      setMessage({ type: 'success', text: 'Review request sent successfully!' });
      setShowRequestReviewModal(false);
      setRequestForm({ customerEmail: '', customerName: '' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to send review request' });
    } finally {
      setRequestLoading(false);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating || 0);
    const hasHalfStar = (rating || 0) % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<i key={i} className="fas fa-star filled"></i>);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<i key={i} className="fas fa-star-half-alt filled"></i>);
      } else {
        stars.push(<i key={i} className="far fa-star"></i>);
      }
    }
    return stars;
  };

  const getStatusBadge = (business) => {
    if (business.rejectionReason || business.rejectedAt) {
      return <span className="status-badge rejected">Rejected</span>;
    } else if (business.isActive && business.approvedAt) {
      return <span className="status-badge approved">Active</span>;
    } else {
      return <span className="status-badge pending">Pending</span>;
    }
  };

  if (loading) {
    return (
      <div className="business-header">
        <div className="header-content">
          <div className="header-left">
            <div className="business-avatar-placeholder"></div>
            <div className="business-info-placeholder"></div>
          </div>
        </div>
      </div>
    );
  }

  const currentBusiness = selectedBusiness || businesses[0];
  const hasNoReviews = currentBusiness && (currentBusiness.ratingCount || 0) === 0;

  return (
    <>
      {/* Compact Header Bar */}
      <div className="business-header">
        <div className="header-content">
          <div className="header-left">
            {currentBusiness ? (
              <>
                <div className="business-avatar">
                  <label className="logo-upload-label" title="Click to upload logo">
                    {currentBusiness.logo ? (
                      <img src={currentBusiness.logo} alt={currentBusiness.name} />
                    ) : (
                      <i className="fas fa-store"></i>
                    )}
                    {uploadingLogo && (
                      <div className="logo-upload-overlay">
                        <i className="fas fa-spinner fa-spin"></i>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      style={{ display: 'none' }}
                      disabled={uploadingLogo}
                    />
                  </label>
                </div>
                <div className="business-info">
                  <div className="business-name-row">
                    <h2>{currentBusiness.name}</h2>
                    <button className="edit-name-btn" onClick={handleEditName} title="Edit business name">
                      <i className="fas fa-pencil-alt"></i>
                    </button>
                  </div>
                  <div className="business-rating-row">
                    <div className="stars">
                      {renderStars(currentBusiness.ratingAverage)}
                    </div>
                    <span className="review-count">
                      {currentBusiness.ratingCount || 0} reviews
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="business-avatar">
                  <i className="fas fa-store"></i>
                </div>
                <div className="business-info">
                  <h2>No Business Yet</h2>
                </div>
              </>
            )}
          </div>

          <div className="header-right">
            {currentBusiness && (
              <>
                <Link to={`/businesses/${currentBusiness.id}`} className="header-action-link" target="_blank">
                  View Business Profile
                </Link>
                <Link to="/user-dashboard/reviews" className="header-action-link">
                  See Reviews
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Compact Businesses Section */}
      {businesses.length > 0 && (
        <div className="businesses-section">
          <div className="businesses-header">
            <span className="businesses-label">My Businesses</span>
            <button className="add-business-btn" onClick={() => navigate('/add-business')}>
              <i className="fas fa-plus"></i> Add Your Business for FREE
            </button>
          </div>

          {message.text && (
            <div className={`alert alert-${message.type}`}>
              <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i>
              <span>{message.text}</span>
              <button onClick={() => setMessage({ type: '', text: '' })} className="alert-close">
                <i className="fas fa-times"></i>
              </button>
            </div>
          )}

          <div className="businesses-compact-list">
            {businesses.map(business => (
              <div key={business.id} className={`business-compact-item ${selectedBusiness?.id === business.id ? 'active' : ''}`}>
                <div className="business-compact-main" onClick={() => handleBusinessSelect(business)}>
                  <div className="business-compact-avatar">
                    {business.logo ? (
                      <img src={business.logo} alt={business.name} />
                    ) : (
                      <i className="fas fa-building"></i>
                    )}
                  </div>
                  <div className="business-compact-info">
                    <div className="business-compact-name-row">
                      <h4>{business.name}</h4>
                      {getStatusBadge(business)}
                    </div>
                    <div className="business-compact-meta">
                      <span><i className="fas fa-star"></i> {(parseFloat(business.ratingAverage) || 0).toFixed(1)}</span>
                      <span><i className="fas fa-comments"></i> {business.ratingCount || 0}</span>
                      <span><i className="fas fa-eye"></i> {business.views || 0}</span>
                    </div>
                  </div>
                  <div className="business-compact-arrow">
                    <i className={`fas fa-chevron-${selectedBusiness?.id === business.id ? 'up' : 'down'}`}></i>
                  </div>
                </div>

                {selectedBusiness?.id === business.id && (
                  <div className="business-compact-actions">
                    <button className="action-btn-compact view" onClick={() => handleView(business.id)}>
                      <i className="fas fa-eye"></i> View
                    </button>
                    <button className="action-btn-compact edit" onClick={() => handleEdit(business.id)}>
                      <i className="fas fa-edit"></i> Edit
                    </button>
                    {(business.rejectionReason || business.rejectedAt) && (
                      <button className="action-btn-compact resubmit" onClick={() => handleResubmit(business.id)}>
                        <i className="fas fa-redo"></i> Resubmit
                      </button>
                    )}
                    {hasNoReviews && (
                      <button className="action-btn-compact request-review" onClick={() => setShowRequestReviewModal(true)}>
                        <i className="fas fa-paper-plane"></i> Request Review
                      </button>
                    )}
                    <button className="action-btn-compact delete" onClick={() => handleDelete(business.id, business.name)}>
                      <i className="fas fa-trash"></i> Delete
                    </button>
                  </div>
                )}

                {business.rejectionReason && selectedBusiness?.id === business.id && (
                  <div className="rejection-notice-compact">
                    <i className="fas fa-exclamation-triangle"></i>
                    <span><strong>Rejection Reason:</strong> {business.rejectionReason}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {businesses.length === 0 && (
        <div className="businesses-section">
          <div className="empty-businesses-compact">
            <i className="fas fa-store-slash"></i>
            <p>You don't have any businesses yet.</p>
            <button className="add-business-btn primary" onClick={() => navigate('/add-business')}>
              <i className="fas fa-plus"></i> Add Your Business for FREE
            </button>
          </div>
        </div>
      )}

      {/* Request Review Modal */}
      {showRequestReviewModal && (
        <div className="modal-overlay" onClick={() => setShowRequestReviewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className="fas fa-paper-plane"></i> Request Review</h3>
              <button className="modal-close" onClick={() => setShowRequestReviewModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleRequestReview} className="request-review-form">
              <p className="modal-description">
                Send an email to a customer asking them to leave a review for your business.
              </p>
              <div className="form-field">
                <label>Customer Email *</label>
                <input
                  type="email"
                  value={requestForm.customerEmail}
                  onChange={(e) => setRequestForm({ ...requestForm, customerEmail: e.target.value })}
                  placeholder="customer@example.com"
                  required
                />
              </div>
              <div className="form-field">
                <label>Customer Name (Optional)</label>
                <input
                  type="text"
                  value={requestForm.customerName}
                  onChange={(e) => setRequestForm({ ...requestForm, customerName: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowRequestReviewModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={requestLoading}>
                  {requestLoading ? (
                    <><i className="fas fa-spinner fa-spin"></i> Sending...</>
                  ) : (
                    <><i className="fas fa-paper-plane"></i> Send Request</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default BusinessHeader;

import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './BusinessOwnerDashboard.css';

const BusinessOwnerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingBusinessId, setDeletingBusinessId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [categories, setCategories] = useState([]);
  
  // Request Review state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({
    businessId: '',
    customerEmail: '',
    customerName: ''
  });
  const [requestLoading, setRequestLoading] = useState(false);
  
  // Verification state
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyBusinessId, setVerifyBusinessId] = useState(null);
  const [verifyMethod, setVerifyMethod] = useState('');
  const [verifyData, setVerifyData] = useState({});
  const [verifyLoading, setVerifyLoading] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'business_owner') {
      navigate('/');
      return;
    }
    loadDashboard();
  }, [user, navigate]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [categoriesRes, businessesRes] = await Promise.all([
        api.get('/categories'),
        api.get('/businesses')
      ]);
      
      setCategories(categoriesRes.data.categories || []);
      
      // Get all businesses owned by this user
      const myBusinesses = businessesRes.data.businesses.filter(b => b.ownerId === user.id);
      setBusinesses(myBusinesses);
      
      // If a business was selected, update its data
      if (selectedBusiness) {
        const updated = myBusinesses.find(b => b.id === selectedBusiness.id);
        if (updated) {
          setSelectedBusiness(updated);
          if (editing) {
            setFormData({
              name: updated.name || '',
              description: updated.description || '',
              categoryId: updated.categoryId || '',
              address: updated.address || '',
              city: updated.city || '',
              state: updated.state || '',
              zipCode: updated.zipCode || '',
              phone: updated.phone || '',
              email: updated.email || '',
              website: updated.website || '',
              socialLinks: updated.socialLinks || { facebook: '', twitter: '', instagram: '', linkedin: '' },
              hours: updated.hours || {}
            });
          }
        }
      }
    } catch (error) {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBusiness = (business) => {
    setSelectedBusiness(business);
    setEditing(false);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBusiness) return;
    
    setError('');
    setSuccess('');

    try {
      const updateData = { ...formData };
      // If business was rejected and we're updating, clear rejection fields
      if (selectedBusiness.rejectionReason) {
        updateData.rejectionReason = null;
        updateData.rejectedAt = null;
        updateData.isActive = false; // Set back to pending
      }
      await api.put(`/businesses/${selectedBusiness.id}`, updateData);
      setSuccess(selectedBusiness.rejectionReason 
        ? 'Business updated and resubmitted for review!' 
        : 'Business updated successfully!');
      setEditing(false);
      loadDashboard();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to update business');
    }
  };

  const handleResubmit = async () => {
    if (!selectedBusiness) return;
    
    setError('');
    setSuccess('');

    try {
      await api.put(`/businesses/${selectedBusiness.id}`, {
        rejectionReason: null,
        rejectedAt: null,
        isActive: false
      });
      setSuccess('Business resubmitted for review successfully!');
      loadDashboard();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to resubmit business');
    }
  };

  const handleDelete = async () => {
    if (!deletingBusinessId) return;
    
    setDeleting(true);
    setError('');

    try {
      await api.delete(`/businesses/${deletingBusinessId}`);
      setSuccess('Business deleted successfully!');
      setDeleting(false);
      setShowDeleteModal(false);
      setDeletingBusinessId(null);
      setSelectedBusiness(null);
      loadDashboard();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to delete business');
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const getStatusClass = (business) => {
    if (business?.rejectionReason) return 'rejected';
    if (business?.isActive) return 'active';
    return 'pending';
  };

  const getStatusInfo = (business) => {
    if (business?.rejectionReason) {
      return {
        icon: 'times-circle',
        title: 'Listing Rejected',
        message: business.rejectionReason
      };
    }
    if (business?.isActive) {
      return {
        icon: 'check-circle',
        title: 'Active & Published',
        message: 'Your listing is live and visible to customers'
      };
    }
    return {
      icon: 'clock',
      title: 'Pending Approval',
      message: 'Your listing is under review and will be published soon'
    };
  };

  const startEdit = (business) => {
    setSelectedBusiness(business);
    setEditing(true);
    setFormData({
      name: business.name || '',
      description: business.description || '',
      categoryId: business.categoryId || '',
      address: business.address || '',
      city: business.city || '',
      state: business.state || '',
      zipCode: business.zipCode || '',
      phone: business.phone || '',
      email: business.email || '',
      website: business.website || '',
      socialLinks: business.socialLinks || { facebook: '', twitter: '', instagram: '', linkedin: '' },
      hours: business.hours || {},
      logo: business.logo || '',
      images: business.images || [],
      videos: business.videos || []
    });
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Logo must be less than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, logo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (formData.images.length + files.length > 10) {
      setError('Maximum 10 images allowed');
      return;
    }
    
    files.forEach(file => {
      if (file.size > 2 * 1024 * 1024) {
        setError(`Image ${file.name} is too large (max 2MB)`);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, reader.result]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleVideoAdd = () => {
    const url = prompt('Enter video URL (YouTube, Vimeo, etc.):');
    if (url) {
      if (formData.videos.length >= 5) {
        setError('Maximum 5 videos allowed');
        return;
      }
      setFormData(prev => ({
        ...prev,
        videos: [...prev.videos, url]
      }));
    }
  };

  const removeVideo = (index) => {
    setFormData(prev => ({
      ...prev,
      videos: prev.videos.filter((_, i) => i !== index)
    }));
  };

  const handleRequestReview = async (e) => {
    e.preventDefault();
    
    if (!requestForm.businessId || !requestForm.customerEmail) {
      setError('Please select a business and enter customer email');
      return;
    }

    setRequestLoading(true);
    try {
      await api.post('/reviews/request', requestForm);
      setSuccess('Review request sent successfully!');
      setShowRequestModal(false);
      setRequestForm({ businessId: '', customerEmail: '', customerName: '' });
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to send review request');
    } finally {
      setRequestLoading(false);
    }
  };

  const openVerifyModal = (businessId) => {
    setVerifyBusinessId(businessId);
    setVerifyMethod('');
    setVerifyData({});
    setShowVerifyModal(true);
  };

  const handleVerifyBusiness = async (e) => {
    e.preventDefault();
    
    if (!verifyMethod) {
      setError('Please select a verification method');
      return;
    }

    setVerifyLoading(true);
    try {
      await api.post(`/businesses/${verifyBusinessId}/request-verification`, {
        method: verifyMethod,
        data: verifyData
      });
      setSuccess('Verification request submitted! You will be notified once reviewed.');
      setShowVerifyModal(false);
      loadDashboard();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to submit verification request');
    } finally {
      setVerifyLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="business-dashboard">
        <div className="loading">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="business-dashboard">
      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header">
          <h1>
            <i className="fas fa-briefcase"></i>
            My Business Dashboard
          </h1>
          <p>Manage your business listings and track performance</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="alert alert-error">
            <i className="fas fa-exclamation-circle"></i>
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success">
            <i className="fas fa-check-circle"></i>
            {success}
          </div>
        )}

        {/* Action Buttons */}
        <div className="action-buttons" style={{ marginBottom: '30px', gap: '15px' }}>
          <button
            className="btn-action btn-primary-action"
            onClick={() => navigate('/add-business')}
          >
            <i className="fas fa-plus-circle"></i>
            Add Another Business
          </button>
          {businesses.length > 0 && (
            <button
              className="btn-action btn-secondary-action"
              onClick={() => setShowRequestModal(true)}
            >
              <i className="fas fa-paper-plane"></i>
              Request Review
            </button>
          )}
        </div>

        {/* Business Cards Grid */}
        {businesses.length > 0 ? (
          <div className="business-cards-grid">
            {businesses.map((business) => {
              const statusInfo = getStatusInfo(business);
              const isSelected = selectedBusiness?.id === business.id;
              
              return (
                <div 
                  key={business.id} 
                  className={`business-card-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectBusiness(business)}
                >
                  <div className="card-header-section">
                    {business.isFeatured && (
                      <div className="featured-badge-card">
                        <i className="fas fa-crown"></i> Featured
                      </div>
                    )}
                    <h3>{business.name}</h3>
                    <span className={`status-badge-card ${getStatusClass(business)}`}>
                      <i className={`fas fa-${statusInfo.icon}`}></i>
                      {statusInfo.title}
                    </span>
                  </div>

                  <div className="card-body-section">
                    <div className="card-category">
                      <i className="fas fa-tag"></i>
                      {business.category?.name || 'Uncategorized'}
                    </div>
                    
                    <p className="card-description">
                      {business.description?.substring(0, 120)}
                      {business.description?.length > 120 ? '...' : ''}
                    </p>

                    <div className="card-stats">
                      <div className="stat-item">
                        <i className="fas fa-eye"></i>
                        <span>{business.views || 0} views</span>
                      </div>
                      <div className="stat-item">
                        <i className="fas fa-star"></i>
                        <span>{(parseFloat(business.ratingAverage) || 0).toFixed(1)}</span>
                      </div>
                      <div className="stat-item">
                        <i className="fas fa-comments"></i>
                        <span>{business.ratingCount || 0} reviews</span>
                      </div>
                    </div>

                    {business.rejectionReason && (
                      <div className="rejection-notice">
                        <i className="fas fa-exclamation-triangle"></i>
                        <span>Rejected: {business.rejectionReason.substring(0, 60)}...</span>
                      </div>
                    )}
                  </div>

                  <div className="card-actions">
                    <button
                      className="btn-card-action btn-view"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/businesses/${business.id}`);
                      }}
                      title="View Public Listing"
                    >
                      <i className="fas fa-eye"></i>
                    </button>
                    <button
                      className="btn-card-action btn-edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(business);
                      }}
                      title="Edit Business & Media"
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      className="btn-card-action btn-media"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(business);
                        // Scroll to media section after a short delay
                        setTimeout(() => {
                          document.querySelector('.form-section:last-of-type')?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      }}
                      title="Manage Photos & Videos"
                    >
                      <i className="fas fa-images"></i>
                    </button>
                    {!business.isVerified && business.verificationStatus !== 'pending' && (
                      <button
                        className="btn-card-action btn-verify"
                        onClick={(e) => {
                          e.stopPropagation();
                          openVerifyModal(business.id);
                        }}
                        title="Verify Business"
                      >
                        <i className="fas fa-check-circle"></i>
                      </button>
                    )}
                    <button
                      className="btn-card-action btn-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingBusinessId(business.id);
                        setShowDeleteModal(true);
                      }}
                      title="Delete Business"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <i className="fas fa-briefcase" style={{ fontSize: '64px', color: '#3498db', marginBottom: '20px' }}></i>
            <h2>No Business Found</h2>
            <p>You don't have a business listing yet. Add your first business to get started!</p>
            <button className="btn-action btn-primary-action" onClick={() => navigate('/add-business')}>
              <i className="fas fa-plus-circle"></i>
              Add Your First Business
            </button>
          </div>
        )}

        {/* Selected Business Detail Panel */}
        {selectedBusiness && !editing && (
          <div className="content-card">
            <div className="card-header">
              <h2>
                <i className="fas fa-info-circle"></i>
                {selectedBusiness.name} - Details
              </h2>
              <button 
                className="btn-close-details"
                onClick={() => setSelectedBusiness(null)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Status Banner */}
            <div className={`status-banner ${getStatusClass(selectedBusiness)}`}>
              <div className="status-icon">
                <i className={`fas fa-${getStatusInfo(selectedBusiness).icon}`}></i>
              </div>
              <div className="status-content">
                <h3>{getStatusInfo(selectedBusiness).title}</h3>
                <p>{getStatusInfo(selectedBusiness).message}</p>
                {selectedBusiness.rejectionReason && (
                  <details style={{ marginTop: '15px' }}>
                    <summary style={{ cursor: 'pointer', color: '#ef4444', fontWeight: 700, fontSize: '14px', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>
                      <i className="fas fa-exclamation-triangle"></i> View Rejection Reason
                    </summary>
                    <div style={{ marginTop: '15px', padding: '15px', background: 'white', borderRadius: '10px', border: '2px solid #fecaca', color: '#991b1b', lineHeight: '1.6', fontWeight: '500' }}>
                      {selectedBusiness.rejectionReason}
                    </div>
                  </details>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon views">
                  <i className="fas fa-eye"></i>
                </div>
                <div className="stat-value">{selectedBusiness.views || 0}</div>
                <p className="stat-label">Total Views</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon rating">
                  <i className="fas fa-star"></i>
                </div>
                <div className="stat-value">{(parseFloat(selectedBusiness.ratingAverage) || 0).toFixed(1)}</div>
                <p className="stat-label">Average Rating</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon reviews">
                  <i className="fas fa-comments"></i>
                </div>
                <div className="stat-value">{selectedBusiness.ratingCount || 0}</div>
                <p className="stat-label">Total Reviews</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button
                className="btn-action btn-primary-action"
                onClick={() => navigate(`/businesses/${selectedBusiness.id}`)}
              >
                <i className="fas fa-eye"></i>
                View Public Listing
              </button>
              <button
                className="btn-action btn-secondary-action"
                onClick={() => startEdit(selectedBusiness)}
              >
                <i className="fas fa-edit"></i>
                Edit Information
              </button>
              {selectedBusiness.rejectionReason && (
                <button
                  className="btn-action btn-resubmit"
                  onClick={handleResubmit}
                >
                  <i className="fas fa-paper-plane"></i>
                  Resubmit for Review
                </button>
              )}
              <button
                className="btn-action btn-danger-action"
                onClick={() => {
                  setDeletingBusinessId(selectedBusiness.id);
                  setShowDeleteModal(true);
                }}
              >
                <i className="fas fa-trash"></i>
                Delete Listing
              </button>
            </div>

            {/* Business Information */}
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Business Name</span>
                <p className="info-value">{selectedBusiness.name}</p>
              </div>

              <div className="info-item">
                <span className="info-label">Category</span>
                <p className="info-value">{selectedBusiness.category?.name || 'N/A'}</p>
              </div>

              <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                <span className="info-label">Description</span>
                <p className="info-value">{selectedBusiness.description}</p>
              </div>

              <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                <span className="info-label">Address</span>
                <p className="info-value">
                  {selectedBusiness.address}, {selectedBusiness.city}, {selectedBusiness.state} {selectedBusiness.zipCode}
                </p>
              </div>

              <div className="info-item">
                <span className="info-label">Phone</span>
                <p className="info-value">
                  <a href={`tel:${selectedBusiness.phone}`}>{selectedBusiness.phone}</a>
                </p>
              </div>

              {selectedBusiness.email && (
                <div className="info-item">
                  <span className="info-label">Email</span>
                  <p className="info-value">
                    <a href={`mailto:${selectedBusiness.email}`}>{selectedBusiness.email}</a>
                  </p>
                </div>
              )}

              {selectedBusiness.website && (
                <div className="info-item">
                  <span className="info-label">Website</span>
                  <p className="info-value">
                    <a href={selectedBusiness.website} target="_blank" rel="noopener noreferrer">
                      {selectedBusiness.website}
                    </a>
                  </p>
                </div>
              )}

              {(selectedBusiness.socialLinks?.facebook || selectedBusiness.socialLinks?.twitter || 
                selectedBusiness.socialLinks?.instagram || selectedBusiness.socialLinks?.linkedin) && (
                <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                  <span className="info-label">Social Media</span>
                  <div style={{ display: 'flex', gap: '15px', marginTop: '10px', flexWrap: 'wrap' }}>
                    {selectedBusiness.socialLinks?.facebook && (
                      <a href={selectedBusiness.socialLinks.facebook} target="_blank" rel="noopener noreferrer" 
                         style={{ color: '#3498db', textDecoration: 'none', fontSize: '18px' }}>
                        <i className="fab fa-facebook"></i> Facebook
                      </a>
                    )}
                    {selectedBusiness.socialLinks?.twitter && (
                      <a href={selectedBusiness.socialLinks.twitter} target="_blank" rel="noopener noreferrer"
                         style={{ color: '#3498db', textDecoration: 'none', fontSize: '18px' }}>
                        <i className="fab fa-twitter"></i> Twitter
                      </a>
                    )}
                    {selectedBusiness.socialLinks?.instagram && (
                      <a href={selectedBusiness.socialLinks.instagram} target="_blank" rel="noopener noreferrer"
                         style={{ color: '#3498db', textDecoration: 'none', fontSize: '18px' }}>
                        <i className="fab fa-instagram"></i> Instagram
                      </a>
                    )}
                    {selectedBusiness.socialLinks?.linkedin && (
                      <a href={selectedBusiness.socialLinks.linkedin} target="_blank" rel="noopener noreferrer"
                         style={{ color: '#3498db', textDecoration: 'none', fontSize: '18px' }}>
                        <i className="fab fa-linkedin"></i> LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Edit Form */}
        {selectedBusiness && editing && (
          <div className="form-container">
            <div className="card-header">
              <h2>
                <i className="fas fa-edit"></i>
                Edit {selectedBusiness.name}
              </h2>
              <button 
                className="btn-close-details"
                onClick={() => {
                  setEditing(false);
                  setSelectedBusiness(null);
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-section">
                <h3 className="form-section-title">
                  <i className="fas fa-building"></i>
                  Basic Information
                </h3>

                <div className="form-group">
                  <label>Business Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Category *</label>
                  <select
                    required
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  >
                    <option value="">Select a category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Description *</label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="4"
                  />
                </div>
              </div>

              <div className="form-section">
                <h3 className="form-section-title">
                  <i className="fas fa-map-marker-alt"></i>
                  Location Information
                </h3>

                <div className="form-group">
                  <label>Street Address *</label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>City *</label>
                    <input
                      type="text"
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>State *</label>
                    <input
                      type="text"
                      required
                      maxLength="2"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Zip Code</label>
                    <input
                      type="text"
                      value={formData.zipCode}
                      onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3 className="form-section-title">
                  <i className="fas fa-phone"></i>
                  Contact Information
                </h3>

                <div className="form-row">
                  <div className="form-group">
                    <label>Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Website</label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-section">
                <h3 className="form-section-title">
                  <i className="fas fa-share-alt"></i>
                  Social Media Links
                </h3>

                <div className="form-row">
                  <div className="form-group">
                    <label><i className="fab fa-facebook"></i> Facebook</label>
                    <input
                      type="url"
                      value={formData.socialLinks?.facebook || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        socialLinks: { ...formData.socialLinks, facebook: e.target.value }
                      })}
                    />
                  </div>
                  <div className="form-group">
                    <label><i className="fab fa-twitter"></i> Twitter</label>
                    <input
                      type="url"
                      value={formData.socialLinks?.twitter || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        socialLinks: { ...formData.socialLinks, twitter: e.target.value }
                      })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label><i className="fab fa-instagram"></i> Instagram</label>
                    <input
                      type="url"
                      value={formData.socialLinks?.instagram || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        socialLinks: { ...formData.socialLinks, instagram: e.target.value }
                      })}
                    />
                  </div>
                  <div className="form-group">
                    <label><i className="fab fa-linkedin"></i> LinkedIn</label>
                    <input
                      type="url"
                      value={formData.socialLinks?.linkedin || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        socialLinks: { ...formData.socialLinks, linkedin: e.target.value }
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Media Section */}
              <div className="form-section">
                <h3 className="form-section-title">
                  <i className="fas fa-images"></i>
                  Media & Gallery
                </h3>

                {/* Logo Upload */}
                <div className="form-group">
                  <label><i className="fas fa-image"></i> Business Logo</label>
                  <div className="logo-upload-area">
                    {formData.logo ? (
                      <div className="logo-preview">
                        <img src={formData.logo} alt="Business Logo" />
                        <button 
                          type="button" 
                          className="remove-logo-btn"
                          onClick={() => setFormData({ ...formData, logo: '' })}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ) : (
                      <label className="upload-placeholder">
                        <i className="fas fa-cloud-upload-alt"></i>
                        <span>Click to upload logo</span>
                        <small>Max 2MB, JPG/PNG</small>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleLogoUpload}
                          style={{ display: 'none' }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Images Upload */}
                <div className="form-group">
                  <label><i className="fas fa-photo-video"></i> Business Images ({formData.images?.length || 0}/10)</label>
                  <div className="images-grid">
                    {formData.images?.map((img, index) => (
                      <div key={index} className="image-preview-item">
                        <img src={img} alt={`Business ${index + 1}`} />
                        <button 
                          type="button" 
                          className="remove-image-btn"
                          onClick={() => removeImage(index)}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ))}
                    {(formData.images?.length || 0) < 10 && (
                      <label className="add-image-btn">
                        <i className="fas fa-plus"></i>
                        <span>Add Image</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          multiple
                          onChange={handleImageUpload}
                          style={{ display: 'none' }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Videos */}
                <div className="form-group">
                  <label><i className="fas fa-video"></i> Business Videos ({formData.videos?.length || 0}/5)</label>
                  <div className="videos-list">
                    {formData.videos?.map((video, index) => (
                      <div key={index} className="video-item">
                        <i className="fas fa-play-circle"></i>
                        <span className="video-url">{video.length > 50 ? video.substring(0, 50) + '...' : video}</span>
                        <button 
                          type="button" 
                          className="remove-video-btn"
                          onClick={() => removeVideo(index)}
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    ))}
                    {(formData.videos?.length || 0) < 5 && (
                      <button 
                        type="button" 
                        className="add-video-btn"
                        onClick={handleVideoAdd}
                      >
                        <i className="fas fa-plus"></i> Add Video URL
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="action-buttons">
                <button 
                  type="button"
                  className="btn-action btn-secondary-action"
                  onClick={() => setEditing(false)}
                >
                  <i className="fas fa-times"></i>
                  Cancel
                </button>
                <button type="submit" className="btn-action btn-primary-action">
                  <i className="fas fa-save"></i>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Request Review Modal */}
        {showRequestModal && (
          <div className="delete-modal-overlay" onClick={() => setShowRequestModal(false)}>
            <div className="delete-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="delete-modal-header" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                <i className="fas fa-paper-plane"></i>
                <h3>Request Review from Customer</h3>
              </div>
              <div className="delete-modal-body">
                <p style={{ color: '#64748b', marginBottom: '20px' }}>
                  Send an email to a customer asking them to leave a review for your business.
                </p>
                <form onSubmit={handleRequestReview}>
                  <div className="form-group" style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>
                      Select Business *
                    </label>
                    <select 
                      value={requestForm.businessId}
                      onChange={(e) => setRequestForm({...requestForm, businessId: e.target.value})}
                      required
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                    >
                      <option value="">Choose a business...</option>
                      {businesses.map(biz => (
                        <option key={biz.id} value={biz.id}>{biz.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>
                      Customer Email *
                    </label>
                    <input 
                      type="email"
                      value={requestForm.customerEmail}
                      onChange={(e) => setRequestForm({...requestForm, customerEmail: e.target.value})}
                      placeholder="customer@example.com"
                      required
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>
                      Customer Name (Optional)
                    </label>
                    <input 
                      type="text"
                      value={requestForm.customerName}
                      onChange={(e) => setRequestForm({...requestForm, customerName: e.target.value})}
                      placeholder="John Doe"
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                    />
                  </div>
                  <div className="delete-modal-footer">
                    <button 
                      type="button" 
                      className="btn-cancel" 
                      onClick={() => setShowRequestModal(false)}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="btn-action btn-primary-action"
                      disabled={requestLoading}
                      style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
                    >
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
          </div>
        )}

        {/* Verification Modal */}
        {showVerifyModal && (
          <div className="delete-modal-overlay" onClick={() => setShowVerifyModal(false)}>
            <div className="delete-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
              <div className="delete-modal-header" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                <i className="fas fa-shield-alt"></i>
                <h3>Verify Your Business</h3>
              </div>
              <div className="delete-modal-body">
                <p style={{ color: '#64748b', marginBottom: '20px' }}>
                  Verified businesses get a badge and appear higher in search results. Choose a verification method:
                </p>
                <form onSubmit={handleVerifyBusiness}>
                  <div className="verification-methods">
                    <label className={`verify-option ${verifyMethod === 'google' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="verifyMethod"
                        value="google"
                        checked={verifyMethod === 'google'}
                        onChange={(e) => setVerifyMethod(e.target.value)}
                      />
                      <div className="verify-option-content">
                        <i className="fab fa-google" style={{ color: '#4285f4' }}></i>
                        <div>
                          <strong>Google Business Profile</strong>
                          <span>Link your Google Business listing</span>
                        </div>
                      </div>
                    </label>
                    
                    <label className={`verify-option ${verifyMethod === 'facebook' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="verifyMethod"
                        value="facebook"
                        checked={verifyMethod === 'facebook'}
                        onChange={(e) => setVerifyMethod(e.target.value)}
                      />
                      <div className="verify-option-content">
                        <i className="fab fa-facebook" style={{ color: '#1877f2' }}></i>
                        <div>
                          <strong>Facebook Page</strong>
                          <span>Link your Facebook Business page</span>
                        </div>
                      </div>
                    </label>
                    
                    <label className={`verify-option ${verifyMethod === 'document' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="verifyMethod"
                        value="document"
                        checked={verifyMethod === 'document'}
                        onChange={(e) => setVerifyMethod(e.target.value)}
                      />
                      <div className="verify-option-content">
                        <i className="fas fa-file-alt" style={{ color: '#6366f1' }}></i>
                        <div>
                          <strong>Business Documents</strong>
                          <span>Upload business license or registration</span>
                        </div>
                      </div>
                    </label>
                    
                    <label className={`verify-option ${verifyMethod === 'phone' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="verifyMethod"
                        value="phone"
                        checked={verifyMethod === 'phone'}
                        onChange={(e) => setVerifyMethod(e.target.value)}
                      />
                      <div className="verify-option-content">
                        <i className="fas fa-phone" style={{ color: '#10b981' }}></i>
                        <div>
                          <strong>Phone Verification</strong>
                          <span>Verify via business phone call</span>
                        </div>
                      </div>
                    </label>
                  </div>

                  {verifyMethod === 'google' && (
                    <div className="form-group" style={{ marginTop: '20px' }}>
                      <label>Google Business Profile URL</label>
                      <input
                        type="url"
                        placeholder="https://www.google.com/maps/place/..."
                        value={verifyData.googleUrl || ''}
                        onChange={(e) => setVerifyData({ ...verifyData, googleUrl: e.target.value })}
                      />
                    </div>
                  )}

                  {verifyMethod === 'facebook' && (
                    <div className="form-group" style={{ marginTop: '20px' }}>
                      <label>Facebook Page URL</label>
                      <input
                        type="url"
                        placeholder="https://www.facebook.com/yourbusiness"
                        value={verifyData.facebookUrl || ''}
                        onChange={(e) => setVerifyData({ ...verifyData, facebookUrl: e.target.value })}
                      />
                    </div>
                  )}

                  {verifyMethod === 'document' && (
                    <div className="form-group" style={{ marginTop: '20px' }}>
                      <label>Upload Business Document</label>
                      <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                        Upload your business license, registration certificate, or tax ID document.
                      </p>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setVerifyData({ ...verifyData, document: reader.result, fileName: file.name });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      {verifyData.fileName && (
                        <p style={{ fontSize: '12px', color: '#10b981', marginTop: '8px' }}>
                          <i className="fas fa-check"></i> {verifyData.fileName}
                        </p>
                      )}
                    </div>
                  )}

                  {verifyMethod === 'phone' && (
                    <div className="form-group" style={{ marginTop: '20px' }}>
                      <label>Business Phone Number</label>
                      <input
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={verifyData.phone || ''}
                        onChange={(e) => setVerifyData({ ...verifyData, phone: e.target.value })}
                      />
                      <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                        We will call this number to verify ownership.
                      </p>
                    </div>
                  )}

                  <div className="delete-modal-footer" style={{ marginTop: '25px' }}>
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => setShowVerifyModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-action btn-primary-action"
                      disabled={verifyLoading || !verifyMethod}
                      style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                    >
                      {verifyLoading ? (
                        <><i className="fas fa-spinner fa-spin"></i> Submitting...</>
                      ) : (
                        <><i className="fas fa-shield-alt"></i> Submit Verification</>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="delete-modal-overlay" onClick={() => setShowDeleteModal(false)}>
            <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
              <div className="delete-modal-header">
                <i className="fas fa-exclamation-triangle"></i>
                <h3>Delete Business Listing</h3>
              </div>
              <div className="delete-modal-body">
                <div className="delete-warning">
                  <p>
                    <strong>Warning:</strong> This action cannot be undone. Deleting your business listing will:
                  </p>
                  <ul style={{ margin: '10px 0 0 20px', padding: 0 }}>
                    <li>Remove your business from all search results</li>
                    <li>Delete all associated reviews and ratings</li>
                    <li>Permanently remove all business information</li>
                  </ul>
                  {deletingBusinessId && businesses.find(b => b.id === deletingBusinessId) && (
                    <p style={{ marginTop: '15px', fontWeight: 600 }}>
                      Are you sure you want to delete <strong>"{businesses.find(b => b.id === deletingBusinessId).name}"</strong>?
                    </p>
                  )}
                </div>
                {error && (
                  <div className="alert alert-error">
                    <i className="fas fa-exclamation-circle"></i>
                    {error}
                  </div>
                )}
                <div className="delete-modal-footer">
                  <button
                    className="btn-cancel"
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeletingBusinessId(null);
                    }}
                    disabled={deleting}
                  >
                    <i className="fas fa-times"></i>
                    Cancel
                  </button>
                  <button
                    className="btn-confirm-delete"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-trash"></i>
                        Yes, Delete Listing
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessOwnerDashboard;

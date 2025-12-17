import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './UserBusinesses.css';

const UserBusinesses = () => {
  const { user } = useContext(AuthContext);
  const [businesses, setBusinesses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    email: '',
    website: '',
    hours: {},
    facebook: '',
    instagram: '',
    twitter: '',
    logo: '',
    images: [],
    videos: []
  });

  useEffect(() => {
    fetchBusinesses();
    fetchCategories();
  }, []);

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      // Use my-businesses endpoint
      const response = await api.get('/businesses/my-businesses');
      setBusinesses(response.data.businesses || []);
    } catch (error) {
      console.error('Error fetching businesses:', error);
      // Set empty array on error
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      categoryId: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      phone: '',
      email: '',
      website: '',
      hours: {},
      facebook: '',
      instagram: '',
      twitter: '',
      logo: '',
      images: [],
      videos: []
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowCreateModal(true);
    setMessage({ type: '', text: '' });
  };

  const handleOpenEdit = (business) => {
    setSelectedBusiness(business);
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
      hours: business.hours && typeof business.hours === 'object' ? business.hours : {},
      facebook: business.socialLinks?.facebook || '',
      instagram: business.socialLinks?.instagram || '',
      twitter: business.socialLinks?.twitter || '',
      logo: business.logo || '',
      images: business.images || [],
      videos: business.videos || []
    });
    setShowEditModal(true);
    setMessage({ type: '', text: '' });
  };

  const handleOpenDelete = (business) => {
    setSelectedBusiness(business);
    setShowDeleteModal(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Logo must be less than 2MB' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (formData.images.length + files.length > 10) {
      setMessage({ type: 'error', text: 'Maximum 10 images allowed' });
      return;
    }
    files.forEach(file => {
      if (file.size > 2 * 1024 * 1024) {
        setMessage({ type: 'error', text: `Image ${file.name} is too large (max 2MB)` });
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
        setMessage({ type: 'error', text: 'Maximum 5 videos allowed' });
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

  const handleHoursChange = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      hours: {
        ...prev.hours,
        [day]: {
          ...prev.hours[day],
          [field]: value
        }
      }
    }));
  };

  const toggleDayClosed = (day) => {
    setFormData(prev => {
      const currentDay = prev.hours[day] || {};
      const isCurrentlyClosed = currentDay.closed;
      const hasHours = currentDay.open || currentDay.close;
      
      if (isCurrentlyClosed || !hasHours) {
        // Opening the day - remove closed flag and initialize with empty hours
        const newHours = { ...prev.hours };
        newHours[day] = { open: '', close: '', closed: false };
        return { ...prev, hours: newHours };
      } else {
        // Closing the day - mark as closed and clear hours
        const newHours = { ...prev.hours };
        newHours[day] = { closed: true };
        return { ...prev, hours: newHours };
      }
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      // Clean up hours - remove days that don't have any hours set
      const cleanedHours = {};
      Object.keys(formData.hours).forEach(day => {
        const dayHours = formData.hours[day];
        if (dayHours && (dayHours.open || dayHours.close || dayHours.closed)) {
          cleanedHours[day] = dayHours;
        }
      });

      const submitData = {
        ...formData,
        hours: cleanedHours,
        socialLinks: {
          facebook: formData.facebook,
          instagram: formData.instagram,
          twitter: formData.twitter
        }
      };
      delete submitData.facebook;
      delete submitData.instagram;
      delete submitData.twitter;

      await api.post('/businesses', submitData, {
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      setMessage({ type: 'success', text: 'Thank you for claiming your business. Your profile will not appear publicly until it is reviewed and approved by our admin team. You will be notified once the status changes.' });
      setShowCreateModal(false);
      fetchBusinesses();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Failed to create business' 
      });
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      // Clean up hours - remove days that don't have any hours set
      const cleanedHours = {};
      Object.keys(formData.hours).forEach(day => {
        const dayHours = formData.hours[day];
        if (dayHours && (dayHours.open || dayHours.close || dayHours.closed)) {
          cleanedHours[day] = dayHours;
        }
      });

      const submitData = {
        ...formData,
        hours: cleanedHours,
        socialLinks: {
          facebook: formData.facebook,
          instagram: formData.instagram,
          twitter: formData.twitter
        }
      };
      delete submitData.facebook;
      delete submitData.instagram;
      delete submitData.twitter;

      await api.put(`/businesses/${selectedBusiness.id}`, submitData, {
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      setMessage({ type: 'success', text: 'Business updated successfully!' });
      setShowEditModal(false);
      fetchBusinesses();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Failed to update business' 
      });
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/businesses/${selectedBusiness.id}`);
      setMessage({ type: 'success', text: 'Business deleted successfully!' });
      setShowDeleteModal(false);
      fetchBusinesses();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Failed to delete business' 
      });
    }
  };

  const handleResubmit = async (businessId) => {
    try {
      await api.post(`/businesses/${businessId}/resubmit`);
      setMessage({ type: 'success', text: 'Business resubmitted for review!' });
      fetchBusinesses();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Failed to resubmit business' 
      });
    }
  };

  const getStatusBadge = (business) => {
    if (business.rejectedAt) {
      return <span className="status-badge status-rejected"><i className="fas fa-times-circle"></i> Rejected</span>;
    } else if (business.approvedAt || (business.isActive && business.isVerified)) {
      return <span className="status-badge status-approved"><i className="fas fa-check-circle"></i> Approved</span>;
    } else {
      return <span className="status-badge status-pending"><i className="fas fa-clock"></i> Pending</span>;
    }
  };

  const formatLastLogin = (date) => {
    if (!date) return 'Never';
    const loginDate = new Date(date);
    return loginDate.toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="user-businesses-container">
      {/* Header */}
      <div className="businesses-header-card">
        <div className="businesses-header-content">
          <div>
            <h1>Hello, {user?.firstName || user?.name || 'User'}!</h1>
            <p className="last-login">
              <i className="fas fa-clock"></i>
              Last login: {formatLastLogin(user?.lastLogin)}
            </p>
          </div>
          <button onClick={handleOpenCreate} className="btn-create-business">
            <i className="fas fa-plus-circle"></i>
            Create New Business
          </button>
        </div>
      </div>

      {/* Alert Message */}
      {message.text && (
        <div className={`alert-modern alert-${message.type}`}>
          <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="alert-close">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {/* Businesses List */}
      <div className="businesses-content-card">
        <div className="content-header">
          <h2>
            <i className="fas fa-store"></i>
            My Businesses
          </h2>
          <p>Manage all your business listings</p>
        </div>

        {loading ? (
          <div className="loading-state">
            <i className="fas fa-spinner fa-spin"></i>
            <p>Loading businesses...</p>
          </div>
        ) : businesses.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-store-slash"></i>
            <h3>No Businesses Yet</h3>
            <p>Start by creating your first business listing</p>
            <button onClick={handleOpenCreate} className="btn-empty-action">
              <i className="fas fa-plus-circle"></i>
              Create Your First Business
            </button>
          </div>
        ) : (
          <div className="businesses-grid">
            {businesses.map(business => (
              <div key={business.id} className="business-card-modern">
                <div className="business-card-header">
                  <div className="business-logo-container">
                    {business.logo ? (
                      <img src={business.logo} alt={business.name} />
                    ) : (
                      <i className="fas fa-building"></i>
                    )}
                  </div>
                  {getStatusBadge(business)}
                </div>

                <div className="business-card-body">
                  <h3>{business.name}</h3>
                  <p className="business-category">
                    <i className="fas fa-tag"></i>
                    {business.category?.name || 'Uncategorized'}
                  </p>
                  <p className="business-location">
                    <i className="fas fa-map-marker-alt"></i>
                    {business.city}, {business.state}
                  </p>
                  <p className="business-rating">
                    <i className="fas fa-star"></i>
                    {business.ratingAverage && typeof business.ratingAverage === 'number' 
                      ? business.ratingAverage.toFixed(1) 
                      : 'N/A'} ({business.ratingCount || 0} reviews)
                  </p>

                  {business.rejectedAt && business.rejectionReason && (
                    <div className="rejection-notice">
                      <i className="fas fa-info-circle"></i>
                      <strong>Reason:</strong> {business.rejectionReason}
                    </div>
                  )}
                </div>

                <div className="business-card-actions">
                  <Link to={`/businesses/${business.id}`} className="btn-action btn-view">
                    <i className="fas fa-eye"></i>
                    View
                  </Link>
                  <button onClick={() => handleOpenEdit(business)} className="btn-action btn-edit">
                    <i className="fas fa-edit"></i>
                    Edit
                  </button>
                  {business.rejectedAt && (
                    <button onClick={() => handleResubmit(business.id)} className="btn-action btn-resubmit">
                      <i className="fas fa-redo"></i>
                      Resubmit
                    </button>
                  )}
                  <button onClick={() => handleOpenDelete(business)} className="btn-action btn-delete">
                    <i className="fas fa-trash"></i>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content-modern" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-plus-circle"></i> Create New Business</h2>
              <button onClick={() => setShowCreateModal(false)} className="modal-close">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleCreate} className="modal-form">
              <div className="form-grid">
                <div className="form-field full-width">
                  <label>Business Name <span className="required">*</span></label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter business name"
                    required
                  />
                </div>

                <div className="form-field full-width">
                  <label>Description <span className="required">*</span></label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Describe your business"
                    rows="4"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Category <span className="required">*</span></label>
                  <select
                    name="categoryId"
                    value={formData.categoryId}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Phone <span className="required">*</span></label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+1 (555) 000-0000"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Email <span className="required">*</span></label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="business@example.com"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Website</label>
                  <input
                    type="url"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    placeholder="https://example.com"
                  />
                </div>

                <div className="form-field full-width">
                  <label>Address <span className="required">*</span></label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Street address"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>City <span className="required">*</span></label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="City"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>State <span className="required">*</span></label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="State"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Zip Code <span className="required">*</span></label>
                  <input
                    type="text"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleChange}
                  placeholder="Zip code"
                  required
                />
              </div>

              <div className="form-field full-width">
                <label>Business Hours <span className="field-hint">(Select days and set opening/closing times)</span></label>
                <div className="workdays-editor">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                    const dayHours = formData.hours[day] || {};
                    const dayName = day.charAt(0).toUpperCase() + day.slice(1);
                    // Day is active if it has hours set and is not closed
                    const isDayActive = !dayHours.closed && (dayHours.open || dayHours.close);
                    // Checkbox is checked if day is active (has hours set)
                    const isChecked = isDayActive;
                    return (
                      <div key={day} className={`workday-row ${isDayActive ? 'active' : ''} ${dayHours.closed ? 'closed' : ''}`}>
                        <div className="workday-day">
                          <label className="checkbox-wrapper">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleDayClosed(day)}
                              className="day-checkbox"
                            />
                            <span className="checkbox-custom"></span>
                            <span className="day-label">{dayName}</span>
                          </label>
                        </div>
                        {isDayActive && (
                          <div className="time-inputs-wrapper">
                            <div className="time-input-group">
                              <label className="time-label">Open</label>
                              <input
                                type="time"
                                value={dayHours.open || ''}
                                onChange={(e) => handleHoursChange(day, 'open', e.target.value)}
                                className="time-input"
                              />
                            </div>
                            <span className="time-separator">-</span>
                            <div className="time-input-group">
                              <label className="time-label">Close</label>
                              <input
                                type="time"
                                value={dayHours.close || ''}
                                onChange={(e) => handleHoursChange(day, 'close', e.target.value)}
                                className="time-input"
                              />
                            </div>
                          </div>
                        )}
                        {dayHours.closed && (
                          <div className="closed-indicator">
                            <i className="fas fa-times-circle"></i>
                            <span>Closed</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="form-field">
                <label>Facebook URL</label>
                  <input
                    type="url"
                    name="facebook"
                    value={formData.facebook}
                    onChange={handleChange}
                    placeholder="https://facebook.com/..."
                  />
                </div>

                <div className="form-field">
                  <label>Instagram URL</label>
                  <input
                    type="url"
                    name="instagram"
                    value={formData.instagram}
                    onChange={handleChange}
                    placeholder="https://instagram.com/..."
                  />
                </div>

                <div className="form-field">
                  <label>Twitter URL</label>
                  <input
                    type="url"
                    name="twitter"
                    value={formData.twitter}
                    onChange={handleChange}
                    placeholder="https://twitter.com/..."
                  />
                </div>

                {/* Media Section */}
                <div className="form-field full-width media-section">
                  <label><i className="fas fa-images"></i> Media & Gallery</label>
                  
                  {/* Logo Upload */}
                  <div className="media-subsection">
                    <label className="subsection-label">Business Logo</label>
                    <div className="logo-upload-area">
                      {formData.logo ? (
                        <div className="logo-preview">
                          <img src={formData.logo} alt="Business Logo" />
                          <button type="button" className="remove-btn" onClick={() => setFormData({...formData, logo: ''})}>
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ) : (
                        <label className="upload-placeholder">
                          <i className="fas fa-cloud-upload-alt"></i>
                          <span>Upload Logo</span>
                          <small>Max 2MB</small>
                          <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Images Upload */}
                  <div className="media-subsection">
                    <label className="subsection-label">Business Images ({formData.images.length}/10)</label>
                    <div className="images-grid">
                      {formData.images.map((img, index) => (
                        <div key={index} className="image-preview-item">
                          <img src={img} alt={`Business ${index + 1}`} />
                          <button type="button" className="remove-btn" onClick={() => removeImage(index)}>
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ))}
                      {formData.images.length < 10 && (
                        <label className="add-image-btn">
                          <i className="fas fa-plus"></i>
                          <span>Add</span>
                          <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Videos */}
                  <div className="media-subsection">
                    <label className="subsection-label">Business Videos ({formData.videos.length}/5)</label>
                    <div className="videos-list">
                      {formData.videos.map((video, index) => (
                        <div key={index} className="video-item">
                          <i className="fas fa-play-circle"></i>
                          <span>{video.length > 40 ? video.substring(0, 40) + '...' : video}</span>
                          <button type="button" className="remove-btn" onClick={() => removeVideo(index)}>
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      ))}
                      {formData.videos.length < 5 && (
                        <button type="button" className="add-video-btn" onClick={handleVideoAdd}>
                          <i className="fas fa-plus"></i> Add Video URL
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  <i className="fas fa-check"></i>
                  Create Business
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content-modern" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-edit"></i> Edit Business</h2>
              <button onClick={() => setShowEditModal(false)} className="modal-close">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleUpdate} className="modal-form">
              <div className="form-grid">
                <div className="form-field full-width">
                  <label>Business Name <span className="required">*</span></label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-field full-width">
                  <label>Description <span className="required">*</span></label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows="4"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Category <span className="required">*</span></label>
                  <select
                    name="categoryId"
                    value={formData.categoryId}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Phone <span className="required">*</span></label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Email <span className="required">*</span></label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Website</label>
                  <input
                    type="url"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-field full-width">
                  <label>Address <span className="required">*</span></label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>City <span className="required">*</span></label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>State <span className="required">*</span></label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Zip Code <span className="required">*</span></label>
                  <input
                    type="text"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-field full-width">
                  <label>Business Hours</label>
                  <div className="workdays-editor">
                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                      const dayHours = formData.hours[day] || {};
                      const dayName = day.charAt(0).toUpperCase() + day.slice(1);
                      return (
                        <div key={day} className="workday-row">
                          <div className="workday-day">
                            <input
                              type="checkbox"
                              checked={!dayHours.closed && (dayHours.open || dayHours.close)}
                              onChange={() => toggleDayClosed(day)}
                            />
                            <label>{dayName}</label>
                          </div>
                          {!dayHours.closed && (
                            <>
                              <input
                                type="time"
                                value={dayHours.open || ''}
                                onChange={(e) => handleHoursChange(day, 'open', e.target.value)}
                                placeholder="Open"
                                className="time-input"
                              />
                              <span className="time-separator">-</span>
                              <input
                                type="time"
                                value={dayHours.close || ''}
                                onChange={(e) => handleHoursChange(day, 'close', e.target.value)}
                                placeholder="Close"
                                className="time-input"
                              />
                            </>
                          )}
                          {dayHours.closed && (
                            <span className="closed-label">Closed</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="form-field">
                  <label>Facebook URL</label>
                  <input
                    type="url"
                    name="facebook"
                    value={formData.facebook}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-field">
                  <label>Instagram URL</label>
                  <input
                    type="url"
                    name="instagram"
                    value={formData.instagram}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-field">
                  <label>Twitter URL</label>
                  <input
                    type="url"
                    name="twitter"
                    value={formData.twitter}
                    onChange={handleChange}
                  />
                </div>

                {/* Media Section */}
                <div className="form-field full-width media-section">
                  <label><i className="fas fa-images"></i> Media & Gallery</label>
                  
                  {/* Logo Upload */}
                  <div className="media-subsection">
                    <label className="subsection-label">Business Logo</label>
                    <div className="logo-upload-area">
                      {formData.logo ? (
                        <div className="logo-preview">
                          <img src={formData.logo} alt="Business Logo" />
                          <button type="button" className="remove-btn" onClick={() => setFormData({...formData, logo: ''})}>
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ) : (
                        <label className="upload-placeholder">
                          <i className="fas fa-cloud-upload-alt"></i>
                          <span>Upload Logo</span>
                          <small>Max 2MB</small>
                          <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Images Upload */}
                  <div className="media-subsection">
                    <label className="subsection-label">Business Images ({formData.images?.length || 0}/10)</label>
                    <div className="images-grid">
                      {formData.images?.map((img, index) => (
                        <div key={index} className="image-preview-item">
                          <img src={img} alt={`Business ${index + 1}`} />
                          <button type="button" className="remove-btn" onClick={() => removeImage(index)}>
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ))}
                      {(formData.images?.length || 0) < 10 && (
                        <label className="add-image-btn">
                          <i className="fas fa-plus"></i>
                          <span>Add</span>
                          <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Videos */}
                  <div className="media-subsection">
                    <label className="subsection-label">Business Videos ({formData.videos?.length || 0}/5)</label>
                    <div className="videos-list">
                      {formData.videos?.map((video, index) => (
                        <div key={index} className="video-item">
                          <i className="fas fa-play-circle"></i>
                          <span>{video.length > 40 ? video.substring(0, 40) + '...' : video}</span>
                          <button type="button" className="remove-btn" onClick={() => removeVideo(index)}>
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      ))}
                      {(formData.videos?.length || 0) < 5 && (
                        <button type="button" className="add-video-btn" onClick={handleVideoAdd}>
                          <i className="fas fa-plus"></i> Add Video URL
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  <i className="fas fa-save"></i>
                  Update Business
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content-modern modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-exclamation-triangle"></i> Confirm Delete</h2>
              <button onClick={() => setShowDeleteModal(false)} className="modal-close">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{selectedBusiness?.name}</strong>?</p>
              <p className="warning-text">This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowDeleteModal(false)} className="btn-cancel">
                Cancel
              </button>
              <button onClick={handleDelete} className="btn-delete-confirm">
                <i className="fas fa-trash"></i>
                Delete Business
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserBusinesses;


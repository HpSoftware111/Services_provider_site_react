import React, { useState, useEffect, useContext, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './BusinessInformation.css';

const BusinessInformation = () => {
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const businessIdParam = searchParams.get('businessId');
  
  const [business, setBusiness] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const messageRef = useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'USA',
    categoryId: '',
    subCategoryId: '',
    hours: {},
    socialMedia: [],
    tags: [],
    isPublic: true
  });
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [newSocialPlatform, setNewSocialPlatform] = useState('');
  const [newSocialUrl, setNewSocialUrl] = useState('');
  const [newTag, setNewTag] = useState('');

  const socialPlatforms = [
    { value: 'facebook', label: 'Facebook' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'twitter', label: 'Twitter' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'pinterest', label: 'Pinterest' }
  ];

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    fetchData();
  }, [businessIdParam]);

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

  const fetchData = async () => {
    try {
      // Fetch all user businesses first
      const businessRes = await api.get('/businesses/my-businesses');
      const allBusinesses = businessRes.data.businesses || [];
      setBusinesses(allBusinesses);
      
      let selectedBusiness = null;
      
      // If businessIdParam is provided, fetch that specific business
      if (businessIdParam) {
        try {
          const singleBusinessRes = await api.get(`/businesses/${businessIdParam}`);
          selectedBusiness = singleBusinessRes.data.business;
        } catch (error) {
          // If not found, try to find in the list
          selectedBusiness = allBusinesses.find(b => b.id === parseInt(businessIdParam));
        }
      }
      
      // If no business found yet, get first from list
      if (!selectedBusiness && allBusinesses.length > 0) {
        selectedBusiness = allBusinesses[0];
      }

      const [categoriesRes] = await Promise.all([
        api.get('/categories')
      ]);
      
      setCategories(categoriesRes.data.categories || []);

      if (selectedBusiness) {
        setBusiness(selectedBusiness);
        setFormData({
          name: selectedBusiness.name || '',
          description: selectedBusiness.description || '',
          phone: selectedBusiness.phone || '',
          email: selectedBusiness.email || '',
          website: selectedBusiness.website || '',
          address: selectedBusiness.address || '',
          city: selectedBusiness.city || '',
          state: selectedBusiness.state || '',
          zipCode: selectedBusiness.zipCode || '',
          country: selectedBusiness.country || 'USA',
          categoryId: selectedBusiness.categoryId || '',
          subCategoryId: selectedBusiness.subCategoryId || '',
          hours: selectedBusiness.hours || {},
          socialMedia: selectedBusiness.socialLinks && typeof selectedBusiness.socialLinks === 'object' 
            ? Object.entries(selectedBusiness.socialLinks).map(([platform, url]) => ({ platform, url }))
            : [],
          tags: Array.isArray(selectedBusiness.tags) ? selectedBusiness.tags : [],
          isPublic: selectedBusiness.isPublic !== undefined ? selectedBusiness.isPublic : true
        });

        // Fetch subcategories if category is selected
        if (selectedBusiness.categoryId) {
          fetchSubCategories(selectedBusiness.categoryId);
        }
      }
      setCategories(categoriesRes.data.categories || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubCategories = async (categoryId) => {
    try {
      const response = await api.get(`/subcategories?categoryId=${categoryId}`);
      setSubCategories(response.data.subcategories || []);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
      setSubCategories([]);
    }
  };

  const handleBusinessChange = async (businessId) => {
    if (!businessId) return;
    
    try {
      setLoading(true);
      const businessRes = await api.get(`/businesses/${businessId}`);
      const selectedBusiness = businessRes.data.business;
      
      setBusiness(selectedBusiness);
      setFormData({
        name: selectedBusiness.name || '',
        description: selectedBusiness.description || '',
        phone: selectedBusiness.phone || '',
        email: selectedBusiness.email || '',
        website: selectedBusiness.website || '',
        address: selectedBusiness.address || '',
        city: selectedBusiness.city || '',
        state: selectedBusiness.state || '',
        zipCode: selectedBusiness.zipCode || '',
        country: selectedBusiness.country || 'USA',
        categoryId: selectedBusiness.categoryId || '',
        subCategoryId: selectedBusiness.subCategoryId || '',
        hours: selectedBusiness.hours || {},
        socialMedia: selectedBusiness.socialLinks && typeof selectedBusiness.socialLinks === 'object' 
          ? Object.entries(selectedBusiness.socialLinks).map(([platform, url]) => ({ platform, url }))
          : [],
        tags: Array.isArray(selectedBusiness.tags) ? selectedBusiness.tags : [],
        isPublic: selectedBusiness.isPublic !== undefined ? selectedBusiness.isPublic : true
      });

      // Fetch subcategories if category is selected
      if (selectedBusiness.categoryId) {
        fetchSubCategories(selectedBusiness.categoryId);
      }
    } catch (error) {
      console.error('Error fetching business:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'categoryId') {
      fetchSubCategories(value);
      setFormData(prev => ({ ...prev, subCategoryId: '' }));
    }
  };

  const handleHoursChange = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      hours: {
        ...prev.hours,
        [day]: {
          ...prev.hours[day],
          [field]: value,
          enabled: prev.hours[day]?.enabled !== false
        }
      }
    }));
  };

  const toggleDayEnabled = (day) => {
    setFormData(prev => ({
      ...prev,
      hours: {
        ...prev.hours,
        [day]: {
          ...prev.hours[day],
          enabled: !prev.hours[day]?.enabled
        }
      }
    }));
  };

  const addSocialMedia = () => {
    if (newSocialPlatform && newSocialUrl) {
      setFormData(prev => ({
        ...prev,
        socialMedia: [...prev.socialMedia, { platform: newSocialPlatform, url: newSocialUrl }]
      }));
      setNewSocialPlatform('');
      setNewSocialUrl('');
    }
  };

  const removeSocialMedia = (index) => {
    setFormData(prev => ({
      ...prev,
      socialMedia: prev.socialMedia.filter((_, i) => i !== index)
    }));
  };

  const addTag = () => {
    if (newTag.trim()) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (index) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!business) return;

    setSaving(true);
    try {
      // Convert socialMedia array to object format (socialLinks)
      const socialLinks = {};
      formData.socialMedia.forEach(social => {
        if (social.platform && social.url) {
          socialLinks[social.platform] = social.url;
        }
      });

      // Prepare submit data - only send fields that exist in the model
      const submitData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim().toUpperCase(),
        country: formData.country || 'USA',
        categoryId: parseInt(formData.categoryId)
      };

      // Add optional fields only if they have values
      if (formData.website && formData.website.trim()) {
        submitData.website = formData.website.trim();
      }
      if (formData.zipCode && formData.zipCode.trim()) {
        submitData.zipCode = formData.zipCode.trim();
      }
      if (formData.subCategoryId) {
        submitData.subCategoryId = parseInt(formData.subCategoryId);
      }
      if (formData.hours && Object.keys(formData.hours).length > 0) {
        submitData.hours = formData.hours;
      }
      if (Object.keys(socialLinks).length > 0) {
        submitData.socialLinks = socialLinks;
      }
      if (Array.isArray(formData.tags) && formData.tags.length > 0) {
        submitData.tags = formData.tags;
      }
      if (formData.isPublic !== undefined) {
        submitData.isPublic = formData.isPublic;
      }

      await api.put(`/businesses/${business.id}`, submitData);
      setMessage({ type: 'success', text: 'Business information updated successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to update business information';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="business-information-page"><div className="loading">Loading...</div></div>;
  }

  if (!business) {
    return <div className="business-information-page"><div className="empty">No business found</div></div>;
  }

  return (
    <div className="business-information-page">
      <div className="page-header-section">
        <h1 className="page-title">Business Information</h1>
        {businesses.length > 1 && (
          <div className="business-selector">
            <label htmlFor="business-select">Select Business:</label>
            <select
              id="business-select"
              value={business?.id || ''}
              onChange={(e) => handleBusinessChange(e.target.value)}
              className="business-select-dropdown"
            >
              {businesses.map(biz => (
                <option key={biz.id} value={biz.id}>
                  {biz.name} {!biz.isActive ? '(Pending)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
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
      
      <form onSubmit={handleSubmit} className="business-form">
        {/* Basic Information */}
        <div className="form-section">
          <h3 className="section-title">Basic Information</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Business Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Enter business name"
              />
            </div>
            <div className="form-field">
              <label>Category *</label>
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                required
              >
                <option value="">Select category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Sub Category</label>
              <select
                name="subCategoryId"
                value={formData.subCategoryId}
                onChange={handleChange}
                disabled={!formData.categoryId}
              >
                <option value="">Select sub category</option>
                {subCategories.map(subCat => (
                  <option key={subCat.id} value={subCat.id}>{subCat.name}</option>
                ))}
              </select>
            </div>
            <div className="form-field full-width">
              <label>Description *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows="5"
                placeholder="Describe your business"
              />
            </div>
          </div>
        </div>

        {/* Contact Details */}
        <div className="form-section">
          <h3 className="section-title">Contact Details</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Phone Number *</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div className="form-field">
              <label>Email Address *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="business@example.com"
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
          </div>
        </div>

        {/* Address Information */}
        <div className="form-section">
          <h3 className="section-title">Address Information</h3>
          <div className="form-grid">
            <div className="form-field full-width">
              <label>Street Address *</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                placeholder="123 Main Street"
              />
            </div>
            <div className="form-field">
              <label>City *</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                required
                placeholder="City"
              />
            </div>
            <div className="form-field">
              <label>State *</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                required
                placeholder="State"
                maxLength="2"
              />
            </div>
            <div className="form-field">
              <label>Zip Code</label>
              <input
                type="text"
                name="zipCode"
                value={formData.zipCode}
                onChange={handleChange}
                placeholder="12345"
              />
            </div>
            <div className="form-field">
              <label>Country *</label>
              <select
                name="country"
                value={formData.country}
                onChange={handleChange}
                required
              >
                <option value="USA">United States</option>
                <option value="Canada">Canada</option>
                <option value="UK">United Kingdom</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Social Media Links */}
        <div className="form-section">
          <h3 className="section-title">Social Media Links</h3>
          <div className="social-media-section">
            {formData.socialMedia.map((social, index) => (
              <div key={index} className="social-media-item">
                <div className="social-platform-badge">
                  {socialPlatforms.find(p => p.value === social.platform)?.label || social.platform}
                </div>
                <input
                  type="url"
                  value={social.url}
                  onChange={(e) => {
                    const updated = [...formData.socialMedia];
                    updated[index].url = e.target.value;
                    setFormData(prev => ({ ...prev, socialMedia: updated }));
                  }}
                  placeholder="https://..."
                  className="social-url-input"
                />
                <button
                  type="button"
                  className="remove-social-btn"
                  onClick={() => removeSocialMedia(index)}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
            <div className="add-social-media">
              <select
                value={newSocialPlatform}
                onChange={(e) => setNewSocialPlatform(e.target.value)}
                className="social-platform-select"
              >
                <option value="">Select Platform</option>
                {socialPlatforms.map(platform => (
                  <option key={platform.value} value={platform.value}>
                    {platform.label}
                  </option>
                ))}
              </select>
              <input
                type="url"
                value={newSocialUrl}
                onChange={(e) => setNewSocialUrl(e.target.value)}
                placeholder="Enter URL"
                className="social-url-input"
              />
              <button
                type="button"
                className="add-social-btn"
                onClick={addSocialMedia}
                disabled={!newSocialPlatform || !newSocialUrl}
              >
                <i className="fas fa-plus"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Working Hours */}
        <div className="form-section">
          <h3 className="section-title">Working Hours</h3>
          <div className="hours-section">
            {daysOfWeek.map(day => (
              <div key={day} className="hours-row">
                <div className="day-toggle">
                  <input
                    type="checkbox"
                    checked={formData.hours[day]?.enabled !== false}
                    onChange={() => toggleDayEnabled(day)}
                    id={`day-${day}`}
                  />
                  <label htmlFor={`day-${day}`} className="day-label">{day}</label>
                </div>
                {formData.hours[day]?.enabled !== false && (
                  <div className="hours-inputs">
                    <input
                      type="time"
                      value={formData.hours[day]?.open || ''}
                      onChange={(e) => handleHoursChange(day, 'open', e.target.value)}
                      className="time-input"
                    />
                    <span className="time-separator">to</span>
                    <input
                      type="time"
                      value={formData.hours[day]?.close || ''}
                      onChange={(e) => handleHoursChange(day, 'close', e.target.value)}
                      className="time-input"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="form-section">
          <h3 className="section-title">Tags</h3>
          <div className="tags-section">
            {formData.tags.length > 0 && (
              <div className="tags-list">
                {formData.tags.map((tag, index) => (
                  <div key={index} className="tag-item">
                    <span>{tag}</span>
                    <button
                      type="button"
                      className="remove-tag-btn"
                      onClick={() => removeTag(index)}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="add-tag">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Enter tag and press Enter"
                className="tag-input"
              />
              <button
                type="button"
                className="add-tag-btn"
                onClick={addTag}
                disabled={!newTag.trim()}
              >
                <i className="fas fa-plus"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Visibility Settings */}
        <div className="form-section">
          <h3 className="section-title">Visibility Settings</h3>
          <div className="form-field full-width">
            <label className="checkbox-option" style={{ flexDirection: 'row', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#f8f9fa', border: '1px solid #e1e8ed', borderRadius: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.isPublic}
                onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '14px', color: '#2c3e50' }}>
                Display this business profile on the main site
              </span>
            </label>
            <p style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '8px', marginLeft: '30px' }}>
              When enabled, your business will be visible to all visitors on the main site. When disabled, only you can see it in your dashboard.
            </p>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="save-btn" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BusinessInformation;

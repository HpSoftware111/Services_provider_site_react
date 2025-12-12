import React, { useState, useContext, useEffect, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './UserProfile.css';

const UserProfile = () => {
  const { user, checkAuth } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [avatarPreview, setAvatarPreview] = useState('');
  const messageRef = useRef(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    username: '',
    email: '',
    secondEmail: '',
    phone: '',
    country: 'USA',
    state: '',
    city: '',
    address: '',
    zipCode: '',
    avatar: ''
  });

  useEffect(() => {
    if (user) {
      // Auto-generate username from email if not set
      const autoUsername = user.username || user.email?.split('@')[0] || '';
      
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        gender: user.gender || '',
        username: autoUsername,
        email: user.email || '',
        secondEmail: user.secondEmail || '',
        phone: user.phone || '',
        country: user.country || 'USA',
        state: user.state || '',
        city: user.city || '',
        address: user.address || '',
        zipCode: user.zipCode || '',
        avatar: user.avatar || ''
      });
      
      setAvatarPreview(user.avatar || '');
    }
  }, [user]);

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 2MB before compression)
      if (file.size > 2 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Image size should be less than 2MB' });
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setMessage({ type: 'error', text: 'Please select a valid image file' });
        return;
      }

      // Compress and create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          // Create canvas for compression
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Calculate new dimensions (max 300x300 for better compression)
          let width = img.width;
          let height = img.height;
          const maxSize = 300;
          
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to compressed base64 (quality 0.6 for smaller size)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
          
          setAvatarPreview(compressedDataUrl);
          setFormData(prev => ({
            ...prev,
            avatar: compressedDataUrl
          }));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent form reset
    const form = e.target;
    if (form) {
      form.reset = () => {}; // Disable form reset
    }
    
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await api.put('/auth/updateprofile', formData);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      
      // Refresh user data
      await checkAuth();
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      // CRITICAL: Preserve form data - never reset it on error
      e?.preventDefault?.();
      e?.stopPropagation?.();
      
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Failed to update profile' 
      });
    } finally {
      setLoading(false);
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
    <div className="user-profile-container">
      {/* Header Section */}
      <div className="profile-header-card">
        <div className="profile-header-content">
          <div className="user-avatar-large">
            {avatarPreview ? (
              <img src={avatarPreview} alt={user?.name} />
            ) : (
              <i className="fas fa-user-circle"></i>
            )}
          </div>
          <div className="user-header-info">
            <h1>Hello, {user?.firstName || user?.name || 'User'}!</h1>
            <p className="last-login">
              <i className="fas fa-clock"></i>
              Last login: {formatLastLogin(user?.lastLogin)}
            </p>
          </div>
        </div>
      </div>

      {/* Success/Error Message */}
      {message.text && (
        <div ref={messageRef} className={`alert-modern alert-${message.type} alert-visible`}>
          <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="alert-close">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {/* Profile Form */}
      <div className="profile-form-card">
        <div className="form-header">
          <h2>
            <i className="fas fa-user-edit"></i>
            Account Settings
          </h2>
          <p>Update your personal information and preferences</p>
        </div>

        <form onSubmit={handleSubmit} className="modern-form" noValidate onReset={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}>
          {/* Photo Upload Section */}
          <div className="form-section">
            <h3 className="section-title">
              <i className="fas fa-camera"></i>
              Profile Picture
            </h3>
            <div className="photo-upload-section">
              <div className="current-photo">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Profile" />
                ) : (
                  <i className="fas fa-user"></i>
                )}
              </div>
              <div className="photo-upload-actions">
                <label htmlFor="photo-upload" className="btn-upload">
                  <i className="fas fa-cloud-upload-alt"></i>
                  Choose Photo
                </label>
                <input
                  type="file"
                  id="photo-upload"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  style={{ display: 'none' }}
                />
                <p className="upload-hint">
                  <i className="fas fa-info-circle"></i>
                  JPG, PNG or GIF (max 2MB, auto-compressed to 300x300)
                </p>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="form-section">
            <h3 className="section-title">
              <i className="fas fa-id-card"></i>
              Personal Information
            </h3>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="firstName">
                  First Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Enter your first name"
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="lastName">
                  Last Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Enter your last name"
                  required
                />
              </div>

              <div className="form-field full-width">
                <label>Gender</label>
                <div className="radio-group-modern">
                  <label className="radio-modern">
                    <input
                      type="radio"
                      name="gender"
                      value="male"
                      checked={formData.gender === 'male'}
                      onChange={handleChange}
                    />
                    <span className="radio-custom"></span>
                    <span className="radio-label">Male</span>
                  </label>
                  <label className="radio-modern">
                    <input
                      type="radio"
                      name="gender"
                      value="female"
                      checked={formData.gender === 'female'}
                      onChange={handleChange}
                    />
                    <span className="radio-custom"></span>
                    <span className="radio-label">Female</span>
                  </label>
                  <label className="radio-modern">
                    <input
                      type="radio"
                      name="gender"
                      value="other"
                      checked={formData.gender === 'other'}
                      onChange={handleChange}
                    />
                    <span className="radio-custom"></span>
                    <span className="radio-label">Other</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="form-section highlighted-section-modern">
            <h3 className="section-title">
              <i className="fas fa-envelope"></i>
              Contact Information
            </h3>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="username">
                  Username <span className="required">*</span>
                </label>
                <div className="input-with-icon-modern">
                  <i className="fas fa-user"></i>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="Your username"
                    required
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="email">
                  Primary Email <span className="required">*</span>
                </label>
                <div className="input-with-icon-modern">
                  <i className="fas fa-envelope"></i>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="your@email.com"
                    disabled
                    className="disabled-input"
                  />
                </div>
                <small className="field-hint">
                  <i className="fas fa-lock"></i>
                  Email cannot be changed
                </small>
              </div>

              <div className="form-field">
                <label htmlFor="secondEmail">Secondary Email</label>
                <div className="input-with-icon-modern">
                  <i className="fas fa-envelope-open"></i>
                  <input
                    type="email"
                    id="secondEmail"
                    name="secondEmail"
                    value={formData.secondEmail}
                    onChange={handleChange}
                    placeholder="backup@email.com"
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="phone">
                  Phone Number <span className="required">*</span>
                </label>
                <div className="input-with-icon-modern">
                  <i className="fas fa-phone"></i>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+1 (555) 000-0000"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="form-section">
            <h3 className="section-title">
              <i className="fas fa-map-marker-alt"></i>
              Address
            </h3>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="country">
                  Country <span className="required">*</span>
                </label>
                <select
                  id="country"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  required
                >
                  <option value="USA">🇺🇸 United States</option>
                  <option value="Canada">🇨🇦 Canada</option>
                  <option value="UK">🇬🇧 United Kingdom</option>
                  <option value="Australia">🇦🇺 Australia</option>
                  <option value="Germany">🇩🇪 Germany</option>
                  <option value="France">🇫🇷 France</option>
                  <option value="India">🇮🇳 India</option>
                  <option value="Other">🌍 Other</option>
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="state">State / Province</label>
                <input
                  type="text"
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="Enter state or province"
                />
              </div>

              <div className="form-field">
                <label htmlFor="city">City</label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Enter city"
                />
              </div>

              <div className="form-field">
                <label htmlFor="zipCode">Zip / Postal Code</label>
                <input
                  type="text"
                  id="zipCode"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleChange}
                  placeholder="Enter zip code"
                />
              </div>

              <div className="form-field full-width">
                <label htmlFor="address">Street Address</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Enter your street address"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="form-actions">
            <button type="submit" className="btn-submit-modern" disabled={loading}>
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Updating...
                </>
              ) : (
                <>
                  <i className="fas fa-save"></i>
                  Update Profile
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserProfile;

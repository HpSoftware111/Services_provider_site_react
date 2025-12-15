import React, { useState, useContext, useEffect, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './AccountSettings.css';

const AccountSettings = () => {
  const { user, checkAuth } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    name: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    username: ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [passwordError, setPasswordError] = useState('');
  const messageRef = useRef(null);
  const passwordErrorRef = useRef(null);

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

  // Scroll password error into view when it appears
  useEffect(() => {
    if (passwordError && passwordErrorRef.current) {
      passwordErrorRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  }, [passwordError]);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        username: user.username || user.email?.split('@')[0] || ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent form reset
    const form = e.target;
    if (form) {
      form.reset = () => { }; // Disable form reset
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      await api.put('/auth/updateprofile', formData);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      await checkAuth();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      // CRITICAL: Preserve form data - never reset it on error
      e?.preventDefault?.();
      e?.stopPropagation?.();

      const errorMsg = error.response?.data?.error || 'Failed to update profile';
      setMessage({
        type: 'error',
        text: errorMsg
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image size must be less than 2MB' });
      return;
    }

    setUploadingAvatar(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        await api.put('/auth/updateprofile', { avatar: reader.result });
        setMessage({ type: 'success', text: 'Profile picture updated successfully!' });
        await checkAuth();
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } catch (error) {
        setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to upload profile picture' });
      } finally {
        setUploadingAvatar(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent form reset
    const form = e.target;
    if (form) {
      form.reset = () => { }; // Disable form reset
    }

    setLoading(true);
    setMessage({ type: '', text: '' });
    setPasswordError('');

    // Client-side validation
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match');
      setLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const response = await api.put('/auth/changepassword', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      // Only clear on success
      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setShowPasswordModal(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordError('');
      setShowPasswords({ current: false, new: false, confirm: false });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      // CRITICAL: Preserve form data - never reset it on error
      // Prevent any navigation or refresh
      e?.preventDefault?.();
      e?.stopPropagation?.();

      const errorMsg = error.response?.data?.error || 'Failed to change password';
      const status = error.response?.status;

      // Handle different error types
      if (status === 401) {
        // Current password is incorrect
        setPasswordError('Current password is incorrect. Please try again.');
      } else if (status === 400) {
        // Validation error
        setPasswordError(errorMsg);
      } else if (status === 500) {
        setPasswordError('Server error. Please try again later.');
      } else {
        setPasswordError(errorMsg);
      }

      setMessage({
        type: 'error',
        text: errorMsg
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="account-settings-page">
        <div className="loading-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="account-settings-page">
      <h1 className="page-title">Account Settings</h1>

      {message.text && (
        <div ref={messageRef} className={`alert alert-${message.type} alert-visible`}>
          <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i>
          <span>{message.text}</span>
        </div>
      )}

      <div className="settings-container">
        {/* Profile Settings */}
        <div className="settings-section">
          <h3 className="section-title">Profile Information</h3>
          <form onSubmit={handleSubmit} className="settings-form" noValidate onReset={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}>
            <div className="form-grid">
              <div className="form-field full-width">
                <label>Display Name (Profile Name) *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="This name will appear on your business profile"
                />
                <small className="field-hint">This is the name that will be displayed on your business profile page</small>
              </div>
              <div className="form-field">
                <label>First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-field">
                <label>Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-field">
                <label>Username *</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-field">
                <label>Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled
                  className="disabled-input"
                />
                <small className="field-hint">Email cannot be changed</small>
              </div>
              <div className="form-field">
                <label>Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="save-btn" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Profile Avatar/Logo */}
        <div className="settings-section">
          <h3 className="section-title">Profile Picture</h3>
          <div className="avatar-upload-section">
            <div className="avatar-preview">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} />
              ) : (
                <i className="fas fa-user-circle"></i>
              )}
              {uploadingAvatar && (
                <div className="avatar-upload-overlay">
                  <i className="fas fa-spinner fa-spin"></i>
                </div>
              )}
            </div>
            <label className="avatar-upload-btn">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ display: 'none' }}
                disabled={uploadingAvatar}
              />
              {uploadingAvatar ? 'Uploading...' : 'Upload Profile Picture'}
            </label>
            <p className="avatar-hint">Upload a profile picture that will be displayed on your business profile page</p>
          </div>
        </div>

        {/* Security Settings */}
        <div className="settings-section">
          <h3 className="section-title">Security</h3>
          <div className="security-options">
            <div className="security-item">
              <div>
                <h4>Change Password</h4>
                <p>Update your account password</p>
              </div>
              <button
                type="button"
                className="action-btn"
                onClick={() => setShowPasswordModal(true)}
              >
                Change Password
              </button>
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="settings-section">
          <h3 className="section-title">Notification Preferences</h3>
          <div className="notification-options">
            <label className="checkbox-option">
              <input type="checkbox" defaultChecked />
              <span>Email notifications for new reviews</span>
            </label>
            <label className="checkbox-option">
              <input type="checkbox" defaultChecked />
              <span>Email notifications for business updates</span>
            </label>
            <label className="checkbox-option">
              <input type="checkbox" />
              <span>Marketing emails and promotions</span>
            </label>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className="fas fa-lock"></i> Change Password</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setPasswordError('');
                  setShowPasswords({ current: false, new: false, confirm: false });
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handlePasswordChange} className="password-form" noValidate onReset={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}>
              {passwordError && (
                <div ref={passwordErrorRef} className="password-error-message password-error-visible">
                  <i className="fas fa-exclamation-circle"></i>
                  <span>{passwordError}</span>
                </div>
              )}
              <div className="form-field">
                <label>Current Password *</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => {
                      setPasswordData({ ...passwordData, currentPassword: e.target.value });
                      setPasswordError('');
                    }}
                    required
                    placeholder="Enter current password"
                    className={passwordError && passwordError.includes('Current password') ? 'error-input' : ''}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                    tabIndex={-1}
                  >
                    <i className={`fas ${showPasswords.current ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>
              <div className="form-field">
                <label>New Password *</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => {
                      setPasswordData({ ...passwordData, newPassword: e.target.value });
                      setPasswordError('');
                    }}
                    required
                    placeholder="Enter new password (min 6 characters)"
                    minLength={6}
                    className={passwordError && !passwordError.includes('Current password') ? 'error-input' : ''}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                    tabIndex={-1}
                  >
                    <i className={`fas ${showPasswords.new ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>
              <div className="form-field">
                <label>Confirm New Password *</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => {
                      setPasswordData({ ...passwordData, confirmPassword: e.target.value });
                      setPasswordError('');
                    }}
                    required
                    placeholder="Confirm new password"
                    minLength={6}
                    className={passwordError && !passwordError.includes('Current password') ? 'error-input' : ''}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                    tabIndex={-1}
                  >
                    <i className={`fas ${showPasswords.confirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="save-btn" disabled={loading}>
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountSettings;


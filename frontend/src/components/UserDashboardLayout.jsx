import React, { useState, useContext, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import BusinessHeader from './BusinessHeader';
import api from '../services/api';
import './UserDashboardLayout.css';

const UserDashboardLayout = ({ children }) => {
  const { user, logout, checkAuth } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingField, setEditingField] = useState(null); // 'name' or 'avatar'
  const [editName, setEditName] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);

  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
    }
  }, [user]);

  // Load subscription status for providers
  useEffect(() => {
    const loadSubscriptionStatus = async () => {
      if (user && (user.role === 'business_owner' || user.role === 'provider')) {
        try {
          const response = await api.get('/subscriptions/my-subscription');
          if (response.data.subscription) {
            setSubscriptionStatus(response.data.subscription);
          } else {
            setSubscriptionStatus(null);
          }
        } catch (error) {
          console.error('Error loading subscription status:', error);
          setSubscriptionStatus(null);
        }
      }
    };
    loadSubscriptionStatus();
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  const handleEditName = () => {
    setEditingField('name');
    setEditName(user?.name || '');
    setShowEditModal(true);
  };


  const handleSaveName = async () => {
    if (!editName.trim()) {
      setMessage({ type: 'error', text: 'Name cannot be empty' });
      return;
    }

    try {
      await api.put('/auth/updateprofile', { name: editName.trim() });
      setMessage({ type: 'success', text: 'Profile name updated successfully!' });
      await checkAuth();
      setShowEditModal(false);
      setEditingField(null);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to update name' });
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
        setShowEditModal(false);
        setEditingField(null);
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } catch (error) {
        setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to upload profile picture' });
      } finally {
        setUploadingAvatar(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Check if user is a provider/business owner
  const isProvider = user?.role === 'business_owner' || user?.role === 'provider';

  // Customer section items
  const customerItems = [
    { path: '/user-dashboard/my-business', icon: 'fa-store', label: 'My Business' },
    { path: '/user-dashboard/business-information', icon: 'fa-info-circle', label: 'Business Information' },
    { path: '/user-dashboard/categories-services', icon: 'fa-tags', label: 'Categories & Services' },
    { path: '/user-dashboard/photos-videos', icon: 'fa-images', label: 'Photos & Videos' },
    { path: '/user-dashboard/business-location', icon: 'fa-map-marker-alt', label: 'Business Location' },
    { path: '/user-dashboard/deals-promotions', icon: 'fa-percent', label: 'Deals & Promotions' },
    { path: '/user-dashboard/verify-business', icon: 'fa-shield-alt', label: 'Verify Your Business' },
    { path: '/user-dashboard/reviews', icon: 'fa-star', label: 'Reviews' },
    { path: '/user-dashboard/requests', icon: 'fa-clipboard-list', label: 'My Requests' },
    { path: '/user-dashboard/account-settings', icon: 'fa-cog', label: 'Account Settings' },
  ];

  // Provider section items
  const providerItems = [
    { path: '/user-dashboard/leads', icon: 'fa-bullhorn', label: 'My Leads' },
    { path: '/user-dashboard/work-orders', icon: 'fa-tasks', label: 'Work Orders' },
    { path: '/user-dashboard/messages', icon: 'fa-envelope', label: 'Messages' },
    { path: '/user-dashboard/payouts', icon: 'fa-money-bill-wave', label: 'My Payouts' },
    { path: '/user-dashboard/subscriptions', icon: 'fa-crown', label: 'Subscriptions' }
  ];

  return (
    <div className="modern-dashboard-wrapper">
      {/* Mobile Menu Toggle */}
      <button
        className="mobile-menu-toggle-btn"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle menu"
      >
        <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
      </button>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="mobile-sidebar-overlay"
          onClick={() => setMobileMenuOpen(false)}
        ></div>
      )}

      {/* Left Sidebar */}
      <aside className={`modern-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-content">
          {/* Profile Header */}
          <div className="sidebar-profile-header">
            <div className="profile-header-content">
              <div className="profile-avatar-container">
                <label
                  className="profile-avatar-label"
                  htmlFor="avatar-upload-input"
                  title="Click to change profile picture"
                >
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user?.name || 'Profile'} />
                  ) : (
                    <i className="fas fa-user-circle"></i>
                  )}
                  {uploadingAvatar && (
                    <div className="avatar-upload-overlay">
                      <i className="fas fa-spinner fa-spin"></i>
                    </div>
                  )}
                  <div className="avatar-edit-icon">
                    <i className="fas fa-camera"></i>
                  </div>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  style={{ display: 'none' }}
                  id="avatar-upload-input"
                  disabled={uploadingAvatar}
                />
              </div>
              <div className="profile-name-container">
                <h3 className="profile-name" onClick={handleEditName} title="Click to edit name">
                  {user?.name || 'User'}
                  <i className="fas fa-pencil-alt edit-icon"></i>
                </h3>
                <p className="profile-email">{user?.email || ''}</p>
              </div>
            </div>
            {message.text && (
              <div className={`profile-message alert-${message.type}`}>
                <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i>
                <span>{message.text}</span>
              </div>
            )}
          </div>

          <nav className="sidebar-nav">
            {/* Customer Section */}
            <div className="nav-section">
              <div className="nav-divider">
                <span className="nav-divider-text">Customer</span>
              </div>
              {customerItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <i className={`fas ${item.icon}`}></i>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>

            {/* Provider Section */}
            {isProvider && (
              <div className="nav-section">
                <div className="nav-divider">
                  <span className="nav-divider-text">Provider</span>
                </div>
                {providerItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <i className={`fas ${item.icon}`}></i>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </nav>

          <div className="sidebar-footer">
            <button
              onClick={() => {
                window.open('/', '_blank');
                setMobileMenuOpen(false);
              }}
              className="nav-item view-customer-btn"
              title="View main site as customer"
            >
              <i className="fas fa-external-link-alt"></i>
              <span>View as Customer</span>
            </button>
            <button
              onClick={() => {
                handleLogout();
                setMobileMenuOpen(false);
              }}
              className="nav-item logout-btn"
            >
              <i className="fas fa-sign-out-alt"></i>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Edit Name Modal */}
      {showEditModal && editingField === 'name' && (
        <div className="modal-overlay" onClick={() => {
          setShowEditModal(false);
          setEditingField(null);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className="fas fa-edit"></i> Edit Profile Name</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingField(null);
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Display Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter your display name"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveName();
                    }
                  }}
                />
                <small className="field-hint">This name will appear on your business profile page</small>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingField(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="save-btn"
                onClick={handleSaveName}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="modern-dashboard-main">
        {/* Subscription Expired Warning Banner */}
        {subscriptionStatus && subscriptionStatus.status === 'EXPIRED' && location.pathname !== '/user-dashboard/subscriptions' && (
          <div style={{
            backgroundColor: '#fef3c7',
            border: '2px solid #f59e0b',
            borderLeft: '4px solid #d97706',
            padding: '16px 20px',
            margin: '20px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            boxShadow: '0 2px 8px rgba(217, 119, 6, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
              <i className="fas fa-exclamation-triangle" style={{ fontSize: '24px', color: '#d97706' }}></i>
              <div>
                <strong style={{ display: 'block', marginBottom: '4px', color: '#92400e', fontSize: '16px' }}>
                  Your subscription has expired
                </strong>
                <span style={{ color: '#78350f', fontSize: '14px' }}>
                  {subscriptionStatus.currentPeriodEnd 
                    ? `Expired on ${new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString()}. `
                    : ''}
                  Renew your subscription to continue accessing premium features.
                </span>
              </div>
            </div>
            <button
              onClick={() => navigate('/user-dashboard/subscriptions')}
              style={{
                backgroundColor: '#d97706',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                whiteSpace: 'nowrap',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#b45309'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#d97706'}
            >
              <i className="fas fa-crown" style={{ marginRight: '6px' }}></i>
              Renew Now
            </button>
          </div>
        )}
        <div className="modern-content-area">
          {children}
        </div>
      </div>
    </div>
  );
};

export default UserDashboardLayout;

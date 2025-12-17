import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './Auth.css';

const AddBusiness = () => {
  const navigate = useNavigate();
  const { user, providerSignup, checkAuth } = useContext(AuthContext);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [formData, setFormData] = useState({
    name: '', description: '', categoryId: '', subCategoryId: '', address: '', city: '', state: '', zipCode: '',
    phone: '', email: '', website: '',
    socialLinks: { facebook: '', twitter: '', instagram: '', linkedin: '' },
    images: [],
    videos: []
  });
  // Simplified form data for logged-out users
  const [simpleFormData, setSimpleFormData] = useState({
    businessName: '',
    categoryId: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAuthOptions, setShowAuthOptions] = useState(false);
  const [createdBusinessId, setCreatedBusinessId] = useState(null);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [videoUrls, setVideoUrls] = useState(['']);
  const [showPassword, setShowPassword] = useState(false);
  const errorRef = useRef(null);
  const successRef = useRef(null);

  useEffect(() => {
    loadCategories();

    const pendingBusinessId = localStorage.getItem('pendingBusinessId');
    if (pendingBusinessId && user) {
      setCreatedBusinessId(parseInt(pendingBusinessId));
      setShowAuthOptions(true);
    }
  }, []);

  useEffect(() => {
    if (user && !showAuthOptions) {
      const pendingBusinessId = localStorage.getItem('pendingBusinessId');
      if (pendingBusinessId) {
        setCreatedBusinessId(parseInt(pendingBusinessId));
        setShowAuthOptions(true);
      }
    }
  }, [user]);

  useEffect(() => {
    if (formData.categoryId) {
      loadSubcategories(formData.categoryId);
    } else {
      setSubcategories([]);
    }
  }, [formData.categoryId]);

  // Scroll error into view when it appears
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  }, [error]);

  // Scroll success into view when it appears
  useEffect(() => {
    if (success && successRef.current) {
      successRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  }, [success]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadSubcategories = async (categoryId) => {
    try {
      const response = await api.get(`/subcategories?categoryId=${categoryId}`);
      setSubcategories(response.data.subcategories || []);
    } catch (error) {
      console.error('Error loading subcategories:', error);
      setSubcategories([]);
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const maxSize = 2 * 1024 * 1024; // 2MB

    files.forEach(file => {
      if (file.size > maxSize) {
        setError('Each image must be less than 2MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result]);
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, reader.result]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleVideoUrlChange = (index, value) => {
    const newUrls = [...videoUrls];
    newUrls[index] = value;
    setVideoUrls(newUrls);
    setFormData(prev => ({
      ...prev,
      videos: newUrls.filter(url => url.trim() !== '')
    }));
  };

  const addVideoUrl = () => {
    setVideoUrls(prev => [...prev, '']);
  };

  const removeVideoUrl = (index) => {
    setVideoUrls(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({
      ...prev,
      videos: prev.videos.filter((_, i) => i !== index)
    }));
  };

  const [registrationComplete, setRegistrationComplete] = useState(false);

  const handleSimpleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (simpleFormData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await providerSignup({
        businessName: simpleFormData.businessName,
        categoryId: parseInt(simpleFormData.categoryId),
        email: simpleFormData.email,
        password: simpleFormData.password,
        phone: simpleFormData.phone,
        address: simpleFormData.address,
        city: simpleFormData.city || '',
        state: simpleFormData.state || '',
        zipCode: simpleFormData.zipCode || null
      });

      if (response.needsVerification) {
        setRegistrationComplete(true);
        setSuccess('Account and business created successfully! Please check your email to verify your account.');
      } else if (response.token) {
        // Only auto-login if token is provided (email verified or bypassed)
        setSuccess('Account and business created successfully! You are now logged in. Your business is pending approval.');
        await checkAuth();
        setTimeout(() => navigate('/user-dashboard/my-business'), 2000);
      } else {
        // No token means verification needed
        setRegistrationComplete(true);
        setSuccess('Account and business created successfully! Please check your email to verify your account.');
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    e.preventDefault();
    e.stopPropagation();

    // Prevent form reset
    const form = e.target;
    if (form) {
      form.reset = () => { }; // Disable form reset
    }

    setLoading(true);

    try {
      const cleanData = {
        ...formData,
        categoryId: parseInt(formData.categoryId),
        subCategoryId: formData.subCategoryId ? parseInt(formData.subCategoryId) : null,
        zipCode: formData.zipCode || null,
        email: formData.email || null,
        website: formData.website || null
      };

      const response = await api.post('/businesses', cleanData);

      if (!user && response.data.requiresAuth) {
        setCreatedBusinessId(response.data.business.id);
        setShowAuthOptions(true);
        setSuccess('Business submitted successfully! Create an account or sign in to manage your business listing.');
        localStorage.setItem('pendingBusinessId', response.data.business.id);
      } else {
        setSuccess('Business submitted successfully! It will be reviewed and approved soon.');
        setTimeout(() => navigate('/'), 3000);
      }
    } catch (error) {
      // CRITICAL: Preserve form data - never reset it on error
      e?.preventDefault?.();
      e?.stopPropagation?.();

      setError(error.response?.data?.error || 'Failed to submit business. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkBusiness = async () => {
    if (!user || !createdBusinessId) return;

    try {
      setLoading(true);
      await api.post('/businesses/link-to-account', { businessIds: [createdBusinessId] });
      localStorage.removeItem('pendingBusinessId');
      setSuccess('Business successfully linked to your account!');
      setTimeout(() => navigate('/user-dashboard/my-businesses'), 2000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to link business to account.');
    } finally {
      setLoading(false);
    }
  };

  // Show simplified form for logged-out users
  if (!user) {
    // Show verification message if registration complete
    if (registrationComplete) {
      return (
        <div className="auth-page">
          <div className="auth-container verification-sent">
            <div className="verification-icon">
              <i className="fas fa-envelope-open-text"></i>
            </div>
            <h2>Check Your Email</h2>
            <p className="verification-message">
              We've sent a verification link to <strong>{simpleFormData.email}</strong>
            </p>
            <p className="verification-instructions">
              Please click the link in the email to verify your account.
              Once verified, you can log in to your account.
            </p>
            <div className="verification-tips">
              <p><i className="fas fa-info-circle"></i> Didn't receive the email?</p>
              <ul>
                <li>Check your spam or junk folder</li>
                <li>Make sure you entered the correct email</li>
                <li>Wait a few minutes and try again</li>
              </ul>
            </div>
            <Link to="/login" className="btn-primary">
              <i className="fas fa-sign-in-alt"></i> Go to Login
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="auth-page">
        <div className="auth-container" style={{ maxWidth: '600px' }}>
          <h2><i className="fas fa-plus-circle"></i> Add Your Business for FREE</h2>
          <p style={{ fontSize: '16px', color: '#059669', fontWeight: '600', marginBottom: '10px' }}>
            <i className="fas fa-check-circle"></i> Quick signup - Create your account and business in one step!
          </p>
          <p>Fill out the form below to create your account and submit your business for listing approval.</p>

          {error && <div ref={errorRef} className="alert alert-error alert-visible"><i className="fas fa-exclamation-circle"></i> <span>{error}</span></div>}
          {success && <div ref={successRef} className="alert alert-success alert-visible"><i className="fas fa-check-circle"></i> <span>{success}</span></div>}

          <form onSubmit={handleSimpleSubmit}>
            <div className="form-group">
              <label><i className="fas fa-briefcase"></i> Business Name *</label>
              <input
                type="text"
                required
                placeholder="Enter your business name"
                value={simpleFormData.businessName}
                onChange={(e) => setSimpleFormData({ ...simpleFormData, businessName: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label><i className="fas fa-tag"></i> Category *</label>
              <select
                required
                value={simpleFormData.categoryId}
                onChange={(e) => setSimpleFormData({ ...simpleFormData, categoryId: e.target.value })}
              >
                <option value="">Select a category</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label><i className="fas fa-envelope"></i> Email Address *</label>
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={simpleFormData.email}
                onChange={(e) => setSimpleFormData({ ...simpleFormData, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label><i className="fas fa-lock"></i> Password *</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="At least 6 characters"
                  value={simpleFormData.password}
                  onChange={(e) => setSimpleFormData({ ...simpleFormData, password: e.target.value })}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <div className="form-group">
              <label><i className="fas fa-phone"></i> Phone Number *</label>
              <input
                type="tel"
                required
                placeholder="(555) 123-4567"
                value={simpleFormData.phone}
                onChange={(e) => setSimpleFormData({ ...simpleFormData, phone: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label><i className="fas fa-map-marker-alt"></i> Address *</label>
              <input
                type="text"
                required
                placeholder="123 Main Street"
                value={simpleFormData.address}
                onChange={(e) => setSimpleFormData({ ...simpleFormData, address: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label><i className="fas fa-city"></i> City</label>
                <input
                  type="text"
                  placeholder="City"
                  value={simpleFormData.city}
                  onChange={(e) => setSimpleFormData({ ...simpleFormData, city: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label><i className="fas fa-map"></i> State</label>
                <input
                  type="text"
                  placeholder="CA"
                  maxLength="2"
                  value={simpleFormData.state}
                  onChange={(e) => setSimpleFormData({ ...simpleFormData, state: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="form-group">
                <label><i className="fas fa-mail-bulk"></i> Zip Code</label>
                <input
                  type="text"
                  placeholder="12345"
                  value={simpleFormData.zipCode}
                  onChange={(e) => setSimpleFormData({ ...simpleFormData, zipCode: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: '10px' }}>
              <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-user-plus'}`}></i>
              {loading ? ' Creating Account...' : ' Create Account & Submit Business'}
            </button>

            <p style={{ textAlign: 'center', marginTop: '20px', color: '#7f8c8d', fontSize: '14px' }}>
              <i className="fas fa-info-circle"></i> Already have an account? <Link to="/login">Sign in here</Link>
            </p>
          </form>
        </div>
      </div>
    );
  }

  // Full form for logged-in users - redirect to dashboard
  return (
    <div className="auth-page">
      <div className="auth-container" style={{ maxWidth: '700px' }}>
        <h2><i className="fas fa-plus-circle"></i> Add Your Business for FREE</h2>
        <p style={{ fontSize: '16px', color: '#059669', fontWeight: '600', marginBottom: '10px' }}>
          <i className="fas fa-check-circle"></i> Free registration - No subscription required to get started!
        </p>
        <p>Fill out the form below to submit your business for listing approval</p>

        {error && <div ref={errorRef} className="alert alert-error alert-visible"><i className="fas fa-exclamation-circle"></i> <span>{error}</span></div>}
        {success && <div ref={successRef} className="alert alert-success alert-visible"><i className="fas fa-check-circle"></i> <span>{success}</span></div>}

        <form onSubmit={handleSubmit} noValidate onReset={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}>
          <div className="form-group">
            <label><i className="fas fa-briefcase"></i> Business Name *</label>
            <input
              type="text"
              required
              placeholder="Enter your business name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label><i className="fas fa-tag"></i> Category *</label>
            <select required value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, subCategoryId: '' })}>
              <option value="">Select a category</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>

          {subcategories.length > 0 && (
            <div className="form-group">
              <label><i className="fas fa-folder"></i> Subcategory</label>
              <select value={formData.subCategoryId} onChange={(e) => setFormData({ ...formData, subCategoryId: e.target.value })}>
                <option value="">Select a subcategory (optional)</option>
                {subcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
              </select>
            </div>
          )}

          <div className="form-group">
            <label><i className="fas fa-align-left"></i> Description *</label>
            <textarea
              required
              placeholder="Describe your business, services, and what makes you unique"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="4"
            />
          </div>

          <div className="form-group">
            <label><i className="fas fa-map-marker-alt"></i> Street Address *</label>
            <input
              type="text"
              required
              placeholder="123 Main Street"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '15px' }}>
            <div className="form-group">
              <label><i className="fas fa-city"></i> City *</label>
              <input
                type="text"
                required
                placeholder="City"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label><i className="fas fa-map"></i> State *</label>
              <input
                type="text"
                required
                placeholder="CA"
                maxLength="2"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="form-group">
              <label><i className="fas fa-mail-bulk"></i> Zip Code</label>
              <input
                type="text"
                placeholder="12345"
                value={formData.zipCode}
                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label><i className="fas fa-phone"></i> Phone Number *</label>
            <input
              type="tel"
              required
              placeholder="(555) 123-4567"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label><i className="fas fa-envelope"></i> Email Address</label>
            <input
              type="email"
              placeholder="contact@yourbusiness.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label><i className="fas fa-globe"></i> Website</label>
            <input
              type="url"
              placeholder="https://yourbusiness.com"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: '10px' }}>
            <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
            {loading ? ' Submitting...' : ' Submit Business for Review'}
          </button>

          <p style={{ textAlign: 'center', marginTop: '20px', color: '#7f8c8d', fontSize: '14px' }}>
            <i className="fas fa-info-circle"></i> Your business will be reviewed by our team and published once approved.
          </p>
        </form>
      </div>
    </div>
  );
};

export default AddBusiness;

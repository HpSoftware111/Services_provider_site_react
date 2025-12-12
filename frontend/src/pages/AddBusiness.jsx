import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './Auth.css';

const AddBusiness = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [formData, setFormData] = useState({
    name: '', description: '', categoryId: '', subCategoryId: '', address: '', city: '', state: '', zipCode: '',
    phone: '', email: '', website: '',
    socialLinks: { facebook: '', twitter: '', instagram: '', linkedin: '' },
    images: [],
    videos: []
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAuthOptions, setShowAuthOptions] = useState(false);
  const [createdBusinessId, setCreatedBusinessId] = useState(null);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [videoUrls, setVideoUrls] = useState(['']);
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

        {showAuthOptions && !user && (
          <div className="auth-options-card" style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '30px',
            borderRadius: '12px',
            marginBottom: '25px',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '22px' }}>
              <i className="fas fa-user-plus"></i> Create Account or Sign In
            </h3>
            <p style={{ margin: '0 0 20px 0', opacity: 0.95 }}>
              Link your business to your account to manage it easily!
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/register" className="btn-auth-option">
                <i className="fas fa-user-plus"></i> Create Account
              </Link>
              <Link to="/login" className="btn-auth-option-secondary">
                <i className="fas fa-sign-in-alt"></i> Sign In
              </Link>
            </div>
          </div>
        )}

        {showAuthOptions && user && (
          <div className="link-business-card" style={{
            background: '#f0f9ff',
            border: '2px solid #667eea',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '25px',
            textAlign: 'center'
          }}>
            <p style={{ margin: '0 0 15px 0', color: '#374151' }}>
              <i className="fas fa-link"></i> Link your business to your account?
            </p>
            <button onClick={handleLinkBusiness} disabled={loading} className="btn-link-business">
              {loading ? 'Linking...' : 'Link Business to Account'}
            </button>
          </div>
        )}

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

          {/* Images Section */}
          <h3 style={{ marginTop: '30px', marginBottom: '15px', color: '#2c3e50' }}>
            <i className="fas fa-images"></i> Business Photos (Optional)
          </h3>

          <div className="form-group">
            <label>Upload Images (Max 2MB each)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              style={{ padding: '10px' }}
            />
            {imagePreviews.length > 0 && (
              <div className="image-previews" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                gap: '10px',
                marginTop: '15px'
              }}>
                {imagePreviews.map((preview, index) => (
                  <div key={index} style={{ position: 'relative' }}>
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      style={{
                        width: '100%',
                        height: '100px',
                        objectFit: 'cover',
                        borderRadius: '8px'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Videos Section */}
          <h3 style={{ marginTop: '30px', marginBottom: '15px', color: '#2c3e50' }}>
            <i className="fas fa-video"></i> Business Videos (Optional)
          </h3>

          <div className="form-group">
            <label>Video URLs (YouTube, Vimeo, or direct links)</label>
            {videoUrls.map((url, index) => (
              <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={url}
                  onChange={(e) => handleVideoUrlChange(index, e.target.value)}
                  style={{ flex: 1 }}
                />
                {videoUrls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVideoUrl(index)}
                    style={{
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0 15px',
                      cursor: 'pointer'
                    }}
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addVideoUrl}
              style={{
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              <i className="fas fa-plus"></i> Add Another Video
            </button>
          </div>

          <h3 style={{ marginTop: '30px', marginBottom: '15px', color: '#2c3e50' }}>
            <i className="fas fa-share-alt"></i> Social Media Links (Optional)
          </h3>

          <div className="form-group">
            <label><i className="fab fa-facebook"></i> Facebook</label>
            <input
              type="url"
              placeholder="https://facebook.com/yourpage"
              value={formData.socialLinks.facebook}
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
              placeholder="https://twitter.com/yourhandle"
              value={formData.socialLinks.twitter}
              onChange={(e) => setFormData({
                ...formData,
                socialLinks: { ...formData.socialLinks, twitter: e.target.value }
              })}
            />
          </div>

          <div className="form-group">
            <label><i className="fab fa-instagram"></i> Instagram</label>
            <input
              type="url"
              placeholder="https://instagram.com/yourhandle"
              value={formData.socialLinks.instagram}
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
              placeholder="https://linkedin.com/company/yourcompany"
              value={formData.socialLinks.linkedin}
              onChange={(e) => setFormData({
                ...formData,
                socialLinks: { ...formData.socialLinks, linkedin: e.target.value }
              })}
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

import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './AdminEditBusiness.css';

const AdminEditBusiness = ({ business, onClose, onUpdate }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState('');
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
    socialLinks: { facebook: '', twitter: '', instagram: '', linkedin: '' },
    isActive: false,
    isVerified: false,
    isFeatured: false
  });

  useEffect(() => {
    if (business) {
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
        isActive: business.isActive || false,
        isVerified: business.isVerified || false,
        isFeatured: business.isFeatured || false
      });
    }
    loadCategories();
  }, [business]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data.categories || []);
    } catch (error) {
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSuccess('');
    setLoading(true);

    // Client-side validation
    const newFieldErrors = {};
    
    if (!formData.name || formData.name.trim().length < 2) {
      newFieldErrors.name = 'Business name must be at least 2 characters';
    } else if (formData.name.length > 100) {
      newFieldErrors.name = 'Business name cannot exceed 100 characters';
    }

    if (!formData.description || formData.description.trim().length < 10) {
      newFieldErrors.description = 'Description must be at least 10 characters';
    } else if (formData.description.length > 2000) {
      newFieldErrors.description = 'Description cannot exceed 2000 characters';
    }

    if (!formData.categoryId) {
      newFieldErrors.categoryId = 'Please select a category';
    }

    if (!formData.address || formData.address.trim().length === 0) {
      newFieldErrors.address = 'Address is required';
    }

    if (!formData.city || formData.city.trim().length === 0) {
      newFieldErrors.city = 'City is required';
    }

    if (!formData.state || formData.state.trim().length < 2) {
      newFieldErrors.state = 'State is required (minimum 2 characters)';
    }

    if (!formData.phone || formData.phone.trim().length < 10) {
      newFieldErrors.phone = 'Valid phone number is required (minimum 10 digits)';
    }

    if (formData.email && formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newFieldErrors.email = 'Please enter a valid email address';
    }

    if (formData.website && formData.website.trim() && !/^https?:\/\/.+/.test(formData.website)) {
      newFieldErrors.website = 'Website URL must start with http:// or https://';
    }

    // Validate social links
    if (formData.socialLinks?.facebook && formData.socialLinks.facebook.trim() && !/^https?:\/\/.+/.test(formData.socialLinks.facebook)) {
      newFieldErrors['socialLinks.facebook'] = 'Facebook URL must be a valid URL';
    }
    if (formData.socialLinks?.twitter && formData.socialLinks.twitter.trim() && !/^https?:\/\/.+/.test(formData.socialLinks.twitter)) {
      newFieldErrors['socialLinks.twitter'] = 'Twitter URL must be a valid URL';
    }
    if (formData.socialLinks?.instagram && formData.socialLinks.instagram.trim() && !/^https?:\/\/.+/.test(formData.socialLinks.instagram)) {
      newFieldErrors['socialLinks.instagram'] = 'Instagram URL must be a valid URL';
    }
    if (formData.socialLinks?.linkedin && formData.socialLinks.linkedin.trim() && !/^https?:\/\/.+/.test(formData.socialLinks.linkedin)) {
      newFieldErrors['socialLinks.linkedin'] = 'LinkedIn URL must be a valid URL';
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      setLoading(false);
      return;
    }

    try {
      const response = await api.put(`/admin/businesses/${business.id}`, formData);
      setSuccess('Business updated successfully!');
      setTimeout(() => {
        onUpdate();
        onClose();
      }, 1500);
    } catch (error) {
      const errorData = error.response?.data;
      
      if (errorData?.errors) {
        // Field-specific errors from backend
        setFieldErrors(errorData.errors);
        setError(errorData.error || 'Please fix the errors below');
      } else {
        setError(errorData?.error || 'Failed to update business. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!business) return null;

  return (
    <div className="admin-edit-modal-overlay" onClick={onClose}>
      <div className="admin-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><i className="fas fa-edit"></i> Edit Business: {business.name}</h2>
          <button className="close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error"><i className="fas fa-exclamation-circle"></i> {error}</div>}
          {success && <div className="alert alert-success"><i className="fas fa-check-circle"></i> {success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Business Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: '' }));
                  }}
                  className={fieldErrors.name ? 'input-error' : ''}
                />
                {fieldErrors.name && (
                  <span className="field-error">
                    <i className="fas fa-exclamation-circle"></i> {Array.isArray(fieldErrors.name) ? fieldErrors.name[0] : fieldErrors.name}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>Category *</label>
                <select
                  required
                  value={formData.categoryId}
                  onChange={(e) => {
                    setFormData({ ...formData, categoryId: e.target.value });
                    if (fieldErrors.categoryId) setFieldErrors(prev => ({ ...prev, categoryId: '' }));
                  }}
                  className={fieldErrors.categoryId ? 'input-error' : ''}
                >
                  <option value="">Select category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                {fieldErrors.categoryId && (
                  <span className="field-error">
                    <i className="fas fa-exclamation-circle"></i> {Array.isArray(fieldErrors.categoryId) ? fieldErrors.categoryId[0] : fieldErrors.categoryId}
                  </span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Description *</label>
              <textarea
                required
                rows="4"
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value });
                  if (fieldErrors.description) setFieldErrors(prev => ({ ...prev, description: '' }));
                }}
                className={fieldErrors.description ? 'input-error' : ''}
              />
              {fieldErrors.description && (
                <span className="field-error">
                  <i className="fas fa-exclamation-circle"></i> {Array.isArray(fieldErrors.description) ? fieldErrors.description[0] : fieldErrors.description}
                </span>
              )}
            </div>

            <div className="form-group">
              <label>Address *</label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => {
                  setFormData({ ...formData, address: e.target.value });
                  if (fieldErrors.address) setFieldErrors(prev => ({ ...prev, address: '' }));
                }}
                className={fieldErrors.address ? 'input-error' : ''}
              />
              {fieldErrors.address && (
                <span className="field-error">
                  <i className="fas fa-exclamation-circle"></i> {Array.isArray(fieldErrors.address) ? fieldErrors.address[0] : fieldErrors.address}
                </span>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>City *</label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => {
                    setFormData({ ...formData, city: e.target.value });
                    if (fieldErrors.city) setFieldErrors(prev => ({ ...prev, city: '' }));
                  }}
                  className={fieldErrors.city ? 'input-error' : ''}
                />
                {fieldErrors.city && (
                  <span className="field-error">
                    <i className="fas fa-exclamation-circle"></i> {Array.isArray(fieldErrors.city) ? fieldErrors.city[0] : fieldErrors.city}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>State *</label>
                <input
                  type="text"
                  required
                  maxLength="50"
                  value={formData.state}
                  onChange={(e) => {
                    setFormData({ ...formData, state: e.target.value.toUpperCase() });
                    if (fieldErrors.state) setFieldErrors(prev => ({ ...prev, state: '' }));
                  }}
                  className={fieldErrors.state ? 'input-error' : ''}
                />
                {fieldErrors.state && (
                  <span className="field-error">
                    <i className="fas fa-exclamation-circle"></i> {Array.isArray(fieldErrors.state) ? fieldErrors.state[0] : fieldErrors.state}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>Zip Code</label>
                <input
                  type="text"
                  value={formData.zipCode}
                  onChange={(e) => {
                    setFormData({ ...formData, zipCode: e.target.value });
                    if (fieldErrors.zipCode) setFieldErrors(prev => ({ ...prev, zipCode: '' }));
                  }}
                  className={fieldErrors.zipCode ? 'input-error' : ''}
                  placeholder="12345 or 12345-6789"
                />
                {fieldErrors.zipCode && (
                  <span className="field-error">
                    <i className="fas fa-exclamation-circle"></i> {Array.isArray(fieldErrors.zipCode) ? fieldErrors.zipCode[0] : fieldErrors.zipCode}
                  </span>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Phone *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value });
                    if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: '' }));
                  }}
                  className={fieldErrors.phone ? 'input-error' : ''}
                />
                {fieldErrors.phone && (
                  <span className="field-error">
                    <i className="fas fa-exclamation-circle"></i> {Array.isArray(fieldErrors.phone) ? fieldErrors.phone[0] : fieldErrors.phone}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
                  }}
                  className={fieldErrors.email ? 'input-error' : ''}
                />
                {fieldErrors.email && (
                  <span className="field-error">
                    <i className="fas fa-exclamation-circle"></i> {Array.isArray(fieldErrors.email) ? fieldErrors.email[0] : fieldErrors.email}
                  </span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Website</label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => {
                  setFormData({ ...formData, website: e.target.value });
                  if (fieldErrors.website) setFieldErrors(prev => ({ ...prev, website: '' }));
                }}
                className={fieldErrors.website ? 'input-error' : ''}
                placeholder="https://example.com"
              />
              {fieldErrors.website && (
                <span className="field-error">
                  <i className="fas fa-exclamation-circle"></i> {Array.isArray(fieldErrors.website) ? fieldErrors.website[0] : fieldErrors.website}
                </span>
              )}
            </div>

            <h3 className="section-title">Social Media Links</h3>
            <div className="form-row">
              <div className="form-group">
                <label><i className="fab fa-facebook"></i> Facebook</label>
                <input
                  type="url"
                  value={formData.socialLinks?.facebook || ''}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      socialLinks: { ...formData.socialLinks, facebook: e.target.value }
                    });
                    if (fieldErrors['socialLinks.facebook']) setFieldErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors['socialLinks.facebook'];
                      return newErrors;
                    });
                  }}
                  className={fieldErrors['socialLinks.facebook'] ? 'input-error' : ''}
                  placeholder="https://facebook.com/..."
                />
                {fieldErrors['socialLinks.facebook'] && (
                  <span className="field-error">
                    <i className="fas fa-exclamation-circle"></i> {Array.isArray(fieldErrors['socialLinks.facebook']) ? fieldErrors['socialLinks.facebook'][0] : fieldErrors['socialLinks.facebook']}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label><i className="fab fa-twitter"></i> Twitter</label>
                <input
                  type="url"
                  value={formData.socialLinks?.twitter || ''}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      socialLinks: { ...formData.socialLinks, twitter: e.target.value }
                    });
                    if (fieldErrors['socialLinks.twitter']) setFieldErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors['socialLinks.twitter'];
                      return newErrors;
                    });
                  }}
                  className={fieldErrors['socialLinks.twitter'] ? 'input-error' : ''}
                  placeholder="https://twitter.com/..."
                />
                {fieldErrors['socialLinks.twitter'] && (
                  <span className="field-error">
                    <i className="fas fa-exclamation-circle"></i> {Array.isArray(fieldErrors['socialLinks.twitter']) ? fieldErrors['socialLinks.twitter'][0] : fieldErrors['socialLinks.twitter']}
                  </span>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label><i className="fab fa-instagram"></i> Instagram</label>
                <input
                  type="url"
                  value={formData.socialLinks?.instagram || ''}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      socialLinks: { ...formData.socialLinks, instagram: e.target.value }
                    });
                    if (fieldErrors['socialLinks.instagram']) setFieldErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors['socialLinks.instagram'];
                      return newErrors;
                    });
                  }}
                  className={fieldErrors['socialLinks.instagram'] ? 'input-error' : ''}
                  placeholder="https://instagram.com/..."
                />
                {fieldErrors['socialLinks.instagram'] && (
                  <span className="field-error">
                    <i className="fas fa-exclamation-circle"></i> {Array.isArray(fieldErrors['socialLinks.instagram']) ? fieldErrors['socialLinks.instagram'][0] : fieldErrors['socialLinks.instagram']}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label><i className="fab fa-linkedin"></i> LinkedIn</label>
                <input
                  type="url"
                  value={formData.socialLinks?.linkedin || ''}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      socialLinks: { ...formData.socialLinks, linkedin: e.target.value }
                    });
                    if (fieldErrors['socialLinks.linkedin']) setFieldErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors['socialLinks.linkedin'];
                      return newErrors;
                    });
                  }}
                  className={fieldErrors['socialLinks.linkedin'] ? 'input-error' : ''}
                  placeholder="https://linkedin.com/..."
                />
                {fieldErrors['socialLinks.linkedin'] && (
                  <span className="field-error">
                    <i className="fas fa-exclamation-circle"></i> {Array.isArray(fieldErrors['socialLinks.linkedin']) ? fieldErrors['socialLinks.linkedin'][0] : fieldErrors['socialLinks.linkedin']}
                  </span>
                )}
              </div>
            </div>

            <h3 className="section-title">Status Settings</h3>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <span>Active (Published)</span>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isVerified}
                  onChange={(e) => setFormData({ ...formData, isVerified: e.target.checked })}
                />
                <span>Verified</span>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isFeatured}
                  onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                />
                <span>Featured</span>
              </label>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-save" disabled={loading}>
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Saving...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save"></i> Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminEditBusiness;


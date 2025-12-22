import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './BusinessLocation.css';

const BusinessLocation = () => {
  const { user } = useContext(AuthContext);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'USA',
    latitude: null,
    longitude: null
  });

  useEffect(() => {
    fetchBusiness();
  }, []);

  const fetchBusiness = async () => {
    try {
      const response = await api.get('/businesses/my-businesses');
      const businesses = response.data.businesses || [];
      if (businesses.length > 0) {
        const biz = businesses[0];
        setBusiness(biz);
        setFormData({
          address: biz.address || '',
          city: biz.city || '',
          state: biz.state || '',
          zipCode: biz.zipCode || '',
          country: biz.country || 'USA',
          latitude: biz.latitude || null,
          longitude: biz.longitude || null
        });
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
  };

  // Auto-geocode zip code when it changes
  useEffect(() => {
    const geocodeZipCode = async () => {
      const zipCode = formData.zipCode?.trim();
      
      // Only geocode if zip code is valid (5 digits or more)
      if (zipCode && zipCode.length >= 5 && formData.country === 'USA') {
        try {
          const cleanZipCode = zipCode.replace(/[\s\-]/g, '').substring(0, 5);
          const response = await api.get(`/businesses/geocode/${cleanZipCode}`);
          
          if (response.data.success && response.data.coordinates) {
            setFormData(prev => ({
              ...prev,
              latitude: response.data.coordinates.latitude,
              longitude: response.data.coordinates.longitude
            }));
          }
        } catch (error) {
          // Silently fail - coordinates are optional
          console.log('Could not geocode zip code:', error);
        }
      } else if (!zipCode || formData.country !== 'USA') {
        // Clear coordinates if zip code is removed or country is not USA
        setFormData(prev => ({
          ...prev,
          latitude: null,
          longitude: null
        }));
      }
    };

    // Debounce geocoding to avoid too many API calls
    const timeoutId = setTimeout(() => {
      geocodeZipCode();
    }, 1000); // Wait 1 second after user stops typing

    return () => clearTimeout(timeoutId);
  }, [formData.zipCode, formData.country]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!business) return;

    setSaving(true);
    try {
      await api.put(`/businesses/${business.id}`, formData);
      alert('Location updated successfully!');
    } catch (error) {
      alert('Failed to update location');
    } finally {
      setSaving(false);
    }
  };

  const getMapUrl = () => {
    const address = `${formData.address}, ${formData.city}, ${formData.state} ${formData.zipCode}`;
    // Use Google Maps search URL instead of embed API to avoid API key issues
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  if (loading) {
    return <div className="business-location-page"><div className="loading">Loading...</div></div>;
  }

  if (!business) {
    return <div className="business-location-page"><div className="empty">No business found</div></div>;
  }

  return (
    <div className="business-location-page">
      <h1 className="page-title">Business Location</h1>

      <div className="location-container">
        <div className="location-form-section">
          <form onSubmit={handleSubmit} className="location-form">
            <div className="form-field">
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

            <div className="form-row">
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
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>Zip Code *</label>
                <input
                  type="text"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleChange}
                  required
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

            <button type="submit" className="save-btn" disabled={saving}>
              {saving ? 'Saving...' : 'Save Location'}
            </button>
          </form>
        </div>

        <div className="map-section">
          <h3 className="map-title">Location Preview</h3>
          {formData.address && formData.city && formData.state ? (
            <div className="map-container">
              <iframe
                title="Business Location Preview"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(`${formData.address}, ${formData.city}, ${formData.state} ${formData.zipCode || ''}`)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                style={{ border: 0, width: '100%', height: '100%', minHeight: '400px' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
              <div className="map-overlay">
                <a 
                  href={getMapUrl()} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="view-map-link"
                >
                  <i className="fas fa-external-link-alt"></i> View Larger Map
                </a>
              </div>
            </div>
          ) : (
            <div className="map-placeholder">
              <i className="fas fa-map-marker-alt"></i>
              <p>Enter your address to preview location</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BusinessLocation;


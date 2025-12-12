import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './Auth.css';

const WriteReview = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const [businesses, setBusinesses] = useState([]);
  const [formData, setFormData] = useState({ businessId: '', rating: 0, title: '', comment: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    // Pre-select business if passed via navigation state
    if (location.state?.businessId) {
      setFormData(prev => ({ ...prev, businessId: location.state.businessId }));
    }
    
    loadBusinesses();
  }, [user, navigate, location.state]);

  const loadBusinesses = async () => {
    try {
      const response = await api.get('/businesses?limit=100');
      setBusinesses(response.data.businesses || []);
    } catch (error) {
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.post('/reviews', formData);
      setSuccess('Review submitted successfully!');
      setTimeout(() => navigate('/'), 2000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h2><i className="fas fa-star"></i> Write a Review</h2>
        {location.state?.businessName && (
          <p style={{ color: '#667eea', marginBottom: '20px', fontSize: '16px' }}>
            <i className="fas fa-info-circle"></i> Reviewing: <strong>{location.state.businessName}</strong>
          </p>
        )}
        {error && <div className="alert alert-error"><i className="fas fa-exclamation-circle"></i> {error}</div>}
        {success && <div className="alert alert-success"><i className="fas fa-check-circle"></i> {success}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Business *</label>
            <select required value={formData.businessId} onChange={(e) => setFormData({ ...formData, businessId: e.target.value })}>
              <option value="">Select a business</option>
              {businesses.map(biz => <option key={biz.id} value={biz.id}>{biz.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Rating *</label>
            <div className="star-rating">
              {[1, 2, 3, 4, 5].map(star => (
                <span key={star} className="star" onClick={() => setFormData({ ...formData, rating: star })}>
                  {star <= formData.rating ? '★' : '☆'}
                </span>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Title *</label>
            <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Your Review *</label>
            <textarea required value={formData.comment} onChange={(e) => setFormData({ ...formData, comment: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default WriteReview;


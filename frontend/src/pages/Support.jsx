import React, { useState } from 'react';
import api from '../services/api';
import './Auth.css';

const Support = () => {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.post('/contact', formData);
      setSuccess('Your message has been sent successfully! We will respond within 24 hours.');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container" style={{ maxWidth: '600px' }}>
        <h2>Support</h2>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Your Name *</label>
            <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Your Email *</label>
            <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Subject *</label>
            <select required value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })}>
              <option value="">Select a topic</option>
              <option value="account">Account Issues</option>
              <option value="business">Business Listing</option>
              <option value="review">Review Issues</option>
              <option value="technical">Technical Support</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label>Message *</label>
            <textarea required value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Support;


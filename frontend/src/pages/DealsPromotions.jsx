import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './DealsPromotions.css';

const DealsPromotions = () => {
  const { user } = useContext(AuthContext);
  const [business, setBusiness] = useState(null);
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    discount: '',
    validUntil: ''
  });

  useEffect(() => {
    fetchBusiness();
  }, []);

  const fetchBusiness = async () => {
    try {
      const response = await api.get('/businesses/my-businesses');
      const businesses = response.data.businesses || [];
      if (businesses.length > 0) {
        setBusiness(businesses[0]);
        setPromotions(businesses[0].promotions || []);
      }
    } catch (error) {
      console.error('Error fetching business:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData({ title: '', description: '', discount: '', validUntil: '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // In a real app, this would save to the backend
    const newPromo = {
      id: Date.now(),
      ...formData,
      createdAt: new Date().toISOString()
    };
    setPromotions([...promotions, newPromo]);
    setShowModal(false);
    alert('Promotion created successfully!');
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this promotion?')) {
      setPromotions(promotions.filter(p => p.id !== id));
    }
  };

  if (loading) {
    return <div className="deals-promotions-page"><div className="loading">Loading...</div></div>;
  }

  return (
    <div className="deals-promotions-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Deals & Promotions</h1>
          <p className="page-subtitle">Create and manage special offers for your customers</p>
        </div>
        <button className="create-btn" onClick={handleCreate}>
          <i className="fas fa-plus"></i> Create Promotion
        </button>
      </div>

      {promotions.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-percent"></i>
          <h3>No Promotions Yet</h3>
          <p>Create your first promotion to attract more customers</p>
          <button className="create-btn" onClick={handleCreate}>
            <i className="fas fa-plus"></i> Create Your First Promotion
          </button>
        </div>
      ) : (
        <div className="promotions-grid">
          {promotions.map(promo => (
            <div key={promo.id} className="promotion-card">
              <div className="promo-header">
                <h3>{promo.title}</h3>
                <button
                  className="delete-btn"
                  onClick={() => handleDelete(promo.id)}
                  title="Delete promotion"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <p className="promo-description">{promo.description}</p>
              <div className="promo-details">
                <span className="discount">{promo.discount}</span>
                {promo.validUntil && (
                  <span className="valid-until">Valid until: {new Date(promo.validUntil).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Promotion</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="promo-form">
              <div className="form-field">
                <label>Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  required
                  placeholder="Summer Sale"
                />
              </div>
              <div className="form-field">
                <label>Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  required
                  rows="4"
                  placeholder="Describe your promotion"
                />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Discount *</label>
                  <input
                    type="text"
                    value={formData.discount}
                    onChange={(e) => setFormData({...formData, discount: e.target.value})}
                    required
                    placeholder="20% OFF"
                  />
                </div>
                <div className="form-field">
                  <label>Valid Until</label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData({...formData, validUntil: e.target.value})}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Create Promotion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealsPromotions;


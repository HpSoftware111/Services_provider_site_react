import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './CategoriesServices.css';

const CategoriesServices = () => {
  const { user } = useContext(AuthContext);
  const [business, setBusiness] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [services, setServices] = useState([]);
  const [newService, setNewService] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [businessRes, categoriesRes] = await Promise.all([
        api.get('/businesses/my-businesses'),
        api.get('/categories')
      ]);

      const businesses = businessRes.data.businesses || [];
      if (businesses.length > 0) {
        const biz = businesses[0];
        setBusiness(biz);
        setSelectedCategory(biz.categoryId || '');
        setServices(biz.services || []);
      }
      setCategories(categoriesRes.data.categories || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = async (e) => {
    const categoryId = e.target.value;
    setSelectedCategory(categoryId);
    if (business) {
      try {
        await api.put(`/businesses/${business.id}`, { categoryId });
      } catch (error) {
        console.error('Error updating category:', error);
      }
    }
  };

  const addService = () => {
    if (newService.trim() && services.length < 20) {
      setServices([...services, newService.trim()]);
      setNewService('');
    }
  };

  const removeService = (index) => {
    setServices(services.filter((_, i) => i !== index));
  };

  const saveServices = async () => {
    if (!business) return;
    try {
      await api.put(`/businesses/${business.id}`, { services });
      alert('Services updated successfully!');
    } catch (error) {
      alert('Failed to update services');
    }
  };

  if (loading) {
    return <div className="categories-services-page"><div className="loading">Loading...</div></div>;
  }

  return (
    <div className="categories-services-page">
      <h1 className="page-title">Categories & Services</h1>

      {/* Informational Message */}
      <div className="info-banner">
        <i className="fas fa-info-circle"></i>
        <p>
          Let customers know what your business offers by selecting categories & services. This will help customers find your business, and help you generate leads.
        </p>
      </div>

      {/* Category Selection */}
      <div className="section-card">
        <h3 className="section-title">Business Category</h3>
        <div className="form-field">
          <label>Select your primary category *</label>
          <select
            value={selectedCategory}
            onChange={handleCategoryChange}
            className="category-select"
          >
            <option value="">Choose a category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Services */}
      <div className="section-card">
        <h3 className="section-title">Services Offered</h3>
        <p className="section-description">
          List the specific services your business provides
        </p>
        
        <div className="add-service">
          <input
            type="text"
            value={newService}
            onChange={(e) => setNewService(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addService()}
            placeholder="Enter a service (e.g., Haircuts, Color Treatment)"
            className="service-input"
          />
          <button
            type="button"
            onClick={addService}
            className="add-btn"
            disabled={!newService.trim() || services.length >= 20}
          >
            <i className="fas fa-plus"></i> Add
          </button>
        </div>

        {services.length > 0 && (
          <div className="services-list">
            {services.map((service, index) => (
              <div key={index} className="service-item">
                <span>{service}</span>
                <button
                  type="button"
                  onClick={() => removeService(index)}
                  className="remove-btn"
                  title="Remove service"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
          </div>
        )}

        {services.length === 0 && (
          <p className="empty-text">No services added yet. Add your first service above.</p>
        )}

        {services.length > 0 && (
          <button onClick={saveServices} className="save-btn">
            Save Services
          </button>
        )}
      </div>
    </div>
  );
};

export default CategoriesServices;


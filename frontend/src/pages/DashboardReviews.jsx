import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './DashboardReviews.css';

const DashboardReviews = () => {
  const { user } = useContext(AuthContext);
  const [reviews, setReviews] = useState([]);
  const [allReviews, setAllReviews] = useState([]); // Store all reviews for filtering
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    pages: 0
  });
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [requestForm, setRequestForm] = useState({
    customerEmail: '',
    customerName: ''
  });
  const [requestLoading, setRequestLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchData();
  }, [pagination.page]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [businessRes, reviewsRes] = await Promise.all([
        api.get('/businesses/my-businesses'),
        api.get('/reviews', {
          params: {
            page: pagination.page,
            limit: pagination.pageSize
          }
        })
      ]);

      const businessesList = businessRes.data.businesses || [];
      setBusinesses(businessesList);

      // Get all reviews for all user's businesses
      const fetchedReviews = reviewsRes.data.reviews || [];
      const businessIds = businessesList.map(b => b.id);
      const businessReviews = fetchedReviews.filter(r => businessIds.includes(r.businessId));

      setAllReviews(businessReviews);
      setReviews(businessReviews);
      setPagination(prev => ({
        ...prev,
        total: reviewsRes.data.total || 0,
        pages: reviewsRes.data.pages || 0
      }));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleRequestReview = (business) => {
    setSelectedBusiness(business);
    setShowRequestModal(true);
    setRequestForm({ customerEmail: '', customerName: '' });
  };

  const submitRequestReview = async (e) => {
    e.preventDefault();
    if (!selectedBusiness || !requestForm.customerEmail) {
      setMessage({ type: 'error', text: 'Please enter customer email' });
      return;
    }

    setRequestLoading(true);
    try {
      await api.post('/reviews/request', {
        businessId: selectedBusiness.id,
        customerEmail: requestForm.customerEmail,
        customerName: requestForm.customerName
      });
      setMessage({ type: 'success', text: 'Review request sent successfully!' });
      setShowRequestModal(false);
      setRequestForm({ customerEmail: '', customerName: '' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to send review request' });
    } finally {
      setRequestLoading(false);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating || 0);
    const hasHalfStar = (rating || 0) % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<i key={i} className="fas fa-star filled"></i>);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<i key={i} className="fas fa-star-half-alt filled"></i>);
      } else {
        stars.push(<i key={i} className="far fa-star"></i>);
      }
    }
    return stars;
  };

  const getBusinessName = (businessId) => {
    const business = businesses.find(b => b.id === businessId);
    return business ? business.name : 'Unknown Business';
  };

  // Filter reviews (client-side filtering on current page)
  const filteredReviews = filter === 'all'
    ? reviews
    : filter === 'positive'
      ? reviews.filter(r => r.rating >= 4)
      : reviews.filter(r => r.rating < 4);

  // Calculate total counts for filter buttons (from all reviews)
  const totalReviews = allReviews.length;
  const positiveReviews = allReviews.filter(r => r.rating >= 4).length;
  const negativeReviews = allReviews.filter(r => r.rating < 4).length;

  if (loading) {
    return <div className="dashboard-reviews-page"><div className="loading">Loading...</div></div>;
  }

  return (
    <div className="dashboard-reviews-page">
      <div className="page-header-section">
        <h1 className="page-title">Reviews</h1>
        {businesses.length > 0 && (
          <button className="request-review-header-btn" onClick={() => handleRequestReview(businesses[0])}>
            <i className="fas fa-paper-plane"></i> Request Review
          </button>
        )}
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`}>
          <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="alert-close">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({totalReviews})
          </button>
          <button
            className={`filter-btn ${filter === 'positive' ? 'active' : ''}`}
            onClick={() => setFilter('positive')}
          >
            Positive ({positiveReviews})
          </button>
          <button
            className={`filter-btn ${filter === 'negative' ? 'active' : ''}`}
            onClick={() => setFilter('negative')}
          >
            Negative ({negativeReviews})
          </button>
        </div>
      </div>

      {/* Reviews List */}
      {filteredReviews.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-star"></i>
          <h3>No Reviews Yet</h3>
          <p>Your businesses haven't received any reviews yet.</p>
          {businesses.length > 0 && (
            <button className="request-review-btn" onClick={() => handleRequestReview(businesses[0])}>
              <i className="fas fa-paper-plane"></i> Request Review
            </button>
          )}
        </div>
      ) : (
        <div className="reviews-list">
          {filteredReviews.map(review => (
            <div key={review.id} className="review-card">
              <div className="review-header">
                <div className="reviewer-info">
                  <div className="reviewer-avatar">
                    {review.user?.avatar ? (
                      <img src={review.user.avatar} alt={review.user.name} />
                    ) : (
                      <i className="fas fa-user"></i>
                    )}
                  </div>
                  <div>
                    <h4 className="reviewer-name">{review.user?.name || 'Anonymous'}</h4>
                    <div className="stars">
                      {renderStars(review.rating)}
                    </div>
                  </div>
                </div>
                <div className="review-meta">
                  <span className="business-name-badge">{getBusinessName(review.businessId)}</span>
                  <span className="review-date">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              {review.title && <h5 className="review-title">{review.title}</h5>}
              <p className="review-text">{review.comment}</p>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
          >
            <i className="fas fa-chevron-left"></i>
            Previous
          </button>
          <span className="pagination-info">
            Page {pagination.page} of {pagination.pages}
            <span className="pagination-total">({pagination.total} total)</span>
          </span>
          <button
            className="pagination-btn"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages}
          >
            Next
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      )}

      {/* Request Review Modal */}
      {showRequestModal && (
        <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className="fas fa-paper-plane"></i> Request Review</h3>
              <button className="modal-close" onClick={() => setShowRequestModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={submitRequestReview} className="request-review-form">
              <p className="modal-description">
                Send an email to a customer asking them to leave a review for <strong>{selectedBusiness?.name}</strong>.
              </p>
              <div className="form-field">
                <label>Customer Email *</label>
                <input
                  type="email"
                  value={requestForm.customerEmail}
                  onChange={(e) => setRequestForm({ ...requestForm, customerEmail: e.target.value })}
                  placeholder="customer@example.com"
                  required
                />
              </div>
              <div className="form-field">
                <label>Customer Name (Optional)</label>
                <input
                  type="text"
                  value={requestForm.customerName}
                  onChange={(e) => setRequestForm({ ...requestForm, customerName: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowRequestModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={requestLoading}>
                  {requestLoading ? (
                    <><i className="fas fa-spinner fa-spin"></i> Sending...</>
                  ) : (
                    <><i className="fas fa-paper-plane"></i> Send Request</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardReviews;

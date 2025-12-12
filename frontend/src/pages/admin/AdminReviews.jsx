import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './AdminTable.css';

const AdminReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  useEffect(() => {
    loadReviews();
  }, [currentPage, filter]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      let queryString = `page=${currentPage}&limit=20`;
      if (filter === 'pending') {
        queryString += '&status=pending';
      }
      const response = await api.get(`/admin/reviews?${queryString}`);
      setReviews(response.data.reviews || []);
      setTotalPages(response.data.pages || 1);
    } catch (error) {
      setReviews([]);
      setTotalPages(1);
      if (error.response?.status !== 429) {
        alert('Failed to load reviews. Please refresh the page.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/admin/reviews/${id}/approve`);
      alert('Review approved successfully!');
      loadReviews();
    } catch (error) {
      alert('Failed to approve review');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this review?')) return;

    try {
      await api.delete(`/admin/reviews/${id}`);
      alert('Review deleted successfully!');
      loadReviews();
    } catch (error) {
      alert('Failed to delete review');
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="admin-table-container">
      <div className="table-header">
        <h2>Reviews Management</h2>
        <div className="header-actions">
          <div className="filter-buttons">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
              onClick={() => setFilter('pending')}
            >
              Pending Approval
            </button>
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Business</th>
              <th>Rating</th>
              <th>Review</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reviews.length > 0 ? (
              reviews.map((review) => (
                <tr key={review.id}>
                  <td>{review.id}</td>
                  <td>
                    {review.user?.name || 'N/A'}
                    <br />
                    <small>{review.user?.email}</small>
                  </td>
                  <td>{review.business?.name || 'N/A'}</td>
                  <td>
                    <span className="rating-stars golden">
                      {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                    </span>
                    <br />
                    <small>{review.rating}/5</small>
                  </td>
                  <td>
                    <strong>{review.title}</strong>
                    <br />
                    <small>{review.comment?.substring(0, 100)}...</small>
                  </td>
                  <td>
                    <span className={`status-badge ${review.isApproved ? 'active' : 'pending'}`}>
                      {review.isApproved ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                  <td>{new Date(review.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      {!review.isApproved && (
                        <button
                          className="btn-approve"
                          onClick={() => handleApprove(review.id)}
                          title="Approve Review"
                        >
                          <i className="fas fa-check"></i>
                        </button>
                      )}
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(review.id)}
                        title="Delete Review"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="empty-state">No reviews found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}

    </div>
  );
};

export default AdminReviews;

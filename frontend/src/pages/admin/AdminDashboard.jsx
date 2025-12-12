import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await api.get('/admin/stats');
      setStats(response.data.stats);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (!stats) {
    return <div>Error loading dashboard</div>;
  }

  return (
    <div className="admin-dashboard">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon users">
            <i className="fas fa-users"></i>
          </div>
          <div className="stat-info">
            <h3>Total Customers</h3>
            <p className="stat-value">{stats.users}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon businesses">
            <i className="fas fa-building"></i>
          </div>
          <div className="stat-info">
            <h3>Total Businesses</h3>
            <p className="stat-value">{stats.businesses}</p>
            <p className="stat-sub">{stats.activeBusinesses} active</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon pending">
            <i className="fas fa-clock"></i>
          </div>
          <div className="stat-info">
            <h3>Pending Approval</h3>
            <p className="stat-value">{stats.pendingBusinesses}</p>
            <Link to="/admin/businesses?status=pending" className="stat-link">View Pending</Link>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon reviews">
            <i className="fas fa-star"></i>
          </div>
          <div className="stat-info">
            <h3>Total Reviews</h3>
            <p className="stat-value">{stats.reviews}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon categories">
            <i className="fas fa-tags"></i>
          </div>
          <div className="stat-info">
            <h3>Categories</h3>
            <p className="stat-value">{stats.categories}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon contacts">
            <i className="fas fa-envelope"></i>
          </div>
          <div className="stat-info">
            <h3>Contact Messages</h3>
            <p className="stat-value">{stats.contacts}</p>
            {stats.unreadContacts > 0 && (
              <p className="stat-badge">{stats.unreadContacts} new</p>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Recent Customers</h2>
            <Link to="/admin/users" className="view-all-link">View All</Link>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentUsers && stats.recentUsers.length > 0 ? (
                  stats.recentUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`badge ${user.role === 'admin' ? 'danger' :
                            user.role === 'business_owner' ? 'info' :
                              'success'
                          }`}>
                          {user.role === 'business_owner' ? 'Provider' : user.role === 'user' ? 'Customer' : user.role || 'Customer'}
                        </span>
                      </td>
                      <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="empty-state">No customers yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-header">
            <h2>Recent Businesses</h2>
            <Link to="/admin/businesses" className="view-all-link">View All</Link>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentBusinesses && stats.recentBusinesses.length > 0 ? (
                  stats.recentBusinesses.map((business) => (
                    <tr key={business.id}>
                      <td>{business.name}</td>
                      <td>{business.category?.name || 'N/A'}</td>
                      <td>{business.city}, {business.state}</td>
                      <td>
                        <span className={`badge ${business.isActive ? 'success' : 'warning'}`}>
                          {business.isActive ? 'Active' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="empty-state">No businesses yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-header">
            <h2>Recent Reviews</h2>
            <Link to="/admin/reviews" className="view-all-link">View All</Link>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Business</th>
                  <th>Rating</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentReviews && stats.recentReviews.length > 0 ? (
                  stats.recentReviews.map((review) => (
                    <tr key={review.id}>
                      <td>{review.user?.name || 'N/A'}</td>
                      <td>{review.business?.name || 'N/A'}</td>
                      <td>
                        <span className="rating-badge">
                          {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${review.isApproved ? 'success' : 'warning'}`}>
                          {review.isApproved ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="empty-state">No reviews yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;


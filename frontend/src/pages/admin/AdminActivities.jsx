import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './AdminTable.css';

const AdminActivities = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadActivities();
  }, [currentPage]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/activities?page=${currentPage}&limit=50`);
      setActivities(response.data.activities);
      setTotalPages(response.data.pages);
    } catch (error) {
      alert('Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type) => {
    const icons = {
      user_registered: 'fa-user-plus',
      user_updated: 'fa-user-edit',
      user_deleted: 'fa-user-times',
      business_submitted: 'fa-building',
      business_approved: 'fa-check-circle',
      business_updated: 'fa-edit',
      business_deleted: 'fa-trash',
      review_submitted: 'fa-star',
      review_deleted: 'fa-times',
      category_created: 'fa-plus-circle',
      category_updated: 'fa-edit',
      category_deleted: 'fa-trash',
      blog_created: 'fa-blog',
      blog_updated: 'fa-edit',
      blog_deleted: 'fa-trash'
    };
    return icons[type] || 'fa-info-circle';
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="admin-table-container">
      <div className="table-header">
        <h2>System Activity Log</h2>
        <div className="stats">
          <span>Total Activities: {activities.length}</span>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Description</th>
              <th>Customer</th>
              <th>Date & Time</th>
            </tr>
          </thead>
          <tbody>
            {activities.length > 0 ? (
              activities.map((activity) => (
                <tr key={activity.id}>
                  <td>{activity.id}</td>
                  <td>
                    <i className={`fas ${getActivityIcon(activity.type)}`} style={{ marginRight: '8px' }}></i>
                    <span className="status-badge">{activity.type.replace(/_/g, ' ')}</span>
                  </td>
                  <td>{activity.description}</td>
                  <td>
                    {activity.user ? (
                      <>
                        {activity.user.name}
                        <br />
                        <small>{activity.user.email}</small>
                      </>
                    ) : (
                      'System'
                    )}
                  </td>
                  <td>{new Date(activity.createdAt).toLocaleString()}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="empty-state">No activities found</td>
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

export default AdminActivities;


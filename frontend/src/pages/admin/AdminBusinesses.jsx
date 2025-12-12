import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import AdminEditBusiness from '../../components/AdminEditBusiness';
import AdminRejectBusiness from '../../components/AdminRejectBusiness';
import './AdminTable.css';

const AdminBusinesses = () => {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editingBusiness, setEditingBusiness] = useState(null);
  const [rejectingBusiness, setRejectingBusiness] = useState(null);

  useEffect(() => {
    loadBusinesses();
  }, [currentPage, filter]);


  const loadBusinesses = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/businesses?page=${currentPage}&limit=20`);
      setBusinesses(response.data.businesses);
      setTotalPages(response.data.pages);
    } catch (error) {
      alert('Failed to load businesses');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this business?')) return;
    
    try {
      await api.put(`/admin/businesses/${id}/approve`);
      alert('Business approved successfully!');
      loadBusinesses();
    } catch (error) {
      alert('Failed to approve business');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this business? This action cannot be undone.')) return;
    
    try {
      await api.delete(`/admin/businesses/${id}`);
      alert('Business deleted successfully!');
      loadBusinesses();
    } catch (error) {
      alert('Failed to delete business');
    }
  };

  const filteredBusinesses = businesses.filter(b => {
    if (filter === 'pending') return !b.isActive;
    if (filter === 'active') return b.isActive;
    return true;
  });

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="admin-table-container">
      <div className="table-header">
        <h2>Business Management</h2>
        <div className="filter-buttons">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({businesses.length})
          </button>
          <button 
            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pending ({businesses.filter(b => !b.isActive).length})
          </button>
          <button 
            className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active ({businesses.filter(b => b.isActive).length})
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Business Name</th>
              <th>Category</th>
              <th>Owner</th>
              <th>Location</th>
              <th>Rating</th>
              <th>Status</th>
              <th style={{ minWidth: '250px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBusinesses.length > 0 ? (
              filteredBusinesses.map((business) => (
                <tr key={business.id}>
                  <td>{business.id}</td>
                  <td>
                    <strong>{business.name}</strong>
                    <br />
                    <small>{business.phone}</small>
                  </td>
                  <td>{business.category?.name || 'N/A'}</td>
                  <td>
                    {business.owner ? (
                      <Link to={`/profile/${business.owner.id}`} target="_blank" style={{ color: '#667eea', textDecoration: 'none' }}>
                        <strong>{business.owner.name}</strong>
                      </Link>
                    ) : (
                      'N/A'
                    )}
                    <br />
                    <small>{business.owner?.email}</small>
                  </td>
                  <td>{business.city}, {business.state}</td>
                  <td>
                    <span className="rating-stars">
                      {'★'.repeat(Math.floor(parseFloat(business.ratingAverage) || 0))}
                      {'☆'.repeat(5 - Math.floor(parseFloat(business.ratingAverage) || 0))}
                    </span>
                    <br />
                    <small>{parseFloat(business.ratingAverage) || 0} ({business.ratingCount || 0} reviews)</small>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span className={`status-badge ${business.isActive ? 'active' : 'pending'}`}>
                          {business.isActive ? 'Active' : 'Pending'}
                        </span>
                        {business.isVerified && (
                          <span className="status-badge verified">Verified</span>
                        )}
                        {business.rejectionReason && (
                          <span className="status-badge rejected">
                            <i className="fas fa-times-circle"></i> Rejected
                          </span>
                        )}
                      </div>
                      {business.rejectionReason && (
                        <div className="rejection-reason-box">
                          <div className="rejection-reason-header">
                            <i className="fas fa-exclamation-triangle"></i>
                            <span>Rejection Reason:</span>
                          </div>
                          <p className="rejection-reason-text">
                            {business.rejectionReason}
                          </p>
                          {business.rejectedAt && (
                            <span className="rejection-date">
                              Rejected on: {new Date(business.rejectedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ minWidth: '200px' }}>
                    <div className="action-buttons" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button 
                        className="btn-edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingBusiness(business);
                        }}
                        title="Edit Business Details"
                        style={{ 
                          background: '#f8f9fa', 
                          color: '#495057', 
                          border: '1px solid #dee2e6',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '15px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '36px',
                          height: '36px',
                          minWidth: '36px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#e9ecef';
                          e.target.style.borderColor = '#adb5bd';
                          e.target.style.color = '#212529';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = '#f8f9fa';
                          e.target.style.borderColor = '#dee2e6';
                          e.target.style.color = '#495057';
                        }}
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      {!business.isActive && !business.rejectionReason && (
                        <button 
                          className="btn-approve"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(business.id);
                          }}
                          title="Approve Business"
                          style={{ 
                            background: '#f8f9fa', 
                            color: '#28a745', 
                            border: '1px solid #dee2e6',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '15px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '36px',
                            height: '36px',
                            minWidth: '36px',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = '#d4edda';
                            e.target.style.borderColor = '#28a745';
                            e.target.style.color = '#155724';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = '#f8f9fa';
                            e.target.style.borderColor = '#dee2e6';
                            e.target.style.color = '#28a745';
                          }}
                        >
                          <i className="fas fa-check"></i>
                        </button>
                      )}
                      <button 
                        className="btn-reject"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRejectingBusiness(business);
                        }}
                        title={business.rejectionReason ? "Update Rejection Reason" : "Reject Business"}
                        style={{ 
                          background: '#f8f9fa', 
                          color: '#dc3545', 
                          border: '1px solid #dee2e6',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '15px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '36px',
                          height: '36px',
                          minWidth: '36px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#f8d7da';
                          e.target.style.borderColor = '#dc3545';
                          e.target.style.color = '#721c24';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = '#f8f9fa';
                          e.target.style.borderColor = '#dee2e6';
                          e.target.style.color = '#dc3545';
                        }}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                      <button 
                        className="btn-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(business.id);
                        }}
                        title="Delete Business"
                        style={{ 
                          background: '#f8f9fa', 
                          color: '#6c757d', 
                          border: '1px solid #dee2e6',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '15px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '36px',
                          height: '36px',
                          minWidth: '36px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#e9ecef';
                          e.target.style.borderColor = '#adb5bd';
                          e.target.style.color = '#343a40';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = '#f8f9fa';
                          e.target.style.borderColor = '#dee2e6';
                          e.target.style.color = '#6c757d';
                        }}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="empty-state">No businesses found</td>
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

      {editingBusiness && (
        <AdminEditBusiness
          business={editingBusiness}
          onClose={() => setEditingBusiness(null)}
          onUpdate={loadBusinesses}
        />
      )}

      {rejectingBusiness && (
        <AdminRejectBusiness
          business={rejectingBusiness}
          onClose={() => setRejectingBusiness(null)}
          onUpdate={loadBusinesses}
        />
      )}
    </div>
  );
};

export default AdminBusinesses;


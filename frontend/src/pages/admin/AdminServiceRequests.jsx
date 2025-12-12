import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import './AdminTable.css';

const AdminServiceRequests = () => {
  const [serviceRequests, setServiceRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);

  useEffect(() => {
    loadServiceRequests();
  }, [currentPage, statusFilter]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const loadServiceRequests = async () => {
    try {
      setLoading(true);
      let queryString = `page=${currentPage}&limit=20`;
      if (statusFilter !== 'all') {
        queryString += `&status=${statusFilter}`;
      }
      const response = await api.get(`/admin/service-requests?${queryString}`);
      setServiceRequests(response.data.serviceRequests || []);
      setTotalPages(response.data.pages || 1);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      alert('Failed to load service requests');
      setServiceRequests([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async (id) => {
    if (!window.confirm('Reassign providers to this service request?')) return;

    try {
      await api.post(`/admin/service-requests/${id}/assign`);
      alert('Providers reassigned successfully!');
      loadServiceRequests();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to reassign providers');
    }
  };

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      'REQUEST_CREATED': 'pending',
      'LEAD_ASSIGNED': 'pending',
      'IN_PROGRESS': 'active',
      'COMPLETED': 'active',
      'APPROVED': 'active',
      'CLOSED': 'inactive',
      'CANCELLED_BY_CUSTOMER': 'rejected'
    };
    return statusMap[status] || 'pending';
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="admin-table-container">
      <div className="table-header">
        <h2>Service Requests Management</h2>
        <div className="header-actions">
          <div className="stats">
            <span>Total: {totalCount}</span>
          </div>
          <div className="filter-buttons">
            <button
              className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-btn ${statusFilter === 'REQUEST_CREATED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('REQUEST_CREATED')}
            >
              Created
            </button>
            <button
              className={`filter-btn ${statusFilter === 'LEAD_ASSIGNED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('LEAD_ASSIGNED')}
            >
              Lead Assigned
            </button>
            <button
              className={`filter-btn ${statusFilter === 'IN_PROGRESS' ? 'active' : ''}`}
              onClick={() => setStatusFilter('IN_PROGRESS')}
            >
              In Progress
            </button>
            <button
              className={`filter-btn ${statusFilter === 'COMPLETED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('COMPLETED')}
            >
              Completed
            </button>
            <button
              className={`filter-btn ${statusFilter === 'CLOSED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('CLOSED')}
            >
              Closed
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
              <th>Project Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Provider</th>
              <th>Created Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {serviceRequests.length > 0 ? (
              serviceRequests.map((request) => (
                <tr key={request.id}>
                  <td>{request.id}</td>
                  <td>
                    {request.customer?.name || 'N/A'}
                    <br />
                    <small>{request.customer?.email}</small>
                  </td>
                  <td><strong>{request.projectTitle}</strong></td>
                  <td>
                    {request.category?.name || 'N/A'}
                    {request.subCategory && (
                      <>
                        <br />
                        <small>{request.subCategory.name}</small>
                      </>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(request.status)}`}>
                      {request.status}
                    </span>
                  </td>
                  <td>
                    {request.primaryProvider?.user ? (
                      <>
                        {request.primaryProvider.user.name}
                        <br />
                        <small>{request.primaryProvider.user.email}</small>
                      </>
                    ) : (
                      'Not Assigned'
                    )}
                  </td>
                  <td>{new Date(request.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-view"
                        onClick={() => setSelectedRequest(request)}
                        title="View Details"
                      >
                        <i className="fas fa-eye"></i>
                      </button>
                      {(request.status === 'REQUEST_CREATED' || request.status === 'LEAD_ASSIGNED') && (
                        <button
                          className="btn-edit"
                          onClick={() => handleReassign(request.id)}
                          title="Reassign Providers"
                        >
                          <i className="fas fa-user-friends"></i>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="empty-state">No service requests found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(totalPages > 1 || totalCount > 0) && (
        <div className="pagination">
          <button
            disabled={currentPage === 1 || loading}
            onClick={() => !loading && setCurrentPage(currentPage - 1)}
          >
            <i className="fas fa-chevron-left"></i> Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
            {totalCount > 0 && ` (${totalCount} total)`}
          </span>
          <button
            disabled={currentPage === totalPages || loading}
            onClick={() => !loading && setCurrentPage(currentPage + 1)}
          >
            Next <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      )}

      {selectedRequest && (
        <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <h3>Service Request Details</h3>
            <div style={{ padding: '0 24px 24px 24px', overflowY: 'auto', maxHeight: 'calc(100vh - 150px)' }}>
              <div className="form-group">
                <label>ID</label>
                <div>{selectedRequest.id}</div>
              </div>
              <div className="form-group">
                <label>Customer</label>
                <div>
                  <strong>{selectedRequest.customer?.name || 'N/A'}</strong>
                  <br />
                  <small>{selectedRequest.customer?.email}</small>
                  {selectedRequest.customer?.phone && (
                    <>
                      <br />
                      <small>{selectedRequest.customer.phone}</small>
                    </>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Project Title</label>
                <div><strong>{selectedRequest.projectTitle}</strong></div>
              </div>
              <div className="form-group">
                <label>Project Description</label>
                <div style={{ whiteSpace: 'pre-wrap' }}>{selectedRequest.projectDescription}</div>
              </div>
              <div className="form-group">
                <label>Category</label>
                <div>
                  {selectedRequest.category?.name || 'N/A'}
                  {selectedRequest.subCategory && (
                    <>
                      {' / '}
                      {selectedRequest.subCategory.name}
                    </>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Location</label>
                <div>Zip Code: {selectedRequest.zipCode}</div>
              </div>
              <div className="form-group">
                <label>Status</label>
                <div>
                  <span className={`status-badge ${getStatusBadgeClass(selectedRequest.status)}`}>
                    {selectedRequest.status}
                  </span>
                </div>
              </div>
              <div className="form-group">
                <label>Primary Provider</label>
                <div>
                  {selectedRequest.primaryProvider?.user ? (
                    <>
                      <strong>{selectedRequest.primaryProvider.user.name}</strong>
                      <br />
                      <small>{selectedRequest.primaryProvider.user.email}</small>
                    </>
                  ) : (
                    'Not Assigned'
                  )}
                </div>
              </div>
              {selectedRequest.preferredDate && (
                <div className="form-group">
                  <label>Preferred Date</label>
                  <div>{new Date(selectedRequest.preferredDate).toLocaleDateString()}</div>
                </div>
              )}
              {selectedRequest.preferredTime && (
                <div className="form-group">
                  <label>Preferred Time</label>
                  <div>{selectedRequest.preferredTime}</div>
                </div>
              )}
              <div className="form-group">
                <label>Created Date</label>
                <div>{new Date(selectedRequest.createdAt).toLocaleString()}</div>
              </div>
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setSelectedRequest(null)}>
                  Close
                </button>
                {(selectedRequest.status === 'REQUEST_CREATED' || selectedRequest.status === 'LEAD_ASSIGNED') && (
                  <button
                    className="btn-submit"
                    onClick={() => {
                      handleReassign(selectedRequest.id);
                      setSelectedRequest(null);
                    }}
                  >
                    Reassign Providers
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminServiceRequests;

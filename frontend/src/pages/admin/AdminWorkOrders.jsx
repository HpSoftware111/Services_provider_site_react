import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './AdminTable.css';

const AdminWorkOrders = () => {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);

  useEffect(() => {
    loadWorkOrders();
  }, [currentPage, statusFilter]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const loadWorkOrders = async () => {
    try {
      setLoading(true);
      let queryString = `page=${currentPage}&limit=20`;
      if (statusFilter !== 'all') {
        queryString += `&status=${statusFilter}`;
      }
      const response = await api.get(`/admin/work-orders?${queryString}`);
      setWorkOrders(response.data.workOrders || []);
      setTotalPages(response.data.pages || 1);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      alert('Failed to load work orders');
      setWorkOrders([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      'IN_PROGRESS': 'pending',
      'COMPLETED': 'active'
    };
    return statusMap[status] || 'pending';
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="admin-table-container">
      <div className="table-header">
        <h2>Work Orders Management</h2>
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
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Service Request</th>
              <th>Provider</th>
              <th>Status</th>
              <th>Completed Date</th>
              <th>Created Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workOrders.length > 0 ? (
              workOrders.map((workOrder) => (
                <tr key={workOrder.id}>
                  <td>{workOrder.id}</td>
                  <td>
                    {workOrder.serviceRequest?.projectTitle || 'N/A'}
                    <br />
                    <small>Request #{workOrder.serviceRequest?.id}</small>
                    {workOrder.serviceRequest?.customer && (
                      <>
                        <br />
                        <small>Customer: {workOrder.serviceRequest.customer.name}</small>
                      </>
                    )}
                  </td>
                  <td>
                    {workOrder.provider?.user?.name || 'N/A'}
                    <br />
                    <small>{workOrder.provider?.user?.email}</small>
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(workOrder.status)}`}>
                      {workOrder.status}
                    </span>
                  </td>
                  <td>
                    {workOrder.completedAt
                      ? new Date(workOrder.completedAt).toLocaleDateString()
                      : 'N/A'
                    }
                  </td>
                  <td>{new Date(workOrder.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-view"
                        onClick={() => setSelectedWorkOrder(workOrder)}
                        title="View Details"
                      >
                        <i className="fas fa-eye"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="empty-state">No work orders found</td>
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

      {selectedWorkOrder && (
        <div className="modal-overlay" onClick={() => setSelectedWorkOrder(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <h3>Work Order Details</h3>
            <div style={{ padding: '0 24px 24px 24px', overflowY: 'auto', maxHeight: 'calc(100vh - 150px)' }}>
              <div className="form-group">
                <label>ID</label>
                <div>{selectedWorkOrder.id}</div>
              </div>
              <div className="form-group">
                <label>Service Request</label>
                <div>
                  <strong>{selectedWorkOrder.serviceRequest?.projectTitle || 'N/A'}</strong>
                  <br />
                  <small>Request ID: {selectedWorkOrder.serviceRequestId}</small>
                  {selectedWorkOrder.serviceRequest?.customer && (
                    <>
                      <br />
                      <small>Customer: {selectedWorkOrder.serviceRequest.customer.name} ({selectedWorkOrder.serviceRequest.customer.email})</small>
                    </>
                  )}
                  {selectedWorkOrder.serviceRequest?.zipCode && (
                    <>
                      <br />
                      <small>Location: {selectedWorkOrder.serviceRequest.zipCode}</small>
                    </>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Provider</label>
                <div>
                  {selectedWorkOrder.provider?.user ? (
                    <>
                      <strong>{selectedWorkOrder.provider.user.name}</strong>
                      <br />
                      <small>{selectedWorkOrder.provider.user.email}</small>
                    </>
                  ) : (
                    'N/A'
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Status</label>
                <div>
                  <span className={`status-badge ${getStatusBadgeClass(selectedWorkOrder.status)}`}>
                    {selectedWorkOrder.status}
                  </span>
                </div>
              </div>
              <div className="form-group">
                <label>Created Date</label>
                <div>{new Date(selectedWorkOrder.createdAt).toLocaleString()}</div>
              </div>
              {selectedWorkOrder.completedAt && (
                <div className="form-group">
                  <label>Completed Date</label>
                  <div>{new Date(selectedWorkOrder.completedAt).toLocaleString()}</div>
                </div>
              )}
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setSelectedWorkOrder(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminWorkOrders;

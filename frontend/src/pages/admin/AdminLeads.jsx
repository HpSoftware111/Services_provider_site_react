import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './AdminTable.css';

const AdminLeads = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLead, setSelectedLead] = useState(null);

  useEffect(() => {
    loadLeads();
  }, [currentPage, statusFilter]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      let queryString = `page=${currentPage}&limit=20`;
      if (statusFilter !== 'all') {
        queryString += `&status=${statusFilter}`;
      }
      const response = await api.get(`/admin/leads?${queryString}`);
      setLeads(response.data.leads || []);
      setTotalPages(response.data.pages || 1);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      alert('Failed to load leads');
      setLeads([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      'PENDING': 'pending',
      'PAYMENT_PENDING': 'pending',
      'ACCEPTED': 'active',
      'REJECTED': 'rejected',
      'PAYMENT_FAILED': 'rejected'
    };
    return statusMap[status] || 'pending';
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="admin-table-container">
      <div className="table-header">
        <h2>Leads Management</h2>
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
              className={`filter-btn ${statusFilter === 'PENDING' ? 'active' : ''}`}
              onClick={() => setStatusFilter('PENDING')}
            >
              Pending
            </button>
            <button
              className={`filter-btn ${statusFilter === 'PAYMENT_PENDING' ? 'active' : ''}`}
              onClick={() => setStatusFilter('PAYMENT_PENDING')}
            >
              Payment Pending
            </button>
            <button
              className={`filter-btn ${statusFilter === 'ACCEPTED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ACCEPTED')}
            >
              Accepted
            </button>
            <button
              className={`filter-btn ${statusFilter === 'REJECTED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('REJECTED')}
            >
              Rejected
            </button>
            <button
              className={`filter-btn ${statusFilter === 'PAYMENT_FAILED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('PAYMENT_FAILED')}
            >
              Payment Failed
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
              <th>Provider</th>
              <th>Business</th>
              <th>Service Type</th>
              <th>Location</th>
              <th>Status</th>
              <th>Lead Cost</th>
              <th>Created Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.length > 0 ? (
              leads.map((lead) => (
                <tr key={lead.id}>
                  <td>{lead.id}</td>
                  <td>
                    {lead.customer?.name || lead.customerName || 'N/A'}
                    <br />
                    <small>{lead.customer?.email || lead.customerEmail}</small>
                  </td>
                  <td>
                    {lead.provider?.name || 'N/A'}
                    <br />
                    <small>{lead.provider?.email}</small>
                  </td>
                  <td>{lead.business?.name || 'N/A'}</td>
                  <td>
                    {lead.serviceType}
                    {lead.category && (
                      <>
                        <br />
                        <small>{lead.category.name}</small>
                      </>
                    )}
                  </td>
                  <td>
                    {lead.locationCity || ''}
                    {lead.locationCity && lead.locationState && ', '}
                    {lead.locationState || ''}
                    {lead.locationPostalCode && (
                      <>
                        <br />
                        <small>{lead.locationPostalCode}</small>
                      </>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(lead.frontendStatus || lead.status)}`}>
                      {lead.frontendStatus || lead.status}
                    </span>
                  </td>
                  <td>
                    {lead.leadCost ? `$${parseFloat(lead.leadCost).toFixed(2)}` : 'N/A'}
                  </td>
                  <td>{new Date(lead.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-view"
                        onClick={() => setSelectedLead(lead)}
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
                <td colSpan="10" className="empty-state">No leads found</td>
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

      {selectedLead && (
        <div className="modal-overlay" onClick={() => setSelectedLead(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <h3>Lead Details</h3>
            <div style={{ padding: '0 24px 24px 24px', overflowY: 'auto', maxHeight: 'calc(100vh - 150px)' }}>
              <div className="form-group">
                <label>ID</label>
                <div>{selectedLead.id}</div>
              </div>
              <div className="form-group">
                <label>Customer</label>
                <div>
                  <strong>{selectedLead.customer?.name || selectedLead.customerName || 'N/A'}</strong>
                  <br />
                  <small>{selectedLead.customer?.email || selectedLead.customerEmail}</small>
                  {(selectedLead.customer?.phone || selectedLead.customerPhone) && (
                    <>
                      <br />
                      <small>{selectedLead.customer?.phone || selectedLead.customerPhone}</small>
                    </>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Provider</label>
                <div>
                  {selectedLead.provider ? (
                    <>
                      <strong>{selectedLead.provider.name}</strong>
                      <br />
                      <small>{selectedLead.provider.email}</small>
                    </>
                  ) : (
                    'N/A'
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Business</label>
                <div>{selectedLead.business?.name || 'N/A'}</div>
              </div>
              <div className="form-group">
                <label>Service Type</label>
                <div>
                  <strong>{selectedLead.serviceType}</strong>
                  {selectedLead.category && (
                    <>
                      <br />
                      <small>{selectedLead.category.name}</small>
                    </>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Location</label>
                <div>
                  {selectedLead.locationCity && (
                    <>
                      {selectedLead.locationCity}
                      {selectedLead.locationState && `, ${selectedLead.locationState}`}
                      {selectedLead.locationPostalCode && ` ${selectedLead.locationPostalCode}`}
                    </>
                  )}
                  {!selectedLead.locationCity && selectedLead.locationPostalCode && (
                    selectedLead.locationPostalCode
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <div style={{ whiteSpace: 'pre-wrap' }}>{selectedLead.description}</div>
              </div>
              <div className="form-group">
                <label>Status</label>
                <div>
                  <span className={`status-badge ${getStatusBadgeClass(selectedLead.frontendStatus || selectedLead.status)}`}>
                    {selectedLead.frontendStatus || selectedLead.status}
                  </span>
                </div>
              </div>
              {selectedLead.leadCost && (
                <div className="form-group">
                  <label>Lead Cost</label>
                  <div>${parseFloat(selectedLead.leadCost).toFixed(2)}</div>
                </div>
              )}
              {selectedLead.budgetRange && (
                <div className="form-group">
                  <label>Budget Range</label>
                  <div>{selectedLead.budgetRange}</div>
                </div>
              )}
              {selectedLead.preferredContact && (
                <div className="form-group">
                  <label>Preferred Contact</label>
                  <div>{selectedLead.preferredContact}</div>
                </div>
              )}
              {selectedLead.metadata && (
                <div className="form-group">
                  <label>Metadata</label>
                  <div style={{
                    background: '#f9fafb',
                    padding: '12px',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    whiteSpace: 'pre-wrap',
                    maxHeight: '200px',
                    overflow: 'auto'
                  }}>
                    {typeof selectedLead.metadata === 'string'
                      ? selectedLead.metadata
                      : JSON.stringify(selectedLead.metadata, null, 2)}
                  </div>
                </div>
              )}
              <div className="form-group">
                <label>Created Date</label>
                <div>{new Date(selectedLead.createdAt).toLocaleString()}</div>
              </div>
              {selectedLead.routedAt && (
                <div className="form-group">
                  <label>Routed Date</label>
                  <div>{new Date(selectedLead.routedAt).toLocaleString()}</div>
                </div>
              )}
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setSelectedLead(null)}>
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

export default AdminLeads;

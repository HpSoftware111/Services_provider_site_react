import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './AdminTable.css';

const AdminProposals = () => {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProposal, setSelectedProposal] = useState(null);

  useEffect(() => {
    loadProposals();
  }, [currentPage, statusFilter]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const loadProposals = async () => {
    try {
      setLoading(true);
      let queryString = `page=${currentPage}&limit=20`;
      if (statusFilter !== 'all') {
        queryString += `&status=${statusFilter}`;
      }
      const response = await api.get(`/admin/proposals?${queryString}`);
      setProposals(response.data.proposals || []);
      setTotalPages(response.data.pages || 1);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      alert('Failed to load proposals');
      setProposals([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      'SENT': 'pending',
      'ACCEPTED': 'active',
      'REJECTED': 'rejected'
    };
    return statusMap[status] || 'pending';
  };

  const getPaymentStatusBadgeClass = (status) => {
    const statusMap = {
      'pending': 'pending',
      'succeeded': 'active',
      'failed': 'rejected'
    };
    return statusMap[status] || 'pending';
  };

  const getPayoutStatusBadgeClass = (status) => {
    const statusMap = {
      'pending': 'pending',
      'processing': 'pending',
      'completed': 'active',
      'failed': 'rejected'
    };
    return statusMap[status] || 'pending';
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="admin-table-container">
      <div className="table-header">
        <h2>Proposals Management</h2>
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
              className={`filter-btn ${statusFilter === 'SENT' ? 'active' : ''}`}
              onClick={() => setStatusFilter('SENT')}
            >
              Sent
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
              <th>Price</th>
              <th>Status</th>
              <th>Payment Status</th>
              <th>Payout Status</th>
              <th>Created Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {proposals.length > 0 ? (
              proposals.map((proposal) => (
                <tr key={proposal.id}>
                  <td>{proposal.id}</td>
                  <td>
                    {proposal.serviceRequest?.projectTitle || 'N/A'}
                    <br />
                    <small>Request #{proposal.serviceRequest?.id}</small>
                    {proposal.serviceRequest?.customer && (
                      <>
                        <br />
                        <small>Customer: {proposal.serviceRequest.customer.name}</small>
                      </>
                    )}
                  </td>
                  <td>
                    {proposal.provider?.user?.name || 'N/A'}
                    <br />
                    <small>{proposal.provider?.user?.email}</small>
                  </td>
                  <td>${parseFloat(proposal.price || 0).toFixed(2)}</td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(proposal.status)}`}>
                      {proposal.status}
                    </span>
                  </td>
                  <td>
                    {proposal.paymentStatus ? (
                      <span className={`status-badge ${getPaymentStatusBadgeClass(proposal.paymentStatus)}`}>
                        {proposal.paymentStatus}
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td>
                    {proposal.payoutStatus ? (
                      <span className={`status-badge ${getPayoutStatusBadgeClass(proposal.payoutStatus)}`}>
                        {proposal.payoutStatus}
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td>{new Date(proposal.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-view"
                        onClick={() => setSelectedProposal(proposal)}
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
                <td colSpan="9" className="empty-state">No proposals found</td>
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

      {selectedProposal && (
        <div className="modal-overlay" onClick={() => setSelectedProposal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <h3>Proposal Details</h3>
            <div style={{ padding: '0 24px 24px 24px', overflowY: 'auto', maxHeight: 'calc(100vh - 150px)' }}>
              <div className="form-group">
                <label>ID</label>
                <div>{selectedProposal.id}</div>
              </div>
              <div className="form-group">
                <label>Service Request</label>
                <div>
                  <strong>{selectedProposal.serviceRequest?.projectTitle || 'N/A'}</strong>
                  <br />
                  <small>Request ID: {selectedProposal.serviceRequestId}</small>
                  {selectedProposal.serviceRequest?.customer && (
                    <>
                      <br />
                      <small>Customer: {selectedProposal.serviceRequest.customer.name} ({selectedProposal.serviceRequest.customer.email})</small>
                    </>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Provider</label>
                <div>
                  {selectedProposal.provider?.user ? (
                    <>
                      <strong>{selectedProposal.provider.user.name}</strong>
                      <br />
                      <small>{selectedProposal.provider.user.email}</small>
                    </>
                  ) : (
                    'N/A'
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Details</label>
                <div style={{ whiteSpace: 'pre-wrap' }}>{selectedProposal.details}</div>
              </div>
              <div className="form-group">
                <label>Price</label>
                <div>${parseFloat(selectedProposal.price || 0).toFixed(2)}</div>
              </div>
              <div className="form-group">
                <label>Status</label>
                <div>
                  <span className={`status-badge ${getStatusBadgeClass(selectedProposal.status)}`}>
                    {selectedProposal.status}
                  </span>
                </div>
              </div>
              <div className="form-group">
                <label>Payment Information</label>
                <div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Payment Status:</strong>{' '}
                    {selectedProposal.paymentStatus ? (
                      <span className={`status-badge ${getPaymentStatusBadgeClass(selectedProposal.paymentStatus)}`}>
                        {selectedProposal.paymentStatus}
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </div>
                  {selectedProposal.stripePaymentIntentId && (
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Payment Intent ID:</strong> {selectedProposal.stripePaymentIntentId}
                    </div>
                  )}
                  {selectedProposal.paidAt && (
                    <div>
                      <strong>Paid At:</strong> {new Date(selectedProposal.paidAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Payout Information</label>
                <div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Payout Status:</strong>{' '}
                    {selectedProposal.payoutStatus ? (
                      <span className={`status-badge ${getPayoutStatusBadgeClass(selectedProposal.payoutStatus)}`}>
                        {selectedProposal.payoutStatus}
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </div>
                  {selectedProposal.providerPayoutAmount && (
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Provider Payout Amount:</strong> ${parseFloat(selectedProposal.providerPayoutAmount).toFixed(2)}
                    </div>
                  )}
                  {selectedProposal.platformFeeAmount && (
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Platform Fee Amount:</strong> ${parseFloat(selectedProposal.platformFeeAmount).toFixed(2)}
                    </div>
                  )}
                  {selectedProposal.stripeTransferId && (
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Stripe Transfer ID:</strong> {selectedProposal.stripeTransferId}
                    </div>
                  )}
                  {selectedProposal.payoutProcessedAt && (
                    <div>
                      <strong>Payout Processed At:</strong> {new Date(selectedProposal.payoutProcessedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Created Date</label>
                <div>{new Date(selectedProposal.createdAt).toLocaleString()}</div>
              </div>
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setSelectedProposal(null)}>
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

export default AdminProposals;

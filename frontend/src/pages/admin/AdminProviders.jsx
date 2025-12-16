import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './AdminTable.css';

const AdminProviders = () => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, inactive

  useEffect(() => {
    loadProviders();
  }, [currentPage, filterStatus]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      // Pass filterStatus to backend for server-side filtering
      const filterParam = filterStatus !== 'all' ? `&filterStatus=${filterStatus}` : '';
      const response = await api.get(`/admin/providers?page=${currentPage}&limit=20${filterParam}`);
      if (response.data.success) {
        // No need to filter on frontend - backend handles it
        setProviders(response.data.providers || []);
        setTotalPages(response.data.pages || 1);
        setTotalCount(response.data.total || 0);
      }
    } catch (error) {
      console.error('Error loading providers:', error);
      alert('Failed to load providers');
      setProviders([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const toggleProviderStatus = async (provider) => {
    const newStatus = !provider.isActive;
    if (!window.confirm(`Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} ${provider.name}?`)) return;

    try {
      await api.put(`/admin/providers/${provider.id}/status`, {
        isActive: newStatus
      });
      alert(`Provider ${newStatus ? 'activated' : 'deactivated'} successfully!`);
      loadProviders();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update provider status');
    }
  };

  const toggleProviderVerification = async (provider) => {
    const newVerificationStatus = !provider.isVerified;
    if (!window.confirm(`Are you sure you want to ${newVerificationStatus ? 'verify' : 'unverify'} ${provider.name}?`)) return;

    try {
      await api.put(`/admin/providers/${provider.id}/verify`, {
        isVerified: newVerificationStatus
      });
      alert(`Provider ${newVerificationStatus ? 'verified' : 'unverified'} successfully!`);
      loadProviders();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update provider verification');
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="admin-table-container">
      <div className="table-header">
        <h2>Provider Management</h2>
        <div className="stats">
          <span>Total: {totalCount}</span>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            style={{ marginLeft: '20px', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="all">All Providers</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Provider</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Business</th>
              <th>Subscription</th>
              <th>Verified</th>
              <th>Active</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {providers.length > 0 ? (
              providers.map((provider, index) => (
                <tr key={provider.id}>
                  <td>{(currentPage - 1) * 20 + index + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {provider.avatar ? (
                        <img
                          src={provider.avatar}
                          alt={provider.name}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            objectFit: 'cover'
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: '#e5e7eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#6b7280',
                          fontSize: '14px',
                          fontWeight: '600'
                        }}>
                          {provider.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      )}
                      <strong>{provider.name}</strong>
                    </div>
                  </td>
                  <td>{provider.email}</td>
                  <td>{provider.phone || 'N/A'}</td>
                  <td>{provider.businessName || 'N/A'}</td>
                  <td>
                    {provider.subscription ? (
                      <div style={{ fontSize: '12px' }}>
                        <div style={{ fontWeight: '600' }}>{provider.subscription.planName}</div>
                        <div style={{ color: '#6b7280', fontSize: '11px' }}>{provider.subscription.tier}</div>
                        <div style={{ 
                          marginTop: '4px',
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          display: 'inline-block',
                          backgroundColor: provider.subscription.status === 'ACTIVE' ? '#d1fae5' : 
                                         provider.subscription.status === 'EXPIRED' ? '#fee2e2' :
                                         provider.subscription.status === 'CANCELLED' ? '#fef3c7' :
                                         provider.subscription.status === 'TRIAL' ? '#dbeafe' : '#f3f4f6',
                          color: provider.subscription.status === 'ACTIVE' ? '#065f46' : 
                                provider.subscription.status === 'EXPIRED' ? '#991b1b' :
                                provider.subscription.status === 'CANCELLED' ? '#92400e' :
                                provider.subscription.status === 'TRIAL' ? '#1e40af' : '#374151',
                          fontWeight: '600'
                        }}>
                          {provider.subscription.status || 'N/A'}
                        </div>
                        {provider.subscription.currentPeriodEnd && (
                          <div style={{ 
                            marginTop: '4px',
                            fontSize: '10px',
                            color: '#6b7280'
                          }}>
                            Expires: {new Date(provider.subscription.currentPeriodEnd).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#9ca3af', fontSize: '12px' }}>No Subscription</span>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge ${provider.isVerified ? 'verified' : 'inactive'}`}>
                      {provider.isVerified ? 'Verified' : 'Not Verified'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`status-badge ${provider.isActive ? 'active' : 'inactive'}`}
                      onClick={() => toggleProviderStatus(provider)}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      title={`Click to ${provider.isActive ? 'deactivate' : 'activate'}`}
                    >
                      {provider.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{new Date(provider.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className={provider.isVerified ? 'btn-reject' : 'btn-approve'}
                        onClick={() => toggleProviderVerification(provider)}
                        title={provider.isVerified ? 'Unverify' : 'Verify'}
                      >
                        <i className={`fas fa-${provider.isVerified ? 'times-circle' : 'check-circle'}`}></i>
                      </button>
                      <button
                        className={provider.isActive ? 'btn-reject' : 'btn-approve'}
                        onClick={() => toggleProviderStatus(provider)}
                        title={provider.isActive ? 'Deactivate' : 'Activate'}
                      >
                        <i className={`fas fa-${provider.isActive ? 'ban' : 'check'}`}></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" className="empty-state">No providers found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
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
    </div>
  );
};

export default AdminProviders;

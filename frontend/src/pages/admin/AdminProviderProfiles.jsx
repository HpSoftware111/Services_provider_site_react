import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import './AdminTable.css';

const AdminProviderProfiles = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState(null);

  useEffect(() => {
    loadProfiles();
  }, [currentPage]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/provider-profiles?page=${currentPage}&limit=20`);
      setProfiles(response.data.profiles || []);
      setTotalPages(response.data.pages || 1);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      alert('Failed to load provider profiles');
      setProfiles([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (profile) => {
    const newStatus = profile.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (!window.confirm(`Change provider status to ${newStatus}?`)) return;

    try {
      // Note: This endpoint might need to be created if it doesn't exist
      // For now, we'll just show an alert that this feature needs backend support
      alert('Status toggle feature requires backend endpoint implementation');
      // await api.put(`/admin/provider-profiles/${profile.id}/status`, { status: newStatus });
      // loadProfiles();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update provider status');
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="admin-table-container">
      <div className="table-header">
        <h2>Provider Profiles Management</h2>
        <div className="stats">
          <span>Total: {totalCount}</span>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Provider</th>
              <th>Contact</th>
              <th>Service Categories</th>
              <th>Zip Codes</th>
              <th>Status</th>
              <th>Rating</th>
              <th>Created Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.length > 0 ? (
              profiles.map((profile) => (
                <tr key={profile.id}>
                  <td>{profile.id}</td>
                  <td>
                    {profile.user ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {profile.user.avatar ? (
                            <img
                              src={profile.user.avatar}
                              alt={profile.user.name}
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
                              {profile.user.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                          )}
                          <div>
                            <strong>{profile.user.name}</strong>
                          </div>
                        </div>
                      </>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td>
                    {profile.user ? (
                      <>
                        <small>{profile.user.email}</small>
                        {profile.user.phone && (
                          <>
                            <br />
                            <small>{profile.user.phone}</small>
                          </>
                        )}
                      </>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td>
                    {profile.serviceCategories && profile.serviceCategories.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {profile.serviceCategories.slice(0, 2).map((cat, idx) => (
                          <span key={idx} style={{ fontSize: '12px' }}>
                            {typeof cat === 'object' ? cat.name || cat.id : cat}
                          </span>
                        ))}
                        {profile.serviceCategories.length > 2 && (
                          <small style={{ color: '#6b7280' }}>
                            +{profile.serviceCategories.length - 2} more
                          </small>
                        )}
                      </div>
                    ) : (
                      'None'
                    )}
                  </td>
                  <td>
                    {profile.zipCodesCovered && profile.zipCodesCovered.length > 0 ? (
                      <div>
                        {profile.zipCodesCovered.slice(0, 3).join(', ')}
                        {profile.zipCodesCovered.length > 3 && (
                          <>
                            <br />
                            <small style={{ color: '#6b7280' }}>
                              +{profile.zipCodesCovered.length - 3} more
                            </small>
                          </>
                        )}
                      </div>
                    ) : (
                      'None'
                    )}
                  </td>
                  <td>
                    <span className={`status-badge ${profile.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                      {profile.status}
                    </span>
                  </td>
                  <td>
                    {profile.ratingAverage ? (
                      <>
                        <span className="rating-stars golden">
                          {'★'.repeat(Math.floor(parseFloat(profile.ratingAverage)))}
                          {'☆'.repeat(5 - Math.floor(parseFloat(profile.ratingAverage)))}
                        </span>
                        <br />
                        <small>{parseFloat(profile.ratingAverage).toFixed(1)} ({profile.ratingCount || 0})</small>
                      </>
                    ) : (
                      'No ratings'
                    )}
                  </td>
                  <td>{new Date(profile.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-view"
                        onClick={() => setSelectedProfile(profile)}
                        title="View Details"
                      >
                        <i className="fas fa-eye"></i>
                      </button>
                      {profile.user && (
                        <Link
                          to={`/profile/${profile.user.id}`}
                          target="_blank"
                          className="btn-edit"
                          title="View Customer Profile"
                        >
                          <i className="fas fa-user"></i>
                        </Link>
                      )}
                      <button
                        className={profile.status === 'ACTIVE' ? 'btn-reject' : 'btn-approve'}
                        onClick={() => toggleStatus(profile)}
                        title={`${profile.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} Provider`}
                      >
                        <i className={`fas fa-${profile.status === 'ACTIVE' ? 'ban' : 'check'}`}></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="empty-state">No provider profiles found</td>
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

      {selectedProfile && (
        <div className="modal-overlay" onClick={() => setSelectedProfile(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <h3>Provider Profile Details</h3>
            <div style={{ padding: '0 24px 24px 24px', overflowY: 'auto', maxHeight: 'calc(100vh - 150px)' }}>
              <div className="form-group">
                <label>ID</label>
                <div>{selectedProfile.id}</div>
              </div>
              <div className="form-group">
                <label>Provider</label>
                <div>
                  {selectedProfile.user ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        {selectedProfile.user.avatar ? (
                          <img
                            src={selectedProfile.user.avatar}
                            alt={selectedProfile.user.name}
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '50%',
                              objectFit: 'cover'
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: '#e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#6b7280',
                            fontSize: '20px',
                            fontWeight: '600'
                          }}>
                            {selectedProfile.user.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div>
                          <strong>{selectedProfile.user.name}</strong>
                          <br />
                          <small>{selectedProfile.user.email}</small>
                        </div>
                      </div>
                      {selectedProfile.user.phone && (
                        <div>
                          <small>Phone: {selectedProfile.user.phone}</small>
                        </div>
                      )}
                      <div style={{ marginTop: '8px' }}>
                        <Link
                          to={`/profile/${selectedProfile.user.id}`}
                          target="_blank"
                          className="btn-edit"
                          style={{ textDecoration: 'none', display: 'inline-block' }}
                        >
                          View Customer Profile
                        </Link>
                      </div>
                    </>
                  ) : (
                    'N/A'
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Status</label>
                <div>
                  <span className={`status-badge ${selectedProfile.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                    {selectedProfile.status}
                  </span>
                </div>
              </div>
              <div className="form-group">
                <label>Rating</label>
                <div>
                  {selectedProfile.ratingAverage ? (
                    <>
                      <span className="rating-stars golden" style={{ fontSize: '18px', marginBottom: '8px', display: 'block' }}>
                        {'★'.repeat(Math.floor(parseFloat(selectedProfile.ratingAverage)))}
                        {'☆'.repeat(5 - Math.floor(parseFloat(selectedProfile.ratingAverage)))}
                      </span>
                      <div>
                        <strong>{parseFloat(selectedProfile.ratingAverage).toFixed(2)}</strong> out of 5.0
                        <br />
                        <small>Based on {selectedProfile.ratingCount || 0} review(s)</small>
                      </div>
                    </>
                  ) : (
                    'No ratings yet'
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Service Categories</label>
                <div>
                  {selectedProfile.serviceCategories && selectedProfile.serviceCategories.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {selectedProfile.serviceCategories.map((cat, idx) => (
                        <span
                          key={idx}
                          className="status-badge verified"
                          style={{ fontSize: '11px' }}
                        >
                          {typeof cat === 'object' ? cat.name || cat.id : cat}
                        </span>
                      ))}
                    </div>
                  ) : (
                    'None'
                  )}
                </div>
              </div>
              {selectedProfile.serviceSubCategories && selectedProfile.serviceSubCategories.length > 0 && (
                <div className="form-group">
                  <label>Service Subcategories</label>
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {selectedProfile.serviceSubCategories.map((subCat, idx) => (
                        <span
                          key={idx}
                          className="status-badge"
                          style={{ fontSize: '11px', background: '#f3f4f6', color: '#374151', borderColor: '#d1d5db' }}
                        >
                          {typeof subCat === 'object' ? subCat.name || subCat.id : subCat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="form-group">
                <label>Zip Codes Covered</label>
                <div>
                  {selectedProfile.zipCodesCovered && selectedProfile.zipCodesCovered.length > 0 ? (
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      maxHeight: '150px',
                      overflowY: 'auto',
                      padding: '12px',
                      background: '#f9fafb',
                      borderRadius: '6px'
                    }}>
                      {selectedProfile.zipCodesCovered.map((zip, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '4px 10px',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontFamily: 'monospace'
                          }}
                        >
                          {zip}
                        </span>
                      ))}
                    </div>
                  ) : (
                    'None'
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Created Date</label>
                <div>{new Date(selectedProfile.createdAt).toLocaleString()}</div>
              </div>
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setSelectedProfile(null)}>
                  Close
                </button>
                <button
                  className={selectedProfile.status === 'ACTIVE' ? 'btn-reject' : 'btn-approve'}
                  onClick={() => {
                    toggleStatus(selectedProfile);
                    setSelectedProfile(null);
                  }}
                >
                  {selectedProfile.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} Provider
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProviderProfiles;

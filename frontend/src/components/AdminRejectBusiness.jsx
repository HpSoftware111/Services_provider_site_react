import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './AdminEditBusiness.css';

const AdminRejectBusiness = ({ business, onClose, onUpdate }) => {
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Pre-fill rejection reason if business is already rejected
    if (business?.rejectionReason) {
      setRejectionReason(business.rejectionReason);
    }
  }, [business]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!rejectionReason.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }

    if (rejectionReason.trim().length < 10) {
      setError('Rejection reason must be at least 10 characters long');
      return;
    }

    setLoading(true);

    try {
      await api.put(`/admin/businesses/${business.id}/reject`, { rejectionReason: rejectionReason.trim() });
      alert(`Business ${business.rejectionReason ? 'rejection reason updated' : 'rejected'} successfully. The owner has been notified via email.`);
      onUpdate();
      onClose();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to reject business');
    } finally {
      setLoading(false);
    }
  };

  if (!business) return null;

  return (
    <div className="rejection-modal-overlay" onClick={onClose}>
      <div className="rejection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rejection-modal-header">
          <h2>
            <i className="fas fa-times-circle"></i>
            {business.rejectionReason ? 'Update Rejection Reason' : 'Reject Business'}: {business.name}
          </h2>
          <button className="close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="rejection-modal-body">
          <div className="rejection-info">
            <p>
              <i className="fas fa-info-circle"></i>
              {business.rejectionReason
                ? 'Update the rejection reason below. The provider will be notified of any changes via email.'
                : 'Please provide a clear reason for rejection. This will be sent to the provider via email to help them understand what needs to be corrected.'}
            </p>
          </div>

          {business.isActive && (
            <div className="alert alert-error" style={{ marginBottom: '20px' }}>
              <i className="fas fa-exclamation-triangle"></i>
              This business is currently active. Rejecting it will deactivate the listing and notify the owner.
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              <i className="fas fa-exclamation-circle"></i> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>
                <strong>Reason for Rejection *</strong>
                <small style={{ display: 'block', color: '#7f8c8d', marginTop: '5px' }}>
                  Minimum 10 characters required
                </small>
              </label>
              <textarea
                className="rejection-textarea"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Example: The business description is too vague. Please provide more details about your services. Also, please ensure all contact information is correct and your business address is accurate."
                required
              />
              <small style={{ display: 'block', marginTop: '5px', color: '#7f8c8d' }}>
                {rejectionReason.length} characters
              </small>
            </div>

            <div className="rejection-modal-footer">
              <button type="button" className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-reject" disabled={loading || !rejectionReason.trim() || rejectionReason.trim().length < 10}>
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> {business.rejectionReason ? 'Updating...' : 'Rejecting...'}
                  </>
                ) : (
                  <>
                    <i className="fas fa-times-circle"></i> {business.rejectionReason ? 'Update Rejection' : 'Reject Business'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminRejectBusiness;


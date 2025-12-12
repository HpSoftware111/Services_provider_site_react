import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './VerifyBusiness.css';

const VerifyBusiness = () => {
  const { user } = useContext(AuthContext);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState('not_verified');
  const [verifyMethod, setVerifyMethod] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchBusiness();
  }, []);

  const fetchBusiness = async () => {
    try {
      const response = await api.get('/businesses/my-businesses');
      const businesses = response.data.businesses || [];
      if (businesses.length > 0) {
        const biz = businesses[0];
        setBusiness(biz);
        setVerificationStatus(biz.isVerified ? 'verified' : (biz.verificationStatus || 'not_verified'));
      }
    } catch (error) {
      console.error('Error fetching business:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (method) => {
    if (!business) return;

    setSubmitting(true);
    try {
      await api.post(`/businesses/${business.id}/request-verification`, {
        method: method,
        data: {}
      });
      setVerificationStatus('pending');
      alert('Verification request submitted! You will be notified once reviewed.');
    } catch (error) {
      alert('Failed to submit verification request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="verify-business-page"><div className="loading">Loading...</div></div>;
  }

  if (!business) {
    return <div className="verify-business-page"><div className="empty">No business found</div></div>;
  }

  return (
    <div className="verify-business-page">
      <h1 className="page-title">Verify Your Business</h1>

      <div className="verification-status-card">
        <div className="status-header">
          <div className={`status-badge ${verificationStatus}`}>
            {verificationStatus === 'verified' && <i className="fas fa-check-circle"></i>}
            {verificationStatus === 'pending' && <i className="fas fa-clock"></i>}
            {verificationStatus === 'not_verified' && <i className="fas fa-times-circle"></i>}
            <span>
              {verificationStatus === 'verified' && 'Verified'}
              {verificationStatus === 'pending' && 'Pending Verification'}
              {verificationStatus === 'not_verified' && 'Not Verified'}
            </span>
          </div>
        </div>

        {verificationStatus === 'verified' && (
          <div className="status-content">
            <p className="status-message success">
              <i className="fas fa-check"></i>
              Your business has been verified. This helps build trust with customers and improves your visibility in search results.
            </p>
          </div>
        )}

        {verificationStatus === 'pending' && (
          <div className="status-content">
            <p className="status-message info">
              <i className="fas fa-info-circle"></i>
              Your verification request is being reviewed. We'll notify you once the review is complete.
            </p>
          </div>
        )}

        {verificationStatus === 'not_verified' && (
          <div className="status-content">
            <p className="status-message">
              Verify your business to build trust with customers and appear higher in search results. Choose a verification method below.
            </p>

            <div className="verification-methods">
              <div className="method-card" onClick={() => handleVerify('google')}>
                <i className="fab fa-google"></i>
                <h3>Google Business Profile</h3>
                <p>Link your Google Business listing</p>
              </div>
              <div className="method-card" onClick={() => handleVerify('phone')}>
                <i className="fas fa-phone"></i>
                <h3>Phone Verification</h3>
                <p>Verify via business phone call</p>
              </div>
              <div className="method-card" onClick={() => handleVerify('document')}>
                <i className="fas fa-file-alt"></i>
                <h3>Business Documents</h3>
                <p>Upload business license or registration</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyBusiness;


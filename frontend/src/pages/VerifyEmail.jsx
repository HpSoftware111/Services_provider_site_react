import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import './Auth.css';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    console.log('=== VerifyEmail Component Loaded ===');
    console.log('Current URL:', window.location.href);
    console.log('Pathname:', window.location.pathname);
    console.log('Search params:', window.location.search);
    
    // Try to get token from query parameter first (most common)
    // searchParams.get() automatically decodes URL-encoded values
    let token = searchParams.get('token');
    console.log('Token from searchParams:', token ? token.substring(0, 20) + '...' : 'null');

    // If not in query params, try to get from URL path (e.g., /verify-email/token123)
    if (!token) {
      console.log('Token not in query params, checking path...');
      const pathParts = window.location.pathname.split('/');
      console.log('Path parts:', pathParts);
      const tokenIndex = pathParts.indexOf('verify-email');
      if (tokenIndex !== -1 && pathParts[tokenIndex + 1]) {
        // Decode path parameter (it might be URL-encoded)
        try {
          token = decodeURIComponent(pathParts[tokenIndex + 1]);
          console.log('Token from path:', token.substring(0, 20) + '...');
        } catch (e) {
          token = pathParts[tokenIndex + 1]; // Use as-is if decoding fails
          console.log('Token from path (not decoded):', token.substring(0, 20) + '...');
        }
      }
    }

    if (token) {
      console.log('Token found, starting verification...');
      verifyEmail(token);
    } else {
      console.error('No token found in URL');
      setStatus('error');
      setMessage('No verification token provided. Please check your email link.');
    }
  }, [searchParams]);

  const verifyEmail = async (token) => {
    try {
      console.log('=== Email Verification Debug ===');
      console.log('Full token length:', token.length);
      console.log('Token preview:', token.substring(0, 30) + '...');
      console.log('API base URL:', import.meta.env.VITE_API_URL || '/api');
      
      // Try query parameter first
      let response;
      try {
        console.log('Attempting verification with query parameter...');
        response = await api.get(`/auth/verify-email`, {
          params: { token: token }
        });
        console.log('Query parameter method succeeded');
      } catch (queryError) {
        console.log('Query parameter method failed, trying path parameter...');
        console.log('Query error:', queryError.response?.data || queryError.message);
        
        // Fallback to path parameter method
        try {
          // URL encode the token for path parameter
          const encodedToken = encodeURIComponent(token);
          response = await api.get(`/auth/verify-email/${encodedToken}`);
          console.log('Path parameter method succeeded');
        } catch (pathError) {
          console.error('Path parameter method also failed');
          throw pathError; // Throw the original query error
        }
      }

      console.log('Verification response:', response.data);
      console.log('Response status:', response.status);

      // Check if response indicates success
      if (response.data && (response.data.success || response.data.message)) {
        setStatus('success');
        setMessage(response.data.message || 'Email verified successfully! You can now access all features.');
      } else {
        // Unexpected response format
        console.warn('Unexpected response format:', response.data);
        setStatus('error');
        setMessage('Verification completed but received unexpected response. Please try logging in.');
      }
    } catch (error) {
      console.error('=== Verification Error Details ===');
      console.error('Error object:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error config:', error.config?.url);
      console.error('Full error:', JSON.stringify(error, null, 2));

      setStatus('error');

      // Get error message from response
      let errorMessage = 'Verification failed. The link may be invalid or expired.';

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. Please check your internet connection and try again.';
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      }

      setMessage(errorMessage);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container" style={{ maxWidth: '500px', textAlign: 'center' }}>
        {status === 'verifying' && (
          <>
            <div className="verification-icon">
              <i className="fas fa-spinner fa-spin" style={{ fontSize: '60px', color: '#667eea' }}></i>
            </div>
            <h2>Verifying Your Email</h2>
            <p style={{ color: '#666' }}>Please wait while we verify your email address...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="verification-icon success">
              <i className="fas fa-check-circle" style={{ fontSize: '80px', color: '#10b981' }}></i>
            </div>
            <h2 style={{ color: '#10b981' }}>Email Verified!</h2>
            <p style={{ color: '#666', marginBottom: '30px' }}>{message}</p>
            <Link to="/login" className="btn-primary" style={{
              display: 'inline-block',
              padding: '14px 30px',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: '600'
            }}>
              <i className="fas fa-sign-in-alt"></i> Continue to Login
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="verification-icon error">
              <i className="fas fa-exclamation-circle" style={{ fontSize: '80px', color: '#ef4444' }}></i>
            </div>
            <h2 style={{ color: '#ef4444' }}>Verification Failed</h2>
            <p style={{ color: '#666', marginBottom: '30px' }}>{message}</p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/login" className="btn-secondary" style={{
                display: 'inline-block',
                padding: '14px 30px',
                textDecoration: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                background: '#f3f4f6',
                color: '#374151'
              }}>
                Go to Login
              </Link>
              <Link to="/register" className="btn-primary" style={{
                display: 'inline-block',
                padding: '14px 30px',
                textDecoration: 'none',
                borderRadius: '8px',
                fontWeight: '600'
              }}>
                Register Again
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;


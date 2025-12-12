import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import './AdminLogin.css';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { adminLogin, user, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in as admin
  useEffect(() => {
    if (user && user.role === 'admin') {
      navigate('/admin');
    } else if (user && user.role !== 'admin') {
      // Non-admin users trying to access admin login - redirect to main site
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Use admin login endpoint
      const result = await adminLogin(formData.email, formData.password);
      
      // Check if user is admin
      if (result.user?.role !== 'admin') {
        setError('Access denied. Admin credentials required.');
        setLoading(false);
        // Clear any invalid session
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return;
      }
      
      // Redirect to admin dashboard
      navigate('/admin');
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message || 'Login failed. Please check your credentials.';
      setError(errorMsg);
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="admin-login-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="admin-login-spinner"></div>
      </div>
    );
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-container">
        <div className="admin-login-header">
          <div className="admin-logo">
            <i className="fas fa-shield-alt"></i>
          </div>
          <h2>Admin Panel</h2>
          <p>Enter your admin credentials to access the dashboard</p>
        </div>
        
        {error && (
          <div className="admin-alert admin-alert-error">
            <i className="fas fa-exclamation-circle"></i>
            <span>{error}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-form-group">
            <label htmlFor="admin-email">
              <i className="fas fa-envelope"></i>
              Admin Email
            </label>
            <input
              type="email"
              id="admin-email"
              required
              placeholder="admin@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              autoComplete="email"
              autoFocus
            />
          </div>
          
          <div className="admin-form-group">
            <label htmlFor="admin-password">
              <i className="fas fa-lock"></i>
              Password
            </label>
            <input
              type="password"
              id="admin-password"
              required
              placeholder="Enter your password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              autoComplete="current-password"
            />
          </div>
          
          <button type="submit" className="btn-admin-login" disabled={loading}>
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Authenticating...
              </>
            ) : (
              <>
                <i className="fas fa-sign-in-alt"></i>
                Access Admin Panel
              </>
            )}
          </button>
        </form>
        
        <div className="admin-login-footer">
          <Link to="/" className="back-to-site">
            <i className="fas fa-arrow-left"></i>
            Back to Main Site
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;

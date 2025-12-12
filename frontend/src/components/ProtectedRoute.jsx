import React, { useContext, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    // Redirect to appropriate login based on route
    if (location.pathname.startsWith('/admin')) {
      return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
    }
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Block non-admins from accessing admin routes (redirect to home)
  if (location.pathname.startsWith('/admin') && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Block admins from accessing user dashboard routes (redirect to admin panel)
  if (location.pathname.startsWith('/user-dashboard') && user.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  // Redirect business-dashboard route to user-dashboard (no longer exists)
  if (location.pathname.startsWith('/business-dashboard')) {
    return <Navigate to="/user-dashboard" replace />;
  }

  // Check required role if specified
  if (requiredRole && user.role !== requiredRole) {
    // Redirect based on user role
    if (user.role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else {
      // All non-admin users (user or business_owner) go to user dashboard
      return <Navigate to="/user-dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;


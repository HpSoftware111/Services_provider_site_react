import React, { useState, useContext, useCallback, useRef, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './Auth.css';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useContext(AuthContext);

  // Form state - NEVER reset, use refs to preserve across renders
  const formDataRef = useRef({ email: '', password: '' });
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  // Error state
  const errorRef = useRef('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [needsVerification, setNeedsVerification] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');

  // Sync refs with state
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    errorRef.current = error;
  }, [error]);

  // Handle input changes - preserve form data
  const handleEmailChange = useCallback((e) => {
    const value = e.target.value;
    const newFormData = { ...formDataRef.current, email: value };
    formDataRef.current = newFormData;
    setFormData(newFormData);

    // Clear error when valid email is entered
    if (errorRef.current && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && formDataRef.current.password) {
      setError('');
      errorRef.current = '';
    }
    // Clear general error when user starts typing (except verification)
    if (errorRef.current && !needsVerification) {
      setError('');
      errorRef.current = '';
    }
  }, [fieldErrors.email, needsVerification]);

  const handlePasswordChange = useCallback((e) => {
    const value = e.target.value;
    const newFormData = { ...formDataRef.current, password: value };
    formDataRef.current = newFormData;
    setFormData(newFormData);

    // Clear error when password has sufficient length and email is valid
    if (errorRef.current && value.length >= 6 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formDataRef.current.email)) {
      setError('');
      errorRef.current = '';
    }
    // Clear general error when user starts typing (except verification)
    if (errorRef.current && !needsVerification) {
      setError('');
      errorRef.current = '';
    }
  }, [fieldErrors.password, needsVerification]);

  const handleResendVerification = useCallback(async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setResendLoading(true);
    setResendSuccess('');
    setError('');
    errorRef.current = '';

    try {
      await api.post('/auth/resend-verification-public', { email: formDataRef.current.email });
      setResendSuccess('Verification email sent! Please check your inbox.');
      setNeedsVerification(false);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to resend verification email. Please try again.';
      setError(errorMsg);
      errorRef.current = errorMsg;
    } finally {
      setResendLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(async (e) => {
    // CRITICAL: Prevent any default behavior
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Prevent form reset
    const form = e?.target;
    if (form) {
      form.reset = () => { }; // Disable form reset
    }

    // Reset only UI states, NOT form data
    setResendSuccess('');
    setLoading(true);

    // Use ref data to ensure we have latest values
    const currentEmail = formDataRef.current.email?.trim() || '';
    const currentPassword = formDataRef.current.password || '';

    // Client-side validation - show errors only at top
    let hasErrors = false;
    let validationError = '';

    if (!currentEmail) {
      validationError = 'Email address is required.';
      hasErrors = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentEmail)) {
      validationError = 'Please enter a valid email address.';
      hasErrors = true;
    } else if (!currentPassword) {
      validationError = 'Password is required.';
      hasErrors = true;
    }

    if (hasErrors) {
      setError(validationError);
      errorRef.current = validationError;
      setFieldErrors({ email: '', password: '' });
      setLoading(false);
      return;
    }

    try {
      const result = await login(currentEmail, currentPassword);

      // Only navigate on successful login
      if (result && result.token) {
        // Clear all errors on success
        setError('');
        errorRef.current = '';
        setFieldErrors({ email: '', password: '' });
        setNeedsVerification(false);

        // Check for pending business to link
        const pendingBusinessId = localStorage.getItem('pendingBusinessId');
        if (pendingBusinessId) {
          try {
            await api.post('/businesses/link-to-account', { businessIds: [pendingBusinessId] });
            localStorage.removeItem('pendingBusinessId');
            navigate('/user-dashboard/my-businesses');
            return;
          } catch (linkError) {
            // Silently handle link error and continue with normal redirect
          }
        }

        // Redirect to intended destination
        const from = location.state?.from || '/';
        navigate(from);
      }
    } catch (err) {
      // CRITICAL: Preserve form data - NEVER reset it
      // Use ref to ensure we keep the data
      const errorData = err.response?.data;
      const status = err.response?.status;

      // Debug logging (remove in production)
      console.log('Login error:', { status, errorData, needsVerification: errorData?.needsVerification, code: errorData?.code });

      // Handle different error types
      // Check for email verification error first (can come as needsVerification flag or EMAIL_NOT_VERIFIED code)
      if (errorData?.needsVerification || errorData?.code === 'EMAIL_NOT_VERIFIED') {
        setNeedsVerification(true);
        const errorMsg = errorData.error || 'Please verify your email before logging in.';
        setError(errorMsg);
        errorRef.current = errorMsg;
        setFieldErrors({ email: '', password: '' });
      } else if (status === 400) {
        // Validation errors - show only at top
        const errorMsg = errorData?.error || 'Please check your input and try again.';
        setError(errorMsg);
        errorRef.current = errorMsg;
        setFieldErrors({ email: '', password: '' });
      } else if (status === 401) {
        // Invalid credentials - show error only at top, not in fields
        const errorMsg = errorData?.error || 'Invalid email or password. Please check your credentials and try again.';
        setError(errorMsg);
        errorRef.current = errorMsg;
        setFieldErrors({ email: '', password: '' });
        setNeedsVerification(false);
      } else if (status === 403) {
        // Check if this is an email verification error
        if (errorData?.needsVerification || errorData?.code === 'EMAIL_NOT_VERIFIED') {
          setNeedsVerification(true);
          const errorMsg = errorData.error || 'Please verify your email before logging in.';
          setError(errorMsg);
          errorRef.current = errorMsg;
          setFieldErrors({ email: '', password: '' });
        } else {
          // Other 403 errors (access denied, etc.)
          const errorMsg = errorData?.error || 'Access denied. Please contact support.';
          setError(errorMsg);
          errorRef.current = errorMsg;
          setFieldErrors({ email: '', password: '' });
        }
      } else if (status === 500) {
        const errorMsg = 'Server error. Please try again later.';
        setError(errorMsg);
        errorRef.current = errorMsg;
        setFieldErrors({ email: '', password: '' });
      } else {
        const errorMsg = errorData?.error || 'Login failed. Please try again.';
        setError(errorMsg);
        errorRef.current = errorMsg;
        setFieldErrors({ email: '', password: '' });
      }
    } finally {
      setLoading(false);
    }
  }, [login, navigate, location]);

  // Prevent any accidental navigation or refresh
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (loading) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [loading]);

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h2>Welcome Back</h2>
          <p>Enter your credentials to access your account</p>
        </div>

        {/* Error Container - Fixed height to prevent shifts */}
        <div className="alert-container">
          {error && (
            <div className={`alert ${needsVerification ? 'alert-warning' : 'alert-error'}`} role="alert">
              <i className={`fas ${needsVerification ? 'fa-envelope' : 'fa-exclamation-circle'}`}></i>
              <div className="alert-content">
                <span>{error}</span>
                {needsVerification && (
                  <button
                    type="button"
                    className="resend-btn"
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '8px'
                    }}
                  >
                    {resendLoading ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i> Sending...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-paper-plane"></i> Resend Verification Email
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {resendSuccess && (
            <div className="alert alert-success" role="alert">
              <i className="fas fa-check-circle"></i>
              <span>{resendSuccess}</span>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="auth-form"
          onReset={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="form-group">
            <label htmlFor="email">
              <i className="fas fa-envelope"></i> Email Address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleEmailChange}
              className={error && !needsVerification ? 'input-error' : ''}
              disabled={loading}
              autoFocus={false}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <i className="fas fa-lock"></i> Password
            </label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handlePasswordChange}
                className={error && !needsVerification ? 'input-error' : ''}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                <span>Logging in...</span>
              </>
            ) : (
              <>
                <i className="fas fa-sign-in-alt"></i>
                <span>Log In</span>
              </>
            )}
          </button>
        </form>

        <p className="auth-link">
          Don't have an account? <Link to="/register">Create one now</Link>
        </p>
      </div>
    </div>
  );
};

export default React.memo(Login);

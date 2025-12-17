import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './Auth.css';

const ProviderSignup = () => {
    const navigate = useNavigate();
    const { checkAuth } = useAuth();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!formData.name.trim()) {
            setError('Name is required');
            return;
        }

        if (!formData.email.trim()) {
            setError('Email is required');
            return;
        }

        if (!formData.phone.trim()) {
            setError('Phone number is required');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            // Register as provider
            const response = await api.post('/auth/provider-signup', {
                name: formData.name.trim(),
                email: formData.email.trim(),
                phone: formData.phone.trim(),
                password: formData.password
            });

            // Auto-login after successful signup
            if (response.data.token) {
                // Store token and user data
                localStorage.setItem('token', response.data.token);
                if (response.data.user) {
                    localStorage.setItem('user', JSON.stringify(response.data.user));
                }

                // Refresh auth context and redirect
                await checkAuth();
                navigate('/user-dashboard/my-business');
            } else {
                setError('Signup successful but login failed. Please try logging in.');
            }
        } catch (error) {
            setError(error.response?.data?.error || error.response?.data?.message || 'Signup failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-container" style={{ maxWidth: '500px' }}>
                <h2><i className="fas fa-user-tie"></i> Provider Signup</h2>
                <p style={{ marginBottom: '25px', color: '#6b7280' }}>
                    Create your provider account to start adding and managing your business
                </p>

                {error && (
                    <div className="alert alert-error">
                        <i className="fas fa-exclamation-circle"></i> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label><i className="fas fa-user"></i> Full Name *</label>
                        <input
                            type="text"
                            required
                            placeholder="Enter your full name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label><i className="fas fa-envelope"></i> Email Address *</label>
                        <input
                            type="email"
                            required
                            placeholder="Enter your email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label><i className="fas fa-phone"></i> Phone Number *</label>
                        <input
                            type="tel"
                            required
                            placeholder="(555) 123-4567"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label><i className="fas fa-lock"></i> Password *</label>
                        <div className="password-input-wrapper">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                placeholder="At least 6 characters"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label><i className="fas fa-lock"></i> Confirm Password *</label>
                        <div className="password-input-wrapper">
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                required
                                placeholder="Re-enter your password"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                tabIndex={-1}
                            >
                                <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
                        {loading ? (
                            <><i className="fas fa-spinner fa-spin"></i> Creating Account...</>
                        ) : (
                            <><i className="fas fa-user-plus"></i> Create Provider Account</>
                        )}
                    </button>
                </form>

                <p className="auth-link" style={{ marginTop: '20px', textAlign: 'center' }}>
                    Already have an account? <Link to="/login">Sign in here</Link>
                </p>
            </div>
        </div>
    );
};

export default ProviderSignup;


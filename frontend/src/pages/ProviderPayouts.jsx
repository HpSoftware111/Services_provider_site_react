import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './ProviderPayouts.css';

const ProviderPayouts = () => {
    const { user } = useContext(AuthContext);
    const [payouts, setPayouts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 10,
        total: 0,
        pages: 0
    });
    const [stats, setStats] = useState({
        totalEarnings: 0,
        totalPayouts: 0,
        pendingPayouts: 0,
        completedPayouts: 0
    });

    useEffect(() => {
        loadPayouts();
    }, [pagination.page]);

    const loadPayouts = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get('/provider/payouts', {
                params: {
                    page: pagination.page,
                    pageSize: pagination.pageSize
                }
            });
            if (response.data.success) {
                setPayouts(response.data.data || []);
                setPagination(prev => ({
                    ...prev,
                    total: response.data.pagination?.total || 0,
                    pages: response.data.pagination?.pages || 0
                }));
                // Backend should always provide stats calculated from all payouts
                // This fallback is only for edge cases where stats might be missing
                if (response.data.stats) {
                    setStats(response.data.stats);
                } else {
                    // Fallback: calculate from current page data (not ideal, but better than nothing)
                    console.warn('Backend did not provide stats, calculating from current page data');
                    calculateStats(response.data.data || []);
                }
            }
        } catch (err) {
            console.error('Error loading payouts:', err);
            setError(err.response?.data?.error || 'Failed to load payouts');
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    /**
     * Fallback function to calculate stats from payout data
     * NOTE: This only calculates from the provided data (usually current page).
     * Backend should provide stats calculated from ALL payouts for accuracy.
     * This is a fallback for edge cases where backend stats might be missing.
     */
    const calculateStats = (payoutData) => {
        const calculatedStats = {
            totalEarnings: 0,
            totalPayouts: 0,
            pendingPayouts: 0,
            completedPayouts: 0
        };

        if (!payoutData || !Array.isArray(payoutData)) {
            return;
        }

        payoutData.forEach(payout => {
            if (payout.totalAmount) {
                calculatedStats.totalEarnings += parseFloat(payout.totalAmount) || 0;
            }
            if (payout.payoutStatus === 'completed' && payout.providerAmount) {
                calculatedStats.totalPayouts += parseFloat(payout.providerAmount) || 0;
                calculatedStats.completedPayouts += 1;
            }
            if ((payout.payoutStatus === 'pending' || payout.payoutStatus === 'processing') && payout.providerAmount) {
                calculatedStats.pendingPayouts += parseFloat(payout.providerAmount) || 0;
            }
        });

        setStats(calculatedStats);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadgeClass = (status) => {
        // Normalize status to lowercase for case-insensitive matching
        const normalizedStatus = (status || 'pending').toLowerCase().trim();
        const classes = {
            'pending': 'status-pending',
            'processing': 'status-processing',
            'completed': 'status-completed',
            'failed': 'status-failed'
        };
        return classes[normalizedStatus] || 'status-default';
    };

    const formatStatusDisplay = (status) => {
        // Format status for display (capitalize first letter)
        if (!status || status === 'null' || status === 'undefined') {
            return 'Pending';
        }
        return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    };

    if (loading) {
        return (
            <div className="provider-payouts">
                <div className="loading-container">
                    <i className="fas fa-spinner fa-spin"></i>
                    <p>Loading payouts...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="provider-payouts">
            <div className="payouts-header">
                <h1>
                    <i className="fas fa-money-bill-wave"></i>
                    My Payouts
                </h1>
                <p className="subtitle">Track your earnings and payouts</p>
            </div>

            {error && (
                <div className="error-message">
                    <i className="fas fa-exclamation-circle"></i>
                    <span>{error}</span>
                </div>
            )}

            {/* Stats Cards */}
            <div className="payout-stats">
                <div className="stat-card">
                    <div className="stat-icon total">
                        <i className="fas fa-dollar-sign"></i>
                    </div>
                    <div className="stat-content">
                        <label>Total Earnings</label>
                        <span className="stat-value">${stats.totalEarnings.toFixed(2)}</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon completed">
                        <i className="fas fa-check-circle"></i>
                    </div>
                    <div className="stat-content">
                        <label>Total Paid Out</label>
                        <span className="stat-value">${stats.totalPayouts.toFixed(2)}</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon pending">
                        <i className="fas fa-clock"></i>
                    </div>
                    <div className="stat-content">
                        <label>Pending Payouts</label>
                        <span className="stat-value">${stats.pendingPayouts.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Payouts List */}
            {payouts.length === 0 ? (
                <div className="no-payouts">
                    <div className="no-payouts-icon">
                        <i className="fas fa-inbox"></i>
                    </div>
                    <h3>No Payouts Yet</h3>
                    <p>Your payouts will appear here after customers approve completed work.</p>
                    <p className="hint">
                        Once a customer approves your completed work, you'll receive 90% of the proposal amount (10% platform fee).
                    </p>
                </div>
            ) : (
                <div className="payouts-list">
                    {payouts.map((payout) => (
                        <div key={payout.id} className="payout-card">
                            <div className="payout-header">
                                <h3>{payout.projectTitle || 'Project'}</h3>
                                <span className={`status-badge ${getStatusBadgeClass(payout.payoutStatus)}`}>
                                    {formatStatusDisplay(payout.payoutStatus)}
                                </span>
                            </div>
                            <div className="payout-details">
                                <div className="detail-row">
                                    <span>Total Amount:</span>
                                    <strong>${payout.totalAmount?.toFixed(2) || '0.00'}</strong>
                                </div>
                                <div className="detail-row">
                                    <span>Platform Fee (10%):</span>
                                    <span className="fee">-${payout.platformFee?.toFixed(2) || (payout.totalAmount ? (payout.totalAmount * 0.1).toFixed(2) : '0.00')}</span>
                                </div>
                                <div className="detail-row highlight">
                                    <span>Your Payout:</span>
                                    <strong className="payout-amount">
                                        ${payout.providerAmount?.toFixed(2) || (payout.totalAmount ? (payout.totalAmount * 0.9).toFixed(2) : '0.00')}
                                    </strong>
                                </div>
                                {payout.paidAt && (
                                    <div className="detail-row">
                                        <span>Paid At:</span>
                                        <span>{formatDate(payout.paidAt)}</span>
                                    </div>
                                )}
                                {payout.payoutProcessedAt && (
                                    <div className="detail-row">
                                        <span>Payout Processed:</span>
                                        <span>{formatDate(payout.payoutProcessedAt)}</span>
                                    </div>
                                )}
                                {payout.serviceRequestStatus && (
                                    <div className="detail-row">
                                        <span>Project Status:</span>
                                        <span className={`status-badge status-${payout.serviceRequestStatus.toLowerCase()}`}>
                                            {payout.serviceRequestStatus}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
                <div className="pagination">
                    <button
                        className="pagination-btn"
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page === 1}
                    >
                        <i className="fas fa-chevron-left"></i>
                        Previous
                    </button>
                    <span className="pagination-info">
                        Page {pagination.page} of {pagination.pages}
                        <span className="pagination-total">({pagination.total} total)</span>
                    </span>
                    <button
                        className="pagination-btn"
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page >= pagination.pages}
                    >
                        Next
                        <i className="fas fa-chevron-right"></i>
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProviderPayouts;


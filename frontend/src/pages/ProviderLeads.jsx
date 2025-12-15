import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import ProviderPaymentModal from '../components/ProviderPaymentModal';
import './ProviderLeads.css';

const ProviderLeads = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('PENDING');
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 10,
        total: 0,
        pages: 0
    });
    const [showAcceptModal, setShowAcceptModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedLead, setSelectedLead] = useState(null);
    const [proposalData, setProposalData] = useState({
        description: '',
        price: ''
    });
    const [rejectReason, setRejectReason] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const [rejectionReasonOther, setRejectionReasonOther] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [leadCost, setLeadCost] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentData, setPaymentData] = useState({
        clientSecret: null,
        paymentIntentId: null,
        leadCost: null
    });
    const [leadUsage, setLeadUsage] = useState({
        currentCount: 0,
        maxLeads: null,
        remainingLeads: null,
        isUnlimited: false,
        planName: 'Basic',
        limitReached: false
    });

    useEffect(() => {
        loadLeads();
        loadLeadUsage();
    }, [statusFilter, pagination.page]);

    const loadLeadUsage = async () => {
        try {
            const response = await api.get('/provider/lead-usage');
            if (response.data.success) {
                setLeadUsage(response.data.data);
            }
        } catch (err) {
            console.error('Error loading lead usage:', err);
        }
    };

    const loadLeads = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get('/provider/leads', {
                params: {
                    status: statusFilter,
                    page: pagination.page,
                    pageSize: pagination.pageSize
                }
            });

            if (response.data.success) {
                setLeads(response.data.data || []);
                setPagination(prev => ({
                    ...prev,
                    total: response.data.pagination?.total || 0,
                    pages: response.data.pagination?.pages || 0
                }));

                // Show message if provider profile not found
                if (response.data.message && response.data.message.includes('Provider profile not found')) {
                    setError(response.data.message);
                } else {
                    setError(null);
                }
            }
        } catch (err) {
            console.error('Error loading leads:', err);
            const errorMessage = err.response?.data?.error || 'Failed to load leads';
            setError(errorMessage);

            // If provider profile not found, show helpful message
            if (errorMessage.includes('Provider profile not found')) {
                setError('Provider profile not found. Please complete your provider profile setup to view leads.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = (lead) => {
        // Check if limit is reached before opening modal
        if (leadUsage.limitReached && !leadUsage.isUnlimited) {
            alert(`Monthly lead limit reached. You have accepted ${leadUsage.currentCount} leads this month. Your ${leadUsage.planName} plan allows ${leadUsage.maxLeads} leads per month. Please upgrade your plan to accept more leads.`);
            return;
        }

        setSelectedLead(lead);
        setProposalData({ description: '', price: '' });
        // Set lead cost from the lead object
        // leadCost is already in dollars from the backend (converted from cents)
        if (lead.leadCost) {
            const cost = typeof lead.leadCost === 'number' ? lead.leadCost : parseFloat(lead.leadCost);
            setLeadCost(cost);
        } else {
            // If not available, we'll get it from the API response
            setLeadCost(null);
        }
        setShowAcceptModal(true);
    };

    const handleReject = (lead) => {
        setSelectedLead(lead);
        setRejectReason('');
        setRejectionReason('');
        setRejectionReasonOther('');
        setShowRejectModal(true);
    };

    const handleConfirmAccept = async () => {
        // Validate
        if (!proposalData.description.trim()) {
            alert('Please provide a description');
            return;
        }
        if (!proposalData.price || parseFloat(proposalData.price) <= 0) {
            alert('Please provide a valid price (greater than 0)');
            return;
        }

        setSubmitting(true);
        try {
            const response = await api.patch(`/provider/leads/${selectedLead.id}/accept`, {
                description: proposalData.description,
                price: parseFloat(proposalData.price)
            });
            if (response.data.success) {
                // Store payment data for payment modal
                const cost = response.data.leadCost ? parseFloat(response.data.leadCost) : null;

                // Close accept modal
                setShowAcceptModal(false);

                // If clientSecret is provided, show payment modal
                if (response.data.clientSecret) {
                    setPaymentData({
                        clientSecret: response.data.clientSecret,
                        paymentIntentId: response.data.paymentIntentId || null,
                        leadCost: cost
                    });
                    setShowPaymentModal(true);
                } else {
                    // No payment required or payment already completed
                    setSelectedLead(null);
                    setProposalData({ description: '', price: '' });
                    setLeadCost(null);
                    await loadLeads();
                    alert('Lead accepted successfully! Proposal sent to customer.');
                }
            }
        } catch (err) {
            console.error('Error accepting lead:', err);
            const errorMessage = err.response?.data?.error || 'Failed to accept lead';

            // If limit reached, show upgrade message
            if (err.response?.data?.limitReached) {
                alert(`${errorMessage}\n\nPlease upgrade your plan to accept more leads.`);
                // Reload lead usage stats
                loadLeadUsage();
            } else {
                alert(errorMessage);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleConfirmReject = async () => {
        setSubmitting(true);
        try {
            // Validate rejection reason
            if (!rejectionReason) {
                alert('Please select a rejection reason');
                return;
            }

            if (rejectionReason === 'OTHER' && !rejectionReasonOther.trim()) {
                alert('Please provide a description when selecting "Other" as the rejection reason');
                return;
            }

            const response = await api.patch(`/provider/leads/${selectedLead.id}/reject`, {
                rejectionReason: rejectionReason,
                rejectionReasonOther: rejectionReason === 'OTHER' ? rejectionReasonOther : null
            });
            if (response.data.success) {
                setShowRejectModal(false);
                setSelectedLead(null);
                setRejectReason('');
                setRejectionReason('');
                setRejectionReasonOther('');
                loadLeads();
                alert('Lead rejected. Customer has been notified.');
            }
        } catch (err) {
            console.error('Error rejecting lead:', err);
            alert(err.response?.data?.error || 'Failed to reject lead');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePaymentSuccess = async (data) => {
        console.log('Payment successful:', data);

        // Store the lead ID before clearing
        const paidLeadId = selectedLead?.id;

        // Close payment modal
        setShowPaymentModal(false);
        setPaymentData({
            clientSecret: null,
            paymentIntentId: null,
            leadCost: null
        });

        // Immediately update the lead status in local state to ACCEPTED if it's in the current list
        if (selectedLead) {
            setLeads(prevLeads =>
                prevLeads.map(lead =>
                    lead.id === selectedLead.id
                        ? { ...lead, status: 'ACCEPTED', proposalPaymentStatus: 'succeeded' }
                        : lead
                )
            );
        }

        // Clear accept modal data
        setSelectedLead(null);
        setProposalData({ description: '', price: '' });
        setLeadCost(null);

        // Show success message
        alert('Payment successful! Lead accepted and proposal sent to customer.');

        // Reload lead usage stats after accepting
        await loadLeadUsage();

        // If current filter won't show ACCEPTED leads, switch to 'all' to show the updated lead
        // This will trigger useEffect to reload leads automatically
        if (statusFilter !== 'all' && statusFilter !== 'ACCEPTED') {
            setStatusFilter('all');
        } else {
            // If filter already shows ACCEPTED or all, reload leads immediately
            await loadLeads();
        }

        // Wait a moment for webhook to process, then reload again to ensure status is synced with backend
        setTimeout(async () => {
            await loadLeads();
            await loadLeadUsage();
        }, 2000); // Wait 2 seconds for webhook to process
    };

    const handlePaymentClose = () => {
        setShowPaymentModal(false);
        setPaymentData({
            clientSecret: null,
            paymentIntentId: null,
            leadCost: null
        });
        // Reload leads to show current status
        loadLeads();
    };

    const handleCompletePayment = async (lead) => {
        try {
            // Fetch payment intent details from backend
            // If payment intent exists, backend will return it without requiring description/price
            const response = await api.patch(`/provider/leads/${lead.id}/accept`, {
                description: lead.serviceRequest?.projectDescription || '', // May not be needed if payment intent exists
                price: lead.proposalPrice || 0 // May not be needed if payment intent exists
            });

            if (response.data.success && response.data.clientSecret) {
                const cost = response.data.leadCost ? parseFloat(response.data.leadCost) : null;
                setPaymentData({
                    clientSecret: response.data.clientSecret,
                    paymentIntentId: response.data.paymentIntentId || null,
                    leadCost: cost
                });
                setShowPaymentModal(true);
            } else {
                alert('Unable to retrieve payment details. Please try again.');
            }
        } catch (err) {
            console.error('Error fetching payment details:', err);
            const errorMsg = err.response?.data?.error || 'Failed to load payment details';
            if (errorMsg.includes('already been paid')) {
                // Payment already completed, refresh leads
                await loadLeads();
                alert('This lead has already been paid and accepted.');
            } else {
                alert(errorMsg);
            }
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Not specified';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'PENDING':
                return 'status-badge pending';
            case 'PAYMENT_PENDING':
                return 'status-badge payment-pending';
            case 'ACCEPTED':
                return 'status-badge accepted';
            case 'REJECTED':
                return 'status-badge rejected';
            case 'PAYMENT_FAILED':
                return 'status-badge payment-failed';
            default:
                return 'status-badge';
        }
    };

    if (loading && leads.length === 0) {
        return (
            <div className="provider-leads-container">
                <div className="loading-spinner"></div>
            </div>
        );
    }

    return (
        <div className="provider-leads-container">
            <div className="leads-header">
                <div className="header-top">
                    <h1>My Leads</h1>
                    {leadUsage && (
                        <div className={`lead-usage-stats ${leadUsage.limitReached ? 'limit-reached' : ''}`}>
                            <div className="usage-info">
                                <i className={`fas ${leadUsage.isUnlimited ? 'fa-infinity' : 'fa-chart-line'}`}></i>
                                <span className="usage-text">
                                    {leadUsage.isUnlimited ? (
                                        <span>Unlimited leads</span>
                                    ) : (
                                        <span>
                                            {leadUsage.currentCount} / {leadUsage.maxLeads} leads this month
                                            {leadUsage.remainingLeads !== null && (
                                                <span className="remaining"> ({leadUsage.remainingLeads} remaining)</span>
                                            )}
                                        </span>
                                    )}
                                </span>
                                {leadUsage.planName && (
                                    <span className="plan-badge">{leadUsage.planName}</span>
                                )}
                            </div>
                            {leadUsage.limitReached && (
                                <div className="limit-warning">
                                    <i className="fas fa-exclamation-triangle"></i>
                                    <span>Monthly limit reached. <a href="/user-dashboard/subscriptions" style={{ color: '#007bff', textDecoration: 'underline' }}>Upgrade plan</a> to accept more leads.</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="leads-filters">
                    <div className="select-wrapper">
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setPagination(prev => ({ ...prev, page: 1 }));
                            }}
                            className="status-filter"
                        >
                            <option value="all">All Leads</option>
                            <option value="PENDING">Pending</option>
                            <option value="PAYMENT_PENDING">Payment Pending</option>
                            <option value="ACCEPTED">Accepted</option>
                            <option value="REJECTED">Rejected</option>
                            <option value="PAYMENT_FAILED">Payment Failed</option>
                        </select>
                        <i className="fas fa-chevron-down select-arrow"></i>
                    </div>
                </div>
            </div>

            {error && !error.includes('Provider profile not found') && (
                <div className="error-message">
                    <i className="fas fa-exclamation-circle"></i> {error}
                </div>
            )}

            {error && error.includes('Provider profile not found') ? (
                <div className="no-provider-profile">
                    <i className="fas fa-user-plus"></i>
                    <h3>Provider Profile Required</h3>
                    <p>{error}</p>
                    <p className="no-leads-hint">
                        To receive leads, you need to set up your provider profile.
                        Please contact support or complete your business profile setup.
                    </p>
                </div>
            ) : !error && leads.length === 0 && !loading ? (
                <div className="no-leads">
                    <i className="fas fa-inbox"></i>
                    <p>No leads found.</p>
                    <p className="no-leads-hint">Leads will appear here when customers request services in your area.</p>
                </div>
            ) : !error && (
                <>
                    <div className="leads-grid">
                        {leads.map((lead) => (
                            <div key={lead.id} className="lead-card">
                                <div className="lead-header">
                                    <div className="lead-status">
                                        <span className={getStatusBadgeClass(lead.status)}>
                                            {lead.status}
                                        </span>
                                        {lead.isPrimary && (
                                            <span className="primary-badge">Primary</span>
                                        )}
                                    </div>
                                    <div className="lead-cost">
                                        {lead.status === 'ACCEPTED' && lead.proposalPrice ? (
                                            <>
                                                <span className="cost-label">Proposal Price:</span>
                                                <span className="cost-value">${parseFloat(lead.proposalPrice).toFixed(2)}</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="cost-label">Lead Cost:</span>
                                                <div className="cost-with-discount">
                                                    {lead.hasDiscount && lead.baseLeadCost ? (
                                                        <>
                                                            <span className="cost-value discounted">${parseFloat(lead.leadCost || 0).toFixed(2)}</span>
                                                            <span className="original-cost">${parseFloat(lead.baseLeadCost).toFixed(2)}</span>
                                                            <span className="discount-badge">{lead.discountPercent}% off</span>
                                                        </>
                                                    ) : (
                                                        <span className="cost-value">${parseFloat(lead.leadCost || 0).toFixed(2)}</span>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="lead-content">
                                    <h3>{lead.serviceRequest?.projectTitle || 'Untitled Project'}</h3>

                                    <div className="lead-details">
                                        <div className="detail-row">
                                            <i className="fas fa-user"></i>
                                            <span>{lead.serviceRequest?.customer?.name || 'Customer'}</span>
                                        </div>

                                        <div className="detail-row">
                                            <i className="fas fa-tag"></i>
                                            <span>
                                                {lead.serviceRequest?.category?.name || 'N/A'}
                                                {lead.serviceRequest?.subCategory &&
                                                    ` - ${lead.serviceRequest.subCategory.name}`
                                                }
                                            </span>
                                        </div>

                                        <div className="detail-row">
                                            <i className="fas fa-map-marker-alt"></i>
                                            <span>{lead.serviceRequest?.zipCode || 'N/A'}</span>
                                        </div>

                                        <div className="detail-row">
                                            <i className="fas fa-calendar"></i>
                                            <span>
                                                {formatDate(lead.serviceRequest?.preferredDate)}
                                                {lead.serviceRequest?.preferredTime && (
                                                    <span className="time-badge">
                                                        {lead.serviceRequest.preferredTime}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    {lead.serviceRequest?.projectDescription && (
                                        <div className="lead-description">
                                            <p>
                                                {lead.serviceRequest.projectDescription.length > 150
                                                    ? `${lead.serviceRequest.projectDescription.substring(0, 150)}...`
                                                    : lead.serviceRequest.projectDescription
                                                }
                                            </p>
                                        </div>
                                    )}

                                    <div className="lead-footer">
                                        <div className="lead-date">
                                            Received: {formatDateTime(lead.createdAt)}
                                        </div>

                                        {lead.status === 'PENDING' && (
                                            <div className="lead-actions">
                                                <button
                                                    className={`btn-accept ${leadUsage.limitReached && !leadUsage.isUnlimited ? 'disabled' : ''}`}
                                                    onClick={() => handleAccept(lead)}
                                                    disabled={leadUsage.limitReached && !leadUsage.isUnlimited}
                                                    title={leadUsage.limitReached && !leadUsage.isUnlimited ? 'Monthly lead limit reached. Please upgrade your plan.' : ''}
                                                >
                                                    <i className="fas fa-check"></i> Accept
                                                </button>
                                                <button
                                                    className="btn-reject"
                                                    onClick={() => handleReject(lead)}
                                                >
                                                    <i className="fas fa-times"></i> Reject
                                                </button>
                                            </div>
                                        )}
                                        {lead.status === 'PAYMENT_PENDING' && (
                                            <div className="lead-payment-pending">
                                                <div>
                                                    <i className="fas fa-credit-card"></i>
                                                    <span>Proposal sent. Payment pending confirmation.</span>
                                                </div>
                                                <button
                                                    className="btn-complete-payment"
                                                    onClick={() => {
                                                        setSelectedLead(lead);
                                                        handleCompletePayment(lead);
                                                    }}
                                                >
                                                    <i className="fas fa-credit-card"></i>
                                                    Complete Payment
                                                </button>
                                            </div>
                                        )}
                                        {lead.status === 'ACCEPTED' && (
                                            <>
                                                {lead.proposalPaymentStatus === 'pending' || lead.proposalPaymentStatus === null ? (
                                                    <div className="lead-fee-completed-info">
                                                        <div className="fee-completed-header">
                                                            <i className="fas fa-check-circle"></i>
                                                            <span>Lead fee payment completed</span>
                                                        </div>
                                                        <div className="fee-completed-details">
                                                            <p>Waiting for customer to pay proposal price.</p>
                                                        </div>
                                                    </div>
                                                ) : lead.proposalPaymentStatus === 'succeeded' ? (
                                                    <div className="lead-accepted-info">
                                                        <div>
                                                            <i className="fas fa-check-circle"></i>
                                                            <span>Lead accepted. Customer accepted.</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="lead-accepted-info">
                                                        <div>
                                                            <i className="fas fa-check-circle"></i>
                                                            <span>Lead accepted. Proposal sent to customer.</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {pagination.pages > 1 && (
                        <div className="pagination">
                            <button
                                className="pagination-btn"
                                disabled={pagination.page === 1}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
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
                                disabled={pagination.page === pagination.pages}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                            >
                                Next
                                <i className="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Accept Modal */}
            {showAcceptModal && selectedLead && (
                <div className="modal-overlay" onClick={() => !submitting && setShowAcceptModal(false)}>
                    <div className="modal-content accept-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>
                                <i className="fas fa-check-circle"></i>
                                Accept Lead & Send Proposal
                            </h2>
                            <button
                                className="modal-close"
                                onClick={() => !submitting && setShowAcceptModal(false)}
                                disabled={submitting}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="lead-summary">
                                <h3>{selectedLead.serviceRequest?.projectTitle || 'Service Request'}</h3>
                                <p className="lead-category">
                                    {selectedLead.serviceRequest?.category?.name || 'N/A'}
                                    {selectedLead.serviceRequest?.subCategory &&
                                        ` - ${selectedLead.serviceRequest.subCategory.name}`
                                    }
                                </p>
                                <p className="lead-location">
                                    <i className="fas fa-map-marker-alt"></i>
                                    {selectedLead.serviceRequest?.zipCode || 'N/A'}
                                </p>
                            </div>

                            <div className="form-group">
                                <label htmlFor="proposal-description">
                                    Proposal Description <span className="required">*</span>
                                </label>
                                <textarea
                                    id="proposal-description"
                                    value={proposalData.description}
                                    onChange={(e) => setProposalData({ ...proposalData, description: e.target.value })}
                                    placeholder="Describe your proposal, services you'll provide, timeline, etc."
                                    rows={6}
                                    disabled={submitting}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="proposal-price">
                                    Price ($) <span className="required">*</span>
                                </label>
                                <input
                                    type="number"
                                    id="proposal-price"
                                    value={proposalData.price}
                                    onChange={(e) => setProposalData({ ...proposalData, price: e.target.value })}
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    disabled={submitting}
                                    required
                                />
                            </div>

                            {leadCost !== null && (
                                <div className="lead-cost-display">
                                    <div className="cost-row">
                                        <span className="cost-label">
                                            <i className="fas fa-dollar-sign"></i>
                                            Lead Cost:
                                        </span>
                                        <div className="cost-value-container">
                                            {selectedLead?.hasDiscount && selectedLead?.baseLeadCost ? (
                                                <>
                                                    <span className="cost-value discounted">${leadCost.toFixed(2)}</span>
                                                    <span className="original-cost">${parseFloat(selectedLead.baseLeadCost).toFixed(2)}</span>
                                                    <span className="discount-badge">{selectedLead.discountPercent}% off</span>
                                                </>
                                            ) : (
                                                <span className="cost-value">${leadCost.toFixed(2)}</span>
                                            )}
                                        </div>
                                    </div>
                                    {selectedLead?.hasDiscount && (
                                        <p className="cost-note savings-note">
                                            <i className="fas fa-check-circle"></i>
                                            You're saving ${(parseFloat(selectedLead.baseLeadCost) - leadCost).toFixed(2)} with your subscription!
                                        </p>
                                    )}
                                    {!selectedLead?.hasDiscount && (
                                        <p className="cost-note">
                                            This is the fee you'll pay to accept this lead. You'll be redirected to complete payment after submitting.
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="modal-info">
                                <i className="fas fa-info-circle"></i>
                                <p>This proposal will be sent to the customer and you'll receive a confirmation email.</p>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn-primary"
                                onClick={handleConfirmAccept}
                                disabled={submitting || !proposalData.description.trim() || !proposalData.price || parseFloat(proposalData.price) <= 0}
                            >
                                {submitting ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin"></i> Sending...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-check"></i> Confirm & Send Proposal
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && selectedLead && (
                <div className="modal-overlay" onClick={() => !submitting && setShowRejectModal(false)}>
                    <div className="modal-content reject-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>
                                <i className="fas fa-times-circle"></i>
                                Reject Lead
                            </h2>
                            <button
                                className="modal-close"
                                onClick={() => !submitting && setShowRejectModal(false)}
                                disabled={submitting}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="lead-summary">
                                <h3>{selectedLead.serviceRequest?.projectTitle || 'Service Request'}</h3>
                                <p className="lead-category">
                                    {selectedLead.serviceRequest?.category?.name || 'N/A'}
                                </p>
                            </div>

                            <div className="form-group">
                                <label htmlFor="rejection-reason">
                                    Rejection Reason <span style={{ color: '#dc3545' }}>*</span>
                                </label>
                                <select
                                    id="rejection-reason"
                                    value={rejectionReason}
                                    onChange={(e) => {
                                        setRejectionReason(e.target.value);
                                        if (e.target.value !== 'OTHER') {
                                            setRejectionReasonOther('');
                                        }
                                    }}
                                    disabled={submitting}
                                    required
                                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}
                                >
                                    <option value="">-- Select a reason --</option>
                                    <option value="TOO_FAR">Too Far</option>
                                    <option value="TOO_EXPENSIVE">Too Expensive</option>
                                    <option value="NOT_RELEVANT">Not Relevant Service Request</option>
                                    <option value="OTHER">Other (Describe)</option>
                                </select>
                            </div>

                            {rejectionReason === 'OTHER' && (
                                <div className="form-group">
                                    <label htmlFor="rejection-reason-other">
                                        Please describe the reason <span style={{ color: '#dc3545' }}>*</span>
                                    </label>
                                    <textarea
                                        id="rejection-reason-other"
                                        value={rejectionReasonOther}
                                        onChange={(e) => setRejectionReasonOther(e.target.value)}
                                        placeholder="Please provide details about why you are rejecting this lead..."
                                        rows={4}
                                        disabled={submitting}
                                        required
                                        style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}
                                    />
                                </div>
                            )}

                            <div className="modal-warning">
                                <i className="fas fa-exclamation-triangle"></i>
                                <p>Are you sure you want to reject this lead? The customer will be notified.</p>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn-danger"
                                onClick={handleConfirmReject}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin"></i> Rejecting...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-times"></i> Confirm Rejection
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Provider Payment Modal */}
            {showPaymentModal && selectedLead && (
                <ProviderPaymentModal
                    show={showPaymentModal}
                    onClose={handlePaymentClose}
                    lead={selectedLead}
                    leadCost={paymentData.leadCost}
                    clientSecret={paymentData.clientSecret}
                    paymentIntentId={paymentData.paymentIntentId}
                    onSuccess={handlePaymentSuccess}
                />
            )}
        </div>
    );
};

export default ProviderLeads;


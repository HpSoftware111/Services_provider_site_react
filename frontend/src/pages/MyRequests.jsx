import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import PaymentModal from '../components/PaymentModal';
import ReviewForm from '../components/ReviewForm';
import './MyRequests.css';

const MyRequests = () => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 10,
        total: 0,
        pages: 0
    });
    const [message, setMessage] = useState({ type: '', text: '' });
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [modalLoading, setModalLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedProposal, setSelectedProposal] = useState(null);
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [reviewStatus, setReviewStatus] = useState(null);
    const [refreshInterval, setRefreshInterval] = useState(null);
    const [showRejectProposalModal, setShowRejectProposalModal] = useState(false);
    const [selectedProposalForReject, setSelectedProposalForReject] = useState(null);
    const [proposalRejectionReason, setProposalRejectionReason] = useState('');
    const [proposalRejectionReasonOther, setProposalRejectionReasonOther] = useState('');
    const [showCancelRequestModal, setShowCancelRequestModal] = useState(false);
    const [cancelRejectionReason, setCancelRejectionReason] = useState('');
    const [cancelRejectionReasonOther, setCancelRejectionReasonOther] = useState('');

    useEffect(() => {
        loadRequests();

        // Cleanup on unmount
        return () => {
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
        };
    }, [statusFilter, pagination.page]);

    // Auto-refresh request details when modal is open and status is LEAD_ASSIGNED
    useEffect(() => {
        if (showModal && selectedRequest && selectedRequest.status === 'LEAD_ASSIGNED') {
            // Refresh request details every 10 seconds to check for new proposals
            const interval = setInterval(async () => {
                if (selectedRequest?.id) {
                    try {
                        const response = await api.get(`/service-requests/my/service-requests/${selectedRequest.id}`);
                        if (response.data.success) {
                            const data = response.data.data;
                            // Ensure proposals is an array
                            if (!Array.isArray(data.proposals)) {
                                data.proposals = [];
                            }
                            setSelectedRequest(data);
                        }
                    } catch (err) {
                        console.error('Error refreshing request details:', err);
                    }
                }
            }, 10000); // Refresh every 10 seconds

            setRefreshInterval(interval);

            return () => {
                clearInterval(interval);
            };
        } else {
            if (refreshInterval) {
                clearInterval(refreshInterval);
                setRefreshInterval(null);
            }
        }
    }, [showModal, selectedRequest?.id, selectedRequest?.status]);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                pageSize: pagination.pageSize.toString()
            });

            if (statusFilter !== 'ALL') {
                params.append('status', statusFilter);
            }

            const response = await api.get(`/service-requests/my/service-requests?${params.toString()}`);

            if (response.data.success) {
                // Display all requests including COMPLETED and CLOSED
                // Backend handles filtering based on status filter
                setRequests(response.data.data || []);
                setPagination(prev => ({
                    ...prev,
                    total: response.data.pagination?.total || 0,
                    pages: response.data.pagination?.pages || 0
                }));
            }
        } catch (error) {
            console.error('Error loading requests:', error);
            setMessage({
                type: 'error',
                text: error.response?.data?.error || 'Failed to load service requests'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleStatusFilterChange = (e) => {
        setStatusFilter(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handlePageChange = (newPage) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    const getStatusBadgeClass = (status) => {
        const statusClasses = {
            'REQUEST_CREATED': 'status-pending',
            'LEAD_ASSIGNED': 'status-assigned',
            'IN_PROGRESS': 'status-progress',
            'COMPLETED': 'status-completed',
            'APPROVED': 'status-approved',
            'CLOSED': 'status-closed'
        };
        return statusClasses[status] || 'status-default';
    };

    const getStatusLabel = (status) => {
        const statusLabels = {
            'REQUEST_CREATED': 'Pending',
            'LEAD_ASSIGNED': 'Lead Assigned',
            'IN_PROGRESS': 'In Progress',
            'COMPLETED': 'Completed',
            'APPROVED': 'Approved',
            'CLOSED': 'Closed'
        };
        return statusLabels[status] || status;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const handleViewDetails = async (requestId) => {
        setShowModal(true);
        setModalLoading(true);
        setSelectedRequest(null);
        setMessage({ type: '', text: '' }); // Clear any previous messages
        setReviewStatus(null);
        setShowReviewForm(false);

        try {
            const response = await api.get(`/service-requests/my/service-requests/${requestId}`);
            if (response.data.success) {
                // Ensure attachments and selectedBusinessIds are arrays
                const data = response.data.data;
                if (data.attachments && typeof data.attachments === 'string') {
                    try {
                        data.attachments = JSON.parse(data.attachments);
                    } catch (e) {
                        data.attachments = [];
                    }
                }
                if (!Array.isArray(data.attachments)) {
                    data.attachments = [];
                }
                if (data.selectedBusinessIds && typeof data.selectedBusinessIds === 'string') {
                    try {
                        data.selectedBusinessIds = JSON.parse(data.selectedBusinessIds);
                    } catch (e) {
                        data.selectedBusinessIds = [];
                    }
                }
                if (!Array.isArray(data.selectedBusinessIds)) {
                    data.selectedBusinessIds = [];
                }

                // Ensure proposals is an array
                if (!Array.isArray(data.proposals)) {
                    data.proposals = [];
                }

                // Log proposals for debugging
                console.log('[Frontend] Request details loaded:', {
                    requestId: data.id,
                    status: data.status,
                    proposalsCount: data.proposals?.length || 0,
                    proposals: data.proposals?.map(p => ({
                        id: p.id,
                        price: p.price,
                        details: p.details ? p.details.substring(0, 50) + '...' : 'EMPTY',
                        status: p.status,
                        hasProvider: !!p.provider
                    }))
                });

                // Show notification if new proposals are available
                if (data.proposals && data.proposals.length > 0 && selectedRequest) {
                    const previousProposalCount = selectedRequest.proposals?.length || 0;
                    if (data.proposals.length > previousProposalCount) {
                        setMessage({
                            type: 'success',
                            text: `New proposal${data.proposals.length - previousProposalCount > 1 ? 's' : ''} received!`
                        });
                    }
                }

                setSelectedRequest(data);

                // Check review status if request is APPROVED or CLOSED
                if (data.status === 'APPROVED' || data.status === 'CLOSED') {
                    try {
                        console.log('[MyRequests] Checking review status for request:', requestId, 'status:', data.status);
                        const reviewStatusResponse = await api.get(
                            `/service-requests/my/service-requests/${requestId}/review-status`
                        );
                        console.log('[MyRequests] Review status response:', reviewStatusResponse.data);
                        if (reviewStatusResponse.data.success) {
                            setReviewStatus(reviewStatusResponse.data.data);
                            console.log('[MyRequests] Review status set:', reviewStatusResponse.data.data);
                            // Auto-show review form if can review and no review exists
                            if (reviewStatusResponse.data.data.canReview && !reviewStatusResponse.data.data.hasReview) {
                                setShowReviewForm(true);
                            }
                        } else {
                            console.warn('[MyRequests] Review status check returned success=false:', reviewStatusResponse.data);
                            // Still set reviewStatus to show the section, but with canReview=false
                            setReviewStatus({
                                canReview: false,
                                hasReview: false,
                                review: null,
                                serviceRequestStatus: data.status
                            });
                        }
                    } catch (err) {
                        // Review status check failed, log error but still show the section
                        console.error('[MyRequests] Review status check failed:', err);
                        console.error('[MyRequests] Error details:', err.response?.data);
                        // Set a default reviewStatus so the section can still render
                        setReviewStatus({
                            canReview: data.status === 'APPROVED', // Allow review if status is APPROVED
                            hasReview: false,
                            review: null,
                            serviceRequestStatus: data.status
                        });
                    }
                } else {
                    // Clear review status if status is not APPROVED or CLOSED
                    setReviewStatus(null);
                }
            } else {
                setMessage({
                    type: 'error',
                    text: response.data.error || 'Failed to load request details'
                });
                setShowModal(false);
            }
        } catch (error) {
            console.error('Error loading request details:', error);
            setMessage({
                type: 'error',
                text: error.response?.data?.error || 'Failed to load request details'
            });
            setShowModal(false);
        } finally {
            setModalLoading(false);
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedRequest(null);
    };

    const handleAcceptProposal = (proposal) => {
        setSelectedProposal(proposal);
        setShowPaymentModal(true);
    };

    const handleRejectProposal = (proposal) => {
        setSelectedProposalForReject(proposal);
        setProposalRejectionReason('');
        setProposalRejectionReasonOther('');
        setShowRejectProposalModal(true);
    };

    const handleConfirmRejectProposal = async () => {
        if (!selectedProposalForReject) return;

        // Validate rejection reason
        if (!proposalRejectionReason) {
            setMessage({
                type: 'error',
                text: 'Please select a rejection reason'
            });
            return;
        }

        if (proposalRejectionReason === 'OTHER' && !proposalRejectionReasonOther.trim()) {
            setMessage({
                type: 'error',
                text: 'Please provide a description when selecting "Other" as the rejection reason'
            });
            return;
        }

        try {
            const response = await api.patch(
                `/service-requests/my/service-requests/${selectedRequest.id}/proposals/${selectedProposalForReject.id}/reject`,
                {
                    rejectionReason: proposalRejectionReason,
                    rejectionReasonOther: proposalRejectionReason === 'OTHER' ? proposalRejectionReasonOther : null
                }
            );

            if (response.data.success) {
                setMessage({
                    type: 'success',
                    text: 'Proposal rejected successfully'
                });

                // Close rejection modal
                setShowRejectProposalModal(false);
                setSelectedProposalForReject(null);
                setProposalRejectionReason('');
                setProposalRejectionReasonOther('');

                // Force a fresh reload by clearing selectedRequest first
                const requestId = selectedRequest.id;
                setSelectedRequest(null);

                // Small delay to ensure backend has processed the update
                await new Promise(resolve => setTimeout(resolve, 300));

                // Reload request details to show updated proposal status (keep modal open)
                await handleViewDetails(requestId);

                // Also reload the main requests list to keep it in sync
                loadRequests();
            } else {
                setMessage({
                    type: 'error',
                    text: response.data.error || 'Failed to reject proposal'
                });
            }
        } catch (error) {
            console.error('Error rejecting proposal:', error);
            setMessage({
                type: 'error',
                text: error.response?.data?.error || 'Failed to reject proposal'
            });
        }
    };

    const handleApproveWork = async () => {
        if (!selectedRequest) return;

        if (!window.confirm('Are you sure you want to approve this completed work? This will allow you to leave a review.')) {
            return;
        }

        try {
            setMessage({ type: '', text: '' });
            const response = await api.patch(
                `/service-requests/my/service-requests/${selectedRequest.id}/approve`
            );

            if (response.data.success) {
                setMessage({
                    type: 'success',
                    text: response.data.message || 'Work approved successfully! You can now leave a review.'
                });
                // Reload request details to show updated status (keep modal open)
                await handleViewDetails(selectedRequest.id);
                // Also reload the main requests list to keep it in sync
                loadRequests();
                setTimeout(() => setMessage({ type: '', text: '' }), 5000);
            } else {
                setMessage({
                    type: 'error',
                    text: response.data.error || 'Failed to approve work'
                });
            }
        } catch (error) {
            console.error('Error approving work:', error);
            setMessage({
                type: 'error',
                text: error.response?.data?.error || 'Failed to approve work'
            });
        }
    };

    const handleCancelRequest = () => {
        if (!selectedRequest) return;
        setCancelRejectionReason('');
        setCancelRejectionReasonOther('');
        setShowCancelRequestModal(true);
    };

    const handleConfirmCancelRequest = async () => {
        if (!selectedRequest) return;

        // Rejection reason is optional for cancellation, but if provided, validate it
        if (cancelRejectionReason) {
            if (cancelRejectionReason === 'OTHER' && !cancelRejectionReasonOther.trim()) {
                setMessage({
                    type: 'error',
                    text: 'Please provide a description when selecting "Other" as the rejection reason'
                });
            return;
            }
        }

        try {
            setMessage({ type: '', text: '' });
            const response = await api.patch(
                `/service-requests/my/service-requests/${selectedRequest.id}/cancel`,
                {
                    rejectionReason: cancelRejectionReason || null,
                    rejectionReasonOther: cancelRejectionReason === 'OTHER' ? cancelRejectionReasonOther : null
                }
            );

            if (response.data.success) {
                setMessage({
                    type: 'success',
                    text: response.data.message || 'Service request cancelled successfully'
                });

                // Close modal
                closeModal();

                // If request is in PENDING status, remove it from the list instead of reloading
                if (selectedRequest.status === 'REQUEST_CREATED') {
                    // Remove the cancelled request from the list
                    setRequests(prevRequests =>
                        prevRequests.filter(req => req.id !== selectedRequest.id)
                    );

                    // Update pagination total count
                    setPagination(prev => ({
                        ...prev,
                        total: Math.max(0, prev.total - 1)
                    }));
                } else {
                    // For other statuses, reload the list to show updated status
                    loadRequests();
                }

                setTimeout(() => setMessage({ type: '', text: '' }), 5000);
            } else {
                setMessage({
                    type: 'error',
                    text: response.data.error || 'Failed to cancel request'
                });
            }
        } catch (error) {
            console.error('Error cancelling request:', error);
            setMessage({
                type: 'error',
                text: error.response?.data?.error || 'Failed to cancel request'
            });
        }
    };

    const handlePaymentSuccess = async (data) => {
        setMessage({
            type: 'success',
            text: 'Proposal accepted! Payment successful. Work has started.'
        });

        // Close payment modal first
        setShowPaymentModal(false);
        setSelectedProposal(null);

        // Small delay to ensure backend has processed the update
        await new Promise(resolve => setTimeout(resolve, 500));

        // Reload the main requests list to update status badges (shows "In Progress" instead of "Lead Assigned")
        await loadRequests();

        // Reload the request details to show updated status (keep detail modal open)
        // This will show: 
        // - Service request status changed from "LEAD_ASSIGNED" to "IN_PROGRESS" 
        // - Proposal status changed from "SENT" to "ACCEPTED"
        // - Primary provider assigned
        // - Accept/Reject buttons removed (since proposal is now accepted)
        if (selectedRequest && selectedRequest.id) {
            await handleViewDetails(selectedRequest.id);
        }

        // Detail modal stays open so user can see the updated status immediately
    };

    const formatDateTime = (dateString, timeString) => {
        if (!dateString) return 'Not specified';
        const date = new Date(dateString);
        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        return timeString ? `${formattedDate} - ${timeString}` : formattedDate;
    };

    return (
        <div className="my-requests-page">
            <div className="page-header">
                <h1>
                    <i className="fas fa-clipboard-list"></i>
                    My Service Requests
                </h1>
                <p>View and manage all your service requests</p>
            </div>

            {message.text && (
                <div className={`alert alert-${message.type}`}>
                    <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i>
                    <span>{message.text}</span>
                    <button onClick={() => setMessage({ type: '', text: '' })} className="alert-close">
                        <i className="fas fa-times"></i>
                    </button>
                </div>
            )}

            {/* Filters */}
            <div className="filters-section">
                <div className="filter-group">
                    <label htmlFor="statusFilter">
                        <i className="fas fa-filter"></i>
                        Filter by Status
                    </label>
                    <div className="select-wrapper">
                        <select
                            id="statusFilter"
                            value={statusFilter}
                            onChange={handleStatusFilterChange}
                            className="filter-select"
                        >
                            <option value="ALL">All Requests</option>
                            <option value="REQUEST_CREATED">Pending</option>
                            <option value="LEAD_ASSIGNED">Lead Assigned</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="APPROVED">Approved</option>
                            <option value="CLOSED">Closed</option>
                        </select>
                        <i className="fas fa-chevron-down select-arrow"></i>
                    </div>
                </div>
            </div>

            {/* Requests List */}
            {loading ? (
                <div className="loading-container">
                    <i className="fas fa-spinner fa-spin"></i>
                    <p>Loading requests...</p>
                </div>
            ) : requests.length === 0 ? (
                <div className="empty-state">
                    <i className="fas fa-inbox"></i>
                    <h3>No Service Requests Found</h3>
                    <p>
                        {statusFilter === 'ALL'
                            ? "You haven't created any service requests yet."
                            : `No requests found with status: ${getStatusLabel(statusFilter)}`
                        }
                    </p>
                    <button
                        className="btn-primary"
                        onClick={() => navigate('/service-request')}
                    >
                        <i className="fas fa-plus"></i>
                        Create New Request
                    </button>
                </div>
            ) : (
                <>
                    <div className="requests-table-container">
                        <table className="requests-table">
                            <thead>
                                <tr>
                                    <th>Project Title</th>
                                    <th>Category</th>
                                    <th>Sub-Category</th>
                                    <th>Zip Code</th>
                                    <th>Status</th>
                                    <th>Created Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map((request) => (
                                    <tr key={request.id}>
                                        <td className="project-title-cell">
                                            <strong>{request.projectTitle}</strong>
                                        </td>
                                        <td>
                                            <span className="category-badge">
                                                {request.categoryName}
                                            </span>
                                        </td>
                                        <td>
                                            {request.subCategoryName || (
                                                <span className="text-muted">N/A</span>
                                            )}
                                        </td>
                                        <td>{request.zipCode}</td>
                                        <td>
                                            <span className={`status-badge ${getStatusBadgeClass(request.status)}`}>
                                                {getStatusLabel(request.status)}
                                            </span>
                                        </td>
                                        <td>{formatDate(request.createdAt)}</td>
                                        <td>
                                            <button
                                                className="btn-view"
                                                onClick={() => handleViewDetails(request.id)}
                                                title="View Details"
                                            >
                                                <i className="fas fa-eye"></i>
                                                View Details
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

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
                            <div className="pagination-info">
                                Page {pagination.page} of {pagination.pages}
                                <span className="pagination-total">({pagination.total} total)</span>
                            </div>
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
                </>
            )}

            {/* Request Detail Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content request-detail-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>
                                <i className="fas fa-clipboard-list"></i>
                                Request Details
                            </h2>
                            <button className="modal-close" onClick={closeModal}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <div className="modal-body">
                            {modalLoading ? (
                                <div className="modal-loading">
                                    <i className="fas fa-spinner fa-spin"></i>
                                    <p>Loading details...</p>
                                </div>
                            ) : selectedRequest && selectedRequest.id ? (
                                <div className="request-detail-content">
                                    {/* Project Info */}
                                    <div className="detail-section">
                                        <h3>
                                            <i className="fas fa-project-diagram"></i>
                                            Project Information
                                        </h3>
                                        <div className="detail-grid">
                                            <div className="detail-item">
                                                <label>Project Title</label>
                                                <p>{selectedRequest.projectTitle}</p>
                                            </div>
                                            <div className="detail-item">
                                                <label>Description</label>
                                                <p>{selectedRequest.projectDescription}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Service Details */}
                                    <div className="detail-section">
                                        <h3>
                                            <i className="fas fa-tools"></i>
                                            Service Details
                                        </h3>
                                        <div className="detail-grid">
                                            <div className="detail-item">
                                                <label>Category</label>
                                                <p>{selectedRequest.categoryName || 'N/A'}</p>
                                            </div>
                                            <div className="detail-item">
                                                <label>Sub-Category</label>
                                                <p>{selectedRequest.subCategoryName || 'Not specified'}</p>
                                            </div>
                                            <div className="detail-item">
                                                <label>Zip Code</label>
                                                <p>{selectedRequest.zipCode}</p>
                                            </div>
                                            <div className="detail-item">
                                                <label>Status</label>
                                                <span className={`status-badge ${getStatusBadgeClass(selectedRequest.status)}`}>
                                                    {getStatusLabel(selectedRequest.status)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Preferred Date/Time */}
                                    <div className="detail-section">
                                        <h3>
                                            <i className="fas fa-calendar-alt"></i>
                                            Preferred Schedule
                                        </h3>
                                        <div className="detail-grid">
                                            <div className="detail-item">
                                                <label>Preferred Date & Time</label>
                                                <p>{formatDateTime(selectedRequest.preferredDate, selectedRequest.preferredTime)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Attachments */}
                                    {selectedRequest.attachments && Array.isArray(selectedRequest.attachments) && selectedRequest.attachments.length > 0 && (
                                        <div className="detail-section">
                                            <h3>
                                                <i className="fas fa-paperclip"></i>
                                                Attachments ({selectedRequest.attachments.length})
                                            </h3>
                                            <div className="attachments-grid">
                                                {selectedRequest.attachments.map((attachment, index) => {
                                                    // Handle both object format {name, data} and string format
                                                    const attachmentData = typeof attachment === 'object' ? attachment : { name: `Attachment ${index + 1}`, data: attachment };
                                                    return (
                                                        <div key={index} className="attachment-item">
                                                            {attachmentData.data && typeof attachmentData.data === 'string' && attachmentData.data.startsWith('data:image') ? (
                                                                <img
                                                                    src={attachmentData.data}
                                                                    alt={attachmentData.name || `Attachment ${index + 1}`}
                                                                    className="attachment-image"
                                                                    onError={(e) => {
                                                                        e.target.style.display = 'none';
                                                                        e.target.nextSibling.style.display = 'flex';
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="attachment-file">
                                                                    <i className="fas fa-file"></i>
                                                                    <span>{attachmentData.name || `Attachment ${index + 1}`}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}


                                    {/* Proposals - Always show proposal details */}
                                    {selectedRequest.proposals && Array.isArray(selectedRequest.proposals) && selectedRequest.proposals.length > 0 ? (
                                        <div className="detail-section">
                                            <h3>
                                                <i className="fas fa-file-contract"></i>
                                                Proposals Received ({selectedRequest.proposals.length})
                                            </h3>
                                            <div className="proposals-list">
                                                {selectedRequest.proposals.map((proposal, index) => {
                                                    // Ensure price is a number
                                                    const proposalPrice = proposal.price ?
                                                        (typeof proposal.price === 'string' ? parseFloat(proposal.price) : parseFloat(proposal.price)) :
                                                        0;

                                                    console.log(`[Frontend] Rendering proposal ${proposal.id || index}:`, {
                                                        id: proposal.id,
                                                        price: proposalPrice,
                                                        priceType: typeof proposalPrice,
                                                        details: proposal.details ? `${proposal.details.substring(0, 30)}...` : 'EMPTY',
                                                        status: proposal.status
                                                    });

                                                    return (
                                                        <div key={proposal.id || index} className="proposal-card">
                                                            <div className="proposal-header">
                                                                <div className="proposal-header-top">
                                                                    <h4>
                                                                        {proposal.provider?.name || 'Provider'}
                                                                        <span className={`proposal-status ${(proposal.status || 'SENT').toLowerCase()}`}>
                                                                            {proposal.status || 'SENT'}
                                                                        </span>
                                                                    </h4>
                                                                    <div className="proposal-price">
                                                                        {proposalPrice > 0 && !isNaN(proposalPrice) ? (
                                                                            `$${proposalPrice.toFixed(2)}`
                                                                        ) : (
                                                                            <span style={{ color: '#9ca3af', fontSize: '14px' }}>Price not specified</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="proposal-details">
                                                                <label className="proposal-details-label">
                                                                    <i className="fas fa-file-alt"></i>
                                                                    Proposal Description:
                                                                </label>
                                                                {proposal.details && proposal.details.trim() ? (
                                                                    <p>{proposal.details}</p>
                                                                ) : (
                                                                    <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No description provided</p>
                                                                )}
                                                            </div>
                                                            <div className="proposal-meta">
                                                                {proposal.createdAt && (
                                                                    <span><i className="fas fa-calendar"></i> {formatDate(proposal.createdAt)}</span>
                                                                )}
                                                                {/* Only show provider contact info after proposal is accepted */}
                                                                {proposal.status === 'ACCEPTED' && proposal.provider?.email && (
                                                                    <span><i className="fas fa-envelope"></i> {proposal.provider.email}</span>
                                                                )}
                                                                {proposal.status === 'ACCEPTED' && proposal.provider?.phone && (
                                                                    <span><i className="fas fa-phone"></i> {proposal.provider.phone}</span>
                                                                )}
                                                            </div>
                                                            {/* Show Accept/Reject buttons for SENT proposals when status allows */}
                                                            {(proposal.status === 'SENT' || !proposal.status) && selectedRequest.status !== 'IN_PROGRESS' && selectedRequest.status !== 'COMPLETED' && selectedRequest.status !== 'APPROVED' && (
                                                                <div className="proposal-actions">
                                                                    <button
                                                                        className="btn-accept"
                                                                        onClick={() => handleAcceptProposal(proposal)}
                                                                    >
                                                                        <i className="fas fa-check-circle"></i>
                                                                        Accept & Pay
                                                                    </button>
                                                                    <button
                                                                        className="btn-reject"
                                                                        onClick={() => handleRejectProposal(proposal)}
                                                                    >
                                                                        <i className="fas fa-times-circle"></i>
                                                                        Reject
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {/* Show status message for accepted/rejected proposals */}
                                                            {proposal.status === 'ACCEPTED' && (
                                                                <div className="proposal-status-message accepted">
                                                                    <i className="fas fa-check-circle"></i>
                                                                    <span>This proposal has been accepted</span>
                                                                </div>
                                                            )}
                                                            {proposal.status === 'REJECTED' && (
                                                                <div className="proposal-status-message rejected">
                                                                    <i className="fas fa-times-circle"></i>
                                                                    <span>This proposal has been rejected</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : selectedRequest.status === 'LEAD_ASSIGNED' && (
                                        <div className="detail-section">
                                            <h3>
                                                <i className="fas fa-file-contract"></i>
                                                Proposals
                                            </h3>
                                            <div className="no-proposals-message">
                                                <i className="fas fa-clock"></i>
                                                <p>Waiting for provider proposal...</p>
                                                <p className="proposal-waiting-note">
                                                    A provider has been assigned and is preparing their proposal.
                                                    You'll receive a notification when the proposal is ready.
                                                </p>
                                                <button
                                                    className="btn-refresh-proposals"
                                                    onClick={async () => {
                                                        if (selectedRequest?.id) {
                                                            setModalLoading(true);
                                                            try {
                                                                const response = await api.get(`/service-requests/my/service-requests/${selectedRequest.id}`);
                                                                if (response.data.success) {
                                                                    const data = response.data.data;
                                                                    if (!Array.isArray(data.proposals)) {
                                                                        data.proposals = [];
                                                                    }
                                                                    setSelectedRequest(data);
                                                                    if (data.proposals && data.proposals.length > 0) {
                                                                        setMessage({ type: 'success', text: 'New proposal received!' });
                                                                    }
                                                                }
                                                            } catch (err) {
                                                                console.error('Error refreshing proposals:', err);
                                                            } finally {
                                                                setModalLoading(false);
                                                            }
                                                        }
                                                    }}
                                                    disabled={modalLoading}
                                                >
                                                    <i className={`fas fa-sync-alt ${modalLoading ? 'fa-spin' : ''}`}></i>
                                                    {modalLoading ? 'Refreshing...' : 'Refresh Proposals'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Rejected Leads */}
                                    {selectedRequest.rejectedLeads && selectedRequest.rejectedLeads.length > 0 && (
                                        <div className="detail-section">
                                            <h3>
                                                <i className="fas fa-times-circle"></i>
                                                Declined Providers ({selectedRequest.rejectedLeads.length})
                                            </h3>
                                            <div className="rejected-leads-list">
                                                {selectedRequest.rejectedLeads.map((lead, index) => (
                                                    <div key={index} className="rejected-lead-card">
                                                        <div className="rejected-lead-info">
                                                            <h4>
                                                                {lead.provider?.name || lead.business?.name || 'Provider'}
                                                                <span className="rejected-badge">Declined</span>
                                                            </h4>
                                                            {lead.business && (
                                                                <p><i className="fas fa-building"></i> {lead.business.name}</p>
                                                            )}
                                                            {lead.rejectedAt && (
                                                                <p className="rejected-date">
                                                                    <i className="fas fa-clock"></i> Declined on {formatDate(lead.rejectedAt)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Alternative Providers */}
                                    {selectedRequest.alternativeProviders && selectedRequest.alternativeProviders.length > 0 && (
                                        <div className="detail-section">
                                            <h3>
                                                <i className="fas fa-users"></i>
                                                Alternative Providers ({selectedRequest.alternativeProviders.length})
                                            </h3>
                                            <div className="providers-list">
                                                {selectedRequest.alternativeProviders.map((provider, index) => {
                                                    // Check if this provider has an accepted proposal
                                                    const hasAcceptedProposal = selectedRequest.proposals?.some(
                                                        p => p.provider?.id === provider.id && p.status === 'ACCEPTED'
                                                    );

                                                    return (
                                                    <div key={index} className="provider-card">
                                                        <div className="provider-info">
                                                            <h4>{provider.name}</h4>
                                                                {/* Only show contact info if provider has an accepted proposal */}
                                                                {hasAcceptedProposal && provider.email && (
                                                                <p><i className="fas fa-envelope"></i> {provider.email}</p>
                                                            )}
                                                                {hasAcceptedProposal && provider.phone && (
                                                                <p><i className="fas fa-phone"></i> {provider.phone}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Timestamps */}
                                    <div className="detail-section">
                                        <h3>
                                            <i className="fas fa-clock"></i>
                                            Timeline
                                        </h3>
                                        <div className="detail-grid">
                                            <div className="detail-item">
                                                <label>Created</label>
                                                <p>{formatDate(selectedRequest.createdAt)}</p>
                                            </div>
                                            {selectedRequest.updatedAt && (
                                                <div className="detail-item">
                                                    <label>Last Updated</label>
                                                    <p>{formatDate(selectedRequest.updatedAt)}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Workflow Progress Indicator */}
                                    {selectedRequest.status === 'IN_PROGRESS' ||
                                        selectedRequest.status === 'COMPLETED' ||
                                        selectedRequest.status === 'APPROVED' ||
                                        selectedRequest.status === 'CLOSED' ? (
                                        <div className="detail-section workflow-section">
                                            <h3>
                                                <i className="fas fa-tasks"></i>
                                                Workflow Progress
                                            </h3>
                                            <div className="workflow-steps">
                                                {/* Step 1: Payment Complete */}
                                                <div className={`workflow-step ${selectedRequest.status !== 'REQUEST_CREATED' && selectedRequest.status !== 'LEAD_ASSIGNED' ? 'completed' : ''}`}>
                                                    <div className="step-icon">
                                                        <i className="fas fa-check-circle"></i>
                                                    </div>
                                                    <div className="step-content">
                                                        <h4>Payment Complete</h4>
                                                        <p>Proposal accepted and payment processed</p>
                                                    </div>
                                                </div>

                                                {/* Step 2: Work In Progress */}
                                                <div className={`workflow-step ${selectedRequest.status === 'IN_PROGRESS' ? 'active' : selectedRequest.status !== 'REQUEST_CREATED' && selectedRequest.status !== 'LEAD_ASSIGNED' && selectedRequest.status !== 'IN_PROGRESS' ? 'completed' : ''}`}>
                                                    <div className="step-icon">
                                                        {selectedRequest.status === 'IN_PROGRESS' ? (
                                                            <i className="fas fa-spinner fa-spin"></i>
                                                        ) : selectedRequest.status !== 'REQUEST_CREATED' && selectedRequest.status !== 'LEAD_ASSIGNED' ? (
                                                            <i className="fas fa-check-circle"></i>
                                                        ) : (
                                                            <i className="fas fa-circle"></i>
                                                        )}
                                                    </div>
                                                    <div className="step-content">
                                                        <h4>Work In Progress</h4>
                                                        <p>Provider is working on your project</p>
                                                    </div>
                                                </div>

                                                {/* Step 3: Work Completed */}
                                                <div className={`workflow-step ${selectedRequest.status === 'COMPLETED' ? 'active' : selectedRequest.status === 'APPROVED' || selectedRequest.status === 'CLOSED' ? 'completed' : ''}`}>
                                                    <div className="step-icon">
                                                        {selectedRequest.status === 'COMPLETED' ? (
                                                            <i className="fas fa-check-circle"></i>
                                                        ) : selectedRequest.status === 'APPROVED' || selectedRequest.status === 'CLOSED' ? (
                                                            <i className="fas fa-check-circle"></i>
                                                        ) : (
                                                            <i className="fas fa-circle"></i>
                                                        )}
                                                    </div>
                                                    <div className="step-content">
                                                        <h4>Work Completed</h4>
                                                        <p>Provider has marked work as complete</p>
                                                    </div>
                                                </div>

                                                {/* Step 4: Approve Work */}
                                                <div className={`workflow-step ${selectedRequest.status === 'APPROVED' || selectedRequest.status === 'CLOSED' ? 'completed' : selectedRequest.status === 'COMPLETED' ? 'active' : ''}`}>
                                                    <div className="step-icon">
                                                        {selectedRequest.status === 'APPROVED' || selectedRequest.status === 'CLOSED' ? (
                                                            <i className="fas fa-check-circle"></i>
                                                        ) : selectedRequest.status === 'COMPLETED' ? (
                                                            <i className="fas fa-exclamation-circle"></i>
                                                        ) : (
                                                            <i className="fas fa-circle"></i>
                                                        )}
                                                    </div>
                                                    <div className="step-content">
                                                        <h4>Approve Work</h4>
                                                        <p>Review and approve completed work</p>
                                                    </div>
                                                </div>

                                                {/* Step 5: Leave Review */}
                                                <div className={`workflow-step ${selectedRequest.status === 'CLOSED' ? 'completed' : selectedRequest.status === 'APPROVED' ? 'active' : ''}`}>
                                                    <div className="step-icon">
                                                        {selectedRequest.status === 'CLOSED' ? (
                                                            <i className="fas fa-check-circle"></i>
                                                        ) : selectedRequest.status === 'APPROVED' ? (
                                                            <i className="fas fa-star"></i>
                                                        ) : (
                                                            <i className="fas fa-circle"></i>
                                                        )}
                                                    </div>
                                                    <div className="step-content">
                                                        <h4>Leave Review</h4>
                                                        <p>Share your experience with the provider</p>
                                                    </div>
                                                </div>

                                                {/* Step 6: Complete */}
                                                <div className={`workflow-step ${selectedRequest.status === 'CLOSED' ? 'completed' : ''}`}>
                                                    <div className="step-icon">
                                                        {selectedRequest.status === 'CLOSED' ? (
                                                            <i className="fas fa-check-circle"></i>
                                                        ) : (
                                                            <i className="fas fa-circle"></i>
                                                        )}
                                                    </div>
                                                    <div className="step-content">
                                                        <h4>Complete</h4>
                                                        <p>Service request closed</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}

                                    {/* Approval Action */}
                                    {selectedRequest.status === 'COMPLETED' && (
                                        <div className="detail-section approval-section">
                                            <div className="approval-notice">
                                                <i className="fas fa-check-circle"></i>
                                                <div>
                                                    <h4>Work Completed</h4>
                                                    <p>The provider has marked this work as completed. Please review and approve if you're satisfied.</p>
                                                </div>
                                            </div>
                                            <button
                                                className="btn-approve-work"
                                                onClick={handleApproveWork}
                                            >
                                                <i className="fas fa-check-double"></i>
                                                Approve Work
                                            </button>
                                        </div>
                                    )}

                                    {/* Payout Information (for approved/completed requests with accepted proposals) */}
                                    {(selectedRequest.status === 'APPROVED' || selectedRequest.status === 'CLOSED') &&
                                        selectedRequest.proposals && selectedRequest.proposals.length > 0 &&
                                        selectedRequest.proposals[0].status === 'ACCEPTED' && (
                                            <div className="detail-section payout-section">
                                                <h3>
                                                    <i className="fas fa-money-bill-wave"></i>
                                                    Payment & Payout Information
                                                </h3>
                                                <div className="payout-details">
                                                    <div className="payout-item">
                                                        <label>Total Amount Paid:</label>
                                                        <span className="amount-total">
                                                            ${selectedRequest.proposals[0].price?.toFixed(2) || '0.00'}
                                                        </span>
                                                    </div>
                                                    <div className="payout-item">
                                                        <label>Platform Fee (10%):</label>
                                                        <span className="amount-fee">
                                                            ${selectedRequest.proposals[0].platformFeeAmount?.toFixed(2) ||
                                                                (selectedRequest.proposals[0].price ? (selectedRequest.proposals[0].price * 0.1).toFixed(2) : '0.00')}
                                                        </span>
                                                    </div>
                                                    <div className="payout-item highlight">
                                                        <label>Provider Payout:</label>
                                                        <span className="amount-payout">
                                                            ${selectedRequest.proposals[0].providerPayoutAmount?.toFixed(2) ||
                                                                (selectedRequest.proposals[0].price ? (selectedRequest.proposals[0].price * 0.9).toFixed(2) : '0.00')}
                                                        </span>
                                                    </div>
                                                    {selectedRequest.proposals[0].payoutStatus && (
                                                        <div className="payout-status">
                                                            <label>Payout Status:</label>
                                                            <span className={`status-badge payout-${selectedRequest.proposals[0].payoutStatus}`}>
                                                                {selectedRequest.proposals[0].payoutStatus}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {selectedRequest.proposals[0].payoutProcessedAt && (
                                                        <div className="payout-item">
                                                            <label>Payout Processed:</label>
                                                            <span>{formatDate(selectedRequest.proposals[0].payoutProcessedAt)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                    {/* Approved Notice & Review Section */}
                                    {(selectedRequest.status === 'APPROVED' || selectedRequest.status === 'CLOSED') && (
                                        <div className="detail-section approval-section approved">
                                            <div className="approval-notice">
                                                <i className="fas fa-check-circle"></i>
                                                <div>
                                                    <h4>Work Approved</h4>
                                                    <p>
                                                        {selectedRequest.status === 'CLOSED'
                                                            ? 'This service request has been closed. Thank you for your review!'
                                                            : "You have approved this work. Please leave a review for the provider."}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Review Form */}
                                            {(reviewStatus || selectedRequest.status === 'APPROVED') && (
                                                <div className="review-section">
                                                    {reviewStatus?.hasReview ? (
                                                        <div className="existing-review-display">
                                                            <h4>
                                                                <i className="fas fa-star"></i>
                                                                Your Review
                                                            </h4>
                                                            <div className="review-display">
                                                                <div className="review-rating-display">
                                                                    {[...Array(5)].map((_, i) => (
                                                                        <i
                                                                            key={i}
                                                                            className={`fas fa-star ${i < reviewStatus.review.rating ? 'active' : ''}`}
                                                                        ></i>
                                                                    ))}
                                                                    <span className="rating-text">
                                                                        {reviewStatus.review.rating}/5
                                                                    </span>
                                                                </div>
                                                                <h5 className="review-title">{reviewStatus.review.title}</h5>
                                                                <p className="review-comment">{reviewStatus.review.comment}</p>
                                                                <p className="review-date">
                                                                    Submitted on {formatDate(reviewStatus.review.createdAt)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ) : (reviewStatus?.canReview !== false || selectedRequest.status === 'APPROVED') ? (
                                                        <div className="review-form-container">
                                                            {!showReviewForm ? (
                                                                <button
                                                                    className="btn-show-review-form"
                                                                    onClick={() => setShowReviewForm(true)}
                                                                >
                                                                    <i className="fas fa-star"></i>
                                                                    Leave a Review
                                                                </button>
                                                            ) : (
                                                                <ReviewForm
                                                                    serviceRequestId={selectedRequest.id}
                                                                    onSuccess={async (data) => {
                                                                        setMessage({
                                                                            type: 'success',
                                                                            text: data.message || 'Review submitted successfully!'
                                                                        });
                                                                        setShowReviewForm(false);
                                                                        // Reload request details to show updated status
                                                                        await handleViewDetails(selectedRequest.id);
                                                                        // Reload requests list
                                                                        loadRequests();
                                                                        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
                                                                    }}
                                                                    onCancel={() => setShowReviewForm(false)}
                                                                />
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="review-unavailable">
                                                            <p>Review is not available at this time.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="modal-error">
                                    <i className="fas fa-exclamation-circle"></i>
                                    <p>Failed to load request details</p>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            {/* Cancel button - only show if status allows cancellation */}
                            {selectedRequest && (selectedRequest.status === 'REQUEST_CREATED' || selectedRequest.status === 'LEAD_ASSIGNED') && (
                                <button
                                    className="btn-danger"
                                    onClick={handleCancelRequest}
                                    style={{ marginRight: 'auto' }}
                                >
                                    <i className="fas fa-times-circle"></i>
                                    Cancel Request
                                </button>
                            )}
                            <button className="btn-secondary" onClick={closeModal}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Request Modal */}
            {showCancelRequestModal && selectedRequest && (
                <div className="modal-overlay" onClick={() => setShowCancelRequestModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>
                                <i className="fas fa-times-circle"></i>
                                Cancel Service Request
                            </h2>
                            <button
                                className="modal-close"
                                onClick={() => setShowCancelRequestModal(false)}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <div className="modal-body">
                            <p style={{ marginBottom: '20px', color: '#666' }}>
                                Are you sure you want to cancel this service request? This action cannot be undone.
                            </p>

                            <div className="form-group">
                                <label htmlFor="cancel-rejection-reason">
                                    Reason for Cancellation (Optional)
                                </label>
                                <select
                                    id="cancel-rejection-reason"
                                    value={cancelRejectionReason}
                                    onChange={(e) => {
                                        setCancelRejectionReason(e.target.value);
                                        if (e.target.value !== 'OTHER') {
                                            setCancelRejectionReasonOther('');
                                        }
                                    }}
                                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}
                                >
                                    <option value="">-- Select a reason (optional) --</option>
                                    <option value="TOO_FAR">Too Far</option>
                                    <option value="TOO_EXPENSIVE">Too Expensive</option>
                                    <option value="NOT_RELEVANT">Not Relevant Service Request</option>
                                    <option value="OTHER">Other (Describe)</option>
                                </select>
                            </div>

                            {cancelRejectionReason === 'OTHER' && (
                                <div className="form-group">
                                    <label htmlFor="cancel-rejection-reason-other">
                                        Please describe the reason <span style={{ color: '#dc3545' }}>*</span>
                                    </label>
                                    <textarea
                                        id="cancel-rejection-reason-other"
                                        value={cancelRejectionReasonOther}
                                        onChange={(e) => setCancelRejectionReasonOther(e.target.value)}
                                        placeholder="Please provide details about why you are cancelling this request..."
                                        rows={4}
                                        required
                                        style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="modal-actions">
                            <button
                                type="button"
                                className="cancel-btn"
                                onClick={() => {
                                    setShowCancelRequestModal(false);
                                    setCancelRejectionReason('');
                                    setCancelRejectionReasonOther('');
                                }}
                            >
                                Keep Request
                            </button>
                            <button
                                type="button"
                                className="btn-danger"
                                onClick={handleConfirmCancelRequest}
                            >
                                <i className="fas fa-times-circle"></i>
                                Confirm Cancellation
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Proposal Modal */}
            {showRejectProposalModal && selectedProposalForReject && selectedRequest && (
                <div className="modal-overlay" onClick={() => setShowRejectProposalModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>
                                <i className="fas fa-times-circle"></i>
                                Reject Proposal
                            </h2>
                            <button
                                className="modal-close"
                                onClick={() => setShowRejectProposalModal(false)}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <div className="modal-body">
                            <p style={{ marginBottom: '20px', color: '#666' }}>
                                Are you sure you want to reject this proposal? Please select a reason below.
                            </p>

                            <div className="form-group">
                                <label htmlFor="proposal-rejection-reason">
                                    Rejection Reason <span style={{ color: '#dc3545' }}>*</span>
                                </label>
                                <select
                                    id="proposal-rejection-reason"
                                    value={proposalRejectionReason}
                                    onChange={(e) => {
                                        setProposalRejectionReason(e.target.value);
                                        if (e.target.value !== 'OTHER') {
                                            setProposalRejectionReasonOther('');
                                        }
                                    }}
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

                            {proposalRejectionReason === 'OTHER' && (
                                <div className="form-group">
                                    <label htmlFor="proposal-rejection-reason-other">
                                        Please describe the reason <span style={{ color: '#dc3545' }}>*</span>
                                    </label>
                                    <textarea
                                        id="proposal-rejection-reason-other"
                                        value={proposalRejectionReasonOther}
                                        onChange={(e) => setProposalRejectionReasonOther(e.target.value)}
                                        placeholder="Please provide details about why you are rejecting this proposal..."
                                        rows={4}
                                        required
                                        style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="modal-actions">
                            <button
                                type="button"
                                className="cancel-btn"
                                onClick={() => {
                                    setShowRejectProposalModal(false);
                                    setSelectedProposalForReject(null);
                                    setProposalRejectionReason('');
                                    setProposalRejectionReasonOther('');
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-danger"
                                onClick={handleConfirmRejectProposal}
                            >
                                <i className="fas fa-times-circle"></i>
                                Confirm Rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && selectedProposal && selectedRequest && (
                <PaymentModal
                    show={showPaymentModal}
                    onClose={() => {
                        setShowPaymentModal(false);
                        setSelectedProposal(null);
                    }}
                    proposal={selectedProposal}
                    serviceRequest={selectedRequest}
                    onSuccess={handlePaymentSuccess}
                />
            )}
        </div>
    );
};

export default MyRequests;


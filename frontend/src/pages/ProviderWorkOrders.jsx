import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './ProviderWorkOrders.css';

const ProviderWorkOrders = () => {
    const { user } = useContext(AuthContext);
    const [workOrders, setWorkOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 10,
        total: 0,
        pages: 0
    });
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        loadWorkOrders();
    }, [statusFilter, pagination.page]);

    const loadWorkOrders = async () => {
        try {
            setLoading(true);
            setError(null);
            const params = {
                page: pagination.page,
                pageSize: pagination.pageSize
            };

            if (statusFilter !== 'ALL') {
                params.status = statusFilter;
            }

            const response = await api.get('/provider/work-orders', { params });

            if (response.data.success) {
                const workOrdersData = response.data.data || [];
                console.log('[ProviderWorkOrders] Loaded work orders:', workOrdersData);
                console.log('[ProviderWorkOrders] Work order statuses:', workOrdersData.map(wo => ({ id: wo.id, status: wo.status })));
                setWorkOrders(workOrdersData);
                setPagination(prev => ({
                    ...prev,
                    total: response.data.pagination?.total || 0,
                    pages: response.data.pagination?.pages || 0
                }));

                if (response.data.message && response.data.message.includes('Provider profile not found')) {
                    setError(response.data.message);
                } else {
                    setError(null);
                }
            }
        } catch (err) {
            console.error('Error loading work orders:', err);
            const errorMessage = err.response?.data?.error || 'Failed to load work orders';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = async (workOrderId) => {
        try {
            const response = await api.get(`/provider/work-orders/${workOrderId}`);
            if (response.data.success) {
                setSelectedWorkOrder(response.data.data);
                setShowDetailModal(true);
            }
        } catch (err) {
            console.error('Error loading work order details:', err);
            setMessage({
                type: 'error',
                text: err.response?.data?.error || 'Failed to load work order details'
            });
        }
    };

    const handleComplete = (workOrder) => {
        setSelectedWorkOrder(workOrder);
        setShowCompleteModal(true);
    };

    const handleConfirmComplete = async () => {
        if (!selectedWorkOrder) return;

        setSubmitting(true);
        try {
            const response = await api.patch(`/provider/work-orders/${selectedWorkOrder.id}/complete`);

            if (response.data.success) {
                setMessage({
                    type: 'success',
                    text: 'Work order marked as completed successfully!'
                });
                setShowCompleteModal(false);
                setSelectedWorkOrder(null);
                await loadWorkOrders();
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            } else {
                setMessage({
                    type: 'error',
                    text: response.data.error || 'Failed to complete work order'
                });
            }
        } catch (err) {
            console.error('Error completing work order:', err);
            setMessage({
                type: 'error',
                text: err.response?.data?.error || 'Failed to complete work order'
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handlePageChange = (newPage) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    const getStatusBadgeClass = (status) => {
        const statusClasses = {
            'IN_PROGRESS': 'status-progress',
            'COMPLETED': 'status-completed'
        };
        return statusClasses[status] || 'status-default';
    };

    const getStatusLabel = (status) => {
        const statusLabels = {
            'IN_PROGRESS': 'In Progress',
            'COMPLETED': 'Completed'
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

    const formatCurrency = (amount) => {
        if (!amount) return '$0.00';
        return `$${parseFloat(amount).toFixed(2)}`;
    };

    if (loading && workOrders.length === 0) {
        return (
            <div className="provider-work-orders">
                <div className="loading-container">
                    <i className="fas fa-spinner fa-spin"></i>
                    <p>Loading work orders...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="provider-work-orders">
            <div className="work-orders-header">
                <h1>
                    <i className="fas fa-tasks"></i>
                    Work Orders
                </h1>
                <p className="subtitle">Manage your active and completed work orders</p>
            </div>

            {message.text && (
                <div className={`message alert-${message.type}`}>
                    <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i>
                    <span>{message.text}</span>
                </div>
            )}

            {error && error.includes('Provider profile not found') ? (
                <div className="no-work-orders">
                    <div className="no-work-orders-icon">
                        <i className="fas fa-user-cog"></i>
                    </div>
                    <h3>Provider Profile Required</h3>
                    <p>{error}</p>
                    <p className="hint">Please complete your provider profile setup to view work orders.</p>
                </div>
            ) : (
                <>
                    {/* Filters */}
                    <div className="work-orders-filters">
                        <div className="filter-group">
                            <label>Filter by Status:</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value);
                                    setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                                className="filter-select"
                            >
                                <option value="ALL">All Work Orders</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="COMPLETED">Completed</option>
                            </select>
                        </div>
                        <div className="work-orders-count">
                            <span>Total: {pagination.total} work orders</span>
                        </div>
                    </div>

                    {/* Work Orders List */}
                    {workOrders.length === 0 ? (
                        <div className="no-work-orders">
                            <div className="no-work-orders-icon">
                                <i className="fas fa-clipboard-list"></i>
                            </div>
                            <h3>No Work Orders Found</h3>
                            <p>
                                {statusFilter === 'ALL'
                                    ? "You don't have any work orders yet."
                                    : `No work orders found with status: ${getStatusLabel(statusFilter)}`}
                            </p>
                            <p className="hint">
                                Work orders will appear here once customers accept your proposals and payment is processed.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="work-orders-grid">
                                {workOrders.map((workOrder) => (
                                    <div key={workOrder.id} className="work-order-card">
                                        <div className="work-order-header">
                                            <div className="work-order-title-section">
                                                <h3 className="work-order-title">
                                                    {workOrder.serviceRequest?.projectTitle || 'Untitled Project'}
                                                </h3>
                                                <span className={`status-badge ${getStatusBadgeClass(workOrder.status)}`}>
                                                    {getStatusLabel(workOrder.status)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="work-order-body">
                                            <div className="work-order-info">
                                                <div className="info-item">
                                                    <i className="fas fa-user" style={{textAlign: 'left', marginLeft: 0}}></i>
                                                    <span style={{textAlign: 'left', display: 'block', width: '100%'}}>
                                                        <strong>Customer:</strong>{' '}
                                                        {workOrder.customer?.name || 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="info-item">
                                                    <i className="fas fa-tag" style={{textAlign: 'left', marginLeft: 0}}></i>
                                                    <span style={{textAlign: 'left', display: 'block', width: '100%'}}>
                                                        <strong>Category:</strong>{' '}
                                                        {workOrder.serviceRequest?.category?.name || 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="info-item">
                                                    <i className="fas fa-map-marker-alt" style={{textAlign: 'left', marginLeft: 0}}></i>
                                                    <span style={{textAlign: 'left', display: 'block', width: '100%'}}>
                                                        <strong>Location:</strong>{' '}
                                                        {workOrder.serviceRequest?.zipCode || 'N/A'}
                                                    </span>
                                                </div>
                                                {workOrder.proposal && (
                                                    <div className="info-item">
                                                        <i className="fas fa-dollar-sign" style={{textAlign: 'left', marginLeft: 0}}></i>
                                                        <span style={{textAlign: 'left', display: 'block', width: '100%'}}>
                                                            <strong>Amount:</strong>{' '}
                                                            {formatCurrency(workOrder.proposal.price)}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="info-item">
                                                    <i className="fas fa-calendar" style={{textAlign: 'left', marginLeft: 0}}></i>
                                                    <span style={{textAlign: 'left', display: 'block', width: '100%'}}>
                                                        <strong>Created:</strong>{' '}
                                                        {formatDate(workOrder.createdAt)}
                                                    </span>
                                                </div>
                                                {workOrder.completedAt && (
                                                    <div className="info-item">
                                                        <i className="fas fa-check-circle" style={{textAlign: 'left', marginLeft: 0}}></i>
                                                        <span style={{textAlign: 'left', display: 'block', width: '100%'}}>
                                                            <strong>Completed:</strong>{' '}
                                                            {formatDate(workOrder.completedAt)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {workOrder.serviceRequest?.projectDescription && (
                                                <div className="work-order-description">
                                                    <p style={{textAlign: 'left', margin: 0}}>{workOrder.serviceRequest.projectDescription.substring(0, 150)}...</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="work-order-actions">
                                            <button
                                                className="btn-view-details"
                                                onClick={() => handleViewDetails(workOrder.id)}
                                            >
                                                <i className="fas fa-eye"></i>
                                                View Details
                                            </button>
                                            {(workOrder.status === 'IN_PROGRESS' || workOrder.status === 'in_progress') && (
                                                <button
                                                    className="btn-complete"
                                                    onClick={() => handleComplete(workOrder)}
                                                >
                                                    <i className="fas fa-check"></i>
                                                    Mark as Completed
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
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
                                    <span className="pagination-info">
                                        Page {pagination.page} of {pagination.pages}
                                    </span>
                                    <button
                                        className="pagination-btn"
                                        onClick={() => handlePageChange(pagination.page + 1)}
                                        disabled={pagination.page === pagination.pages}
                                    >
                                        Next
                                        <i className="fas fa-chevron-right"></i>
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}

            {/* Complete Work Order Modal */}
            {showCompleteModal && selectedWorkOrder && (
                <div className="modal-overlay" onClick={() => setShowCompleteModal(false)}>
                    <div className="modal-content complete-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>
                                <i className="fas fa-check-circle"></i>
                                Mark Work as Completed
                            </h2>
                            <button className="modal-close" onClick={() => setShowCompleteModal(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>Are you sure you want to mark this work order as completed?</p>
                            <div className="work-order-summary">
                                <h4>{selectedWorkOrder.serviceRequest?.projectTitle}</h4>
                                <p><strong>Customer:</strong> {selectedWorkOrder.customer?.name || 'N/A'}</p>
                                <p><strong>Status:</strong> {getStatusLabel(selectedWorkOrder.status)}</p>
                            </div>
                            <p className="warning-text">
                                <i className="fas fa-exclamation-triangle"></i>
                                This action will notify the customer and update the service request status to "COMPLETED".
                            </p>
                        </div>
                        <div className="modal-actions">
                            <button
                                className="btn-cancel"
                                onClick={() => {
                                    setShowCompleteModal(false);
                                    setSelectedWorkOrder(null);
                                }}
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-confirm"
                                onClick={handleConfirmComplete}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin"></i>
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-check"></i>
                                        Confirm & Complete
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Work Order Detail Modal */}
            {showDetailModal && selectedWorkOrder && (
                <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
                    <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>
                                <i className="fas fa-info-circle"></i>
                                Work Order Details
                            </h2>
                            <button className="modal-close" onClick={() => setShowDetailModal(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-section">
                                <h3>Project Information</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>Project Title:</label>
                                        <span>{selectedWorkOrder.serviceRequest?.projectTitle || 'N/A'}</span>
                                    </div>
                                    <div className="detail-item">
                                        <label>Status:</label>
                                        <span className={`status-badge ${getStatusBadgeClass(selectedWorkOrder.status)}`}>
                                            {getStatusLabel(selectedWorkOrder.status)}
                                        </span>
                                    </div>
                                    <div className="detail-item">
                                        <label>Category:</label>
                                        <span>{selectedWorkOrder.serviceRequest?.category?.name || 'N/A'}</span>
                                    </div>
                                    {selectedWorkOrder.serviceRequest?.subCategory && (
                                        <div className="detail-item">
                                            <label>Sub-Category:</label>
                                            <span>{selectedWorkOrder.serviceRequest.subCategory.name}</span>
                                        </div>
                                    )}
                                    <div className="detail-item">
                                        <label>Location:</label>
                                        <span>{selectedWorkOrder.serviceRequest?.zipCode || 'N/A'}</span>
                                    </div>
                                    <div className="detail-item">
                                        <label>Preferred Date:</label>
                                        <span>{formatDate(selectedWorkOrder.serviceRequest?.preferredDate)}</span>
                                    </div>
                                    {selectedWorkOrder.serviceRequest?.preferredTime && (
                                        <div className="detail-item">
                                            <label>Preferred Time:</label>
                                            <span>{selectedWorkOrder.serviceRequest.preferredTime}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {selectedWorkOrder.serviceRequest?.projectDescription && (
                                <div className="detail-section">
                                    <h3>Project Description</h3>
                                    <p>{selectedWorkOrder.serviceRequest.projectDescription}</p>
                                </div>
                            )}

                            <div className="detail-section">
                                <h3>Customer Information</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>Name:</label>
                                        <span>{selectedWorkOrder.customer?.name || 'N/A'}</span>
                                    </div>
                                    <div className="detail-item">
                                        <label>Email:</label>
                                        <span>{selectedWorkOrder.customer?.email || 'N/A'}</span>
                                    </div>
                                    {selectedWorkOrder.customer?.phone && (
                                        <div className="detail-item">
                                            <label>Phone:</label>
                                            <span>{selectedWorkOrder.customer.phone}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {selectedWorkOrder.proposal && (
                                <div className="detail-section">
                                    <h3>Proposal & Payment</h3>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <label>Proposal Price:</label>
                                            <span className="price-amount">
                                                {formatCurrency(selectedWorkOrder.proposal.price)}
                                            </span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Payment Status:</label>
                                            <span className={`payment-status ${selectedWorkOrder.proposal.paymentStatus}`}>
                                                {selectedWorkOrder.proposal.paymentStatus === 'succeeded' ? 'Paid' : 'Pending'}
                                            </span>
                                        </div>
                                        {selectedWorkOrder.proposal.paidAt && (
                                            <div className="detail-item">
                                                <label>Paid At:</label>
                                                <span>{formatDate(selectedWorkOrder.proposal.paidAt)}</span>
                                            </div>
                                        )}
                                    </div>
                                    {selectedWorkOrder.proposal.details && (
                                        <div className="proposal-details">
                                            <label>Proposal Details:</label>
                                            <p>{selectedWorkOrder.proposal.details}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="detail-section">
                                <h3>Timeline</h3>
                                <div className="timeline">
                                    <div className="timeline-item">
                                        <i className="fas fa-calendar-plus"></i>
                                        <div>
                                            <strong>Created:</strong> {formatDate(selectedWorkOrder.createdAt)}
                                        </div>
                                    </div>
                                    {selectedWorkOrder.completedAt && (
                                        <div className="timeline-item">
                                            <i className="fas fa-check-circle"></i>
                                            <div>
                                                <strong>Completed:</strong> {formatDate(selectedWorkOrder.completedAt)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="modal-actions">
                            {(selectedWorkOrder.status === 'IN_PROGRESS' || selectedWorkOrder.status === 'in_progress') && (
                                <button
                                    className="btn-complete"
                                    onClick={() => {
                                        setShowDetailModal(false);
                                        handleComplete(selectedWorkOrder);
                                    }}
                                >
                                    <i className="fas fa-check"></i>
                                    Mark as Completed
                                </button>
                            )}
                            <button
                                className="btn-close"
                                onClick={() => {
                                    setShowDetailModal(false);
                                    setSelectedWorkOrder(null);
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProviderWorkOrders;


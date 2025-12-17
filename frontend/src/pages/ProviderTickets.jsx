import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ProviderTickets.css';

const ProviderTickets = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedMessage, setSelectedMessage] = useState(null);

  useEffect(() => {
    loadMessages();
  }, [currentPage]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/provider/messages?page=${currentPage}&limit=20`);
      setMessages(response.data.messages || []);
      setTotalPages(response.data.pages || 1);
    } catch (error) {
      console.error('Error loading messages:', error);
      alert('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      new: { class: 'status-new', text: 'New', icon: 'clock' },
      read: { class: 'status-read', text: 'Read', icon: 'check' },
      replied: { class: 'status-replied', text: 'Replied', icon: 'reply' },
      resolved: { class: 'status-resolved', text: 'Resolved', icon: 'check-circle' }
    };
    const statusInfo = statusMap[status] || statusMap.new;
    return (
      <span className={`status-badge ${statusInfo.class}`}>
        <i className={`fas fa-${statusInfo.icon}`}></i>
        {statusInfo.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="provider-tickets-loading">
        <div className="loading-spinner"></div>
        <p>Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="provider-tickets-container">
      <div className="tickets-header">
        <h1>
          <i className="fas fa-envelope"></i>
          Customer Messages
        </h1>
        <p className="tickets-subtitle">Messages sent to you from customers</p>
      </div>

      {messages.length === 0 ? (
        <div className="empty-state-tickets">
          <i className="fas fa-inbox"></i>
          <h3>No Messages</h3>
          <p>You haven't received any customer messages yet.</p>
        </div>
      ) : (
        <>
          <div className="messages-list">
            {messages.map((message) => (
              <div key={message.id} className="message-card" onClick={() => setSelectedMessage(message)}>
                <div className="message-card-header">
                  <div className="message-sender-info">
                    <div className="sender-avatar">
                      <i className="fas fa-user"></i>
                    </div>
                    <div>
                      <h3>{message.name}</h3>
                      <p className="sender-email">{message.email}</p>
                    </div>
                  </div>
                  {getStatusBadge(message.status)}
                </div>
                {message.business && (
                  <div className="message-business-info">
                    <i className="fas fa-building"></i>
                    <span>{message.business.name}</span>
                  </div>
                )}
                <div className="message-preview">
                  <strong>{message.subject}</strong>
                  <p>{message.message.substring(0, 100)}...</p>
                </div>
                <div className="message-footer">
                  <span className="message-date">
                    <i className="fas fa-calendar"></i>
                    {new Date(message.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  <button className="view-message-btn">
                    View Details <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {selectedMessage && (
        <div className="modal-overlay" onClick={() => setSelectedMessage(null)}>
          <div className="modal message-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-message">
              <div className="modal-header-content">
                <h3>
                  <i className="fas fa-envelope-open"></i>
                  Message Details
                </h3>
                <span className="message-id-badge">ID: #{selectedMessage.id}</span>
              </div>
              <button 
                className="modal-close-btn" 
                onClick={() => setSelectedMessage(null)}
                aria-label="Close modal"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="modal-body-message">
              {selectedMessage.business && (
                <div className="business-info-card">
                  <div className="business-info-header">
                    <i className="fas fa-building"></i>
                    <span>Your Business</span>
                  </div>
                  <div className="business-info-content">
                    <h4>{selectedMessage.business.name}</h4>
                    <p>
                      <i className="fas fa-map-marker-alt"></i>
                      {selectedMessage.business.city}, {selectedMessage.business.state}
                    </p>
                  </div>
                </div>
              )}

              <div className="message-info-grid">
                <div className="info-item">
                  <div className="info-label">
                    <i className="fas fa-user"></i>
                    <span>From</span>
                  </div>
                  <div className="info-value">
                    <strong>{selectedMessage.name}</strong>
                    <a href={`mailto:${selectedMessage.email}`} className="email-link">
                      <i className="fas fa-envelope"></i>
                      {selectedMessage.email}
                    </a>
                  </div>
                </div>

                {selectedMessage.phone && (
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-phone"></i>
                      <span>Phone</span>
                    </div>
                    <div className="info-value">
                      <a href={`tel:${selectedMessage.phone}`} className="phone-link">
                        <i className="fas fa-phone-alt"></i>
                        {selectedMessage.phone}
                      </a>
                    </div>
                  </div>
                )}

                <div className="info-item">
                  <div className="info-label">
                    <i className="fas fa-calendar"></i>
                    <span>Date</span>
                  </div>
                  <div className="info-value">
                    {new Date(selectedMessage.createdAt).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>

                <div className="info-item full-width">
                  <div className="info-label">
                    <i className="fas fa-tag"></i>
                    <span>Subject</span>
                  </div>
                  <div className="info-value subject-text">
                    {selectedMessage.subject}
                  </div>
                </div>
              </div>

              <div className="message-section">
                <div className="message-header">
                  <i className="fas fa-comment-alt"></i>
                  <span>Message</span>
                </div>
                <div className="message-content">
                  {selectedMessage.message}
                </div>
              </div>
            </div>

            <div className="modal-actions-message">
              <button className="btn-close-modal" onClick={() => setSelectedMessage(null)}>
                <i className="fas fa-times"></i>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderTickets;


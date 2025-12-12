import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './SupportTickets.css';

const SupportTickets = () => {
  const { user } = useContext(AuthContext);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    message: ''
  });

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await api.get('/contact/my-tickets');
      setTickets(response.data.contacts || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/contact', {
        name: user?.name || 'User',
        email: user?.email,
        subject: formData.subject,
        message: formData.message
      });
      setFormData({ subject: '', message: '' });
      setShowNewTicketForm(false);
      fetchTickets();
      alert('Ticket submitted successfully!');
    } catch (error) {
      alert('Failed to submit ticket');
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { class: 'status-pending', text: 'Pending', icon: 'clock' },
      resolved: { class: 'status-resolved', text: 'Resolved', icon: 'check-circle' },
      in_progress: { class: 'status-progress', text: 'In Progress', icon: 'spinner' }
    };
    const statusInfo = statusMap[status] || statusMap.pending;
    return (
      <span className={`status-badge ${statusInfo.class}`}>
        <i className={`fas fa-${statusInfo.icon}`}></i>
        {statusInfo.text}
      </span>
    );
  };

  const formatLastLogin = (date) => {
    if (!date) return 'Never';
    const loginDate = new Date(date);
    return loginDate.toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="support-tickets-container">
      <div className="tickets-header">
        <h1>Hello {user?.firstName || user?.name || 'User'}!</h1>
        <p className="last-login">
          You last logged in at: {formatLastLogin(user?.lastLogin)}
        </p>
      </div>

      <div className="tickets-content">
        <div className="tickets-title-row">
          <h2 className="section-title">
            <i className="fas fa-chevron-right"></i>
            Support Tickets
          </h2>
          <button 
            onClick={() => setShowNewTicketForm(!showNewTicketForm)} 
            className="new-ticket-btn"
          >
            <i className="fas fa-plus"></i>
            New Ticket
          </button>
        </div>

        {showNewTicketForm && (
          <div className="new-ticket-form">
            <h3>Create New Ticket</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Subject</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Enter ticket subject"
                  required
                />
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Describe your issue..."
                  rows="5"
                  required
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="submit-btn">
                  <i className="fas fa-paper-plane"></i>
                  Submit Ticket
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowNewTicketForm(false)} 
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <i className="fas fa-spinner fa-spin"></i>
            <p>Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-ticket-alt"></i>
            <h3>No Support Tickets</h3>
            <p>You haven't created any support tickets yet.</p>
            <button onClick={() => setShowNewTicketForm(true)} className="empty-state-btn">
              Create Your First Ticket
            </button>
          </div>
        ) : (
          <div className="tickets-list">
            {tickets.map(ticket => (
              <div key={ticket.id} className="ticket-card">
                <div className="ticket-header-row">
                  <h3>{ticket.subject}</h3>
                  {getStatusBadge(ticket.status)}
                </div>
                <div className="ticket-info">
                  <span className="ticket-date">
                    <i className="fas fa-calendar"></i>
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </span>
                  <span className="ticket-id">
                    <i className="fas fa-hashtag"></i>
                    Ticket #{ticket.id}
                  </span>
                </div>
                <p className="ticket-message">{ticket.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportTickets;


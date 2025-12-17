import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './AdminTable.css';

const AdminContacts = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedContact, setSelectedContact] = useState(null);
  const [sendingToProvider, setSendingToProvider] = useState(false);

  useEffect(() => {
    loadContacts();
  }, [currentPage]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/contacts?page=${currentPage}&limit=20`);
      setContacts(response.data.contacts);
      setTotalPages(response.data.pages);
    } catch (error) {
      alert('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/admin/contacts/${id}`, { status });
      alert('Status updated successfully!');
      loadContacts();
      if (selectedContact && selectedContact.id === id) {
        setSelectedContact(null);
      }
    } catch (error) {
      alert('Failed to update status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    
    try {
      await api.delete(`/admin/contacts/${id}`);
      alert('Contact deleted successfully!');
      loadContacts();
      if (selectedContact && selectedContact.id === id) {
        setSelectedContact(null);
      }
    } catch (error) {
      alert('Failed to delete contact');
    }
  };

  const handleSendToProvider = async () => {
    if (!selectedContact?.business) {
      alert('This message is not associated with a business.');
      return;
    }

    if (!window.confirm('Send this message to the business owner/provider?')) return;

    try {
      setSendingToProvider(true);
      await api.post(`/admin/contacts/${selectedContact.id}/send-to-provider`);
      alert('Message sent to provider successfully!');
      loadContacts();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to send message to provider');
    } finally {
      setSendingToProvider(false);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="admin-table-container">
      <div className="table-header">
        <h2>Contact Messages</h2>
        <div className="stats">
          <span>Total: {contacts.length}</span>
          <span>New: {contacts.filter(c => c.status === 'new').length}</span>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Business</th>
              <th>Subject</th>
              <th>Message</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length > 0 ? (
              contacts.map((contact) => (
                <tr key={contact.id}>
                  <td>{contact.id}</td>
                  <td><strong>{contact.name}</strong></td>
                  <td>{contact.email}</td>
                  <td>{contact.phone || '-'}</td>
                  <td>
                    {contact.business ? (
                      <div>
                        <strong>{contact.business.name}</strong>
                        <br />
                        <small style={{color: '#666'}}>
                          {contact.business.city}, {contact.business.state}
                        </small>
                      </div>
                    ) : (
                      <span style={{color: '#999'}}>-</span>
                    )}
                  </td>
                  <td>{contact.subject}</td>
                  <td>
                    {contact.message.substring(0, 50)}...
                    <br />
                    <button 
                      className="btn-view"
                      onClick={() => setSelectedContact(contact)}
                      style={{marginTop: '5px'}}
                    >
                      View Full
                    </button>
                  </td>
                  <td>
                    <select 
                      value={contact.status}
                      onChange={(e) => updateStatus(contact.id, e.target.value)}
                      className={`status-badge ${contact.status}`}
                      style={{padding: '5px', borderRadius: '4px', border: '1px solid #ddd'}}
                    >
                      <option value="new">New</option>
                      <option value="read">Read</option>
                      <option value="replied">Replied</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </td>
                  <td>{new Date(contact.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="btn-delete"
                        onClick={() => handleDelete(contact.id)}
                        title="Delete Contact"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" className="empty-state">No contact messages found</td>
              </tr>
            )}
          </tbody>
        </table>
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

      {selectedContact && (
        <div className="modal-overlay" onClick={() => setSelectedContact(null)}>
          <div className="modal contact-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-contact">
              <div className="modal-header-content">
                <h3>
                  <i className="fas fa-envelope"></i>
                  Contact Message Details
                </h3>
                <span className="contact-id-badge">ID: #{selectedContact.id}</span>
              </div>
              <button 
                className="modal-close-btn" 
                onClick={() => setSelectedContact(null)}
                aria-label="Close modal"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="modal-body-contact">
              {selectedContact.business && (
                <div className="business-info-card">
                  <div className="business-info-header">
                    <i className="fas fa-building"></i>
                    <span>About Business</span>
                  </div>
                  <div className="business-info-content">
                    <h4>{selectedContact.business.name}</h4>
                    <p>
                      <i className="fas fa-map-marker-alt"></i>
                      {selectedContact.business.city}, {selectedContact.business.state}
                    </p>
                  </div>
                </div>
              )}

              <div className="contact-info-grid">
                <div className="info-item">
                  <div className="info-label">
                    <i className="fas fa-user"></i>
                    <span>From</span>
                  </div>
                  <div className="info-value">
                    <strong>{selectedContact.name}</strong>
                    <a href={`mailto:${selectedContact.email}`} className="email-link">
                      <i className="fas fa-envelope"></i>
                      {selectedContact.email}
                    </a>
                  </div>
                </div>

                {selectedContact.phone && (
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-phone"></i>
                      <span>Phone</span>
                    </div>
                    <div className="info-value">
                      <a href={`tel:${selectedContact.phone}`} className="phone-link">
                        <i className="fas fa-phone-alt"></i>
                        {selectedContact.phone}
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
                    {new Date(selectedContact.createdAt).toLocaleString('en-US', {
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
                    {selectedContact.subject}
                  </div>
                </div>
              </div>

              <div className="message-section">
                <div className="message-header">
                  <i className="fas fa-comment-alt"></i>
                  <span>Message</span>
                </div>
                <div className="message-content">
                  {selectedContact.message}
                </div>
              </div>

              <div className="status-section">
                <div className="status-header">
                  <i className="fas fa-info-circle"></i>
                  <span>Status</span>
                </div>
                <select 
                  value={selectedContact.status}
                  onChange={(e) => {
                    updateStatus(selectedContact.id, e.target.value);
                    setSelectedContact({ ...selectedContact, status: e.target.value });
                  }}
                  className="status-select"
                >
                  <option value="new">New</option>
                  <option value="read">Read</option>
                  <option value="replied">Replied</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>

            <div className="modal-actions-contact">
              {selectedContact.business && (
                <button 
                  className="btn-send-provider" 
                  onClick={handleSendToProvider}
                  disabled={sendingToProvider}
                >
                  {sendingToProvider ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      Sending...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-paper-plane"></i>
                      Send to Provider
                    </>
                  )}
                </button>
              )}
              <button 
                className="btn-delete-modal" 
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this contact message?')) {
                    handleDelete(selectedContact.id);
                  }
                }}
              >
                <i className="fas fa-trash"></i>
                Delete
              </button>
              <button className="btn-close-modal" onClick={() => setSelectedContact(null)}>
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

export default AdminContacts;


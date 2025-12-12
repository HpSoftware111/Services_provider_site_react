import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './AdminTable.css';

const AdminContacts = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedContact, setSelectedContact] = useState(null);

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
                <td colSpan="8" className="empty-state">No contact messages found</td>
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
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Contact Message Details</h3>
            <div className="form-group">
              <label>From:</label>
              <p><strong>{selectedContact.name}</strong> ({selectedContact.email})</p>
            </div>
            <div className="form-group">
              <label>Subject:</label>
              <p>{selectedContact.subject}</p>
            </div>
            <div className="form-group">
              <label>Message:</label>
              <p style={{whiteSpace: 'pre-wrap'}}>{selectedContact.message}</p>
            </div>
            <div className="form-group">
              <label>Date:</label>
              <p>{new Date(selectedContact.createdAt).toLocaleString()}</p>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setSelectedContact(null)}>
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


import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './AdminTable.css';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadUsers();
  }, [currentPage]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/users?page=${currentPage}&limit=20`);
      setUsers(response.data.users);
      setTotalPages(response.data.pages);
    } catch (error) {
      alert('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this customer? This action cannot be undone.')) return;

    try {
      await api.delete(`/admin/users/${id}`);
      alert('Customer deleted successfully!');
      loadUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete user');
    }
  };

  const toggleUserStatus = async (user) => {
    try {
      await api.put(`/admin/users/${user.id}`, {
        isActive: !user.isActive
      });
      alert(`Customer ${user.isActive ? 'deactivated' : 'activated'} successfully!`);
      loadUsers();
    } catch (error) {
      alert('Failed to update user status');
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="admin-table-container">
      <div className="table-header">
        <h2>Customer Management</h2>
        <div className="stats">
          <span>Total Customers: {users.length}</span>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length > 0 ? (
              users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td><strong>{user.name}</strong></td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`status-badge ${user.role === 'admin' ? 'verified' : ''}`}>
                      {user.role === 'business_owner' ? 'Provider' : user.role === 'user' ? 'Customer' : user.role}
                    </span>
                  </td>
                  <td>{user.phone || 'N/A'}</td>
                  <td>
                    <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      {user.role !== 'admin' && (
                        <>
                          <button
                            className={user.isActive ? 'btn-delete' : 'btn-approve'}
                            onClick={() => toggleUserStatus(user)}
                            title={user.isActive ? 'Deactivate' : 'Activate'}
                          >
                            <i className={`fas fa-${user.isActive ? 'ban' : 'check'}`}></i>
                          </button>
                          <button
                            className="btn-delete"
                            onClick={() => handleDelete(user.id)}
                            title="Delete Customer"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="empty-state">No customers found</td>
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
    </div>
  );
};

export default AdminUsers;


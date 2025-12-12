import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './AdminTable.css';

const AdminBlogs = () => {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingBlog, setEditingBlog] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    content: '',
    author: 'CityLocal 101 Team',
    isPublished: false
  });

  useEffect(() => {
    loadBlogs();
  }, [currentPage]);

  const loadBlogs = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/blogs?page=${currentPage}&limit=20`);
      setBlogs(response.data.blogs);
      setTotalPages(response.data.pages);
    } catch (error) {
      alert('Failed to load blogs');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingBlog) {
        await api.put(`/admin/blogs/${editingBlog.id}`, formData);
        alert('Blog updated successfully!');
      } else {
        await api.post('/admin/blogs', formData);
        alert('Blog created successfully!');
      }
      setShowModal(false);
      setEditingBlog(null);
      setFormData({ title: '', summary: '', content: '', author: 'CityLocal 101 Team', isPublished: false });
      loadBlogs();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to save blog');
    }
  };

  const handleEdit = (blog) => {
    setEditingBlog(blog);
    setFormData({
      title: blog.title,
      summary: blog.summary,
      content: blog.content,
      author: blog.author || 'CityLocal 101 Team',
      isPublished: blog.isPublished
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this blog post?')) return;
    
    try {
      await api.delete(`/admin/blogs/${id}`);
      alert('Blog deleted successfully!');
      loadBlogs();
    } catch (error) {
      alert('Failed to delete blog');
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="admin-table-container">
      <div className="table-header">
        <h2>Blog Management</h2>
        <button 
          className="btn-primary-action"
          onClick={() => {
            setEditingBlog(null);
            setFormData({ title: '', summary: '', content: '', author: 'CityLocal 101 Team', isPublished: false });
            setShowModal(true);
          }}
        >
          <i className="fas fa-plus"></i> Add Blog Post
        </button>
      </div>

      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Author</th>
              <th>Summary</th>
              <th>Status</th>
              <th>Published</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {blogs.length > 0 ? (
              blogs.map((blog) => (
                <tr key={blog.id}>
                  <td>{blog.id}</td>
                  <td><strong>{blog.title}</strong></td>
                  <td>{blog.author}</td>
                  <td>{blog.summary?.substring(0, 60)}...</td>
                  <td>
                    <span className={`status-badge ${blog.isPublished ? 'active' : 'pending'}`}>
                      {blog.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td>
                    {blog.publishedAt ? new Date(blog.publishedAt).toLocaleDateString() : 'Not published'}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="btn-edit"
                        onClick={() => handleEdit(blog)}
                        title="Edit Blog"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button 
                        className="btn-delete"
                        onClick={() => handleDelete(blog.id)}
                        title="Delete Blog"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="empty-state">No blog posts found</td>
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

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '800px'}}>
            <h3>{editingBlog ? 'Edit Blog Post' : 'Create New Blog Post'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title *</label>
                <input 
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Author *</label>
                <input 
                  type="text"
                  value={formData.author}
                  onChange={(e) => setFormData({...formData, author: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Summary *</label>
                <textarea 
                  value={formData.summary}
                  onChange={(e) => setFormData({...formData, summary: e.target.value})}
                  rows="3"
                  required
                />
              </div>
              <div className="form-group">
                <label>Content *</label>
                <textarea 
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  rows="10"
                  required
                />
              </div>
              <div className="form-group">
                <label>
                  <input 
                    type="checkbox"
                    checked={formData.isPublished}
                    onChange={(e) => setFormData({...formData, isPublished: e.target.checked})}
                  />
                  {' '}Publish immediately
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  {editingBlog ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBlogs;


import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './Blog.css';

const Blog = () => {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBlogs();
  }, []);

  const loadBlogs = async () => {
    try {
      const response = await api.get('/blogs');
      setBlogs(response.data.blogs || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="blog-page">
      <div className="container">
        <div className="blog-header-section">
          <h1><i className="fas fa-blog"></i> Our Blog</h1>
          <p>Discover insights, tips, and stories about local businesses</p>
        </div>
        
        {loading ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : blogs.length === 0 ? (
          <div className="no-blogs">
            <i className="fas fa-newspaper"></i>
            <p>No blog posts available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="blog-grid">
            {blogs.map((blog) => (
              <Link to={`/blog/${blog.slug}`} key={blog.id} className="blog-card">
                <article>
                  <h2>{blog.title}</h2>
                  <p className="blog-summary">{blog.summary}</p>
                  <div className="blog-meta">
                    <span className="blog-author">
                      <i className="fas fa-user"></i> {blog.author}
                    </span>
                    <span className="blog-date">
                      <i className="fas fa-calendar"></i> {new Date(blog.publishedAt || blog.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="read-more">
                    Read More <i className="fas fa-arrow-right"></i>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Blog;


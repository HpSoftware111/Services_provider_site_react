import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './BlogDetail.css';

const BlogDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadBlog();
  }, [slug]);

  const loadBlog = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/blogs/${slug}`);
      setBlog(response.data.blog);
    } catch (error) {
      setError('Blog not found');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (error || !blog) {
    return (
      <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <h2>Blog Not Found</h2>
        <p>The blog post you're looking for doesn't exist.</p>
        <button onClick={() => navigate('/blog')} className="btn-primary">
          <i className="fas fa-arrow-left"></i> Back to Blog
        </button>
      </div>
    );
  }

  return (
    <div className="blog-detail-page">
      <div className="container">
        <button onClick={() => navigate('/blog')} className="back-button">
          <i className="fas fa-arrow-left"></i> Back to Blog
        </button>
        
        <article className="blog-detail">
          <header className="blog-header">
            <h1>{blog.title}</h1>
            <div className="blog-meta">
              <span className="blog-author">
                <i className="fas fa-user"></i> {blog.author}
              </span>
              <span className="blog-date">
                <i className="fas fa-calendar"></i> {new Date(blog.publishedAt || blog.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
            {blog.summary && (
              <p className="blog-summary">{blog.summary}</p>
            )}
          </header>
          
          <div className="blog-content">
            {blog.content.split('\n').map((paragraph, index) => (
              paragraph.trim() && <p key={index}>{paragraph}</p>
            ))}
          </div>
          
          {blog.tags && Array.isArray(blog.tags) && blog.tags.length > 0 && (
            <div className="blog-tags">
              <i className="fas fa-tags"></i>
              {blog.tags.map((tag, index) => (
                <span key={index} className="tag">{tag}</span>
              ))}
            </div>
          )}
        </article>
      </div>
    </div>
  );
};

export default BlogDetail;


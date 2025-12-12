import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import './Bookmarks.css';

const Bookmarks = () => {
  const { user } = useContext(AuthContext);
  const [bookmarks, setBookmarks] = useState([]);

  useEffect(() => {
    // Fetch bookmarks from localStorage or API
    const savedBookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    setBookmarks(savedBookmarks);
  }, []);

  const handleRemoveBookmark = (businessId) => {
    const updatedBookmarks = bookmarks.filter(b => b.id !== businessId);
    setBookmarks(updatedBookmarks);
    localStorage.setItem('bookmarks', JSON.stringify(updatedBookmarks));
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
    <div className="bookmarks-container">
      <div className="bookmarks-header">
        <h1>Hello {user?.firstName || user?.name || 'User'}!</h1>
        <p className="last-login">
          You last logged in at: {formatLastLogin(user?.lastLogin)}
        </p>
      </div>

      <div className="bookmarks-content">
        <h2 className="section-title">
          <i className="fas fa-chevron-right"></i>
          My Bookmarks
        </h2>

        {bookmarks.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-bookmark"></i>
            <h3>No Bookmarks</h3>
            <p>You haven't bookmarked any businesses yet.</p>
            <Link to="/businesses" className="empty-state-btn">
              Browse Businesses
            </Link>
          </div>
        ) : (
          <div className="bookmarks-grid">
            {bookmarks.map(bookmark => (
              <div key={bookmark.id} className="bookmark-card">
                <div className="bookmark-image">
                  {bookmark.logo ? (
                    <img src={bookmark.logo} alt={bookmark.name} />
                  ) : (
                    <div className="no-image">
                      <i className="fas fa-building"></i>
                    </div>
                  )}
                </div>
                <div className="bookmark-info">
                  <h3>{bookmark.name}</h3>
                  <p className="bookmark-category">
                    <i className="fas fa-tag"></i>
                    {bookmark.category || 'Uncategorized'}
                  </p>
                  <p className="bookmark-address">
                    <i className="fas fa-map-marker-alt"></i>
                    {bookmark.address || 'No address'}
                  </p>
                  <div className="bookmark-actions">
                    <Link 
                      to={`/businesses/${bookmark.id}`} 
                      className="view-btn"
                    >
                      <i className="fas fa-eye"></i>
                      View
                    </Link>
                    <button 
                      onClick={() => handleRemoveBookmark(bookmark.id)} 
                      className="remove-btn"
                    >
                      <i className="fas fa-trash-alt"></i>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Bookmarks;


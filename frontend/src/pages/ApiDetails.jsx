import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './ApiDetails.css';

const ApiDetails = () => {
  const { user } = useContext(AuthContext);
  const [apiKey] = useState('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    <div className="api-details-container">
      <div className="api-header">
        <h1>Hello {user?.firstName || user?.name || 'User'}!</h1>
        <p className="last-login">
          You last logged in at: {formatLastLogin(user?.lastLogin)}
        </p>
      </div>

      <div className="api-content">
        <h2 className="section-title">
          <i className="fas fa-chevron-right"></i>
          API Details
        </h2>

        <div className="api-info-box">
          <div className="info-item">
            <label>
              <i className="fas fa-key"></i> API Key
            </label>
            <div className="api-key-container">
              <input
                type="text"
                value={apiKey}
                readOnly
                className="api-key-input"
              />
              <button onClick={handleCopy} className="copy-btn">
                <i className={`fas fa-${copied ? 'check' : 'copy'}`}></i>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="info-item">
            <label>
              <i className="fas fa-user"></i> User ID
            </label>
            <input
              type="text"
              value={user?.id || 'N/A'}
              readOnly
              className="info-input"
            />
          </div>

          <div className="info-item">
            <label>
              <i className="fas fa-envelope"></i> Email
            </label>
            <input
              type="text"
              value={user?.email || 'N/A'}
              readOnly
              className="info-input"
            />
          </div>

          <div className="info-item">
            <label>
              <i className="fas fa-calendar-alt"></i> Account Created
            </label>
            <input
              type="text"
              value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              readOnly
              className="info-input"
            />
          </div>
        </div>

        <div className="api-documentation">
          <h3>
            <i className="fas fa-book"></i> API Documentation
          </h3>
          <p>
            Use your API key to integrate with our services. Include the API key in your request headers:
          </p>
          <div className="code-block">
            <code>
              Authorization: Bearer {apiKey}
            </code>
          </div>
          <div className="api-endpoints">
            <h4>Available Endpoints:</h4>
            <ul>
              <li><strong>GET /api/businesses</strong> - List all businesses</li>
              <li><strong>GET /api/businesses/:id</strong> - Get business details</li>
              <li><strong>POST /api/reviews</strong> - Submit a review</li>
              <li><strong>GET /api/categories</strong> - List all categories</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiDetails;


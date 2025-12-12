import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-brand">
            <img src="/assets/images/logo.png" alt="CityLocal 101 Logo" className="footer-logo-img" />
            <p>Discover trusted local businesses, read verified reviews, and connect with professionals who serve your city.</p>
            <div className="footer-socials">
              <a href="https://www.facebook.com/" target="_blank" rel="noopener" aria-label="Facebook">
                <i className="fab fa-facebook-f"></i>
              </a>
              <a href="https://www.instagram.com/" target="_blank" rel="noopener" aria-label="Instagram">
                <i className="fab fa-instagram"></i>
              </a>
              <a href="https://www.linkedin.com/" target="_blank" rel="noopener" aria-label="LinkedIn">
                <i className="fab fa-linkedin-in"></i>
              </a>
            </div>
          </div>
          <div className="footer-columns">
            <div className="footer-column">
              <h4>Explore</h4>
              <ul>
                <li><Link to="/#categories">Browse Categories</Link></li>
                <li><Link to="/businesses">Business Directory</Link></li>
                <li><Link to="/search">Search</Link></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4>For Businesses</h4>
              <ul>
                <li><Link to="/add-business">Add Your Business for FREE</Link></li>
                <li><Link to="/write-review">Request Reviews</Link></li>
                <li><Link to="/support">Get Support</Link></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4>Company</h4>
              <ul>
                <li><Link to="/#about">About</Link></li>
                <li><Link to="/blog">Blog</Link></li>
                <li><Link to="/login">Member Login</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>Copyright ©2025 CityLocal 101. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;


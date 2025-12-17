import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Header.css';

const Header = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setShowProfileMenu(false);
    setMobileMenuOpen(false);
  };

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="logo">
            <Link to="/">
              <img src="/assets/images/logo.png" alt="CityLocal 101 Logo" className="logo-img" />
            </Link>
          </div>
          {/* Desktop Navigation */}
          <nav className={`nav desktop-only ${mobileMenuOpen ? 'active' : ''}`}>
            <ul className="nav-list">
              <li><Link to="/" className="home-link"><i className="fas fa-home"></i> Home</Link></li>
              <li><Link to="/businesses"><i className="fas fa-building"></i> Businesses</Link></li>
              <li><Link to="/blog"><i className="fas fa-blog"></i> Blog</Link></li>
              <li><Link to="/support"><i className="fas fa-headset"></i> Support</Link></li>
              {user && (
                <>
                  <li><Link to="/user-dashboard/my-business" className="btn-request-service-header"><i className="fas fa-plus-circle"></i> Add a Business</Link></li>
                  <li><Link to="/user-dashboard" className="btn-dashboard"><i className="fas fa-tachometer-alt"></i> Dashboard</Link></li>
                </>
              )}
              {!user && (
                <li><Link to="/add-business" className="btn-request-service-header"><i className="fas fa-plus-circle"></i> Add a Business</Link></li>
              )}
            </ul>
          </nav>
          {/* Profile/Login Section - Top Right */}
          <div className="header-auth-section">
            {user ? (
              <div className="profile-menu-wrapper">
                {/* Desktop Profile Button */}
                <button
                  className="profile-btn desktop-only"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  aria-label="Profile menu"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="profile-avatar-img"
                      key={user.avatar?.substring(0, 50)}
                    />
                  ) : (
                    <i className="fas fa-user-circle"></i>
                  )}
                </button>
                {/* Mobile Menu Button - Classic 3 Lines */}
                <button
                  className={`mobile-menu-toggle mobile-only ${mobileMenuOpen ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-label="Menu"
                >
                  <div className="hamburger-lines">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </button>
                {/* Desktop Profile Menu */}
                {showProfileMenu && (
                  <>
                    <div
                      className="profile-menu-overlay desktop-only"
                      onClick={() => setShowProfileMenu(false)}
                    ></div>
                    <div className="profile-menu desktop-only">
                      <div className="profile-menu-header">
                        <div className="profile-menu-icon">
                          {user.avatar ? (
                            <img
                              src={user.avatar}
                              alt={user.name}
                              className="profile-menu-avatar-img"
                              key={user.avatar?.substring(0, 50)}
                            />
                          ) : (
                            <i className="fas fa-user-circle"></i>
                          )}
                        </div>
                        <div className="profile-menu-name">{user.name}</div>
                        <div className="profile-menu-email">{user.email}</div>
                      </div>
                      <div className="profile-menu-divider"></div>
                      <div className="profile-menu-items">
                        <Link
                          to="/user-dashboard"
                          className="profile-menu-item"
                          onClick={() => setShowProfileMenu(false)}
                        >
                          <i className="fas fa-tachometer-alt"></i>
                          <span>Dashboard</span>
                        </Link>
                        <Link
                          to="/user-dashboard/account-settings"
                          className="profile-menu-item"
                          onClick={() => setShowProfileMenu(false)}
                        >
                          <i className="fas fa-user-cog"></i>
                          <span>My Profile</span>
                        </Link>
                        <div className="profile-menu-divider"></div>
                        <button
                          className="profile-menu-item logout-item"
                          onClick={handleLogout}
                        >
                          <i className="fas fa-sign-out-alt"></i>
                          <span>Logout</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
                {/* Mobile Unified Menu */}
                {mobileMenuOpen && (
                  <>
                    <div
                      className="mobile-menu-overlay mobile-only"
                      onClick={() => setMobileMenuOpen(false)}
                    ></div>
                    <div className="mobile-unified-menu mobile-only">
                      <div className="mobile-menu-header">
                        <div className="mobile-menu-user-info">
                          <div className="mobile-menu-avatar">
                            {user.avatar ? (
                              <img
                                src={user.avatar}
                                alt={user.name}
                                key={user.avatar?.substring(0, 50)}
                              />
                            ) : (
                              <i className="fas fa-user-circle"></i>
                            )}
                          </div>
                          <div>
                            <div className="mobile-menu-name">{user.name}</div>
                            <div className="mobile-menu-email">{user.email}</div>
                          </div>
                        </div>
                        <button
                          className="mobile-menu-close"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                      <div className="mobile-menu-divider"></div>
                      <nav className="mobile-menu-nav">
                        <Link
                          to="/"
                          className="mobile-menu-item"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <i className="fas fa-home"></i>
                          <span>Home</span>
                        </Link>
                        <Link
                          to="/businesses"
                          className="mobile-menu-item"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <i className="fas fa-building"></i>
                          <span>Businesses</span>
                        </Link>
                        <Link
                          to="/blog"
                          className="mobile-menu-item"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <i className="fas fa-blog"></i>
                          <span>Blog</span>
                        </Link>
                        <Link
                          to="/support"
                          className="mobile-menu-item"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <i className="fas fa-headset"></i>
                          <span>Support</span>
                        </Link>
                        <Link
                          to="/add-business"
                          className="mobile-menu-item mobile-menu-item-primary"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <i className="fas fa-plus-circle"></i>
                          <span>Add Your Business for FREE</span>
                        </Link>
                        <Link
                          to="/service-request"
                          className="mobile-menu-item mobile-menu-item-primary"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <i className="fas fa-clipboard-list"></i>
                          <span>Request Service</span>
                        </Link>
                        <div className="mobile-menu-divider"></div>
                        <Link
                          to="/user-dashboard"
                          className="mobile-menu-item"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <i className="fas fa-tachometer-alt"></i>
                          <span>Dashboard</span>
                        </Link>
                        <Link
                          to="/user-dashboard/account-settings"
                          className="mobile-menu-item"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <i className="fas fa-user-cog"></i>
                          <span>My Profile</span>
                        </Link>
                        <button
                          className="mobile-menu-item mobile-menu-item-logout"
                          onClick={handleLogout}
                        >
                          <i className="fas fa-sign-out-alt"></i>
                          <span>Logout</span>
                        </button>
                      </nav>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <Link to="/login" className="btn-login-header desktop-only">
                  <i className="fas fa-sign-in-alt"></i>
                  <span>Login</span>
                </Link>
                <button
                  className={`mobile-menu-toggle mobile-only ${mobileMenuOpen ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  <div className="hamburger-lines">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </button>
                {/* Mobile Menu for Non-Logged In Users */}
                {mobileMenuOpen && !user && (
                  <>
                    <div
                      className="mobile-menu-overlay mobile-only"
                      onClick={() => setMobileMenuOpen(false)}
                    ></div>
                    <div className="mobile-unified-menu mobile-only">
                      <div className="mobile-menu-header">
                        <h3>Menu</h3>
                        <button
                          className="mobile-menu-close"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                      <nav className="mobile-menu-nav">
                        <Link
                          to="/"
                          className="mobile-menu-item"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <i className="fas fa-home"></i>
                          <span>Home</span>
                        </Link>
                        <Link
                          to="/businesses"
                          className="mobile-menu-item"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <i className="fas fa-building"></i>
                          <span>Businesses</span>
                        </Link>
                        <Link
                          to="/blog"
                          className="mobile-menu-item"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <i className="fas fa-blog"></i>
                          <span>Blog</span>
                        </Link>
                        <Link
                          to="/support"
                          className="mobile-menu-item"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <i className="fas fa-headset"></i>
                          <span>Support</span>
                        </Link>
                        <Link
                          to="/add-business"
                          className="mobile-menu-item mobile-menu-item-primary"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <i className="fas fa-plus-circle"></i>
                          <span>Add Your Business for FREE</span>
                        </Link>
                        <div className="mobile-menu-divider"></div>
                        <Link
                          to="/login"
                          className="mobile-menu-item mobile-menu-item-login"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <i className="fas fa-sign-in-alt"></i>
                          <span>Login</span>
                        </Link>
                      </nav>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;


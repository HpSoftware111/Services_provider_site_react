import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import './BusinessDetail.css';

const BusinessDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [business, setBusiness] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapCoords, setMapCoords] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [contactFormStatus, setContactFormStatus] = useState({ success: '', error: '' });
  const [contactFormLoading, setContactFormLoading] = useState(false);

  useEffect(() => {
    loadBusiness();
  }, [id]);

  useEffect(() => {
    if (business) {
      loadMapCoordinates();
    }
  }, [business]);

  const loadBusiness = async () => {
    try {
      const [businessRes, reviewsRes] = await Promise.all([
        api.get(`/businesses/${id}`),
        api.get(`/reviews?business=${id}`)
      ]);
      setBusiness(businessRes.data.business);
      setReviews(reviewsRes.data.reviews || []);
    } catch (error) {
      console.error('Error loading business:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMapCoordinates = async () => {
    if (business?.latitude && business?.longitude) {
      setMapCoords({
        lat: parseFloat(business.latitude),
        lng: parseFloat(business.longitude)
      });
      setMapLoading(false);
      return;
    }

    if (!business?.address || !business?.city || !business?.state) {
      setMapLoading(false);
      return;
    }

    // Build full address for map display
    const fullAddress = `${business.address}, ${business.city}, ${business.state} ${business.zipCode || ''}`.trim();
    setMapCoords({
      address: fullAddress
    });
    setMapLoading(false);
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactFormStatus({ success: '', error: '' });
    setContactFormLoading(true);

    try {
      await api.post(`/businesses/${id}/contact`, contactForm);
      setContactFormStatus({
        success: 'Your message has been sent to the administrator.',
        error: ''
      });
      setContactForm({ name: '', email: '', phone: '', message: '' });
    } catch (error) {
      setContactFormStatus({
        success: '',
        error: error.response?.data?.error || 'Failed to send message. Please try again.'
      });
    } finally {
      setContactFormLoading(false);
    }
  };

  const handleClaimBusiness = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      await api.post(`/businesses/${id}/claim`);
      alert('Your claim request has been submitted. An admin will review it shortly.');
      loadBusiness();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to submit claim request.');
    }
  };

  const formatHours = (hours) => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    return days
      .map((day, index) => {
        const dayHours = hours?.[day];
        if (!dayHours || (!dayHours.open && !dayHours.close && !dayHours.closed)) {
          return null;
        }
        return {
          day: dayNames[index],
          hours: dayHours.closed ? 'Closed' : (dayHours.open && dayHours.close ? `${dayHours.open} - ${dayHours.close}` : 'Not specified')
        };
      })
      .filter(item => item !== null);
  };

  const getMediaItems = () => {
    const items = [];

    let images = [];
    if (business?.images) {
      if (Array.isArray(business.images)) {
        images = business.images;
      } else if (typeof business.images === 'string') {
        try {
          images = JSON.parse(business.images);
          if (!Array.isArray(images)) {
            images = [];
          }
        } catch (e) {
          images = [];
        }
      }
    }

    if (images.length > 0) {
      images.forEach(img => {
        if (img) {
          items.push({ type: 'image', url: img });
        }
      });
    }

    let videos = [];
    if (business?.videos) {
      if (Array.isArray(business.videos)) {
        videos = business.videos;
      } else if (typeof business.videos === 'string') {
        try {
          videos = JSON.parse(business.videos);
          if (!Array.isArray(videos)) {
            videos = [];
          }
        } catch (e) {
          videos = [];
        }
      }
    }

    if (videos.length > 0) {
      videos.forEach(video => {
        if (video) {
          items.push({ type: 'video', url: video });
        }
      });
    }

    return items;
  };

  const mediaItems = business ? getMediaItems() : [];

  const renderStars = (rating) => {
    const numRating = parseInt(rating) || 0;
    return (
      <>
        {'★'.repeat(numRating)}
        {'☆'.repeat(5 - numRating)}
      </>
    );
  };

  const getRatingPercentage = (rating) => {
    return ((parseFloat(rating) || 0) / 5) * 100;
  };

  if (loading) {
    return (
      <div className="business-detail-loading">
        <div className="loading-spinner"></div>
        <p>Loading business details...</p>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="business-detail-error">
        <i className="fas fa-exclamation-circle"></i>
        <h2>Business Not Found</h2>
        <p>The business you're looking for doesn't exist or has been removed.</p>
        <button onClick={() => navigate('/')} className="btn-primary">Go to Home</button>
      </div>
    );
  }

  const isOwner = user && business.ownerId === user.id;
  const canClaim = user && !business.ownerId && business.claimedAt === null;
  const rating = parseFloat(business.ratingAverage) || 0;
  const reviewCount = business.ratingCount || 0;

  return (
    <div className="business-detail-page">
      {/* Hero Header Section */}
      <div className="business-hero">
        <div className="business-hero-background"></div>
        <div className="business-hero-content">
          <div className="business-hero-main">
            {business.logo && (
              <div className="business-logo-container">
                <img src={business.logo} alt={`${business.name} logo`} />
                {business.isVerified && (
                  <div className="verified-badge">
                    <i className="fas fa-check-circle"></i>
                  </div>
                )}
              </div>
            )}
            <div className="business-hero-info">
              <div className="business-title-row">
                <h1>{business.name}</h1>
                {business.isVerified && !business.logo && (
                  <span className="verified-label">
                    <i className="fas fa-check-circle"></i>
                    Verified
                  </span>
                )}
                {business.isFeatured && (
                  <span className="featured-label">
                    <i className="fas fa-star"></i>
                    Featured
                  </span>
                )}
              </div>

              {business.category && (
                <div className="business-category-tag">
                  <i className="fas fa-tag"></i>
                  {business.category.name}
                </div>
              )}

              <div className="business-rating-display">
                <div className="rating-stars-large">
                  <span className="stars-filled">{'★'.repeat(Math.floor(rating))}</span>
                  <span className="stars-empty">{'☆'.repeat(5 - Math.floor(rating))}</span>
                </div>
                <div className="rating-details">
                  <span className="rating-value">{rating.toFixed(1)}</span>
                  <span className="rating-separator">•</span>
                  <span className="rating-count">{reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Claim Banner */}
      {canClaim && (
        <div className="claim-banner">
          <div className="claim-banner-content">
            <i className="fas fa-info-circle"></i>
            <div>
              <strong>Is this your business?</strong>
              <p>Claim it to manage your listing and respond to reviews.</p>
            </div>
            <button className="btn-claim-business" onClick={handleClaimBusiness}>
              Claim This Business
            </button>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <div className="business-content-wrapper">
        <div className="business-main-content">
          {/* About Section */}
          <section className="info-section">
            <div className="section-header">
              <i className="fas fa-info-circle"></i>
              <h2>About</h2>
            </div>
            <div className="section-content">
              <p className="business-description">{business.description}</p>
              {business.tags && Array.isArray(business.tags) && business.tags.length > 0 && (
                <div className="business-tags">
                  {business.tags.map((tag, index) => (
                    <span key={index} className="tag-item">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Media Gallery */}
          {mediaItems.length > 0 && (
            <section className="info-section">
              <div className="section-header">
                <i className="fas fa-images"></i>
                <h2>Photos & Videos</h2>
                <span className="media-count">{mediaItems.length} {mediaItems.length === 1 ? 'item' : 'items'}</span>
              </div>
              <div className="section-content">
                <div className="media-gallery-container">
                  <div className="media-main-display" onClick={() => mediaItems.length > 0 && setShowMediaModal(true)}>
                    {mediaItems[activeMediaIndex]?.type === 'image' ? (
                      <img
                        src={mediaItems[activeMediaIndex].url}
                        alt={`${business.name} - ${activeMediaIndex + 1}`}
                      />
                    ) : (
                      <video
                        src={mediaItems[activeMediaIndex]?.url}
                        controls
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    {mediaItems.length > 1 && (
                      <div className="media-overlay">
                        <i className="fas fa-expand"></i>
                        <span>Click to view fullscreen</span>
                      </div>
                    )}
                  </div>
                  {mediaItems.length > 1 && (
                    <div className="media-thumbnails-grid">
                      {mediaItems.map((item, index) => (
                        <div
                          key={index}
                          className={`media-thumbnail ${index === activeMediaIndex ? 'active' : ''}`}
                          onClick={() => setActiveMediaIndex(index)}
                        >
                          {item.type === 'image' ? (
                            <img src={item.url} alt={`Thumbnail ${index + 1}`} />
                          ) : (
                            <div className="video-thumbnail">
                              <i className="fas fa-play-circle"></i>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Reviews Section */}
          <section className="info-section">
            <div className="section-header">
              <i className="fas fa-star"></i>
              <h2>Customer Reviews</h2>
              <span className="review-summary">{reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</span>
            </div>
            <div className="section-content">
              {reviews.length === 0 ? (
                <div className="no-reviews-state">
                  <i className="fas fa-comment-slash"></i>
                  <h3>No reviews yet</h3>
                  <p>Be the first to review this business!</p>
                  <button
                    className="btn-primary"
                    onClick={() => navigate('/write-review', { state: { businessId: id, businessName: business.name } })}
                  >
                    <i className="fas fa-pen"></i>
                    Write a Review
                  </button>
                </div>
              ) : (
                <>
                  <div className="reviews-list">
                    {reviews.map((review) => (
                      <div key={review.id} className="review-item">
                        <div className="review-header">
                          <div className="review-user-info">
                            <div className="review-avatar">
                              <i className="fas fa-user"></i>
                            </div>
                            <div>
                              <div className="review-user-name">{review.user?.name || 'Anonymous'}</div>
                              <div className="review-date">
                                {new Date(review.createdAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </div>
                            </div>
                          </div>
                          <div className="review-rating">
                            <span className="review-stars">{renderStars(review.rating)}</span>
                          </div>
                        </div>
                        {review.title && (
                          <h4 className="review-title">{review.title}</h4>
                        )}
                        <p className="review-text">{review.comment}</p>
                      </div>
                    ))}
                  </div>
                  <div className="write-review-cta">
                    <button
                      className="btn-primary btn-full-width"
                      onClick={() => navigate('/write-review', { state: { businessId: id, businessName: business.name } })}
                    >
                      <i className="fas fa-pen"></i>
                      Write a Review
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Location Section */}
          <section className="info-section">
            <div className="section-header">
              <i className="fas fa-map-marker-alt"></i>
              <h2>Location</h2>
            </div>
            <div className="section-content">
              <div className="location-details">
                <div className="address-info">
                  <i className="fas fa-map-marker-alt"></i>
                  <div>
                    <p className="address-line">{business.address}</p>
                    <p className="address-city-state">
                      {business.city}, {business.state} {business.zipCode}
                    </p>
                  </div>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.address}, ${business.city}, ${business.state} ${business.zipCode || ''}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-map-link"
                >
                  <i className="fas fa-external-link-alt"></i>
                  View on Google Maps
                </a>
              </div>

              {mapCoords && (mapCoords.lat || mapCoords.address) ? (
                <div className="map-container">
                  {mapCoords.lat && mapCoords.lng ? (
                    <iframe
                      title="Business Location"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapCoords.lng - 0.01},${mapCoords.lat - 0.01},${mapCoords.lng + 0.01},${mapCoords.lat + 0.01}&layer=mapnik&marker=${mapCoords.lat},${mapCoords.lng}`}
                      style={{ border: 0, width: '100%', height: '100%', minHeight: '400px' }}
                      allowFullScreen
                      loading="lazy"
                    ></iframe>
                  ) : (
                    <iframe
                      title="Business Location"
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(mapCoords.address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                      style={{ border: 0, width: '100%', height: '100%', minHeight: '400px' }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    ></iframe>
                  )}
                  <div className="map-overlay">
                    <a
                      href={mapCoords.lat && mapCoords.lng
                        ? `https://www.openstreetmap.org/?mlat=${mapCoords.lat}&mlon=${mapCoords.lng}&zoom=15`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapCoords.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="map-link-button"
                    >
                      <i className="fas fa-external-link-alt"></i>
                      View Larger Map
                    </a>
                  </div>
                </div>
              ) : (
                <div className="map-container">
                  <div className="map-placeholder">
                    <i className="fas fa-map-marked-alt"></i>
                    <p className="map-address-text">
                      {business.address}<br />
                      {business.city}, {business.state} {business.zipCode || ''}
                    </p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.address}, ${business.city}, ${business.state} ${business.zipCode || ''}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-map-link"
                    >
                      <i className="fas fa-external-link-alt"></i>
                      View on Google Maps
                    </a>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Contact Form Section */}
          <section className="info-section">
            <div className="section-header">
              <i className="fas fa-envelope"></i>
              <h2>Send a Message</h2>
            </div>
            <div className="section-content">
              <p className="form-description">Have a question? Send a message directly to Administrator.</p>

              {contactFormStatus.success && (
                <div className="alert alert-success">
                  <i className="fas fa-check-circle"></i>
                  {contactFormStatus.success}
                </div>
              )}
              {contactFormStatus.error && (
                <div className="alert alert-error">
                  <i className="fas fa-exclamation-circle"></i>
                  {contactFormStatus.error}
                </div>
              )}

              <form onSubmit={handleContactSubmit} className="contact-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="contact-name">Your Name *</label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      placeholder="Enter your name"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="contact-email">Your Email *</label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="Enter your email"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="contact-phone">Phone Number</label>
                  <input
                    id="contact-phone"
                    type="tel"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    placeholder="Enter your phone (optional)"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="contact-message">Message *</label>
                  <textarea
                    id="contact-message"
                    required
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    placeholder="Write your message here..."
                    rows="5"
                  ></textarea>
                </div>
                <button type="submit" className="btn-primary btn-full-width" disabled={contactFormLoading}>
                  {contactFormLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      Sending...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-paper-plane"></i>
                      Send Message
                    </>
                  )}
                </button>
              </form>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="business-sidebar">
          {/* Quick Info Card */}
          <div className="sidebar-card">
            <h3 className="sidebar-card-title">
              <i className="fas fa-info-circle"></i>
              Quick Info
            </h3>
            <div className="quick-info-list">
              {business.phone && (
                <div className="quick-info-item">
                  <i className="fas fa-phone"></i>
                  <a href={`tel:${business.phone}`}>{business.phone}</a>
                </div>
              )}
              {business.email && (
                <div className="quick-info-item">
                  <i className="fas fa-envelope"></i>
                  <a href={`mailto:${business.email}`}>{business.email}</a>
                </div>
              )}
              {business.website && (
                <div className="quick-info-item">
                  <i className="fas fa-globe"></i>
                  <a href={business.website} target="_blank" rel="noopener noreferrer">
                    Visit Website
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Business Hours */}
          {business.hours && Object.keys(business.hours).length > 0 && (
            <div className="sidebar-card">
              <h3 className="sidebar-card-title">
                <i className="fas fa-clock"></i>
                Business Hours
              </h3>
              <div className="hours-list">
                {formatHours(business.hours).map((item, index) => (
                  <div key={index} className="hours-item">
                    <span className="hours-day">{item.day}</span>
                    <span className={`hours-time ${item.hours === 'Closed' ? 'closed' : ''}`}>
                      {item.hours}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Social Links */}
          {(business.socialLinks?.facebook || business.socialLinks?.twitter || business.socialLinks?.instagram || business.socialLinks?.linkedin) && (
            <div className="sidebar-card">
              <h3 className="sidebar-card-title">
                <i className="fas fa-share-alt"></i>
                Follow Us
              </h3>
              <div className="social-links-grid">
                {business.socialLinks?.facebook && (
                  <a href={business.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="social-link-btn facebook">
                    <i className="fab fa-facebook-f"></i>
                    <span>Facebook</span>
                  </a>
                )}
                {business.socialLinks?.twitter && (
                  <a href={business.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="social-link-btn twitter">
                    <i className="fab fa-twitter"></i>
                    <span>Twitter</span>
                  </a>
                )}
                {business.socialLinks?.instagram && (
                  <a href={business.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="social-link-btn instagram">
                    <i className="fab fa-instagram"></i>
                    <span>Instagram</span>
                  </a>
                )}
                {business.socialLinks?.linkedin && (
                  <a href={business.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="social-link-btn linkedin">
                    <i className="fab fa-linkedin-in"></i>
                    <span>LinkedIn</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Owner Actions */}
          {isOwner && (
            <div className="sidebar-card owner-card">
              <h3 className="sidebar-card-title">
                <i className="fas fa-user-shield"></i>
                Owner Dashboard
              </h3>
              <button
                onClick={() => navigate('/user-dashboard')}
                className="btn-primary btn-full-width"
              >
                <i className="fas fa-edit"></i>
                Manage Your Listing
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* Media Modal */}
      {showMediaModal && mediaItems.length > 0 && (
        <div className="media-modal" onClick={() => setShowMediaModal(false)}>
          <div className="media-modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowMediaModal(false)}>
              <i className="fas fa-times"></i>
            </button>
            {mediaItems[activeMediaIndex]?.type === 'image' ? (
              <img src={mediaItems[activeMediaIndex].url} alt={business.name} />
            ) : (
              <video src={mediaItems[activeMediaIndex]?.url} controls autoPlay />
            )}
            {mediaItems.length > 1 && (
              <div className="modal-navigation">
                <button
                  className="modal-nav-btn prev"
                  onClick={() => setActiveMediaIndex(i => i === 0 ? mediaItems.length - 1 : i - 1)}
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
                <span className="modal-counter">{activeMediaIndex + 1} / {mediaItems.length}</span>
                <button
                  className="modal-nav-btn next"
                  onClick={() => setActiveMediaIndex(i => i === mediaItems.length - 1 ? 0 : i + 1)}
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessDetail;

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import './BusinessProfile.css';

const BusinessProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      // Fetch user profile and their businesses
      const [userRes, businessesRes] = await Promise.all([
        api.get(`/admin/users/${userId}`).catch(() => ({ data: { user: null } })),
        api.get(`/businesses?ownerId=${userId}&publicOnly=true`)
      ]);
      
      setUser(userRes.data.user);
      const userBusinesses = businessesRes.data.businesses || [];
      
      // Fetch full details for each business including subcategory
      const businessesWithDetails = await Promise.all(
        userBusinesses.map(async (business) => {
          try {
            const fullBusinessRes = await api.get(`/businesses/${business.id}`);
            return fullBusinessRes.data.business || business;
          } catch (error) {
            return business;
          }
        })
      );
      
      setBusinesses(businessesWithDetails);

      // Fetch promotions and reviews for all businesses
      const allPromotions = [];
      const allReviews = [];
      
      for (const business of userBusinesses) {
        if (business.promotions && Array.isArray(business.promotions) && business.promotions.length > 0) {
          allPromotions.push(...business.promotions.map(p => ({ ...p, businessId: business.id, businessName: business.name })));
        }
        
        try {
          const reviewsRes = await api.get(`/reviews?business=${business.id}`);
          if (reviewsRes.data.reviews) {
            allReviews.push(...reviewsRes.data.reviews.map(r => ({ ...r, businessId: business.id, businessName: business.name })));
          }
        } catch (error) {
          // Reviews might not exist
        }
      }
      
      setPromotions(allPromotions);
      setReviews(allReviews);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating) => {
    const numRating = parseFloat(rating) || 0;
    const fullStars = Math.floor(numRating);
    const stars = [];
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<i key={i} className="fas fa-star filled"></i>);
      } else {
        stars.push(<i key={i} className="far fa-star"></i>);
      }
    }
    return stars;
  };

  const getFirstImage = (business) => {
    if (business.images && Array.isArray(business.images) && business.images.length > 0) {
      return business.images[0];
    }
    if (business.logo) {
      return business.logo;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="business-profile-page">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="business-profile-page">
        <div className="empty-state">
          <i className="fas fa-user-slash"></i>
          <h2>User not found</h2>
          <p>The profile you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="business-profile-page">
      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-avatar">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} />
          ) : (
            <i className="fas fa-user-circle"></i>
          )}
        </div>
        <div className="profile-info">
          <h1>{user.name}</h1>
          {user.email && (
            <p className="profile-email">
              <i className="fas fa-envelope"></i> {user.email}
            </p>
          )}
          {user.phone && (
            <p className="profile-phone">
              <i className="fas fa-phone"></i> {user.phone}
            </p>
          )}
          <div className="profile-stats">
            <div className="stat-badge">
              <i className="fas fa-building"></i>
              <span>{businesses.length} {businesses.length === 1 ? 'Business' : 'Businesses'}</span>
            </div>
            {reviews.length > 0 && (
              <div className="stat-badge">
                <i className="fas fa-star"></i>
                <span>{reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Businesses Section */}
      <div className="profile-section">
        <h2 className="section-title">
          <i className="fas fa-building"></i> Businesses ({businesses.length})
        </h2>
        {businesses.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-store-slash"></i>
            <p>No public businesses available</p>
          </div>
        ) : (
          <div className="businesses-grid">
            {businesses.map(business => {
              const firstImage = getFirstImage(business);
              const rating = parseFloat(business.ratingAverage) || 0;
              const reviewCount = business.ratingCount || 0;
              
              return (
                <div 
                  key={business.id} 
                  className="business-card"
                  onClick={() => navigate(`/businesses/${business.id}`)}
                >
                  {/* Image Section */}
                  <div className="business-card-image">
                    {firstImage ? (
                      <img src={firstImage} alt={business.name} />
                    ) : (
                      <div className="business-card-placeholder">
                        <i className="fas fa-building"></i>
                      </div>
                    )}
                    {business.isVerified && (
                      <div className="verified-badge-corner">
                        <i className="fas fa-check-circle"></i>
                        <span>Verified</span>
                      </div>
                    )}
                    {business.isFeatured && (
                      <div className="featured-badge-corner">
                        <i className="fas fa-star"></i>
                        <span>Featured</span>
                      </div>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="business-card-content">
                    <div className="business-card-header">
                      <h3>{business.name}</h3>
                    </div>

                    {/* Category */}
                    {business.category && (
                      <div className="business-card-category">
                        <i className="fas fa-tag"></i>
                        {business.category.name}
                        {business.subCategory && business.subCategory.name && (
                          <span className="subcategory"> • {business.subCategory.name}</span>
                        )}
                      </div>
                    )}

                    {/* Rating */}
                    <div className="business-card-rating">
                      <div className="rating-stars">{renderStars(rating)}</div>
                      <span className="rating-value">{rating.toFixed(1)}</span>
                      <span className="rating-separator">•</span>
                      <span className="rating-count">{reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</span>
                    </div>

                    {/* Location */}
                    <div className="business-card-location">
                      <i className="fas fa-map-marker-alt"></i>
                      <span>
                        {business.city}, {business.state}
                      </span>
                    </div>

                    {/* Description Preview */}
                    {business.description && (
                      <p className="business-card-description">
                        {business.description.length > 120 
                          ? `${business.description.substring(0, 120)}...` 
                          : business.description}
                      </p>
                    )}

                    {/* Quick Info */}
                    <div className="business-card-quick-info">
                      {business.phone && (
                        <div className="quick-info-item">
                          <i className="fas fa-phone"></i>
                          <span>{business.phone}</span>
                        </div>
                      )}
                      {business.website && (
                        <div className="quick-info-item">
                          <i className="fas fa-globe"></i>
                          <span>Website</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* View Button */}
                  <div className="business-card-footer">
                    <button 
                      className="view-business-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/businesses/${business.id}`);
                      }}
                    >
                      View Full Details
                      <i className="fas fa-arrow-right"></i>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Promotions Section */}
      {promotions.length > 0 && (
        <div className="profile-section">
          <h2 className="section-title">
            <i className="fas fa-tags"></i> Current Promotions ({promotions.length})
          </h2>
          <div className="promotions-grid">
            {promotions.map((promo, index) => (
              <div key={index} className="promotion-card">
                <div className="promo-header">
                  <h4>{promo.title}</h4>
                  <span className="promo-business">{promo.businessName}</span>
                </div>
                <p className="promo-description">{promo.description}</p>
                {promo.discount && (
                  <div className="promo-discount">
                    <i className="fas fa-percent"></i> {promo.discount}
                  </div>
                )}
                {promo.validUntil && (
                  <div className="promo-valid">
                    <i className="fas fa-calendar"></i> Valid until {new Date(promo.validUntil).toLocaleDateString()}
                  </div>
                )}
                <button 
                  className="promo-view-btn" 
                  onClick={() => navigate(`/businesses/${promo.businessId}`)}
                >
                  View Business <i className="fas fa-arrow-right"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews Section */}
      {reviews.length > 0 && (
        <div className="profile-section">
          <h2 className="section-title">
            <i className="fas fa-star"></i> Customer Reviews ({reviews.length})
          </h2>
          <div className="reviews-list">
            {reviews.map((review) => (
              <div key={review.id} className="review-card">
                <div className="review-header">
                  <div className="reviewer-info">
                    <div className="reviewer-avatar">
                      {review.user?.avatar ? (
                        <img src={review.user.avatar} alt={review.user.name} />
                      ) : (
                        <i className="fas fa-user-circle"></i>
                      )}
                    </div>
                    <div>
                      <div className="reviewer-name">{review.user?.name || 'Anonymous'}</div>
                      <div className="review-business">{review.businessName}</div>
                    </div>
                  </div>
                  <div className="review-rating">
                    <div className="stars">{renderStars(review.rating)}</div>
                    <span className="review-date">{new Date(review.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                {review.title && <h4 className="review-title">{review.title}</h4>}
                {review.comment && <p className="review-text">{review.comment}</p>}
                <button 
                  className="review-view-btn" 
                  onClick={() => navigate(`/businesses/${review.businessId}`)}
                >
                  View Business <i className="fas fa-arrow-right"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessProfile;

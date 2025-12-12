import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ReviewForm.css';

const ReviewForm = ({ serviceRequestId, onSuccess, onCancel, existingReview }) => {
    const [rating, setRating] = useState(existingReview?.rating || 0);
    const [hoveredRating, setHoveredRating] = useState(0);
    const [title, setTitle] = useState(existingReview?.title || '');
    const [comment, setComment] = useState(existingReview?.comment || '');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    // If existingReview is provided, load it
    useEffect(() => {
        if (existingReview) {
            setRating(existingReview.rating);
            setTitle(existingReview.title);
            setComment(existingReview.comment);
        } else if (serviceRequestId) {
            // Try to load existing review
            loadExistingReview();
        }
    }, [serviceRequestId, existingReview]);

    const loadExistingReview = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/service-requests/my/service-requests/${serviceRequestId}/review`);
            if (response.data.success && response.data.data) {
                const review = response.data.data;
                setRating(review.rating);
                setTitle(review.title);
                setComment(review.comment);
            }
        } catch (err) {
            // Review doesn't exist yet, that's okay (404 is expected)
            if (err.response?.status === 404) {
                // Check if metadata column is missing (this is a configuration issue)
                if (err.response?.data?.metadataColumnMissing) {
                    console.warn('[ReviewForm] Review not found - metadata column is missing from database. Please run migration.');
                    // Don't show error to user, just log it
                }
                // 404 is expected when no review exists yet - silently handle it
            } else {
                // Other errors should be logged
                console.error('Error loading review:', err);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (rating < 1 || rating > 5) {
            setError('Please select a rating (1-5 stars)');
            return;
        }

        if (!title.trim()) {
            setError('Please enter a review title');
            return;
        }

        if (title.trim().length > 100) {
            setError('Review title must be 100 characters or less');
            return;
        }

        if (!comment.trim()) {
            setError('Please enter a review comment');
            return;
        }

        if (comment.trim().length > 1000) {
            setError('Review comment must be 1000 characters or less');
            return;
        }

        setSubmitting(true);

        try {
            const response = await api.post(
                `/service-requests/my/service-requests/${serviceRequestId}/review`,
                {
                    rating: rating,
                    title: title.trim(),
                    comment: comment.trim()
                }
            );

            if (response.data.success) {
                if (onSuccess) {
                    onSuccess(response.data);
                }
            } else {
                setError(response.data.error || 'Failed to submit review');
            }
        } catch (err) {
            console.error('Error submitting review:', err);
            setError(err.response?.data?.error || 'Failed to submit review. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const renderStars = () => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <button
                    key={i}
                    type="button"
                    className={`star-button ${i <= (hoveredRating || rating) ? 'active' : ''}`}
                    onClick={() => setRating(i)}
                    onMouseEnter={() => setHoveredRating(i)}
                    onMouseLeave={() => setHoveredRating(0)}
                    disabled={submitting}
                    aria-label={`Rate ${i} star${i > 1 ? 's' : ''}`}
                >
                    <i className="fas fa-star"></i>
                </button>
            );
        }
        return stars;
    };

    const getRatingLabel = (ratingValue) => {
        const labels = {
            1: 'Poor',
            2: 'Fair',
            3: 'Good',
            4: 'Very Good',
            5: 'Excellent'
        };
        return labels[ratingValue] || '';
    };

    if (loading) {
        return (
            <div className="review-form-loading">
                <i className="fas fa-spinner fa-spin"></i>
                <p>Loading review...</p>
            </div>
        );
    }

    return (
        <form className="review-form" onSubmit={handleSubmit}>
            <div className="review-form-header">
                <h3>
                    <i className="fas fa-star"></i>
                    {existingReview ? 'Your Review' : 'Leave a Review'}
                </h3>
                {existingReview && (
                    <p className="review-submitted-notice">
                        <i className="fas fa-check-circle"></i>
                        Review submitted on {new Date(existingReview.createdAt).toLocaleDateString()}
                    </p>
                )}
            </div>

            {error && (
                <div className="review-error">
                    <i className="fas fa-exclamation-circle"></i>
                    {error}
                </div>
            )}

            <div className="review-field">
                <label>
                    Rating <span className="required">*</span>
                </label>
                <div className="rating-container">
                    <div className="stars-input">
                        {renderStars()}
                    </div>
                    {rating > 0 && (
                        <span className="rating-label">
                            {rating} {rating === 1 ? 'star' : 'stars'} - {getRatingLabel(rating)}
                        </span>
                    )}
                </div>
            </div>

            <div className="review-field">
                <label htmlFor="review-title">
                    Review Title <span className="required">*</span>
                </label>
                <input
                    id="review-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Great service, highly recommended!"
                    maxLength={100}
                    disabled={submitting || !!existingReview}
                    required
                />
                <small className="field-hint">
                    {title.length}/100 characters
                </small>
            </div>

            <div className="review-field">
                <label htmlFor="review-comment">
                    Your Review <span className="required">*</span>
                </label>
                <textarea
                    id="review-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your experience with this service provider..."
                    rows={6}
                    maxLength={1000}
                    disabled={submitting || !!existingReview}
                    required
                />
                <small className="field-hint">
                    {comment.length}/1000 characters
                </small>
            </div>

            {!existingReview && (
                <div className="review-actions">
                    {onCancel && (
                        <button
                            type="button"
                            className="btn-cancel-review"
                            onClick={onCancel}
                            disabled={submitting}
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="submit"
                        className="btn-submit-review"
                        disabled={submitting || rating < 1 || !title.trim() || !comment.trim()}
                    >
                        {submitting ? (
                            <>
                                <i className="fas fa-spinner fa-spin"></i>
                                Submitting...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-paper-plane"></i>
                                Submit Review
                            </>
                        )}
                    </button>
                </div>
            )}

            {existingReview && (
                <div className="review-submitted-info">
                    <p>
                        <i className="fas fa-info-circle"></i>
                        This review has already been submitted and cannot be edited.
                    </p>
                </div>
            )}
        </form>
    );
};

export default ReviewForm;


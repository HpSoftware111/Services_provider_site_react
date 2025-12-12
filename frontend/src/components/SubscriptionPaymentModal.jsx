import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements,
    CardElement,
    useStripe,
    useElements
} from '@stripe/react-stripe-js';
import api from '../services/api';
import './SubscriptionPaymentModal.css';

// Initialize Stripe
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
if (!stripePublishableKey || stripePublishableKey === 'pk_test_placeholder') {
    console.warn('⚠️ VITE_STRIPE_PUBLISHABLE_KEY not configured. Stripe payments will not work.');
}
const stripePromise = loadStripe(stripePublishableKey || 'pk_test_placeholder');

const SubscriptionPaymentForm = ({ plan, onSuccess, onError, onClose }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [clientSecret, setClientSecret] = useState(null);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        // Create payment intent
        const initializePayment = async () => {
            try {
                const response = await api.post('/subscriptions/create-payment-intent', {
                    subscriptionPlanId: plan.id
                });

                if (response.data.success) {
                    const receivedClientSecret = response.data.clientSecret;
                    if (!receivedClientSecret) {
                        setError('Payment configuration error: No client secret received');
                        setLoading(false);
                        return;
                    }
                    setClientSecret(receivedClientSecret);
                } else {
                    setError(response.data.error || 'Failed to initialize payment');
                }
            } catch (err) {
                console.error('Error initializing payment:', err);
                setError(err.response?.data?.error || 'Failed to initialize payment');
            } finally {
                setLoading(false);
            }
        };

        initializePayment();
    }, [plan.id]);

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!stripe || !elements || !clientSecret) {
            setError('Payment system not ready. Please wait a moment and try again.');
            return;
        }

        setProcessing(true);
        setError(null);

        try {
            const cardElement = elements.getElement(CardElement);

            // Confirm payment
            const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: cardElement,
                    billing_details: {
                        name: plan.name || 'Subscription'
                    }
                }
            });

            if (stripeError) {
                console.error('Stripe payment error:', stripeError);
                setError(stripeError.message || 'Payment failed. Please try again.');
                setProcessing(false);
                return;
            }

            if (paymentIntent && paymentIntent.status === 'succeeded') {
                // Payment succeeded, now activate subscription
                try {
                    const subscribeResponse = await api.post('/subscriptions/subscribe', {
                        subscriptionPlanId: plan.id,
                        paymentIntentId: paymentIntent.id
                    });

                    if (subscribeResponse.data.success) {
                        onSuccess({
                            paymentIntentId: paymentIntent.id,
                            subscription: subscribeResponse.data.subscription,
                            status: 'succeeded'
                        });
                    } else {
                        setError(subscribeResponse.data.error || 'Subscription activation failed');
                        setProcessing(false);
                    }
                } catch (subscribeError) {
                    console.error('Subscription activation error:', subscribeError);
                    setError(subscribeError.response?.data?.error || 'Payment succeeded but subscription activation failed. Please contact support.');
                    setProcessing(false);
                }
            } else {
                setError('Payment not completed. Please try again.');
                setProcessing(false);
            }
        } catch (err) {
            console.error('Payment processing error:', err);
            setError(err.message || 'An error occurred during payment processing');
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="subscription-payment-overlay" onClick={onClose}>
                <div className="subscription-payment-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="subscription-payment-loading">
                        <div className="loading-spinner"></div>
                        <h3>Preparing Your Subscription</h3>
                        <p>Setting up secure payment...</p>
                    </div>
                </div>
            </div>
        );
    }

    const planPrice = parseFloat(plan.price || 0);
    const billingPeriod = plan.billingCycle === 'YEARLY' ? 'year' : 'month';

    return (
        <div className="subscription-payment-overlay" onClick={onClose}>
            <div className="subscription-payment-modal" onClick={(e) => e.stopPropagation()}>
                <div className="subscription-payment-header">
                    <div className="header-content">
                        <div className="header-icon">
                            <i className="fas fa-crown"></i>
                        </div>
                        <div className="header-text">
                            <h2>Complete Your Subscription</h2>
                            <p>Secure payment powered by Stripe</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="close-button" disabled={processing}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="subscription-payment-content">
                    {/* Plan Summary Card */}
                    <div className="plan-summary-card">
                        <div className="plan-header-section">
                            <div className="plan-badge-badge">
                                <span>{plan.tier || 'PLAN'}</span>
                            </div>
                            <h3>{plan.name}</h3>
                            <div className="plan-price-display">
                                <span className="price-amount">${planPrice.toFixed(2)}</span>
                                <span className="price-period">/{billingPeriod}</span>
                            </div>
                        </div>

                        {/* Plan Features */}
                        {(plan.leadDiscountPercent > 0 || plan.priorityBoostPoints > 0 || plan.isFeatured || plan.hasAdvancedAnalytics) && (
                            <div className="plan-features-preview">
                                <h4>What's Included:</h4>
                                <ul>
                                    {plan.leadDiscountPercent > 0 && (
                                        <li>
                                            <i className="fas fa-check-circle"></i>
                                            <span>{plan.leadDiscountPercent}% discount on lead costs</span>
                                        </li>
                                    )}
                                    {plan.priorityBoostPoints > 0 && (
                                        <li>
                                            <i className="fas fa-check-circle"></i>
                                            <span>+{plan.priorityBoostPoints} priority boost points</span>
                                        </li>
                                    )}
                                    {plan.isFeatured && (
                                        <li>
                                            <i className="fas fa-check-circle"></i>
                                            <span>Featured listing badge</span>
                                        </li>
                                    )}
                                    {plan.hasAdvancedAnalytics && (
                                        <li>
                                            <i className="fas fa-check-circle"></i>
                                            <span>Advanced analytics access</span>
                                        </li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Payment Section */}
                    <div className="payment-section">
                        <div className="section-header">
                            <h4>
                                <i className="fas fa-credit-card"></i>
                                Payment Information
                            </h4>
                        </div>

                        <form onSubmit={handleSubmit} className="payment-form">
                            <div className="form-group">
                                <label htmlFor="card-element">
                                    Card Details
                                    <span className="required">*</span>
                                </label>
                                <div className="stripe-card-container">
                                    <CardElement
                                        id="card-element"
                                        options={{
                                            style: {
                                                base: {
                                                    fontSize: '16px',
                                                    color: '#1f2937',
                                                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                                                    '::placeholder': {
                                                        color: '#9ca3af',
                                                    },
                                                    fontWeight: '500',
                                                },
                                                invalid: {
                                                    color: '#ef4444',
                                                    iconColor: '#ef4444',
                                                },
                                            },
                                            hidePostalCode: false,
                                        }}
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="error-message">
                                    <i className="fas fa-exclamation-circle"></i>
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Security Badges */}
                            <div className="security-badges">
                                <div className="security-item">
                                    <i className="fas fa-lock"></i>
                                    <span>256-bit SSL Encrypted</span>
                                </div>
                                <div className="security-item">
                                    <i className="fab fa-stripe"></i>
                                    <span>Powered by Stripe</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="payment-actions">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="btn-cancel"
                                    disabled={processing}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-submit"
                                    disabled={processing || !stripe || !elements}
                                >
                                    {processing ? (
                                        <>
                                            <div className="button-spinner"></div>
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-lock"></i>
                                            <span>Subscribe Now - ${planPrice.toFixed(2)}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Total Summary */}
                    <div className="total-summary">
                        <div className="summary-row">
                            <span>Subtotal</span>
                            <span>${planPrice.toFixed(2)}</span>
                        </div>
                        <div className="summary-row total-row">
                            <span>Total Today</span>
                            <strong>${planPrice.toFixed(2)}</strong>
                        </div>
                        <p className="billing-note">
                            You'll be charged ${planPrice.toFixed(2)} {plan.billingCycle === 'YEARLY' ? 'annually' : 'monthly'}. Cancel anytime.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SubscriptionPaymentModal = ({ plan, onSuccess, onError, onClose }) => {
    const [activating, setActivating] = useState(false);

    if (!plan) return null;

    // For free plans, skip payment and activate directly
    const planPrice = parseFloat(plan.price || 0);
    if (planPrice === 0) {
        React.useEffect(() => {
            if (!activating) {
                setActivating(true);
                const activateFreeSubscription = async () => {
                    try {
                        const response = await api.post('/subscriptions/subscribe', {
                            subscriptionPlanId: plan.id
                        });

                        if (response.data.success) {
                            onSuccess({
                                subscription: response.data.subscription,
                                status: 'succeeded'
                            });
                        } else {
                            onError(response.data.error || 'Failed to activate subscription');
                        }
                    } catch (err) {
                        console.error('Free subscription activation error:', err);
                        onError(err.response?.data?.error || 'Failed to activate subscription');
                    }
                };

                activateFreeSubscription();
            }
        }, [plan.id, onSuccess, onError, activating]);

        return (
            <div className="subscription-payment-overlay" onClick={onClose}>
                <div className="subscription-payment-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="subscription-payment-loading">
                        <div className="loading-spinner"></div>
                        <h3>Activating Your Subscription</h3>
                        <p>Setting up your {plan.name} plan...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Elements stripe={stripePromise}>
            <SubscriptionPaymentForm
                plan={plan}
                onSuccess={onSuccess}
                onError={onError}
                onClose={onClose}
            />
        </Elements>
    );
};

export default SubscriptionPaymentModal;

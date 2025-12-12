import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements,
    CardElement,
    useStripe,
    useElements
} from '@stripe/react-stripe-js';
import api from '../services/api';
import './PaymentModal.css';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

const ProviderPaymentForm = ({ lead, leadCost, clientSecret, paymentIntentId, onSuccess, onError, onClose }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);

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

            // Get zip code from lead location
            let zipCode = lead?.serviceRequest?.zipCode || lead?.locationPostalCode || '';
            if (zipCode) {
                const zipMatch = zipCode.match(/^\d{5}/);
                zipCode = zipMatch ? zipMatch[0] : zipCode.replace(/[^0-9]/g, '').substring(0, 5);
            }

            // Validate zip code before proceeding
            if (!zipCode || zipCode.length < 5) {
                setError('Please ensure the lead has a valid zip code (5 digits).');
                setProcessing(false);
                return;
            }

            // Confirm payment
            const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: cardElement,
                    billing_details: {
                        name: lead?.serviceRequest?.projectTitle || 'Lead Acceptance',
                        address: {
                            postal_code: zipCode
                        }
                    }
                }
            });

            if (stripeError) {
                // Handle specific error: payment already succeeded
                if (stripeError.code === 'payment_intent_unexpected_state' &&
                    stripeError.payment_intent?.status === 'succeeded') {
                    // Payment already succeeded, proceed to success
                    onSuccess({
                        paymentIntentId: stripeError.payment_intent.id,
                        status: 'succeeded'
                    });
                    return;
                }

                setError(stripeError.message || 'Payment failed. Please try again.');
                setProcessing(false);
                return;
            }

            if (paymentIntent && paymentIntent.status === 'succeeded') {
                // Payment succeeded
                onSuccess({
                    paymentIntentId: paymentIntent.id,
                    status: 'succeeded'
                });
            } else {
                setError('Payment was not completed. Please try again.');
                setProcessing(false);
            }
        } catch (err) {
            console.error('Payment error:', err);
            setError('An error occurred during payment. Please try again.');
            setProcessing(false);
        }
    };

    const cardElementOptions = {
        style: {
            base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                    color: '#aab7c4',
                },
            },
            invalid: {
                color: '#9e2146',
            },
        },
    };

    return (
        <form onSubmit={handleSubmit} className="payment-form">
            <div className="payment-summary">
                <h4>Payment Summary</h4>
                <div className="summary-item">
                    <span>Service:</span>
                    <span>{lead?.serviceRequest?.projectTitle || 'Lead Acceptance'}</span>
                </div>
                <div className="summary-item">
                    <span>Category:</span>
                    <span>
                        {lead?.serviceRequest?.category?.name || 'N/A'}
                        {lead?.serviceRequest?.subCategory && ` - ${lead.serviceRequest.subCategory.name}`}
                    </span>
                </div>
                <div className="summary-item total">
                    <span>Lead Cost:</span>
                    <span>${leadCost?.toFixed(2) || '0.00'}</span>
                </div>
            </div>

            <div className="payment-section">
                <label>Card Details</label>
                <div className="card-element-container">
                    <CardElement options={cardElementOptions} />
                </div>
            </div>

            {error && (
                <div className="payment-error">
                    <i className="fas fa-exclamation-circle"></i>
                    {error}
                </div>
            )}

            <div className="payment-actions">
                <button
                    type="submit"
                    className="btn-primary"
                    disabled={!stripe || processing || !clientSecret}
                >
                    {processing ? (
                        <>
                            <i className="fas fa-spinner fa-spin"></i>
                            Processing...
                        </>
                    ) : (
                        <>
                            <i className="fas fa-credit-card"></i>
                            Pay ${leadCost?.toFixed(2) || '0.00'}
                        </>
                    )}
                </button>
            </div>
        </form>
    );
};

const ProviderPaymentModal = ({ show, onClose, lead, leadCost, clientSecret, paymentIntentId, onSuccess }) => {
    const [success, setSuccess] = useState(false);

    if (!show) return null;

    const handleSuccess = (data) => {
        setSuccess(true);
        setTimeout(() => {
            onSuccess(data);
            onClose();
        }, 2000);
    };

    const handleError = (error) => {
        console.error('Payment error:', error);
    };

    return (
        <div className="modal-overlay payment-modal-overlay" onClick={onClose}>
            <div className="modal-content payment-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>
                        <i className="fas fa-credit-card"></i>
                        Complete Lead Payment
                    </h2>
                    <button className="modal-close" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="modal-body">
                    {success ? (
                        <div className="payment-success">
                            <i className="fas fa-check-circle"></i>
                            <h3>Payment Successful!</h3>
                            <p>Your lead has been accepted and the proposal has been sent to the customer.</p>
                        </div>
                    ) : (
                        <Elements stripe={stripePromise}>
                            <ProviderPaymentForm
                                lead={lead}
                                leadCost={leadCost}
                                clientSecret={clientSecret}
                                paymentIntentId={paymentIntentId}
                                onSuccess={handleSuccess}
                                onError={handleError}
                                onClose={onClose}
                            />
                        </Elements>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProviderPaymentModal;


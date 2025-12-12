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
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
if (!stripePublishableKey || stripePublishableKey === 'pk_test_placeholder') {
    console.warn('⚠️ VITE_STRIPE_PUBLISHABLE_KEY not configured. Stripe payments will not work.');
}
const stripePromise = loadStripe(stripePublishableKey || 'pk_test_placeholder');

const PaymentForm = ({ proposal, serviceRequest, onSuccess, onError, onClose }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [clientSecret, setClientSecret] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Create payment intent or retrieve existing one
        const initializePayment = async () => {
            try {
                // First, check if proposal already has a payment intent and if it's already succeeded
                if (proposal.stripePaymentIntentId) {
                    // Check payment status with backend
                    try {
                        const statusResponse = await api.get(
                            `/service-requests/my/service-requests/${serviceRequest.id}/proposals/${proposal.id}/payment-status`
                        );

                        if (statusResponse.data.success) {
                            const { paymentStatus, paymentIntentId, clientSecret } = statusResponse.data.data;

                            // If payment already succeeded, verify with Stripe before skipping
                            if (paymentStatus === 'succeeded') {
                                // Double-check: if we have a payment intent ID, verify it actually succeeded in Stripe
                                if (paymentIntentId) {
                                    // Payment is confirmed as succeeded - proceed to success
                                    console.log('[PaymentModal] Payment already succeeded, proceeding to success');
                                    // Don't set clientSecret, but trigger success callback
                                    setTimeout(() => {
                                        onSuccess({
                                            paymentIntentId: paymentIntentId,
                                            status: 'succeeded'
                                        });
                                    }, 100);
                                    return;
                                } else {
                                    // No payment intent ID but status says succeeded - this is suspicious
                                    console.warn('[PaymentModal] Payment status says succeeded but no payment intent ID');
                                    // Continue to create new payment intent
                                }
                            }

                            // If payment intent exists but not succeeded, use existing client secret
                            if (clientSecret) {
                                setClientSecret(clientSecret);
                                setLoading(false);
                                return;
                            }
                        }
                    } catch (statusErr) {
                        // If status endpoint doesn't exist or fails, continue to create new intent
                        console.log('Payment status check failed, creating new intent:', statusErr);
                    }
                }

                // Create new payment intent
                const response = await api.post(
                    `/service-requests/my/service-requests/${serviceRequest.id}/proposals/${proposal.id}/create-payment-intent`
                );

                if (response.data.success) {
                    const receivedClientSecret = response.data.clientSecret;
                    if (!receivedClientSecret) {
                        setError('Payment configuration error: No client secret received');
                        setLoading(false);
                        return;
                    }

                    // Validate client secret format
                    if (!receivedClientSecret.includes('_secret_')) {
                        console.warn('⚠️ Received client secret may be invalid:', receivedClientSecret.substring(0, 20) + '...');
                    }

                    setClientSecret(receivedClientSecret);
                } else {
                    setError(response.data.error || 'Failed to initialize payment');
                    setLoading(false);
                }
            } catch (err) {
                console.error('Error initializing payment:', err);
                setError(err.response?.data?.error || 'Failed to initialize payment');
            } finally {
                setLoading(false);
            }
        };

        initializePayment();
    }, [proposal.id, serviceRequest.id, proposal.stripePaymentIntentId]);

    const handleSubmit = async (event) => {
        event.preventDefault();

        setProcessing(true);
        setError(null);

        try {
            // Check if payment is already succeeded (from previous attempt)
            // IMPORTANT: Only trust Stripe's status, not database status
            if (proposal.stripePaymentIntentId) {
                try {
                    const statusResponse = await api.get(
                        `/service-requests/my/service-requests/${serviceRequest.id}/proposals/${proposal.id}/payment-status`
                    );

                    if (statusResponse.data.success) {
                        const { paymentStatus, paymentIntentId } = statusResponse.data.data;

                        // Only proceed if Stripe confirms payment succeeded AND we have a payment intent ID
                        // This ensures the payment actually exists in Stripe
                        if (paymentStatus === 'succeeded' && paymentIntentId) {
                            console.log('[PaymentModal] Payment verified as succeeded in Stripe, accepting proposal');

                            // Verify payment intent exists in Stripe before accepting
                            const acceptResponse = await api.post(
                                `/service-requests/my/service-requests/${serviceRequest.id}/proposals/${proposal.id}/accept`,
                                {
                                    paymentIntentId: paymentIntentId
                                },
                                {
                                    timeout: 60000
                                }
                            );

                            if (acceptResponse.data.success) {
                                onSuccess(acceptResponse.data);
                                return;
                            } else {
                                // If accept fails, it means payment might not actually be succeeded
                                console.warn('[PaymentModal] Accept failed despite succeeded status, continuing with payment flow');
                                setError(acceptResponse.data.error || 'Payment verification failed. Please try again.');
                                setProcessing(false);
                                return;
                            }
                        } else {
                            console.log(`[PaymentModal] Payment status: ${paymentStatus}, paymentIntentId: ${paymentIntentId}, continuing with payment flow`);
                        }
                    }
                } catch (statusErr) {
                    // If status check fails, continue with normal payment flow
                    console.log('[PaymentModal] Payment status check failed, proceeding with payment:', statusErr);
                }
            }

            // Normal payment flow - only if we have stripe, elements, and clientSecret
            if (!stripe || !elements || !clientSecret) {
                setError('Payment system not ready. Please wait a moment and try again.');
                setProcessing(false);
                return;
            }

            const cardElement = elements.getElement(CardElement);

            // Get zip code from service request (required by Stripe)
            let zipCode = serviceRequest.zipCode || '';
            if (zipCode) {
                const zipMatch = zipCode.match(/^\d{5}/);
                zipCode = zipMatch ? zipMatch[0] : zipCode.replace(/[^0-9]/g, '').substring(0, 5);
            }

            // Validate zip code before proceeding
            if (!zipCode || zipCode.length < 5) {
                setError('Please ensure your service request has a valid zip code (5 digits).');
                setProcessing(false);
                return;
            }

            // Validate client secret format
            // Client secrets should start with 'pi_' and contain '_secret_'
            if (!clientSecret || (!clientSecret.startsWith('pi_') && !clientSecret.includes('_secret_'))) {
                setError('Invalid payment configuration. Please refresh and try again.');
                setProcessing(false);
                return;
            }

            // Confirm payment
            const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: cardElement,
                    billing_details: {
                        name: serviceRequest.projectTitle || 'Customer',
                        address: {
                            postal_code: zipCode
                        }
                    }
                }
            });

            if (stripeError) {
                console.error('Stripe payment error:', stripeError);
                console.log('Payment intent status:', stripeError.payment_intent?.status);
                console.log('Payment intent ID:', stripeError.payment_intent?.id);

                // Helper function to create new payment intent and retry
                const createNewIntentAndRetry = async () => {
                    try {
                        const newIntentResponse = await api.post(
                            `/service-requests/my/service-requests/${serviceRequest.id}/proposals/${proposal.id}/create-payment-intent`
                        );

                        if (newIntentResponse.data.success && newIntentResponse.data.clientSecret) {
                            // Retry payment with new client secret
                            const { error: retryError, paymentIntent: retryPaymentIntent } = await stripe.confirmCardPayment(
                                newIntentResponse.data.clientSecret,
                                {
                                    payment_method: {
                                        card: cardElement,
                                        billing_details: {
                                            name: serviceRequest.projectTitle || 'Customer',
                                            address: {
                                                postal_code: zipCode
                                            }
                                        }
                                    }
                                }
                            );

                            if (retryError) {
                                setError(retryError.message || 'Payment failed. Please try again.');
                                setProcessing(false);
                                return;
                            }

                            if (retryPaymentIntent && retryPaymentIntent.status === 'succeeded') {
                                // Accept the proposal
                                const acceptResponse = await api.post(
                                    `/service-requests/my/service-requests/${serviceRequest.id}/proposals/${proposal.id}/accept`,
                                    {
                                        paymentIntentId: retryPaymentIntent.id
                                    },
                                    {
                                        timeout: 60000
                                    }
                                );

                                if (acceptResponse.data.success) {
                                    onSuccess(acceptResponse.data);
                                    return;
                                } else {
                                    setError(acceptResponse.data.error || 'Failed to accept proposal');
                                    setProcessing(false);
                                    return;
                                }
                            }
                        } else {
                            setError('Failed to create new payment session. Please refresh and try again.');
                            setProcessing(false);
                            return;
                        }
                    } catch (retryErr) {
                        console.error('Error creating new payment intent:', retryErr);
                        setError('Failed to create new payment session. Please refresh the page and try again.');
                        setProcessing(false);
                        return;
                    }
                };

                // Helper function to accept proposal after payment succeeded
                const acceptProposalAfterPayment = async (paymentIntentId) => {
                    try {
                        // First, try to get the correct payment intent ID from the backend
                        // This ensures we use the payment intent ID that's stored in the lead/proposal
                        let finalPaymentIntentId = paymentIntentId;

                        try {
                            const statusResponse = await api.get(
                                `/service-requests/my/service-requests/${serviceRequest.id}/proposals/${proposal.id}/payment-status`
                            );

                            if (statusResponse.data.success && statusResponse.data.data.paymentIntentId) {
                                // Use the payment intent ID from the backend (this is the one stored in the lead)
                                finalPaymentIntentId = statusResponse.data.data.paymentIntentId;
                                console.log('[PaymentModal] Using payment intent ID from backend:', finalPaymentIntentId);
                            }
                        } catch (statusErr) {
                            // If status check fails, use the provided payment intent ID
                            console.log('[PaymentModal] Could not get payment status, using provided payment intent ID');
                        }

                        const acceptResponse = await api.post(
                            `/service-requests/my/service-requests/${serviceRequest.id}/proposals/${proposal.id}/accept`,
                            {
                                paymentIntentId: finalPaymentIntentId
                            },
                            {
                                timeout: 60000
                            }
                        );

                        if (acceptResponse.data.success) {
                            onSuccess(acceptResponse.data);
                            return true;
                        } else {
                            setError(acceptResponse.data.error || 'Failed to accept proposal');
                            setProcessing(false);
                            return false;
                        }
                    } catch (err) {
                        console.error('Error accepting proposal after payment succeeded:', err);
                        const errorMessage = err.response?.data?.error || 'Payment succeeded but failed to accept proposal';
                        setError(errorMessage);
                        setProcessing(false);
                        return false;
                    }
                };

                // Handle payment_intent_unexpected_state - check all possible states
                if (stripeError.code === 'payment_intent_unexpected_state') {
                    const paymentIntentStatus = stripeError.payment_intent?.status;
                    const paymentIntentId = stripeError.payment_intent?.id;

                    console.log(`Payment intent in unexpected state: ${paymentIntentStatus}`);

                    // If payment already succeeded, proceed to accept
                    if (paymentIntentStatus === 'succeeded') {
                        console.log('Payment already succeeded, accepting proposal...');
                        setError('Payment already completed. Processing...');

                        // Use the payment intent ID from the error, but also try to get the stored one from backend
                        // The backend will verify the payment intent matches the lead/proposal
                        const success = await acceptProposalAfterPayment(paymentIntentId);
                        if (!success) {
                            // If accept failed, try using the proposal's stored payment intent ID
                            if (proposal.stripePaymentIntentId && proposal.stripePaymentIntentId !== paymentIntentId) {
                                console.log('[PaymentModal] Retrying with stored payment intent ID:', proposal.stripePaymentIntentId);
                                await acceptProposalAfterPayment(proposal.stripePaymentIntentId);
                            }
                        }
                        return;
                    }
                    // If payment intent is canceled, create a new one
                    else if (paymentIntentStatus === 'canceled') {
                        console.log('Payment intent was canceled, creating a new one...');
                        setError('Previous payment was canceled. Creating a new payment...');
                        await createNewIntentAndRetry();
                        return;
                    }
                    // If payment is processing, wait a moment and check status
                    else if (paymentIntentStatus === 'processing') {
                        console.log('Payment is processing, checking status...');
                        setError('Payment is being processed. Please wait...');

                        // Wait 2 seconds and check payment status
                        setTimeout(async () => {
                            try {
                                const statusResponse = await api.get(
                                    `/service-requests/my/service-requests/${serviceRequest.id}/proposals/${proposal.id}/payment-status`
                                );

                                if (statusResponse.data.success) {
                                    const { paymentStatus, paymentIntentId: statusPaymentIntentId } = statusResponse.data.data;
                                    if (paymentStatus === 'succeeded') {
                                        // Payment succeeded, accept proposal
                                        await acceptProposalAfterPayment(statusPaymentIntentId || paymentIntentId);
                                        return;
                                    }
                                }

                                // If still processing or failed, show error
                                setError('Payment is still processing. Please check your payment method or try again.');
                                setProcessing(false);
                            } catch (err) {
                                console.error('Error checking payment status:', err);
                                setError('Unable to verify payment status. Please refresh and try again.');
                                setProcessing(false);
                            }
                        }, 2000);
                        return;
                    }
                    // If payment requires action (3D Secure, etc.)
                    else if (paymentIntentStatus === 'requires_action' || paymentIntentStatus === 'requires_payment_method') {
                        console.log(`Payment requires action: ${paymentIntentStatus}`);
                        setError('Payment requires additional authentication. Please complete the verification and try again.');
                        setProcessing(false);
                        return;
                    }
                    // For other unexpected states, create a new payment intent
                    else {
                        console.log(`Payment intent in unexpected state: ${paymentIntentStatus}, creating a new one...`);
                        setError('Payment session issue detected. Creating a new payment...');
                        await createNewIntentAndRetry();
                        return;
                    }
                }
                // Handle payment intent not found - create a new one
                else if (stripeError.code === 'resource_missing' ||
                    (stripeError.type === 'invalid_request_error' && stripeError.message?.includes('No such payment_intent'))) {
                    console.log('Payment intent not found, creating a new one...');
                    setError('Payment session expired. Creating a new payment...');
                    await createNewIntentAndRetry();
                    return;
                }
                // Handle card declined
                else if (stripeError.type === 'StripeCardError' && stripeError.code === 'card_declined') {
                    setError(stripeError.message || 'Your card was declined. Please try a different payment method.');
                    setProcessing(false);
                    return;
                }
                // Handle 401 Unauthorized - key mismatch
                else if (stripeError.message && (stripeError.message.includes('401') || stripeError.message.includes('Unauthorized'))) {
                    setError('Payment configuration error: Stripe keys do not match. Please contact support.');
                    console.error('⚠️ Stripe key mismatch detected. Check that VITE_STRIPE_PUBLISHABLE_KEY matches STRIPE_SECRET_KEY account.');
                    setProcessing(false);
                    return;
                }
                // Handle other errors
                else {
                    setError(stripeError.message || 'Payment failed. Please try again.');
                    setProcessing(false);
                    return;
                }
            }

            if (paymentIntent && paymentIntent.status === 'succeeded') {
                // Accept the proposal
                try {
                    const acceptResponse = await api.post(
                        `/service-requests/my/service-requests/${serviceRequest.id}/proposals/${proposal.id}/accept`,
                        {
                            paymentIntentId: paymentIntent.id
                        },
                        {
                            timeout: 60000
                        }
                    );

                    if (acceptResponse.data.success) {
                        onSuccess(acceptResponse.data);
                    } else {
                        setError(acceptResponse.data.error || 'Failed to accept proposal');
                        setProcessing(false);
                    }
                } catch (err) {
                    console.error('Error accepting proposal:', err);
                    setError(err.response?.data?.error || 'Failed to accept proposal');
                    setProcessing(false);
                }
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

    if (loading) {
        return (
            <div className="payment-loading">
                <i className="fas fa-spinner fa-spin"></i>
                <p>Initializing payment...</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="payment-form">
            <div className="payment-summary">
                <h4>Payment Summary</h4>
                <div className="summary-item">
                    <span>Service:</span>
                    <span>{serviceRequest.projectTitle}</span>
                </div>
                <div className="summary-item">
                    <span>Provider:</span>
                    <span>{proposal.provider?.name || 'Provider'}</span>
                </div>
                <div className="summary-item total">
                    <span>Amount:</span>
                    <span>${parseFloat(proposal.price).toFixed(2)}</span>
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
                            Pay ${parseFloat(proposal.price).toFixed(2)}
                        </>
                    )}
                </button>
            </div>
        </form>
    );
};

const PaymentModal = ({ show, onClose, proposal, serviceRequest, onSuccess }) => {
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
                        Accept Proposal & Pay
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
                            <p>Your proposal has been accepted and work has started.</p>
                        </div>
                    ) : (
                        <Elements stripe={stripePromise}>
                            <PaymentForm
                                proposal={proposal}
                                serviceRequest={serviceRequest}
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

export default PaymentModal;


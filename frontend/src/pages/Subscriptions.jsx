import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import SubscriptionPaymentModal from '../components/SubscriptionPaymentModal';
import './Subscriptions.css';

const Subscriptions = () => {
  const { user } = useContext(AuthContext);
  const [plans, setPlans] = useState([]);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load subscription plans
      const plansRes = await api.get('/subscriptions/plans');
      setPlans(plansRes.data.plans || []);

      // Load current subscription
      await loadCurrentSubscription();
    } catch (error) {
      console.error('Error loading subscription data:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to load subscription information'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentSubscription = async () => {
    try {
      const response = await api.get('/subscriptions/my-subscription');
      setCurrentSubscription(response.data.subscription);
    } catch (error) {
      console.error('Error loading subscription:', error);
      setCurrentSubscription(null);
    }
  };

  const handleSubscribe = async (planId) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) {
      setMessage({
        type: 'error',
        text: 'Plan not found'
      });
      return;
    }

    // Open payment modal
    setSelectedPlan(plan);
    setPaymentModalOpen(true);
  };

  const handlePaymentSuccess = async (result) => {
    setPaymentModalOpen(false);
    setSelectedPlan(null);
    setMessage({
      type: 'success',
      text: 'Subscription activated successfully!'
    });

    // Reload subscription data
    await loadCurrentSubscription();
  };

  const handlePaymentError = (error) => {
    setMessage({
      type: 'error',
      text: error || 'Payment failed. Please try again.'
    });
  };

  const handlePaymentModalClose = () => {
    setPaymentModalOpen(false);
    setSelectedPlan(null);
  };

  const handleCancel = async () => {
    if (!currentSubscription) return;

    if (!window.confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
      return;
    }

    try {
      setSubscribing(true);
      await api.post('/subscriptions/cancel', {});

      setMessage({
        type: 'success',
        text: 'Subscription cancelled successfully'
      });

      await loadCurrentSubscription();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to cancel subscription'
      });
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <div className="subscriptions-page">
        <div className="loading">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="subscriptions-page">
      <div className="subscriptions-container">
        <div className="subscriptions-header">
          <h1>
            <i className="fas fa-crown"></i> Subscription Plans
          </h1>
          <p>Choose a plan to unlock premium features for all your businesses</p>
        </div>

        {message.text && (
          <div className={`alert alert-${message.type}`}>
            <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i>
            <span>{message.text}</span>
            <button onClick={() => setMessage({ type: '', text: '' })} className="alert-close">
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}

        {currentSubscription && (
          <div className="current-subscription">
            <h3>
              <i className="fas fa-check-circle"></i> Current Subscription
            </h3>
            <div className="current-subscription-card">
              <div className="subscription-info">
                <h4>{currentSubscription.plan?.name || 'Active Plan'}</h4>
                <p className="subscription-price">
                  ${parseFloat(currentSubscription.plan?.price || 0).toFixed(2)}/{currentSubscription.plan?.billingCycle === 'YEARLY' ? 'year' : 'month'}
                </p>
                <p className="subscription-tier">
                  <i className="fas fa-crown"></i> Tier: {currentSubscription.plan?.tier || 'N/A'}
                </p>
                {currentSubscription.currentPeriodEnd && (
                  <p className="subscription-period">
                    Renews: {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
                {currentSubscription.status && (
                  <p className="subscription-status">
                    Status: <span className={`status-badge status-${currentSubscription.status.toLowerCase()}`}>
                      {currentSubscription.status}
                    </span>
                  </p>
                )}
              </div>
              <button
                onClick={handleCancel}
                disabled={subscribing || currentSubscription.status !== 'ACTIVE'}
                className="btn-cancel-subscription"
              >
                <i className="fas fa-times"></i> Cancel Subscription
              </button>
            </div>
          </div>
        )}

        <div className="plans-grid">
          {plans.map((plan) => {
            const isCurrentPlan = currentSubscription?.subscriptionPlanId === plan.id;
            const isActive = currentSubscription?.status === 'ACTIVE' && isCurrentPlan;

            return (
              <div
                key={plan.id}
                className={`plan-card ${isCurrentPlan ? 'current' : ''} ${plan.tier?.toLowerCase() || ''}`}
              >
                {plan.tier === 'PREMIUM' && (
                  <div className="plan-badge">
                    <i className="fas fa-crown"></i> Most Popular
                  </div>
                )}
                <div className="plan-header">
                  <h3>{plan.name}</h3>
                  <div className="plan-price">
                    <span className="price-amount">${parseFloat(plan.price || 0).toFixed(2)}</span>
                    <span className="price-period">/{plan.billingCycle === 'YEARLY' ? 'year' : 'month'}</span>
                  </div>
                </div>
                {plan.description && (
                  <p className="plan-description">{plan.description}</p>
                )}
                <div className="plan-features">
                  <ul>
                    {plan.tier === 'BASIC' && (
                      <li>
                        <i className="fas fa-dollar-sign"></i>
                        <span>$20.00 per lead</span>
                      </li>
                    )}
                    {plan.leadDiscountPercent > 0 && (
                      <li>
                        <i className="fas fa-check"></i>
                        <span>{plan.leadDiscountPercent}% discount on lead costs</span>
                      </li>
                    )}
                    {plan.maxLeadsPerMonth !== null && plan.maxLeadsPerMonth !== undefined && (
                      <li>
                        <i className="fas fa-chart-line"></i>
                        <span><strong>{plan.maxLeadsPerMonth} leads per month</strong></span>
                      </li>
                    )}
                    {plan.maxLeadsPerMonth === null && (
                      <li>
                        <i className="fas fa-infinity"></i>
                        <span><strong>Unlimited leads per month</strong></span>
                      </li>
                    )}
                    {plan.priorityBoostPoints > 0 && (
                      <li>
                        <i className="fas fa-check"></i>
                        <span>+{plan.priorityBoostPoints} priority boost points</span>
                      </li>
                    )}
                    {plan.isFeatured && (
                      <li>
                        <i className="fas fa-check"></i>
                        <span>Featured listing badge</span>
                      </li>
                    )}
                    {plan.hasAdvancedAnalytics && (
                      <li>
                        <i className="fas fa-check"></i>
                        <span>Advanced analytics access</span>
                      </li>
                    )}
                    {plan.features && Array.isArray(plan.features) && plan.features.length > 0 && (
                      plan.features.map((feature, index) => (
                        <li key={`feature-${index}`}>
                          <i className="fas fa-check"></i>
                          <span>{typeof feature === 'object' ? feature.name || feature : feature}</span>
                        </li>
                      ))
                    )}
                    {plan.leadDiscountPercent === 0 && plan.priorityBoostPoints === 0 && !plan.isFeatured && !plan.hasAdvancedAnalytics && (!plan.features || !Array.isArray(plan.features) || plan.features.length === 0) && (
                      <li>
                        <i className="fas fa-info-circle"></i>
                        <span>Basic features included</span>
                      </li>
                    )}
                  </ul>
                </div>
                <div className="plan-actions">
                  {isActive ? (
                    <button className="btn-current-plan" disabled>
                      <i className="fas fa-check-circle"></i> Current Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={subscribing}
                      className="btn-subscribe"
                    >
                      {subscribing ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i> Processing...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-arrow-right"></i> {isCurrentPlan ? 'Reactivate' : 'Subscribe'}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {plans.length === 0 && (
          <div className="no-plans">
            <i className="fas fa-info-circle"></i>
            <p>No subscription plans available at the moment. Please check back later.</p>
          </div>
        )}
      </div>

      {paymentModalOpen && selectedPlan && (
        <SubscriptionPaymentModal
          plan={selectedPlan}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
          onClose={handlePaymentModalClose}
        />
      )}
    </div>
  );
};

export default Subscriptions;

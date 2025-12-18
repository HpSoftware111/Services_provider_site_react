import React, { useState, useEffect, useContext, useMemo } from 'react';
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
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly', 'yearly'
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load subscription plans - preserve existing plans if this fails
      try {
        const plansRes = await api.get('/subscriptions/plans');
        const loadedPlans = plansRes?.data?.plans || [];

        // Debug: Log plans to verify billingCycle values
        console.log('📋 Loaded plans from API:', loadedPlans.length);
        const monthlyPlansLoaded = loadedPlans.filter(p => {
          const cycle = String(p.billingCycle || '').toUpperCase().trim();
          return cycle === 'MONTHLY';
        });
        const yearlyPlansLoaded = loadedPlans.filter(p => {
          const cycle = String(p.billingCycle || '').toUpperCase().trim();
          return cycle === 'YEARLY';
        });
        console.log('  - Monthly plans:', monthlyPlansLoaded.length, monthlyPlansLoaded.map(p => p.name));
        console.log('  - Annual plans:', yearlyPlansLoaded.length, yearlyPlansLoaded.map(p => p.name));

        if (loadedPlans.length > 0) {
          setPlans(loadedPlans);

          // Warn if no annual plans found
          if (yearlyPlansLoaded.length === 0) {
            console.warn('⚠️  No annual plans found in API response. Annual plans may not exist in database.');
            console.warn('💡 Run: node backend/scripts/add-annual-plans.js to create annual plans');
          }
        } else {
          console.warn('⚠️  No plans returned from API, keeping existing plans');
        }
      } catch (plansError) {
        console.error('❌ Error loading plans:', plansError);
        // Don't clear existing plans if API call fails - keep them visible
        if (plans.length === 0) {
          // Only set error if we don't have any plans at all
          setError('Failed to load subscription plans. Please refresh the page.');
        }
      }

      // Load current subscription (this can fail without affecting plans display)
      await loadCurrentSubscription();
    } catch (error) {
      console.error('Error loading subscription data:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to load subscription information';
      // Only set error if we don't have plans to display
      if (plans.length === 0) {
        setError(errorMessage);
      }
      setMessage({
        type: 'error',
        text: errorMessage
      });
      // Don't clear plans on error - keep existing plans visible
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

    // Reload subscription status first (this is critical)
    await loadCurrentSubscription();

    // Then reload plans (but preserve existing if this fails)
    try {
      const plansRes = await api.get('/subscriptions/plans');
      const loadedPlans = plansRes?.data?.plans || [];
      if (loadedPlans.length > 0) {
        setPlans(loadedPlans);
      }
    } catch (error) {
      console.error('Error reloading plans after subscription:', error);
      // Keep existing plans visible even if reload fails
    }
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

  // Separate plans by billing cycle with improved filtering
  const monthlyPlans = useMemo(() => {
    if (!plans || !Array.isArray(plans)) return [];
    return plans.filter(plan => {
      try {
        if (!plan) return false;
        const cycle = String(plan.billingCycle || '').toUpperCase().trim();
        return cycle === 'MONTHLY';
      } catch (e) {
        console.error('Error filtering monthly plans:', e, plan);
        return false;
      }
    });
  }, [plans]);

  const yearlyPlans = useMemo(() => {
    if (!plans || !Array.isArray(plans)) return [];
    return plans.filter(plan => {
      try {
        if (!plan) return false;
        const cycle = String(plan.billingCycle || '').toUpperCase().trim();
        return cycle === 'YEARLY';
      } catch (e) {
        console.error('Error filtering yearly plans:', e, plan);
        return false;
      }
    });
  }, [plans]);

  // Debug logging
  useEffect(() => {
    if (plans && plans.length > 0) {
      console.log('🔍 Plan Analysis:', {
        totalPlans: plans.length,
        monthlyCount: monthlyPlans.length,
        yearlyCount: yearlyPlans.length,
        allBillingCycles: plans.map(p => ({ id: p.id, name: p.name, cycle: p.billingCycle })),
        monthlyPlans: monthlyPlans.map(p => ({ id: p.id, name: p.name, cycle: p.billingCycle })),
        yearlyPlans: yearlyPlans.map(p => ({ id: p.id, name: p.name, cycle: p.billingCycle }))
      });
    }
  }, [plans, monthlyPlans, yearlyPlans]);

  if (loading && plans.length === 0) {
    // Only show loading spinner if we don't have any plans yet
    return (
      <div className="subscriptions-page">
        <div className="loading">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error && plans.length === 0) {
    // Only show error page if we don't have any plans to display
    return (
      <div className="subscriptions-page">
        <div className="subscriptions-container">
          <div className="alert alert-error">
            <i className="fas fa-exclamation-circle"></i>
            <span>Error loading subscription page: {error}</span>
            <button onClick={() => { setError(null); loadData(); }} className="alert-close">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Helper function to determine tier hierarchy for upgrade/downgrade comparison
  const getTierLevel = (tier) => {
    if (!tier) return 0;
    const tierUpper = String(tier).toUpperCase().trim();
    if (tierUpper === 'BASIC') return 1;
    if (tierUpper === 'PRO') return 3; // Pro is highest tier
    if (tierUpper === 'PREMIUM') return 2;
    return 0;
  };

  // Helper function to get button text based on subscription status
  const getButtonText = (plan) => {
    if (!plan) return 'Subscribe';

    const isCurrentPlan = currentSubscription?.subscriptionPlanId === plan.id;
    const isActive = currentSubscription?.status === 'ACTIVE' && isCurrentPlan;

    // If this is the current active plan, show "Current Plan"
    if (isActive) {
      return 'Current Plan';
    }

    // If this is the current plan but not active, show "Reactivate"
    if (isCurrentPlan && currentSubscription?.status !== 'ACTIVE') {
      return 'Reactivate';
    }

    // Compare tiers if there's an active subscription
    if (currentSubscription?.status === 'ACTIVE' && currentSubscription?.plan) {
      const currentTierLevel = getTierLevel(currentSubscription.plan.tier);
      const planTierLevel = getTierLevel(plan.tier);

      // If same tier but different plan (e.g., monthly vs yearly), compare by price
      if (planTierLevel === currentTierLevel && planTierLevel > 0) {
        const currentPrice = parseFloat(currentSubscription.plan.price || 0);
        const planPrice = parseFloat(plan.price || 0);

        // If same billing cycle, it's the same plan
        if (currentSubscription.plan.billingCycle === plan.billingCycle) {
          return 'Current Plan';
        }

        // Different billing cycle but same tier - compare prices
        // For yearly vs monthly, we need to normalize (yearly is usually cheaper per month)
        if (planPrice > currentPrice) {
          return 'Upgrade';
        } else if (planPrice < currentPrice) {
          return 'Downgrade';
        }
      }

      // Different tiers - compare tier levels
      // Special case: If current is Premium and plan is Pro, it's an Upgrade
      if (currentSubscription.plan.tier?.toUpperCase() === 'PREMIUM' && plan.tier?.toUpperCase() === 'PRO') {
        return 'Upgrade';
      }

      if (planTierLevel > currentTierLevel) {
        return 'Upgrade';
      } else if (planTierLevel < currentTierLevel) {
        return 'Downgrade';
      }
    }

    // Default to Subscribe for new subscriptions
    return 'Subscribe';
  };

  // Helper function to render a plan card
  const renderPlanCard = (plan) => {
    const isCurrentPlan = currentSubscription?.subscriptionPlanId === plan.id;
    const isActive = currentSubscription?.status === 'ACTIVE' && isCurrentPlan;
    const isMonthly = plan.billingCycle?.toUpperCase() === 'MONTHLY';
    const buttonText = getButtonText(plan);

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
            <span className="price-period">/{isMonthly ? 'month' : 'year'}</span>
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
          {buttonText === 'Current Plan' ? (
            <button className="btn-current-plan" disabled>
              <i className="fas fa-check-circle"></i> Current Plan
            </button>
          ) : (
            <button
              onClick={() => handleSubscribe(plan.id)}
              disabled={subscribing}
              className={`btn-subscribe ${buttonText === 'Upgrade' ? 'btn-upgrade' : buttonText === 'Downgrade' ? 'btn-downgrade' : ''}`}
            >
              {subscribing ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Processing...
                </>
              ) : (
                <>
                  {buttonText === 'Upgrade' ? (
                    <><i className="fas fa-arrow-up"></i> Upgrade</>
                  ) : buttonText === 'Downgrade' ? (
                    <><i className="fas fa-arrow-down"></i> Downgrade</>
                  ) : buttonText === 'Reactivate' ? (
                    <><i className="fas fa-redo"></i> Reactivate</>
                  ) : (
                    <><i className="fas fa-arrow-right"></i> Subscribe</>
                  )}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="subscriptions-page">
      <div className="subscriptions-container">
        <div className="subscriptions-header">
          <h1>
            <i className="fas fa-crown"></i> Subscription Plans
          </h1>
          <p>Choose a plan to unlock premium features for all your businesses</p>

          {/* Billing Cycle Toggle */}
          {plans && plans.length > 0 && (
            <div className="billing-cycle-toggle-wrapper">
              <div className="billing-cycle-toggle">
                <button
                  type="button"
                  className={`toggle-btn ${viewMode === 'monthly' ? 'active' : ''} ${monthlyPlans.length === 0 ? 'no-plans' : ''}`}
                  onClick={() => {
                    if (monthlyPlans.length > 0) {
                      setViewMode('monthly');
                    } else {
                      setMessage({
                        type: 'error',
                        text: 'No monthly plans available at the moment. Please check back later.'
                      });
                    }
                  }}
                  title={monthlyPlans.length === 0 ? 'No monthly plans available' : `View ${monthlyPlans.length} monthly plan${monthlyPlans.length !== 1 ? 's' : ''}`}
                >
                  <i className="fas fa-calendar-alt"></i>
                  <span>Monthly</span>
                  {monthlyPlans.length > 0 ? (
                    <span className="plan-count">{monthlyPlans.length}</span>
                  ) : (
                    <span className="plan-count-empty" title="No plans available">
                      <i className="fas fa-exclamation-circle"></i>
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${viewMode === 'yearly' ? 'active' : ''} ${yearlyPlans.length === 0 ? 'no-plans' : ''}`}
                  onClick={() => {
                    if (yearlyPlans.length > 0) {
                      setViewMode('yearly');
                    } else {
                      setMessage({
                        type: 'error',
                        text: 'No annual plans available at the moment. Annual plans will be available soon!'
                      });
                    }
                  }}
                  title={yearlyPlans.length === 0 ? 'No annual plans available' : `View ${yearlyPlans.length} annual plan${yearlyPlans.length !== 1 ? 's' : ''}`}
                >
                  <i className="fas fa-calendar-check"></i>
                  <span>Annual</span>
                  {yearlyPlans.length > 0 ? (
                    <span className="plan-count">{yearlyPlans.length}</span>
                  ) : (
                    <span className="plan-count-empty" title="No plans available">
                      <i className="fas fa-exclamation-circle"></i>
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
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
            {currentSubscription.status === 'EXPIRED' && (
              <div className="alert alert-warning" style={{
                marginBottom: '20px',
                backgroundColor: '#fef3c7',
                border: '2px solid #f59e0b',
                padding: '16px 20px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <i className="fas fa-exclamation-triangle" style={{ fontSize: '24px', color: '#d97706' }}></i>
                <div style={{ flex: 1 }}>
                  <strong style={{ display: 'block', marginBottom: '4px', color: '#92400e' }}>
                    Your subscription has expired
                  </strong>
                  <span style={{ color: '#78350f' }}>
                    {currentSubscription.currentPeriodEnd
                      ? `Expired on ${new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}. `
                      : ''}
                    Please renew your subscription to continue accessing premium features.
                  </span>
                </div>
              </div>
            )}
            <h3>
              <i className={`fas fa-${currentSubscription.status === 'EXPIRED' ? 'exclamation-triangle' : 'check-circle'}`}></i> Current Subscription
            </h3>
            <div className={`current-subscription-card ${currentSubscription.status === 'EXPIRED' ? 'expired' : ''}`}>
              <div className="subscription-info">
                <h4>{currentSubscription.plan?.name || 'Active Plan'}</h4>
                <p className="subscription-price">
                  ${parseFloat(currentSubscription.plan?.price || 0).toFixed(2)}/{currentSubscription.plan?.billingCycle === 'YEARLY' ? 'year' : 'month'}
                </p>
                <p className="subscription-tier">
                  <i className="fas fa-crown"></i> Tier: {currentSubscription.plan?.tier || 'N/A'}
                </p>
                {currentSubscription.currentPeriodEnd && (
                  <p className={`subscription-period ${currentSubscription.status === 'EXPIRED' ? 'expired' : ''}`}>
                    {currentSubscription.status === 'EXPIRED' ? (
                      <>
                        <i className="fas fa-calendar-times"></i> Expired on: {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </>
                    ) : (
                      <>
                        Renews: {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </>
                    )}
                  </p>
                )}
                {currentSubscription.status && (
                  <p className="subscription-status">
                    Status: <span className={`status-badge status-${currentSubscription.status.toLowerCase()}`}>
                      {currentSubscription.status}
                    </span>
                  </p>
                )}
                {/* Expiry Date - Always show if available */}
                {(currentSubscription.expiredAt || currentSubscription.currentPeriodEnd) && (
                  <p className="subscription-expiry-date">
                    <i className="fas fa-calendar-times"></i> Expiry Date: {' '}
                    <strong>
                      {currentSubscription.expiredAt
                        ? new Date(currentSubscription.expiredAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                        : currentSubscription.currentPeriodEnd
                          ? new Date(currentSubscription.currentPeriodEnd).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                          : 'N/A'}
                    </strong>
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

        {/* Monthly Plans Section */}
        {monthlyPlans && monthlyPlans.length > 0 && viewMode === 'monthly' && (
          <div className="plans-section">
            <div className="plans-section-header">
              <h2>
                <i className="fas fa-calendar-alt"></i> Monthly Plans
              </h2>
              <p>Pay monthly and cancel anytime</p>
            </div>
            <div className="plans-grid">
              {monthlyPlans.map((plan) => renderPlanCard(plan))}
            </div>
          </div>
        )}

        {/* Annual Plans Section */}
        {yearlyPlans && yearlyPlans.length > 0 && viewMode === 'yearly' && (
          <div className="plans-section">
            <div className="plans-section-header">
              <h2>
                <i className="fas fa-calendar-check"></i> Annual Plans
              </h2>
              <p>Save more with annual billing</p>
            </div>
            <div className="plans-grid">
              {yearlyPlans.map((plan) => renderPlanCard(plan))}
            </div>
          </div>
        )}

        {(!plans || plans.length === 0) && (
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

import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonButton,
  IonBadge,
  IonIcon,
  IonButtons,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  useIonRouter,
  useIonToast,
} from '@ionic/react';
import {
  calendar,
  warning,
  arrowBack,
  checkmarkCircle,
} from 'ionicons/icons';
import './MemberPayment.css';

import { API_CONFIG } from '../config/api.config';

interface Subscription {
  membershipType: string;
  membershipPrice: number;
  subscriptionEnd: string;
  paymentStatus: string;
  subscriptionStart?: string;
}

const IS_PRODUCTION_BUILD = process.env.NODE_ENV === 'production';

const MEMBERSHIP_PRICES: { [key: string]: number } = {
  monthly: IS_PRODUCTION_BUILD ? 1 : 100,
  quarterly: IS_PRODUCTION_BUILD ? 2 : 200,
  annual: IS_PRODUCTION_BUILD ? 3 : 300,
};

const API_URL = API_CONFIG.BASE_URL;

const MemberPayment: React.FC = () => {
  const router = useIonRouter();
  const [presentToast] = useIonToast();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const response = await fetch(`${API_URL}/member/subscription`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📊 Subscription data:', data);
        setSubscription(data);
        setSelectedPlan(data.membershipType || 'monthly');
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  };

  const getValidSubscriptionEnd = (): Date | null => {
    const raw = subscription?.subscriptionEnd;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const getDaysLeft = () => {
    const endDate = getValidSubscriptionEnd();
    if (!endDate) return 0;
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handlePayPalPayment = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      const amount = MEMBERSHIP_PRICES[selectedPlan];
      
      // Get userId from stored user object
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const userId = user?.id;

      console.log('💳 Creating PayPal order:', {
        userId,
        membershipType: selectedPlan,
        amount,
        paymentMethod: 'paypal'
      });

      if (!userId) {
        throw new Error('User ID not found. Please log in again.');
      }

      // Call PayPal create-order endpoint
      const response = await fetch(`${API_URL}/payments/paypal/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          amount,
          plan: selectedPlan,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success && result.approvalLink) {
        console.log('✅ PayPal order created, redirecting to approval:', result.orderId);
        
        // Show notification that redirecting to PayPal
        presentToast({
          message: '🔄 Redirecting to PayPal...',
          duration: 2000,
          color: 'primary',
          position: 'top'
        });

        // Redirect to PayPal approval page
        setTimeout(() => {
          window.location.href = result.approvalLink;
        }, 500);
      } else {
        throw new Error(result.message || 'Failed to create PayPal order');
      }
    } catch (error: any) {
      console.error('❌ PayPal payment error:', error);
      presentToast({
        message: error.message || '❌ Failed to start payment. Please try again.',
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      setIsProcessing(false);
    }
  };

  const daysLeft = getDaysLeft();
  const validSubscriptionEnd = getValidSubscriptionEnd();
  const isExpiringSoon = daysLeft <= 7 && daysLeft > 0;
  const isExpired = daysLeft <= 0;
  const isActive = subscription?.paymentStatus === 'paid' && daysLeft > 0;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => router.push('/member', 'back')}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>Payment & Renewal</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="member-payment-content">
        <div className="payment-container">
          {/* Current Subscription Card */}
          {subscription && (
            <IonCard className={`subscription-card ${isActive ? 'active' : ''}`}>
              <IonCardContent>
                <h2 className="card-title-primary">Current Subscription</h2>
                <div className="subscription-info">
                  <div className="info-item">
                    <span className="info-label">Plan</span>
                    <IonBadge className="plan-badge">
                      {subscription.membershipType ? subscription.membershipType.toUpperCase() : 'NOT SET'}
                    </IonBadge>
                  </div>

                  <div className="info-item">
                    <span className="info-label">Status</span>
                    <IonBadge
                      className={`status-badge ${subscription.paymentStatus}`}
                      color={
                        subscription.paymentStatus === 'paid'
                          ? 'success'
                          : 'danger'
                      }
                    >
                      <IonIcon icon={checkmarkCircle} />
                      {subscription.paymentStatus === 'paid' ? 'ACTIVE' : 'EXPIRED'}
                    </IonBadge>
                  </div>

                  <div className="info-item">
                    <span className="info-label">
                      <IonIcon icon={calendar} style={{ marginRight: '0.5rem' }} />
                      Expiry Date
                    </span>
                    <div className="expiry-info">
                      <span className="expiry-date">
                        {validSubscriptionEnd ? validSubscriptionEnd.toLocaleDateString() : 'Not set'}
                      </span>
                      <span
                        className={`days-left ${
                          isExpired || isExpiringSoon ? 'urgent' : 'normal'
                        }`}
                      >
                        {daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}
                      </span>
                    </div>
                  </div>
                </div>

                {(isExpiringSoon || isExpired) && (
                  <div className="expiry-warning">
                    <IonIcon icon={warning} />
                    <p>
                      {isExpired
                        ? '⚠️ Your subscription has expired. Renew now to continue accessing the gym.'
                        : '⏰ Your subscription is expiring soon. Renew now to avoid interruption.'}
                    </p>
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          )}

          {/* Renewal / PayPal payment card */}
          <IonCard className="renewal-card">
            <IonCardContent>
              <h2 className="card-title-primary" style={{ textAlign: 'center', marginBottom: '1rem' }}>
                Renew Subscription with PayPal
              </h2>

              <IonLabel>Choose your membership plan</IonLabel>
              <IonSegment
                value={selectedPlan}
                onIonChange={(e) => setSelectedPlan(e.detail.value as string)}
                style={{ margin: '0.5rem 0 1rem' }}
              >
                <IonSegmentButton value="monthly">Monthly</IonSegmentButton>
                <IonSegmentButton value="quarterly">Quarterly</IonSegmentButton>
                <IonSegmentButton value="annual">Annual</IonSegmentButton>
              </IonSegment>

              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <strong>Amount: </strong>₱{MEMBERSHIP_PRICES[selectedPlan].toLocaleString()} (PHP)
              </div>

              <IonButton
                expand="block"
                color="primary"
                onClick={handlePayPalPayment}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing…' : `Pay ₱${MEMBERSHIP_PRICES[selectedPlan].toLocaleString()} with PayPal`}
              </IonButton>

              <p style={{ color: '#999', marginTop: '1rem', textAlign: 'center' }}>
                After payment approval, you will be redirected to confirm your payment and activate your membership.
              </p>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default MemberPayment;
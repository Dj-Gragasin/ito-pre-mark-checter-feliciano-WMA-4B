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
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonBadge,
  IonIcon,
  IonButtons,
  useIonRouter,
  useIonToast,
  IonSpinner,
} from '@ionic/react';
import {
  calendar,
  warning,
  wallet,
  card,
  cash,
  location,
  arrowBack,
  checkmarkCircle,
} from 'ionicons/icons';
import './MemberPayment.css';

interface Subscription {
  membershipType: string;
  membershipPrice: number;
  subscriptionEnd: string;
  paymentStatus: string;
  subscriptionStart?: string;
}

const MEMBERSHIP_PRICES: { [key: string]: number } = {
  monthly: 1500,
  quarterly: 4000,
  annual: 15000,
};

const API_URL = 'http://localhost:3002/api';

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

  const getDaysLeft = () => {
    if (!subscription?.subscriptionEnd) return 0;
    const today = new Date();
    const endDate = new Date(subscription.subscriptionEnd);
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

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
                      {subscription.membershipType.toUpperCase()}
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
                        {new Date(subscription.subscriptionEnd).toLocaleDateString()}
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

          {/* Renewal Card */}
          <IonCard className="renewal-card">
            <IonCardContent>
              <h2 className="card-title-primary">Renew Subscription</h2>

              <IonItem className="plan-selector">
                <IonLabel className="select-label">Select Plan</IonLabel>
                <IonSelect
                  className="plan-select"
                  value={selectedPlan}
                  onIonChange={(e) => setSelectedPlan(e.detail.value)}
                  disabled={isProcessing}
                >
                  <IonSelectOption value="monthly">
                    Monthly - ₱1,500
                  </IonSelectOption>
                  <IonSelectOption value="quarterly">
                    Quarterly - ₱4,000
                  </IonSelectOption>
                  <IonSelectOption value="annual">
                    Annual - ₱15,000
                  </IonSelectOption>
                </IonSelect>
              </IonItem>

              <div className="payment-summary">
                <h3 className="summary-title">Payment Summary</h3>
                <div className="summary-details">
                  <div className="summary-row">
                    <span>Plan</span>
                    <strong>{selectedPlan.toUpperCase()}</strong>
                  </div>
                  <div className="summary-row total">
                    <span>Total Amount</span>
                    <span className="amount">
                      ₱{MEMBERSHIP_PRICES[selectedPlan].toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="payment-options">
                <h3 className="options-title">Payment Options</h3>

                {/* PayPal Payment Button */}
                <IonButton
                  expand="block"
                  className="paypal-button"
                  onClick={handlePayPalPayment}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <IonSpinner name="crescent" style={{ marginRight: '0.5rem' }} />
                      Processing Payment...
                    </>
                  ) : (
                    <>
                      <IonIcon icon={wallet} slot="start" />
                      Pay with PayPal - Instant Activation ⚡
                    </>
                  )}
                </IonButton>

                <div className="instant-access-badge">
                  <IonIcon icon={checkmarkCircle} style={{ color: '#00e676' }} />
                  <span>Instant access after payment - No waiting!</span>
                </div>

                {/* Cash Payment Info */}
                <div className="payment-divider">
                  <span>OR</span>
                </div>

                <div className="cash-info">
                  <IonIcon icon={cash} />
                  <div className="cash-text">
                    <strong>Pay at Gym Counter</strong>
                    <p>
                      Visit our gym and pay directly with cash or bank transfer.
                      Instant activation by admin - fast and convenient!
                    </p>
                  </div>
                </div>

                <div className="gym-location">
                  <IonIcon icon={location} />
                  <div>
                    <strong>Gym Location</strong>
                    <p>123 Fitness Street, Barangay Rizal, Makati City</p>
                    <p style={{ marginTop: '0.5rem', color: '#00e676' }}>
                      Open: Mon-Sun, 6:00 AM - 10:00 PM
                    </p>
                  </div>
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default MemberPayment;
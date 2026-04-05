import React, { useCallback, useEffect, useState } from 'react';
import { API_CONFIG } from '../config/api.config';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonButton,
  IonIcon,
  IonButtons,
  useIonRouter,
  useIonToast,
  IonSpinner,
} from '@ionic/react';
import { checkmarkCircle, arrowBack } from 'ionicons/icons';
import './MemberPayment.css';

const PaymentSuccess: React.FC = () => {
  const router = useIonRouter();
  const [presentToast] = useIonToast();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState<'checking' | 'success' | 'pending'>('checking');

  const capturePayment = useCallback(async () => {
    try {
      // Get orderId from URL params
      const params = new URLSearchParams(window.location.search);
      const orderId = params.get('token');

      if (!orderId) {
        setVerificationStatus('pending');
        setIsVerifying(false);
        presentToast({
          message: '⏳ Payment is being processed. Your subscription will update shortly.',
          duration: 4000,
          color: 'primary',
          position: 'top'
        });
        return;
      }

      // Call backend to capture payment
      const response = await fetch(`${API_CONFIG.BASE_URL}/payments/paypal/capture-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ orderId }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setVerificationStatus('success');
        presentToast({
          message: '✅ Payment confirmed! Your subscription is now active.',
          duration: 4000,
          color: 'success',
          position: 'top'
        });
        
        // Redirect to member dashboard after 3 seconds
        setTimeout(() => {
          router.push('/member', 'back');
        }, 3000);
      } else {
        setVerificationStatus('pending');
        presentToast({
          message: '⏳ Payment received. Processing your subscription...',
          duration: 4000,
          color: 'primary',
          position: 'top'
        });
        
        // Redirect to member dashboard after 3 seconds
        setTimeout(() => {
          router.push('/member', 'back');
        }, 3000);
      }
    } catch (error: any) {
      console.error('❌ Payment capture error:', error);
      setVerificationStatus('pending');
      presentToast({
        message: '⏳ Payment is being processed. Your subscription will update shortly.',
        duration: 4000,
        color: 'primary',
        position: 'top'
      });
      
      setTimeout(() => {
        router.push('/member', 'back');
      }, 3000);
    } finally {
      setIsVerifying(false);
    }
  }, [presentToast, router]);

  useEffect(() => {
    capturePayment();
  }, [capturePayment]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => router.push('/member', 'back')}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>Payment Status</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="member-payment-content">
        <div className="payment-container payment-status-container">
          <IonCard className="payment-status-card">
            <IonCardContent>
              {isVerifying ? (
                <div className="payment-status-content">
                  <IonSpinner name="crescent" className="payment-status-spinner" />
                  <h2 className="payment-status-title">Verifying Payment...</h2>
                  <p className="payment-status-text">Please wait while we confirm your PayPal payment</p>
                </div>
              ) : verificationStatus === 'success' ? (
                <div className="payment-status-content">
                  <IonIcon
                    icon={checkmarkCircle}
                    className="payment-status-icon success"
                  />
                  <h2 className="payment-status-title success">✅ Payment Successful!</h2>
                  <p className="payment-status-text">
                    Your subscription has been renewed and is now active.
                  </p>
                  <p className="payment-status-subtext">
                    Redirecting to your dashboard...
                  </p>
                </div>
              ) : (
                <div className="payment-status-content">
                  <IonIcon
                    icon={checkmarkCircle}
                    className="payment-status-icon success"
                  />
                  <h2 className="payment-status-title success">✅ Payment Received</h2>
                  <p className="payment-status-text">
                    Your payment has been received and is being processed.
                  </p>
                  <p className="payment-status-subtext" style={{ marginTop: '1rem' }}>
                    Your subscription will be updated shortly. You'll receive a confirmation email.
                  </p>
                  <p className="payment-status-subtext">
                    Redirecting to your dashboard...
                  </p>
                </div>
              )}
            </IonCardContent>
          </IonCard>

          <IonButton
            expand="block"
            className="payment-status-action"
            onClick={() => router.push('/member', 'back')}
          >
            Back to Dashboard
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default PaymentSuccess;

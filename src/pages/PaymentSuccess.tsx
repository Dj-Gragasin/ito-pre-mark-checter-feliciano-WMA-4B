import React, { useEffect, useState } from 'react';
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    capturePayment();
  }, []);

  const capturePayment = async () => {
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
  };

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
        <div className="payment-container" style={{ paddingTop: '4rem', textAlign: 'center' }}>
          <IonCard style={{ marginTop: '2rem' }}>
            <IonCardContent>
              {isVerifying ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                  <IonSpinner name="crescent" style={{ fontSize: '3rem', color: '#00e676' }} />
                  <h2 style={{ color: '#fff', marginTop: '1rem' }}>Verifying Payment...</h2>
                  <p style={{ color: '#b0b0b0' }}>Please wait while we confirm your PayPal payment</p>
                </div>
              ) : verificationStatus === 'success' ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                  <IonIcon
                    icon={checkmarkCircle}
                    style={{ fontSize: '4rem', color: '#00e676', marginBottom: '1rem' }}
                  />
                  <h2 style={{ color: '#00e676', marginTop: '1rem' }}>✅ Payment Successful!</h2>
                  <p style={{ color: '#b0b0b0', marginTop: '1rem' }}>
                    Your subscription has been renewed and is now active.
                  </p>
                  <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '2rem' }}>
                    Redirecting to your dashboard...
                  </p>
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                  <IonIcon
                    icon={checkmarkCircle}
                    style={{ fontSize: '4rem', color: '#00e676', marginBottom: '1rem' }}
                  />
                  <h2 style={{ color: '#00e676', marginTop: '1rem' }}>✅ Payment Received</h2>
                  <p style={{ color: '#b0b0b0', marginTop: '1rem' }}>
                    Your payment has been received and is being processed.
                  </p>
                  <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '1rem' }}>
                    Your subscription will be updated shortly. You'll receive a confirmation email.
                  </p>
                  <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '2rem' }}>
                    Redirecting to your dashboard...
                  </p>
                </div>
              )}
            </IonCardContent>
          </IonCard>

          <IonButton
            expand="block"
            style={{ marginTop: '2rem', maxWidth: '300px', marginLeft: 'auto', marginRight: 'auto' }}
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

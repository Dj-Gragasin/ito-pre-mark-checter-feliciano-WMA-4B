import React, { useEffect } from 'react';
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
} from '@ionic/react';
import { closeCircle, arrowBack } from 'ionicons/icons';
import './MemberPayment.css';

const PaymentFailed: React.FC = () => {
  const router = useIonRouter();
  const [presentToast] = useIonToast();

  useEffect(() => {
    presentToast({
      message: '❌ Payment was cancelled or failed. Please try again.',
      duration: 4000,
      color: 'danger',
      position: 'top'
    });
  }, [presentToast]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => router.push('/member/payment', 'back')}>
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
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <IonIcon
                  icon={closeCircle}
                  style={{ fontSize: '4rem', color: '#ff4961', marginBottom: '1rem' }}
                />
                <h2 style={{ color: '#ff4961', marginTop: '1rem' }}>❌ Payment Failed</h2>
                <p style={{ color: '#b0b0b0', marginTop: '1rem' }}>
                  Your payment could not be processed. This could be due to:
                </p>
                <ul style={{ color: '#888', fontSize: '0.95rem', marginTop: '1rem', textAlign: 'left', maxWidth: '400px', margin: '1rem auto' }}>
                  <li>Insufficient GCash balance</li>
                  <li>Cancelled by you</li>
                  <li>Network error</li>
                  <li>Account verification issue</li>
                </ul>
                <p style={{ color: '#b0b0b0', marginTop: '2rem' }}>
                  Please try again or contact support for help.
                </p>
              </div>
            </IonCardContent>
          </IonCard>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem', flexWrap: 'wrap' }}>
            <IonButton
              expand="block"
              style={{ maxWidth: '300px' }}
              onClick={() => router.push('/member/payment', 'back')}
            >
              Try Again
            </IonButton>
            <IonButton
              expand="block"
              fill="outline"
              style={{ maxWidth: '300px' }}
              onClick={() => router.push('/member', 'back')}
            >
              Back to Dashboard
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default PaymentFailed;

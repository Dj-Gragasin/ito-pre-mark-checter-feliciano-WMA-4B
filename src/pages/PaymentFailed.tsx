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
        <div className="payment-container payment-status-container">
          <IonCard className="payment-status-card">
            <IonCardContent>
              <div className="payment-status-content">
                <IonIcon
                  icon={closeCircle}
                  className="payment-status-icon error"
                />
                <h2 className="payment-status-title error">❌ Payment Failed</h2>
                <p className="payment-status-text">
                  Your payment could not be processed. This could be due to:
                </p>
                <ul className="payment-status-list">
                  <li>Insufficient PayPal balance</li>
                  <li>Cancelled by you</li>
                  <li>Network error</li>
                  <li>Account verification issue</li>
                </ul>
                <p className="payment-status-text" style={{ marginTop: '2rem' }}>
                  Please try again or contact support for help.
                </p>
              </div>
            </IonCardContent>
          </IonCard>

          <div className="payment-status-actions">
            <IonButton
              expand="block"
              className="payment-status-action"
              onClick={() => router.push('/member/payment', 'back')}
            >
              Try Again
            </IonButton>
            <IonButton
              expand="block"
              fill="outline"
              className="payment-status-action"
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

import React, { useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonMenuButton,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonRadioGroup,
  IonRadio,
  IonText,
  IonButton,
  IonLoading,
  IonAlert,
} from '@ionic/react';
import { API_CONFIG } from '../config/api.config';
import './Payment.css';

// Types
interface FormData {
  fullName: string;
  email: string;
  password: string;
  plan: string;
  card: string;
  expiry: string;
  cvc: string;
  paymentMethod: 'card' | 'gcash' | 'bank';
}

interface PaymentResponse {
  success: boolean;
  paymentId?: string;
  redirectUrl?: string;
  message: string;
}

const Payment: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    password: '',
    plan: '',
    card: '',
    expiry: '',
    cvc: '',
    paymentMethod: 'card',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const planPrices = {
    'Monthly - ₱500': 500,
    'Quarterly - ₱1,200': 1200,
    'Yearly - ₱4,000': 4000,
  };

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (errors[key as string]) {
      setErrors(prev => ({ ...prev, [key as string]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    // Personal Information Validation
    if (!formData.fullName || formData.fullName.length < 2) {
      newErrors.fullName = 'Please enter your full name';
      isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (!formData.password || formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
      isValid = false;
    }

    if (!formData.plan) {
      newErrors.plan = 'Please select a membership plan';
      isValid = false;
    }

    // Payment Method Specific Validation
    if (formData.paymentMethod === 'card') {
      const cardRegex = /^\d{16}$/;
      if (!formData.card.replace(/\s/g, '').match(cardRegex)) {
        newErrors.card = 'Please enter a valid 16-digit card number';
        isValid = false;
      }

      const expiryRegex = /^(0[1-9]|1[0-2])\/([0-9]{2})$/;
      if (!formData.expiry.match(expiryRegex)) {
        newErrors.expiry = 'Please enter a valid expiry date (MM/YY)';
        isValid = false;
      }

      const cvcRegex = /^\d{3,4}$/;
      if (!formData.cvc.match(cvcRegex)) {
        newErrors.cvc = 'Please enter a valid CVC (3-4 digits)';
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const createMember = async (paymentId: string): Promise<boolean> => {
    try {
      const memberData = {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password, // In production, hash this on the backend
        plan: formData.plan,
        paymentId,
        paymentMethod: formData.paymentMethod,
        status: 'Active',
        joinDate: new Date().toISOString(),
      };

      const response = await fetch(`${API_CONFIG.BASE_URL}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(memberData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create member');
      }

      return true;
    } catch (error) {
      console.error('Error creating member:', error);
      throw error;
    }
  };

  const processPayment = async (): Promise<PaymentResponse> => {
    const amount = planPrices[formData.plan as keyof typeof planPrices];
    
    const paymentData = {
      amount,
      currency: 'PHP',
      description: `ActiveCore ${formData.plan}`,
      customer: {
        name: formData.fullName,
        email: formData.email,
      },
      paymentMethod: formData.paymentMethod,
      ...(formData.paymentMethod === 'card' && {
        card: {
          number: formData.card.replace(/\s/g, ''),
          expiry: formData.expiry,
          cvc: formData.cvc,
        },
      }),
    };

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/payments/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Payment processing failed');
      }

      return result;
    } catch (error) {
      console.error('Payment error:', error);
      throw error;
    }
  };

  async function payWithGcash(amount: number, plan: string) {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`${API_CONFIG.BASE_URL}/payments/paymongo/create-source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ amount, plan })
    });
    const json = await res.json();
    if (res.ok && json.checkoutUrl) {
      window.location.href = json.checkoutUrl;
    } else {
      throw new Error(json.message || 'Failed to create PayMongo source');
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Check if email already exists
      const checkResponse = await fetch(`${API_CONFIG.BASE_URL}/members/check-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: formData.email }),
      });

      const checkResult = await checkResponse.json();
      
      if (checkResult.exists) {
        setErrors(prev => ({ ...prev, email: 'This email is already registered' }));
        setLoading(false);
        return;
      }

      if (formData.paymentMethod === 'gcash') {
        // For GCash payments
        await payWithGcash(planPrices[formData.plan as keyof typeof planPrices], formData.plan);
        return;
      }

      // Process payment
      const paymentResult = await processPayment();

      if (paymentResult.success) {
        if (paymentResult.redirectUrl) {
          // For GCash or bank payments that require redirect
          window.location.href = paymentResult.redirectUrl;
          return;
        }

        // Create member record
        await createMember(paymentResult.paymentId!);

        setAlertMessage('Registration and payment successful! Welcome to ActiveCore.');
        setShowAlert(true);
        
        // Reset form
        setFormData({
          fullName: '',
          email: '',
          password: '',
          plan: '',
          card: '',
          expiry: '',
          cvc: '',
          paymentMethod: 'card',
        });
      } else {
        throw new Error(paymentResult.message);
      }
    } catch (error: any) {
      setAlertMessage(error.message || 'An error occurred during registration');
      setShowAlert(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle>Payment</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonGrid fixed className="payment-container">
          <IonRow>
            <IonCol size="12" sizeMd="10" sizeLg="8" className="ion-margin-horizontal-auto">
              <IonCard className="payment-card">
                <IonCardHeader>
                  <IonCardTitle className="payment-title">Join ActiveCore</IonCardTitle>
                  <IonCardSubtitle className="payment-subtitle">
                    Complete your membership registration
                  </IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                  <form onSubmit={handleSubmit} noValidate>
                    <IonGrid>
                      <IonRow>
                        <IonCol size="12" sizeMd="6">
                          <IonItem className="payment-item" fill="outline">
                            <IonLabel position="stacked">Full Name</IonLabel>
                            <IonInput
                              value={formData.fullName}
                              autocomplete="name"
                              inputmode="text"
                              onIonInput={(e) => setField('fullName', (e.detail.value ?? '') as any)}
                            />
                          </IonItem>
                          {errors.fullName && (
                            <IonText className="payment-error" color="danger">
                              {errors.fullName}
                            </IonText>
                          )}
                        </IonCol>
                        <IonCol size="12" sizeMd="6">
                          <IonItem className="payment-item" fill="outline">
                            <IonLabel position="stacked">Email Address</IonLabel>
                            <IonInput
                              type="email"
                              value={formData.email}
                              autocomplete="email"
                              inputmode="email"
                              onIonInput={(e) => setField('email', (e.detail.value ?? '') as any)}
                            />
                          </IonItem>
                          {errors.email && (
                            <IonText className="payment-error" color="danger">
                              {errors.email}
                            </IonText>
                          )}
                        </IonCol>

                        <IonCol size="12">
                          <IonItem className="payment-item" fill="outline">
                            <IonLabel position="stacked">Password</IonLabel>
                            <IonInput
                              type="password"
                              value={formData.password}
                              autocomplete="new-password"
                              onIonInput={(e) => setField('password', (e.detail.value ?? '') as any)}
                            />
                          </IonItem>
                          {errors.password && (
                            <IonText className="payment-error" color="danger">
                              {errors.password}
                            </IonText>
                          )}
                        </IonCol>

                        <IonCol size="12">
                          <IonText className="payment-section-title">Select Membership Plan</IonText>
                          <IonRadioGroup
                            value={formData.plan}
                            onIonChange={(e) => setField('plan', (e.detail.value ?? '') as any)}
                          >
                            <IonList className="payment-radio-list">
                              {Object.keys(planPrices).map((plan) => {
                                const [name, price] = plan.split(' - ');
                                return (
                                  <IonItem key={plan} className="payment-radio-item" lines="full">
                                    <IonLabel>
                                      <div className="payment-plan-name">{name}</div>
                                      <div className="payment-plan-price">{price}</div>
                                    </IonLabel>
                                    <IonRadio slot="end" value={plan} />
                                  </IonItem>
                                );
                              })}
                            </IonList>
                          </IonRadioGroup>
                          {errors.plan && (
                            <IonText className="payment-error" color="danger">
                              {errors.plan}
                            </IonText>
                          )}
                        </IonCol>

                        <IonCol size="12">
                          <IonText className="payment-section-title">Payment Method</IonText>
                          <IonRadioGroup
                            value={formData.paymentMethod}
                            onIonChange={(e) =>
                              setField('paymentMethod', (e.detail.value ?? 'card') as any)
                            }
                          >
                            <IonList className="payment-radio-list">
                              <IonItem className="payment-radio-item" lines="full">
                                <IonLabel>Credit / Debit Card</IonLabel>
                                <IonRadio slot="end" value="card" />
                              </IonItem>
                              <IonItem className="payment-radio-item" lines="full">
                                <IonLabel>GCash</IonLabel>
                                <IonRadio slot="end" value="gcash" />
                              </IonItem>
                              <IonItem className="payment-radio-item" lines="full">
                                <IonLabel>Online Banking</IonLabel>
                                <IonRadio slot="end" value="bank" />
                              </IonItem>
                            </IonList>
                          </IonRadioGroup>
                        </IonCol>

                        {formData.paymentMethod === 'card' && (
                          <>
                            <IonCol size="12">
                              <IonText className="payment-section-title">Card Details</IonText>
                            </IonCol>
                            <IonCol size="12">
                              <IonItem className="payment-item" fill="outline">
                                <IonLabel position="stacked">Card Number</IonLabel>
                                <IonInput
                                  value={formData.card}
                                  inputmode="numeric"
                                  maxlength={19}
                                  placeholder="1234 5678 9012 3456"
                                  onIonInput={(e) => {
                                    const raw = (e.detail.value ?? '').toString();
                                    const formatted = raw
                                      .replace(/\D/g, '')
                                      .slice(0, 16)
                                      .replace(/(\d{4})/g, '$1 ')
                                      .trim();
                                    setField('card', formatted as any);
                                  }}
                                />
                              </IonItem>
                              {errors.card && (
                                <IonText className="payment-error" color="danger">
                                  {errors.card}
                                </IonText>
                              )}
                            </IonCol>
                            <IonCol size="12" sizeMd="6">
                              <IonItem className="payment-item" fill="outline">
                                <IonLabel position="stacked">Expiry Date</IonLabel>
                                <IonInput
                                  value={formData.expiry}
                                  inputmode="numeric"
                                  maxlength={5}
                                  placeholder="MM/YY"
                                  onIonInput={(e) => {
                                    let value = (e.detail.value ?? '').toString().replace(/\D/g, '');
                                    value = value.slice(0, 4);
                                    if (value.length >= 3) {
                                      value = value.slice(0, 2) + '/' + value.slice(2);
                                    }
                                    setField('expiry', value as any);
                                  }}
                                />
                              </IonItem>
                              {errors.expiry && (
                                <IonText className="payment-error" color="danger">
                                  {errors.expiry}
                                </IonText>
                              )}
                            </IonCol>
                            <IonCol size="12" sizeMd="6">
                              <IonItem className="payment-item" fill="outline">
                                <IonLabel position="stacked">CVC</IonLabel>
                                <IonInput
                                  value={formData.cvc}
                                  inputmode="numeric"
                                  maxlength={4}
                                  placeholder="123"
                                  onIonInput={(e) => {
                                    const value = (e.detail.value ?? '').toString().replace(/\D/g, '');
                                    setField('cvc', value as any);
                                  }}
                                />
                              </IonItem>
                              {errors.cvc && (
                                <IonText className="payment-error" color="danger">
                                  {errors.cvc}
                                </IonText>
                              )}
                            </IonCol>
                          </>
                        )}

                        {(formData.paymentMethod === 'gcash' || formData.paymentMethod === 'bank') && (
                          <IonCol size="12">
                            <IonText color="medium">
                              {formData.paymentMethod === 'gcash'
                                ? 'You will be redirected to GCash to complete your payment.'
                                : "You will be redirected to your bank's secure payment portal."}
                            </IonText>
                          </IonCol>
                        )}

                        <IonCol size="12">
                          <IonButton type="submit" expand="block" disabled={loading}>
                            {loading ? 'Processing…' : 'Complete Registration'}
                          </IonButton>
                          <div className="payment-note">
                            <IonText color="medium">
                              Your payment information is secure and encrypted
                            </IonText>
                          </div>
                        </IonCol>
                      </IonRow>
                    </IonGrid>
                  </form>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>

        <IonLoading isOpen={loading} message="Processing your payment..." />
        
        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => {
            setShowAlert(false);
            if (alertMessage.includes('successful')) {
              window.location.href = '/ActiveCore';
            }
          }}
          header="Registration Status"
          message={alertMessage}
          buttons={['OK']}
        />
      </IonContent>
    </IonPage>
  );
};

export default Payment;
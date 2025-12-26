import React, { useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonLoading,
  IonAlert,
} from '@ionic/react';
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
import { API_CONFIG } from '../config/api.config';

// ... other imports and component code ...

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const planPrices = {
    'Monthly - ₱500': 500,
    'Quarterly - ₱1,200': 1200,
    'Yearly - ₱4,000': 4000,
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, name } = e.target;
    setFormData(prev => ({
      ...prev,
      [id || name]: value,
    }));
    
    // Clear error when user starts typing
    if (errors[id || name]) {
      setErrors(prev => ({
        ...prev,
        [id || name]: '',
      }));
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
          <IonTitle>Payment</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="payment-container">
          <header className="header">
            <h1>Join ActiveCore</h1>
            <p>Complete your membership registration</p>
          </header>

          <form onSubmit={handleSubmit} noValidate>
            {/* Personal Information */}
            <div className="form-section">
              <div className="form-section-title">
                <i className="fas fa-user"></i> Personal Information
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="fullName">
                  Full Name
                </label>
                <input
                  type="text"
                  id="fullName"
                  className="form-control"
                  value={formData.fullName}
                  onChange={handleInputChange}
                />
                {errors.fullName && <div className="error-message">{errors.fullName}</div>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="email">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  className="form-control"
                  value={formData.email}
                  onChange={handleInputChange}
                />
                {errors.email && <div className="error-message">{errors.email}</div>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="password">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  className="form-control"
                  value={formData.password}
                  onChange={handleInputChange}
                />
                {errors.password && <div className="error-message">{errors.password}</div>}
              </div>
            </div>

            {/* Plan Selection */}
            <div className="form-section">
              <div className="form-section-title">
                <i className="fas fa-crown"></i> Select Membership Plan
              </div>
              <div className="plan-options">
                {Object.keys(planPrices).map((plan) => (
                  <label key={plan} className="plan-option">
                    <input
                      type="radio"
                      name="plan"
                      value={plan}
                      checked={formData.plan === plan}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, plan: e.target.value }))
                      }
                    />
                    <div className="plan-content">
                      <div className="plan-name">{plan.split(' - ')[0]}</div>
                      <div className="plan-price">{plan.split(' - ')[1]}</div>
                    </div>
                  </label>
                ))}
              </div>
              {errors.plan && <div className="error-message">{errors.plan}</div>}
            </div>

            {/* Payment Method Selection */}
            <div className="form-section">
              <div className="form-section-title">
                <i className="fas fa-credit-card"></i> Payment Method
              </div>
              <div className="payment-method-options">
                <label className="payment-method-option">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="card"
                    checked={formData.paymentMethod === 'card'}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, paymentMethod: e.target.value as any }))
                    }
                  />
                  <div className="payment-method-content">
                    <i className="fas fa-credit-card"></i>
                    <span>Credit/Debit Card</span>
                  </div>
                </label>
                <label className="payment-method-option">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="gcash"
                    checked={formData.paymentMethod === 'gcash'}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, paymentMethod: e.target.value as any }))
                    }
                  />
                  <div className="payment-method-content">
                    <i className="fas fa-mobile-alt"></i>
                    <span>GCash</span>
                  </div>
                </label>
                <label className="payment-method-option">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="bank"
                    checked={formData.paymentMethod === 'bank'}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, paymentMethod: e.target.value as any }))
                    }
                  />
                  <div className="payment-method-content">
                    <i className="fas fa-university"></i>
                    <span>Online Banking</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Card Details - Only show for card payment */}
            {formData.paymentMethod === 'card' && (
              <div className="form-section">
                <div className="form-section-title">
                  <i className="fas fa-credit-card"></i> Card Details
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="card">
                    Card Number
                  </label>
                  <input
                    type="text"
                    id="card"
                    className="form-control"
                    maxLength={19}
                    placeholder="1234 5678 9012 3456"
                    value={formData.card}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        card: e.target.value
                          .replace(/\D/g, '')
                          .replace(/(\d{4})/g, '$1 ')
                          .trim(),
                      }))
                    }
                  />
                  {errors.card && <div className="error-message">{errors.card}</div>}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="expiry">
                      Expiry Date
                    </label>
                    <input
                      type="text"
                      id="expiry"
                      className="form-control"
                      maxLength={5}
                      placeholder="MM/YY"
                      value={formData.expiry}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\D/g, '');
                        if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2);
                        setFormData((prev) => ({ ...prev, expiry: value }));
                      }}
                    />
                    {errors.expiry && <div className="error-message">{errors.expiry}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="cvc">
                      CVC
                    </label>
                    <input
                      type="text"
                      id="cvc"
                      className="form-control"
                      maxLength={4}
                      placeholder="123"
                      value={formData.cvc}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          cvc: e.target.value.replace(/\D/g, ''),
                        }))
                      }
                    />
                    {errors.cvc && <div className="error-message">{errors.cvc}</div>}
                  </div>
                </div>
              </div>
            )}

            {/* Payment Info for GCash/Bank */}
            {(formData.paymentMethod === 'gcash' || formData.paymentMethod === 'bank') && (
              <div className="form-section">
                <div className="payment-info">
                  <i className="fas fa-info-circle"></i>
                  <p>
                    {formData.paymentMethod === 'gcash' 
                      ? 'You will be redirected to GCash to complete your payment.'
                      : 'You will be redirected to your bank\'s secure payment portal.'
                    }
                  </p>
                </div>
              </div>
            )}

            <button type="submit" className="submit-button" disabled={loading}>
              <i className="fas fa-check-circle"></i> 
              {loading ? 'Processing...' : 'Complete Registration'}
            </button>

            <p className="info-text">
              <i className="fas fa-shield-alt"></i> Your payment information is secure and encrypted
            </p>
          </form>
        </div>

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
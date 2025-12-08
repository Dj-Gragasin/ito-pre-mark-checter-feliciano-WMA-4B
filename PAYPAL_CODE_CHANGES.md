# PayPal Integration - Code Changes Reference

**Complete code changes from PayMongo to PayPal**

---

## 1. Backend Configuration Changes

### File: `activecore-db/src/index.ts`

#### Change 1.1: Remove PayMongo Config (Line ~70)

**Removed:**
```typescript
// PayMongo API configuration
const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY || 'sk_test_your_key_here';
const PAYMONGO_BASE_URL = 'https://api.paymongo.com/v1';
```

**Added:**
```typescript
// PayPal API configuration
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox'; // 'sandbox' or 'live'
const PAYPAL_API_URL = PAYPAL_MODE === 'live' 
  ? 'https://api.paypal.com/v2'
  : 'https://api.sandbox.paypal.com/v2';
```

#### Change 1.2: Update Health Check (Line ~608)

**Removed:**
```typescript
    let paymongoOk = false;
    try {
      await axios.get(PAYMONGO_BASE_URL + '/v1/sources', {
        timeout: 1500,
        auth: { username: (process.env.PAYMONGO_SECRET_KEY || ''), password: '' }
      });
      paymongoOk = true;
    } catch (e) {
      paymongoOk = false;
    }

    return res.json({
      ok: true,
      dbConnected: dbOk,
      openai: openaiOk,
      paymongo: paymongoOk,
      timestamp: new Date().toISOString()
    });
```

**Added:**
```typescript
    let paypalOk = false;
    try {
      await axios.post(
        `${PAYPAL_API_URL}/oauth2/token`,
        'grant_type=client_credentials',
        {
          timeout: 1500,
          auth: {
            username: PAYPAL_CLIENT_ID,
            password: PAYPAL_CLIENT_SECRET
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      paypalOk = true;
    } catch (e) {
      paypalOk = false;
    }

    return res.json({
      ok: true,
      dbConnected: dbOk,
      openai: openaiOk,
      paypal: paypalOk,
      timestamp: new Date().toISOString()
    });
```

#### Change 1.3: Add PayPal Helper Function (Line ~2413)

**Removed:**
```typescript
// Add PayMongo webhook secret + public key + app base url
const PAYMONGO_WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET || '';
const PAYMONGO_PUBLIC_KEY = process.env.PAYMONGO_PUBLIC_KEY || '';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Basic auth header helper for PayMongo
const paymongoAuthHeader = () => `Basic ${Buffer.from(`${PAYMONGO_SECRET_KEY}:`).toString('base64')}`;
```

**Added:**
```typescript
// App configuration
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Helper function to get PayPal access token
async function getPayPalAccessToken(): Promise<string> {
  try {
    const response = await axios.post(
      `${PAYPAL_API_URL}/oauth2/token`,
      'grant_type=client_credentials',
      {
        auth: {
          username: PAYPAL_CLIENT_ID,
          password: PAYPAL_CLIENT_SECRET
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return response.data.access_token;
  } catch (error: any) {
    console.error('❌ Failed to get PayPal access token:', error.response?.data || error.message);
    throw new Error('PayPal authentication failed');
  }
}
```

#### Change 1.4: Replace PayMongo Endpoints (Line ~2421)

**Removed:** 
```typescript
// Create a PayMongo 'gcash' source and return redirect URL
app.post('/api/payments/paymongo/create-source', authenticateToken, async (req: AuthRequest, res: Response) => {
  // ... PayMongo implementation (45 lines)
});

// PayMongo webhook - verify signature and update DB
app.post('/api/payments/paymongo/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  // ... PayMongo webhook implementation (100 lines)
});

// Verify endpoint — read DB payment status by source or payment id
app.get('/api/payments/paymongo/verify', authenticateToken, async (req: AuthRequest, res: Response) => {
  // ... PayMongo verify implementation (20 lines)
});

// Verify PayMongo payment for frontend (after redirect)
app.post('/api/payments/verify-paymongo', authenticateToken, async (req: AuthRequest, res: Response) => {
  // ... PayMongo verification implementation (60 lines)
});
```

**Added:**
```typescript
// Create a PayPal order and return redirect URL
app.post('/api/payments/paypal/create-order', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { amount, plan } = req.body;

    if (!amount || !plan) {
      return res.status(400).json({ success: false, message: 'Missing amount or plan' });
    }

    const accessToken = await getPayPalAccessToken();

    const planDescription = plan === 'monthly' ? 'Monthly Membership' : 
                           plan === 'quarterly' ? 'Quarterly Membership' :
                           'Annual Membership';

    const payload = {
      intent: 'CAPTURE',
      payer: {
        email_address: `user_${userId}@activecore.test`
      },
      purchase_units: [{
        amount: {
          currency_code: 'PHP',
          value: String(amount)
        },
        description: planDescription,
        custom_id: `${userId}|${plan}` // Store userId and plan in custom_id
      }],
      application_context: {
        brand_name: 'ActiveCore Fitness',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
        return_url: `${APP_URL}/member/payment/success`,
        cancel_url: `${APP_URL}/member/payment/cancel`
      }
    };

    const response = await axios.post(`${PAYPAL_API_URL}/checkout/orders`, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const orderId = response.data.id;
    const approvalLink = response.data.links?.find((link: any) => link.rel === 'approve')?.href;

    if (!orderId || !approvalLink) {
      return res.status(500).json({ success: false, message: 'Failed to create PayPal order' });
    }

    // Insert payment record (pending)
    await pool.query(
      `INSERT INTO payments (user_id, amount, payment_method, membership_type, payment_status, transaction_id, created_at)
         VALUES (?, ?, 'paypal', ?, 'pending', ?, NOW())`,
      [userId, Number(amount), plan, orderId]
    );

    console.log(`💳 PayPal order created for user ${userId}: ${orderId}`);
    res.json({ success: true, approvalLink, orderId });
  } catch (err: any) {
    console.error('❌ create-order error:', err.response?.data || err.message || err);
    res.status(500).json({ success: false, message: 'Failed to create PayPal order' });
  }
});

// Capture PayPal order and update subscription
app.post('/api/payments/paypal/capture-order', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Missing orderId' });
    }

    const accessToken = await getPayPalAccessToken();

    // Capture the payment
    const captureResponse = await axios.post(
      `${PAYPAL_API_URL}/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const paymentStatus = captureResponse.data.status;
    const captureId = captureResponse.data.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    const customId = captureResponse.data.purchase_units?.[0]?.custom_id;
    const [paymentUserId, plan] = customId?.split('|') || [null, null];

    if (paymentStatus !== 'COMPLETED') {
      return res.json({ success: false, status: paymentStatus, message: 'Payment not completed' });
    }

    // Update payment record
    await pool.query(
      `UPDATE payments SET payment_status = ?, payment_date = NOW() WHERE transaction_id = ? AND user_id = ?`,
      ['completed', orderId, userId]
    );

    // Calculate subscription dates
    let months = 1;
    if (plan === 'annual') months = 12;
    else if (plan === 'quarterly') months = 3;

    const subscriptionStart = new Date();
    const subscriptionEnd = new Date();
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + months);

    // Get payment amount
    const [paymentRows] = await pool.query<any[]>(
      `SELECT amount FROM payments WHERE transaction_id = ? AND user_id = ? LIMIT 1`,
      [orderId, userId]
    );

    const paymentAmount = paymentRows?.[0]?.amount || 0;

    // Update user subscription
    await pool.query(
      `UPDATE users 
       SET status = 'active',
           payment_status = 'paid',
           subscription_start = ?,
           subscription_end = ?,
           membership_type = ?,
           membership_price = ?,
           next_payment = ?
       WHERE id = ?`,
      [
        isoDateString(subscriptionStart),
        isoDateString(subscriptionEnd),
        plan,
        paymentAmount,
        isoDateString(subscriptionEnd),
        userId
      ]
    );

    // Record payment history
    await pool.query(
      `INSERT INTO payments_history (user_id, payment_id, amount, payment_method, status, created_at)
         VALUES (?, ?, ?, 'paypal', 'completed', NOW())`,
      [userId, orderId, paymentAmount]
    );

    console.log(`✅ Payment for user ${userId} captured and completed (orderId=${orderId}), subscription updated to ${plan}`);

    res.json({
      success: true,
      status: 'completed',
      subscription: {
        start: subscriptionStart.toISOString().split('T')[0],
        end: subscriptionEnd.toISOString().split('T')[0],
        type: plan
      }
    });
  } catch (err: any) {
    console.error('❌ capture-order error:', err.response?.data || err.message || err);
    
    // If it's a 404, order may not exist
    if (err.response?.status === 404) {
      return res.status(400).json({ success: false, message: 'PayPal order not found' });
    }

    res.status(500).json({ success: false, message: 'Failed to capture PayPal payment' });
  }
});
```

---

## 2. Frontend Component Changes

### File: `src/pages/MemberPayment.tsx`

#### Change 2.1: Replace Payment Handler Function (Line ~95)

**Removed:**
```typescript
  const handleGCashPayment = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      const amount = MEMBERSHIP_PRICES[selectedPlan];
      
      // Get userId from stored user object
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const userId = user?.id;

      console.log('💳 Creating PayMongo GCash checkout:', {
        userId,
        membershipType: selectedPlan,
        amount,
        paymentMethod: 'gcash'
      });

      if (!userId) {
        throw new Error('User ID not found. Please log in again.');
      }

      // Call PayMongo create-source endpoint to get checkout URL
      const response = await fetch(`${API_URL}/payments/paymongo/create-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          amount,
          plan: selectedPlan,
          successRedirect: `${window.location.origin}/member/payment/success`,
          failedRedirect: `${window.location.origin}/member/payment/failed`,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success && result.checkoutUrl) {
        console.log('✅ PayMongo checkout URL received:', result.checkoutUrl);
        
        // Show notification that redirecting to GCash
        presentToast({
          message: '🔄 Redirecting to GCash payment...',
          duration: 2000,
          color: 'primary',
          position: 'top'
        });

        // Redirect to PayMongo checkout (opens GCash in real payment gateway)
        setTimeout(() => {
          window.location.href = result.checkoutUrl;
        }, 500);
      } else {
        throw new Error(result.message || 'Failed to create checkout');
      }
    } catch (error: any) {
      console.error('❌ GCash payment error:', error);
      presentToast({
        message: error.message || '❌ Failed to start payment. Please try again.',
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      setIsProcessing(false);
    }
  };
```

**Added:**
```typescript
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
```

#### Change 2.2: Update Button Text and Click Handler (Line ~287)

**Removed:**
```typescript
                {/* GCash Payment Button - AUTO APPROVED */}
                <IonButton
                  expand="block"
                  className="gcash-button"
                  onClick={handleGCashPayment}
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
                      Pay with GCash - Instant Activation ⚡
                    </>
                  )}
                </IonButton>
```

**Added:**
```typescript
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
```

---

### File: `src/pages/PaymentSuccess.tsx`

#### Change 3.1: Replace Verification Function (Line ~20)

**Removed:**
```typescript
  useEffect(() => {
    verifyPayment();
  }, []);

  const verifyPayment = async () => {
    try {
      // Get sourceId from URL params
      const params = new URLSearchParams(window.location.search);
      const sourceId = params.get('sourceId');

      console.log('🔍 Verifying PayMongo payment, sourceId:', sourceId);

      if (!sourceId) {
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

      // Call backend to verify payment status
      const response = await fetch(`${API_URL}/payments/verify-paymongo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ sourceId }),
      });
      // ... rest of verification logic
    }
    // ... catch and finally blocks
  };
```

**Added:**
```typescript
  useEffect(() => {
    capturePayment();
  }, []);

  const capturePayment = async () => {
    try {
      // Get orderId from URL params
      const params = new URLSearchParams(window.location.search);
      const orderId = params.get('token');

      console.log('🔍 Capturing PayPal payment, orderId:', orderId);

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
      const response = await fetch(`${API_URL}/payments/paypal/capture-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ orderId }),
      });
      // ... rest of capture logic
    }
    // ... catch and finally blocks
  };
```

#### Change 3.2: Update Verification Text (Line ~43)

**Removed:**
```typescript
                  <p style={{ color: '#b0b0b0' }}>Please wait while we confirm your payment with GCash</p>
```

**Added:**
```typescript
                  <p style={{ color: '#b0b0b0' }}>Please wait while we confirm your PayPal payment</p>
```

---

## 3. Configuration File Changes

### File: `activecore-db/.env`

**Removed:**
```bash
PAYMONGO_SECRET_KEY=sk_live_...
PAYMONGO_PUBLIC_KEY=pk_live_...
PAYMONGO_WEBHOOK_SECRET=whsec_...
```

**Added:**
```bash
# PayPal Configuration (Personal Account - No Business Verification Required)
PAYPAL_CLIENT_ID=your_paypal_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_client_secret_here
PAYPAL_MODE=sandbox
```

---

## 4. Database Schema

### No Changes Required

The existing database schema works perfectly with PayPal:

```sql
-- payments table - payment_method now stores 'paypal' instead of 'gcash'
INSERT INTO payments (
  user_id, 
  amount, 
  payment_method,  ← 'paypal' instead of 'gcash'
  membership_type, 
  payment_status, 
  transaction_id   ← OrderId from PayPal
) VALUES (...)

-- users table - completely unchanged
UPDATE users SET
  status,
  payment_status,
  subscription_start,
  subscription_end,
  membership_type,
  membership_price
WHERE id = ?
```

---

## 5. Testing Code

### Manual Test - Browser Console

```javascript
// Test 1: Create order
fetch('http://localhost:3002/api/payments/paypal/create-order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  },
  body: JSON.stringify({
    amount: 1500,
    plan: 'monthly'
  })
})
.then(r => r.json())
.then(d => console.log(d))

// Expected:
// {
//   success: true,
//   orderId: "EC-...",
//   approvalLink: "https://www.sandbox.paypal.com/..."
// }
```

---

## 6. Summary of Changes

| Component | Change | Lines |
|-----------|--------|-------|
| Backend Config | Remove PayMongo, Add PayPal | ~20 |
| Health Check | Update status endpoint | ~30 |
| Helper Function | Add PayPal token generator | ~20 |
| API Endpoints | Replace 4 endpoints with 2 | ~200 |
| MemberPayment | Update payment handler | ~80 |
| PaymentSuccess | Update capture logic | ~60 |
| Environment | Update .env variables | ~10 |
| **Total** | | **~420 lines** |

---

## 7. Backward Compatibility

### Breaking Changes ❌
- Old PayMongo endpoints removed
- Payment method changed from 'gcash' to 'paypal'
- .env variables completely different

### Non-Breaking ✅
- Database schema unchanged
- Route structure unchanged
- User interface similar
- Subscription logic identical

---

## 8. File Locations

```
activecore-db/
├── src/
│   └── index.ts          ← Backend endpoints (Lines 70-76, 2430-2570)
├── .env                  ← Configuration

src/
├── pages/
│   ├── MemberPayment.tsx ← Payment button (Line 287, ~95)
│   └── PaymentSuccess.tsx ← Success handler (Line 20, 40)
```

---

**✅ All code changes complete and integrated!**

Next: Follow `PAYPAL_SETUP.md` for configuration and testing.

# PayPal Redirect Checkout Setup Guide

**Complete guide to integrating PayPal personal account payments with ActiveCore**

---

## Overview

This guide explains how to set up PayPal payments using a **personal PayPal account** (no business verification required). The system uses PayPal's REST API with redirect-based checkout flow.

---

## ✅ Requirements

- Personal PayPal account (free to create)
- Access to PayPal Developer Dashboard
- ActiveCore system running
- .env file in `activecore-db/` directory

---

## Step 1: Create a PayPal Personal Account

If you don't have a PayPal account:

1. Go to https://www.paypal.com
2. Click **Sign Up**
3. Choose **Personal Account**
4. Fill in your information
5. Complete email verification
6. Confirm your identity

You now have a PayPal personal account!

---

## Step 2: Access PayPal Developer Dashboard

1. Go to https://developer.paypal.com
2. Click **Log In** (use your PayPal account email)
3. Click the **Settings** icon (top right)
4. Select **Sandbox** (for testing)
5. You're now in the PayPal Developer Sandbox

---

## Step 3: Create an Application

### In the Developer Dashboard:

1. Go to **Apps & Credentials** (left menu)
2. Make sure you're in **Sandbox** mode (dropdown at top)
3. Click **Create App** button
4. Enter App Name: `ActiveCore Fitness`
5. Keep App Type as: `Merchant`
6. Click **Create App**

---

## Step 4: Get Your Credentials

### Locate Your Sandbox Credentials:

1. In **Apps & Credentials** page
2. Under **Sandbox** section, click your app name
3. You'll see:
   - **Client ID** (starts with `AY...`)
   - **Secret** (starts with `ECX...`)

**⚠️ IMPORTANT:** Copy these credentials exactly! You'll need them in the next step.

---

## Step 5: Configure Your .env File

### Update `activecore-db/.env`:

```bash
# PayPal Configuration (Personal Account - No Business Verification Required)
PAYPAL_CLIENT_ID=AY... (paste your Client ID here)
PAYPAL_CLIENT_SECRET=ECX... (paste your Secret here)
PAYPAL_MODE=sandbox
APP_URL=http://localhost:3000
```

### Example (with real values):

```bash
PAYPAL_CLIENT_ID=AYcSt8qg7Yfx9kM2nPvQ8rLu3wXyZ0aB1cDeFgHiJkL
PAYPAL_CLIENT_SECRET=ECX5nO6pQrStU7vWxYzA0BcDeFgHiJkLmNoPqRsTuVw
PAYPAL_MODE=sandbox
APP_URL=http://localhost:3000
```

### Save the file

---

## Step 6: Start the Backend

```bash
cd activecore-db
npm run dev
```

You should see:
```
✅ Server running on port 3002
```

---

## Step 7: Test with Sandbox Buyer Account

### Create a Sandbox Buyer Account:

1. In PayPal Developer Dashboard
2. Go to **Accounts** (left menu)
3. Look for **Sandbox Test Accounts**
4. Find the **Buyer** account (usually pre-created)
5. Use this email to log in during payment:

```
Email: sb-xxxxx@personal.example.com
Password: Check your Dashboard for this
```

---

## Step 8: Test PayPal Payment

### Start the Frontend:

```bash
npm start
```

### Complete Test Payment:

1. Log in to ActiveCore as a member
2. Go to **Payment & Renewal**
3. Select a plan (Monthly/Quarterly/Annual)
4. Click **Pay with PayPal**
5. You'll be redirected to PayPal
6. Log in with your **Sandbox Buyer Account**
7. Review the payment
8. Click **Pay Now**
9. You'll be redirected back to success page

### Expected Results:

✅ Redirected to PayPal checkout  
✅ Sandbox buyer account login works  
✅ Payment completes  
✅ Redirected back to ActiveCore success page  
✅ Subscription updated in database

---

## Backend Endpoints

### 1. Create PayPal Order

**Endpoint:** `POST /api/payments/paypal/create-order`

**Request:**
```json
{
  "amount": 1500,
  "plan": "monthly"
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "ORDER_ID",
  "approvalLink": "https://www.sandbox.paypal.com/cgi-bin/webscr?cmd=_express-checkout&token=EC-xyz..."
}
```

### 2. Capture PayPal Order

**Endpoint:** `POST /api/payments/paypal/capture-order`

**Request:**
```json
{
  "orderId": "ORDER_ID"
}
```

**Response:**
```json
{
  "success": true,
  "status": "completed",
  "subscription": {
    "start": "2024-01-15",
    "end": "2024-02-15",
    "type": "monthly"
  }
}
```

---

## Database Records

### Payment Record Created:

```sql
INSERT INTO payments (
  user_id, 
  amount, 
  payment_method, 
  membership_type, 
  payment_status, 
  transaction_id
) VALUES (
  5,
  1500,
  'paypal',
  'monthly',
  'pending',
  'ORDER_ID'
)
```

### User Updated After Payment:

```sql
UPDATE users SET
  status = 'active',
  payment_status = 'paid',
  subscription_start = '2024-01-15',
  subscription_end = '2024-02-15',
  membership_type = 'monthly',
  membership_price = 1500
WHERE id = 5
```

---

## Backend Logs to Expect

### Order Creation:
```
💳 PayPal order created for user 5: EC-4VS24953NY025543W
```

### Payment Capture:
```
✅ Payment for user 5 captured and completed (orderId=EC-4VS24953NY025543W), subscription updated to monthly
```

---

## Troubleshooting

### Issue: "Failed to create PayPal order"

**Check:**
- [ ] `PAYPAL_CLIENT_ID` is correct (starts with `AY`)
- [ ] `PAYPAL_CLIENT_SECRET` is correct (starts with `ECX`)
- [ ] `PAYPAL_MODE=sandbox` is set
- [ ] Backend was restarted after changing .env
- [ ] Check backend logs for exact error

**Solution:**
1. Verify credentials in PayPal Developer Dashboard
2. Copy them exactly (no spaces)
3. Restart backend: `npm run dev`

### Issue: "Payment not completed"

**Check:**
- [ ] You logged in with correct sandbox account
- [ ] You clicked "Pay Now"
- [ ] Your browser wasn't closed during payment

**Solution:**
- Try the payment flow again
- Check PayPal Sandbox dashboard for transaction

### Issue: Redirected to PayPal but stuck

**Check:**
- [ ] `APP_URL=http://localhost:3000` is correct
- [ ] Frontend is running on port 3000
- [ ] PayPal can reach your redirect URLs

**Solution:**
- Verify `APP_URL` in .env
- Check browser console for errors

### Issue: "Invalid credentials"

**Check:**
- [ ] No spaces in Client ID or Secret
- [ ] Credentials are from **Sandbox** (not Live)
- [ ] .env file saved correctly

**Solution:**
1. Go to PayPal Developer Dashboard
2. Recopy credentials carefully
3. Paste into .env (no quotes)
4. Restart backend

---

## Test Scenarios

### Scenario 1: Successful Payment

```
1. Member logs in
2. Goes to Payment page
3. Selects "Monthly" plan (₱1,500)
4. Clicks "Pay with PayPal"
5. Redirects to PayPal checkout
6. Logs in with sandbox buyer account
7. Reviews order
8. Clicks "Pay Now"
9. Redirects to success page
10. Sees "✅ Payment Successful!"
11. Database updated with subscription_end date
```

✅ **Expected Result:** Member has active subscription for 30 days

### Scenario 2: Cancel Payment

```
1. Member clicks "Pay with PayPal"
2. Redirects to PayPal
3. Clicks "Cancel and return to shop"
4. Redirected to /member/payment/cancel
5. Sees error message
```

✅ **Expected Result:** No payment recorded, member can try again

---

## Switching to Live Mode (Production)

### Step 1: Get Live Credentials

1. In PayPal Developer Dashboard
2. Switch to **Live** tab (not Sandbox)
3. Copy Live **Client ID**
4. Copy Live **Secret**

### Step 2: Update .env

```bash
PAYPAL_CLIENT_ID=YOUR_LIVE_CLIENT_ID
PAYPAL_CLIENT_SECRET=YOUR_LIVE_SECRET
PAYPAL_MODE=live
APP_URL=https://yourdomain.com (use HTTPS!)
```

### Step 3: Update Return URLs

The system will automatically use your APP_URL for redirects:
- Success: `{APP_URL}/member/payment/success`
- Cancel: `{APP_URL}/member/payment/cancel`

### ⚠️ Important for Production:

1. **Use HTTPS** - PayPal requires HTTPS URLs
2. **Use real domain** - Not localhost
3. **Update APP_URL** - Change to production domain
4. **Test thoroughly** - With test payments first
5. **Monitor transactions** - Check PayPal dashboard regularly

---

## Testing Payouts (Optional)

### Test IPA Payment Scenarios:

PayPal Sandbox provides test account emails for different scenarios:

```
Approved Payment:    Use your sandbox buyer account
Insufficient Funds:  sb-subnx5589088@business.example.com (create custom)
Fraud Block:         Contact PayPal support
```

---

## Security Considerations

✅ **What's Secure:**
- Client Secret never sent to frontend
- All payments verified server-side
- User ID attached to order
- Order ID matches user before capturing

✅ **What You Should Do:**
- Use HTTPS in production
- Rotate secrets periodically
- Monitor payment logs
- Set up fraud alerts in PayPal

❌ **What Not To Do:**
- Never hardcode credentials in frontend
- Never expose Client Secret
- Don't trust frontend payment amounts
- Don't skip user verification

---

## Support & Resources

### PayPal Official
- Website: https://www.paypal.com
- Developer: https://developer.paypal.com
- API Docs: https://developer.paypal.com/docs/
- Sandbox Testing: https://developer.paypal.com/docs/platforms/sandboxes/

### ActiveCore
- Backend logs: Check `npm run dev` output
- Database: Check `payments` and `users` tables
- Frontend logs: Check browser console

### Common Issues
- **"401 Unauthorized"** - Check Client ID/Secret
- **"404 Not Found"** - Order ID doesn't exist
- **"Redirect failed"** - Check APP_URL in .env

---

## Verification Checklist

Before going live:

- [ ] PayPal personal account created
- [ ] Developer account set up
- [ ] Application created
- [ ] Client ID copied correctly
- [ ] Client Secret copied correctly
- [ ] .env file updated
- [ ] Backend restarted
- [ ] Frontend tests pass
- [ ] Sandbox payment completed successfully
- [ ] Database updated correctly
- [ ] Success page displays properly
- [ ] Ready for production

---

## Quick Reference

| Item | Value |
|------|-------|
| Account Type | Personal (No Business Verification) |
| API Mode | REST API v2 |
| Checkout Type | Redirect (Not Hosted) |
| Payment Method | PayPal Balance or Card |
| Currencies | PHP, USD, etc. |
| Test Mode | Sandbox |
| Live Mode | Live (after verification) |

---

**🎉 You're all set! Your PayPal payment system is ready to use.**

Questions? Check the troubleshooting section or review the backend logs.

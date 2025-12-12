# Stripe Payment Setup Guide

## Problem
You're seeing the error: `Invalid API Key provided: pk_test_*******lder`

This means the frontend is using a placeholder Stripe key instead of a real one.

## Solution

### Step 1: Get Your Stripe Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Make sure you're in **Test mode** (toggle in top right)
3. Copy your **Publishable key** (starts with `pk_test_`)
4. Copy your **Secret key** (starts with `sk_test_`)

### Step 2: Configure Backend

In `backend/.env`:
```env
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
```

### Step 3: Configure Frontend

Create `frontend/.env` file:
```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

**Important**: 
- Both keys must be from the **same Stripe account**
- Both must be **test keys** (for development) or both **live keys** (for production)
- The publishable key starts with `pk_test_` or `pk_live_`
- The secret key starts with `sk_test_` or `sk_live_`

### Step 4: Restart Servers

After adding the keys:

1. **Backend**: Restart your Node.js server
   ```bash
   cd backend
   npm start
   ```

2. **Frontend**: Restart your Vite dev server
   ```bash
   cd frontend
   npm run dev
   ```

### Step 5: Verify

1. Check backend console - you should see:
   ```
   ✅ Stripe initialized with key starting with: sk_test...
   ℹ️  Using Stripe TEST mode
   ```

2. Check browser console - you should NOT see:
   ```
   ⚠️ VITE_STRIPE_PUBLISHABLE_KEY not configured
   ```

3. Try the payment flow again

## Testing

Use Stripe test card numbers:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

Use any:
- **Expiry**: Future date (e.g., 12/25)
- **CVC**: Any 3 digits (e.g., 123)
- **ZIP**: Any 5 digits (e.g., 12345)

## Troubleshooting

### Error: "Invalid API Key provided"
- ✅ Check that `VITE_STRIPE_PUBLISHABLE_KEY` is set in `frontend/.env`
- ✅ Restart the frontend dev server after adding the key
- ✅ Make sure the key starts with `pk_test_` or `pk_live_`

### Error: "401 Unauthorized"
- ✅ Ensure publishable key and secret key are from the same Stripe account
- ✅ Ensure both are test keys or both are live keys (not mixed)
- ✅ Check that keys are correctly set in environment variables

### Error: "Payment configuration error"
- ✅ Verify backend has `STRIPE_SECRET_KEY` set
- ✅ Verify frontend has `VITE_STRIPE_PUBLISHABLE_KEY` set
- ✅ Restart both servers after configuration

## Security Notes

⚠️ **Never commit `.env` files to git!**

Make sure `.env` is in your `.gitignore`:
```
.env
.env.local
.env.*.local
```


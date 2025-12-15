# Lead Assignment with 24-Hour Priority - Implementation Summary

## Client Requirements

1. **Customer Business Selection (3-5 businesses)**
   - Customer must select 3-5 businesses when creating a service request
   - First priority: Featured and Pro members receive leads FIRST
   - 24-hour window: Priority providers have 24 hours to accept/reject
   - After 24 hours: If not accepted, leads go to 2-4 other selected businesses

2. **Lead Acceptance Flow**
   - No customer contact details displayed until lead is accepted
   - Once accepted, customer contact details are displayed
   - Lead cost is charged AUTOMATICALLY when provider accepts

## Implementation Details

### 1. Frontend Changes

#### `frontend/src/pages/ServiceRequest.jsx`
- ✅ Updated validation to require 3-5 businesses (was: at least 1)
- ✅ Added maximum limit of 5 businesses
- ✅ Updated UI hint text: "Select 3-5 businesses"

#### `frontend/src/pages/ProviderLeads.jsx`
- ✅ Updated `handleConfirmAccept`: Now shows payment modal first to collect payment method
- ✅ Updated `handlePaymentSuccess`: Handles automatic charging with payment method
- ✅ Shows contact details only after payment succeeds

#### `frontend/src/components/ProviderPaymentModal.jsx`
- ✅ Added support for `pendingProposal` prop
- ✅ Creates payment method first, then accepts lead with auto-charge
- ✅ Handles payment confirmation flow

### 2. Backend Changes

#### `backend/routes/service-requests.js`
- ✅ **POST /api/service-requests**: 
  - Validates 3-5 businesses selected
  - Updated `assignProvidersForRequest` to separate priority providers
  - Stores `fallbackBusinessIds` in lead metadata
  - Stores `priorityExpiresAt` (24 hours from creation)
  - Creates lead WITHOUT customer contact details (set to null)

- ✅ **assignProvidersForRequest function**:
  - Separates Featured/Pro providers from others
  - Returns `fallbackBusinessIds` for 24-hour assignment
  - Primary provider is selected from priority providers first

#### `backend/routes/provider.js`
- ✅ **GET /api/provider/leads**:
  - Hides customer contact details until `status === 'accepted'`
  - Returns `contactDetailsVisible: true/false` flag

- ✅ **PATCH /api/provider/leads/:id/accept**:
  - Requires `paymentMethodId` in request body
  - Creates payment intent with `confirm: true` for automatic charging
  - If payment succeeds immediately:
    - Updates lead with customer contact details
    - Creates proposal
    - Returns success with contact details
  - If payment requires action: Returns client secret for 3D Secure

#### `backend/routes/webhooks.js`
- ✅ **handleLeadPaymentSucceeded**:
  - Updates lead with customer contact details after payment succeeds
  - Sets `customerName`, `customerEmail`, `customerPhone` in lead

#### `backend/utils/assignFallbackLeads.js` (NEW)
- ✅ Utility function to assign leads to fallback businesses after 24 hours
- ✅ Checks if lead was already accepted before assigning
- ✅ Creates leads without customer contact details

#### `backend/routes/scheduled-tasks.js` (NEW)
- ✅ **POST /api/scheduled-tasks/assign-fallback-leads**:
  - Finds leads with expired priority period (>24 hours)
  - Assigns to fallback businesses if not accepted
  - Can be called by cron job hourly

### 3. Database Changes

#### Lead Model
- ✅ Customer contact fields (`customerName`, `customerEmail`, `customerPhone`) are set to `null` initially
- ✅ Contact details are populated only after lead is accepted and payment succeeds

## Flow Diagram

### Lead Creation Flow:
```
1. Customer creates service request (selects 3-5 businesses)
2. Backend assigns to Featured/Pro providers FIRST
3. Lead created WITHOUT customer contact details (null)
4. Lead metadata stores:
   - fallbackBusinessIds: [2-4 other selected businesses]
   - priorityExpiresAt: 24 hours from now
```

### Lead Acceptance Flow:
```
1. Provider sees lead (NO contact details)
2. Provider clicks "Accept" → Enters proposal details
3. Payment modal opens → Provider enters payment method
4. Payment method created → Lead accepted with auto-charge
5. If payment succeeds:
   - Lead status → 'accepted'
   - Customer contact details revealed
   - Proposal created
6. Provider can now see customer contact details
```

### 24-Hour Fallback Flow:
```
1. Scheduled task runs (hourly via cron)
2. Finds leads with expired priorityExpiresAt
3. Checks if lead was accepted
4. If not accepted → Assigns to fallback businesses
5. Creates new leads for fallback businesses
```

## Testing Checklist

- [ ] Customer can select 3-5 businesses
- [ ] Validation prevents <3 or >5 businesses
- [ ] Featured/Pro providers get leads first
- [ ] Contact details hidden until accepted
- [ ] Payment charges automatically on acceptance
- [ ] Contact details visible after payment succeeds
- [ ] 24-hour fallback assignment works (test with scheduled task)

## Scheduled Task Setup

To enable 24-hour fallback assignment, set up a cron job:

```bash
# Run every hour
0 * * * * curl -X POST http://localhost:5000/api/scheduled-tasks/assign-fallback-leads -H "X-API-Key: YOUR_API_KEY"
```

Or use a task scheduler like `node-cron` in the backend.

## Notes

- Payment method is required for automatic charging
- If payment requires 3D Secure, user completes it in modal
- Contact details are completely hidden (not masked) until accepted
- Fallback assignment happens via scheduled task, not real-time

# Next Phase Development Plan (Updated with Payment Integration)

## Current Status ✅

### Completed Features:
1. ✅ **Service Request Creation** - Multi-step wizard (Select Service → Sub-Service → Zip Code → Project Details → Booking Date)
2. ✅ **Automatic Lead Generation** - Leads created for matching providers when service request is submitted
3. ✅ **Provider Leads Dashboard** - Providers can view all leads assigned to them
4. ✅ **Accept/Reject Leads** - Providers can accept (with proposal) or reject leads
5. ✅ **Proposal Creation** - When provider accepts, a proposal is created with description and price
6. ✅ **Email Notifications** - Customers and providers receive email notifications
7. ✅ **Customer My Requests** - Customers can view their service requests with proposals and rejected leads

---

## Next Phase: Proposal Management & Work Orders (with Payment Integration)

### Phase 1: Customer Proposal Management with Stripe Payment (Priority: HIGH)

#### 1.1 Customer Accept Proposal with Payment
**Goal:** Allow customers to accept proposals and pay via Stripe before work starts

**Backend Setup:**
1. **Install Stripe SDK:**
   ```bash
   npm install stripe
   ```

2. **Environment Variables:**
   - `STRIPE_SECRET_KEY` - Stripe secret key
   - `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key (for frontend)
   - `STRIPE_WEBHOOK_SECRET` - For webhook verification

3. **Backend Endpoints:**
   - `POST /api/service-requests/my/service-requests/:id/proposals/:proposalId/create-payment-intent`
     - Create Stripe Payment Intent
     - Amount: proposal.price
     - Metadata: serviceRequestId, proposalId, customerId, providerId
     - Return: `clientSecret` for frontend

   - `POST /api/service-requests/my/service-requests/:id/proposals/:proposalId/accept`
     - Verify payment status (check Payment Intent)
     - Update proposal status to 'ACCEPTED'
     - Update service request status to 'IN_PROGRESS'
     - Set `primaryProviderId` on service request
     - Create WorkOrder record
     - Store payment information (Payment Intent ID)
     - Send email notifications (customer + provider)
     - Reject all other proposals for the same service request

   - `POST /api/webhooks/stripe` (Webhook endpoint)
     - Handle payment success/failure events
     - Update proposal/service request status accordingly

**Frontend:**
1. **Install Stripe.js:**
   ```bash
   npm install @stripe/stripe-js @stripe/react-stripe-js
   ```

2. **Accept Proposal Flow:**
   - Customer clicks "Accept Proposal" button
   - Show payment modal with Stripe Elements
   - Create payment intent (call backend)
   - Display Stripe payment form (card details)
   - Process payment
   - On success: Call accept endpoint
   - Show success message
   - Reload service request details

3. **UI Components:**
   - Payment modal component
   - Stripe Elements integration
   - Loading states during payment
   - Error handling
   - Success confirmation

**Database Updates:**
- Add to `proposals` table:
  - `stripePaymentIntentId` (VARCHAR) - Store Stripe Payment Intent ID
  - `paymentStatus` (ENUM: 'pending', 'succeeded', 'failed') - Payment status
  - `paidAt` (DATETIME) - When payment was completed

- Add to `service_requests` table (if not exists):
  - `paymentIntentId` (VARCHAR) - Reference to payment
  - `totalAmount` (DECIMAL) - Total amount paid

**Payment Flow:**
```
1. Customer clicks "Accept Proposal"
2. Frontend: Show payment modal
3. Backend: Create Payment Intent (amount = proposal.price)
4. Frontend: Display Stripe payment form
5. Customer enters card details
6. Stripe: Process payment
7. Backend: Verify payment success
8. Backend: Update proposal status to 'ACCEPTED'
9. Backend: Update service request status to 'IN_PROGRESS'
10. Backend: Create WorkOrder
11. Backend: Send email notifications
12. Frontend: Show success message
```

#### 1.2 Customer Reject Proposal
**Goal:** Allow customers to reject proposals (no payment required)

**Backend:**
- `PATCH /api/service-requests/my/service-requests/:id/proposals/:proposalId/reject`
  - Update proposal status to 'REJECTED'
  - Send email notification to provider
  - Keep service request status unchanged

**Frontend:**
- Add "Reject Proposal" button
- Confirmation modal
- No payment required

---

### Phase 2: Work Order Management (Priority: HIGH)

#### 2.1 Provider Work Orders Dashboard
**Goal:** Providers can view and manage their active work orders

**Backend:**
- `GET /api/provider/work-orders`
  - List all work orders for logged-in provider
  - Filter by status (IN_PROGRESS, COMPLETED)
  - Include service request details, customer info, payment status
  - Pagination support

**Frontend:**
- New page: `ProviderWorkOrders.jsx`
- Route: `/user-dashboard/work-orders`
- Display work orders in cards/table format
- Show: Service request details, customer info, status, dates, payment status
- Filter by status

#### 2.2 Provider Update Work Order Status
**Goal:** Providers can mark work as completed

**Backend:**
- `PATCH /api/provider/work-orders/:id/complete`
  - Update work order status to 'COMPLETED'
  - Set `completedAt` timestamp
  - Update service request status to 'COMPLETED'
  - Send email notification to customer
  - Log activity

**Frontend:**
- Add "Mark as Completed" button on work order cards
- Confirmation modal before completing
- Update UI after completion

---

### Phase 3: Work Completion & Review (Priority: MEDIUM)

#### 3.1 Customer Approve Completed Work
**Goal:** Customer can approve completed work and leave review

**Backend:**
- `PATCH /api/service-requests/my/service-requests/:id/approve`
  - Update service request status to 'APPROVED'
  - Update work order (if needed)
  - Send email notification to provider
  - Enable review functionality

- `POST /api/service-requests/my/service-requests/:id/review`
  - Create review record
  - Link to service request, provider, customer
  - Update provider rating
  - Update service request status to 'CLOSED'

**Frontend:**
- Add "Approve Work" button in My Requests detail modal
- Add review form modal (rating 1-5, comment)
- Show review status in request details

---

## Implementation Order (Updated)

### Sprint 1: Customer Proposal Actions with Payment (Priority: HIGH)
**Timeline: 3-4 days**

1. **Backend Setup:**
   - Install Stripe SDK
   - Add Stripe configuration
   - Create payment intent endpoint
   - Update accept proposal endpoint (verify payment)
   - Add webhook endpoint
   - Update database schema (add payment fields)

2. **Frontend Setup:**
   - Install Stripe.js
   - Create payment modal component
   - Integrate Stripe Elements
   - Update Accept Proposal flow
   - Add payment success/failure handling

3. **Testing:**
   - Test payment flow with Stripe test cards
   - Test payment success scenario
   - Test payment failure scenario
   - Test webhook events
   - Test email notifications

### Sprint 2: Work Order Management
**Timeline: 2-3 days**

1. Backend: Get work orders endpoint
2. Frontend: Provider Work Orders page
3. Backend: Complete work order endpoint
4. Frontend: Complete work order functionality
5. Email notifications
6. Testing

### Sprint 3: Work Completion & Reviews
**Timeline: 2-3 days**

1. Backend: Approve work endpoint
2. Backend: Create review endpoint
3. Frontend: Approve work functionality
4. Frontend: Review form
5. Email notifications
6. Testing

---

## Stripe Integration Details

### Payment Intent Creation
```javascript
// Backend: Create Payment Intent
const paymentIntent = await stripe.paymentIntents.create({
  amount: proposal.price * 100, // Convert to cents
  currency: 'usd',
  metadata: {
    serviceRequestId: serviceRequest.id,
    proposalId: proposal.id,
    customerId: customer.id,
    providerId: provider.id
  },
  description: `Payment for: ${serviceRequest.projectTitle}`
});
```

### Payment Verification
```javascript
// Backend: Verify payment before accepting proposal
const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
if (paymentIntent.status !== 'succeeded') {
  return res.status(400).json({ error: 'Payment not completed' });
}
```

### Webhook Events to Handle
- `payment_intent.succeeded` - Payment successful
- `payment_intent.payment_failed` - Payment failed
- `payment_intent.canceled` - Payment canceled

---

## Database Schema Updates

### Proposals Table:
```sql
ALTER TABLE proposals ADD COLUMN stripePaymentIntentId VARCHAR(255) NULL;
ALTER TABLE proposals ADD COLUMN paymentStatus ENUM('pending', 'succeeded', 'failed') DEFAULT 'pending';
ALTER TABLE proposals ADD COLUMN paidAt DATETIME NULL;
```

### Service Requests Table (if needed):
```sql
ALTER TABLE service_requests ADD COLUMN paymentIntentId VARCHAR(255) NULL;
ALTER TABLE service_requests ADD COLUMN totalAmount DECIMAL(10,2) NULL;
```

---

## API Endpoints to Create

### Customer Endpoints:
1. `POST /api/service-requests/my/service-requests/:id/proposals/:proposalId/create-payment-intent`
   - Create Stripe Payment Intent
   - Return clientSecret

2. `POST /api/service-requests/my/service-requests/:id/proposals/:proposalId/accept`
   - Verify payment
   - Accept proposal
   - Create work order
   - Update status to IN_PROGRESS

3. `PATCH /api/service-requests/my/service-requests/:id/proposals/:proposalId/reject`
   - Reject proposal (no payment)

4. `PATCH /api/service-requests/my/service-requests/:id/approve`
   - Approve completed work

5. `POST /api/service-requests/my/service-requests/:id/review`
   - Submit review

### Provider Endpoints:
1. `GET /api/provider/work-orders`
2. `GET /api/provider/work-orders/:id`
3. `PATCH /api/provider/work-orders/:id/complete`

### Webhook Endpoint:
1. `POST /api/webhooks/stripe`
   - Handle Stripe webhook events

---

## Service Request Status Flow (Updated)

```
REQUEST_CREATED 
  → LEAD_ASSIGNED (when leads created)
  → IN_PROGRESS (when proposal accepted + payment succeeded)
  → COMPLETED (when provider marks work done)
  → APPROVED (when customer approves)
  → CLOSED (when review submitted)
```

**Important:** Status only changes to IN_PROGRESS after successful payment!

---

## Payment Security Considerations

1. **Never store card details** - Use Stripe Elements
2. **Verify payment on server** - Always check payment status on backend
3. **Use webhooks** - Handle payment events asynchronously
4. **Store Payment Intent ID** - For reference and refunds
5. **Handle payment failures** - Graceful error handling
6. **Test mode** - Use Stripe test keys during development

---

## UI/UX Flow for Payment

### Customer Accept Proposal Flow:
1. Customer views proposal in "My Requests" detail modal
2. Clicks "Accept & Pay" button
3. Payment modal opens with:
   - Proposal summary (description, price)
   - Stripe payment form (card number, expiry, CVC)
   - "Pay $X.XX" button
4. Customer enters card details
5. Click "Pay" → Processing spinner
6. On success:
   - Show success message
   - Close modal
   - Update proposal status to "ACCEPTED"
   - Update service request status to "IN_PROGRESS"
   - Show work order created message
7. On failure:
   - Show error message
   - Allow retry

---

## Testing Checklist (Updated)

### Payment Integration:
- [ ] Payment Intent created successfully
- [ ] Stripe Elements form displays correctly
- [ ] Payment succeeds with test card
- [ ] Payment fails with declined card
- [ ] Payment verification works
- [ ] Work order created after successful payment
- [ ] Status updates to IN_PROGRESS after payment
- [ ] Email notifications sent after payment
- [ ] Webhook events handled correctly
- [ ] Payment Intent ID stored in database
- [ ] Other proposals rejected when one is accepted

### Customer Proposal Management:
- [ ] Customer can view proposals
- [ ] Customer can accept proposal (with payment)
- [ ] Customer can reject proposal (no payment)
- [ ] Service request status updates correctly
- [ ] Work order created on accept
- [ ] Email notifications sent
- [ ] Payment information stored

### Work Order Management:
- [ ] Provider can view work orders
- [ ] Provider can mark work as completed
- [ ] Service request status updates
- [ ] Email notifications sent
- [ ] Customer can see completed status

### Work Completion:
- [ ] Customer can approve work
- [ ] Customer can leave review
- [ ] Review creates rating
- [ ] Service request closes after review

---

## Environment Setup

### Backend (.env):
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Frontend (.env):
```env
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## Estimated Timeline (Updated)

- **Sprint 1 (Customer Proposal Actions with Payment):** 3-4 days
- **Sprint 2 (Work Order Management):** 2-3 days
- **Sprint 3 (Work Completion & Reviews):** 2-3 days

**Total:** ~1.5-2 weeks for core functionality with payment integration

---

## Next Steps

1. ✅ Review and approve this updated plan
2. **Set up Stripe account** (test mode)
3. **Get Stripe API keys**
4. **Start Sprint 1:** Customer Proposal Actions with Payment
5. Implement payment integration
6. Test thoroughly with Stripe test cards
7. Move to next sprint after payment is working

---

## Important Notes

- **Payment is required** before work can start (status changes to IN_PROGRESS)
- **Use Stripe test mode** during development
- **Handle payment failures gracefully** - don't create work order if payment fails
- **Store payment references** for refunds/disputes later
- **Webhook is important** for handling async payment events
- **Security:** Never expose secret keys in frontend
- **Testing:** Use Stripe test cards (4242 4242 4242 4242 for success)

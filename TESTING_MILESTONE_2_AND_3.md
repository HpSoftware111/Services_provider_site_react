# Testing Guide: Milestone 2 & 3

## Prerequisites
1. Backend server running on `http://localhost:5000`
2. Frontend server running on `http://localhost:3000`
3. Database connected and seeded with:
   - At least one customer user account
   - At least one provider user account with ProviderProfile
   - Service categories and subcategories
   - At least one business with matching category and zip code

---

## Milestone 2: Service Request Creation & Management

### Test 1: Create Service Request (POST /api/service-requests)

**Steps:**
1. Login as a customer user
2. Navigate to `/service-request` page
3. Complete the 5-step wizard:
   - Step 1: Select a service category
   - Step 2: Select a sub-service (optional)
   - Step 3: Enter zip code (e.g., "80201")
   - Step 4: Enter project title and description, upload images (optional)
   - Step 5: Select preferred date and time
4. Click "Submit Request"

**Expected Results:**
- ✅ Service request is created successfully
- ✅ Success message displayed: "Service request submitted successfully!"
- ✅ Redirected to `/user-dashboard` after 2 seconds
- ✅ Customer receives confirmation email with subject: "Request received — [Project Title]"
- ✅ Email contains request summary and link to dashboard

**Check Database:**
```sql
-- Verify service request was created
SELECT * FROM service_requests ORDER BY id DESC LIMIT 1;

-- Should show:
-- status = 'LEAD_ASSIGNED' (if provider was assigned) or 'REQUEST_CREATED'
-- All fields populated correctly
```

---

### Test 2: View My Requests List (GET /api/my/service-requests)

**Steps:**
1. Login as a customer user
2. Navigate to `/user-dashboard/requests`
3. View the requests list

**Expected Results:**
- ✅ List displays all service requests for the logged-in customer
- ✅ Shows: Project Title, Category, Sub-Category, Zip Code, Status, Created Date
- ✅ Status badges are displayed with correct colors
- ✅ Pagination works (if more than 10 requests)
- ✅ Filter by status dropdown works

**Test Filtering:**
- Select "Pending" filter → Should show only REQUEST_CREATED status
- Select "In Progress" filter → Should show only IN_PROGRESS status
- Select "All Requests" → Should show all requests

**Check API Response:**
```bash
# Using curl or Postman
GET http://localhost:5000/api/service-requests/my/service-requests?page=1&pageSize=10
Headers: Authorization: Bearer <customer_token>

# Expected response:
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": X,
    "pages": Y
  }
}
```

---

### Test 3: View Request Details (GET /api/my/service-requests/:id)

**Steps:**
1. On the My Requests page, click "View Details" on any request
2. Modal should open with full request details

**Expected Results:**
- ✅ Modal displays all request information:
  - Project title and description
  - Category and sub-category
  - Zip code
  - Preferred date and time
  - Attachments (if any)
  - Status badge
  - Timeline (created/updated dates)
- ✅ If status is COMPLETED: Shows "Approve Work" button
- ✅ If status is APPROVED/CLOSED: Shows review form or existing review
- ✅ If status is REQUEST_CREATED or LEAD_ASSIGNED: Shows "Cancel Request" button

**Check API Response:**
```bash
GET http://localhost:5000/api/service-requests/my/service-requests/1
Headers: Authorization: Bearer <customer_token>

# Should return full request details with all associations
```

---

### Test 4: Cancel Request (PATCH /api/my/service-requests/:id/cancel)

**Steps:**
1. Create a new service request (or use one with status REQUEST_CREATED or LEAD_ASSIGNED)
2. Open request details modal
3. Click "Cancel Request" button
4. Confirm cancellation

**Expected Results:**
- ✅ Confirmation dialog appears
- ✅ After confirmation, request status changes to CANCELLED_BY_CUSTOMER
- ✅ Modal closes
- ✅ Request list refreshes and shows updated status
- ✅ Cancel button no longer appears for this request

**Check Database:**
```sql
SELECT id, status FROM service_requests WHERE id = <request_id>;
-- Should show: status = 'CANCELLED_BY_CUSTOMER'
```

**Test Edge Cases:**
- Try to cancel a request with status IN_PROGRESS → Should fail with error message
- Try to cancel a request with status COMPLETED → Should fail with error message

---

### Test 5: Email Confirmation

**Steps:**
1. Create a new service request
2. Check the customer's email inbox

**Expected Results:**
- ✅ Email received within a few seconds
- ✅ Subject: "Request received — [Project Title]"
- ✅ Email contains:
  - Request summary
  - Category and sub-category
  - Zip code
  - Preferred date and time
  - Request ID
  - Link to "View My Requests" dashboard

**Check Email Content:**
- Subject line matches spec exactly
- All request details are correct
- Link works and points to `/user-dashboard/requests`

---

## Milestone 3: Provider Matching & Lead Assignment

### Test 1: Provider Matching Logic

**Prerequisites:**
- At least 2-3 businesses with ProviderProfiles in the same category and zip code
- Businesses should have different ratings/review counts for ranking

**Steps:**
1. Create a new service request with:
   - A category that matches existing businesses
   - A zip code that matches existing businesses
2. Submit the request

**Expected Results:**
- ✅ `assignProvidersForRequest` function is called
- ✅ 1 primary provider is selected (highest score)
- ✅ Up to 3 alternatives are selected (next highest scores)
- ✅ Service request status = 'LEAD_ASSIGNED' (if primary assigned)
- ✅ `primaryProviderId` is set on service request

**Check Database:**
```sql
-- Check service request
SELECT id, status, primaryProviderId FROM service_requests ORDER BY id DESC LIMIT 1;
-- Should show: status = 'LEAD_ASSIGNED', primaryProviderId is set

-- Check lead for primary provider
SELECT * FROM leads 
WHERE metadata LIKE '%"serviceRequestId":<request_id>%' 
ORDER BY id DESC LIMIT 1;
-- Should show: status = 'submitted', providerId matches primary provider

-- Check alternative provider selections
SELECT * FROM alternative_provider_selections 
WHERE serviceRequestId = <request_id>;
-- Should show up to 3 records with positions 1, 2, 3
```

---

### Test 2: Lead Creation

**Steps:**
1. Create a service request
2. Check database for Lead record

**Expected Results:**
- ✅ Lead record created for primary provider
- ✅ Lead status = 'submitted' (represents PENDING)
- ✅ Lead contains:
  - customerId, businessId, providerId
  - categoryId, serviceType
  - locationCity, locationState, locationPostalCode
  - description, customerName, customerEmail, customerPhone
  - metadata with serviceRequestId

**Check Database:**
```sql
SELECT 
    id, 
    customerId, 
    businessId, 
    providerId, 
    status, 
    categoryId,
    serviceType,
    locationPostalCode,
    metadata
FROM leads 
ORDER BY id DESC LIMIT 1;

-- Verify all fields are populated correctly
-- status should be 'submitted'
```

---

### Test 3: Alternative Provider Selection

**Steps:**
1. Create a service request in an area with multiple matching providers
2. Check database for AlternativeProviderSelection records

**Expected Results:**
- ✅ Up to 3 AlternativeProviderSelection records created
- ✅ Each has position 1, 2, or 3
- ✅ providerId references ProviderProfile.id
- ✅ serviceRequestId matches the created request

**Check Database:**
```sql
SELECT 
    id,
    serviceRequestId,
    providerId,
    position
FROM alternative_provider_selections
WHERE serviceRequestId = <request_id>
ORDER BY position;

-- Should show 1-3 records with positions 1, 2, 3
```

---

### Test 4: Primary Provider Email Notification

**Steps:**
1. Create a service request
2. Check the primary provider's email inbox

**Expected Results:**
- ✅ Email received by primary provider only
- ✅ Subject: "New lead: [Project Title]"
- ✅ Email contains:
  - Project title and description
  - Customer information
  - Service details (category, sub-category, location, date/time)
  - Link to dashboard: `/user-dashboard/leads`
- ✅ Email message indicates they are the "primary provider"

**Check Email:**
- Only primary provider receives email (not alternatives)
- Subject matches spec: "New lead: [Project Title]"
- Link works and points to provider leads dashboard

---

### Test 5: Provider Dashboard - View Leads

**Steps:**
1. Login as the primary provider (the one who received the lead)
2. Navigate to `/user-dashboard/leads`
3. View the leads list

**Expected Results:**
- ✅ Lead appears in the list
- ✅ Status shows as "PENDING"
- ✅ Lead details are visible:
  - Customer name (may be masked)
  - Service type
  - Location
  - Project description
- ✅ "Accept" and "Reject" buttons are visible

**Check API:**
```bash
GET http://localhost:5000/api/provider/leads?status=PENDING
Headers: Authorization: Bearer <provider_token>

# Should return the lead with status 'submitted' or 'routed'
# Frontend maps this to 'PENDING'
```

---

### Test 6: Provider Ranking Algorithm

**Test Scenario:**
Create multiple businesses with different ratings:
- Business A: rating 4.8, 50 reviews
- Business B: rating 4.5, 20 reviews
- Business C: rating 4.0, 5 reviews

**Steps:**
1. Create a service request matching all three businesses
2. Check which one is selected as primary

**Expected Results:**
- ✅ Business A should be selected as primary (highest score)
- ✅ Business B should be alternative position 1
- ✅ Business C should be alternative position 2

**Verify Ranking:**
- Check console logs for scores (if logged)
- Verify primaryProviderId matches Business A's provider
- Verify AlternativeProviderSelection positions

---

### Test 7: Admin Manual Reassignment (POST /api/admin/service-requests/:id/assign)

**Steps:**
1. Login as admin user
2. Create a service request (or use existing one with status REQUEST_CREATED or LEAD_ASSIGNED)
3. Call the admin reassign endpoint

**Using Postman/curl:**
```bash
POST http://localhost:5000/api/admin/service-requests/<request_id>/assign
Headers: 
  Authorization: Bearer <admin_token>
  Content-Type: application/json
```

**Expected Results:**
- ✅ Existing leads and alternatives are deleted
- ✅ New providers are assigned using matching logic
- ✅ New Lead created for new primary provider
- ✅ New AlternativeProviderSelection records created
- ✅ Service request status updated to LEAD_ASSIGNED
- ✅ Response includes primary and alternatives data

**Check Database:**
```sql
-- Old leads should be deleted
SELECT COUNT(*) FROM leads WHERE metadata LIKE '%"serviceRequestId":<id>%';
-- Should show only new leads

-- New alternatives should exist
SELECT * FROM alternative_provider_selections WHERE serviceRequestId = <id>;
-- Should show new alternative providers
```

**Test Edge Cases:**
- Try to reassign request with status IN_PROGRESS → Should fail with error
- Try to reassign request with status COMPLETED → Should fail with error

---

## Quick Test Checklist

### Milestone 2 Checklist:
- [ ] Create service request via UI
- [ ] Customer receives confirmation email
- [ ] View requests list in dashboard
- [ ] Filter requests by status
- [ ] View request details in modal
- [ ] Cancel request (if status allows)
- [ ] Pagination works correctly

### Milestone 3 Checklist:
- [ ] Provider matching selects 1 primary + up to 3 alternatives
- [ ] Lead record created with status 'submitted'
- [ ] AlternativeProviderSelection records created
- [ ] Service request status = 'LEAD_ASSIGNED'
- [ ] Primary provider receives email notification
- [ ] Lead visible in provider dashboard
- [ ] Admin can manually reassign providers

---

## Common Issues & Debugging

### Issue: No providers assigned
**Check:**
- Are there businesses with matching category and zip code?
- Do those businesses have active ProviderProfiles?
- Check console logs for `assignProvidersForRequest` errors

### Issue: Email not received
**Check:**
- Email service configuration (SMTP settings)
- Check backend logs for email errors
- Verify email addresses are correct

### Issue: Lead not visible in provider dashboard
**Check:**
- Lead status should be 'submitted' or 'routed'
- providerId in lead should match provider's User ID (not ProviderProfile ID)
- Provider must be logged in with correct account

### Issue: Ranking not working as expected
**Check:**
- Verify ProviderProfile has ratingAverage and ratingCount
- Verify Business has ratingAverage and ratingCount
- Check if zipCodesCovered, serviceCategories match
- Check console logs for calculated scores

---

## API Endpoints Summary

### Milestone 2:
- `POST /api/service-requests` - Create request
- `GET /api/my/service-requests` - List requests
- `GET /api/my/service-requests/:id` - Get request details
- `PATCH /api/my/service-requests/:id/cancel` - Cancel request

### Milestone 3:
- `assignProvidersForRequest(serviceRequestId)` - Matching function (called internally)
- `POST /api/admin/service-requests/:id/assign` - Manual reassignment

---

## Database Tables to Monitor

- `service_requests` - Main request records
- `leads` - Provider lead records
- `alternative_provider_selections` - Alternative provider records
- `provider_profiles` - Provider information
- `businesses` - Business information for matching


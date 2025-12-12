# Provider Service Requests Guide

## How to View Service Requests from Customer (Business Owner Side)

### Option 1: Using the Leads Page (Current Implementation)

The leads page (`/user-dashboard/leads`) already shows service request information extracted from lead metadata:

1. **Navigate to Leads Page:**
   - Login as a provider/business owner
   - Go to `/user-dashboard/leads`
   - You'll see all leads with service request details

2. **What You'll See:**
   - Project title
   - Project description
   - Category and subcategory
   - Customer information (masked)
   - Preferred date and time
   - Status (PENDING, ACCEPTED, REJECTED)

### Option 2: Using the Service Requests API (New Endpoint)

A dedicated endpoint is now available for providers to view all service requests:

**Endpoint:** `GET /api/provider/service-requests`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Items per page (default: 10)
- `status` (optional): Filter by status (e.g., REQUEST_CREATED, LEAD_ASSIGNED, IN_PROGRESS, COMPLETED)

**Example Request:**
```bash
curl -X GET "http://localhost:5000/api/provider/service-requests?page=1&pageSize=10&status=REQUEST_CREATED" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "projectTitle": "Fix leaking sink",
      "projectDescription": "The kitchen sink is leaking...",
      "category": {
        "id": 2,
        "name": "Plumbing",
        "icon": "fa-wrench"
      },
      "subCategory": {
        "id": 5,
        "name": "Leak Repair"
      },
      "zipCode": "90001",
      "preferredDate": "2025-12-15",
      "preferredTime": "Morning (8am - 12pm)",
      "status": "REQUEST_CREATED",
      "attachments": [],
      "customer": {
        "id": 32,
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "555-1234"
      },
      "leadInfo": {
        "leadId": 1,
        "leadStatus": "routed"
      },
      "createdAt": "2025-12-10T08:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 5,
    "pages": 1
  }
}
```

### Option 3: Using the General Service Requests Endpoint

**Endpoint:** `GET /api/service-requests`

This endpoint automatically filters service requests based on user role:
- For providers: Shows service requests where they are the primary provider OR have a lead

**Example Request:**
```bash
curl -X GET "http://localhost:5000/api/service-requests?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

## Frontend Implementation

To add a "Service Requests" page for providers in the frontend:

1. **Create a new component:** `frontend/src/pages/ProviderServiceRequests.jsx`
2. **Add route in App.jsx:**
   ```jsx
   <Route path="service-requests" element={<ProviderServiceRequests />} />
   ```
3. **Add navigation link in UserDashboardLayout.jsx:**
   ```jsx
   <Link to="/user-dashboard/service-requests">Service Requests</Link>
   ```

## Current Status

✅ **Available Now:**
- Leads page shows service request info from metadata
- `/api/provider/service-requests` endpoint (NEW)
- `/api/service-requests` endpoint (updated to work with leads)

📝 **To Implement:**
- Frontend page for `/user-dashboard/service-requests` (optional)
- View detail modal/page for individual service requests

## Testing

1. **Create a service request as a customer**
2. **Login as provider/business owner**
3. **Check leads page:** `/user-dashboard/leads`
4. **Or test API directly:**
   ```bash
   # Get your JWT token
   curl -X GET "http://localhost:5000/api/provider/service-requests" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## Notes

- Service requests are linked to providers through the `leads` table
- The `serviceRequestId` is stored in the lead's `metadata` JSON field
- Providers can see service requests where:
  - They are the primary provider (`primaryProviderId`)
  - OR they have a lead for that service request


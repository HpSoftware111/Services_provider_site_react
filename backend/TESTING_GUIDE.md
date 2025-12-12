# Testing Guide: Leads Flow Verification

## Quick Test Script

Run the automated test script:
```bash
cd backend
node scripts/test-leads-flow.js
```

This script will:
- ✅ Verify database connections
- ✅ Check foreign key constraints
- ✅ Test provider leads query
- ✅ Show existing leads for a test provider

## Manual Testing Steps

### 1. Test Lead Creation (Backend)

#### Step 1: Create a Service Request
1. Login as a customer in the frontend
2. Navigate to Service Request page
3. Fill out the form:
   - Select a category
   - Select a subcategory
   - Enter a zip code
   - Select businesses (if available)
   - Enter project details
   - Select booking date
4. Submit the service request

#### Step 2: Verify Leads Created
```bash
cd backend
node -e "
const { sequelize, Lead } = require('./config/database');
require('dotenv').config();
(async () => {
  await sequelize.authenticate();
  const leads = await Lead.findAll({
    order: [['createdAt', 'DESC']],
    limit: 5
  });
  console.log('Recent leads:');
  leads.forEach(l => {
    console.log(\`ID: \${l.id}, providerId: \${l.providerId}, status: \${l.status}, categoryId: \${l.categoryId}\`);
  });
  await sequelize.close();
})();
"
```

**Expected Result:**
- Leads should be created with `providerId` = User ID (not ProviderProfile ID)
- `status` should be 'routed'
- `categoryId` should match the service request category
- `businessId` should match selected businesses

### 2. Test Provider Leads API

#### Step 1: Get Provider Token
1. Login as a provider user
2. Get the JWT token from browser localStorage or network tab

#### Step 2: Test API Endpoint
```bash
# Replace YOUR_TOKEN with actual JWT token
curl -X GET "http://localhost:5000/api/provider/leads?status=PENDING&page=1&pageSize=10" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "status": "PENDING",
      "serviceRequest": {
        "projectTitle": "...",
        "projectDescription": "...",
        "zipCode": "...",
        "category": { "id": 1, "name": "..." },
        "customer": { "name": "John D***", "email": "j***@example.com" }
      }
    }
  ],
  "pagination": { ... }
}
```

### 3. Test Frontend Provider Dashboard

1. Login as a provider user
2. Navigate to `/user-dashboard/leads`
3. Verify:
   - ✅ Leads list displays correctly
   - ✅ Lead cards show correct information
   - ✅ Accept/Reject buttons work
   - ✅ Status filters work

### 4. Database Verification Queries

#### Check Foreign Key Constraints
```sql
SELECT 
    CONSTRAINT_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'leads'
AND REFERENCED_TABLE_NAME IS NOT NULL;
```

**Expected:**
- `customerId` → `users.id`
- `businessId` → `businesses.id`
- `providerId` → `users.id` ✅ (NOT `provider_profiles.id`)

#### Check Lead Data Integrity
```sql
SELECT 
    l.id,
    l.providerId,
    l.customerId,
    l.businessId,
    l.status,
    u_provider.name as provider_name,
    u_customer.name as customer_name,
    b.name as business_name
FROM leads l
LEFT JOIN users u_provider ON l.providerId = u_provider.id
LEFT JOIN users u_customer ON l.customerId = u_customer.id
LEFT JOIN businesses b ON l.businessId = b.id
ORDER BY l.createdAt DESC
LIMIT 10;
```

**Expected:**
- `providerId` should match a User ID (not ProviderProfile ID)
- All foreign keys should have valid references
- No NULL values in required fields

### 5. Test Lead Creation Flow

#### Create a Test Lead Manually
```bash
cd backend
node -e "
const { sequelize, Lead, User, Business, Category, ProviderProfile } = require('./config/database');
require('dotenv').config();
(async () => {
  await sequelize.authenticate();
  
  // Find test data
  const customer = await User.findOne({ where: { role: 'CUSTOMER' } });
  const business = await Business.findOne({ where: { ownerId: { [require('sequelize').Op.ne]: null } }, include: [{ model: User, as: 'owner' }] });
  const category = await Category.findOne();
  
  if (!customer || !business || !category) {
    console.log('Missing test data');
    process.exit(1);
  }
  
  // Verify provider profile exists
  let providerProfile = await ProviderProfile.findOne({ where: { userId: business.ownerId } });
  if (!providerProfile) {
    providerProfile = await ProviderProfile.create({ userId: business.ownerId });
  }
  
  // Create lead with User ID (not ProviderProfile ID)
  const lead = await Lead.create({
    customerId: customer.id,
    businessId: business.id,
    providerId: business.ownerId, // User ID, not ProviderProfile ID
    serviceType: 'Test Service',
    categoryId: category.id,
    locationPostalCode: '12345',
    description: 'Test lead description',
    customerName: customer.name,
    customerEmail: customer.email,
    status: 'routed',
    routedAt: new Date()
  });
  
  console.log('✅ Lead created successfully!');
  console.log(\`Lead ID: \${lead.id}\`);
  console.log(\`Provider ID (User ID): \${lead.providerId}\`);
  console.log(\`ProviderProfile ID: \${providerProfile.id}\`);
  console.log('✅ providerId correctly uses User ID, not ProviderProfile ID');
  
  await sequelize.close();
})();
"
```

## Common Issues and Solutions

### Issue 1: Foreign Key Constraint Error
**Error:** `Cannot add or update a child row: a foreign key constraint fails`

**Solution:**
- Verify `providerId` is a valid User ID (not ProviderProfile ID)
- Check that the User exists in `users` table
- Verify foreign key constraint points to `users.id`

### Issue 2: No Leads Showing in Provider Dashboard
**Possible Causes:**
- ProviderProfile doesn't exist for the user
- `providerId` in leads table doesn't match `req.user.id`
- Status filter is too restrictive

**Solution:**
- Check if ProviderProfile exists: `SELECT * FROM provider_profiles WHERE userId = ?`
- Verify leads exist: `SELECT * FROM leads WHERE providerId = ?` (use User ID)
- Check API response in browser network tab

### Issue 3: Leads Created but Not Visible
**Check:**
1. Verify lead was created with correct `providerId` (User ID)
2. Check if ProviderProfile exists for that User ID
3. Verify the API query uses `req.user.id` (not `providerProfile.id`)

## Verification Checklist

- [ ] Database foreign keys are correct (`providerId` → `users.id`)
- [ ] Lead creation uses `business.owner.id` (User ID)
- [ ] Provider queries use `req.user.id` (User ID)
- [ ] Model associations use `User` instead of `ProviderProfile`
- [ ] Service request creation creates leads automatically
- [ ] Provider dashboard shows leads correctly
- [ ] Accept/Reject buttons work
- [ ] No foreign key constraint errors in logs

## Quick Verification Command

```bash
cd backend
node scripts/test-leads-flow.js
```

This will run all automated checks and show you the current state of the leads system.


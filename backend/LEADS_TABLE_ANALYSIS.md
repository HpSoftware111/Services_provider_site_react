# Leads Table Analysis and Fixes

## Issue Found

The database foreign key constraint for `leads.providerId` references `users.id`, but the code was using `providerProfile.id` (ProviderProfile ID). This caused a mismatch between the database schema and the application logic.

## Database Structure

### Foreign Keys on `leads` table:
- `customerId` → `users.id` ✅
- `businessId` → `businesses.id` ✅
- `providerId` → `users.id` ✅ (NOT `provider_profiles.id`)

## Problems Identified

1. **In `backend/routes/service-requests.js`**:
   - Was setting: `providerId: providerProfile.id` ❌
   - Should be: `providerId: business.owner.id` (User ID) ✅

2. **In `backend/routes/provider.js`**:
   - Was querying: `where: { providerId: providerProfile.id }` ❌
   - Should be: `where: { providerId: req.user.id }` (User ID) ✅

3. **In `backend/models/index.js`**:
   - Was: `Lead.belongsTo(ProviderProfile, { foreignKey: 'providerId' })` ❌
   - Should be: `Lead.belongsTo(User, { foreignKey: 'providerId' })` ✅

## Fixes Applied

### 1. Updated Lead Creation (`backend/routes/service-requests.js`)
```javascript
// Before:
providerId: providerProfile.id

// After:
providerId: business.owner.id // User ID, not ProviderProfile ID
```

### 2. Updated Lead Queries (`backend/routes/provider.js`)
```javascript
// Before:
where: { providerId: providerProfile.id }

// After:
where: { providerId: req.user.id } // User ID, not ProviderProfile ID
```

### 3. Updated Model Associations (`backend/models/index.js`)
```javascript
// Before:
ProviderProfile.hasMany(Lead, { foreignKey: 'providerId', as: 'leads' });
Lead.belongsTo(ProviderProfile, { foreignKey: 'providerId', as: 'provider' });

// After:
User.hasMany(Lead, { foreignKey: 'providerId', as: 'providerLeads' });
Lead.belongsTo(User, { foreignKey: 'providerId', as: 'provider' });
```

### 4. Updated Service Request Includes (`backend/routes/service-requests.js`)
```javascript
// Before:
{ model: Lead, as: 'leads', include: [{ model: ProviderProfile, as: 'provider', ... }] }

// After:
{ model: Lead, as: 'leads', include: [{ model: User, as: 'provider', ... }] }
```

## Correct Relationship Flow

1. **Customer creates ServiceRequest**
   - Customer selects category, subcategory, zip code, and businesses

2. **System finds matching Businesses**
   - By `categoryId` and `zipCode`
   - Also includes businesses from `selectedBusinessIds`

3. **For each Business:**
   - `Business.ownerId` → `User.id` (business owner)
   - Check if `ProviderProfile` exists where `userId = business.ownerId`
   - If exists, create `Lead` with:
     - `providerId` = `business.owner.id` (User ID) ✅
     - `businessId` = `business.id`
     - `customerId` = `customer.id` (User ID)
     - `categoryId` = `serviceRequest.categoryId`
     - Store `serviceRequestId` in `metadata` JSON field

4. **Provider queries leads:**
   - Find `ProviderProfile` where `userId = req.user.id`
   - Query `Leads` where `providerId = req.user.id` ✅
   - Include `Category`, `User` (customer), and `Business` associations

## Verification

All foreign key constraints now match the code logic:
- ✅ `leads.customerId` → `users.id` (Customer User ID)
- ✅ `leads.businessId` → `businesses.id` (Business ID)
- ✅ `leads.providerId` → `users.id` (Provider User ID, not ProviderProfile ID)

## Summary

The code now correctly uses **User IDs** for `providerId` in the `leads` table, matching the database foreign key constraint that references `users.id`. This ensures:
- Lead creation works without foreign key violations
- Provider queries return correct leads
- All relationships are consistent across the codebase


# Migration: Add metadata column to reviews table

## Problem
When submitting a review, you may see the error:
```
Unknown column 'metadata' in 'field list'
```

This happens because the `reviews` table is missing the `metadata` column.

## Solution

### Option 1: Run SQL Migration (Recommended)

1. Connect to your MySQL database
2. Run the SQL script:

```sql
ALTER TABLE reviews 
ADD COLUMN metadata TEXT NULL AFTER isReported;
```

Or use the provided SQL file:
```bash
mysql -u your_username -p your_database_name < backend/scripts/add-metadata-to-reviews.sql
```

### Option 2: Run Node.js Migration Script

```bash
node backend/scripts/add-metadata-to-reviews.js
```

**Note:** Make sure your database connection is configured correctly in `backend/config/database.js` before running this script.

## What the metadata column does

The `metadata` column stores JSON data that links reviews to service requests:
- `serviceRequestId`: The ID of the service request this review is for
- `providerId`: The user ID of the provider
- `providerProfileId`: The provider profile ID

This allows the system to:
- Check if a review already exists for a service request
- Link reviews back to the original service request
- Track which provider the review is for

## Temporary Workaround

The code has been updated to handle the missing column gracefully. Reviews can still be created without the metadata column, but:
- Duplicate review checking may not work perfectly
- Reviews won't be linked back to service requests in metadata

**However, it's strongly recommended to add the column for full functionality.**


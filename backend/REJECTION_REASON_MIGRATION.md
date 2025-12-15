# Rejection Reason Fields Migration

## Overview
This migration adds rejection reason fields to the following tables:
- `leads`
- `proposals`
- `service_requests`
- `work_orders`

## Fields Added
Each table will have:
- `rejectionReason` (ENUM: 'TOO_FAR', 'TOO_EXPENSIVE', 'NOT_RELEVANT', 'OTHER')
- `rejectionReasonOther` (TEXT) - for custom descriptions when "OTHER" is selected

## How to Run Migration

### Option 1: Using Node.js directly
```bash
cd backend
node scripts/add-rejection-reason-fields.js
```

### Option 2: Using npm script (if configured)
```bash
cd backend
npm run migrate:rejection-reasons
```

## What the Migration Does
1. Checks if columns already exist (safe to run multiple times)
2. Adds `rejectionReason` ENUM column to each table
3. Adds `rejectionReasonOther` TEXT column to each table
4. Logs progress for each table

## Important Notes
- The migration is **idempotent** - safe to run multiple times
- The code has been updated to handle missing columns gracefully
- After running the migration, all rejection reason features will work fully
- Before migration: Code works but rejection reasons won't be saved
- After migration: Full functionality with rejection reasons saved to database

## Verification
After running the migration, you should see:
```
✓ Added rejectionReason column to leads table
✓ Added rejectionReasonOther column to leads table
✓ Added rejectionReason column to proposals table
✓ Added rejectionReasonOther column to proposals table
✓ Added rejectionReason column to service_requests table
✓ Added rejectionReasonOther column to service_requests table
✓ Added rejectionReason column to work_orders table
✓ Added rejectionReasonOther column to work_orders table

✅ Migration completed successfully!
```


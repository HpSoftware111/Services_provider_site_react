# Database Migration Instructions - Payout Fields

## Problem
The code is trying to access payout columns (`providerPayoutAmount`, `platformFeeAmount`, `payoutStatus`, `payoutProcessedAt`, `stripeTransferId`) that don't exist in the `proposals` table yet.

## Solution
Run the SQL migration script to add these columns to your database.

## Option 1: Run SQL Script Directly (Recommended)

1. Open your MySQL client (phpMyAdmin, MySQL Workbench, or command line)
2. Select your database
3. Run the SQL script: `backend/scripts/add-payout-fields.sql`

Or via command line:
```bash
mysql -u your_username -p your_database_name < backend/scripts/add-payout-fields.sql
```

## Option 2: Run Node.js Migration Script

Make sure your database is running and connection is configured, then:

```bash
cd backend
node scripts/add-payout-fields-to-proposals.js
```

## What the Migration Does

Adds the following columns to the `proposals` table:

1. `providerPayoutAmount` - DECIMAL(10, 2) - Amount provider receives (90%)
2. `platformFeeAmount` - DECIMAL(10, 2) - Platform fee (10%)
3. `payoutStatus` - ENUM('pending', 'processing', 'completed', 'failed') - Payout status
4. `payoutProcessedAt` - DATETIME - When payout was processed
5. `stripeTransferId` - VARCHAR(255) - Stripe transfer ID (for future use)

## After Migration

Once the migration is complete:
- The error will be resolved
- Payout functionality will work correctly
- Provider payouts will be tracked and processed

## Temporary Workaround

The code has been updated to handle missing columns gracefully, but you should still run the migration for full functionality.


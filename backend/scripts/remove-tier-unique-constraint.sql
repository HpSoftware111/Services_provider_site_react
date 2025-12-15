-- SQL Script to Remove Unique Constraint on tier Column
-- This allows multiple plans with the same tier but different billing cycles (monthly/annual)
-- 
-- Usage: Run this in your MySQL client or via command line:
-- mysql -u your_username -p your_database < backend/scripts/remove-tier-unique-constraint.sql

-- Remove unique constraint/index on tier column
-- Try different possible index names

-- Option 1: If index is named 'tier'
ALTER TABLE subscription_plans DROP INDEX IF EXISTS tier;

-- Option 2: If index is named 'unique_tier'
ALTER TABLE subscription_plans DROP INDEX IF EXISTS unique_tier;

-- Option 3: If index is named 'subscription_plans_tier_unique'
ALTER TABLE subscription_plans DROP INDEX IF EXISTS subscription_plans_tier_unique;

-- Note: MySQL doesn't support IF EXISTS for DROP INDEX, so you may need to run these one by one
-- and ignore errors for indexes that don't exist.

-- Alternative: Find and remove all unique indexes on tier column
-- First, check what indexes exist:
-- SHOW INDEXES FROM subscription_plans WHERE Column_name = 'tier' AND Non_unique = 0;

-- Then drop the specific index name you find (replace 'index_name' with actual name):
-- ALTER TABLE subscription_plans DROP INDEX index_name;

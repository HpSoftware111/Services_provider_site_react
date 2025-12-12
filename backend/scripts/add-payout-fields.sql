-- Migration script to add payout fields to proposals table
-- Run this directly in your MySQL database

-- Check and add providerPayoutAmount column
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'proposals' 
    AND COLUMN_NAME = 'providerPayoutAmount'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE proposals ADD COLUMN providerPayoutAmount DECIMAL(10, 2) NULL AFTER price',
    'SELECT "Column providerPayoutAmount already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add platformFeeAmount column
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'proposals' 
    AND COLUMN_NAME = 'platformFeeAmount'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE proposals ADD COLUMN platformFeeAmount DECIMAL(10, 2) NULL AFTER providerPayoutAmount',
    'SELECT "Column platformFeeAmount already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add payoutStatus column
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'proposals' 
    AND COLUMN_NAME = 'payoutStatus'
);

SET @sql = IF(@col_exists = 0,
    "ALTER TABLE proposals ADD COLUMN payoutStatus ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending' AFTER paymentStatus",
    'SELECT "Column payoutStatus already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add payoutProcessedAt column
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'proposals' 
    AND COLUMN_NAME = 'payoutProcessedAt'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE proposals ADD COLUMN payoutProcessedAt DATETIME NULL AFTER paidAt',
    'SELECT "Column payoutProcessedAt already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add stripeTransferId column
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'proposals' 
    AND COLUMN_NAME = 'stripeTransferId'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE proposals ADD COLUMN stripeTransferId VARCHAR(255) NULL AFTER stripePaymentIntentId',
    'SELECT "Column stripeTransferId already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Migration completed successfully!' AS result;


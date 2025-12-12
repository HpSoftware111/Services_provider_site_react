require('dotenv').config();
const { sequelize } = require('../config/database');

async function createNotificationTables() {
    const queryInterface = sequelize.getQueryInterface();

    try {
        console.log('🌱 Creating notification tables...\n');

        // Test connection
        await sequelize.authenticate();
        console.log('✅ Database connected\n');

        // Create notification_audit table
        try {
            await queryInterface.describeTable('notification_audit');
            console.log('⚠️  notification_audit table already exists, skipping...\n');
        } catch (error) {
            await queryInterface.createTable('notification_audit', {
                id: {
                    type: sequelize.Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true
                },
                userId: {
                    type: sequelize.Sequelize.INTEGER,
                    allowNull: true
                },
                type: {
                    type: sequelize.Sequelize.STRING(100),
                    allowNull: false
                },
                recipientEmail: {
                    type: sequelize.Sequelize.STRING(255),
                    allowNull: false
                },
                subject: {
                    type: sequelize.Sequelize.STRING(500),
                    allowNull: true
                },
                status: {
                    type: sequelize.Sequelize.ENUM('pending', 'sent', 'failed', 'retrying'),
                    defaultValue: 'pending'
                },
                retryCount: {
                    type: sequelize.Sequelize.INTEGER,
                    defaultValue: 0
                },
                maxRetries: {
                    type: sequelize.Sequelize.INTEGER,
                    defaultValue: 3
                },
                errorMessage: {
                    type: sequelize.Sequelize.TEXT,
                    allowNull: true
                },
                metadata: {
                    type: sequelize.Sequelize.TEXT,
                    allowNull: true
                },
                sentAt: {
                    type: sequelize.Sequelize.DATE,
                    allowNull: true
                },
                provider: {
                    type: sequelize.Sequelize.STRING(50),
                    allowNull: true
                },
                createdAt: {
                    type: sequelize.Sequelize.DATE,
                    allowNull: false,
                    defaultValue: sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
                },
                updatedAt: {
                    type: sequelize.Sequelize.DATE,
                    allowNull: false,
                    defaultValue: sequelize.Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
                }
            });
            console.log('✅ Created notification_audit table');

            // Add indexes
            await queryInterface.addIndex('notification_audit', ['userId'], { name: 'idx_notification_audit_userId' });
            await queryInterface.addIndex('notification_audit', ['type'], { name: 'idx_notification_audit_type' });
            await queryInterface.addIndex('notification_audit', ['status'], { name: 'idx_notification_audit_status' });
            await queryInterface.addIndex('notification_audit', ['recipientEmail'], { name: 'idx_notification_audit_email' });
            console.log('✅ Added indexes to notification_audit table\n');
        }

        // Create notification_preferences table
        try {
            await queryInterface.describeTable('notification_preferences');
            console.log('⚠️  notification_preferences table already exists, skipping...\n');
        } catch (error) {
            await queryInterface.createTable('notification_preferences', {
                id: {
                    type: sequelize.Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true
                },
                userId: {
                    type: sequelize.Sequelize.INTEGER,
                    allowNull: false,
                    unique: true
                },
                emailEnabled: {
                    type: sequelize.Sequelize.BOOLEAN,
                    defaultValue: true
                },
                pushEnabled: {
                    type: sequelize.Sequelize.BOOLEAN,
                    defaultValue: false
                },
                smsEnabled: {
                    type: sequelize.Sequelize.BOOLEAN,
                    defaultValue: false
                },
                requestCreated: {
                    type: sequelize.Sequelize.BOOLEAN,
                    defaultValue: true
                },
                newLead: {
                    type: sequelize.Sequelize.BOOLEAN,
                    defaultValue: true
                },
                leadAccepted: {
                    type: sequelize.Sequelize.BOOLEAN,
                    defaultValue: true
                },
                leadPaymentFailed: {
                    type: sequelize.Sequelize.BOOLEAN,
                    defaultValue: true
                },
                leadMovedToAlternative: {
                    type: sequelize.Sequelize.BOOLEAN,
                    defaultValue: true
                },
                noProviderAvailable: {
                    type: sequelize.Sequelize.BOOLEAN,
                    defaultValue: true
                },
                newProposal: {
                    type: sequelize.Sequelize.BOOLEAN,
                    defaultValue: true
                },
                proposalAccepted: {
                    type: sequelize.Sequelize.BOOLEAN,
                    defaultValue: true
                },
                workCompleted: {
                    type: sequelize.Sequelize.BOOLEAN,
                    defaultValue: true
                },
                reviewRequest: {
                    type: sequelize.Sequelize.BOOLEAN,
                    defaultValue: true
                },
                reviewPosted: {
                    type: sequelize.Sequelize.BOOLEAN,
                    defaultValue: true
                },
                unsubscribeToken: {
                    type: sequelize.Sequelize.STRING(100),
                    allowNull: true,
                    unique: true
                },
                createdAt: {
                    type: sequelize.Sequelize.DATE,
                    allowNull: false,
                    defaultValue: sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
                },
                updatedAt: {
                    type: sequelize.Sequelize.DATE,
                    allowNull: false,
                    defaultValue: sequelize.Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
                }
            });
            console.log('✅ Created notification_preferences table');

            // Add indexes
            await queryInterface.addIndex('notification_preferences', ['userId'], { name: 'idx_notification_preferences_userId', unique: true });
            await queryInterface.addIndex('notification_preferences', ['unsubscribeToken'], { name: 'idx_notification_preferences_token' });
            console.log('✅ Added indexes to notification_preferences table\n');
        }

        console.log('✅ Migration completed successfully!\n');
        await sequelize.close();
    } catch (error) {
        console.error('❌ Migration failed:', error);
        await sequelize.close();
        process.exit(1);
    }
}

// Run migration
createNotificationTables();


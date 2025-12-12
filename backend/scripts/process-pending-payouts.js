/**
 * Script to retroactively process payouts for approved work
 * This will find all service requests with status 'APPROVED' that have
 * pending or null payout status and process them
 * 
 * Usage: node backend/scripts/process-pending-payouts.js
 */

require('dotenv').config();
const { sequelize } = require('../config/database');
const { Proposal, ServiceRequest } = require('../models');
const processProviderPayout = require('../utils/processProviderPayout');

async function processPendingPayouts() {
    try {
        console.log('🔄 Starting to process pending payouts for approved work...\n');

        await sequelize.authenticate();
        console.log('✅ Database connection established\n');

        // Find all approved service requests with succeeded payments
        const approvedRequests = await ServiceRequest.findAll({
            where: {
                status: 'APPROVED'
            },
            include: [{
                model: Proposal,
                as: 'proposals',
                where: {
                    status: 'ACCEPTED',
                    paymentStatus: 'succeeded'
                },
                required: true
            }]
        });

        console.log(`Found ${approvedRequests.length} approved service requests with accepted proposals\n`);

        let processedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const serviceRequest of approvedRequests) {
            const proposals = serviceRequest.proposals || [];

            for (const proposal of proposals) {
                const payoutStatus = proposal.payoutStatus;

                // Only process if payout is pending, null, or undefined
                if (!payoutStatus || payoutStatus === 'pending') {
                    try {
                        console.log(`Processing payout for proposal ${proposal.id} (Service Request: ${serviceRequest.id})...`);
                        await processProviderPayout(proposal, serviceRequest);
                        processedCount++;
                        console.log(`✅ Processed payout for proposal ${proposal.id}\n`);
                    } catch (error) {
                        errorCount++;
                        console.error(`❌ Error processing payout for proposal ${proposal.id}:`, error.message);
                        console.error(error.stack);
                        console.log('');
                    }
                } else {
                    skippedCount++;
                    console.log(`⏭️  Skipping proposal ${proposal.id} (status: ${payoutStatus})\n`);
                }
            }
        }

        console.log('\n📊 Summary:');
        console.log(`  ✅ Processed: ${processedCount}`);
        console.log(`  ⏭️  Skipped: ${skippedCount}`);
        console.log(`  ❌ Errors: ${errorCount}`);
        console.log(`  📦 Total: ${approvedRequests.length}`);

        console.log('\n✅ Processing completed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Script failed:', error);
        console.error('Error details:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
}

// Run script
processPendingPayouts();

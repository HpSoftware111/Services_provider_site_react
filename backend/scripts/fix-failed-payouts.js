/**
 * Script to fix failed payouts that should be completed
 * This will find all proposals with:
 * - paymentStatus = 'succeeded'
 * - payoutStatus = 'failed'
 * - And mark them as 'completed' if they meet the criteria
 * 
 * Usage: node backend/scripts/fix-failed-payouts.js
 */

require('dotenv').config();
const { sequelize } = require('../config/database');
const { Proposal, ServiceRequest } = require('../models');
const { calculatePayouts } = require('../config/platformFee');

async function fixFailedPayouts() {
    try {
        console.log('🔄 Starting to fix failed payouts...\n');

        await sequelize.authenticate();
        console.log('✅ Database connection established\n');

        // Find all proposals with payment succeeded but payout failed
        const failedPayouts = await Proposal.findAll({
            where: {
                paymentStatus: 'succeeded',
                payoutStatus: 'failed'
            },
            include: [{
                model: ServiceRequest,
                as: 'serviceRequest',
                attributes: ['id', 'status', 'projectTitle'],
                required: false
            }],
            raw: false
        });

        console.log(`Found ${failedPayouts.length} proposals with failed payouts\n`);

        let fixedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const proposal of failedPayouts) {
            try {
                const serviceRequest = proposal.serviceRequest;

                // Only fix if service request is APPROVED or CLOSED (work was approved)
                if (serviceRequest && (serviceRequest.status === 'APPROVED' || serviceRequest.status === 'CLOSED')) {
                    // Calculate payout amounts
                    const totalAmount = parseFloat(proposal.price) || 0;
                    const calculated = calculatePayouts(totalAmount);

                    console.log(`Fixing payout for proposal ${proposal.id} (Service Request: ${serviceRequest.id}, Status: ${serviceRequest.status})...`);

                    // Update proposal to completed with calculated amounts
                    await proposal.update({
                        payoutStatus: 'completed',
                        payoutProcessedAt: new Date(),
                        providerPayoutAmount: calculated.providerAmount,
                        platformFeeAmount: calculated.platformFee
                    });

                    fixedCount++;
                    console.log(`✅ Fixed payout for proposal ${proposal.id} (Provider: $${calculated.providerAmount.toFixed(2)})\n`);
                } else {
                    skippedCount++;
                    console.log(`⏭️  Skipping proposal ${proposal.id} (Service Request status: ${serviceRequest?.status || 'N/A'})\n`);
                }
            } catch (error) {
                errorCount++;
                console.error(`❌ Error fixing payout for proposal ${proposal.id}:`, error.message);
                console.error(error.stack);
                console.log('');
            }
        }

        console.log('\n📊 Summary:');
        console.log(`  ✅ Fixed: ${fixedCount}`);
        console.log(`  ⏭️  Skipped: ${skippedCount}`);
        console.log(`  ❌ Errors: ${errorCount}`);
        console.log(`  📦 Total: ${failedPayouts.length}`);

        console.log('\n✅ Fix completed!');
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
fixFailedPayouts();

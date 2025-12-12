/**
 * Script to process pending payouts for CLOSED service requests
 * This will find all proposals with:
 * - status = 'ACCEPTED'
 * - paymentStatus = 'succeeded'
 * - payoutStatus = 'pending' or null
 * - serviceRequest.status = 'CLOSED'
 * And process them to 'completed'
 * 
 * Usage: node backend/scripts/process-closed-payouts.js
 */

require('dotenv').config();
const { sequelize } = require('../config/database');
const { Proposal, ServiceRequest } = require('../models');
const processProviderPayout = require('../utils/processProviderPayout');

async function processClosedPayouts() {
    try {
        console.log('🔄 Starting to process pending payouts for CLOSED service requests...\n');

        await sequelize.authenticate();
        console.log('✅ Database connection established\n');

        // Find all proposals with pending payouts for closed service requests
        const pendingProposals = await Proposal.findAll({
            where: {
                status: 'ACCEPTED',
                paymentStatus: 'succeeded',
                [sequelize.Op.or]: [
                    { payoutStatus: null },
                    { payoutStatus: 'pending' }
                ]
            },
            include: [{
                model: ServiceRequest,
                as: 'serviceRequest',
                attributes: ['id', 'status', 'projectTitle'],
                where: {
                    status: 'CLOSED'
                },
                required: true
            }],
            raw: false
        });

        console.log(`Found ${pendingProposals.length} proposals with pending payouts for CLOSED service requests\n`);

        let processedCount = 0;
        let errorCount = 0;

        for (const proposal of pendingProposals) {
            try {
                const serviceRequest = proposal.serviceRequest;
                console.log(`Processing payout for proposal ${proposal.id} (Service Request: ${serviceRequest.id}, Status: ${serviceRequest.status})...`);

                await processProviderPayout(proposal, serviceRequest);
                processedCount++;
                console.log(`✅ Processed payout for proposal ${proposal.id}\n`);
            } catch (error) {
                errorCount++;
                console.error(`❌ Error processing payout for proposal ${proposal.id}:`, error.message);
                console.error(error.stack);
                console.log('');
            }
        }

        console.log('\n📊 Summary:');
        console.log(`  ✅ Processed: ${processedCount}`);
        console.log(`  ❌ Errors: ${errorCount}`);
        console.log(`  📦 Total: ${pendingProposals.length}`);

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
processClosedPayouts();

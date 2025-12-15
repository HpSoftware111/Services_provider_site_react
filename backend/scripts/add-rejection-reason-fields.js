const { sequelize } = require('../config/database');

async function migrate() {
  try {
    console.log('Running migration: Add rejectionReason and rejectionReasonOther columns to leads, proposals, service_requests, and work_orders tables...');

    const queryInterface = sequelize.getQueryInterface();
    const { DataTypes } = require('sequelize');

    // 1. Add columns to leads table
    console.log('\n1. Processing leads table...');
    const leadsTableDesc = await queryInterface.describeTable('leads');

    if (!leadsTableDesc.rejectionReason) {
      await queryInterface.addColumn('leads', 'rejectionReason', {
        type: DataTypes.ENUM('TOO_FAR', 'TOO_EXPENSIVE', 'NOT_RELEVANT', 'OTHER'),
        allowNull: true
      });
      console.log('✓ Added rejectionReason column to leads table');
    } else {
      console.log('✓ rejectionReason column already exists in leads table');
    }

    if (!leadsTableDesc.rejectionReasonOther) {
      await queryInterface.addColumn('leads', 'rejectionReasonOther', {
        type: DataTypes.TEXT,
        allowNull: true
      });
      console.log('✓ Added rejectionReasonOther column to leads table');
    } else {
      console.log('✓ rejectionReasonOther column already exists in leads table');
    }

    // 2. Add columns to proposals table
    console.log('\n2. Processing proposals table...');
    const proposalsTableDesc = await queryInterface.describeTable('proposals');

    if (!proposalsTableDesc.rejectionReason) {
      await queryInterface.addColumn('proposals', 'rejectionReason', {
        type: DataTypes.ENUM('TOO_FAR', 'TOO_EXPENSIVE', 'NOT_RELEVANT', 'OTHER'),
        allowNull: true
      });
      console.log('✓ Added rejectionReason column to proposals table');
    } else {
      console.log('✓ rejectionReason column already exists in proposals table');
    }

    if (!proposalsTableDesc.rejectionReasonOther) {
      await queryInterface.addColumn('proposals', 'rejectionReasonOther', {
        type: DataTypes.TEXT,
        allowNull: true
      });
      console.log('✓ Added rejectionReasonOther column to proposals table');
    } else {
      console.log('✓ rejectionReasonOther column already exists in proposals table');
    }

    // 3. Add columns to service_requests table
    console.log('\n3. Processing service_requests table...');
    const serviceRequestsTableDesc = await queryInterface.describeTable('service_requests');

    if (!serviceRequestsTableDesc.rejectionReason) {
      await queryInterface.addColumn('service_requests', 'rejectionReason', {
        type: DataTypes.ENUM('TOO_FAR', 'TOO_EXPENSIVE', 'NOT_RELEVANT', 'OTHER'),
        allowNull: true
      });
      console.log('✓ Added rejectionReason column to service_requests table');
    } else {
      console.log('✓ rejectionReason column already exists in service_requests table');
    }

    if (!serviceRequestsTableDesc.rejectionReasonOther) {
      await queryInterface.addColumn('service_requests', 'rejectionReasonOther', {
        type: DataTypes.TEXT,
        allowNull: true
      });
      console.log('✓ Added rejectionReasonOther column to service_requests table');
    } else {
      console.log('✓ rejectionReasonOther column already exists in service_requests table');
    }

    // 4. Add columns to work_orders table
    console.log('\n4. Processing work_orders table...');
    const workOrdersTableDesc = await queryInterface.describeTable('work_orders');

    if (!workOrdersTableDesc.rejectionReason) {
      await queryInterface.addColumn('work_orders', 'rejectionReason', {
        type: DataTypes.ENUM('TOO_FAR', 'TOO_EXPENSIVE', 'NOT_RELEVANT', 'OTHER'),
        allowNull: true
      });
      console.log('✓ Added rejectionReason column to work_orders table');
    } else {
      console.log('✓ rejectionReason column already exists in work_orders table');
    }

    if (!workOrdersTableDesc.rejectionReasonOther) {
      await queryInterface.addColumn('work_orders', 'rejectionReasonOther', {
        type: DataTypes.TEXT,
        allowNull: true
      });
      console.log('✓ Added rejectionReasonOther column to work_orders table');
    } else {
      console.log('✓ rejectionReasonOther column already exists in work_orders table');
    }

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();


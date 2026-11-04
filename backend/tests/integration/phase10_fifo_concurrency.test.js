import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../src/config/prisma.js';
import inventoryService from '../../src/services/inventory/inventory.service.js';
import solarPlantService from '../../src/services/solar/solarPlant.service.js';
import solarMaintenanceService from '../../src/services/solar/solarMaintenance.service.js';

test('PHASE 10: FINAL FIFO INVENTORY VERIFICATION & CONCURRENCY PROTECTION', async (t) => {
  let company;
  let technician;
  let plant;
  let testSkuPrefix = `SOL-TEST-${Date.now()}`;
  let actor;

  // 0. Database Safety Check: Active DB must strictly be crm_erp_test_db
  await t.test('0. Database Safety Check: Active DB must strictly be crm_erp_test_db', async () => {
    const [result] = await prisma.$queryRawUnsafe('SELECT DATABASE() as db');
    assert.equal(
      result.db,
      'crm_erp_test_db',
      `SAFETY VIOLATION: Expected test database crm_erp_test_db, but connected to ${result.db}`
    );
  });

  // Setup fixtures
  await t.test('Setup: Provision Tenant, Technician, Solar Plant and Test Product', async () => {
    const timestamp = Date.now();
    company = await prisma.clientAdmin.create({
      data: {
        name: `Solar FIFO Test Company ${timestamp}`,
        organizationName: `Shree Nath Solar ${timestamp}`,
        email: `fifo_test_${timestamp}@sne-solar.com`,
        passwordHash: 'hashed_password_for_tests',
        status: 'ACTIVE',
      },
    });

    technician = await prisma.companyEmployee.create({
      data: {
        companyId: company.id,
        name: 'Omkar Technician',
        email: `omkar_${timestamp}@sne-solar.com`,
        role: 'EMPLOYEE',
        status: 'ACTIVE',
      },
    });

    actor = {
      id: technician.id,
      name: technician.name,
      email: technician.email,
      role: 'TECHNICIAN',
    };

    plant = await solarPlantService.createPlant(
      company.id,
      {
        name: 'FIFO Test Solar Plant',
        code: `PLANT-FIFO-${timestamp}`,
        capacityDcKw: 100,
        capacityAcKw: 80,
        plantType: 'ROOFTOP',
        status: 'ACTIVE',
      },
      actor
    );
  });

  // Test 1: FIFO Ordering Verification (manufacturingDate, receivedDate, createdAt)
  await t.test('1. FIFO Order Verification: Batches consumed strictly by manufacturingDate ASC, receivedDate ASC, createdAt ASC', async () => {
    const sku = `${testSkuPrefix}-FIFO-ORDER`;
    const warehouse = 'Solar O&M Central';

    // Create product
    await prisma.product.create({
      data: {
        companyId: company.id,
        sku,
        name: 'Solar Inverter Fuse 15A',
        uom: 'PCS',
        category: 'SPARES',
        stock: 0,
      },
    });

    // Create Stock header
    const stock = await inventoryService.createStock(
      company.id,
      {
        sku,
        name: 'Solar Inverter Fuse 15A',
        warehouse,
        stock: 0,
        availableQty: 0,
        uom: 'PCS',
      },
      actor
    );

    // Create 3 batches with distinct manufacturingDate & receivedDate:
    // Batch 1: Older mfg (2024-01-01) -> MUST BE CONSUMED FIRST
    const batch1 = await prisma.inventoryBatch.create({
      data: {
        companyId: company.id,
        stockId: stock.id,
        sku,
        batchNo: `BATCH-OLD-${Date.now()}`,
        warehouse,
        manufacturingDate: new Date('2024-01-01'),
        receivedDate: new Date('2024-01-15'),
        initialQty: 10,
        availableQty: 10,
        unitCost: 150,
        status: 'ACTIVE',
        qualityStatus: 'ACCEPTED',
      },
    });

    // Batch 2: Newer mfg (2024-06-01), earlier receivedDate -> MUST BE CONSUMED SECOND
    const batch2 = await prisma.inventoryBatch.create({
      data: {
        companyId: company.id,
        stockId: stock.id,
        sku,
        batchNo: `BATCH-MID-${Date.now()}`,
        warehouse,
        manufacturingDate: new Date('2024-06-01'),
        receivedDate: new Date('2024-06-10'),
        initialQty: 10,
        availableQty: 10,
        unitCost: 160,
        status: 'ACTIVE',
        qualityStatus: 'ACCEPTED',
      },
    });

    // Batch 3: Newer mfg (2024-06-01), later receivedDate -> MUST BE CONSUMED LAST
    const batch3 = await prisma.inventoryBatch.create({
      data: {
        companyId: company.id,
        stockId: stock.id,
        sku,
        batchNo: `BATCH-NEW-${Date.now()}`,
        warehouse,
        manufacturingDate: new Date('2024-06-01'),
        receivedDate: new Date('2024-06-25'),
        initialQty: 10,
        availableQty: 10,
        unitCost: 170,
        status: 'ACTIVE',
        qualityStatus: 'ACCEPTED',
      },
    });

    // Update Stock totals
    await prisma.inventoryStock.update({
      where: { id: stock.id },
      data: { stock: 30, availableQty: 30 },
    });

    // Request consumption of 15 units (should exhaust batch1 [10 units] and take 5 units from batch2)
    const issueResult = await inventoryService.consumeStockFIFO(
      company.id,
      {
        sku,
        quantity: 15,
        warehouse,
        referenceType: 'FIFO_VERIFICATION_TEST',
        referenceNo: 'TEST-FIFO-001',
      },
      actor
    );

    assert.equal(issueResult.consumedQty, 15);
    assert.equal(issueResult.allocations.length, 2, 'Expected 2 batch allocations');

    // First allocation must be Batch 1 (oldest manufacturing date)
    assert.equal(issueResult.allocations[0].batchId, batch1.id);
    assert.equal(issueResult.allocations[0].quantity, 10);

    // Second allocation must be Batch 2 (next oldest manufacturing/received date)
    assert.equal(issueResult.allocations[1].batchId, batch2.id);
    assert.equal(issueResult.allocations[1].quantity, 5);

    // Verify database batch balances
    const updatedB1 = await prisma.inventoryBatch.findUnique({ where: { id: batch1.id } });
    const updatedB2 = await prisma.inventoryBatch.findUnique({ where: { id: batch2.id } });
    const updatedB3 = await prisma.inventoryBatch.findUnique({ where: { id: batch3.id } });
    const updatedStock = await prisma.inventoryStock.findUnique({ where: { id: stock.id } });

    assert.equal(updatedB1.availableQty, 0, 'Batch 1 availableQty must be 0');
    assert.equal(updatedB2.availableQty, 5, 'Batch 2 availableQty must be 5');
    assert.equal(updatedB3.availableQty, 10, 'Batch 3 availableQty must remain 10');
    assert.equal(updatedStock.stock, 15, 'Stock balance must be 15');
    assert.equal(updatedStock.availableQty, 15, 'AvailableQty must be 15');
  });

  // Test 2: Solar Maintenance Spares Issue via Phase 4 FIFO Engine
  await t.test('2. Solar Maintenance Spares Issue: Integrates seamlessly with Phase 4 FIFO engine', async () => {
    const sku = `${testSkuPrefix}-SOLAR-SPARES`;
    const warehouse = 'Solar O&M Central';

    await prisma.product.create({
      data: {
        companyId: company.id,
        sku,
        name: 'MC4 Solar Connector Pair',
        uom: 'SET',
        category: 'SPARES',
        stock: 0,
      },
    });

    const stock = await inventoryService.createStock(
      company.id,
      {
        sku,
        name: 'MC4 Solar Connector Pair',
        warehouse,
        stock: 0,
        availableQty: 0,
        uom: 'SET',
      },
      actor
    );

    const batch = await prisma.inventoryBatch.create({
      data: {
        companyId: company.id,
        stockId: stock.id,
        sku,
        batchNo: `BATCH-MC4-${Date.now()}`,
        warehouse,
        manufacturingDate: new Date('2024-03-01'),
        receivedDate: new Date('2024-03-15'),
        initialQty: 25,
        availableQty: 25,
        unitCost: 85,
        status: 'ACTIVE',
        qualityStatus: 'ACCEPTED',
      },
    });

    await prisma.inventoryStock.update({
      where: { id: stock.id },
      data: { stock: 25, availableQty: 25 },
    });

    // Create Solar Maintenance Ticket
    const ticket = await solarMaintenanceService.createTicket(
      company.id,
      {
        plantId: plant.id,
        category: 'CORRECTIVE',
        subject: 'Replace damaged MC4 connectors on Array A3',
        description: 'Connectors degraded due to exposure, need replacement',
        priority: 'MEDIUM',
      },
      actor
    );

    // Issue 10 sets of MC4 connectors
    const issueResult = await solarMaintenanceService.issueSparesAgainstTicket(
      company.id,
      ticket.id,
      {
        sku,
        quantity: 10,
        warehouse,
      },
      actor
    );

    assert.equal(issueResult.success, true);
    assert.equal(issueResult.issuedQuantity, 10);
    assert.equal(issueResult.totalCost, 850); // 10 * 85
    assert.equal(issueResult.allocations.length, 1);
    assert.match(issueResult.allocations[0].movementNo, /^MOV-SOL-/);

    // Check updated ticket details
    const updatedTicket = await solarMaintenanceService.getTicketById(company.id, ticket.id);
    assert.equal(updatedTicket.sparePartsDetails.length, 1);
    assert.equal(updatedTicket.sparePartsDetails[0].sku, sku);
    assert.equal(updatedTicket.sparePartsDetails[0].quantity, 10);
    assert.equal(updatedTicket.sparePartsDetails[0].totalCost, 850);

    // Verify stock and batch after issue
    const postStock = await prisma.inventoryStock.findUnique({ where: { id: stock.id } });
    const postBatch = await prisma.inventoryBatch.findUnique({ where: { id: batch.id } });
    assert.equal(postStock.stock, 15);
    assert.equal(postStock.availableQty, 15);
    assert.equal(postBatch.availableQty, 15);
  });

  // Test 3: Concurrent Stock Issue Test (Race Condition & Over-Consumption Protection)
  await t.test('3. Concurrent Stock Issue Test: Two simultaneous requests against same stock cannot cause negative stock or duplicate movements', async () => {
    const sku = `${testSkuPrefix}-CONCURRENCY`;
    const warehouse = 'Solar O&M Central';
    const totalInitialQty = 10;

    await prisma.product.create({
      data: {
        companyId: company.id,
        sku,
        name: 'High Voltage SPD Type II',
        uom: 'PCS',
        category: 'SPARES',
        stock: 0,
      },
    });

    const stock = await inventoryService.createStock(
      company.id,
      {
        sku,
        name: 'High Voltage SPD Type II',
        warehouse,
        stock: totalInitialQty,
        availableQty: totalInitialQty,
        uom: 'PCS',
      },
      actor
    );

    const batch = await prisma.inventoryBatch.create({
      data: {
        companyId: company.id,
        stockId: stock.id,
        sku,
        batchNo: `BATCH-SPD-${Date.now()}`,
        warehouse,
        manufacturingDate: new Date('2024-02-01'),
        receivedDate: new Date('2024-02-15'),
        initialQty: totalInitialQty,
        availableQty: totalInitialQty,
        unitCost: 1200,
        status: 'ACTIVE',
        qualityStatus: 'ACCEPTED',
      },
    });

    // Create two separate maintenance tickets
    const ticketA = await solarMaintenanceService.createTicket(
      company.id,
      {
        plantId: plant.id,
        category: 'CORRECTIVE',
        subject: 'Ticket A - Replace SPD Inverter 1',
        description: 'SPD module blown on surge event',
        priority: 'HIGH',
      },
      actor
    );

    const ticketB = await solarMaintenanceService.createTicket(
      company.id,
      {
        plantId: plant.id,
        category: 'CORRECTIVE',
        subject: 'Ticket B - Replace SPD Inverter 2',
        description: 'SPD module degraded on Inverter 2',
        priority: 'HIGH',
      },
      actor
    );

    // Launch TWO concurrent issue requests simultaneously:
    // Request 1 requests 8 units (of 10 total)
    // Request 2 requests 8 units (of 10 total)
    // Both together demand 16 units, but ONLY 10 units are available.
    // With row locking (FOR UPDATE) and conditional decrement:
    // Exactly ONE request must succeed, and the second MUST fail with 409 Insufficient stock.
    const [res1, res2] = await Promise.allSettled([
      solarMaintenanceService.issueSparesAgainstTicket(company.id, ticketA.id, { sku, quantity: 8, warehouse }, actor),
      solarMaintenanceService.issueSparesAgainstTicket(company.id, ticketB.id, { sku, quantity: 8, warehouse }, actor),
    ]);

    const successes = [res1, res2].filter((r) => r.status === 'fulfilled');
    const failures = [res1, res2].filter((r) => r.status === 'rejected');

    assert.equal(successes.length, 1, 'Exactly one concurrent request must succeed');
    assert.equal(failures.length, 1, 'The competing concurrent request must fail');

    // Verify rejection reason
    const failureReason = failures[0].reason;
    assert.equal(failureReason.statusCode, 409);
    assert.match(failureReason.message, /Insufficient eligible available stock|Insufficient available stock/);

    // CRITICAL INTEGRITY VERIFICATIONS:
    // 1. Stock never becomes negative
    const finalStock = await prisma.inventoryStock.findUnique({ where: { id: stock.id } });
    assert.equal(finalStock.stock, 2, 'Stock must be exactly 10 - 8 = 2 (NEVER negative)');
    assert.equal(finalStock.availableQty, 2, 'AvailableQty must be exactly 2 (NEVER negative)');

    // 2. Batch quantity never becomes negative
    const finalBatch = await prisma.inventoryBatch.findUnique({ where: { id: batch.id } });
    assert.equal(finalBatch.availableQty, 2, 'Batch availableQty must be exactly 2 (NEVER negative)');

    // 3. No duplicate inventory movements created
    const movements = await prisma.inventoryMovement.findMany({
      where: { companyId: company.id, sku, movementType: 'CONSUMPTION' },
    });
    assert.equal(movements.length, 1, 'Exactly one CONSUMPTION movement record must exist for the single successful issue');
    assert.equal(movements[0].quantity, 8);
    assert.equal(movements[0].balanceAfter, 2);

    // 4. Failed ticket was not modified (rollback check)
    const failedTicketId = successes[0].value.ticketNo === ticketA.ticketNo ? ticketB.id : ticketA.id;
    const failedTicket = await solarMaintenanceService.getTicketById(company.id, failedTicketId);
    assert.equal(
      Array.isArray(failedTicket.sparePartsDetails) && failedTicket.sparePartsDetails.length === 0,
      true,
      'Failed ticket sparePartsDetails must remain empty (clean rollback)'
    );
  });

  // Test 4: Concurrent Multi-Batch Split Issue Protection
  await t.test('4. Multi-Batch Concurrent Split: Two concurrent requests splitting across multiple batches maintain strict consistency', async () => {
    const sku = `${testSkuPrefix}-CONCURR-MULTI`;
    const warehouse = 'Solar O&M Central';

    await prisma.product.create({
      data: {
        companyId: company.id,
        sku,
        name: 'String Diode 1000V',
        uom: 'PCS',
        category: 'SPARES',
        stock: 0,
      },
    });

    const stock = await inventoryService.createStock(
      company.id,
      {
        sku,
        name: 'String Diode 1000V',
        warehouse,
        stock: 10,
        availableQty: 10,
        uom: 'PCS',
      },
      actor
    );

    // Batch A has 5 units
    const batchA = await prisma.inventoryBatch.create({
      data: {
        companyId: company.id,
        stockId: stock.id,
        sku,
        batchNo: `BATCH-DA-${Date.now()}`,
        warehouse,
        manufacturingDate: new Date('2024-01-01'),
        receivedDate: new Date('2024-01-10'),
        initialQty: 5,
        availableQty: 5,
        unitCost: 50,
        status: 'ACTIVE',
        qualityStatus: 'ACCEPTED',
      },
    });

    // Batch B has 5 units
    const batchB = await prisma.inventoryBatch.create({
      data: {
        companyId: company.id,
        stockId: stock.id,
        sku,
        batchNo: `BATCH-DB-${Date.now()}`,
        warehouse,
        manufacturingDate: new Date('2024-02-01'),
        receivedDate: new Date('2024-02-10'),
        initialQty: 5,
        availableQty: 5,
        unitCost: 55,
        status: 'ACTIVE',
        qualityStatus: 'ACCEPTED',
      },
    });

    const ticketX = await solarMaintenanceService.createTicket(
      company.id,
      { plantId: plant.id, category: 'CORRECTIVE', subject: 'Ticket X - Inverter A Diodes', description: 'Diode failure' },
      actor
    );
    const ticketY = await solarMaintenanceService.createTicket(
      company.id,
      { plantId: plant.id, category: 'CORRECTIVE', subject: 'Ticket Y - Inverter B Diodes', description: 'Diode failure' },
      actor
    );

    // Both tickets request 6 units concurrently (each requires all 5 from Batch A + 1 from Batch B)
    const [resX, resY] = await Promise.allSettled([
      solarMaintenanceService.issueSparesAgainstTicket(company.id, ticketX.id, { sku, quantity: 6, warehouse }, actor),
      solarMaintenanceService.issueSparesAgainstTicket(company.id, ticketY.id, { sku, quantity: 6, warehouse }, actor),
    ]);

    const successes = [resX, resY].filter((r) => r.status === 'fulfilled');
    const failures = [resX, resY].filter((r) => r.status === 'rejected');

    assert.equal(successes.length, 1, 'Exactly one concurrent request can consume across split batches');
    assert.equal(failures.length, 1, 'The competing concurrent request must fail with 409');

    // Verify final state
    const endBatchA = await prisma.inventoryBatch.findUnique({ where: { id: batchA.id } });
    const endBatchB = await prisma.inventoryBatch.findUnique({ where: { id: batchB.id } });
    const endStock = await prisma.inventoryStock.findUnique({ where: { id: stock.id } });

    assert.equal(endBatchA.availableQty, 0, 'Batch A must be fully exhausted (0)');
    assert.equal(endBatchB.availableQty, 4, 'Batch B must have 4 remaining (5 - 1)');
    assert.equal(endStock.stock, 4, 'Total stock balance must be 4');
    assert.equal(endStock.availableQty, 4, 'Available stock must be 4');
  });

  // Cleanup
  await t.test('Cleanup: Safe teardown of test records', async () => {
    if (company?.id) {
      // Delete in cascade order
      await prisma.solarMaintenanceTicket.deleteMany({ where: { companyId: company.id } });
      await prisma.inventoryMovement.deleteMany({ where: { companyId: company.id } });
      await prisma.inventoryBatch.deleteMany({ where: { companyId: company.id } });
      await prisma.inventoryStock.deleteMany({ where: { companyId: company.id } });
      await prisma.product.deleteMany({ where: { companyId: company.id } });
      await prisma.solarPlant.deleteMany({ where: { companyId: company.id } });
      await prisma.companyEmployee.deleteMany({ where: { companyId: company.id } });
      await prisma.clientAdmin.deleteMany({ where: { id: company.id } });
    }
  });
});

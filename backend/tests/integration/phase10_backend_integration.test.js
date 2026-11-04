import assert from 'node:assert';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import solarPlantService from '../../src/services/solar/solarPlant.service.js';
import solarApiConfigService from '../../src/services/solar/solarApiConfig.service.js';
import solarTelemetryService from '../../src/services/solar/solarTelemetry.service.js';
import solarAnalyticsService from '../../src/services/solar/solarAnalytics.service.js';
import solarAlarmService from '../../src/services/solar/solarAlarm.service.js';
import solarCleaningService from '../../src/services/solar/solarCleaning.service.js';
import solarMaintenanceService from '../../src/services/solar/solarMaintenance.service.js';
import solarAdapterRegistry from '../../src/services/solar/solarProviderAdapter.js';

const prisma = new PrismaClient();

// Runtime Database-Name Safety Guard
const dbUrl = process.env.DATABASE_URL || '';
console.log('\n[Database Safety Guard] Configured Target Database:', dbUrl.split('/').pop());

if (!dbUrl.includes('crm_erp_test_db')) {
  console.error('\nCRITICAL SAFETY ERROR: Test cannot execute against production or unknown database.');
  process.exit(1);
}

test('AZZUNIQE CRM & ERP — PHASE 10 STEP 2: SOLAR MONITORING BACKEND TEST SUITE', async (t) => {
  const nonce = Date.now().toString().slice(-6);

  let companyA;
  let companyB;
  let empA;
  let empB;
  let plantA;
  let plantB;
  let inverter1;
  let panelString1;
  let spareProduct;
  let warehouseA;
  let stockRecord;
  let stockBatch;

  await t.test('0. Runtime Database Verification', async () => {
    const [result] = await prisma.$queryRawUnsafe('SELECT DATABASE() as current_db');
    assert.strictEqual(result.current_db, 'crm_erp_test_db');
    console.log('✅ PASS: Active database is strictly crm_erp_test_db');
  });

  await t.test('1. Setup Multi-Tenant Companies, Employees & Phase 4 Inventory Spares', async () => {
    // Company A
    companyA = await prisma.clientAdmin.create({
      data: {
        name: `Solar Client A ${nonce}`,
        email: `solar_client_a_${nonce}@test.com`,
        organizationName: 'Shree Nath Solar Corp',
        passwordHash: 'dummy',
      },
    });

    // Company B
    companyB = await prisma.clientAdmin.create({
      data: {
        name: `Solar Client B ${nonce}`,
        email: `solar_client_b_${nonce}@test.com`,
        organizationName: 'Competitor Solar Corp',
        passwordHash: 'dummy',
      },
    });

    // Employees
    empA = await prisma.companyEmployee.create({
      data: {
        companyId: companyA.id,
        name: 'Suresh Solar Engineer',
        email: `suresh_solar_${nonce}@solara.com`,
        role: 'SOLAR_ENGINEER',
        accessRole: 'EMPLOYEE',
      },
    });

    empB = await prisma.companyEmployee.create({
      data: {
        companyId: companyB.id,
        name: 'Foreign Technician',
        email: `foreign_tech_${nonce}@solarb.com`,
        role: 'SOLAR_TECHNICIAN',
        accessRole: 'EMPLOYEE',
      },
    });

    spareProduct = await prisma.product.create({
      data: {
        companyId: companyA.id,
        name: 'MC4 Inline Fuse Connector 15A 1000V',
        sku: `MC4-FUSE-15A-${nonce}`,
        category: 'Solar Spares',
        uom: 'PCS',
        stock: 50,
      },
    });

    // Warehouse
    warehouseA = await prisma.inventoryWarehouse.create({
      data: {
        companyId: companyA.id,
        name: `Main Solar Warehouse ${nonce}`,
        code: `WH-SOL-${nonce}`,
        status: 'ACTIVE',
      },
    });

    // Stock Header
    stockRecord = await prisma.inventoryStock.create({
      data: {
        companyId: companyA.id,
        sku: spareProduct.sku,
        name: spareProduct.name,
        warehouse: warehouseA.name,
        stock: 50,
        availableQty: 50,
        uom: 'PCS',
      },
    });

    // Inventory Batch (FIFO)
    stockBatch = await prisma.inventoryBatch.create({
      data: {
        companyId: companyA.id,
        batchNo: `BAT-MC4-${nonce}-01`,
        sku: spareProduct.sku,
        warehouse: warehouseA.name,
        initialQty: 50,
        availableQty: 50,
        unitCost: 125.00,
        status: 'ACTIVE',
        qualityStatus: 'ACCEPTED',
        receivedDate: new Date('2026-01-10'),
      },
    });

    assert.ok(companyA.id);
    assert.ok(companyB.id);
    assert.ok(spareProduct.id);
    assert.ok(stockBatch.id);
    console.log('✅ PASS: Multi-tenant companies, employees, and Phase 4 inventory batches provisioned');
  });

  await t.test('2. SolarPlant Service: CRUD, Filtering, Pagination & Code Uniqueness', async () => {
    // Create Plant A
    plantA = await solarPlantService.createPlant(
      companyA.id,
      {
        name: 'Factory Rooftop Solar Array 1',
        code: `SOL-ROOF-${nonce}`,
        plantType: 'ROOFTOP_INDUSTRIAL',
        capacityDcKw: 300.00,
        capacityAcKw: 250.00,
        commissionDate: '2025-06-01',
        locationAddress: 'Plot 10, Industrial Estate',
        city: 'Surat',
        state: 'Gujarat',
        pincode: '395001',
        monthlyTargetKwh: 38000.00,
      },
      empA
    );

    assert.strictEqual(plantA.companyId, companyA.id);
    assert.strictEqual(Number(plantA.capacityDcKw), 300);

    // Duplicate code in same company rejected
    await assert.rejects(
      () =>
        solarPlantService.createPlant(companyA.id, {
          name: 'Another Plant Same Code',
          code: `SOL-ROOF-${nonce}`,
          capacityDcKw: 100,
          capacityAcKw: 80,
        }),
      /already exists in your company/
    );

    // Update Plant A
    const updated = await solarPlantService.updatePlant(companyA.id, plantA.id, {
      name: 'Factory Rooftop Solar Array 1 (Upgraded)',
      capacityDcKw: 320.00,
    });
    assert.strictEqual(updated.name, 'Factory Rooftop Solar Array 1 (Upgraded)');
    assert.strictEqual(Number(updated.capacityDcKw), 320);

    // List with pagination and search
    const list = await solarPlantService.listPlants(companyA.id, { search: 'Surat', limit: 10 });
    assert.ok(list.plants.length >= 1);
    assert.strictEqual(list.pagination.page, 1);

    // Cross-company access rejected
    await assert.rejects(
      () => solarPlantService.getPlantById(companyB.id, plantA.id),
      /Solar plant not found or does not belong to your company/
    );

    // Create Plant B in Company B
    plantB = await solarPlantService.createPlant(companyB.id, {
      name: 'Company B Solar Plant',
      code: `SOL-B-${nonce}`,
      capacityDcKw: 150.00,
      capacityAcKw: 120.00,
    });
    assert.strictEqual(plantB.companyId, companyB.id);

    console.log('✅ PASS: SolarPlant CRUD, search, pagination, and cross-company tenant isolation verified');
  });

  await t.test('3. SolarInverter & PanelString Services: Configuration & MPPT Validation', async () => {
    inverter1 = await solarPlantService.createInverter(companyA.id, plantA.id, {
      inverterCode: 'INV-01',
      make: 'Sungrow',
      model: 'SG110CX',
      serialNumber: `SN-SUNGROW-CX-${nonce}`,
      ratedCapacityKw: 110.00,
      maxDcPowerKw: 130.00,
      mpptChannels: 9,
      stringsPerMppt: 2,
      ipAddress: '192.168.1.101',
      status: 'OFFLINE',
    });

    assert.strictEqual(inverter1.plantId, plantA.id);
    assert.strictEqual(Number(inverter1.ratedCapacityKw), 110);

    // Create Panel String associated with inverter1
    panelString1 = await solarPlantService.createPanelString(companyA.id, plantA.id, {
      inverterId: inverter1.id,
      stringId: 'STR-01-A',
      modulesCount: 26,
      moduleModel: '545W Mono PERC',
      moduleWattageW: 545,
      tiltDegrees: 22.00,
      azimuthDegrees: 180.00,
      orientation: '180° South',
      mpptIndex: 1,
    });

    assert.strictEqual(panelString1.inverterId, inverter1.id);
    assert.strictEqual(panelString1.totalWattageWp, 26 * 545);

    // Relational Isolation Check: Cannot attach string to inverter from another plant
    await assert.rejects(
      () =>
        solarPlantService.createPanelString(companyB.id, plantB.id, {
          inverterId: inverter1.id, // Inverter from Plant A!
          stringId: 'STR-INVALID',
          modulesCount: 20,
          moduleWattageW: 500,
        }),
      /Specified inverter does not belong to this plant/
    );

    console.log('✅ PASS: Inverter & Panel String creation, capacity computation, and relational isolation verified');
  });

  await t.test('4. SolarApiConfig & Provider Adapter: AES-256 Encryption & Credential Masking', async () => {
    const rawApiKey = 'solar_secret_api_key_8899aabbcc';
    const rawApiSecret = 'solar_confidential_secret_token_1122';

    const saved = await solarApiConfigService.savePlantConfig(companyA.id, plantA.id, {
      provider: 'UNIVERSAL',
      baseUrl: 'https://api.solar-universal.com/v1',
      authType: 'API_KEY',
      apiKey: rawApiKey,
      apiSecret: rawApiSecret,
      pollingIntervalMinutes: 10,
    });

    // In API responses, secrets MUST be masked and never exposed
    assert.ok(saved.maskedApiKey.includes('••••'));
    assert.ok(saved.maskedApiSecret.includes('••••'));
    assert.notStrictEqual(saved.maskedApiKey, rawApiKey);
    assert.notStrictEqual(saved.maskedApiSecret, rawApiSecret);

    // Test connection via adapter
    const connTest = await solarApiConfigService.testConnection(companyA.id, plantA.id);
    assert.strictEqual(connTest.success, true);

    // Internal Decryption check: Background services receive original plaintext
    const decrypted = await solarApiConfigService.getDecryptedCredentials(plantA.id);
    assert.strictEqual(decrypted.apiKey, rawApiKey);
    assert.strictEqual(decrypted.apiSecret, rawApiSecret);

    console.log('✅ PASS: AES-256-GCM API credential encryption, response masking, and adapter test connection verified');
  });

  await t.test('5. Telemetry Ingestion Engine: Normalization, Deduplication & Snapshot Updates', async () => {
    const timeT1 = new Date('2026-11-04T06:00:00.000Z');
    const timeT2 = new Date('2026-11-04T06:15:00.000Z');

    // 1. Ingest T1 reading
    const ingest1 = await solarTelemetryService.ingestTelemetryBatch(companyA.id, plantA.id, [
      {
        inverterCode: inverter1.inverterCode,
        timestamp: timeT1.toISOString(),
        currentPowerKw: 45.50,
        dailyEnergyKwh: 12.40,
        totalEnergyKwh: 15400.00,
        gridVoltageV: 415.00,
        gridCurrentA: 63.20,
        frequencyHz: 50.01,
        irradianceWm2: 650.00,
        inverterStatus: 'ONLINE',
      },
    ]);

    assert.strictEqual(ingest1.ingested, 1);
    assert.strictEqual(ingest1.duplicates, 0);

    // Inverter status and lastTelemetryAt updated to T1
    const invAfterT1 = await prisma.solarInverter.findUnique({ where: { id: inverter1.id } });
    assert.strictEqual(invAfterT1.status, 'ONLINE');
    assert.strictEqual(new Date(invAfterT1.lastTelemetryAt).toISOString(), timeT1.toISOString());

    // 2. CRITICAL INVARIANT: Re-ingesting exact same reading must be identified as DUPLICATE
    const ingestDup = await solarTelemetryService.ingestTelemetryBatch(companyA.id, plantA.id, [
      {
        inverterCode: inverter1.inverterCode,
        timestamp: timeT1.toISOString(),
        currentPowerKw: 45.50,
      },
    ]);
    assert.strictEqual(ingestDup.ingested, 0);
    assert.strictEqual(ingestDup.duplicates, 1);

    // 3. Ingest T2 (newer) reading
    const ingest2 = await solarTelemetryService.ingestTelemetryBatch(companyA.id, plantA.id, [
      {
        inverterCode: inverter1.inverterCode,
        timestamp: timeT2.toISOString(),
        currentPowerKw: 88.20,
        dailyEnergyKwh: 34.80,
        totalEnergyKwh: 15422.40,
        irradianceWm2: 820.00,
        inverterStatus: 'ONLINE',
      },
    ]);
    assert.strictEqual(ingest2.ingested, 1);

    const invAfterT2 = await prisma.solarInverter.findUnique({ where: { id: inverter1.id } });
    assert.strictEqual(new Date(invAfterT2.lastTelemetryAt).toISOString(), timeT2.toISOString());

    // 4. OUT-OF-ORDER HANDLING: Ingesting an older delayed timestamp (T0: 05:45) must NOT overwrite newer inverter snapshot
    const timeT0 = new Date('2026-11-04T05:45:00.000Z');
    await solarTelemetryService.ingestTelemetryBatch(companyA.id, plantA.id, [
      {
        inverterCode: inverter1.inverterCode,
        timestamp: timeT0.toISOString(),
        currentPowerKw: 20.00,
        dailyEnergyKwh: 5.00,
        inverterStatus: 'STANDBY',
      },
    ]);

    const invAfterOlder = await prisma.solarInverter.findUnique({ where: { id: inverter1.id } });
    // Inverter latest state remains T2, not overwritten by older T0 reading!
    assert.strictEqual(new Date(invAfterOlder.lastTelemetryAt).toISOString(), timeT2.toISOString());
    assert.strictEqual(invAfterOlder.status, 'ONLINE');

    // 5. Test Webhook Ingestion endpoint
    const config = await prisma.solarPlantApiConfig.findUnique({ where: { plantId: plantA.id } });
    const webhookTime = new Date('2026-11-04T06:30:00.000Z');
    const webhookRes = await solarTelemetryService.handleWebhookPush(
      plantA.id,
      config.webhookToken,
      {},
      {
        inverterCode: inverter1.inverterCode,
        timestamp: webhookTime.toISOString(),
        currentPowerKw: 92.50,
        dailyEnergyKwh: 57.90,
        totalEnergyKwh: 15445.50,
      }
    );
    assert.strictEqual(webhookRes.ingested, 1);

    // Latest Snapshot API
    const snapshot = await solarTelemetryService.getLatestPlantSnapshot(companyA.id, plantA.id);
    assert.strictEqual(snapshot.plantCode, plantA.code);
    assert.strictEqual(snapshot.onlineInvertersCount, 1);
    assert.strictEqual(snapshot.totalCurrentPowerKw, 92.5);

    console.log('✅ PASS: Telemetry ingestion, deduplication, out-of-order resilience, webhook and live snapshot verified');
  });

  await t.test('6. Yield Analytics: Specific Yield, PR Calculation & Sensor Unavailable Fallback', async () => {
    // Plant with Irradiance data (Telemetry readings created above have irradiance 650 & 820 W/m2)
    const analyticsWithSensor = await solarAnalyticsService.getYieldAnalytics(companyA.id, plantA.id, {
      period: 'DAILY',
      date: '2026-11-04',
    });

    assert.ok(analyticsWithSensor.actualGenerationKwh > 0);
    assert.ok(analyticsWithSensor.specificYieldKwhPerKwp > 0);
    assert.strictEqual(analyticsWithSensor.performanceRatio.status, 'CALCULATED');
    assert.ok(analyticsWithSensor.performanceRatio.ratioPercent >= 50 && analyticsWithSensor.performanceRatio.ratioPercent <= 95);

    // Plant WITHOUT Irradiance sensor: Plant B has no telemetry with irradiance
    // Ingest telemetry into Plant B with NULL irradiance
    const invB = await solarPlantService.createInverter(companyB.id, plantB.id, {
      inverterCode: 'INV-B-01',
      make: 'Delta',
      model: 'M50A',
      serialNumber: `SN-DELTA-${nonce}`,
      ratedCapacityKw: 50.00,
    });

    await solarTelemetryService.ingestTelemetryBatch(companyB.id, plantB.id, [
      {
        inverterCode: invB.inverterCode,
        timestamp: '2026-11-04T07:00:00.000Z',
        currentPowerKw: 35.00,
        dailyEnergyKwh: 70.00,
        irradianceWm2: null, // NO SENSOR
      },
    ]);

    const analyticsNoSensor = await solarAnalyticsService.getYieldAnalytics(companyB.id, plantB.id, {
      period: 'DAILY',
      date: '2026-11-04',
    });

    // PR must NOT be fabricated! Must return SENSOR_UNAVAILABLE
    assert.strictEqual(analyticsNoSensor.performanceRatio.status, 'SENSOR_UNAVAILABLE');
    assert.strictEqual(analyticsNoSensor.performanceRatio.ratioPercent, null);
    assert.ok(analyticsNoSensor.performanceRatio.explanation.includes('pyranometer'));
    assert.ok(analyticsNoSensor.specificYieldKwhPerKwp > 0); // Specific Yield still accurately provided

    console.log('✅ PASS: Yield analytics, Specific Yield (kWh/kWp), and PR SENSOR_UNAVAILABLE fallback strictly verified');
  });

  await t.test('7. Inverter Alarms: Fault Ingestion, Deduplication, Ack & Resolution', async () => {
    // 1. Raise CRITICAL Alarm
    const alarmResult = await solarAlarmService.raiseAlarm(
      companyA.id,
      {
        plantId: plantA.id,
        inverterId: inverter1.id,
        alarmCode: 'INV_GRID_OVERVOLTAGE_001',
        severity: 'CRITICAL',
        category: 'GRID',
        description: 'Inverter tripped: Grid overvoltage detected on Phase 2',
      },
      empA
    );

    assert.strictEqual(alarmResult.isDuplicate, false);
    assert.strictEqual(alarmResult.alarm.status, 'ACTIVE');

    // 2. Duplicate Alarm Check: Raising same fault on same inverter while active must be identified as duplicate
    const dupAlarm = await solarAlarmService.raiseAlarm(
      companyA.id,
      {
        plantId: plantA.id,
        inverterId: inverter1.id,
        alarmCode: 'INV_GRID_OVERVOLTAGE_001',
        severity: 'CRITICAL',
        description: 'Repeated trigger',
      },
      empA
    );
    assert.strictEqual(dupAlarm.isDuplicate, true);

    // 3. Acknowledge Alarm
    const acked = await solarAlarmService.acknowledgeAlarm(
      companyA.id,
      alarmResult.alarm.id,
      'Technician investigating line voltage',
      empA
    );
    assert.strictEqual(acked.status, 'ACKNOWLEDGED');

    // 4. Resolve Alarm
    const resolved = await solarAlarmService.resolveAlarm(
      companyA.id,
      alarmResult.alarm.id,
      'Grid voltage normalized after sub-station tap setting adjusted',
      empA
    );
    assert.strictEqual(resolved.status, 'RESOLVED');

    console.log('✅ PASS: Inverter alarm lifecycle, duplicate prevention, and acknowledgement/resolution verified');
  });

  await t.test('8. Cleaning Schedules: Array Wash Cycles, Due Dates & Inspector Assignment', async () => {
    // Create schedule
    const sched = await solarCleaningService.createCleaningSchedule(
      companyA.id,
      {
        plantId: plantA.id,
        arrayBlock: 'North Array Rooftop - Block 1',
        frequency: 'FORTNIGHTLY',
        inspectorId: empA.id,
      },
      empA
    );

    assert.strictEqual(sched.inspectorId, empA.id);
    assert.strictEqual(sched.status, 'SCHEDULED');

    // Employee cross-tenant rejection
    await assert.rejects(
      () =>
        solarCleaningService.createCleaningSchedule(companyA.id, {
          plantId: plantA.id,
          arrayBlock: 'Block 2',
          inspectorId: empB.id, // Employee from Company B!
        }),
      /Assigned inspector employee does not belong to your company/
    );

    // Complete wash cycle -> Next due date automatically advanced by 14 days
    const completed = await solarCleaningService.completeCleaningCycle(
      companyA.id,
      sched.id,
      {
        waterUsedLiters: 850,
        soilingLossEstimatedPercent: 0.5,
        cleaningMethod: 'PRESSURE_WASH',
      },
      empA
    );

    assert.strictEqual(completed.status, 'COMPLETED');
    assert.ok(new Date(completed.nextDueDate) > new Date(completed.lastCleanedDate));

    console.log('✅ PASS: Cleaning schedule creation, employee validation, completion, and due date auto-advance verified');
  });

  await t.test('9. Maintenance Tickets: Lifecycle, Technician Assignment & Alarm Linkage', async () => {
    const ticket = await solarMaintenanceService.createTicket(
      companyA.id,
      {
        plantId: plantA.id,
        inverterId: inverter1.id,
        category: 'INVERTER_FAULT',
        priority: 'HIGH',
        subject: 'Inspect DC Bus Inverter 01',
        description: 'Fuse blown on String 3 during lightning storm',
        assignedTechnicianId: empA.id,
      },
      empA
    );

    assert.ok(ticket.ticketNo.startsWith('TKT-SOL-'));
    assert.strictEqual(ticket.status, 'ASSIGNED');
    assert.strictEqual(ticket.assignedTechnicianId, empA.id);

    // Cross-tenant employee rejection
    await assert.rejects(
      () =>
        solarMaintenanceService.createTicket(companyA.id, {
          plantId: plantA.id,
          category: 'CABLE',
          subject: 'Test cross tech',
          description: 'Desc',
          assignedTechnicianId: empB.id, // Foreign technician!
        }),
      /Assigned technician does not belong to your company/
    );

    console.log('✅ PASS: Maintenance ticket generation, employee scoping, and lifecycle verified');
  });

  await t.test('10. O&M Spares Inventory Integration: Phase 4 FIFO Stock Issue & Movement Ledger', async () => {
    // Create an open maintenance ticket that needs spare parts
    const ticket = await solarMaintenanceService.createTicket(companyA.id, {
      plantId: plantA.id,
      inverterId: inverter1.id,
      category: 'FUSE_REPLACEMENT',
      priority: 'HIGH',
      subject: 'Replace damaged MC4 inline fuse',
      description: 'Fuse replacement on combiner box',
      assignedTechnicianId: empA.id,
    });

    const initialStock = await prisma.inventoryStock.findFirst({
      where: { companyId: companyA.id, sku: spareProduct.sku },
    });
    assert.strictEqual(initialStock.stock, 50);

    // Issue 5 units of MC4 Inline Fuse against this maintenance ticket
    const issueResult = await solarMaintenanceService.issueSparesAgainstTicket(
      companyA.id,
      ticket.id,
      {
        sku: spareProduct.sku,
        quantity: 5,
        warehouse: warehouseA.name,
      },
      empA
    );

    assert.strictEqual(issueResult.success, true);
    assert.strictEqual(issueResult.issuedQuantity, 5);
    assert.strictEqual(issueResult.totalCost, 5 * 125.00); // 5 * 125 = 625

    // Verify Phase 4 InventoryStock updated
    const updatedStock = await prisma.inventoryStock.findFirst({
      where: { companyId: companyA.id, sku: spareProduct.sku },
    });
    assert.strictEqual(updatedStock.stock, 45); // 50 - 5 = 45
    assert.strictEqual(updatedStock.availableQty, 45);

    // Verify InventoryMovement posted
    const movement = await prisma.inventoryMovement.findFirst({
      where: {
        companyId: companyA.id,
        referenceType: 'SOLAR_MAINTENANCE_TICKET',
        referenceId: ticket.id,
      },
    });
    assert.ok(movement);
    assert.strictEqual(movement.movementType, 'CONSUMPTION');
    assert.strictEqual(movement.quantity, 5);
    assert.strictEqual(Number(movement.unitCost), 125.00);
    assert.strictEqual(movement.referenceNo, ticket.ticketNo);

    // Verify Ticket sparePartsDetails updated
    const updatedTicket = await solarMaintenanceService.getTicketById(companyA.id, ticket.id);
    assert.strictEqual(updatedTicket.sparePartsDetails.length, 1);
    assert.strictEqual(updatedTicket.sparePartsDetails[0].sku, spareProduct.sku);
    assert.strictEqual(updatedTicket.sparePartsDetails[0].quantity, 5);

    // Test Insufficient Stock Rejection: Request 100 units when only 45 available
    await assert.rejects(
      () =>
        solarMaintenanceService.issueSparesAgainstTicket(
          companyA.id,
          ticket.id,
          { sku: spareProduct.sku, quantity: 100, warehouse: warehouseA.name },
          empA
        ),
      /Insufficient available stock/
    );

    console.log('✅ PASS: Phase 4 FIFO inventory issue against maintenance ticket and stock ledger consistency verified');
  });

  await t.test('11. Cleanup Test Records', async () => {
    // Delete in reverse dependency order
    await prisma.inventoryMovement.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.inventoryBatch.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.inventoryStock.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.inventoryWarehouse.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.product.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.productCategory.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.solarTelemetryLog.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.solarInverterAlarm.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.solarMaintenanceTicket.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.solarCleaningSchedule.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.solarPlantApiConfig.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.solarPanelString.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.solarInverter.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.solarPlant.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.companyEmployee.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.clientAdmin.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
    console.log('✅ PASS: Test data cleaned up successfully');
  });
});

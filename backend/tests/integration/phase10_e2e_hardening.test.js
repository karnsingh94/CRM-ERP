/**
 * Phase 10: Solar Monitoring - Comprehensive E2E Business Workflow & Hardening Verification
 * Validates all 17 business workflows, multi-tenant security, telemetry integrity, and FIFO spares issuance.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';

import solarPlantService from '../../src/services/solar/solarPlant.service.js';
import solarApiConfigService from '../../src/services/solar/solarApiConfig.service.js';
import solarTelemetryService from '../../src/services/solar/solarTelemetry.service.js';
import solarAnalyticsService from '../../src/services/solar/solarAnalytics.service.js';
import solarAlarmService from '../../src/services/solar/solarAlarm.service.js';
import solarCleaningService from '../../src/services/solar/solarCleaning.service.js';
import solarMaintenanceService from '../../src/services/solar/solarMaintenance.service.js';

const prisma = new PrismaClient();

test('PHASE 10: SOLAR MONITORING - END-TO-END WORKFLOW & SECURITY HARDENING', async (t) => {
  let companyAId;
  let companyBId;
  let userA;
  let userB;
  let technicianA;

  let plantA;
  let inverterA1;
  let inverterA2;
  let stringA1;
  let testProduct;
  let testBatch;
  let alarmA;
  let ticketA;
  let cleaningA;

  const unique = Date.now().toString().slice(-6);

  await t.test('0. Database Safety Check: Active DB must be crm_erp_test_db', async () => {
    const dbNameRes = await prisma.$queryRawUnsafe('SELECT DATABASE() AS currentDb');
    const currentDb = dbNameRes[0]?.currentDb;
    assert.match(currentDb, /test/i, `SAFETY CHECK FAILED: Expected test DB, got ${currentDb}`);
    assert.equal(currentDb, 'crm_erp_test_db');
  });

  await t.test('Setup: Provision Multi-Tenant Companies, Employees & Phase 4 Inventory Spares', async () => {
    // Create Company A & B
    const compA = await prisma.clientAdmin.create({
      data: {
        name: `Solar E2E Comp A ${unique}`,
        email: `solar_e2e_a_${unique}@test.com`,
        organizationName: `Solar E2E Comp A ${unique}`,
        passwordHash: 'dummy_hash',
      },
    });
    companyAId = compA.id;

    const compB = await prisma.clientAdmin.create({
      data: {
        name: `Solar E2E Comp B ${unique}`,
        email: `solar_e2e_b_${unique}@test.com`,
        organizationName: `Solar E2E Comp B ${unique}`,
        passwordHash: 'dummy_hash',
      },
    });
    companyBId = compB.id;

    userA = { id: `usr-a-${unique}`, userId: `usr-a-${unique}`, companyId: companyAId, role: 'COMPANY_ADMIN' };
    userB = { id: `usr-b-${unique}`, userId: `usr-b-${unique}`, companyId: companyBId, role: 'COMPANY_ADMIN' };

    // Create technician in Company A
    technicianA = await prisma.companyEmployee.create({
      data: {
        companyId: companyAId,
        name: 'Ramesh Solar Tech',
        email: `ramesh.tech.${unique}@companyA.com`,
        status: 'ACTIVE',
        role: 'TECHNICIAN',
      },
    });

    // Create Phase 4 Inventory Product & Batch in Company A for O&M Spares
    testProduct = await prisma.product.create({
      data: {
        companyId: companyAId,
        name: `Solar Inverter Fuse 1000V 30A ${unique}`,
        sku: `FUSE-SOL-${unique}`,
        category: 'Solar Spares',
        uom: 'PCS',
        purchasePrice: 450.0,
        sellingPrice: 750.0,
        status: 'ACTIVE',
      },
    });

    testBatch = await prisma.inventoryBatch.create({
      data: {
        companyId: companyAId,
        batchNo: `BAT-SOL-${unique}-01`,
        sku: testProduct.sku,
        warehouse: 'Central Solar Warehouse',
        initialQty: 50,
        availableQty: 50,
        unitCost: 450.0,
        status: 'ACTIVE',
        qualityStatus: 'ACCEPTED',
        receivedDate: new Date('2026-01-10'),
      },
    });

    await prisma.inventoryStock.create({
      data: {
        companyId: companyAId,
        sku: testProduct.sku,
        name: testProduct.name,
        warehouse: 'Central Solar Warehouse',
        stock: 50,
        availableQty: 50,
        uom: 'PCS',
      },
    });
  });

  // -------------------------------------------------------------------------
  // WORKFLOWS 1 TO 5: Plant, Inverter, Strings, API Config, Test Connection
  // -------------------------------------------------------------------------
  await t.test('Workflow 1: Create Solar Plant with capacity & location attributes', async () => {
    plantA = await solarPlantService.createPlant(
      companyAId,
      {
        name: 'Shree Nath Rooftop Plant 1',
        code: `SNP-R1-${unique}`,
        plantType: 'ROOFTOP_INDUSTRIAL',
        capacityDcKw: 250.0,
        capacityAcKw: 200.0,
        monthlyTargetKwh: 30000.0,
        commissionDate: '2024-03-15',
        locationAddress: 'Factory Shed 4, Jodhpur Industrial Area',
        city: 'Jodhpur',
        state: 'Rajasthan',
      },
      userA
    );

    assert.ok(plantA.id);
    assert.equal(plantA.name, 'Shree Nath Rooftop Plant 1');
    assert.equal(Number(plantA.capacityDcKw), 250);
    assert.equal(Number(plantA.capacityAcKw), 200);
    assert.equal(plantA.status, 'ACTIVE');
  });

  await t.test('Workflow 2: Add 2 Inverters to the Plant', async () => {
    inverterA1 = await solarPlantService.createInverter(
      companyAId,
      plantA.id,
      {
        inverterCode: `INV-01-${unique}`,
        make: 'Sungrow',
        model: 'SG110CX',
        serialNumber: `SN-SUNGROW-1-${unique}`,
        ratedCapacityKw: 100.0,
        maxDcPowerKw: 130.0,
        mpptChannels: 9,
        stringsPerMppt: 2,
        ipAddress: '192.168.1.101',
        modbusSlaveId: 1,
      },
      userA
    );

    inverterA2 = await solarPlantService.createInverter(
      companyAId,
      plantA.id,
      {
        inverterCode: `INV-02-${unique}`,
        make: 'Sungrow',
        model: 'SG110CX',
        serialNumber: `SN-SUNGROW-2-${unique}`,
        ratedCapacityKw: 100.0,
        maxDcPowerKw: 130.0,
        mpptChannels: 9,
        stringsPerMppt: 2,
        ipAddress: '192.168.1.102',
        modbusSlaveId: 2,
      },
      userA
    );

    assert.ok(inverterA1.id);
    assert.ok(inverterA2.id);
    assert.equal(inverterA1.status, 'OFFLINE'); // Initial state prior to telemetry ingestion
    assert.equal(Number(inverterA1.ratedCapacityKw), 100);
  });

  await t.test('Workflow 3: Add Panel Strings with MPPT mapping, tilt, and azimuth', async () => {
    stringA1 = await solarPlantService.createPanelString(
      companyAId,
      plantA.id,
      {
        inverterId: inverterA1.id,
        stringName: 'STR-INV1-MPPT1-A',
        panelModel: 'Trina Solar Bifacial 540W',
        panelWattageWp: 540,
        panelsCount: 24,
        tiltDegrees: 18.5,
        azimuthDegrees: 180.0,
        mpptChannel: 'MPPT 1',
      },
      userA
    );

    assert.ok(stringA1.id);
    assert.equal(stringA1.stringName, 'STR-INV1-MPPT1-A');
    assert.equal(stringA1.panelsCount, 24);
    assert.equal(stringA1.panelWattageWp, 540);
  });

  await t.test('Workflow 4: Configure provider-independent API credentials (encrypted & masked)', async () => {
    const config = await solarApiConfigService.savePlantConfig(
      companyAId,
      plantA.id,
      {
        provider: 'GENERIC_REST',
        authType: 'API_KEY',
        apiKey: 'SECRET-API-KEY-XYZ-12345',
        apiEndpoint: 'https://solar-api.example.com/v1',
        syncIntervalMinutes: 15,
        enableAutoSync: true,
      },
      userA
    );

    assert.ok(config.id);
    assert.ok(config.webhookToken); // Auto-generated webhook token
    assert.ok(config.maskedApiKey.includes('••••')); // Masked in response
  });

  await t.test('Workflow 5: Test API connection (universal adapter ping)', async () => {
    const testResult = await solarApiConfigService.testConnection(companyAId, plantA.id);
    assert.ok(testResult.success);
    assert.ok(testResult.connectedAt);
  });

  // -------------------------------------------------------------------------
  // WORKFLOWS 6 TO 10: Telemetry Ingestion, Snapshot, History, Analytics, PR
  // -------------------------------------------------------------------------
  await t.test('Workflow 6 & 7: Ingest telemetry batch and verify latest snapshot aggregation', async () => {
    const now = new Date();

    const telemetryReadings = [
      {
        inverterCode: inverterA1.inverterCode,
        timestamp: now.toISOString(),
        currentPowerKw: 75.5,
        dailyEnergyKwh: 340.0,
        totalEnergyKwh: 45000.0,
        gridVoltageV: 415.2,
        gridCurrentA: 105.0,
        frequencyHz: 50.01,
        temperatureC: 44.5,
        irradianceWm2: 850.0,
        inverterStatus: 'NORMAL',
        isSimulated: false,
      },
      {
        inverterCode: inverterA2.inverterCode,
        timestamp: now.toISOString(),
        currentPowerKw: 72.0,
        dailyEnergyKwh: 325.0,
        totalEnergyKwh: 43200.0,
        gridVoltageV: 414.8,
        gridCurrentA: 100.2,
        frequencyHz: 50.02,
        temperatureC: 45.1,
        irradianceWm2: 850.0,
        inverterStatus: 'NORMAL',
        isSimulated: false,
      },
    ];

    const ingestRes = await solarTelemetryService.ingestTelemetryBatch(
      companyAId,
      plantA.id,
      telemetryReadings,
      { isSimulated: false, source: 'API_DIRECT', provider: 'GENERIC_REST' }
    );

    assert.equal(ingestRes.ingested, 2);
    assert.equal(ingestRes.duplicates, 0);

    // Verify snapshot
    const snapshot = await solarTelemetryService.getLatestPlantSnapshot(companyAId, plantA.id);
    assert.equal(snapshot.totalCurrentPowerKw, 147.5); // 75.5 + 72.0
    assert.equal(snapshot.totalDailyEnergyKwh, 665.0); // 340.0 + 325.0
    assert.equal(snapshot.onlineInvertersCount, 2);
    assert.equal(snapshot.invertersCount, 2);
    assert.equal(snapshot.irradianceWm2, 850);
  });

  await t.test('Workflow 8: Verify historical telemetry & pagination', async () => {
    const history = await solarTelemetryService.getTelemetryHistory(companyAId, plantA.id, { page: 1, limit: 10 });
    assert.ok(history.logs.length >= 2);
    assert.ok(history.pagination.total >= 2);
    assert.equal(history.pagination.page, 1);
  });

  await t.test('Workflow 9 & 10: Verify Yield Analytics, Specific Yield, and Performance Ratio (PR)', async () => {
    const analytics = await solarAnalyticsService.getYieldAnalytics(companyAId, plantA.id, {
      period: 'MONTHLY',
    });

    assert.equal(analytics.actualGenerationKwh, 665.0);
    // Specific Yield = 665 kWh / 250 kWp = 2.66 kWh/kWp
    assert.equal(analytics.specificYieldKwhPerKwp, 2.66);
    // Irradiance is present (850 W/m2) -> PR should be CALCULATED
    assert.equal(analytics.performanceRatio.status, 'CALCULATED');
    assert.ok(analytics.performanceRatio.ratioPercent >= 50 && analytics.performanceRatio.ratioPercent <= 95);
    assert.ok(analytics.environmentalImpact.co2OffsetKg > 0);
  });

  await t.test('Workflow 10 (Fallback): PR must return SENSOR_UNAVAILABLE when pyranometer sensor data is absent', async () => {
    const noSensorPlant = await solarPlantService.createPlant(companyAId, {
      name: 'No Sensor Rooftop Plant',
      code: `NSP-${unique}`,
      plantType: 'ROOFTOP_COMMERCIAL',
      capacityDcKw: 100.0,
      capacityAcKw: 80.0,
    });

    const noSensorInv = await solarPlantService.createInverter(companyAId, noSensorPlant.id, {
      inverterCode: `INV-NS-${unique}`,
      make: 'Delta',
      model: 'M50A',
      serialNumber: `SN-NS-${unique}`,
      ratedCapacityKw: 50.0,
    });

    await solarTelemetryService.ingestTelemetryBatch(
      companyAId,
      noSensorPlant.id,
      [
        {
          inverterCode: noSensorInv.inverterCode,
          timestamp: new Date().toISOString(),
          currentPowerKw: 40.0,
          dailyEnergyKwh: 180.0,
          totalEnergyKwh: 1200.0,
          irradianceWm2: null, // SENSOR ABSENT
        },
      ],
      { isSimulated: false }
    );

    const analytics = await solarAnalyticsService.getYieldAnalytics(companyAId, noSensorPlant.id, { period: 'MONTHLY' });
    assert.equal(analytics.performanceRatio.status, 'SENSOR_UNAVAILABLE');
    assert.equal(analytics.performanceRatio.ratioPercent, null);
    assert.match(analytics.performanceRatio.explanation, /pyranometer/i);

    // Cleanup temp plant
    await prisma.solarTelemetryLog.deleteMany({ where: { plantId: noSensorPlant.id } });
    await prisma.solarInverter.deleteMany({ where: { plantId: noSensorPlant.id } });
    await prisma.solarPlant.deleteMany({ where: { id: noSensorPlant.id } });
  });

  // -------------------------------------------------------------------------
  // WORKFLOWS 11 TO 15: Alarms, Tickets, Technician, Cleaning Schedules
  // -------------------------------------------------------------------------
  await t.test('Workflow 11 & 12: Raise inverter alarm, acknowledge, and resolve alarm', async () => {
    // Raise
    const raised = await solarAlarmService.raiseAlarm(
      companyAId,
      {
        plantId: plantA.id,
        inverterId: inverterA1.id,
        alarmCode: 'INV-ERR-GRID-OVERVOLT',
        severity: 'CRITICAL',
        category: 'GRID',
        description: 'Phase A voltage surged to 465V. Inverter tripped.',
      },
      userA
    );
    alarmA = raised.alarm;
    assert.equal(alarmA.status, 'ACTIVE');
    assert.equal(alarmA.severity, 'CRITICAL');

    // Acknowledge
    const ack = await solarAlarmService.acknowledgeAlarm(companyAId, alarmA.id, 'Control room acknowledged. Dispatched tech.', userA);
    assert.equal(ack.status, 'ACKNOWLEDGED');
    assert.ok(ack.acknowledgedAt);

    // Resolve
    const res = await solarAlarmService.resolveAlarm(companyAId, alarmA.id, 'Grid utility stabilized voltage to 415V.', userA);
    assert.equal(res.status, 'RESOLVED');
    assert.ok(res.resolvedAt);
    assert.equal(res.resolutionNotes, 'Grid utility stabilized voltage to 415V.');
  });

  await t.test('Workflow 13 & 14: Create maintenance ticket from alarm and assign technician', async () => {
    ticketA = await solarMaintenanceService.createTicket(
      companyAId,
      {
        plantId: plantA.id,
        inverterId: inverterA1.id,
        category: 'INVERTER',
        priority: 'HIGH',
        subject: 'Inspect AC breakers and replace blown control fuse',
        description: 'Inverter tripped after voltage surge. Fuse F1 needs inspection.',
        assignedTechnicianId: technicianA.id,
        alarmId: alarmA.id,
      },
      userA
    );

    assert.ok(ticketA.ticketNo.startsWith('TKT-SOL-'));
    assert.equal(ticketA.status, 'ASSIGNED');
    assert.equal(ticketA.assignedTechnicianId, technicianA.id);
    assert.equal(ticketA.technicianName, 'Ramesh Solar Tech');

    // Verify alarm is linked to ticket
    const linkedAlarm = await prisma.solarInverterAlarm.findUnique({ where: { id: alarmA.id } });
    assert.equal(linkedAlarm.ticketId, ticketA.id);
  });

  await t.test('Workflow 15: Create cleaning schedule and complete cleaning cycle with nextDueDate rollover', async () => {
    const firstDue = new Date(Date.now() + 14 * 24 * 3600 * 1000);
    cleaningA = await solarCleaningService.createCleaningSchedule(
      companyAId,
      {
        plantId: plantA.id,
        arrayBlock: 'Block A - Rows 1 to 10',
        frequency: 'FORTNIGHTLY', // 14 days
        nextDueDate: firstDue.toISOString().slice(0, 10),
        inspectorId: technicianA.id,
      },
      userA
    );

    assert.equal(cleaningA.frequency, 'FORTNIGHTLY');
    assert.equal(cleaningA.status, 'SCHEDULED');

    // Complete cycle
    const completed = await solarCleaningService.completeCleaningCycle(
      companyAId,
      cleaningA.id,
      {
        waterUsedLiters: 1200,
        soilingLossEstimatedPercent: 2.1,
        cleaningMethod: 'MANUAL_WASH',
        inspectionRemarks: 'Panels washed. Module surface clean.',
      },
      userA
    );

    assert.equal(completed.status, 'COMPLETED');
    assert.ok(completed.lastCleanedDate);
    assert.equal(Number(completed.waterUsedLiters), 1200);
    // Next due date rolled over by 14 days
    const daysDiff = Math.round((new Date(completed.nextDueDate) - new Date(completed.lastCleanedDate)) / (1000 * 3600 * 24));
    assert.equal(daysDiff, 14);
  });

  // -------------------------------------------------------------------------
  // WORKFLOWS 16 & 17: PHASE 4 INVENTORY FIFO SPARES INTEGRATION
  // -------------------------------------------------------------------------
  await t.test('Workflow 16 & 17: Issue spare parts via Phase 4 FIFO inventory and verify batch deduction & movements', async () => {
    // Check initial stock before issuance
    const batchBefore = await prisma.inventoryBatch.findUnique({ where: { id: testBatch.id } });
    const stockBefore = await prisma.inventoryStock.findFirst({
      where: { companyId: companyAId, sku: testProduct.sku },
    });
    assert.equal(batchBefore.availableQty, 50);
    assert.equal(stockBefore.availableQty, 50);

    // Issue 3 fuses against ticketA
    const issueResult = await solarMaintenanceService.issueSparesAgainstTicket(
      companyAId,
      ticketA.id,
      {
        sku: testProduct.sku,
        quantity: 3,
        warehouse: 'Central Solar Warehouse',
      },
      userA
    );

    assert.ok(issueResult.success);
    assert.equal(issueResult.issuedQuantity, 3);
    assert.equal(issueResult.totalCost, 3 * 450.0); // 1,350 INR
    assert.ok(issueResult.allocations[0].movementNo.startsWith('MOV-SOL-'));

    // Verify InventoryBatch deduction (50 - 3 = 47)
    const batchAfter = await prisma.inventoryBatch.findUnique({ where: { id: testBatch.id } });
    assert.equal(batchAfter.availableQty, 47);

    // Verify InventoryStock deduction (50 - 3 = 47)
    const stockAfter = await prisma.inventoryStock.findFirst({
      where: { companyId: companyAId, sku: testProduct.sku },
    });
    assert.equal(stockAfter.availableQty, 47);

    // Verify InventoryMovement record created
    const movement = await prisma.inventoryMovement.findFirst({
      where: { companyId: companyAId, referenceType: 'SOLAR_MAINTENANCE_TICKET', referenceId: ticketA.id },
    });
    assert.ok(movement);
    assert.equal(movement.movementType, 'CONSUMPTION');
    assert.equal(movement.quantity, 3);
    assert.equal(movement.referenceNo, ticketA.ticketNo);

    // Verify ticket consumption history in sparePartsDetails
    const updatedTicket = await solarMaintenanceService.getTicketById(companyAId, ticketA.id);
    assert.equal(updatedTicket.sparePartsDetails.length, 1);
    assert.equal(updatedTicket.sparePartsDetails[0].sku, testProduct.sku);
    assert.equal(updatedTicket.sparePartsDetails[0].quantity, 3);
  });

  // -------------------------------------------------------------------------
  // SECTION 3, 4, 6: HARDENING & MULTI-TENANT SECURITY VERIFICATION
  // -------------------------------------------------------------------------
  await t.test('Hardening: Deduplication prevents identical active alarms from duplicating', async () => {
    const dupRes = await solarAlarmService.raiseAlarm(
      companyAId,
      {
        plantId: plantA.id,
        inverterId: inverterA2.id,
        alarmCode: 'INV-ERR-COMM-LOST',
        severity: 'WARNING',
        description: 'RS-485 Modbus timeout',
      },
      userA
    );
    assert.equal(dupRes.isDuplicate, false);

    // Second raise with same active alarm code & inverter
    const dupRes2 = await solarAlarmService.raiseAlarm(
      companyAId,
      {
        plantId: plantA.id,
        inverterId: inverterA2.id,
        alarmCode: 'INV-ERR-COMM-LOST',
        severity: 'WARNING',
        description: 'RS-485 Modbus timeout (repeat trigger)',
      },
      userA
    );
    assert.equal(dupRes2.isDuplicate, true);
    assert.equal(dupRes2.alarm.id, dupRes.alarm.id);
  });

  await t.test('Hardening: Out-of-order telemetry readings cannot overwrite newer inverter status or lastTelemetryAt', async () => {
    const tNewer = new Date('2026-11-04T10:00:00Z');
    const tOlder = new Date('2026-11-04T08:00:00Z');

    // Ingest newer reading
    await solarTelemetryService.ingestTelemetryBatch(
      companyAId,
      plantA.id,
      [
        {
          inverterCode: inverterA1.inverterCode,
          timestamp: tNewer.toISOString(),
          currentPowerKw: 80.0,
          inverterStatus: 'NORMAL',
        },
      ],
      { isSimulated: false }
    );

    const invAfterNewer = await prisma.solarInverter.findUnique({ where: { id: inverterA1.id } });
    assert.equal(invAfterNewer.status, 'NORMAL');
    assert.equal(invAfterNewer.lastTelemetryAt.toISOString(), tNewer.toISOString());

    // Ingest older reading with FAULT status
    await solarTelemetryService.ingestTelemetryBatch(
      companyAId,
      plantA.id,
      [
        {
          inverterCode: inverterA1.inverterCode,
          timestamp: tOlder.toISOString(),
          currentPowerKw: 0.0,
          inverterStatus: 'FAULT',
        },
      ],
      { isSimulated: false }
    );

    const invAfterOlder = await prisma.solarInverter.findUnique({ where: { id: inverterA1.id } });
    // Inverter status and lastTelemetryAt must remain at newer value (NORMAL, 10:00:00Z)
    assert.equal(invAfterOlder.status, 'NORMAL');
    assert.equal(invAfterOlder.lastTelemetryAt.toISOString(), tNewer.toISOString());
  });

  await t.test('Multi-Tenant Isolation: Company B CANNOT access Company A plant, inverters, tickets or telemetry', async () => {
    // 1. Plant access
    await assert.rejects(
      async () => {
        await solarPlantService.getPlantById(companyBId, plantA.id);
      },
      { statusCode: 404 }
    );

    // 2. Inverter access
    await assert.rejects(
      async () => {
        await solarPlantService.getInverterById(companyBId, inverterA1.id);
      },
      { statusCode: 404 }
    );

    // 3. Telemetry snapshot access
    await assert.rejects(
      async () => {
        await solarTelemetryService.getLatestPlantSnapshot(companyBId, plantA.id);
      },
      { statusCode: 404 }
    );

    // 4. Ticket access
    await assert.rejects(
      async () => {
        await solarMaintenanceService.getTicketById(companyBId, ticketA.id);
      },
      { statusCode: 404 }
    );

    // 5. Cross-company technician assignment rejection
    await assert.rejects(
      async () => {
        await solarMaintenanceService.createTicket(
          companyBId,
          {
            plantId: plantA.id,
            category: 'INVERTER',
            priority: 'LOW',
            subject: 'Unauthorized cross-company ticket',
            description: 'Breach test',
            assignedTechnicianId: technicianA.id,
          },
          userB
        );
      },
      { statusCode: 404 }
    );

    // 6. Cross-company inventory spares issue rejection
    await assert.rejects(
      async () => {
        await solarMaintenanceService.issueSparesAgainstTicket(
          companyBId,
          ticketA.id,
          { sku: testProduct.sku, quantity: 1 },
          userB
        );
      },
      { statusCode: 404 }
    );
  });

  await t.test('Security: Webhook pushes are rejected if token does not match plant', async () => {
    const invalidToken = 'MALICIOUS-TOKEN-12345';
    await assert.rejects(
      async () => {
        await solarTelemetryService.handleWebhookPush(
          plantA.id,
          invalidToken,
          {},
          { readings: [] }
        );
      },
      { statusCode: 401 }
    );
  });

  await t.test('Cleanup: Safe tear down of test records', async () => {
    try {
      if (plantA?.id) {
        await prisma.solarTelemetryLog.deleteMany({ where: { plantId: plantA.id } });
        await prisma.solarPanelString.deleteMany({ where: { plantId: plantA.id } });
        await prisma.solarPlantApiConfig.deleteMany({ where: { plantId: plantA.id } });
      }
      await prisma.solarInverterAlarm.deleteMany({ where: { companyId: { in: [companyAId, companyBId].filter(Boolean) } } });
      await prisma.solarMaintenanceTicket.deleteMany({ where: { companyId: { in: [companyAId, companyBId].filter(Boolean) } } });
      await prisma.solarCleaningSchedule.deleteMany({ where: { companyId: { in: [companyAId, companyBId].filter(Boolean) } } });
      await prisma.solarInverter.deleteMany({ where: { companyId: { in: [companyAId, companyBId].filter(Boolean) } } });
      await prisma.solarPlant.deleteMany({ where: { companyId: { in: [companyAId, companyBId].filter(Boolean) } } });
      await prisma.inventoryMovement.deleteMany({ where: { companyId: { in: [companyAId, companyBId].filter(Boolean) } } });
      await prisma.inventoryBatch.deleteMany({ where: { companyId: { in: [companyAId, companyBId].filter(Boolean) } } });
      await prisma.inventoryStock.deleteMany({ where: { companyId: { in: [companyAId, companyBId].filter(Boolean) } } });
      if (testProduct?.id) {
        await prisma.product.deleteMany({ where: { id: testProduct.id } });
      }
      await prisma.companyEmployee.deleteMany({ where: { companyId: { in: [companyAId, companyBId].filter(Boolean) } } });
      await prisma.clientAdmin.deleteMany({ where: { id: { in: [companyAId, companyBId].filter(Boolean) } } });
    } catch (e) {
      console.warn('Cleanup warning:', e.message);
    }
  });
});

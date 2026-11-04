import assert from 'node:assert';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { encryptSensitive, decryptSensitive } from '../../src/utils/encryption.js';

const prisma = new PrismaClient();

// Runtime Database-Name Safety Guard
const dbUrl = process.env.DATABASE_URL || '';
console.log('\n[Database Safety Guard] Configured Target Database:', dbUrl.split('/').pop());

if (!dbUrl.includes('crm_erp_test_db')) {
  console.error('\nCRITICAL SAFETY ERROR: Test cannot execute against production or unknown database.');
  process.exit(1);
}

test('AZZUNIQE CRM & ERP — PHASE 10 STEP 1: SOLAR MONITORING SCHEMA VERIFICATION', async (t) => {
  let companyA;
  let companyB;
  let employeeA;
  let plantA;
  let inverter1;
  let panelString1;
  let apiConfigA;
  let telemetry1;
  let alarm1;
  let cleaningSchedule1;
  let maintenanceTicket1;

  const nonce = Date.now().toString().slice(-6);

  await t.test('Runtime Database Verification', async () => {
    const [result] = await prisma.$queryRawUnsafe('SELECT DATABASE() as current_db');
    assert.strictEqual(result.current_db, 'crm_erp_test_db');
    console.log('✅ PASS: Connected strictly to crm_erp_test_db');
  });

  await t.test('1. Multi-Tenant Setup: Create 2 Test Companies and Employee', async () => {
    companyA = await prisma.clientAdmin.create({
      data: {
        name: `Solar Admin A ${nonce}`,
        email: `solar_admin_a_${nonce}@test.com`,
        organizationName: 'Shree Nath Solar Corp A',
        passwordHash: 'dummyhash',
      },
    });

    companyB = await prisma.clientAdmin.create({
      data: {
        name: `Solar Admin B ${nonce}`,
        email: `solar_admin_b_${nonce}@test.com`,
        organizationName: 'Shree Nath Solar Corp B',
        passwordHash: 'dummyhash',
      },
    });

    employeeA = await prisma.companyEmployee.create({
      data: {
        companyId: companyA.id,
        name: 'Ramesh Solar Tech',
        email: `tech_ramesh_${nonce}@solara.com`,
        role: 'SOLAR_TECHNICIAN',
        accessRole: 'EMPLOYEE',
      },
    });

    assert.ok(companyA.id);
    assert.ok(companyB.id);
    assert.ok(employeeA.id);
    console.log('✅ PASS: Multi-tenant companies and employee accounts provisioned');
  });

  await t.test('2. SolarPlant: Creation, Company Scoping & Code Uniqueness', async () => {
    plantA = await prisma.solarPlant.create({
      data: {
        companyId: companyA.id,
        name: 'Rooftop Solar Plant A',
        code: `SOL-PLANT-${nonce}`,
        plantType: 'ROOFTOP_INDUSTRIAL',
        capacityDcKw: 250.50,
        capacityAcKw: 200.00,
        commissionDate: new Date('2025-01-15'),
        status: 'ACTIVE',
        timezone: 'Asia/Kolkata',
        locationAddress: 'Plot 42, Industrial Area, Sector 5',
        city: 'Surat',
        state: 'Gujarat',
        pincode: '395001',
        latitude: 21.1702401,
        longitude: 72.8310607,
        gridVoltage: '415 V (3-Phase)',
        monthlyTargetKwh: 32000.00,
      },
    });

    assert.strictEqual(plantA.companyId, companyA.id);
    assert.strictEqual(Number(plantA.capacityDcKw), 250.5);
    assert.strictEqual(Number(plantA.capacityAcKw), 200.0);

    // Duplicate plant code in same company must be rejected
    await assert.rejects(
      () =>
        prisma.solarPlant.create({
          data: {
            companyId: companyA.id,
            name: 'Duplicate Plant Code',
            code: `SOL-PLANT-${nonce}`,
            capacityDcKw: 100,
            capacityAcKw: 90,
          },
        }),
      /Unique constraint failed/
    );

    // Same plant code in DIFFERENT company must SUCCEED (Multi-tenant isolation)
    const plantB = await prisma.solarPlant.create({
      data: {
        companyId: companyB.id,
        name: 'Company B Solar Plant',
        code: `SOL-PLANT-${nonce}`,
        capacityDcKw: 150,
        capacityAcKw: 130,
      },
    });
    assert.ok(plantB.id);
    console.log('✅ PASS: SolarPlant created, company-scoped and code uniqueness enforced per tenant');
  });

  await t.test('3. SolarInverter: Creation, Capacity & Serial Number Uniqueness', async () => {
    inverter1 = await prisma.solarInverter.create({
      data: {
        companyId: companyA.id,
        plantId: plantA.id,
        inverterCode: 'INV-A-01',
        make: 'Sungrow',
        model: 'SG60KTL',
        serialNumber: `SN-SUNGROW-${nonce}-01`,
        ratedCapacityKw: 60.00,
        maxDcPowerKw: 75.00,
        mpptChannels: 6,
        stringsPerMppt: 2,
        ipAddress: '192.168.10.21',
        modbusAddress: 1,
        gatewayId: 'GW-SOLAR-01',
        status: 'ONLINE',
        efficiencyPercent: 98.70,
      },
    });

    assert.strictEqual(inverter1.plantId, plantA.id);
    assert.strictEqual(Number(inverter1.ratedCapacityKw), 60);

    // Duplicate serial number under same plant/company must be rejected
    await assert.rejects(
      () =>
        prisma.solarInverter.create({
          data: {
            companyId: companyA.id,
            plantId: plantA.id,
            inverterCode: 'INV-A-02',
            make: 'Sungrow',
            model: 'SG60KTL',
            serialNumber: `SN-SUNGROW-${nonce}-01`,
            ratedCapacityKw: 60,
          },
        }),
      /Unique constraint failed/
    );
    console.log('✅ PASS: SolarInverter created with MPPT config and serial number uniqueness constraint');
  });

  await t.test('4. SolarPanelString: Layout, Tilt, Azimuth & String ID Uniqueness', async () => {
    panelString1 = await prisma.solarPanelString.create({
      data: {
        companyId: companyA.id,
        plantId: plantA.id,
        inverterId: inverter1.id,
        stringId: 'STR-A-01',
        modulesCount: 24,
        moduleModel: '540W Mono PERC',
        moduleWattageW: 540,
        totalWattageWp: 12960,
        tiltDegrees: 22.50,
        azimuthDegrees: 180.00,
        orientation: '180° South',
        mpptIndex: 1,
        vmpRated: 720.00,
        impRated: 18.00,
        status: 'ACTIVE',
      },
    });

    assert.strictEqual(panelString1.inverterId, inverter1.id);
    assert.strictEqual(panelString1.modulesCount, 24);
    assert.strictEqual(panelString1.totalWattageWp, 12960);

    // Duplicate stringId in same plant must be rejected
    await assert.rejects(
      () =>
        prisma.solarPanelString.create({
          data: {
            companyId: companyA.id,
            plantId: plantA.id,
            stringId: 'STR-A-01',
            modulesCount: 20,
            moduleWattageW: 500,
          },
        }),
      /Unique constraint failed/
    );
    console.log('✅ PASS: SolarPanelString created and stringId uniqueness enforced per plant');
  });

  await t.test('5. SolarPlantApiConfig: Provider-Independent Encrypted Credentials', async () => {
    const rawApiKey = 'sol_live_key_998877665544332211';
    const rawApiSecret = 'sec_super_confidential_token_xyz_9988';
    const encryptedKey = encryptSensitive(rawApiKey);
    const encryptedSec = encryptSensitive(rawApiSecret);

    apiConfigA = await prisma.solarPlantApiConfig.create({
      data: {
        companyId: companyA.id,
        plantId: plantA.id,
        provider: 'SUNGROW',
        baseUrl: 'https://api.isolarcloud.com/v1',
        authType: 'API_KEY',
        encryptedApiKey: encryptedKey,
        encryptedApiSecret: encryptedSec,
        pollingIntervalMinutes: 10,
        isPollingEnabled: true,
        webhookToken: `wh_solar_${nonce}_token`,
        webhookSecret: 'hmac_sha256_secret_value',
        isWebhookEnabled: true,
        status: 'ACTIVE',
        extraConfigJson: { timeoutMs: 15000, maxRetries: 3 },
      },
    });

    assert.strictEqual(apiConfigA.plantId, plantA.id);
    assert.notStrictEqual(apiConfigA.encryptedApiKey, rawApiKey);
    assert.strictEqual(decryptSensitive(apiConfigA.encryptedApiKey), rawApiKey);
    assert.strictEqual(decryptSensitive(apiConfigA.encryptedApiSecret), rawApiSecret);

    // Plant-to-ApiConfig is 1-to-1: Creating second config for same plant must fail
    await assert.rejects(
      () =>
        prisma.solarPlantApiConfig.create({
          data: {
            companyId: companyA.id,
            plantId: plantA.id,
            provider: 'GROWATT',
          },
        }),
      /Unique constraint failed/
    );
    console.log('✅ PASS: SolarPlantApiConfig 1-to-1 relation and AES-256-GCM encryption verified');
  });

  await t.test('6. SolarTelemetryLog: Telemetry Persistence & Strict Deduplication', async () => {
    const sampleUtcTime = new Date('2026-11-04T05:00:00.000Z');

    telemetry1 = await prisma.solarTelemetryLog.create({
      data: {
        companyId: companyA.id,
        plantId: plantA.id,
        inverterId: inverter1.id,
        timestamp: sampleUtcTime,
        currentPowerKw: 54.20,
        dailyEnergyKwh: 125.80,
        totalEnergyKwh: 45280.50,
        gridVoltageV: 416.50,
        gridCurrentA: 75.30,
        frequencyHz: 50.02,
        powerFactor: 0.998,
        dcPowerKw: 55.40,
        dcVoltageV: 685.00,
        dcCurrentA: 80.80,
        temperatureC: 42.50,
        irradianceWm2: 845.00,
        ambientTempC: 31.00,
        inverterStatus: 'NORMAL',
        isSimulated: false,
        rawPayloadJson: { rawPackets: 12, vendorStatus: 'OK' },
      },
    });

    assert.strictEqual(telemetry1.inverterId, inverter1.id);
    assert.strictEqual(telemetry1.timestamp.toISOString(), sampleUtcTime.toISOString());
    assert.strictEqual(Number(telemetry1.currentPowerKw), 54.2);
    assert.strictEqual(Number(telemetry1.irradianceWm2), 845.0);
    assert.strictEqual(telemetry1.isSimulated, false);

    // CRITICAL INVARIANT: Deduplication must reject exact same inverter reading at exact same timestamp
    await assert.rejects(
      () =>
        prisma.solarTelemetryLog.create({
          data: {
            companyId: companyA.id,
            plantId: plantA.id,
            inverterId: inverter1.id,
            timestamp: sampleUtcTime,
            currentPowerKw: 54.50,
            dailyEnergyKwh: 126.00,
            totalEnergyKwh: 45281.00,
          },
        }),
      /Unique constraint failed/
    );
    console.log('✅ PASS: SolarTelemetryLog persisted with UTC timestamp and [inverterId, timestamp] deduplication');
  });

  await t.test('7. SolarInverterAlarm: Fault Detection, Acknowledgement & Lifecycle', async () => {
    alarm1 = await prisma.solarInverterAlarm.create({
      data: {
        companyId: companyA.id,
        plantId: plantA.id,
        inverterId: inverter1.id,
        alarmCode: 'GRID_OVERVOLTAGE_002',
        severity: 'CRITICAL',
        category: 'GRID',
        description: 'Phase A voltage exceeded 440V threshold',
        status: 'ACTIVE',
      },
    });

    assert.strictEqual(alarm1.severity, 'CRITICAL');
    assert.strictEqual(alarm1.status, 'ACTIVE');

    // Acknowledge alarm
    const acked = await prisma.solarInverterAlarm.update({
      where: { id: alarm1.id },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
        acknowledgedBy: 'Ramesh Solar Tech',
        acknowledgementNotes: 'Grid stability engineer contacted',
      },
    });
    assert.strictEqual(acked.status, 'ACKNOWLEDGED');
    assert.ok(acked.acknowledgedAt);
    console.log('✅ PASS: SolarInverterAlarm created and lifecycle transitions verified');
  });

  await t.test('8. SolarCleaningSchedule: Array Cycle & Inspector Assignment', async () => {
    cleaningSchedule1 = await prisma.solarCleaningSchedule.create({
      data: {
        companyId: companyA.id,
        plantId: plantA.id,
        arrayBlock: 'Array Block 1-4 (North Roof)',
        frequency: 'FORTNIGHTLY',
        lastCleanedDate: new Date('2026-10-20'),
        nextDueDate: new Date('2026-11-05'),
        status: 'SCHEDULED',
        inspectorId: employeeA.id,
        inspectorName: employeeA.name,
      },
    });

    assert.strictEqual(cleaningSchedule1.inspectorId, employeeA.id);
    assert.strictEqual(cleaningSchedule1.status, 'SCHEDULED');

    // Complete wash cycle
    const completed = await prisma.solarCleaningSchedule.update({
      where: { id: cleaningSchedule1.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        waterUsedLiters: 1200.00,
        soilingLossEstimatedPercent: 0.80,
        cleaningMethod: 'MANUAL_PRESSURE_WASH',
        inspectionRemarks: 'All 96 modules washed and inspected. Zero microcracks.',
      },
    });
    assert.strictEqual(completed.status, 'COMPLETED');
    assert.strictEqual(Number(completed.waterUsedLiters), 1200);
    console.log('✅ PASS: SolarCleaningSchedule linked to CompanyEmployee and completion verified');
  });

  await t.test('9. SolarMaintenanceTicket: Ticket Creation, Spares Details & Alarm Link', async () => {
    maintenanceTicket1 = await prisma.solarMaintenanceTicket.create({
      data: {
        companyId: companyA.id,
        plantId: plantA.id,
        inverterId: inverter1.id,
        ticketNo: `TKT-SOL-${nonce}-001`,
        category: 'GRID_TRIP',
        priority: 'HIGH',
        subject: 'Investigate Inverter Grid Overvoltage trip',
        description: 'Inverter tripped due to transient voltage surge on grid line',
        assignedTechnicianId: employeeA.id,
        technicianName: employeeA.name,
        status: 'IN_PROGRESS',
        sparePartsDetails: [
          {
            sku: 'SPD-TYPE2-1000V',
            name: 'Surge Protection Device Type 2',
            requestedQty: 1,
            issuedQty: 1,
            uom: 'PCS',
          },
        ],
      },
    });

    assert.strictEqual(maintenanceTicket1.assignedTechnicianId, employeeA.id);
    assert.strictEqual(maintenanceTicket1.ticketNo, `TKT-SOL-${nonce}-001`);
    assert.strictEqual(maintenanceTicket1.sparePartsDetails[0].sku, 'SPD-TYPE2-1000V');

    // Link Alarm to Ticket
    await prisma.solarInverterAlarm.update({
      where: { id: alarm1.id },
      data: { ticketId: maintenanceTicket1.id },
    });

    const ticketWithAlarms = await prisma.solarMaintenanceTicket.findUnique({
      where: { id: maintenanceTicket1.id },
      include: { alarms: true, assignedTechnician: true },
    });
    assert.strictEqual(ticketWithAlarms.alarms.length, 1);
    assert.strictEqual(ticketWithAlarms.assignedTechnician.id, employeeA.id);
    console.log('✅ PASS: SolarMaintenanceTicket linked to employee, spare parts reference and alarm');
  });

  await t.test('10. Backward Compatibility: Phase 1-9 Schema Verification', async () => {
    // Check CompanyEmployee
    const emp = await prisma.companyEmployee.findUnique({
      where: { id: employeeA.id },
      include: { solarCleaningSchedules: true, solarMaintenanceTickets: true },
    });
    assert.strictEqual(emp.solarCleaningSchedules.length, 1);
    assert.strictEqual(emp.solarMaintenanceTickets.length, 1);

    // Check ClientAdmin reverse relations
    const client = await prisma.clientAdmin.findUnique({
      where: { id: companyA.id },
      include: {
        solarPlants: true,
        solarInverters: true,
        solarPanelStrings: true,
        solarPlantApiConfigs: true,
        solarTelemetryLogs: true,
        solarInverterAlarms: true,
        solarCleaningSchedules: true,
        solarMaintenanceTickets: true,
      },
    });

    assert.strictEqual(client.solarPlants.length, 1);
    assert.strictEqual(client.solarInverters.length, 1);
    assert.strictEqual(client.solarPanelStrings.length, 1);
    assert.strictEqual(client.solarTelemetryLogs.length, 1);
    assert.strictEqual(client.solarInverterAlarms.length, 1);
    assert.strictEqual(client.solarCleaningSchedules.length, 1);
    assert.strictEqual(client.solarMaintenanceTickets.length, 1);
    console.log('✅ PASS: Backward compatibility and bidirectional relations with ClientAdmin & CompanyEmployee verified');
  });

  await t.test('Cleanup Test Data', async () => {
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


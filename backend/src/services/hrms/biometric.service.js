import prisma from '../../config/prisma.js';
import { auditService } from '../audit.service.js';
import { attendanceService } from './attendance.service.js';

function bioError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export const biometricService = {
  // =========================================================================
  // 1. HARDWARE DEVICE REGISTRY
  // =========================================================================

  async registerDevice(companyId, data, actor = {}) {
    const { deviceName, deviceSerial, deviceModel, ipAddress, port = 4370, location, status = 'ONLINE' } = data;
    if (!deviceName || !deviceSerial) {
      throw bioError('deviceName and deviceSerial are required.');
    }

    const serial = deviceSerial.trim().toUpperCase();
    const existing = await prisma.biometricDevice.findUnique({
      where: { companyId_deviceSerial: { companyId, deviceSerial: serial } },
    });
    if (existing) {
      throw bioError(`Device with serial number "${serial}" is already registered.`, 409);
    }

    const device = await prisma.biometricDevice.create({
      data: {
        companyId,
        deviceName: deviceName.trim(),
        deviceSerial: serial,
        deviceModel: deviceModel ? deviceModel.trim() : null,
        ipAddress: ipAddress ? ipAddress.trim() : null,
        port: Number(port) || 4370,
        location: location ? location.trim() : null,
        status,
        lastPingAt: new Date(),
      },
    });

    await auditService.logAction({
      companyId,
      actor,
      action: 'REGISTER_BIOMETRIC_DEVICE',
      entityType: 'BIOMETRIC_DEVICE',
      entityId: device.id,
      afterState: device,
      reason: `Registered biometric hardware device ${device.deviceName} (${device.deviceSerial})`,
    });

    return device;
  },

  async listDevices(companyId) {
    return prisma.biometricDevice.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async updateDevicePing(companyId, deviceSerial) {
    const device = await prisma.biometricDevice.findFirst({
      where: { companyId, deviceSerial: deviceSerial.toUpperCase() },
    });
    if (!device) throw bioError('Device not found.', 404);

    return prisma.biometricDevice.update({
      where: { id: device.id },
      data: {
        lastPingAt: new Date(),
        status: 'ONLINE',
      },
    });
  },

  // =========================================================================
  // 2. RAW PUNCH INGESTION & DEDUPLICATION (ON-PREM BRIDGE / HTTP PUSH)
  // =========================================================================

  /**
   * Ingest raw punch logs from an authenticated on-premise bridge agent or direct HTTP push
   */
  async ingestPunchLogs(companyId, { deviceSerial, punches = [] }, actor = {}) {
    if (!deviceSerial || !Array.isArray(punches) || punches.length === 0) {
      throw bioError('deviceSerial and a non-empty array of punches are required.');
    }

    const serial = deviceSerial.trim().toUpperCase();
    const device = await prisma.biometricDevice.findUnique({
      where: { companyId_deviceSerial: { companyId, deviceSerial: serial } },
    });
    if (!device) {
      throw bioError(`Biometric device with serial "${serial}" is not registered for this company.`, 404);
    }

    // Update device activity
    await prisma.biometricDevice.update({
      where: { id: device.id },
      data: { lastSyncAt: new Date(), lastPingAt: new Date() },
    });

    let ingestedCount = 0;
    let duplicateCount = 0;

    for (const p of punches) {
      const { biometricUserId, punchTime, punchType = 'CHECK_IN', verificationMode } = p;
      if (!biometricUserId || !punchTime) continue;

      const pTime = new Date(punchTime);
      if (isNaN(pTime.getTime())) continue;

      // Match employeeProfile by biometricUserId (or fallback to employeeCode)
      const profile = await prisma.employeeProfile.findFirst({
        where: {
          companyId,
          OR: [
            { employeeCode: String(biometricUserId).trim() },
            { id: String(biometricUserId).trim() },
          ],
        },
      });

      // Deduplication check: punch within +/- 60 seconds for same device & user
      const windowStart = new Date(pTime.getTime() - 60000);
      const windowEnd = new Date(pTime.getTime() + 60000);

      const existing = await prisma.biometricPunchLog.findFirst({
        where: {
          companyId,
          biometricUserId: String(biometricUserId).trim(),
          punchTime: { gte: windowStart, lte: windowEnd },
        },
      });

      if (existing) {
        duplicateCount++;
        continue;
      }

      await prisma.biometricPunchLog.create({
        data: {
          companyId,
          deviceId: device.id,
          employeeProfileId: profile ? profile.id : null,
          biometricUserId: String(biometricUserId).trim(),
          punchTime: pTime,
          punchType: punchType.toUpperCase(),
          verificationMode: verificationMode || 'FINGERPRINT',
          isProcessed: false,
        },
      });
      ingestedCount++;
    }

    await auditService.logAction({
      companyId,
      actor,
      action: 'INGEST_BIOMETRIC_PUNCHES',
      entityType: 'BIOMETRIC_DEVICE',
      entityId: device.id,
      details: { totalReceived: punches.length, ingestedCount, duplicateCount },
      reason: `Ingested ${ingestedCount} biometric punches (${duplicateCount} duplicates ignored)`,
    });

    return {
      success: true,
      totalReceived: punches.length,
      ingestedCount,
      duplicateCount,
    };
  },

  // =========================================================================
  // 3. PUNCH PROCESSING INTO DAILY ATTENDANCE
  // =========================================================================

  /**
   * Process raw punch logs buffer into DailyAttendance records
   */
  async processUnprocessedPunches(companyId, limit = 500) {
    const rawPunches = await prisma.biometricPunchLog.findMany({
      where: { companyId, isProcessed: false },
      orderBy: { punchTime: 'asc' },
      take: Number(limit),
    });

    if (rawPunches.length === 0) {
      return { processedCount: 0, message: 'No unprocessed punches found.' };
    }

    // Group punches by [employeeProfileId, attendanceDate]
    const grouped = {};
    for (const p of rawPunches) {
      if (!p.employeeProfileId) continue;
      const dateStr = p.punchTime.toISOString().split('T')[0];
      const key = `${p.employeeProfileId}_${dateStr}`;
      if (!grouped[key]) {
        grouped[key] = {
          employeeProfileId: p.employeeProfileId,
          dateStr,
          punches: [],
          rawLogIds: [],
        };
      }
      grouped[key].punches.push(p.punchTime);
      grouped[key].rawLogIds.push(p.id);
    }

    let processedCount = 0;
    const now = new Date();

    for (const key of Object.keys(grouped)) {
      const group = grouped[key];
      const attendanceDate = new Date(`${group.dateStr}T00:00:00.000Z`);
      group.punches.sort((a, b) => a.getTime() - b.getTime());

      const earliestIn = group.punches[0];
      const latestOut = group.punches.length > 1 ? group.punches[group.punches.length - 1] : null;

      const shift = await prisma.shiftPolicy.findFirst({
        where: { companyId, isDefault: true },
      });

      const metrics = attendanceService.calculateAttendanceMetrics(earliestIn, latestOut, shift);

      await prisma.dailyAttendance.upsert({
        where: {
          companyId_employeeProfileId_attendanceDate: {
            companyId,
            employeeProfileId: group.employeeProfileId,
            attendanceDate,
          },
        },
        create: {
          companyId,
          employeeProfileId: group.employeeProfileId,
          attendanceDate,
          shiftId: shift?.id,
          firstInTime: earliestIn,
          lastOutTime: latestOut,
          totalWorkHours: metrics.totalWorkHours,
          breakHours: metrics.breakHours,
          overtimeHours: metrics.overtimeHours,
          lateMinutes: metrics.lateMinutes,
          earlyExitMinutes: metrics.earlyExitMinutes,
          status: metrics.status,
          source: 'BIOMETRIC',
        },
        update: {
          firstInTime: earliestIn,
          lastOutTime: latestOut || undefined,
          totalWorkHours: metrics.totalWorkHours,
          breakHours: metrics.breakHours,
          overtimeHours: metrics.overtimeHours,
          status: metrics.status,
        },
      });

      // Mark raw punches as processed
      await prisma.biometricPunchLog.updateMany({
        where: { id: { in: group.rawLogIds } },
        data: { isProcessed: true, processedAt: now },
      });

      processedCount += group.rawLogIds.length;
    }

    return {
      success: true,
      processedCount,
    };
  },
};

export default biometricService;


import solarAlarmService from '../../services/solar/solarAlarm.service.js';
import solarCleaningService from '../../services/solar/solarCleaning.service.js';
import solarMaintenanceService from '../../services/solar/solarMaintenance.service.js';

function respondError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const solarOperationsController = {
  // =========================================================================
  // 1. ALARMS
  // =========================================================================
  async listAlarms(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const result = await solarAlarmService.listAlarms(companyId, req.query);
      res.json({ success: true, data: result.alarms, pagination: result.pagination });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async raiseAlarm(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const result = await solarAlarmService.raiseAlarm(companyId, req.body, req.user);
      res.status(result.isDuplicate ? 200 : 201).json({
        success: true,
        data: result.alarm,
        isDuplicate: result.isDuplicate,
        message: result.message || 'Alarm raised successfully.',
      });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async acknowledgeAlarm(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const alarm = await solarAlarmService.acknowledgeAlarm(
        companyId,
        req.params.alarmId,
        req.body.notes,
        req.user
      );
      res.json({ success: true, data: alarm, message: 'Alarm acknowledged.' });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async resolveAlarm(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const alarm = await solarAlarmService.resolveAlarm(
        companyId,
        req.params.alarmId,
        req.body.resolutionNotes,
        req.user
      );
      res.json({ success: true, data: alarm, message: 'Alarm resolved successfully.' });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  // =========================================================================
  // 2. CLEANING SCHEDULES
  // =========================================================================
  async listCleaningSchedules(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const result = await solarCleaningService.listCleaningSchedules(companyId, req.query);
      res.json({ success: true, data: result.schedules, pagination: result.pagination });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async createCleaningSchedule(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const schedule = await solarCleaningService.createCleaningSchedule(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: schedule, message: 'Cleaning schedule created.' });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async completeCleaningCycle(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const schedule = await solarCleaningService.completeCleaningCycle(
        companyId,
        req.params.scheduleId,
        req.body,
        req.user
      );
      res.json({ success: true, data: schedule, message: 'Cleaning cycle marked as completed.' });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  // =========================================================================
  // 3. MAINTENANCE TICKETS
  // =========================================================================
  async listTickets(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const result = await solarMaintenanceService.listTickets(companyId, req.query);
      res.json({ success: true, data: result.tickets, pagination: result.pagination });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async getTicketById(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const ticket = await solarMaintenanceService.getTicketById(companyId, req.params.ticketId);
      res.json({ success: true, data: ticket });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async createTicket(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const ticket = await solarMaintenanceService.createTicket(companyId, req.body, req.user);
      res.status(201).json({ success: true, data: ticket, message: 'Maintenance ticket created successfully.' });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  async updateTicket(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const updated = await solarMaintenanceService.updateTicket(
        companyId,
        req.params.ticketId,
        req.body,
        req.user
      );
      res.json({ success: true, data: updated, message: 'Maintenance ticket updated.' });
    } catch (err) {
      respondError(err, res, next);
    }
  },

  // =========================================================================
  // 4. O&M SPARES ISSUE (REUSING PHASE 4 INVENTORY)
  // =========================================================================
  async issueSpares(req, res, next) {
    try {
      const companyId = req.params.companyId || req.user?.companyId;
      const result = await solarMaintenanceService.issueSparesAgainstTicket(
        companyId,
        req.params.ticketId,
        req.body,
        req.user
      );
      res.status(201).json({
        success: true,
        data: result,
        message: `Issued ${result.issuedQuantity} of ${result.sku} against ticket ${result.ticketNo}.`,
      });
    } catch (err) {
      respondError(err, res, next);
    }
  },
};

export default solarOperationsController;


import prisma from '../../config/prisma.js';
import { notificationService } from '../notification.service.js';
import { auditService } from '../audit.service.js';

function coreError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export const communicationService = {
  /**
   * Log an interaction (Phone Call, WhatsApp, Email, Meeting, Visit, Other)
   */
  async createCommunication(companyId, data, currentUser = {}) {
    if (!data.subject?.trim()) {
      throw coreError('Communication subject is required.');
    }
    if (!data.communicationType?.trim()) {
      throw coreError('Communication type is required (e.g. PHONE_CALL, WHATSAPP, EMAIL, MEETING, VISIT).');
    }

    const customerId = data.customerId ? String(data.customerId) : null;
    const leadId = data.leadId ? String(data.leadId) : null;
    const contactId = data.contactId ? String(data.contactId) : null;

    if (!customerId && !leadId) {
      throw coreError('Communication must be linked to either a Customer or a Lead.');
    }

    const employeeId = String(data.employeeId || currentUser.userId || currentUser.id || '');
    const employeeName = data.employeeName || currentUser.name || currentUser.organizationName || 'Sales Representative';

    const communication = await prisma.crmCommunication.create({
      data: {
        companyId,
        customerId,
        leadId,
        contactId,
        communicationType: data.communicationType.trim().toUpperCase(),
        subject: data.subject.trim(),
        notes: data.notes?.trim() || null,
        outcome: data.outcome?.trim() || 'COMPLETED',
        nextFollowUpDate: data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : null,
        employeeId: employeeId || null,
        employeeName,
      },
    });

    // If next follow-up date is provided, automatically generate a follow-up task
    if (data.nextFollowUpDate) {
      try {
        const crmService = await prisma.service.findFirst({
          where: { code: 'crm_sales' },
        });

        if (crmService && employeeId) {
          const dueDate = new Date(data.nextFollowUpDate);
          await prisma.serviceWorkItem.create({
            data: {
              companyId,
              serviceId: crmService.id,
              createdById: employeeId,
              createdByName: employeeName,
              assignedToId: employeeId,
              title: `Follow-up: ${data.subject.trim()}`,
              description: data.notes?.trim() || `Follow-up scheduled from ${data.communicationType}`,
              status: 'TODO',
              priority: 'HIGH',
              entityType: customerId ? 'CUSTOMER' : 'LEAD',
              entityId: customerId || leadId,
              dueDate,
            },
          });

          // Phase 1 Notification
          await notificationService.createNotification({
            companyId,
            recipientId: employeeId,
            category: 'TASK',
            title: `Follow-up Scheduled: ${data.subject.trim()}`,
            message: `Scheduled follow-up on ${dueDate.toLocaleDateString()} for ${employeeName}`,
            entityType: customerId ? 'CUSTOMER' : 'LEAD',
            entityId: customerId || leadId,
          });
        }
      } catch (err) {
        console.error('Error auto-creating follow-up work item:', err.message);
      }
    }

    // Phase 1 Audit Log
    await auditService.logAction({
      companyId,
      actor: currentUser,
      action: 'LOG_COMMUNICATION',
      entityType: 'COMMUNICATION',
      entityId: communication.id,
      afterState: { id: communication.id, subject: communication.subject, type: communication.communicationType },
      reason: 'Logged customer/lead communication interaction',
    });

    return communication;
  },

  /**
   * List communications with pagination and optional customer/lead filter
   */
  async listCommunications(companyId, options = {}) {
    const { customerId, leadId, communicationType, limit = 50, offset = 0 } = options;
    const where = { companyId };

    if (customerId) where.customerId = String(customerId);
    if (leadId) where.leadId = String(leadId);
    if (communicationType && communicationType !== 'ALL') {
      where.communicationType = communicationType;
    }

    const [items, total] = await Promise.all([
      prisma.crmCommunication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(limit) || 50,
        skip: Number(offset) || 0,
        include: {
          customer: {
            select: { id: true, companyName: true, customerCode: true },
          },
        },
      }),
      prisma.crmCommunication.count({ where }),
    ]);

    return { items, total };
  },

  /**
   * Reorder cycle background process:
   * Inspects customer reorder dates and automatically triggers follow-up reminders
   */
  async processReorderCycleReminders(companyId, currentUser = {}) {
    const now = new Date();
    const alertWindow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // within next 7 days

    // Find customers with an active reorder cycle whose expected reorder date is due or approaching
    const customers = await prisma.crmCustomer.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        reorderCycleDays: { gt: 0 },
        expectedReorderDate: { lte: alertWindow },
        reorderReminderStatus: 'PENDING',
      },
    });

    let generatedCount = 0;
    const crmService = await prisma.service.findFirst({
      where: { code: 'crm_sales' },
    });

    for (const cust of customers) {
      const targetSalesperson = cust.assignedTo || 'SALES_TEAM';
      const reorderDateStr = cust.expectedReorderDate ? cust.expectedReorderDate.toLocaleDateString() : 'Due Soon';

      // 1. Create follow-up notification
      await notificationService.createNotification({
        companyId,
        recipientId: 'MANAGERS',
        category: 'ALERT',
        title: `Reorder Cycle Due: ${cust.companyName}`,
        message: `Customer ${cust.companyName} (${cust.customerCode || 'No Code'}) is due for reorder on ${reorderDateStr} (Cycle: ${cust.reorderCycleDays} days).`,
        entityType: 'CUSTOMER',
        entityId: cust.id,
      });

      // 2. Create follow-up task
      if (crmService) {
        let validAssigneeId = null;
        if (cust.assignedTo) {
          const directEmp = await prisma.companyEmployee.findFirst({
            where: { id: cust.assignedTo, companyId },
          });
          if (directEmp) validAssigneeId = directEmp.id;
        }
        if (!validAssigneeId) {
          const defaultEmp = await prisma.companyEmployee.findFirst({
            where: { companyId, status: 'ACTIVE' },
          });
          if (defaultEmp) validAssigneeId = defaultEmp.id;
        }

        if (validAssigneeId) {
          await prisma.serviceWorkItem.create({
            data: {
              companyId,
              serviceId: crmService.id,
              createdById: null,
              createdByName: 'Reorder Reminder Engine',
              assignedToId: validAssigneeId,
              title: `Reorder Outreach: ${cust.companyName}`,
              description: `Contact customer for periodic repeat order replenishment (expected: ${reorderDateStr}).`,
              status: 'TODO',
              priority: 'HIGH',
              entityType: 'CUSTOMER',
              entityId: cust.id,
              dueDate: cust.expectedReorderDate || now,
            },
          });
        }
      }

      // 3. Mark reminder status to prevent duplicate runs
      await prisma.crmCustomer.update({
        where: { id: cust.id },
        data: { reorderReminderStatus: 'REMINDER_SENT' },
      });

      generatedCount++;
    }

    if (generatedCount > 0) {
      await auditService.logAction({
        companyId,
        actor: currentUser,
        action: 'RUN_REORDER_REMINDERS',
        entityType: 'CUSTOMER',
        details: `Processed reorder reminders: generated ${generatedCount} alerts.`,
        reason: 'Automated repeat order replenishment cycle check',
      });
    }

    return { processed: customers.length, generated: generatedCount };
  },
};

export default communicationService;


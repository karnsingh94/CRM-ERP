import prisma from '../../config/prisma.js';
import { notificationService } from '../notification.service.js';
import { auditService } from '../audit.service.js';

function coreError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export const reassignmentService = {
  /**
   * Controlled Sales Portfolio Reassignment:
   * Transfers leads, customer accounts, and pending follow-up tasks to another salesperson
   */
  async reassignSalesRepresentative(companyId, data, currentUser = {}) {
    const { fromEmployeeName, toEmployeeName, toEmployeeId, transferLeads = true, transferCustomers = true, transferTasks = true } = data;

    if (!fromEmployeeName?.trim() || !toEmployeeName?.trim()) {
      throw coreError('Both current representative name and new representative name are required.', 400);
    }

    const fromName = fromEmployeeName.trim();
    const toName = toEmployeeName.trim();

    return prisma.$transaction(async (tx) => {
      let leadsUpdated = 0;
      let customersUpdated = 0;
      let tasksUpdated = 0;

      // 1. Reassign Leads
      if (transferLeads) {
        const leadWhere = { companyId };
        if (Array.isArray(data.leadIds) && data.leadIds.length > 0) {
          leadWhere.id = { in: data.leadIds };
        } else {
          leadWhere.assignedTo = fromName;
          leadWhere.status = { notIn: ['WON', 'LOST'] };
        }
        const leadRes = await tx.lead.updateMany({
          where: leadWhere,
          data: { assignedTo: toName },
        });
        leadsUpdated = leadRes.count;
      }

      // 2. Reassign Customers
      if (transferCustomers) {
        const custWhere = { companyId };
        if (Array.isArray(data.customerIds) && data.customerIds.length > 0) {
          custWhere.id = { in: data.customerIds };
        } else {
          custWhere.assignedTo = fromName;
          custWhere.status = 'ACTIVE';
        }
        const custRes = await tx.crmCustomer.updateMany({
          where: custWhere,
          data: { assignedTo: toName },
        });
        customersUpdated = custRes.count;
      }

      // 3. Reassign Pending Tasks / Follow-ups
      if (transferTasks) {
        const taskRes = await tx.serviceWorkItem.updateMany({
          where: {
            companyId,
            status: { notIn: ['DONE'] },
            OR: [
              { assignedToId: fromName },
              ...(data.fromEmployeeId ? [{ assignedToId: String(data.fromEmployeeId) }] : []),
            ],
          },
          data: {
            assignedToId: toEmployeeId ? String(toEmployeeId) : toName,
          },
        });
        tasksUpdated = taskRes.count;
      }

      // 4. Send Phase 1 notification to the new assignee
      if (toEmployeeId || toName) {
        await notificationService.createNotification({
          companyId,
          recipientId: toEmployeeId || toName,
          category: 'TASK',
          title: `Portfolio Ownership Transferred: ${toName}`,
          message: `Reassigned from ${fromName}: ${leadsUpdated} active lead(s), ${customersUpdated} customer(s), and ${tasksUpdated} follow-up task(s).`,
          entityType: 'CUSTOMER',
        });
      }

      // 5. Phase 1 Audit Log
      await auditService.logAction({
        companyId,
        actor: currentUser,
        action: 'REASSIGN_SALES_PORTFOLIO',
        entityType: 'USER_REASSIGNMENT',
        details: `Transferred portfolio from ${fromName} to ${toName}: ${leadsUpdated} leads, ${customersUpdated} customers, ${tasksUpdated} tasks.`,
        beforeState: { fromRepresentative: fromName },
        afterState: { toRepresentative: toName, leadsUpdated, customersUpdated, tasksUpdated },
        reason: 'Sales representative portfolio reallocation / offboarding',
      });

      return {
        success: true,
        fromRepresentative: fromName,
        toRepresentative: toName,
        leadsTransferred: leadsUpdated,
        customersTransferred: customersUpdated,
        tasksTransferred: tasksUpdated,
        leadsReassigned: leadsUpdated,
        customersReassigned: customersUpdated,
        tasksReassigned: tasksUpdated,
      };
    });
  },
};

export default reassignmentService;


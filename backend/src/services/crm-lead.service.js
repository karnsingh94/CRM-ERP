import prisma from '../config/prisma.js';
import { isUuid } from '../utils/uuid.js';
import { notificationService } from './notification.service.js';
import { auditService } from './audit.service.js';

const LEAD_STATUSES = new Set(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function leadError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeValue(value) {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === '') return null;

  const normalized = String(value).trim().replace(/[,\s₹$]/g, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw leadError('Deal value must be a valid non-negative amount.', 400);
  }
  return normalized;
}

function normalizeLeadInput(data, { partial = false } = {}) {
  const result = {};
  const fields = [
    'name',
    'company',
    'email',
    'phone',
    'source',
    'status',
    'value',
    'requirements',
    'assignedTo',
    'priority',
    'nextFollowUpDate',
    'followUpRemarks',
  ];

  for (const field of fields) {
    if (data[field] === undefined) continue;
    if (field === 'value') {
      result.value = normalizeValue(data.value);
      continue;
    }
    if (field === 'status') {
      const status = String(data.status).trim().toUpperCase();
      if (!LEAD_STATUSES.has(status)) throw leadError('Choose a valid lead status.', 400);
      result.status = status;
      continue;
    }
    if (field === 'priority') {
      result.priority = String(data.priority || 'MEDIUM').trim().toUpperCase();
      continue;
    }
    if (field === 'nextFollowUpDate') {
      result.nextFollowUpDate = data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : null;
      continue;
    }
    if (data[field] !== null && typeof data[field] !== 'string') {
      throw leadError(`${field} must be text.`, 400);
    }
    const value = typeof data[field] === 'string' ? data[field].trim() : '';
    if (
      field === 'company' ||
      field === 'phone' ||
      field === 'requirements' ||
      field === 'assignedTo' ||
      field === 'followUpRemarks'
    ) {
      result[field] = value || null;
    } else if (field === 'source') {
      result.source = value || 'Manual';
    } else {
      result[field] = value;
    }
  }

  if (!partial || result.name !== undefined) {
    if (!result.name || result.name.length > 150) {
      throw leadError('Lead contact name is required and must be at most 150 characters.', 400);
    }
  }
  if (!partial || result.email !== undefined) {
    if (!result.email || result.email.length > 180 || !EMAIL_PATTERN.test(result.email)) {
      throw leadError('A valid email address is required.', 400);
    }
    result.email = result.email.toLowerCase();
  }
  if (result.company?.length > 180) throw leadError('Organization must be at most 180 characters.', 400);
  if (result.phone) {
    let cleanPhone = result.phone.replace(/[\s\-\(\)]/g, '');
    if (cleanPhone.startsWith('+91')) cleanPhone = cleanPhone.slice(3);
    else if (cleanPhone.startsWith('91') && cleanPhone.length === 12) cleanPhone = cleanPhone.slice(2);
    else if (cleanPhone.startsWith('0') && cleanPhone.length === 11) cleanPhone = cleanPhone.slice(1);

    if (cleanPhone.length > 10) {
      throw leadError('Phone number cannot exceed 10 digits.', 400);
    }
    result.phone = cleanPhone;
  }
  if (result.source !== undefined && result.source.length > 100) {
    throw leadError('Lead source must be at most 100 characters.', 400);
  }

  return result;
}

function formatLead(lead) {
  return {
    id: lead.id,
    name: lead.name,
    company: lead.company || '',
    email: lead.email,
    phone: lead.phone || '',
    source: lead.source,
    externalId: lead.externalId || null,
    value: lead.value?.toString() || '',
    requirements: lead.requirements || '',
    assignedTo: lead.assignedTo || '',
    priority: lead.priority || 'MEDIUM',
    nextFollowUpDate: lead.nextFollowUpDate ? lead.nextFollowUpDate.toISOString().slice(0, 10) : null,
    followUpRemarks: lead.followUpRemarks || '',
    convertedAt: lead.convertedAt ? lead.convertedAt.toISOString() : null,
    convertedById: lead.convertedById || null,
    convertedByName: lead.convertedByName || null,
    convertedCustomerId: lead.convertedCustomerId || null,
    status: lead.status,
    date: lead.createdAt.toISOString().slice(0, 10),
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

function parseLeadId(id) {
  if (!isUuid(String(id ?? ''))) throw leadError('Lead ID must be a valid identifier.', 400);
  return String(id).toLowerCase();
}

export const crmLeadService = {
  /**
   * Duplicate lead detection (Phone, Email, Company, GSTIN)
   */
  async checkDuplicates(companyId, { phone, email, companyName, gstin }) {
    const conditions = [];

    if (phone && String(phone).trim()) {
      let cleanPhone = String(phone).replace(/[\s\-\(\)]/g, '');
      if (cleanPhone.startsWith('+91')) cleanPhone = cleanPhone.slice(3);
      else if (cleanPhone.startsWith('91') && cleanPhone.length === 12) cleanPhone = cleanPhone.slice(2);
      else if (cleanPhone.startsWith('0') && cleanPhone.length === 11) cleanPhone = cleanPhone.slice(1);
      if (cleanPhone.length >= 7) {
        conditions.push({ phone: { contains: cleanPhone } });
      }
    }

    if (email && String(email).trim() && EMAIL_PATTERN.test(String(email).trim())) {
      conditions.push({ email: { equals: String(email).trim().toLowerCase() } });
    }

    if (companyName && String(companyName).trim().length >= 3) {
      conditions.push({ company: { contains: String(companyName).trim() } });
    }

    if (conditions.length === 0) {
      return { hasDuplicate: false, matchingLeads: [], matchingCustomers: [] };
    }

    const [matchingLeads, matchingCustomers] = await Promise.all([
      prisma.lead.findMany({
        where: {
          companyId,
          OR: conditions,
        },
        take: 5,
      }),
      prisma.crmCustomer.findMany({
        where: {
          companyId,
          OR: [
            ...(email ? [{ email: { equals: String(email).trim().toLowerCase() } }] : []),
            ...(companyName ? [{ companyName: { contains: String(companyName).trim() } }] : []),
            ...(gstin ? [{ gstin: { equals: String(gstin).trim().toUpperCase() } }] : []),
          ],
        },
        take: 5,
      }),
    ]);

    return {
      hasDuplicate: matchingLeads.length > 0 || matchingCustomers.length > 0,
      matchingLeads: matchingLeads.map(formatLead),
      matchingCustomers,
    };
  },

  async list(companyId) {
    const leads = await prisma.lead.findMany({
      where: { companyId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return leads.map(formatLead);
  },

  async create(companyId, data, currentUser = {}) {
    const leadData = normalizeLeadInput(data);
    const lead = await prisma.lead.create({
      data: { ...leadData, companyId },
    });

    // Notify assigned salesperson if assigned
    if (lead.assignedTo) {
      await notificationService.createNotification({
        companyId,
        recipientId: lead.assignedTo,
        category: 'TASK',
        title: `New Lead Assigned: ${lead.name}`,
        message: `${lead.company || lead.name} from ${lead.source} was assigned to you.`,
        entityType: 'LEAD',
        entityId: lead.id,
      });
    }

    // Phase 1 Audit Log
    await auditService.logAction({
      companyId,
      actor: currentUser,
      action: 'CREATE_LEAD',
      entityType: 'LEAD',
      entityId: lead.id,
      afterState: { id: lead.id, name: lead.name, email: lead.email, source: lead.source },
      reason: 'Captured new CRM lead',
    });

    return formatLead(lead);
  },

  async update(companyId, id, data, currentUser = {}) {
    const leadId = parseLeadId(id);
    const leadData = normalizeLeadInput(data, { partial: true });
    if (Object.keys(leadData).length === 0) throw leadError('Provide at least one lead field to update.', 400);

    const existing = await prisma.lead.findFirst({ where: { id: leadId, companyId } });
    if (!existing) throw leadError('Lead not found for this company.', 404);

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: leadData,
    });

    // If assignedTo changed, notify the new assignee
    if (leadData.assignedTo && leadData.assignedTo !== existing.assignedTo) {
      await notificationService.createNotification({
        companyId,
        recipientId: leadData.assignedTo,
        category: 'TASK',
        title: `Lead Reassigned: ${lead.name}`,
        message: `Lead ${lead.name} (${lead.company || 'Direct'}) was reassigned to you from ${existing.assignedTo || 'Unassigned'}.`,
        entityType: 'LEAD',
        entityId: lead.id,
      });

      await auditService.logAction({
        companyId,
        actor: currentUser,
        action: 'REASSIGN_LEAD',
        entityType: 'LEAD',
        entityId: lead.id,
        beforeState: { assignedTo: existing.assignedTo },
        afterState: { assignedTo: leadData.assignedTo },
        reason: 'Lead ownership transferred',
      });
    }

    return formatLead(lead);
  },

  async remove(companyId, id) {
    const leadId = parseLeadId(id);
    const result = await prisma.lead.deleteMany({ where: { id: leadId, companyId } });
    if (result.count === 0) throw leadError('Lead not found for this company.', 404);
  },

  async convert(companyId, id, data, currentUser = {}) {
    const leadId = parseLeadId(id);
    const existing = await prisma.lead.findFirst({ where: { id: leadId, companyId } });
    if (!existing) throw leadError('Lead not found for this company.', 404);

    const convertingUserId = String(currentUser.userId || currentUser.id || 'system');
    const convertingUserName = currentUser.name || currentUser.organizationName || 'Sales Representative';

    let customer;
    if (data?.existingCustomerId) {
      customer = await prisma.crmCustomer.findFirst({
        where: { id: String(data.existingCustomerId), companyId },
      });
      if (!customer) throw leadError('Selected customer not found.', 404);
    } else {
      const companyName = String(data.companyName || existing.company || existing.name || '').trim();
      if (!companyName) throw leadError('Company / Account name is required to convert lead to customer.', 400);

      const contactPerson = data.contactPerson !== undefined ? String(data.contactPerson).trim() : existing.name;
      const email = data.email !== undefined ? String(data.email).trim() : existing.email;
      const phone = data.phone !== undefined ? String(data.phone).trim() : (existing.phone || null);
      const gstin = data.gstin ? String(data.gstin).trim().toUpperCase() : null;
      const industry = data.industry ? String(data.industry).trim() : 'Technology & IT';
      const requirements = data.requirements !== undefined ? String(data.requirements).trim() : (existing.requirements || null);
      const assignedTo = data.assignedTo !== undefined ? String(data.assignedTo).trim() : (existing.assignedTo || null);
      const customerCode = data.customerCode?.trim() || `CUST-${Math.floor(1000 + Math.random() * 9000)}`;

      // 1. Create Customer
      customer = await prisma.crmCustomer.create({
        data: {
          companyId,
          companyName,
          customerCode,
          contactPerson: contactPerson || null,
          email: email || '',
          phone: phone || null,
          gstin: gstin || null,
          industry: industry || 'Technology & IT',
          requirements: requirements || null,
          assignedTo: assignedTo || null,
          status: 'ACTIVE',
        },
      });

      // 2. Automatically create primary contact for the new customer
      if (contactPerson) {
        await prisma.crmContact.create({
          data: {
            companyId,
            customerId: customer.id,
            name: contactPerson,
            companyName,
            role: 'Primary Contact',
            designation: 'Key Stakeholder',
            email: email || null,
            phone: phone || null,
            isPrimary: true,
            isDecisionMaker: true,
            communicationPreference: 'EMAIL',
          },
        });
      }
    }

    // 3. Update lead status to WON and record conversion audit data
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: 'WON',
        convertedAt: new Date(),
        convertedById: convertingUserId,
        convertedByName: convertingUserName,
        convertedCustomerId: customer.id,
      },
    });

    // 4. Log initial communication record preserving qualification and conversion note
    await prisma.crmCommunication.create({
      data: {
        companyId,
        customerId: customer.id,
        leadId: updatedLead.id,
        communicationType: 'OTHER',
        subject: `Lead Converted: ${existing.name}`,
        notes: `Converted from Lead #${existing.id} (Source: ${existing.source}) by ${convertingUserName}. ${existing.requirements ? `Requirements: ${existing.requirements}` : ''}`,
        outcome: 'WON',
        employeeId: convertingUserId,
        employeeName: convertingUserName,
      },
    });

    // 5. If an opportunity exists or was requested, link to customer
    if (data.opportunityId) {
      await prisma.crmOpportunity.update({
        where: { id: String(data.opportunityId) },
        data: { companyName: customer.companyName, stage: 'QUALIFIED' },
      });
    }

    // 6. Phase 1 Audit Log
    await auditService.logAction({
      companyId,
      actor: currentUser,
      action: 'CONVERT_LEAD',
      entityType: 'LEAD',
      entityId: updatedLead.id,
      afterState: { leadId: updatedLead.id, customerId: customer.id, status: 'WON' },
      reason: `Converted lead into customer ${customer.companyName}`,
    });

    return {
      lead: formatLead(updatedLead),
      customer: {
        id: customer.id,
        companyName: customer.companyName,
        customerCode: customer.customerCode || '',
        contactPerson: customer.contactPerson || '',
        email: customer.email || '',
        phone: customer.phone || '',
        gstin: customer.gstin || '',
        industry: customer.industry || 'Technology & IT',
        requirements: customer.requirements || '',
        assignedTo: customer.assignedTo || '',
        status: customer.status,
        date: customer.createdAt.toISOString().slice(0, 10),
      },
    };
  },
};

export default crmLeadService;

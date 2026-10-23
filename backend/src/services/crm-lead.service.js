import prisma from '../config/prisma.js';
import { isUuid } from '../utils/uuid.js';

const LEAD_STATUSES = new Set(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function leadError(message, statusCode) {
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
  const fields = ['name', 'company', 'email', 'phone', 'source', 'status', 'value'];
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
    if (data[field] !== null && typeof data[field] !== 'string') {
      throw leadError(`${field} must be text.`, 400);
    }
    const value = typeof data[field] === 'string' ? data[field].trim() : '';
    if (field === 'company' || field === 'phone') result[field] = value || null;
    else if (field === 'source') result.source = value || 'Website Inquiry';
    else result[field] = value;
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
  if (result.phone?.length > 40) throw leadError('Phone number must be at most 40 characters.', 400);
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
    value: lead.value?.toString() || '',
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
  async list(companyId) {
    const leads = await prisma.lead.findMany({
      where: { companyId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return leads.map(formatLead);
  },

  async create(companyId, data) {
    const leadData = normalizeLeadInput(data);
    const lead = await prisma.lead.create({
      data: { ...leadData, companyId },
    });
    return formatLead(lead);
  },

  async update(companyId, id, data) {
    const leadId = parseLeadId(id);
    const leadData = normalizeLeadInput(data, { partial: true });
    if (Object.keys(leadData).length === 0) throw leadError('Provide at least one lead field to update.', 400);
    const existing = await prisma.lead.findFirst({ where: { id: leadId, companyId } });
    if (!existing) throw leadError('Lead not found for this company.', 404);
    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: leadData,
    });
    return formatLead(lead);
  },

  async remove(companyId, id) {
    const leadId = parseLeadId(id);
    const result = await prisma.lead.deleteMany({ where: { id: leadId, companyId } });
    if (result.count === 0) throw leadError('Lead not found for this company.', 404);
  },
};

export default crmLeadService;

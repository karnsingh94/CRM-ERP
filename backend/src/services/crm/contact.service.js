import prisma from '../../config/prisma.js';
import { auditService } from '../audit.service.js';

function coreError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export const contactService = {
  async listContacts(companyId, options = {}) {
    const { search, customerId, limit, offset } = options;
    const where = { companyId };

    if (customerId) {
      where.customerId = String(customerId);
    }

    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim() } },
        { companyName: { contains: search.trim() } },
        { email: { contains: search.trim() } },
        { phone: { contains: search.trim() } },
        { designation: { contains: search.trim() } },
        { department: { contains: search.trim() } },
        { role: { contains: search.trim() } },
      ];
    }

    const queryOptions = {
      where,
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
      include: {
        customer: {
          select: { id: true, companyName: true, customerCode: true },
        },
      },
    };

    if (limit && Number(limit) > 0) {
      queryOptions.take = Math.min(Number(limit), 200);
      if (offset && Number(offset) >= 0) {
        queryOptions.skip = Number(offset);
      }
    }

    return prisma.crmContact.findMany(queryOptions);
  },

  async createContact(companyId, data, currentUser = {}) {
    if (!data.name?.trim()) {
      throw coreError('Contact person name is required.');
    }

    const customerId = data.customerId ? String(data.customerId) : null;
    const isPrimary = Boolean(data.isPrimary);

    // If marked as primary, reset previous primary contacts for the same customer
    if (customerId && isPrimary) {
      await prisma.crmContact.updateMany({
        where: { companyId, customerId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.crmContact.create({
      data: {
        companyId,
        customerId,
        name: data.name.trim(),
        companyName: data.companyName?.trim() || null,
        role: data.role?.trim() || null,
        designation: data.designation?.trim() || data.role?.trim() || null,
        department: data.department?.trim() || null,
        stakeholderType: data.stakeholderType?.trim() || 'COMMERCIAL',
        isPrimary,
        isDecisionMaker: data.isDecisionMaker !== undefined ? Boolean(data.isDecisionMaker) : false,
        communicationPreference: data.communicationPreference?.trim() || 'EMAIL',
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        channel: data.channel?.trim() || 'Email',
      },
    });

    await auditService.logAction({
      companyId,
      actor: currentUser,
      action: 'CREATE_CONTACT',
      entityType: 'CONTACT',
      entityId: contact.id,
      afterState: { id: contact.id, name: contact.name, customerId },
      reason: 'Created contact person record',
    });

    return contact;
  },

  async updateContact(companyId, contactId, data, currentUser = {}) {
    const existing = await prisma.crmContact.findFirst({
      where: { id: contactId, companyId },
    });
    if (!existing) throw coreError('Contact not found.', 404);

    const isPrimary = data.isPrimary !== undefined ? Boolean(data.isPrimary) : existing.isPrimary;
    const targetCustomerId = data.customerId !== undefined ? (data.customerId ? String(data.customerId) : null) : existing.customerId;

    if (targetCustomerId && isPrimary && !existing.isPrimary) {
      await prisma.crmContact.updateMany({
        where: { companyId, customerId: targetCustomerId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const updated = await prisma.crmContact.update({
      where: { id: contactId },
      data: {
        customerId: targetCustomerId,
        name: data.name !== undefined ? data.name.trim() : existing.name,
        companyName: data.companyName !== undefined ? data.companyName.trim() : existing.companyName,
        role: data.role !== undefined ? data.role.trim() : existing.role,
        designation: data.designation !== undefined ? data.designation.trim() : existing.designation,
        department: data.department !== undefined ? data.department.trim() : existing.department,
        stakeholderType: data.stakeholderType !== undefined ? data.stakeholderType.trim() : existing.stakeholderType,
        isPrimary,
        isDecisionMaker: data.isDecisionMaker !== undefined ? Boolean(data.isDecisionMaker) : existing.isDecisionMaker,
        communicationPreference: data.communicationPreference !== undefined ? data.communicationPreference.trim() : existing.communicationPreference,
        email: data.email !== undefined ? data.email.trim() : existing.email,
        phone: data.phone !== undefined ? data.phone.trim() : existing.phone,
        channel: data.channel !== undefined ? data.channel.trim() : existing.channel,
      },
    });

    await auditService.logAction({
      companyId,
      actor: currentUser,
      action: 'UPDATE_CONTACT',
      entityType: 'CONTACT',
      entityId: contactId,
      beforeState: existing,
      afterState: updated,
      reason: 'Updated contact person attributes',
    });

    return updated;
  },

  async removeContact(companyId, contactId, currentUser = {}) {
    const existing = await prisma.crmContact.findFirst({
      where: { id: contactId, companyId },
    });
    if (!existing) throw coreError('Contact not found.', 404);

    await prisma.crmContact.delete({ where: { id: contactId } });

    await auditService.logAction({
      companyId,
      actor: currentUser,
      action: 'DELETE_CONTACT',
      entityType: 'CONTACT',
      entityId: contactId,
      beforeState: existing,
      reason: `Deleted contact person: ${existing.name}`,
    });

    return true;
  },
};

export default contactService;

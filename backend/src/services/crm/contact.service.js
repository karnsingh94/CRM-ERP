import prisma from '../../config/prisma.js';

function coreError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export const contactService = {
  async listContacts(companyId, options = {}) {
    const { search, limit, offset } = options;
    const where = { companyId };
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim() } },
        { companyName: { contains: search.trim() } },
        { email: { contains: search.trim() } },
        { phone: { contains: search.trim() } },
        { role: { contains: search.trim() } },
      ];
    }

    const queryOptions = {
      where,
      orderBy: { createdAt: 'desc' },
    };

    if (limit && Number(limit) > 0) {
      queryOptions.take = Math.min(Number(limit), 200);
      if (offset && Number(offset) >= 0) {
        queryOptions.skip = Number(offset);
      }
    }

    return prisma.crmContact.findMany(queryOptions);
  },

  async createContact(companyId, data) {
    if (!data.name?.trim()) {
      throw coreError('Contact person name is required.');
    }
    return prisma.crmContact.create({
      data: {
        companyId,
        name: data.name.trim(),
        companyName: data.companyName?.trim() || null,
        role: data.role?.trim() || null,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        channel: data.channel?.trim() || 'Email',
      },
    });
  },

  async updateContact(companyId, contactId, data) {
    const existing = await prisma.crmContact.findFirst({
      where: { id: contactId, companyId },
    });
    if (!existing) throw coreError('Contact not found.', 404);

    return prisma.crmContact.update({
      where: { id: contactId },
      data: {
        name: data.name !== undefined ? data.name.trim() : existing.name,
        companyName: data.companyName !== undefined ? data.companyName.trim() : existing.companyName,
        role: data.role !== undefined ? data.role.trim() : existing.role,
        email: data.email !== undefined ? data.email.trim() : existing.email,
        phone: data.phone !== undefined ? data.phone.trim() : existing.phone,
        channel: data.channel !== undefined ? data.channel.trim() : existing.channel,
      },
    });
  },

  async removeContact(companyId, contactId) {
    const existing = await prisma.crmContact.findFirst({
      where: { id: contactId, companyId },
    });
    if (!existing) throw coreError('Contact not found.', 404);
    await prisma.crmContact.delete({ where: { id: contactId } });
    return true;
  },
};

export default contactService;

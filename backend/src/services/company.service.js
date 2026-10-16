import prisma from '../config/prisma.js';
import { hashPassword } from '../utils/hash.js';
import { formatClient, clientAccessInclude } from '../utils/formatters.js';
import auditService from './audit.service.js';

/**
 * Service for managing Tenant Companies (Clients) and their dynamic permission trees
 */
export const companyService = {
  /**
   * List all non-deleted client companies with permission trees
   */
  async getClients() {
    const clients = await prisma.clientAdmin.findMany({
      where: { deletedAt: null },
      include: clientAccessInclude,
      orderBy: { id: 'desc' },
    });
    return clients.map(formatClient);
  },

  /**
   * Find single client company by ID
   */
  async getClientById(id) {
    const client = await prisma.clientAdmin.findUnique({
      where: { id: BigInt(id) },
      include: clientAccessInclude,
    });
    if (!client || client.deletedAt) return null;
    return formatClient(client);
  },

  /**
   * Provision a new tenant company with initial permissions
   */
  async createClient(data, meta = {}) {
    const passwordHash = hashPassword(data.password || 'Azzuniqe@2026!');

    return await prisma.$transaction(async (tx) => {
      const client = await tx.clientAdmin.create({
        data: {
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
          mobile: data.mobile || null,
          organizationName: data.organization_name.trim(),
          passwordHash,
          status: data.status || 'ACTIVE',
        },
      });

      // Save initial permissions if provided
      if (data.access && Array.isArray(data.access.services)) {
        await this._saveAccessInternal(tx, client.id, data.access.services);
      }

      await tx.auditLog.create({
        data: {
          action: 'CREATE',
          entityType: 'CLIENT_ADMIN',
          entityId: client.id,
          newValue: JSON.stringify({
            organization: client.organizationName,
            email: client.email,
            status: client.status,
          }),
          reason: `Provisioned client panel for "${client.organizationName}"`,
          ipAddress: meta.ip || '127.0.0.1',
          userAgent: meta.userAgent || null,
        },
      });

      const fullClient = await tx.clientAdmin.findUnique({
        where: { id: client.id },
        include: clientAccessInclude,
      });

      return formatClient(fullClient);
    });
  },

  /**
   * Update client company details and optionally overwrite access tree
   */
  async updateClient(id, data, meta = {}) {
    const existing = await prisma.clientAdmin.findUnique({
      where: { id: BigInt(id) },
    });
    if (!existing || existing.deletedAt) return null;

    return await prisma.$transaction(async (tx) => {
      const updateData = {};
      if (data.name !== undefined) updateData.name = data.name.trim();
      if (data.email !== undefined) updateData.email = data.email.trim().toLowerCase();
      if (data.mobile !== undefined) updateData.mobile = data.mobile;
      if (data.organization_name !== undefined) updateData.organizationName = data.organization_name.trim();
      if (data.status !== undefined) updateData.status = data.status;
      if (data.password && data.password.trim()) {
        updateData.passwordHash = hashPassword(data.password.trim());
      }

      const client = await tx.clientAdmin.update({
        where: { id: BigInt(id) },
        data: updateData,
      });

      // Update access tree if provided
      if (data.access && Array.isArray(data.access.services)) {
        // Clear previous access records
        await tx.clientSubModuleAccess.deleteMany({ where: { clientAdminId: client.id } });
        await tx.clientModuleAccess.deleteMany({ where: { clientAdminId: client.id } });
        await tx.clientServiceAccess.deleteMany({ where: { clientAdminId: client.id } });

        // Save new permissions
        await this._saveAccessInternal(tx, client.id, data.access.services);
      }

      await tx.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'CLIENT_ADMIN',
          entityId: client.id,
          oldValue: JSON.stringify({ organization: existing.organizationName, status: existing.status }),
          newValue: JSON.stringify({ organization: client.organizationName, status: client.status }),
          reason: `Updated details/permissions for "${client.organizationName}"`,
          ipAddress: meta.ip || '127.0.0.1',
          userAgent: meta.userAgent || null,
        },
      });

      const fullClient = await tx.clientAdmin.findUnique({
        where: { id: client.id },
        include: clientAccessInclude,
      });

      return formatClient(fullClient);
    });
  },

  /**
   * Toggle client company active/inactive status
   */
  async toggleClientStatus(id, meta = {}) {
    const existing = await prisma.clientAdmin.findUnique({ where: { id: BigInt(id) } });
    if (!existing || existing.deletedAt) return null;

    const newStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = await prisma.clientAdmin.update({
      where: { id: BigInt(id) },
      data: { status: newStatus },
      include: clientAccessInclude,
    });

    await auditService.logAudit({
      action: 'STATUS_CHANGE',
      entityType: 'CLIENT_ADMIN',
      entityId: updated.id,
      oldValue: existing.status,
      newValue: newStatus,
      reason: `Toggled client panel status for "${updated.organizationName}" to ${newStatus}`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return formatClient(updated);
  },

  /**
   * Soft-delete client company
   */
  async deleteClient(id, meta = {}) {
    const existing = await prisma.clientAdmin.findUnique({ where: { id: BigInt(id) } });
    if (!existing || existing.deletedAt) return false;

    // Soft delete
    await prisma.clientAdmin.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });

    await auditService.logAudit({
      action: 'DELETE',
      entityType: 'CLIENT_ADMIN',
      entityId: existing.id,
      oldValue: JSON.stringify({ organization: existing.organizationName }),
      reason: `Permanently removed client panel for "${existing.organizationName}"`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return true;
  },

  /**
   * Overwrite client permissions transactionally
   */
  async saveClientAccess(clientId, accessData, meta = {}) {
    const client = await prisma.clientAdmin.findUnique({ where: { id: BigInt(clientId) } });
    if (!client || client.deletedAt) return null;

    const services = Array.isArray(accessData?.services) ? accessData.services : [];

    await prisma.$transaction(async (tx) => {
      // 1. Clear existing mappings for this client
      await tx.clientSubModuleAccess.deleteMany({ where: { clientAdminId: client.id } });
      await tx.clientModuleAccess.deleteMany({ where: { clientAdminId: client.id } });
      await tx.clientServiceAccess.deleteMany({ where: { clientAdminId: client.id } });

      // 2. Insert validated new permissions
      await this._saveAccessInternal(tx, client.id, services);

      // 3. Log audit event
      await tx.auditLog.create({
        data: {
          action: 'PERMISSION_UPDATE',
          entityType: 'ACCESS',
          entityId: client.id,
          newValue: JSON.stringify({ serviceCount: services.length }),
          reason: `Updated dynamic access permissions for "${client.organizationName}"`,
          ipAddress: meta.ip || '127.0.0.1',
          userAgent: meta.userAgent || null,
        },
      });
    });

    return await this.getClientById(clientId);
  },

  /**
   * Internal helper for saving client permission tree inside a transaction
   */
  async _saveAccessInternal(tx, clientAdminId, services) {
    for (const s of services) {
      if (!s.service_id) continue;
      const sId = BigInt(s.service_id);
      const isFull = Boolean(s.full_service);

      await tx.clientServiceAccess.create({
        data: {
          clientAdminId,
          serviceId: sId,
          isFullService: isFull,
          isAllowed: true,
        },
      });

      if (!isFull && Array.isArray(s.modules)) {
        for (const m of s.modules) {
          if (!m.module_id) continue;
          const mId = BigInt(m.module_id);
          const accessMode = m.access_mode === 'FULL' ? 'FULL' : 'CUSTOM';

          await tx.clientModuleAccess.create({
            data: {
              clientAdminId,
              serviceId: sId,
              moduleId: mId,
              accessMode,
              isAllowed: true,
            },
          });

          if (accessMode === 'CUSTOM' && Array.isArray(m.sub_module_ids)) {
            for (const smId of m.sub_module_ids) {
              if (!smId) continue;
              await tx.clientSubModuleAccess.create({
                data: {
                  clientAdminId,
                  serviceId: sId,
                  moduleId: mId,
                  subModuleId: BigInt(smId),
                  isAllowed: true,
                },
              });
            }
          }
        }
      }
    }
  },

  /**
   * List services actively assigned to a specific company
   */
  async getCompanyAssignedServices(companyId) {
    const cid = BigInt(companyId);
    const assigned = await prisma.clientServiceAccess.findMany({
      where: {
        clientAdminId: cid,
        isAllowed: true,
      },
      include: {
        service: true,
      },
      orderBy: { service: { orderNo: 'asc' } },
    });

    return assigned.map((sa) => ({
      id: sa.service.id.toString(),
      serviceId: sa.service.id.toString(),
      code: sa.service.code,
      name: sa.service.name,
      description: sa.service.description || '',
      status: sa.service.status,
      isAllowed: sa.isAllowed,
      isFullService: sa.isFullService,
    }));
  },
};

export default companyService;

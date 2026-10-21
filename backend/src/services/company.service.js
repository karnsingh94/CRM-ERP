import prisma from '../config/prisma.js';
import { hashPassword } from '../utils/hash.js';
import { formatClient, clientAccessInclude } from '../utils/formatters.js';
import { signToken } from '../utils/token.js';
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
  async createClient(data, meta = {}, assignedBy = null) {
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
          themeColor: data.themeColor || data.theme_color || '#7f22fe',
        },
      });

      // Save initial permissions if provided
      if (data.access && Array.isArray(data.access.services)) {
        await this._saveAccessInternal(tx, client.id, data.access.services, assignedBy);
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
            themeColor: client.themeColor,
          }),
          reason: `Provisioned client panel for "${client.organizationName}" with theme ${client.themeColor || '#7f22fe'}`,
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
  async updateClient(id, data, meta = {}, assignedBy = null) {
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
      if (data.themeColor !== undefined || data.theme_color !== undefined) {
        updateData.themeColor = data.themeColor || data.theme_color || '#7f22fe';
      }
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
        await this._saveAccessInternal(tx, client.id, data.access.services, assignedBy);
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
  async saveClientAccess(clientId, accessData, meta = {}, assignedBy = null) {
    const client = await prisma.clientAdmin.findUnique({ where: { id: BigInt(clientId) } });
    if (!client || client.deletedAt) return null;

    const services = Array.isArray(accessData?.services) ? accessData.services : [];

    await prisma.$transaction(async (tx) => {
      // 1. Clear existing mappings for this client
      await tx.clientSubModuleAccess.deleteMany({ where: { clientAdminId: client.id } });
      await tx.clientModuleAccess.deleteMany({ where: { clientAdminId: client.id } });
      await tx.clientServiceAccess.deleteMany({ where: { clientAdminId: client.id } });

      // 2. Insert validated new permissions
      await this._saveAccessInternal(tx, client.id, services, assignedBy);

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
  async _saveAccessInternal(tx, clientAdminId, services, assignedBy = null) {
    const assignedById = assignedBy != null && /^\d+$/.test(String(assignedBy))
      ? BigInt(assignedBy)
      : null;
    if (services.length > 0 && assignedById === null) {
      throw Object.assign(new Error('A valid administrator ID is required to assign permissions.'), { statusCode: 401 });
    }

    for (const s of services) {
      const rawServiceId = s.service_id || s.serviceId;
      if (!rawServiceId || !/^\d+$/.test(String(rawServiceId))) {
        throw Object.assign(new Error('Each permission must include a valid service ID.'), { statusCode: 400 });
      }
      const sId = BigInt(rawServiceId);
      const isFull = Boolean(s.full_service);
      const service = await tx.service.findUnique({
        where: { id: sId },
        include: { modules: { include: { subModules: true } } },
      });
      if (!service) {
        throw Object.assign(new Error(`Service ${sId} does not exist.`), { statusCode: 400 });
      }

      await tx.clientServiceAccess.create({
        data: {
          clientAdminId,
          serviceId: sId,
          accessMode: isFull ? 'FULL' : 'CUSTOM',
          isFullService: isFull,
          isAllowed: true,
          assignedBy: assignedById,
        },
      });

      const requestedModules = isFull
        ? service.modules.map((module) => ({ module_id: module.id, access_mode: 'FULL' }))
        : Array.isArray(s.modules)
          ? s.modules
          : [];

      for (const moduleGrant of requestedModules) {
        const rawModuleId = moduleGrant.module_id || moduleGrant.moduleId;
        if (!rawModuleId || !/^\d+$/.test(String(rawModuleId))) {
          throw Object.assign(new Error(`Service ${sId} contains a permission with an invalid module ID.`), { statusCode: 400 });
        }
        const module = service.modules.find((entry) => entry.id === BigInt(rawModuleId));
        if (!module) {
          throw Object.assign(new Error(`Module ${rawModuleId} does not belong to service ${sId}.`), { statusCode: 400 });
        }

        const accessMode = isFull || (moduleGrant.access_mode || moduleGrant.accessMode) === 'FULL'
          ? 'FULL'
          : 'CUSTOM';

        await tx.clientModuleAccess.create({
          data: {
            clientAdminId,
            serviceId: sId,
            moduleId: module.id,
            accessMode,
            isAllowed: true,
            assignedBy: assignedById,
          },
        });

        const requestedSubModuleIds = accessMode === 'FULL'
          ? module.subModules.map((subModule) => subModule.id.toString())
          : Array.isArray(moduleGrant.sub_module_ids)
            ? moduleGrant.sub_module_ids.map(String)
            : [];

        for (const rawSubModuleId of requestedSubModuleIds) {
          if (!/^\d+$/.test(rawSubModuleId)) {
            throw Object.assign(new Error(`Module ${module.id} contains a permission with an invalid sub-module ID.`), { statusCode: 400 });
          }
          const subModule = module.subModules.find((entry) => entry.id === BigInt(rawSubModuleId));
          if (!subModule) {
            throw Object.assign(new Error(`Sub-module ${rawSubModuleId} does not belong to module ${module.id}.`), { statusCode: 400 });
          }

          await tx.clientSubModuleAccess.create({
            data: {
              clientAdminId,
              serviceId: sId,
              moduleId: module.id,
              subModuleId: subModule.id,
              isAllowed: true,
              assignedBy: assignedById,
            },
          });
        }
      }
    }
  },

  /**
   * List services actively assigned to a specific company
   * Enforces global status rule: deactivated services are excluded for tenant clients
   */
  async getCompanyAssignedServices(companyId, includeInactive = false) {
    const cid = BigInt(companyId);
    const client = await prisma.clientAdmin.findUnique({
      where: { id: cid },
      include: clientAccessInclude,
    });
    if (!client || client.deletedAt) return [];

    return formatClient(client).access.services
      .filter((service) => includeInactive || (service.isAllowed && service.status === 'ACTIVE'))
      .map((service) => ({
        id: service.service_id,
        serviceId: service.service_id,
        code: service.code,
        name: service.name,
        description: service.description,
        status: service.status,
        isAllowed: service.isAllowed,
        rawIsAllowed: service.rawIsAllowed,
        isFullService: service.isFullService,
        full_service: service.full_service,
        access_mode: service.access_mode,
        assigned_by: service.assigned_by,
        modules: (includeInactive ? service.all_modules : service.modules).map((module) => ({
          id: module.module_id,
          moduleId: module.module_id,
          code: module.code,
          name: module.name,
          status: module.status,
          isAllowed: module.isAllowed,
          access_mode: module.access_mode,
          assigned_by: module.assigned_by,
          subModules: (module.subModules || []).map((subModule) => ({
            id: subModule.id,
            code: subModule.code,
            name: subModule.name,
            route: subModule.route || '',
            status: subModule.status,
            isAllowed: subModule.isAllowed,
            assigned_by: subModule.assigned_by,
          })),
        })),
      }));
  },

  /**
   * Super Admin switches directly into Client Admin panel (authenticated switch session)
   */
  async switchToClientPanel(clientId, meta = {}) {
    const client = await prisma.clientAdmin.findUnique({
      where: { id: BigInt(clientId) },
      include: clientAccessInclude,
    });
    if (!client || client.deletedAt) {
      const err = new Error('Client account not found');
      err.statusCode = 404;
      throw err;
    }

    const formatted = formatClient(client);
    const userObj = {
      id: client.id.toString(),
      name: client.name,
      email: client.email,
      role: 'COMPANY_ADMIN',
      companyId: client.id.toString(),
      organizationName: client.organizationName,
      themeColor: client.themeColor || '#7f22fe',
      theme_color: client.themeColor || '#7f22fe',
      access: formatted.access,
      isImpersonated: true,
      switchedBySuperAdmin: true,
    };

    const token = signToken({
      userId: userObj.id,
      name: userObj.name,
      email: userObj.email,
      role: 'COMPANY_ADMIN',
      companyId: userObj.companyId,
      organizationName: userObj.organizationName,
      type: 'COMPANY_USER',
      isImpersonated: true,
      switchedBySuperAdmin: true,
    });

    await auditService.logAudit({
      action: 'SWITCH_TO_CLIENT_PANEL',
      entityType: 'CLIENT_ADMIN',
      entityId: client.id,
      reason: `Super Admin switched into panel of "${client.organizationName}" (${client.name})`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return {
      token,
      user: userObj,
      redirectUrl: '/dashboard',
    };
  },
};

export default companyService;

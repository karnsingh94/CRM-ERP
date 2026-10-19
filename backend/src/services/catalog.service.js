import prisma from '../config/prisma.js';
import { formatService, formatModule, formatSubModule } from '../utils/formatters.js';
import auditService from './audit.service.js';
import systemService from './system.service.js';
import companyService from './company.service.js';
import departmentService from './department.service.js';

/**
 * Service Catalogue Store & Domain Logic
 * Handles Services, Main Modules, and Sub-Modules hierarchy
 */
export const catalogService = {
  // ==================== SERVICES ====================
  async getServices(includeInactive = true) {
    const where = includeInactive ? {} : { status: 'ACTIVE' };
    const services = await prisma.service.findMany({
      where,
      include: {
        modules: {
          where: includeInactive ? {} : { status: 'ACTIVE' },
          include: {
            subModules: {
              where: includeInactive ? {} : { status: 'ACTIVE' },
              orderBy: { orderNo: 'asc' },
            },
          },
          orderBy: { orderNo: 'asc' },
        },
      },
      orderBy: { orderNo: 'asc' },
    });
    return services.map(formatService);
  },

  async getServiceById(idOrCode) {
    const isNumeric = /^\d+$/.test(String(idOrCode));
    const whereClause = isNumeric
      ? { id: BigInt(idOrCode) }
      : { code: String(idOrCode).replace(/-/g, '_') };

    const service = await prisma.service.findFirst({
      where: whereClause,
      include: {
        modules: {
          include: {
            subModules: {
              orderBy: { orderNo: 'asc' },
            },
          },
          orderBy: { orderNo: 'asc' },
        },
      },
    });
    return formatService(service);
  },

  async createService(data, meta = {}) {
    const maxOrder = await prisma.service.aggregate({ _max: { orderNo: true } });
    const nextOrder = (maxOrder._max.orderNo || 0) + 1;
    const code = data.code
      ? data.code.trim().toLowerCase().replace(/\s+/g, '_')
      : data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');

    const service = await prisma.service.create({
      data: {
        name: data.name.trim(),
        code,
        description: data.description || '',
        orderNo: Number(data.order_no || nextOrder),
        status: data.status || 'ACTIVE',
      },
      include: {
        modules: {
          include: { subModules: true },
        },
      },
    });

    await auditService.logAudit({
      action: 'CREATE',
      entityType: 'SERVICE',
      entityId: service.id,
      newValue: JSON.stringify({ name: service.name, code: service.code }),
      reason: `Created service: ${service.name}`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return formatService(service);
  },

  async updateService(id, data, meta = {}) {
    const existing = await prisma.service.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return null;

    const updated = await prisma.service.update({
      where: { id: BigInt(id) },
      data: {
        name: data.name !== undefined ? data.name.trim() : existing.name,
        code: data.code !== undefined ? data.code.trim() : existing.code,
        description: data.description !== undefined ? data.description : existing.description,
        orderNo: data.order_no !== undefined ? Number(data.order_no) : existing.orderNo,
        status: data.status !== undefined ? data.status : existing.status,
      },
      include: {
        modules: {
          include: { subModules: true },
        },
      },
    });

    await auditService.logAudit({
      action: 'UPDATE',
      entityType: 'SERVICE',
      entityId: updated.id,
      oldValue: JSON.stringify({ name: existing.name, status: existing.status }),
      newValue: JSON.stringify({ name: updated.name, status: updated.status }),
      reason: `Updated service: ${updated.name}`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return formatService(updated);
  },

  async toggleServiceStatus(id, meta = {}) {
    const existing = await prisma.service.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return null;

    const newStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = await prisma.service.update({
      where: { id: BigInt(id) },
      data: { status: newStatus },
      include: {
        modules: {
          include: { subModules: true },
        },
      },
    });

    await auditService.logAudit({
      action: 'STATUS_CHANGE',
      entityType: 'SERVICE',
      entityId: updated.id,
      oldValue: existing.status,
      newValue: newStatus,
      reason: `Toggled status of service ${updated.name} to ${newStatus}`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return formatService(updated);
  },

  // ==================== MODULES ====================
  async createModule(serviceId, data, meta = {}) {
    const parentService = await prisma.service.findUnique({ where: { id: BigInt(serviceId) } });
    if (!parentService) return null;

    const maxOrder = await prisma.module.aggregate({
      where: { serviceId: BigInt(serviceId) },
      _max: { orderNo: true },
    });
    const nextOrder = (maxOrder._max.orderNo || 0) + 1;
    const code = data.code
      ? data.code.trim().toLowerCase().replace(/\s+/g, '_')
      : data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');

    const module = await prisma.module.create({
      data: {
        serviceId: BigInt(serviceId),
        name: data.name.trim(),
        code,
        description: data.description || '',
        icon: data.icon || 'layers',
        orderNo: Number(data.order_no || nextOrder),
        status: data.status || 'ACTIVE',
      },
      include: {
        subModules: true,
      },
    });

    await auditService.logAudit({
      action: 'CREATE',
      entityType: 'MODULE',
      entityId: module.id,
      newValue: JSON.stringify({ name: module.name, code: module.code, service: parentService.name }),
      reason: `Added module ${module.name} to service ${parentService.name}`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return formatModule(module);
  },

  async updateModule(id, data, meta = {}) {
    const existing = await prisma.module.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return null;

    const updated = await prisma.module.update({
      where: { id: BigInt(id) },
      data: {
        name: data.name !== undefined ? data.name.trim() : existing.name,
        code: data.code !== undefined ? data.code.trim() : existing.code,
        description: data.description !== undefined ? data.description : existing.description,
        icon: data.icon !== undefined ? data.icon : existing.icon,
        orderNo: data.order_no !== undefined ? Number(data.order_no) : existing.orderNo,
        status: data.status !== undefined ? data.status : existing.status,
      },
      include: {
        subModules: true,
      },
    });

    await auditService.logAudit({
      action: 'UPDATE',
      entityType: 'MODULE',
      entityId: updated.id,
      oldValue: JSON.stringify({ name: existing.name, status: existing.status }),
      newValue: JSON.stringify({ name: updated.name, status: updated.status }),
      reason: `Updated module: ${updated.name}`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return formatModule(updated);
  },

  async toggleModuleStatus(id, meta = {}) {
    const existing = await prisma.module.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return null;

    const newStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = await prisma.module.update({
      where: { id: BigInt(id) },
      data: { status: newStatus },
      include: {
        subModules: true,
      },
    });

    await auditService.logAudit({
      action: 'STATUS_CHANGE',
      entityType: 'MODULE',
      entityId: updated.id,
      oldValue: existing.status,
      newValue: newStatus,
      reason: `Toggled status of module ${updated.name} to ${newStatus}`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return formatModule(updated);
  },

  // ==================== SUB-MODULES ====================
  async createSubModule(moduleId, data, meta = {}) {
    const parentModule = await prisma.module.findUnique({
      where: { id: BigInt(moduleId) },
      include: { service: true },
    });
    if (!parentModule) return null;

    const maxOrder = await prisma.subModule.aggregate({
      where: { moduleId: BigInt(moduleId) },
      _max: { orderNo: true },
    });
    const nextOrder = (maxOrder._max.orderNo || 0) + 1;
    const code = data.code
      ? data.code.trim().toLowerCase().replace(/\s+/g, '_')
      : data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');

    const subModule = await prisma.subModule.create({
      data: {
        moduleId: BigInt(moduleId),
        serviceId: parentModule.serviceId,
        name: data.name.trim(),
        code,
        route: data.route || '',
        orderNo: Number(data.order_no || nextOrder),
        status: data.status || 'ACTIVE',
      },
    });

    await auditService.logAudit({
      action: 'CREATE',
      entityType: 'SUB_MODULE',
      entityId: subModule.id,
      newValue: JSON.stringify({ name: subModule.name, code: subModule.code, module: parentModule.name }),
      reason: `Added sub-module ${subModule.name} to module ${parentModule.name}`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return formatSubModule(subModule);
  },

  async updateSubModule(id, data, meta = {}) {
    const existing = await prisma.subModule.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return null;

    const updated = await prisma.subModule.update({
      where: { id: BigInt(id) },
      data: {
        name: data.name !== undefined ? data.name.trim() : existing.name,
        code: data.code !== undefined ? data.code.trim() : existing.code,
        route: data.route !== undefined ? data.route : existing.route,
        orderNo: data.order_no !== undefined ? Number(data.order_no) : existing.orderNo,
        status: data.status !== undefined ? data.status : existing.status,
      },
    });

    await auditService.logAudit({
      action: 'UPDATE',
      entityType: 'SUB_MODULE',
      entityId: updated.id,
      oldValue: JSON.stringify({ name: existing.name, status: existing.status }),
      newValue: JSON.stringify({ name: updated.name, status: updated.status }),
      reason: `Updated sub-module: ${updated.name}`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return formatSubModule(updated);
  },

  async toggleSubModuleStatus(id, meta = {}) {
    const existing = await prisma.subModule.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return null;

    const newStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = await prisma.subModule.update({
      where: { id: BigInt(id) },
      data: { status: newStatus },
    });

    await auditService.logAudit({
      action: 'STATUS_CHANGE',
      entityType: 'SUB_MODULE',
      entityId: updated.id,
      oldValue: existing.status,
      newValue: newStatus,
      reason: `Toggled status of sub-module ${updated.name} to ${newStatus}`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return formatSubModule(updated);
  },
};

/**
 * Complete CatalogStore facade for 100% backward compatibility
 */
export const CatalogStore = {
  ...catalogService,

  // System & Stats
  getStats: () => systemService.getStats(),
  getFullCatalog: () => systemService.getFullCatalog(),

  // Clients & Permission Access
  getClients: () => companyService.getClients(),
  getClientById: (id) => companyService.getClientById(id),
  createClient: (data, meta) => companyService.createClient(data, meta),
  updateClient: (id, data, meta) => companyService.updateClient(id, data, meta),
  toggleClientStatus: (id, meta) => companyService.toggleClientStatus(id, meta),
  deleteClient: (id, meta) => companyService.deleteClient(id, meta),
  saveClientAccess: (clientId, accessData, meta) => companyService.saveClientAccess(clientId, accessData, meta),
  _saveAccessInternal: (tx, clientAdminId, services) => companyService._saveAccessInternal(tx, clientAdminId, services),
  getCompanyAssignedServices: (companyId) => companyService.getCompanyAssignedServices(companyId),

  // Employees & Departments
  getCompanyEmployees: (companyId) => departmentService.getCompanyEmployees(companyId),
  createCompanyEmployee: (companyId, data, meta) => departmentService.createCompanyEmployee(companyId, data, meta),
  getDepartmentsByService: (companyId, serviceCodeOrId) => departmentService.getDepartmentsByService(companyId, serviceCodeOrId),
  getAllDepartmentsForCompany: (companyId) => departmentService.getAllDepartmentsForCompany(companyId),
  createDepartment: (companyId, serviceCodeOrId, data, meta) => departmentService.createDepartment(companyId, serviceCodeOrId, data, meta),
  updateDepartment: (companyId, departmentId, data, meta) => departmentService.updateDepartment(companyId, departmentId, data, meta),
  deleteDepartment: (companyId, departmentId, meta) => departmentService.deleteDepartment(companyId, departmentId, meta),
  assignDepartmentEmployees: (companyId, departmentId, employeeIds, meta) => departmentService.assignDepartmentEmployees(companyId, departmentId, employeeIds, meta),

  // Audit Logs
  getAuditLogs: (limit) => auditService.getAuditLogs(limit),
  logAudit: (params) => auditService.logAudit(params),
};

export default CatalogStore;

import prisma from '../config/prisma.js';
import { formatService, formatServicesInDisplayOrder, formatModule, formatSubModule } from '../utils/formatters.js';
import auditService from './audit.service.js';
import systemService from './system.service.js';
import companyService from './company.service.js';
import departmentService from './department.service.js';

const requestedOrder = (value, nextOrder) => {
  const order = Number(value);
  return Number.isInteger(order) && order > 0 ? order : nextOrder;
};

const slugifyCode = (value) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item';

const moduleRouteRoots = {
  crm: '/crm',
  product: '/products',
  sales: '/sales',
  vendor: '/vendors',
  procurement: '/procurement',
  grn: '/grn',
  inventory_mgmt: '/inventory',
  gate_pass: '/gate-pass',
  bom: '/bom',
  production: '/production',
  dispatch: '/dispatch',
  returns: '/returns',
  accounts_banking: '/accounts',
  permission_controls: '/team',
};

const subModuleRouteSuffixes = {
  'product:product_list': '',
  'product:price_list': '/pricing',
  'sales:proforma_invoice': '/proforma',
  'sales:sales_orders': '/orders',
  'vendor:vendor_master': '',
  'vendor:vendor_eval': '/evaluation',
  'procurement:purchase_requests': '/requests',
  'procurement:purchase_orders': '/orders',
  'grn:grn_list': '',
  'grn:quality_inspection': '/inspection',
  'inventory_mgmt:stock_summary': '',
  'inventory_mgmt:warehouse_locations': '/warehouses',
  'inventory_mgmt:stock_adjustments': '/adjustments',
  'gate_pass:inward_pass': '/inward',
  'gate_pass:outward_pass': '/outward',
  'gate_pass:returnable_tracking': '/returnable',
  'bom:bom_list': '',
  'dispatch:dispatch_orders': '',
  'dispatch:packing_slips': '/challans',
  'returns:sales_returns': '',
  'returns:credit_notes': '/restock',
  'accounts_banking:receivables_payables': '/ledger',
  'permission_controls:team_users': '',
  'permission_controls:role_assignment': '/roles',
  'permission_controls:audit_trail': '/audit',
};

const SEEDED_SERVICE_CODES = new Set([
  'crm_sales',
  'purchase_vendor',
  'inventory_warehouse',
  'manufacturing_production',
  'dispatch_returns',
  'accounts_banking',
  'permission_controls',
]);

const SEEDED_SERVICE_ORDER = [
  'crm_sales',
  'purchase_vendor',
  'inventory_warehouse',
  'manufacturing_production',
  'dispatch_returns',
  'accounts_banking',
  'permission_controls',
];

const normalizeServiceOrders = async (tx) => {
  const services = await tx.service.findMany({
    select: { id: true, code: true, orderNo: true },
    orderBy: [{ orderNo: 'asc' }, { id: 'asc' }],
  });
  services.sort((left, right) => {
    const leftSeedOrder = SEEDED_SERVICE_ORDER.indexOf(left.code);
    const rightSeedOrder = SEEDED_SERVICE_ORDER.indexOf(right.code);
    if (leftSeedOrder !== -1 && rightSeedOrder !== -1) return leftSeedOrder - rightSeedOrder;
    if (leftSeedOrder !== -1) return -1;
    if (rightSeedOrder !== -1) return 1;
    return left.orderNo - right.orderNo || Number(left.id - right.id);
  });

  for (const [index, service] of services.entries()) {
    const orderNo = index + 1;
    if (service.orderNo !== orderNo) {
      await tx.service.update({ where: { id: service.id }, data: { orderNo } });
    }
  }
  return services;
};

const buildSubModuleRoute = (module, code) => {
  const root = moduleRouteRoots[module.code] || `/${module.code}`;
  const suffix = subModuleRouteSuffixes[`${module.code}:${code}`];
  return `${root}${suffix !== undefined ? suffix : `/${code}`}`;
};

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
    return formatServicesInDisplayOrder(services);
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
    const code = data.code ? slugifyCode(data.code) : slugifyCode(data.name);
    const service = await prisma.$transaction(async (tx) => {
      const existingServices = await normalizeServiceOrders(tx);
      const nextOrder = existingServices.length + 1;
      const orderNo = Math.min(
        nextOrder,
        Math.max(SEEDED_SERVICE_ORDER.length + 1, requestedOrder(data.order_no, nextOrder))
      );

      await tx.service.updateMany({
        where: {
          code: { notIn: [...SEEDED_SERVICE_CODES] },
          orderNo: { gte: orderNo },
        },
        data: { orderNo: { increment: 1 } },
      });

      return tx.service.create({
        data: {
          name: data.name.trim(),
          code,
          description: data.description || '',
          orderNo,
          status: data.status || 'ACTIVE',
        },
        include: {
          modules: {
            include: { subModules: true },
          },
        },
      });
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

  async deleteService(id, meta = {}) {
    const existing = await prisma.service.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return null;
    if (SEEDED_SERVICE_CODES.has(existing.code)) return false;

    await prisma.$transaction(async (tx) => {
      await tx.service.delete({ where: { id: BigInt(id) } });
      await normalizeServiceOrders(tx);
    });

    await auditService.logAudit({
      action: 'DELETE',
      entityType: 'SERVICE',
      entityId: existing.id,
      oldValue: JSON.stringify({ name: existing.name, code: existing.code }),
      reason: `Deleted service: ${existing.name}`,
      ipAddress: meta.ip || '127.0.0.1',
      userAgent: meta.userAgent || null,
    });

    return true;
  },

  // ==================== MODULES ====================
  async createModule(serviceId, data, meta = {}) {
    const parentService = await prisma.service.findUnique({ where: { id: BigInt(serviceId) } });
    if (!parentService) return null;

    const code = data.code ? slugifyCode(data.code) : slugifyCode(data.name);
    const module = await prisma.$transaction(async (tx) => {
      const maxOrder = await tx.module.aggregate({
        where: { serviceId: BigInt(serviceId) },
        _max: { orderNo: true },
      });
      const nextOrder = (maxOrder._max.orderNo || 0) + 1;
      const orderNo = requestedOrder(data.order_no, nextOrder);

      await tx.module.updateMany({
        where: { serviceId: BigInt(serviceId), orderNo: { gte: orderNo } },
        data: { orderNo: { increment: 1 } },
      });

      return tx.module.create({
        data: {
          serviceId: BigInt(serviceId),
          name: data.name.trim(),
          code,
          description: data.description || '',
          icon: data.icon || 'layers',
          orderNo,
          status: data.status || 'ACTIVE',
        },
        include: {
          subModules: true,
        },
      });
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

    const code = data.code ? slugifyCode(data.code) : slugifyCode(data.name);
    const subModule = await prisma.$transaction(async (tx) => {
      const maxOrder = await tx.subModule.aggregate({
        where: { moduleId: BigInt(moduleId) },
        _max: { orderNo: true },
      });
      const nextOrder = (maxOrder._max.orderNo || 0) + 1;
      const orderNo = requestedOrder(data.order_no, nextOrder);

      await tx.subModule.updateMany({
        where: { moduleId: BigInt(moduleId), orderNo: { gte: orderNo } },
        data: { orderNo: { increment: 1 } },
      });

      return tx.subModule.create({
        data: {
          moduleId: BigInt(moduleId),
          serviceId: parentModule.serviceId,
          name: data.name.trim(),
          code,
          route: buildSubModuleRoute(parentModule, code),
          orderNo,
          status: data.status || 'ACTIVE',
        },
      });
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

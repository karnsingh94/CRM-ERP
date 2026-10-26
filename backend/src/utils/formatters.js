import { normalizeTeamPermissions } from './team-permissions.js';

/**
 * Data transformation and formatting utilities for AZZUNIQE CRM & ERP.
 * Ensures consistent, backward-compatible API payloads across frontends and tests.
 */

// Default include object for complete client access tree
export const clientAccessInclude = {
  serviceAccess: {
    include: {
      service: {
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
      },
    },
  },
  moduleAccess: {
    include: {
      module: true,
    },
  },
  subModuleAccess: {
    include: {
      subModule: true,
    },
  },
};

const SEEDED_SERVICE_ORDER = new Map([
  ['crm_sales', 1],
  ['purchase_vendor', 2],
  ['inventory_warehouse', 3],
  ['manufacturing_production', 4],
  ['dispatch_returns', 5],
  ['accounts_banking', 6],
  ['permission_controls', 7],
]);

export function formatServicesInDisplayOrder(services) {
  return [...services]
    .sort((left, right) => {
      const leftSeedOrder = SEEDED_SERVICE_ORDER.get(left.code);
      const rightSeedOrder = SEEDED_SERVICE_ORDER.get(right.code);
      if (leftSeedOrder && rightSeedOrder) return leftSeedOrder - rightSeedOrder;
      if (leftSeedOrder) return -1;
      if (rightSeedOrder) return 1;
      return left.orderNo - right.orderNo || left.id.localeCompare(right.id);
    })
    .map((service, index) => ({
      ...formatService(service),
      order_no: index + 1,
      orderNo: index + 1,
    }));
}

/**
 * Format Sub-Module record
 */
export function formatSubModule(sm) {
  if (!sm) return null;
  return {
    id: sm.id.toString(),
    module_id: sm.moduleId.toString(),
    moduleId: sm.moduleId.toString(),
    service_id: sm.serviceId.toString(),
    serviceId: sm.serviceId.toString(),
    name: sm.name,
    code: sm.code,
    route: sm.route || '',
    status: sm.status,
    order_no: sm.orderNo,
    orderNo: sm.orderNo,
    created_at: sm.createdAt,
    updated_at: sm.updatedAt,
  };
}

/**
 * Format Module record
 */
export function formatModule(m) {
  if (!m) return null;
  return {
    id: m.id.toString(),
    service_id: m.serviceId.toString(),
    serviceId: m.serviceId.toString(),
    name: m.name,
    code: m.code,
    icon: m.icon || 'layers',
    description: m.description || '',
    status: m.status,
    order_no: m.orderNo,
    orderNo: m.orderNo,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
    sub_modules: (m.subModules || []).map(formatSubModule),
    subModules: (m.subModules || []).map(formatSubModule),
  };
}

/**
 * Format Service record
 */
export function formatService(s) {
  if (!s) return null;
  return {
    id: s.id.toString(),
    name: s.name,
    code: s.code,
    description: s.description || '',
    status: s.status,
    order_no: s.orderNo,
    orderNo: s.orderNo,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    modules: (s.modules || []).map(formatModule),
  };
}

/**
 * Format Employee record
 */
export function formatEmployee(e) {
  if (!e) return null;
  const service = e.team?.service || e.department?.service || null;
  return {
    id: e.id.toString(),
    company_id: e.companyId.toString(),
    companyId: e.companyId.toString(),
    department_id: e.departmentId ? e.departmentId.toString() : null,
    departmentId: e.departmentId ? e.departmentId.toString() : null,
    team_id: e.teamId ? e.teamId.toString() : null,
    teamId: e.teamId ? e.teamId.toString() : null,
    serviceId: service?.id ? service.id.toString() : null,
    serviceCode: service?.code || null,
    serviceName: service?.name || e.department?.name || null,
    departmentName: e.team?.name || e.team?.service?.name || e.department?.name || null,
    name: e.name,
    email: e.email,
    phone: e.phone || null,
    role: e.role,
    accessRole:
      e.accessRole === 'DEPARTMENT_HEAD' || e.accessRole === 'SERVICE_HEAD'
        ? 'DEPARTMENT_HEAD'
        : e.team?.headEmployeeId === e.id || e.accessRole === 'TEAM_LEADER'
          ? 'TEAM_LEADER'
          : e.accessRole || 'EMPLOYEE',
    created_by_employee_id: e.permissions?.memberOwnerId ? String(e.permissions.memberOwnerId) : null,
    createdByEmployeeId: e.permissions?.memberOwnerId ? String(e.permissions.memberOwnerId) : null,
    permissions: normalizeTeamPermissions(e.permissions),
    status: e.status,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  };
}

/**
 * Format Department record
 */
export function formatDepartment(d) {
  if (!d) return null;
  return {
    id: d.id.toString(),
    company_id: d.companyId.toString(),
    companyId: d.companyId.toString(),
    service_id: d.serviceId.toString(),
    serviceId: d.serviceId.toString(),
    serviceCode: d.service?.code || '',
    serviceName: d.service?.name || '',
    name: d.name,
    code: d.code,
    description: d.description || '',
    head_id: d.headId ? d.headId.toString() : null,
    headId: d.headId ? d.headId.toString() : null,
    head: d.head
      ? {
          id: d.head.id.toString(),
          name: d.head.name,
          email: d.head.email,
          role: d.head.role,
          status: d.head.status,
        }
      : null,
    status: d.status,
    employeeCount: d._count?.employees !== undefined ? d._count.employees : d.employees?.length || 0,
    employees: (d.employees || []).map(formatEmployee),
    created_at: d.createdAt,
    updated_at: d.updatedAt,
  };
}

/**
 * Format Client / Tenant record with permission tree
 * Enforces the global hierarchy rule:
 * Effective availability = Item is ACTIVE && all required parents are ACTIVE && company assignment is valid.
 * Preserves raw assignment data for management while providing effective availability.
 */
export function formatClient(c) {
  if (!c) return null;
  const servicesAccess = (c.serviceAccess || []).map((sa) => {
    const sId = sa.serviceId.toString();
    const service = sa.service;
    const isServiceActive = service ? service.status === 'ACTIVE' : true;
    const serviceStatus = service?.status || 'ACTIVE';
    const isServiceAllowed = Boolean(sa.isAllowed !== false && isServiceActive);
    const modAccesses = (c.moduleAccess || []).filter((ma) => ma.serviceId.toString() === sId);
    const isFullService = Boolean(sa.isFullService);

    let formattedModules = [];

    if (isFullService && service?.modules && service.modules.length > 0) {
      // Under full service grant, modules and submodules are derived from the service's catalog
      formattedModules = service.modules.map((m) => {
        const mId = m.id.toString();
        const moduleAccess = modAccesses.find((entry) => entry.moduleId.toString() === mId);
        const isModuleActive = isServiceActive && m.status === 'ACTIVE';
        const subModules = (m.subModules || []).map((sm) => {
          const subModuleAccess = (c.subModuleAccess || []).find(
            (entry) => entry.moduleId.toString() === mId && entry.subModuleId.toString() === sm.id.toString()
          );
          const isSubActive = isModuleActive && sm.status === 'ACTIVE';
          return {
            id: sm.id.toString(),
            code: sm.code || '',
            name: sm.name || '',
            route: sm.route || '',
            status: sm.status || 'ACTIVE',
            isAllowed: isSubActive,
            rawIsAllowed: true,
            assigned_by: subModuleAccess?.assignedBy?.toString() || null,
          };
        });

        return {
          module_id: mId,
          moduleId: mId,
          code: m.code || '',
          name: m.name || '',
          status: m.status || 'ACTIVE',
          access_mode: 'FULL',
          accessMode: 'FULL',
          isAllowed: isModuleActive,
          rawIsAllowed: true,
          assigned_by: moduleAccess?.assignedBy?.toString() || null,
          sub_module_ids: subModules.filter((sm) => sm.isAllowed).map((sm) => sm.id),
          subModules,
        };
      });
    } else {
      // Custom module access mappings
      formattedModules = modAccesses.map((ma) => {
        const mId = ma.moduleId.toString();
        const isModuleActive = isServiceActive && (ma.module ? ma.module.status === 'ACTIVE' : true);
        const subAccesses = (c.subModuleAccess || []).filter(
          (sma) => sma.serviceId.toString() === sId && sma.moduleId.toString() === mId
        );
        const subModules = subAccesses.map((sma) => {
          const isSubActive = isModuleActive && (sma.subModule ? sma.subModule.status === 'ACTIVE' : true);
          return {
            id: sma.subModuleId.toString(),
            code: sma.subModule?.code || '',
            name: sma.subModule?.name || '',
            route: sma.subModule?.route || '',
            status: sma.subModule?.status || 'ACTIVE',
            isAllowed: Boolean(sma.isAllowed !== false && isSubActive),
            rawIsAllowed: sma.isAllowed !== false,
            assigned_by: sma.assignedBy?.toString() || null,
          };
        });

        return {
          module_id: mId,
          moduleId: mId,
          code: ma.module?.code || '',
          name: ma.module?.name || '',
          status: ma.module?.status || 'ACTIVE',
          access_mode: ma.accessMode,
          accessMode: ma.accessMode,
          isAllowed: Boolean(ma.isAllowed !== false && isModuleActive),
          rawIsAllowed: ma.isAllowed !== false,
          assigned_by: ma.assignedBy?.toString() || null,
          sub_module_ids: subAccesses.map((sma) => sma.subModuleId.toString()),
          subModules,
        };
      });
    }

    // Section 3 Requirement: Exclude modules & submodules whose global status is INACTIVE from active client availability
    const activeFormattedModules = formattedModules
      .filter((m) => m.status === 'ACTIVE')
      .map((m) => ({
        ...m,
        sub_modules: (m.subModules || []).filter((sm) => sm.isAllowed && sm.status === 'ACTIVE'),
        subModules: (m.subModules || []).filter((sm) => sm.isAllowed && sm.status === 'ACTIVE'),
      }));

    return {
      service_id: sId,
      serviceId: sId,
      code: service?.code || '',
      name: service?.name || '',
      description: service?.description || '',
      status: serviceStatus,
      full_service: isFullService,
      isFullService: isFullService,
      access_mode: sa.accessMode || (isFullService ? 'FULL' : 'CUSTOM'),
      accessMode: sa.accessMode || (isFullService ? 'FULL' : 'CUSTOM'),
      isAllowed: isServiceAllowed,
      rawIsAllowed: sa.isAllowed !== false,
      assigned_by: sa.assignedBy?.toString() || null,
      modules: activeFormattedModules,
      all_modules: formattedModules,
      allModules: formattedModules,
    };
  });

  return {
    id: c.id.toString(),
    name: c.name,
    email: c.email,
    mobile: c.mobile || '',
    organization_name: c.organizationName,
    organizationName: c.organizationName,
    status: c.status,
    theme_color: c.themeColor || '#7f22fe',
    themeColor: c.themeColor || '#7f22fe',
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    access: {
      services: servicesAccess,
    },
  };
}

export default {
  clientAccessInclude,
  formatSubModule,
  formatModule,
  formatService,
  formatEmployee,
  formatDepartment,
  formatClient,
};

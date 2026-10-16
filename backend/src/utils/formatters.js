/**
 * Data transformation and formatting utilities for AZZUNIQE CRM & ERP.
 * Ensures consistent, backward-compatible API payloads across frontends and tests.
 */

// Default include object for complete client access tree
export const clientAccessInclude = {
  serviceAccess: {
    include: {
      service: true,
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
  return {
    id: e.id.toString(),
    company_id: e.companyId.toString(),
    companyId: e.companyId.toString(),
    department_id: e.departmentId ? e.departmentId.toString() : null,
    departmentId: e.departmentId ? e.departmentId.toString() : null,
    departmentName: e.department?.name || null,
    name: e.name,
    email: e.email,
    role: e.role,
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
 */
export function formatClient(c) {
  if (!c) return null;
  const servicesAccess = (c.serviceAccess || []).map((sa) => {
    const sId = sa.serviceId.toString();
    const modAccesses = (c.moduleAccess || []).filter((ma) => ma.serviceId.toString() === sId);
    return {
      service_id: sId,
      serviceId: sId,
      code: sa.service?.code || '',
      name: sa.service?.name || '',
      full_service: sa.isFullService,
      isFullService: sa.isFullService,
      isAllowed: sa.isAllowed !== undefined ? sa.isAllowed : true,
      modules: modAccesses.map((ma) => {
        const mId = ma.moduleId.toString();
        const subAccesses = (c.subModuleAccess || []).filter(
          (sma) => sma.serviceId.toString() === sId && sma.moduleId.toString() === mId
        );
        return {
          module_id: mId,
          moduleId: mId,
          code: ma.module?.code || '',
          name: ma.module?.name || '',
          access_mode: ma.accessMode,
          accessMode: ma.accessMode,
          isAllowed: ma.isAllowed !== undefined ? ma.isAllowed : true,
          sub_module_ids: subAccesses.map((sma) => sma.subModuleId.toString()),
          subModules: subAccesses.map((sma) => ({
            id: sma.subModuleId.toString(),
            code: sma.subModule?.code || '',
            name: sma.subModule?.name || '',
            route: sma.subModule?.route || '',
            isAllowed: sma.isAllowed !== undefined ? sma.isAllowed : true,
          })),
        };
      }),
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

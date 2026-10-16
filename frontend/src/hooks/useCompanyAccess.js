'use client';

import { useMemo } from 'react';
import { CORE_SERVICES } from '../constants/services';

/**
 * useCompanyAccess Hook
 * Dynamically resolves permitted services, modules, and sub-modules
 * from the company's real database access assignments.
 * Supports matching across service codes, database IDs, and full/custom access modes.
 */
export function useCompanyAccess(activeCompany) {
  return useMemo(() => {
    if (!activeCompany || !activeCompany.access || !Array.isArray(activeCompany.access.services)) {
      return {
        permittedServices: [],
        hasServiceAccess: () => false,
        hasModuleAccess: () => false,
        hasSubModuleAccess: () => false,
        totalPermittedServices: 0,
        totalPermittedModules: 0,
      };
    }

    const assignedServices = activeCompany.access.services;

    // Filter master CORE_SERVICES catalogue based on company's live permissions
    const permittedServices = CORE_SERVICES.map(coreSrv => {
      // Find matching assigned service by code or by numeric ID
      const srvAssignment = assignedServices.find(srv => {
        if (srv.isAllowed === false) return false;
        if (srv.code && srv.code === coreSrv.code) return true;
        if (srv.service_id && String(srv.service_id) === String(coreSrv.id)) return true;
        if (srv.serviceId && String(srv.serviceId) === String(coreSrv.id)) return true;
        return false;
      });

      if (!srvAssignment) return null;

      const isFullService = Boolean(srvAssignment.full_service || srvAssignment.isFullService);
      const assignedModules = Array.isArray(srvAssignment.modules) ? srvAssignment.modules : [];

      // Filter permitted modules
      const filteredModules = coreSrv.modules.map(coreMod => {
        if (isFullService) {
          // Full service grant implies all modules and sub-modules
          return {
            ...coreMod,
            subModules: [...(coreMod.subModules || [])],
          };
        }

        // Match module by code or by ID
        const modAssignment = assignedModules.find(m => {
          if (m.isAllowed === false) return false;
          if (m.code && m.code === coreMod.code) return true;
          if (m.module_id && String(m.module_id) === String(coreMod.id)) return true;
          if (m.moduleId && String(m.moduleId) === String(coreMod.id)) return true;
          return false;
        });

        if (!modAssignment) return null;

        const isFullModule = (modAssignment.access_mode || modAssignment.accessMode) === 'FULL';
        const allowedSubIds = Array.isArray(modAssignment.sub_module_ids)
          ? modAssignment.sub_module_ids.map(String)
          : [];
        const allowedSubObjects = Array.isArray(modAssignment.subModules)
          ? modAssignment.subModules
          : [];

        // Filter permitted sub-modules
        const filteredSubModules = (coreMod.subModules || []).filter(coreSub => {
          if (isFullModule) return true;
          if (allowedSubIds.includes(String(coreSub.id))) return true;
          if (allowedSubObjects.some(s => s.code === coreSub.code || String(s.id) === String(coreSub.id))) return true;
          return false;
        });

        return {
          ...coreMod,
          subModules: filteredSubModules,
        };
      }).filter(Boolean);

      return {
        ...coreSrv,
        isFullService,
        modules: filteredModules,
      };
    }).filter(Boolean);

    // Permission query helpers
    const permittedServiceCodes = new Set(permittedServices.map(s => s.code));
    const permittedModuleCodes = new Set();
    const permittedSubModuleCodes = new Set();

    permittedServices.forEach(s => {
      (s.modules || []).forEach(m => {
        permittedModuleCodes.add(m.code);
        (m.subModules || []).forEach(sub => {
          permittedSubModuleCodes.add(sub.code);
        });
      });
    });

    const hasServiceAccess = (code) => permittedServiceCodes.has(code);
    const hasModuleAccess = (code) => permittedModuleCodes.has(code);
    const hasSubModuleAccess = (code) => permittedSubModuleCodes.has(code);

    let totalPermittedModules = 0;
    permittedServices.forEach(s => {
      totalPermittedModules += (s.modules?.length || 0);
    });

    return {
      permittedServices,
      hasServiceAccess,
      hasModuleAccess,
      hasSubModuleAccess,
      totalPermittedServices: permittedServices.length,
      totalPermittedModules,
    };
  }, [activeCompany]);
}

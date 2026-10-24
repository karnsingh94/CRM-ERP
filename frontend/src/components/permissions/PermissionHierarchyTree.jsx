'use client';

import styles from '../super-admin/SuperAdminPortal.module.css';

const getServiceAccess = (value, serviceId) =>
  value.services.find((service) => String(service.service_id) === String(serviceId));

export default function PermissionHierarchyTree({
  catalog = [],
  value = { services: [] },
  onChange,
  fixedServiceId,
}) {
  const updateService = (serviceId, update) => {
    const services = [...value.services];
    const index = services.findIndex((service) => String(service.service_id) === String(serviceId));
    const current = index < 0
      ? { service_id: String(serviceId), full_service: false, modules: [] }
      : {
        ...services[index],
        modules: (services[index].modules || []).map((module) => ({
          ...module,
          sub_module_ids: [...(module.sub_module_ids || [])],
        })),
      };
    const next = update(current);

    if (index < 0) {
      services.push(next);
    } else {
      services[index] = next;
    }
    onChange({ services });
  };

  const toggleService = (serviceId) => {
    if (String(serviceId) === String(fixedServiceId)) return;
    const services = value.services.filter(
      (service) => String(service.service_id) !== String(serviceId)
    );
    if (services.length === value.services.length) {
      services.push({ service_id: String(serviceId), full_service: true, modules: [] });
    }
    onChange({ services });
  };

  const toggleFullService = (serviceId) => {
    updateService(serviceId, (service) => ({
      ...service,
      full_service: !service.full_service,
      modules: service.full_service ? service.modules : [],
    }));
  };

  const setModuleMode = (serviceId, moduleId, mode) => {
    updateService(serviceId, (service) => {
      service.full_service = false;
      const index = service.modules.findIndex(
        (module) => String(module.module_id) === String(moduleId)
      );

      if (mode === 'NONE') {
        if (index >= 0) service.modules.splice(index, 1);
      } else {
        const current = index >= 0 ? service.modules[index] : null;
        const next = mode === 'FULL'
          ? { module_id: String(moduleId), access_mode: 'FULL' }
          : {
            module_id: String(moduleId),
            access_mode: 'CUSTOM',
            sub_module_ids: current?.sub_module_ids || [],
          };
        if (index >= 0) service.modules[index] = next;
        else service.modules.push(next);
      }
      return service;
    });
  };

  const toggleSubModule = (serviceId, moduleId, subModuleId) => {
    updateService(serviceId, (service) => {
      service.full_service = false;
      let moduleAccess = service.modules.find(
        (entry) => String(entry.module_id) === String(moduleId)
      );
      if (!moduleAccess) {
        moduleAccess = { module_id: String(moduleId), access_mode: 'CUSTOM', sub_module_ids: [] };
        service.modules.push(moduleAccess);
      } else {
        moduleAccess.access_mode = 'CUSTOM';
        moduleAccess.sub_module_ids = [...(moduleAccess.sub_module_ids || [])];
      }
      const id = String(subModuleId);
      moduleAccess.sub_module_ids = moduleAccess.sub_module_ids.includes(id)
        ? moduleAccess.sub_module_ids.filter((entry) => entry !== id)
        : [...moduleAccess.sub_module_ids, id];
      return service;
    });
  };

  const selectAllSubModules = (serviceId, moduleId, subModules) => {
    updateService(serviceId, (service) => {
      service.full_service = false;
      const existingAccess = service.modules.find(
        (entry) => String(entry.module_id) === String(moduleId)
      );
      const next = {
        module_id: String(moduleId),
        access_mode: 'CUSTOM',
        sub_module_ids: subModules.map((subModule) => String(subModule.id)),
      };
      if (existingAccess) {
        service.modules[service.modules.indexOf(existingAccess)] = next;
      } else {
        service.modules.push(next);
      }
      return service;
    });
  };

  const getModuleMode = (service, moduleId) => {
    const access = getServiceAccess(value, service.id);
    if (!access) return 'NONE';
    if (access.full_service) return 'FULL';
    return access.modules?.find(
      (module) => String(module.module_id) === String(moduleId)
    )?.access_mode || 'NONE';
  };

  const isSubModuleSelected = (service, moduleId, subModuleId) => {
    const access = getServiceAccess(value, service.id);
    if (!access) return false;
    if (access.full_service) return true;
    const moduleAccess = access.modules?.find(
      (entry) => String(entry.module_id) === String(moduleId)
    );
    if (moduleAccess?.access_mode === 'FULL') return true;
    return moduleAccess?.sub_module_ids?.includes(String(subModuleId)) || false;
  };

  return (
    <div className={styles.permTreeContainer}>
      {catalog.map((service) => {
        const access = getServiceAccess(value, service.id);
        const isFixed = String(service.id) === String(fixedServiceId);
        const selected = Boolean(access) || isFixed;
        const fullService = Boolean(access?.full_service);

        return (
          <div key={service.id} className={styles.permServiceCard}>
            <div className={styles.permServiceHeader}>
              <label className={styles.permCheckboxLabel}>
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={isFixed}
                  onChange={() => toggleService(service.id)}
                />
                <span>{service.name}</span>
              </label>

              {selected && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.84rem', fontWeight: 700, color: '#7f22fe', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={fullService}
                    onChange={() => toggleFullService(service.id)}
                    style={{ width: '17px', height: '17px', accentColor: '#7f22fe', cursor: 'pointer' }}
                  />
                  <span>Full Service (All Modules)</span>
                </label>
              )}
            </div>

            {selected && !fullService && (
              <div className={styles.permModulesList}>
                {(service.modules || []).map((module) => {
                  const mode = getModuleMode(service, module.id);
                  const subModules = module.sub_modules || [];
                  const fullModuleUnavailable = module.fullAccess === false;

                  return (
                    <div key={module.id} className={styles.permModuleItem}>
                      <div className={styles.permModuleHeader}>
                        <span className={styles.permModuleTitle}>📁 {module.name}</span>
                        <div className={styles.permModeButtons}>
                          {['NONE', 'FULL', 'CUSTOM'].map((option) => (
                            <button
                              key={option}
                              type="button"
                              disabled={option === 'FULL' && fullModuleUnavailable}
                              className={`${styles.modeBtn} ${mode === option ? styles.modeBtnActive : ''}`}
                              onClick={() => setModuleMode(service.id, module.id, option)}
                            >
                              {option === 'FULL' ? 'FULL MODULE' : option}
                            </button>
                          ))}
                        </div>
                      </div>

                      {mode === 'CUSTOM' && (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.65rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Select Allowed Screens:</span>
                            <button
                              type="button"
                              className={styles.selectAllBtn}
                              onClick={() => selectAllSubModules(service.id, module.id, subModules)}
                            >
                              Select All ({subModules.length})
                            </button>
                          </div>
                          <div className={styles.permSubModulesList}>
                            {subModules.map((subModule) => (
                              <label key={subModule.id} className={styles.permSubItem} style={{ userSelect: 'none', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={isSubModuleSelected(service, module.id, subModule.id)}
                                  onChange={() => toggleSubModule(service.id, module.id, subModule.id)}
                                  style={{ width: '16px', height: '16px', accentColor: '#7f22fe', cursor: 'pointer' }}
                                />
                                <span>{subModule.name}</span>
                              </label>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useCompanyAuthContext } from '@/context/CompanyAuthContext';
import ServiceWorkBoard from '@/components/departments/ServiceWorkBoard';
import {
  IconBuilding,
  IconChevronRight,
  IconDashboard,
  IconLayers,
} from '@/components/ui/Icons';
import styles from '@/features/department-head/dashboard/DepartmentHeadDashboard.module.css';

const EMPTY_MODULES = [];

export default function EmployeeDashboardFeature() {
  const { currentUser, activeCompany } = useCompanyAuthContext();
  const service = activeCompany?.access?.services?.[0];
  const modules = service?.modules || EMPTY_MODULES;
  const serviceName = currentUser?.serviceName || service?.name || 'Assigned Service';
  const serviceCode = currentUser?.serviceCode || service?.code;
  const userName = currentUser?.name || 'Employee';
  const subModuleCount = modules.reduce(
    (total, module) => total + (module.subModules || module.sub_modules || []).length,
    0
  );

  return (
    <div
      className={`${styles.portal} ${styles.embeddedPortal}`}
      style={{
        '--department-accent': 'var(--primary, #7f22fe)',
        '--department-accent-soft': 'var(--primary-light, #7f22fe20)',
        '--department-accent-glow': 'var(--primary-glow, #7f22fe4d)',
      }}
    >
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Employee Workspace</span>
          <h1>{serviceName} Team</h1>
          <p>
            Welcome, {userName}. Open only the modules, screens, and work assigned to you by your Team Leader.
          </p>
        </div>
        <div className={styles.heroBadge}>
          <span>Access scope</span>
          <strong>Assigned work only</strong>
        </div>
      </section>

      <section className={styles.statsGrid} aria-label="Employee assignment summary">
        <article className={styles.statCard}>
          <span className={styles.statIcon}><IconBuilding size={20} /></span>
          <div><small>Assigned Service</small><strong>{serviceName}</strong></div>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statIcon}><IconLayers size={20} /></span>
          <div><small>Assigned Modules</small><strong>{modules.length}</strong></div>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statIcon}><IconDashboard size={20} /></span>
          <div><small>Assigned Screens</small><strong>{subModuleCount}</strong></div>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.panelKicker}>Assigned access</span>
            <h1>Modules &amp; Submodules</h1>
            <p>Only the screens assigned by your Team Leader are available here.</p>
          </div>
          <span className={styles.countBadge}>{modules.length} modules</span>
        </div>

        {modules.length ? (
          <div className={styles.moduleGrid}>
            {modules.map((module, moduleIndex) => {
              const subModules = module.subModules || module.sub_modules || [];
              return (
                <article
                  key={module.moduleId || module.module_id || module.code || moduleIndex}
                  className={styles.moduleCard}
                >
                  <div className={styles.moduleCardTitle}>
                    <span><IconLayers size={17} /></span>
                    <h2>{module.name}</h2>
                  </div>
                  {subModules.length ? (
                    <div className={styles.moduleLinks}>
                      {subModules.map((subModule, subModuleIndex) => (
                        <Link
                          key={subModule.id || subModule.code || subModuleIndex}
                          href={subModule.route || '/dashboard'}
                          className={styles.moduleLink}
                        >
                          <span>{subModule.name}</span>
                          <IconChevronRight size={13} />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p>No assigned submodules</p>
                  )}
                  <small>{subModules.length} assigned {subModules.length === 1 ? 'screen' : 'screens'}</small>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <IconLayers size={22} />
            <strong>No modules assigned</strong>
            <span>Ask your Team Leader to assign the required work modules and screens.</span>
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.panelKicker}>Work queue</span>
            <h1>Assigned Work</h1>
            <p>Track and update only the work assigned to your employee account.</p>
          </div>
        </div>
        <ServiceWorkBoard
          activeCompany={activeCompany}
          serviceCode={serviceCode}
          currentUser={currentUser}
          accentColor="var(--primary, #7f22fe)"
        />
      </section>
    </div>
  );
}

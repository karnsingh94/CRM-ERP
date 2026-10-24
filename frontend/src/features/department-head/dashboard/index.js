'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCompanyAuthContext } from '@/context/CompanyAuthContext';
import { useCompanyAccess } from '@/hooks/useCompanyAccess';
import ServiceDepartments from '@/components/departments/ServiceDepartments';
import {
  IconBuilding,
  IconChevronRight,
  IconDashboard,
  IconLayers,
  IconSearch,
  IconSettings,
  IconShield,
  IconUsers,
} from '@/components/ui/Icons';
import DepartmentHeadSettings from './DepartmentHeadSettings';
import styles from './DepartmentHeadDashboard.module.css';

const EMPTY_MODULES = [];

const VIEW_DETAILS = {
  dashboard: {
    label: 'Dashboard',
    eyebrow: 'Department overview',
    description: 'A focused overview of your assigned department, access, and responsibilities.',
  },
  modules: {
    label: 'Department Modules',
    eyebrow: 'Department access',
    description: 'Browse only the modules and screens approved for your Department Head role.',
  },
  workspace: {
    label: 'Department Workspace',
    eyebrow: 'Team operations',
    description: 'Manage department teams, members, and work using your granted permissions.',
  },
  settings: {
    label: 'Settings & Profile',
    eyebrow: 'Workspace preferences',
    description: 'Manage your workspace appearance, profile details, and notification preferences.',
  },
};

export default function DepartmentHeadDashboardFeature({ view = 'dashboard' }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, activeCompany } = useCompanyAuthContext();
  const { permittedServices } = useCompanyAccess(activeCompany);
  const [searchQuery, setSearchQuery] = useState('');

  const currentView = VIEW_DETAILS[view] ? view : 'dashboard';
  const pageDetails = VIEW_DETAILS[currentView];
  const assignedService = activeCompany?.access?.services?.[0];
  const service = permittedServices.find((item) => (
    item.code === currentUser?.serviceCode
    || String(item.id) === String(currentUser?.serviceId || '')
  )) || permittedServices[0] || assignedService;
  const modules = service?.modules || EMPTY_MODULES;
  const subModuleCount = modules.reduce(
    (total, module) => total + (module.subModules || module.sub_modules || []).length,
    0
  );
  const serviceName = currentUser?.serviceName || service?.name || 'Assigned Department';
  const canManageTeam = currentUser?.permissions?.manageMembers !== false
    || currentUser?.permissions?.manageTeams !== false;
  const canManageWork = currentUser?.permissions?.assignWork === true
    || currentUser?.permissions?.updateWork === true;
  const canOpenWorkspace = canManageTeam || canManageWork;
  const companyAccent = activeCompany?.theme_color
    || activeCompany?.themeColor
    || currentUser?.themeColor
    || '#7f22fe';
  const userName = currentUser?.name || 'Department Head';
  const preferencesKey = `azzuniqe_department_preferences_${currentUser?.id || activeCompany?.id || 'default'}`;
  const [preferences, setPreferences] = useState({
    themeMode: 'system',
    accentColor: companyAccent,
    notifications: { success: true, info: true },
  });
  const [loadedPreferencesKey, setLoadedPreferencesKey] = useState('');
  const [systemIsDark, setSystemIsDark] = useState(false);
  const resolvedTheme = preferences.themeMode === 'system'
    ? (systemIsDark ? 'dark' : 'light')
    : preferences.themeMode;
  const accentColor = preferences.accentColor || companyAccent;

  useEffect(() => {
    if (pathname === '/dashboard') {
      router.replace('/department/dashboard');
    }
  }, [pathname, router]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemIsDark(mediaQuery.matches);
    const handleChange = (event) => setSystemIsDark(event.matches);
    mediaQuery.addEventListener?.('change', handleChange);
    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, []);

  useEffect(() => {
    try {
      const savedPreferences = localStorage.getItem(preferencesKey);
      const parsed = savedPreferences ? JSON.parse(savedPreferences) : {};
      setPreferences({
        themeMode: ['light', 'dark', 'system'].includes(parsed.themeMode) ? parsed.themeMode : 'system',
        accentColor: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(parsed.accentColor || '')
          ? parsed.accentColor
          : companyAccent,
        notifications: {
          success: parsed.notifications?.success !== false,
          info: parsed.notifications?.info !== false,
        },
      });
      setLoadedPreferencesKey(preferencesKey);
    } catch {
      setLoadedPreferencesKey(preferencesKey);
    }
  }, [preferencesKey, companyAccent]);

  useEffect(() => {
    if (!loadedPreferencesKey || loadedPreferencesKey !== preferencesKey) return;
    localStorage.setItem(preferencesKey, JSON.stringify(preferences));
    window.dispatchEvent(new CustomEvent('azzuniqe-preferences-changed', {
      detail: { key: preferencesKey, preferences },
    }));
  }, [loadedPreferencesKey, preferences, preferencesKey]);

  const filteredModules = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return modules;
    return modules.filter((module) => {
      const subModules = module.subModules || module.sub_modules || [];
      return module.name?.toLowerCase().includes(query)
        || subModules.some((subModule) => subModule.name?.toLowerCase().includes(query));
    });
  }, [modules, searchQuery]);

  if (pathname === '/dashboard') {
    return (
      <div className={styles.routeLoading}>
        <span />
        Opening Department Head dashboard...
      </div>
    );
  }

  return (
    <div
      className={`${styles.portal} ${styles.embeddedPortal}`}
      data-theme={resolvedTheme}
      style={{
        '--primary': accentColor,
        '--department-accent': accentColor,
        '--department-accent-soft': `${accentColor}20`,
        '--department-accent-glow': `${accentColor}4d`,
      }}
    >
      {currentView === 'dashboard' && (
        <>
          <section className={styles.hero}>
            <div>
              <span className={styles.eyebrow}>Department Head Workspace</span>
              <h1>{serviceName} Department</h1>
              <p>
                Welcome, {userName}. Manage your approved modules, team access, and department work from one place.
              </p>
            </div>
            <div className={styles.heroBadge}>
              <span>Access scope</span>
              <strong>Department only</strong>
            </div>
          </section>

          <section className={styles.statsGrid} aria-label="Department summary">
            <article className={styles.statCard}>
              <span className={styles.statIcon}><IconBuilding size={20} /></span>
              <div><small>Assigned Department</small><strong>{serviceName}</strong></div>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statIcon}><IconLayers size={20} /></span>
              <div><small>Accessible Modules</small><strong>{modules.length}</strong></div>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statIcon}><IconDashboard size={20} /></span>
              <div><small>Accessible Screens</small><strong>{subModuleCount}</strong></div>
            </article>
          </section>

          <section className={styles.quickGrid} aria-label="Department pages">
            <Link href="/department/modules" className={styles.quickCard}>
              <span className={styles.statIcon}><IconLayers size={20} /></span>
              <div><strong>Department Modules</strong><p>Open your approved modules and screens.</p></div>
              <b>→</b>
            </Link>
            {canOpenWorkspace && (
              <Link href="/department/workspace" className={styles.quickCard}>
                <span className={styles.statIcon}><IconUsers size={20} /></span>
                <div><strong>Department Workspace</strong><p>Manage teams, members, and assigned work.</p></div>
                <b>→</b>
              </Link>
            )}
            <Link href="/department/settings" className={styles.quickCard}>
              <span className={styles.statIcon}><IconSettings size={20} /></span>
              <div><strong>Settings &amp; Profile</strong><p>Choose your theme, color, and preferences.</p></div>
              <b>→</b>
            </Link>
          </section>
        </>
      )}

      {currentView === 'modules' && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelKicker}>{pageDetails.eyebrow}</span>
              <h1>{pageDetails.label}</h1>
              <p>{pageDetails.description}</p>
            </div>
            <span className={styles.countBadge}>{filteredModules.length} modules</span>
          </div>

          <label className={styles.moduleSearch}>
            <IconSearch size={17} />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search permitted modules and screens"
              aria-label="Search permitted department modules"
            />
          </label>

          {filteredModules.length ? (
            <div className={styles.moduleGrid}>
              {filteredModules.map((module, index) => {
                const subModules = module.subModules || module.sub_modules || [];
                return (
                  <article key={module.moduleId || module.module_id || module.code || index} className={styles.moduleCard}>
                    <div className={styles.moduleCardTitle}>
                      <span><IconLayers size={17} /></span>
                      <h2>{module.name}</h2>
                    </div>
                    {subModules.length ? (
                      <div className={styles.moduleLinks}>
                        {subModules.map((subModule, subModuleIndex) => (
                          <Link
                            key={subModule.id || subModule.code || subModuleIndex}
                            href={subModule.route || '/department/modules'}
                            className={styles.moduleLink}
                          >
                            <span>{subModule.name}</span>
                            <IconChevronRight size={13} />
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p>No active sub-modules</p>
                    )}
                    <small>{subModules.length} accessible {subModules.length === 1 ? 'screen' : 'screens'}</small>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <IconSearch size={22} />
              <strong>{searchQuery ? 'No matching modules found' : 'No active modules assigned'}</strong>
              <span>{searchQuery ? 'Try a different search term.' : 'Contact your company administrator for access.'}</span>
            </div>
          )}
        </section>
      )}

      {currentView === 'workspace' && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelKicker}>{pageDetails.eyebrow}</span>
              <h1>{pageDetails.label}</h1>
              <p>{pageDetails.description}</p>
            </div>
          </div>
          {canOpenWorkspace ? (
            <ServiceDepartments
              activeCompany={activeCompany}
              serviceCode={currentUser?.serviceCode || service?.code}
              currentUser={currentUser}
            />
          ) : (
            <div className={styles.restrictedState} role="alert">
              <IconShield size={24} />
              <strong>Workspace permission required</strong>
              <span>Your account does not currently have team or work management permission.</span>
            </div>
          )}
        </section>
      )}

      {currentView === 'settings' && (
        <DepartmentHeadSettings
          activeCompany={activeCompany}
          currentUser={currentUser}
          modules={modules}
          subModuleCount={subModuleCount}
          serviceName={serviceName}
          themeMode={preferences.themeMode}
          resolvedTheme={resolvedTheme}
          accentColor={accentColor}
          notificationPreferences={preferences.notifications}
          onThemeChange={(themeMode) => setPreferences((previous) => ({ ...previous, themeMode }))}
          onAccentChange={(nextAccentColor) => setPreferences((previous) => ({ ...previous, accentColor: nextAccentColor }))}
          onNotificationsChange={(notifications) => setPreferences((previous) => ({ ...previous, notifications }))}
        />
      )}
    </div>
  );
}

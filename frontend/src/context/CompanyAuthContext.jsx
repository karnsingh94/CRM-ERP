'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '../lib/api';
import {
  clearStoredSession,
  getCachedStoredUser,
  getStoredToken,
  restoreSuperAdminSession,
  verifyCurrentSession,
} from '../lib/auth';

const CompanyAuthContext = createContext(null);
const COMPANY_USER_ROLES = ['COMPANY_ADMIN', 'DEPARTMENT_HEAD', 'SERVICE_HEAD', 'TEAM_LEADER', 'EMPLOYEE'];

function formatRoleTitle(role, departmentName) {
  switch (role) {
    case 'COMPANY_ADMIN':
      return 'Company Admin';
    case 'DEPARTMENT_HEAD':
    case 'SERVICE_HEAD':
      return departmentName ? `Department Head (${departmentName})` : 'Department Head';
    case 'TEAM_LEADER':
      return departmentName ? `Team Leader (${departmentName})` : 'Team Leader';
    case 'EMPLOYEE':
      return departmentName ? `Employee (${departmentName})` : 'Employee';
    default:
      return role || 'Company User';
  }
}

function createCompanyUserProfile(user) {
  return {
    ...user,
    roleTitle: formatRoleTitle(user.role, user.departmentName),
    isCompanyAdmin: user.role === 'COMPANY_ADMIN',
    isDepartmentHead: user.role === 'DEPARTMENT_HEAD' || user.role === 'SERVICE_HEAD',
    isServiceHead: user.role === 'SERVICE_HEAD' || user.role === 'DEPARTMENT_HEAD',
    isTeamLeader: user.role === 'TEAM_LEADER',
    isEmployee: user.role === 'EMPLOYEE',
  };
}

function scopeCompanyAccessForUser(company, user) {
  if (!company || !user || !['DEPARTMENT_HEAD', 'SERVICE_HEAD', 'TEAM_LEADER', 'EMPLOYEE'].includes(user.role)) {
    return company;
  }
  const serviceId = String(user.serviceId || '');
  const services = (company.access?.services || []).filter(
    (service) => String(service.serviceId || service.service_id || service.id) === serviceId
  );
  const featureAccess = ['DEPARTMENT_HEAD', 'SERVICE_HEAD', 'TEAM_LEADER', 'EMPLOYEE'].includes(user.role)
    ? user.permissions?.featureAccess || {}
    : null;
  const moduleIds = new Set(Array.isArray(featureAccess?.moduleIds) ? featureAccess.moduleIds.map(String) : []);
  const subModuleIds = new Set(Array.isArray(featureAccess?.subModuleIds) ? featureAccess.subModuleIds.map(String) : []);
  return {
    ...company,
    access: {
      ...(company.access || {}),
      services: featureAccess
        ? services.map((service) => ({
          ...service,
          full_service: false,
          isFullService: false,
          modules: (service.modules || []).flatMap((module) => {
            const moduleId = String(module.moduleId || module.module_id || module.id);
            if (moduleIds.has(moduleId)) return [{ ...module, access_mode: 'FULL', accessMode: 'FULL' }];
            const subModules = (module.subModules || module.sub_modules || []).filter(
              (subModule) => subModuleIds.has(String(subModule.id))
            );
            return subModules.length
              ? [{
                ...module,
                access_mode: 'CUSTOM',
                accessMode: 'CUSTOM',
                sub_module_ids: subModules.map((subModule) => String(subModule.id)),
                subModules,
                sub_modules: subModules,
              }]
              : [];
          }),
        }))
        : services,
    },
  };
}

let globalCurrentUser = null;

export function CompanyAuthProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const lastSyncTimestampRef = useRef(0);

  const [activeCompany, setActiveCompany] = useState(null);
  const [authorizedCompanies, setAuthorizedCompanies] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const hydrateSession = useCallback((user) => {
    if (!COMPANY_USER_ROLES.includes(user?.role)) return false;

    const profile = createCompanyUserProfile(user);
    let cachedCompany = null;
    try {
      cachedCompany = JSON.parse(localStorage.getItem('cached_company_data') || 'null');
    } catch {
      cachedCompany = null;
    }

    const targetCompanyId = user.companyId || user.clientAdminId;
    const fallbackCompany = {
      id: String(targetCompanyId || user.id || 'default'),
      name: user.organizationName || user.name || 'Company Workspace',
      organizationName: user.organizationName || user.name || 'Company Workspace',
      email: user.email,
      status: user.status || 'ACTIVE',
      themeColor: user.themeColor || user.theme_color || '#7f22fe',
      theme_color: user.theme_color || user.themeColor || '#7f22fe',
      access: user.access || { services: [] },
    };
    const company = scopeCompanyAccessForUser(cachedCompany || fallbackCompany, user);

    globalCurrentUser = profile;
    setCurrentUser(profile);
    setActiveCompany(company);
    setAuthorizedCompanies([company]);
    setError(null);
    setIsLoading(false);
    lastSyncTimestampRef.current = Date.now();
    return true;
  }, []);

  // Verify the company session on entry and whenever the page regains focus.
  const loadCompanySession = useCallback(async () => {
    const currentPath = pathnameRef.current || (typeof window !== 'undefined' ? window.location.pathname : '');
    if (currentPath.startsWith('/super-admin')) {
      restoreSuperAdminSession();
      setIsLoading(false);
      return;
    }

    if (currentPath === '/login') {
      setIsLoading(false);
      return;
    }

    // Never show full loading skeleton if user/company is already known
    if (!globalCurrentUser) {
      setIsLoading(true);
    }
    setError(null);
    const token = getStoredToken();
    const cachedUser = token ? getCachedStoredUser() : null;

    if (!globalCurrentUser && COMPANY_USER_ROLES.includes(cachedUser?.role)) {
      hydrateSession(cachedUser);
    }

    try {
      let verifiedUser = null;
      const userCandidate = token ? await verifyCurrentSession() : null;
      if (userCandidate?.role === 'SUPER_ADMIN') {
        router.replace('/super-admin');
        return;
      }
      if (COMPANY_USER_ROLES.includes(userCandidate?.role)) {
        verifiedUser = userCandidate;
      }

      // 3. If unauthenticated, redirect to /login
      if (!verifiedUser) {
        const currentToken = getStoredToken();
        if (token !== currentToken) {
          if (currentToken) return;
          clearStoredSession();
          globalCurrentUser = null;
          setIsLoading(false);
          setCurrentUser(null);
          setActiveCompany(null);
          setAuthorizedCompanies([]);
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            const currentPath = window.location.pathname;
            const redirectTarget = currentPath && currentPath !== '/' ? currentPath : '/dashboard';
            router.replace(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
          }
          return;
        }
        if (!userCandidate && COMPANY_USER_ROLES.includes(cachedUser?.role) && currentToken) return;
        clearStoredSession();
        globalCurrentUser = null;
        setIsLoading(false);
        setCurrentUser(null);
        setActiveCompany(null);
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          const currentPath = window.location.pathname;
          const redirectTarget = currentPath && currentPath !== '/' ? currentPath : '/dashboard';
          router.replace(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
        }
        return;
      }

      // Format authenticated user profile
      const userProfile = createCompanyUserProfile(verifiedUser);
      setCurrentUser(userProfile);

      // 4. Resolve company context immediately from verifiedUser identity payload
      const targetCompanyId = verifiedUser.companyId || verifiedUser.clientAdminId;

      let finalCompany = {
        id: String(targetCompanyId || verifiedUser.id || 'default'),
        name: verifiedUser.organizationName || verifiedUser.name || 'Company Workspace',
        organizationName: verifiedUser.organizationName || verifiedUser.name || 'Company Workspace',
        email: verifiedUser.email,
        status: verifiedUser.status || 'ACTIVE',
        themeColor: verifiedUser.themeColor || verifiedUser.theme_color || '#7f22fe',
        theme_color: verifiedUser.theme_color || verifiedUser.themeColor || '#7f22fe',
        access: verifiedUser.access || { services: [] },
      };
      finalCompany = scopeCompanyAccessForUser(finalCompany, verifiedUser);

      let finalAuthorizedList = [finalCompany];

      if (typeof window !== 'undefined') {
        const activeIdStr = String(finalCompany.id);
        if (localStorage.getItem('active_company_id') !== activeIdStr) {
          localStorage.setItem('active_company_id', activeIdStr);
        }
        const cachedStr = JSON.stringify(finalCompany);
        if (localStorage.getItem('cached_company_data') !== cachedStr) {
          localStorage.setItem('cached_company_data', cachedStr);
        }
      }

      setActiveCompany(finalCompany);
      setAuthorizedCompanies(finalAuthorizedList);
      lastSyncTimestampRef.current = Date.now();

      // The Employee profile already contains its complete, permission-scoped
      // company data. Avoid downloading the much larger admin company payload.
      if (targetCompanyId && verifiedUser.role !== 'EMPLOYEE') {
        api.get(`/clients/${targetCompanyId}`).then(compRes => {
          const companyData = compRes?.data || null;
          if (companyData) {
            const scoped = scopeCompanyAccessForUser({
              ...companyData,
              access: companyData.access || finalCompany.access,
            }, verifiedUser);
            setActiveCompany(scoped);
            if (typeof window !== 'undefined') {
              const newStr = JSON.stringify(scoped);
              if (localStorage.getItem('cached_company_data') !== newStr) {
                localStorage.setItem('cached_company_data', newStr);
              }
            }
          }
        }).catch(() => {});
      }

      globalCurrentUser = userProfile;
    } catch (err) {
      console.error('Company auth load failure:', err);
      setError(err.message || 'Failed to authenticate company session');
    } finally {
      setIsLoading(false);
    }
  }, [hydrateSession, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') loadCompanySession();
  }, [loadCompanySession, pathname]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Revalidate on tab focus with a 30s minimum cooldown to prevent continuous query loops
      const handleRevalidate = () => {
        if (Date.now() - lastSyncTimestampRef.current < 30000) return;
        loadCompanySession();
      };

      // ONLY revalidate on storage event if the auth token itself changed from another tab
      const handleStorage = (event) => {
        if (event.key === 'azzuniqe_client_token') {
          loadCompanySession();
        }
      };

      window.addEventListener('focus', handleRevalidate);
      window.addEventListener('pageshow', handleRevalidate);
      window.addEventListener('storage', handleStorage);
      return () => {
        window.removeEventListener('focus', handleRevalidate);
        window.removeEventListener('pageshow', handleRevalidate);
        window.removeEventListener('storage', handleStorage);
      };
    }
  }, [loadCompanySession]);

  // Switch active company tenant context
  const selectCompany = async (companyId) => {
    const isAuthorized = authorizedCompanies.some((c) => String(c.id) === String(companyId));
    if (!isAuthorized) {
      console.error(`Company ID ${companyId} is not in authorized companies list`);
      return;
    }

    setIsLoading(true);
    try {
      const detailRes = await api.get(`/clients/${companyId}`);
      if (detailRes?.data) {
        const companyData = detailRes.data;
        setActiveCompany(companyData);
        if (typeof window !== 'undefined') {
          localStorage.setItem('active_company_id', String(companyId));
        }
      }
    } catch (err) {
      console.error('Failed to switch company:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateCompanyAdminState = ({ profile, company } = {}) => {
    if (profile) {
      setCurrentUser((previous) => {
        const updated = { ...previous, ...profile };
        globalCurrentUser = updated;
        if (typeof window !== 'undefined') {
          localStorage.setItem('company_user', JSON.stringify(updated));
          sessionStorage.setItem('company_user', JSON.stringify(updated));
        }
        return updated;
      });
      if (profile.name) {
        setActiveCompany((previous) => {
          const updated = { ...previous, name: profile.name };
          if (typeof window !== 'undefined') {
            localStorage.setItem('cached_company_data', JSON.stringify(updated));
          }
          return updated;
        });
      }
    }
    if (company) {
      setActiveCompany((previous) => {
        const updated = { ...previous, ...company };
        if (typeof window !== 'undefined') {
          localStorage.setItem('cached_company_data', JSON.stringify(updated));
        }
        return updated;
      });
    }
  };

  // Perform secure logout
  const logout = async () => {
    const token = getStoredToken();
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).catch(() => null);
    } catch {
      // Invalidation attempted
    }

    clearStoredSession();

    globalCurrentUser = null;

    setActiveCompany(null);
    setCurrentUser(null);
    router.replace('/login');
  };

  const value = {
    activeCompany,
    allCompanies: authorizedCompanies,
    authorizedCompanies,
    hasMultipleCompanies: authorizedCompanies.length > 1,
    currentUser,
    isLoading,
    error,
    selectCompany,
    updateCompanyAdminState,
    logout,
    refreshSession: () => loadCompanySession(),
    hydrateSession,
  };

  return (
    <CompanyAuthContext.Provider value={value}>
      {children}
    </CompanyAuthContext.Provider>
  );
}

export function useCompanyAuthContext() {
  return useContext(CompanyAuthContext);
}

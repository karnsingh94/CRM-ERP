'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '../lib/api';
import { clearStoredSession, getStoredToken, verifyCurrentSession } from '../lib/auth';

const CompanyAuthContext = createContext(null);
const COMPANY_USER_ROLES = ['COMPANY_ADMIN', 'DEPARTMENT_HEAD', 'SERVICE_HEAD', 'TEAM_LEADER', 'EMPLOYEE'];

function scopeCompanyAccessForUser(company, user) {
  if (!company || !user || !['DEPARTMENT_HEAD', 'SERVICE_HEAD', 'TEAM_LEADER', 'EMPLOYEE'].includes(user.role)) {
    return company;
  }
  const serviceId = String(user.serviceId || '');
  const services = (company.access?.services || []).filter(
    (service) => String(service.serviceId || service.service_id || service.id) === serviceId
  );
  const featureAccess = user.role === 'TEAM_LEADER' || user.role === 'SERVICE_HEAD'
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

  // Format role display label
  const formatRoleTitle = (role, departmentName) => {
    switch (role) {
      case 'COMPANY_ADMIN':
        return 'Company Admin';
      case 'DEPARTMENT_HEAD':
      case 'SERVICE_HEAD':
        return departmentName ? `Service Head (${departmentName})` : 'Service Head';
      case 'TEAM_LEADER':
        return departmentName ? `Team Leader (${departmentName})` : 'Team Leader';
      case 'EMPLOYEE':
        return departmentName ? `Employee (${departmentName})` : 'Employee';
      default:
        return role || 'Company User';
    }
  };

  const [activeCompany, setActiveCompany] = useState(null);
  const [authorizedCompanies, setAuthorizedCompanies] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Verify the company session on entry and whenever the page regains focus.
  const loadCompanySession = useCallback(async () => {
    if (pathname.startsWith('/super-admin')) {
      setIsLoading(false);
      return;
    }

    if (pathname === '/login') {
      setIsLoading(false);
      return;
    }

    // Never show full loading skeleton if user/company is already known
    if (!globalCurrentUser) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const token = getStoredToken();
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
        if (token !== getStoredToken()) return;
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
      const roleTitle = formatRoleTitle(verifiedUser.role, verifiedUser.departmentName);
      const userProfile = {
        ...verifiedUser,
        roleTitle,
        isCompanyAdmin: verifiedUser.role === 'COMPANY_ADMIN',
        isDepartmentHead: verifiedUser.role === 'DEPARTMENT_HEAD' || verifiedUser.role === 'SERVICE_HEAD',
        isServiceHead: verifiedUser.role === 'SERVICE_HEAD' || verifiedUser.role === 'DEPARTMENT_HEAD',
        isTeamLeader: verifiedUser.role === 'TEAM_LEADER',
        isEmployee: verifiedUser.role === 'EMPLOYEE',
      };
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
        localStorage.setItem('active_company_id', String(finalCompany.id));
        localStorage.setItem('cached_company_data', JSON.stringify(finalCompany));
      }

      setActiveCompany(finalCompany);
      setAuthorizedCompanies(finalAuthorizedList);

      // Non-blocking background sync for any updated metadata from /clients/:id
      if (targetCompanyId) {
        api.get(`/clients/${targetCompanyId}`).then(compRes => {
          const companyData = compRes?.data || null;
          if (companyData) {
            setActiveCompany(prev => scopeCompanyAccessForUser({
              ...prev,
              ...companyData,
              access: companyData.access || prev?.access,
            }, verifiedUser));
            if (typeof window !== 'undefined') {
              localStorage.setItem(
                'cached_company_data',
                JSON.stringify(scopeCompanyAccessForUser(companyData, verifiedUser))
              );
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
  }, [pathname, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      loadCompanySession();

      // Revalidate automatically on tab focus or catalog update storage event
      const handleRevalidate = () => {
        loadCompanySession();
      };
      window.addEventListener('focus', handleRevalidate);
      window.addEventListener('storage', handleRevalidate);
      return () => {
        window.removeEventListener('focus', handleRevalidate);
        window.removeEventListener('storage', handleRevalidate);
      };
    }
    loadCompanySession();
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

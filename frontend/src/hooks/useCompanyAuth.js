'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, API_BASE } from '../lib/api';
import { clearStoredSession } from '../lib/auth';
import { useCompanyAuthContext } from '../context/CompanyAuthContext';

const COMPANY_USER_ROLES = ['COMPANY_ADMIN', 'DEPARTMENT_HEAD', 'SERVICE_HEAD', 'TEAM_LEADER', 'EMPLOYEE'];

function scopeCompanyAccessForUser(company, user) {
  if (!company || !user || !['DEPARTMENT_HEAD', 'SERVICE_HEAD', 'TEAM_LEADER', 'EMPLOYEE'].includes(user.role)) {
    return company;
  }
  const serviceId = String(user.serviceId || '');
  const services = (company.access?.services || []).filter(
    (service) => String(service.serviceId || service.service_id || service.id) === serviceId
  );
  const featureAccess = ['DEPARTMENT_HEAD', 'SERVICE_HEAD', 'TEAM_LEADER'].includes(user.role)
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

export function useCompanyAuth() {
  const context = useCompanyAuthContext();
  if (context) {
    return context;
  }

  const router = useRouter();
  const pathname = usePathname();

  const [activeCompany, setActiveCompany] = useState(null);
  const [authorizedCompanies, setAuthorizedCompanies] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper to read cached token
  const getStoredToken = () => {
    if (typeof window === 'undefined') return null;
    return (
      localStorage.getItem('azzuniqe_client_token') ||
      sessionStorage.getItem('azzuniqe_client_token')
    );
  };

  // Format role display label
  const formatRoleTitle = (role, departmentName) => {
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
  };

  // Load and verify company user session
  const loadCompanySession = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // If already on /login page, don't execute full route guard loop
    if (pathname === '/login') {
      setIsLoading(false);
      return;
    }

    try {
      const token = getStoredToken();
      let verifiedUser = null;

      // 1. Verify session with backend /api/auth/me
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (res.ok) {
          const body = await res.json();
          const userCandidate = body?.data?.user || body?.data;
          if (userCandidate) {
            if (userCandidate.role === 'SUPER_ADMIN') {
              router.replace('/super-admin');
              return;
            }
            if (COMPANY_USER_ROLES.includes(userCandidate.role)) {
              verifiedUser = userCandidate;
            }
          }
        }
      } catch {
        // Network or backend unavailable
      }

      // 3. If unauthenticated, redirect to /login
      if (!verifiedUser) {
        if (token !== getStoredToken()) return;
        clearStoredSession();
        setIsLoading(false);
        setCurrentUser(null);
        setActiveCompany(null);
        if (typeof window !== 'undefined' && pathname !== '/login') {
          const redirectTarget = pathname && pathname !== '/' ? pathname : '/dashboard';
          router.replace(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
        }
        return;
      }

      // Format authenticated user data
      const roleTitle = formatRoleTitle(verifiedUser.role, verifiedUser.departmentName);
      const userProfile = {
        ...verifiedUser,
        roleTitle,
        isCompanyAdmin: verifiedUser.role === 'COMPANY_ADMIN',
        isDepartmentHead: verifiedUser.role === 'DEPARTMENT_HEAD' || verifiedUser.role === 'SERVICE_HEAD',
        isServiceHead: verifiedUser.role === 'DEPARTMENT_HEAD' || verifiedUser.role === 'SERVICE_HEAD',
        isTeamLeader: verifiedUser.role === 'TEAM_LEADER',
        isEmployee: verifiedUser.role === 'EMPLOYEE',
      };
      setCurrentUser(userProfile);

      // 4. Resolve company context from trusted identity
      const targetCompanyId = verifiedUser.companyId || verifiedUser.clientAdminId;

      if (targetCompanyId) {
        try {
          const compRes = await api.get(`/clients/${targetCompanyId}`);
          const companyData = compRes?.data || null;
          if (companyData) {
            const scopedCompany = scopeCompanyAccessForUser(companyData, verifiedUser);
            setActiveCompany(scopedCompany);
            setAuthorizedCompanies([scopedCompany]);
            if (typeof window !== 'undefined') {
              localStorage.setItem('active_company_id', String(scopedCompany.id));
              localStorage.setItem('cached_company_data', JSON.stringify(scopedCompany));
            }
          } else {
            // Minimal company object from session
            setActiveCompany({
              id: targetCompanyId,
              name: verifiedUser.organizationName || verifiedUser.name,
              organizationName: verifiedUser.organizationName || verifiedUser.name,
              email: verifiedUser.email,
              status: 'ACTIVE',
              access: verifiedUser.access || { services: [] },
            });
            setAuthorizedCompanies([]);
          }
        } catch {
          // Fallback to minimal company object
          setActiveCompany({
            id: targetCompanyId,
            name: verifiedUser.organizationName || verifiedUser.name,
            organizationName: verifiedUser.organizationName || verifiedUser.name,
            email: verifiedUser.email,
            status: 'ACTIVE',
            access: verifiedUser.access || { services: [] },
          });
          setAuthorizedCompanies([]);
        }
      } else {
        // No valid company association
        setActiveCompany(null);
        setAuthorizedCompanies([]);
      }
    } catch (err) {
      console.error('Company auth load failure:', err);
      setError(err.message || 'Failed to authenticate company session');
    } finally {
      setIsLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    loadCompanySession();
  }, [loadCompanySession]);

  // Switch active company tenant context (only among authorized companies)
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

    setActiveCompany(null);
    setCurrentUser(null);
    router.replace('/login');
  };

  return {
    activeCompany,
    allCompanies: authorizedCompanies,
    authorizedCompanies,
    hasMultipleCompanies: authorizedCompanies.length > 1,
    currentUser,
    isLoading,
    error,
    selectCompany,
    logout,
    refreshSession: loadCompanySession,
  };
}

'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, API_BASE } from '../lib/api';

const CompanyAuthContext = createContext(null);

let globalActiveCompany = null;
let globalAuthorizedCompanies = [];
let globalCurrentUser = null;
let globalIsLoaded = false;
let globalInFlightPromise = null;

export function CompanyAuthProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  // Helper to read cached token
  const getStoredToken = () => {
    if (typeof window === 'undefined') return null;
    return (
      localStorage.getItem('azzuniqe_client_token') ||
      sessionStorage.getItem('azzuniqe_client_token')
    );
  };

  // Helper to read cached session payload
  const getStoredSession = () => {
    if (typeof window === 'undefined') return null;
    try {
      const raw =
        localStorage.getItem('company_user') ||
        sessionStorage.getItem('company_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  // Helper to read cached company structure
  const getStoredCompany = () => {
    if (typeof window === 'undefined') return null;
    try {
      const raw =
        localStorage.getItem('cached_company_data') ||
        localStorage.getItem('company_user');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.organizationName || parsed.name)) {
        return {
          id: String(parsed.companyId || parsed.id),
          name: parsed.organizationName || parsed.name,
          organizationName: parsed.organizationName || parsed.name,
          email: parsed.email,
          themeColor: parsed.themeColor || parsed.theme_color || '#7f22fe',
          theme_color: parsed.themeColor || parsed.theme_color || '#7f22fe',
          access: parsed.access || { services: [] },
          status: parsed.status || 'ACTIVE',
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  // Format role display label
  const formatRoleTitle = (role, departmentName) => {
    switch (role) {
      case 'COMPANY_ADMIN':
        return 'Company Admin';
      case 'DEPARTMENT_HEAD':
        return departmentName ? `Department Head (${departmentName})` : 'Department Head';
      case 'EMPLOYEE':
        return departmentName ? `Employee (${departmentName})` : 'Employee';
      default:
        return role || 'Company User';
    }
  };

  const initialComp = globalActiveCompany || getStoredCompany();
  const initialUser = (() => {
    if (globalCurrentUser) return globalCurrentUser;
    const session = getStoredSession();
    if (session) {
      return {
        ...session,
        roleTitle: formatRoleTitle(session.role, session.departmentName),
        isCompanyAdmin: session.role === 'COMPANY_ADMIN',
        isDepartmentHead: session.role === 'DEPARTMENT_HEAD',
        isEmployee: session.role === 'EMPLOYEE',
      };
    }
    return null;
  })();

  const [activeCompany, setActiveCompany] = useState(initialComp);
  const [authorizedCompanies, setAuthorizedCompanies] = useState(() => {
    if (globalAuthorizedCompanies.length > 0) return globalAuthorizedCompanies;
    return initialComp ? [initialComp] : [];
  });
  const [currentUser, setCurrentUser] = useState(initialUser);
  const [isLoading, setIsLoading] = useState(() => !globalIsLoaded && !initialComp);
  const [error, setError] = useState(null);

  const isInitialLoadDone = useRef(globalIsLoaded);

  // Load and verify company user session ONCE (does NOT repeat on every pathname change)
  const loadCompanySession = useCallback(async (force = false) => {
    if ((globalIsLoaded || isInitialLoadDone.current) && !force) {
      return;
    }

    if (pathname.startsWith('/super-admin')) {
      setIsLoading(false);
      return;
    }

    if (pathname === '/login') {
      setIsLoading(false);
      return;
    }

    // Never show full loading skeleton if user/company is already known
    if (!globalCurrentUser && !getStoredSession()) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const token = getStoredToken();
      let verifiedUser = null;

      // 1. Verify session with backend /api/auth/me
      if (token) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);
          const res = await fetch(`${API_BASE}/auth/me`, {
            credentials: 'include',
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const body = await res.json();
            const userCandidate = body?.data?.user || body?.data;
            if (userCandidate) {
              if (userCandidate.role === 'SUPER_ADMIN') {
                router.replace('/super-admin');
                return;
              }
              if (
                userCandidate.role === 'COMPANY_ADMIN' ||
                userCandidate.role === 'DEPARTMENT_HEAD' ||
                userCandidate.role === 'EMPLOYEE'
              ) {
                verifiedUser = userCandidate;
              }
            }
          }
        } catch {
          // Network or backend unavailable
        }
      }

      // 2. Fallback to cached session
      if (!verifiedUser) {
        const cached = getStoredSession();
        if (
          cached &&
          (cached.role === 'COMPANY_ADMIN' ||
            cached.role === 'DEPARTMENT_HEAD' ||
            cached.role === 'EMPLOYEE') &&
          token
        ) {
          verifiedUser = cached;
        }
      }

      // 3. If unauthenticated, redirect to /login
      if (!verifiedUser) {
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
        isDepartmentHead: verifiedUser.role === 'DEPARTMENT_HEAD',
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
            setActiveCompany(prev => ({
              ...prev,
              ...companyData,
              access: companyData.access || prev?.access,
            }));
            if (typeof window !== 'undefined') {
              localStorage.setItem('cached_company_data', JSON.stringify(companyData));
            }
          }
        }).catch(() => {});
      }

      globalCurrentUser = userProfile;
      globalActiveCompany = finalCompany;
      globalAuthorizedCompanies = finalAuthorizedList;
      globalIsLoaded = true;
      isInitialLoadDone.current = true;
    } catch (err) {
      console.error('Company auth load failure:', err);
      setError(err.message || 'Failed to authenticate company session');
    } finally {
      setIsLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let cachedCompany = globalActiveCompany;
      if (!cachedCompany) {
        try {
          const raw = localStorage.getItem('cached_company_data');
          if (raw) cachedCompany = JSON.parse(raw);
        } catch {}
      }
      const cached = globalCurrentUser || getStoredSession();
      if (cached) {
        const roleTitle = formatRoleTitle(cached.role, cached.departmentName);
        const profile = {
          ...cached,
          roleTitle,
          isCompanyAdmin: cached.role === 'COMPANY_ADMIN',
          isDepartmentHead: cached.role === 'DEPARTMENT_HEAD',
          isEmployee: cached.role === 'EMPLOYEE',
        };
        setCurrentUser(profile);
        if (cachedCompany) {
          setActiveCompany(cachedCompany);
        }
        setIsLoading(false);
      }

      // Revalidate automatically on tab focus or catalog update storage event
      const handleRevalidate = () => {
        loadCompanySession(true);
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
          globalActiveCompany = updated;
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
        globalActiveCompany = updated;
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

    if (typeof window !== 'undefined') {
      localStorage.removeItem('azzuniqe_client_token');
      sessionStorage.removeItem('azzuniqe_client_token');
      localStorage.removeItem('company_user');
      sessionStorage.removeItem('company_user');
      localStorage.removeItem('active_company_id');
      sessionStorage.removeItem('active_company_id');
      document.cookie = 'azzuniqe_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;';
    }

    globalActiveCompany = null;
    globalAuthorizedCompanies = [];
    globalCurrentUser = null;
    globalIsLoaded = false;

    isInitialLoadDone.current = false;
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
    refreshSession: () => loadCompanySession(true),
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

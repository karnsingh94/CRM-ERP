'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, API_BASE } from '../lib/api';
import { useCompanyAuthContext } from '../context/CompanyAuthContext';

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

      // 2. Fallback to cached session if backend returned unparseable or error
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
        isDepartmentHead: verifiedUser.role === 'DEPARTMENT_HEAD',
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
            setActiveCompany(companyData);
            setAuthorizedCompanies([companyData]);
            if (typeof window !== 'undefined') {
              localStorage.setItem('active_company_id', String(companyData.id));
            }
          } else {
            // Minimal company object from session
            setActiveCompany({
              id: targetCompanyId,
              name: verifiedUser.organizationName || verifiedUser.name,
              organizationName: verifiedUser.organizationName || verifiedUser.name,
              email: verifiedUser.email,
              status: 'ACTIVE',
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

    if (typeof window !== 'undefined') {
      localStorage.removeItem('azzuniqe_client_token');
      sessionStorage.removeItem('azzuniqe_client_token');
      localStorage.removeItem('company_user');
      sessionStorage.removeItem('company_user');
      localStorage.removeItem('active_company_id');
      sessionStorage.removeItem('active_company_id');

      // Clear cookie
      document.cookie = 'azzuniqe_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;';
    }

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

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { verifyCurrentSession, getStoredUser } from '@/lib/auth';
import SuperAdminPortal from '@/components/super-admin/SuperAdminPortal';
import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';
import DepartmentHeadDashboardFeature from '@/features/department-head/dashboard';
import EmployeeDashboardFeature from '@/features/employee/dashboard';

export default function RootHomePage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isResolving, setIsResolving] = useState(true);

  useEffect(() => {
    setIsMounted(true);
    let mounted = true;

    async function checkUserSession() {
      try {
        const user = await verifyCurrentSession();
        if (!mounted) return;

        if (!user) {
          router.replace('/login');
          return;
        }

        setCurrentUser(user);
      } catch (err) {
        console.error('Session check error:', err);
        const fallback = getStoredUser();
        if (mounted && fallback) {
          setCurrentUser(fallback);
        } else if (mounted) {
          router.replace('/login');
        }
      } finally {
        if (mounted) setIsResolving(false);
      }
    }

    checkUserSession();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (!isMounted || (isResolving && !currentUser)) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          color: '#1e293b',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          gap: '1rem',
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            border: '3px solid #e2e8f0',
            borderTopColor: '#7f22fe',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ fontSize: '0.88rem', color: '#64748b', fontWeight: 600 }}>
          Initializing workspace...
        </p>
        <style jsx global>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  if (currentUser?.role === 'SUPER_ADMIN') {
    return <SuperAdminPortal initialTab="dashboard" />;
  }

  if (currentUser?.role === 'DEPARTMENT_HEAD') {
    return <DepartmentHeadDashboardFeature />;
  }

  if (currentUser?.role === 'EMPLOYEE') {
    return <EmployeeDashboardFeature />;
  }

  if (currentUser?.role === 'COMPANY_ADMIN') {
    return <CompanyAdminPortal initialTab="dashboard" />;
  }

  // Fallback safety
  return <CompanyAdminPortal initialTab="dashboard" />;
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { verifyCurrentSession } from '@/lib/auth';
import SuperAdminPortal from '@/components/super-admin/SuperAdminPortal';
import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export default function UnifiedDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [isResolving, setIsResolving] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function resolveSession() {
      try {
        const user = await verifyCurrentSession();
        if (!mounted) return;
        if (!user) {
          router.replace('/login?redirect=/dashboard');
          return;
        }
        setCurrentUser(user);
      } catch {
        if (mounted) router.replace('/login?redirect=/dashboard');
      } finally {
        if (mounted) setIsResolving(false);
      }
    }
    resolveSession();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (isResolving) {
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
            borderTopColor: '#2563eb',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ fontSize: '0.88rem', color: '#64748b', fontWeight: 600 }}>
          Loading dashboard...
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

  return <CompanyAdminPortal initialTab="dashboard" />;
}

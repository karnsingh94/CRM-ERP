'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getCachedStoredUser,
  getStoredToken,
  restoreSuperAdminSession,
  verifyCurrentSession,
} from '@/lib/auth';

export default function SuperAdminLayout({ children }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    restoreSuperAdminSession();
    const cachedUser = getCachedStoredUser();

    if (cachedUser?.role === 'SUPER_ADMIN') {
      setAuthorized(true);
      setIsChecking(false);
    }

    async function checkSuperAdmin() {
      try {
        const user = await verifyCurrentSession();
        if (!mounted) return;

        if (user?.role === 'SUPER_ADMIN') {
          setAuthorized(true);
        } else if (user) {
          setAuthorized(false);
          router.replace('/login?redirect=/super-admin');
        } else if (!(getStoredToken() && cachedUser?.role === 'SUPER_ADMIN')) {
          setAuthorized(false);
          router.replace('/login?redirect=/super-admin');
        } else {
          setAuthorized(true);
        }
      } catch (err) {
        console.error('Super Admin session error:', err);
        if (mounted && !(getStoredToken() && cachedUser?.role === 'SUPER_ADMIN')) {
          setAuthorized(false);
          router.replace('/login?redirect=/super-admin');
        }
      } finally {
        if (mounted) setIsChecking(false);
      }
    }

    checkSuperAdmin();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (isChecking || !authorized) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#e2e8f0',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          gap: '1rem',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            border: '3px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: '#7f22fe',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>
          Verifying Super Admin Authorization...
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

  return <>{children}</>;
}

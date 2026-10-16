'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { API_BASE } from '../../lib/api';

const ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:3001'];

export default function UnifiedLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const authTokenParam = searchParams.get('auth_token');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [verifyingSession, setVerifyingSession] = useState(true);

  // Cross-origin token transfer & session verification on mount
  useEffect(() => {
    async function initSession() {
      // 1. Check for incoming cross-origin handoff token
      if (authTokenParam) {
        try {
          const res = await fetch(`${API_BASE}/auth/me`, {
            credentials: 'include',
            headers: { Authorization: `Bearer ${authTokenParam}` },
          });
          if (res.ok) {
            const body = await res.json();
            const user = body?.data?.user || body?.data;
            if (user) {
              if (user.role === 'SUPER_ADMIN') {
                localStorage.setItem('azzuniqe_super_token', authTokenParam);
                sessionStorage.setItem('azzuniqe_super_token', authTokenParam);
                localStorage.setItem('auth_user', JSON.stringify(user));
              } else {
                localStorage.setItem('azzuniqe_client_token', authTokenParam);
                sessionStorage.setItem('azzuniqe_client_token', authTokenParam);
                localStorage.setItem('company_user', JSON.stringify(user));
                if (user.companyId) {
                  localStorage.setItem('active_company_id', String(user.companyId));
                }
              }

              const target = redirectParam && redirectParam.startsWith('/')
                ? redirectParam
                : (user.role === 'SUPER_ADMIN' ? '/' : '/dashboard');
              router.replace(target);
              return;
            }
          }
        } catch {
          // Fall through to existing session check
        }
      }

      // 2. Check existing local session
      try {
        const storedToken =
          typeof window !== 'undefined'
            ? localStorage.getItem('azzuniqe_client_token') ||
              sessionStorage.getItem('azzuniqe_client_token') ||
              localStorage.getItem('azzuniqe_super_token') ||
              sessionStorage.getItem('azzuniqe_super_token')
            : null;

        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: 'include',
          headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
        });

        if (res.ok) {
          const body = await res.json();
          const user = body?.data?.user || body?.data;
          if (user) {
            if (user.role === 'SUPER_ADMIN') {
              // Redirect Super Admin to Super Admin portal if currently on Company Admin
              if (typeof window !== 'undefined' && window.location.port === '3001') {
                window.location.href = 'http://localhost:3000/';
                return;
              }
              router.replace('/');
              return;
            } else if (
              user.role === 'COMPANY_ADMIN' ||
              user.role === 'DEPARTMENT_HEAD' ||
              user.role === 'EMPLOYEE'
            ) {
              const target = redirectParam && redirectParam.startsWith('/') ? redirectParam : '/dashboard';
              router.replace(target);
              return;
            }
          }
        }
      } catch {
        // Not authenticated
      } finally {
        setVerifyingSession(false);
      }
    }

    initSession();
  }, [router, redirectParam, authTokenParam]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!formData.email.trim() || !formData.password.trim()) {
      setErrorMessage('Please enter both your work email and password.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password.trim(),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        setErrorMessage(
          data?.message || 'Authentication failed. Please verify your email and password.'
        );
        setLoading(false);
        return;
      }

      const { user, token, redirectUrl, targetOrigin } = data.data || data;

      // Persist session
      const storage = formData.rememberMe ? localStorage : sessionStorage;
      if (user.role === 'SUPER_ADMIN') {
        localStorage.setItem('azzuniqe_super_token', token);
        sessionStorage.setItem('azzuniqe_super_token', token);
        storage.setItem('auth_user', JSON.stringify(user));
      } else {
        localStorage.setItem('azzuniqe_client_token', token);
        sessionStorage.setItem('azzuniqe_client_token', token);
        storage.setItem('company_user', JSON.stringify(user));
        if (user.companyId) {
          storage.setItem('active_company_id', String(user.companyId));
        }
      }

      setSuccessMessage(`Welcome back, ${user.name || user.email}! Routing to workspace...`);

      // Determine destination
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const safeTargetOrigin = ALLOWED_ORIGINS.includes(targetOrigin) ? targetOrigin : currentOrigin;

      // Cross-origin redirection if user belongs to another portal
      if (safeTargetOrigin && safeTargetOrigin !== currentOrigin) {
        setTimeout(() => {
          const finalTarget = redirectParam && redirectParam.startsWith('/') ? redirectParam : (redirectUrl || '/');
          window.location.href = `${safeTargetOrigin}/login?auth_token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(finalTarget)}`;
        }, 600);
        return;
      }

      // Same-origin navigation
      const destination = redirectParam && redirectParam.startsWith('/')
        ? redirectParam
        : (user.role === 'SUPER_ADMIN' ? '/' : (redirectUrl || '/dashboard'));

      setTimeout(() => {
        router.replace(destination);
      }, 600);
    } catch {
      setErrorMessage('Network connection error. Please verify the backend service is running.');
      setLoading(false);
    }
  };

  if (verifyingSession) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #EEF4FF 0%, #F5F3FF 50%, #EDE9FE 100%)',
          color: '#475569',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.95rem', fontWeight: 600 }}>
          <div
            style={{
              width: '20px',
              height: '20px',
              border: '2.5px solid #2563eb',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          Verifying security session...
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #EEF4FF 0%, #F5F3FF 45%, #EDE9FE 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem 1rem',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Two-Column Responsive Enterprise Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '880px',
          background: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 20px 50px -15px rgba(37, 99, 235, 0.12), 0 0 0 1px rgba(226, 232, 240, 0.9)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          animation: 'fadeInUp 0.3s ease-out',
        }}
      >
        {/* Left Visual Enterprise Panel */}
        <div
          style={{
            flex: '1 1 380px',
            background: 'linear-gradient(145deg, #1e3a8a 0%, #2563eb 55%, #4f46e5 100%)',
            padding: '2.25rem 2rem',
            color: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle Background Pattern Elements */}
          <div
            style={{
              position: 'absolute',
              top: '-40px',
              right: '-40px',
              width: '160px',
              height: '160px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 70%)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-30px',
              left: '-30px',
              width: '140px',
              height: '140px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(124,58,237,0.3) 0%, rgba(124,58,237,0) 70%)',
              pointerEvents: 'none',
            }}
          />

          <div>
            {/* Enterprise Logo Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.35rem 0.8rem',
                borderRadius: '9999px',
                background: 'rgba(255, 255, 255, 0.14)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                marginBottom: '1.25rem',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                AZZUNIQE CRM &amp; ERP
              </span>
            </div>

            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                lineHeight: 1.25,
                margin: '0 0 0.5rem 0',
                letterSpacing: '-0.025em',
              }}
            >
              Enterprise Resource &amp; Governance Platform
            </h2>
            <p
              style={{
                fontSize: '0.84rem',
                lineHeight: 1.55,
                color: 'rgba(255, 255, 255, 0.9)',
                margin: '0 0 1.35rem 0',
                fontWeight: 400,
              }}
            >
              Unified cloud portal managing platform catalogues, tenant workspaces, departmental pipelines, and operations.
            </p>

            {/* Concise Feature Highlights (Max 2) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {[
                { title: 'Super Admin Governance', desc: 'Centralized catalogue, company provisioning & audit tracking' },
                { title: 'Multi-Tenant Workspaces', desc: 'CRM, Sales, Purchase, Warehouse & Operations pipelines' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '0.6rem 0.8rem',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    ✓
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{item.title}</div>
                    <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: '1px' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Security Trust Banner */}
          <div
            style={{
              marginTop: '1.75rem',
              paddingTop: '0.85rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.18)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.74rem',
              color: 'rgba(255, 255, 255, 0.85)',
            }}
          >
            <span style={{ fontSize: '0.85rem' }}>🔒</span>
            <span>256-Bit Cryptographic SSL • Strict RBAC Boundary Guard</span>
          </div>
        </div>

        {/* Right Form Card Panel */}
        <div
          style={{
            flex: '1 1 420px',
            padding: '2.25rem 2.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: '1.35rem' }}>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: '#111827',
                margin: '0 0 0.35rem 0',
                letterSpacing: '-0.02em',
              }}
            >
              Sign In to AZZUNIQE
            </h1>
            <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0 }}>
              Unified access point for all platform and company accounts
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.7rem 0.9rem',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem',
                fontWeight: 600,
                animation: 'fadeIn 0.2s ease',
              }}
            >
              <span>⛔</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.7rem 0.9rem',
                borderRadius: '8px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem',
                fontWeight: 600,
                animation: 'fadeIn 0.2s ease',
              }}
            >
              <span>✅</span>
              <span>{successMessage}</span>
            </div>
          )}

          {/* Canonical Login Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '0.95rem' }}>
              <label
                htmlFor="unified-email"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#1e293b',
                  marginBottom: '0.35rem',
                }}
              >
                Work Email Address
              </label>
              <input
                id="unified-email"
                type="email"
                autoComplete="email"
                required
                placeholder="name@company.com or admin@azzuniqe.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.72rem 0.9rem',
                  borderRadius: '9px',
                  border: '1.5px solid #e2e8f0',
                  background: '#f8fafc',
                  fontSize: '0.88rem',
                  color: '#111827',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s ease',
                }}
              />
            </div>

            <div style={{ marginBottom: '0.95rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label
                  htmlFor="unified-password"
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#1e293b',
                  }}
                >
                  Password
                </label>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="unified-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.72rem 2.85rem 0.72rem 0.9rem',
                    borderRadius: '9px',
                    border: '1.5px solid #e2e8f0',
                    background: '#f8fafc',
                    fontSize: '0.88rem',
                    color: '#111827',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s ease',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.2rem',
                    userSelect: 'none',
                  }}
                >
                  {showPassword ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="23" x2="23" y2="1" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.25rem',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.8rem',
                  color: '#475569',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                  style={{ width: '15px', height: '15px', accentColor: '#2563eb' }}
                />
                Remember session
              </label>

              <Link
                href="/forgot-password"
                style={{
                  fontSize: '0.8rem',
                  color: '#2563eb',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#1d4ed8')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#2563eb')}
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.82rem',
                borderRadius: '9px',
                background: loading ? '#93c5fd' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.92rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.55rem',
              }}
            >
              {loading ? (
                <>
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      border: '2.5px solid #ffffff',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  Authenticating...
                </>
              ) : (
                'Sign In to Workspace'
              )}
            </button>
          </form>

          {/* Secure Trust Note */}
          <div
            style={{
              marginTop: '1.25rem',
              paddingTop: '0.85rem',
              borderTop: '1px solid #f1f5f9',
              textAlign: 'center',
              fontSize: '0.72rem',
              color: '#94a3b8',
              lineHeight: 1.45,
            }}
          >
            Role, company tenant, and permissions are determined automatically from your authenticated identity.
          </div>
        </div>
      </div>
    </div>
  );
}

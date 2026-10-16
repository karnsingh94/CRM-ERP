'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function SuperAdminResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const emailParam = searchParams.get('email');

  const [verifyingToken, setVerifyingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Validate token with backend upon loading
  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setTokenValid(false);
        setTokenError('No password reset token was provided in the URL.');
        setVerifyingToken(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/verify-reset-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, email: emailParam }),
        });
        const data = await res.json();

        if (data.valid) {
          setTokenValid(true);
          setVerifiedEmail(data.email || emailParam || '');
        } else {
          setTokenValid(false);
          setTokenError(data.message || 'This password reset link is invalid or has expired.');
        }
      } catch {
        setTokenValid(false);
        setTokenError('Unable to connect to security server to verify reset token.');
      } finally {
        setVerifyingToken(false);
      }
    }

    verifyToken();
  }, [token, emailParam]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Password and confirmation do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email: verifiedEmail,
          password,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResetSuccess(true);
      } else {
        setErrorMessage(data.message || 'Failed to update password. Please request a new reset link.');
      }
    } catch {
      setErrorMessage('Network error communicating with authentication service.');
    } finally {
      setLoading(false);
    }
  };

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
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 20px 50px -15px rgba(37, 99, 235, 0.12), 0 0 0 1px rgba(226, 232, 240, 0.9)',
          padding: '2.5rem 2.25rem',
          boxSizing: 'border-box',
          animation: 'fadeInUp 0.3s ease-out',
        }}
      >
        {/* Top Branding Badge */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.55rem',
              padding: '0.35rem 0.8rem',
              borderRadius: '9999px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#2563eb',
              marginBottom: '1rem',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.04em' }}>
              AZZUNIQE CRM &amp; ERP
            </span>
          </div>

          <h1
            style={{
              fontSize: '1.45rem',
              fontWeight: 800,
              color: '#111827',
              margin: '0 0 0.4rem 0',
              letterSpacing: '-0.02em',
            }}
          >
            Reset Password
          </h1>
          <p
            style={{
              fontSize: '0.84rem',
              color: '#64748b',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {verifiedEmail ? `Creating new credentials for ${verifiedEmail}` : 'Set a new secure password for your account'}
          </p>
        </div>

        {/* State 1: Verifying Token */}
        {verifyingToken && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                border: '3px solid #2563eb',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 1rem auto',
              }}
            />
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#475569' }}>
              Validating security token...
            </div>
          </div>
        )}

        {/* State 2: Invalid or Expired Token */}
        {!verifyingToken && !tokenValid && (
          <div>
            <div
              style={{
                padding: '1.25rem 1rem',
                borderRadius: '12px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: '0.85rem',
                lineHeight: 1.55,
                textAlign: 'center',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>⚠️</div>
              <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Invalid or Expired Link</div>
              <div>{tokenError}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Link
                href="/forgot-password"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '0.78rem',
                  borderRadius: '9px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Request a New Reset Link
              </Link>
              <Link
                href="/login"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '0.75rem',
                  color: '#64748b',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        )}

        {/* State 3: Password Reset Completed Successfully */}
        {!verifyingToken && tokenValid && resetSuccess && (
          <div>
            <div
              style={{
                padding: '1.25rem 1rem',
                borderRadius: '12px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                fontSize: '0.85rem',
                lineHeight: 1.55,
                textAlign: 'center',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>🎉</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                Password Updated Successfully
              </div>
              <div>
                Your account password has been updated. You can now log in securely with your new credentials.
              </div>
            </div>

            <Link
              href="/login"
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '0.82rem',
                borderRadius: '9px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                fontSize: '0.92rem',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)',
              }}
            >
              Sign In to Workspace →
            </Link>
          </div>
        )}

        {/* State 4: Valid Token — Set New Password Form */}
        {!verifyingToken && tokenValid && !resetSuccess && (
          <form onSubmit={handleSubmit}>
            {errorMessage && (
              <div
                style={{
                  marginBottom: '1.25rem',
                  padding: '0.75rem 0.95rem',
                  borderRadius: '9px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  fontWeight: 600,
                }}
              >
                <span>⛔</span>
                <span>{errorMessage}</span>
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="super-reset-new-password"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#1e293b',
                  marginBottom: '0.35rem',
                }}
              >
                New Password (minimum 8 characters)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="super-reset-new-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  autoComplete="new-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                  }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '1.35rem' }}>
              <label
                htmlFor="super-reset-confirm-password"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#1e293b',
                  marginBottom: '0.35rem',
                }}
              >
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="super-reset-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
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
                  }}
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || password.length < 8 || password !== confirmPassword}
              style={{
                width: '100%',
                padding: '0.82rem',
                borderRadius: '9px',
                background:
                  loading || password.length < 8 || password !== confirmPassword
                    ? '#93c5fd'
                    : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.92rem',
                fontWeight: 700,
                cursor:
                  loading || password.length < 8 || password !== confirmPassword
                    ? 'not-allowed'
                    : 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.55rem',
                marginBottom: '1.25rem',
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
                  Updating password...
                </>
              ) : (
                'Set New Password & Sign In'
              )}
            </button>

            <div style={{ textAlign: 'center' }}>
              <Link
                href="/login"
                style={{
                  color: '#64748b',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Cancel and return to Sign In
              </Link>
            </div>
          </form>
        )}

        {/* Footer Security Note */}
        <div
          style={{
            marginTop: '1.75rem',
            paddingTop: '1rem',
            borderTop: '1px solid #f1f5f9',
            textAlign: 'center',
            fontSize: '0.72rem',
            color: '#94a3b8',
            lineHeight: 1.45,
          }}
        >
          Password is encrypted with salted bcrypt hashing. Single-use token is invalidated upon submission.
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function SuperAdminForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devResetLink, setDevResetLink] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setDevResetLink('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your work email address.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();

      if (res.ok) {
        setSubmitted(true);
        if (data.devResetLink) {
          setDevResetLink(data.devResetLink);
        }
      } else {
        setErrorMessage(data.message || 'Unable to process reset request. Please try again.');
      }
    } catch {
      setErrorMessage('Network error connecting to authentication server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f5f0ff 45%, #ede9fe 100%)',
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
          boxShadow: '0 20px 50px -15px rgba(127, 34, 254, 0.12), 0 0 0 1px rgba(226, 232, 240, 0.9)',
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
              background: '#f5f0ff',
              border: '1px solid #ebdfff',
              color: '#7f22fe',
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

          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #f5f0ff 0%, #ede9fe 100%)',
              border: '1px solid #d8bfff',
              color: '#7f22fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto',
              fontSize: '1.4rem',
            }}
          >
            🔐
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
            Forgot Password?
          </h1>
          <p
            style={{
              fontSize: '0.84rem',
              color: '#64748b',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Enter your work email address and we will send password reset instructions to your inbox.
          </p>
        </div>

        {/* Error Alert */}
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

        {/* Success Confirmation State */}
        {submitted ? (
          <div>
            <div
              style={{
                padding: '1.1rem 1rem',
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
              <div style={{ fontSize: '1.3rem', marginBottom: '0.4rem' }}>📩</div>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Instructions Dispatched</div>
              <div>
                If an account exists for <strong>{email}</strong>, password reset instructions have been sent.
              </div>
            </div>

            {/* Local Development Quick Link Banner */}
            {devResetLink && (
              <div
                style={{
                  marginBottom: '1.5rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  background: '#f0f9ff',
                  border: '1px dashed #0284c7',
                  fontSize: '0.8rem',
                  color: '#0369a1',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>⚙️ Development Verification Link:</div>
                <a
                  href={devResetLink}
                  style={{
                    color: '#7f22fe',
                    fontWeight: 600,
                    wordBreak: 'break-all',
                    textDecoration: 'underline',
                  }}
                >
                  Click here to proceed to Password Reset
                </a>
              </div>
            )}

            <div style={{ textAlign: 'center' }}>
              <Link
                href="/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  color: '#7f22fe',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                ← Return to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label
                htmlFor="forgot-email"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#1e293b',
                  marginBottom: '0.4rem',
                }}
              >
                Work Email Address
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                placeholder="admin@azzuniqe.com or name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem 0.95rem',
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

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.82rem',
                borderRadius: '9px',
                background: loading ? '#c4b5fd' : 'linear-gradient(135deg, #7f22fe 0%, #6b12df 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.92rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(127, 34, 254, 0.35)',
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
                  Sending instructions...
                </>
              ) : (
                'Request Reset Link'
              )}
            </button>

            <div style={{ textAlign: 'center' }}>
              <Link
                href="/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  color: '#475569',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#7f22fe')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
              >
                ← Back to Login
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
          Single-use reset tokens expire in 15 minutes. No plaintext credentials are ever transmitted or stored.
        </div>
      </div>
    </div>
  );
}

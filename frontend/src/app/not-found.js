'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '520px',
          width: '100%',
          background: 'rgba(30, 41, 59, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '3rem 2.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div
          style={{
            fontSize: '4.5rem',
            fontWeight: 900,
            letterSpacing: '-2px',
            color: '#3b82f6',
            lineHeight: 1,
            marginBottom: '1rem',
          }}
        >
          404
        </div>
        <h1
          style={{
            fontSize: '1.4rem',
            fontWeight: 800,
            color: '#ffffff',
            marginBottom: '0.75rem',
          }}
        >
          Route Not Found
        </h1>
        <p
          style={{
            fontSize: '0.9rem',
            color: '#94a3b8',
            lineHeight: 1.6,
            marginBottom: '2rem',
          }}
        >
          The page or workspace route you requested does not exist or has been relocated.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <Link
            href="/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.88rem',
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
              transition: 'background 0.15s ease',
            }}
          >
            ← Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

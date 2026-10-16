import Link from 'next/link';

export const metadata = {
  title: '404 - Page Not Found | AZZUNIQE Company Admin',
  description: 'The requested company workspace page could not be found.',
};

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        padding: '2rem',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
          padding: '3.5rem 2.5rem',
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '3.5rem',
            marginBottom: '1rem',
          }}
        >
          🔍
        </div>
        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            color: '#0f172a',
            marginBottom: '0.75rem',
            letterSpacing: '-0.5px',
          }}
        >
          Page Not Found
        </h1>
        <p
          style={{
            fontSize: '0.95rem',
            color: '#64748b',
            lineHeight: 1.6,
            marginBottom: '2rem',
          }}
        >
          The requested company module or sub-module route does not exist or may have been moved.
        </p>
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
          }}
        >
          <Link
            href="/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: '#2563eb',
              color: '#ffffff',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.88rem',
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
            }}
          >
            ← Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

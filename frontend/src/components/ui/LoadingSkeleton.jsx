'use client';

export default function LoadingSkeleton({ rows = 4, height = '36px' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', margin: '1rem 0' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height,
            width: '100%',
            backgroundColor: '#e2e8f0',
            borderRadius: '8px',
            animation: 'pulse 1.5s ease-in-out infinite',
            opacity: 0.7 - (i * 0.1),
          }}
        />
      ))}
    </div>
  );
}

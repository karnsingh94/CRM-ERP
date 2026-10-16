'use client';

export default function EmptyState({
  icon = '📦',
  title = 'No Records Found',
  description = 'There are no active entries available for this view.',
  actionLabel,
  onAction,
}) {
  return (
    <div
      style={{
        padding: '3.5rem 1.5rem',
        textAlign: 'center',
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px dashed #cbd5e1',
        margin: '1rem 0',
      }}
    >
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{icon}</div>
      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
        {title}
      </h4>
      <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '420px', margin: '0 auto', lineHeight: 1.5 }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            marginTop: '1.25rem',
            padding: '0.6rem 1.25rem',
            background: '#2563eb',
            color: '#ffffff',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 700,
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

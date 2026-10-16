'use client';

export default function ToastContainer({ toasts, onRemove }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '24px',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '420px',
      width: '100%',
      pointerEvents: 'none',
    }}>
      {toasts.map((t) => {
        const isSuccess = t.type === 'success';
        const isDanger = t.type === 'danger';
        const isWarning = t.type === 'warning';

        const bg = isSuccess ? '#ecfdf5' : isDanger ? '#fef2f2' : isWarning ? '#fffbeb' : '#f0f9ff';
        const border = isSuccess ? '#10b981' : isDanger ? '#ef4444' : isWarning ? '#f59e0b' : '#0284c7';
        const text = isSuccess ? '#065f46' : isDanger ? '#991b1b' : isWarning ? '#92400e' : '#0369a1';
        const icon = isSuccess ? '✅' : isDanger ? '⛔' : isWarning ? '⚠️' : 'ℹ️';

        return (
          <div
            key={t.id}
            style={{
              pointerEvents: 'auto',
              background: bg,
              border: `1px solid ${border}`,
              borderLeft: `5px solid ${border}`,
              borderRadius: '10px',
              padding: '12px 16px',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              animation: 'fadeInSlide 0.25s ease-out',
            }}
          >
            <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: text }}>{t.title}</div>
              {t.message && (
                <div style={{ fontSize: '0.78rem', color: text, opacity: 0.9, marginTop: '2px', lineHeight: 1.4 }}>
                  {t.message}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onRemove(t.id)}
              style={{
                color: text,
                opacity: 0.6,
                fontSize: '1.2rem',
                lineHeight: 1,
                padding: '0 4px',
              }}
              aria-label="Close notification"
            >
              &times;
            </button>
          </div>
        );
      })}
    </div>
  );
}

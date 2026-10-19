'use client';

export default function Badge({
  children,
  variant = 'default', // 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'
  size = 'md', // 'sm' | 'md'
  className = '',
  style = {},
}) {
  const variantStyles = {
    default: { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' },
    success: { background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' },
    warning: { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' },
    danger: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' },
    info: { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' },
    primary: { background: '#f5f3ff', color: 'var(--primary, #7f22fe)', border: '1px solid #ddd6fe' },
  };

  const sizeStyles = {
    sm: { padding: '0.15rem 0.45rem', fontSize: '0.72rem', borderRadius: '4px' },
    md: { padding: '0.25rem 0.65rem', fontSize: '0.78rem', borderRadius: '6px' },
  };

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: '0.02em',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
}

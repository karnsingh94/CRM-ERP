'use client';

export default function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
  size = 'md', // 'sm' | 'md' | 'lg'
  disabled = false,
  loading = false,
  type = 'button',
  onClick,
  className = '',
  style = {},
  ...props
}) {
  const sizeStyles = {
    sm: { padding: '0.4rem 0.75rem', fontSize: '0.8rem', borderRadius: '7px' },
    md: { padding: '0.6rem 1.1rem', fontSize: '0.88rem', borderRadius: '9px' },
    lg: { padding: '0.8rem 1.5rem', fontSize: '0.96rem', borderRadius: '11px' },
  };

  const variantStyles = {
    primary: {
      background: 'linear-gradient(135deg, var(--primary, #7f22fe) 0%, var(--primary-hover, #6b12df) 100%)',
      color: '#ffffff',
      border: 'none',
      boxShadow: '0 2px 8px rgba(127, 34, 254, 0.25)',
    },
    secondary: {
      background: '#f1f5f9',
      color: '#334155',
      border: '1px solid #cbd5e1',
    },
    danger: {
      background: '#ef4444',
      color: '#ffffff',
      border: 'none',
      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)',
    },
    outline: {
      background: 'transparent',
      color: 'var(--primary, #7f22fe)',
      border: '1.5px solid var(--primary, #7f22fe)',
    },
    ghost: {
      background: 'transparent',
      color: '#64748b',
      border: 'none',
    },
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        fontWeight: 600,
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.15s ease-in-out',
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {loading && (
        <span
          style={{
            width: '14px',
            height: '14px',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      )}
      {children}
    </button>
  );
}

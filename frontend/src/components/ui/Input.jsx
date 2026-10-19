'use client';

export default function Input({
  label,
  error,
  helperText,
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
  disabled = false,
  required = false,
  className = '',
  style = {},
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: '0.82rem',
            fontWeight: 700,
            color: '#1e293b',
          }}
        >
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={className}
        style={{
          width: '100%',
          padding: '0.65rem 0.85rem',
          borderRadius: '8px',
          border: error ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0',
          background: disabled ? '#f1f5f9' : '#f8fafc',
          fontSize: '0.88rem',
          color: '#111827',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          boxSizing: 'border-box',
          outline: 'none',
          transition: 'border-color 0.15s ease',
          ...style,
        }}
        {...props}
      />
      {error && <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>{error}</span>}
      {helperText && !error && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{helperText}</span>}
    </div>
  );
}

'use client';

export default function Select({
  label,
  error,
  options = [],
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder = 'Select an option',
  className = '',
  style = {},
  ...props
}) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
      {label && (
        <label
          htmlFor={selectId}
          style={{
            fontSize: '0.82rem',
            fontWeight: 700,
            color: '#1e293b',
          }}
        >
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
      )}
      <select
        id={selectId}
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
          cursor: disabled ? 'not-allowed' : 'pointer',
          ...style,
        }}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => {
          const val = typeof opt === 'object' ? opt.value : opt;
          const lbl = typeof opt === 'object' ? opt.label : opt;
          return (
            <option key={val} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
      {error && <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>{error}</span>}
    </div>
  );
}

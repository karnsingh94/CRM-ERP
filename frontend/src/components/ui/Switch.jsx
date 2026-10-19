'use client';

export default function Switch({
  checked = false,
  onChange,
  disabled = false,
  label,
  id,
  className = '',
  style = {},
}) {
  const switchId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <label
      htmlFor={switchId}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.65rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
      className={className}
    >
      <div
        style={{
          position: 'relative',
          width: '38px',
          height: '22px',
          borderRadius: '9999px',
          background: checked ? 'var(--primary, #7f22fe)' : '#cbd5e1',
          transition: 'background-color 0.2s ease',
        }}
      >
        <input
          id={switchId}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange && onChange(e.target.checked)}
          disabled={disabled}
          style={{
            position: 'absolute',
            opacity: 0,
            width: 0,
            height: 0,
            margin: 0,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '2px',
            left: checked ? '18px' : '2px',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
      {label && (
        <span
          style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: '#334155',
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          }}
        >
          {label}
        </span>
      )}
    </label>
  );
}

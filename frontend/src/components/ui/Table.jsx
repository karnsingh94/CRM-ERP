'use client';

export default function Table({
  columns = [],
  data = [],
  keyExtractor = (item, idx) => item.id || idx,
  emptyMessage = 'No records found',
  isLoading = false,
  className = '',
  style = {},
}) {
  return (
    <div
      style={{
        width: '100%',
        overflowX: 'auto',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        ...style,
      }}
      className={className}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          fontSize: '0.85rem',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        }}
      >
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                style={{
                  padding: '0.8rem 1rem',
                  fontWeight: 700,
                  color: '#475569',
                  whiteSpace: 'nowrap',
                  width: col.width,
                  textAlign: col.align || 'left',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: '2.5rem',
                  textAlign: 'center',
                  color: '#64748b',
                }}
              >
                <div
                  style={{
                    display: 'inline-block',
                    width: '24px',
                    height: '24px',
                    border: '2.5px solid #e2e8f0',
                    borderTopColor: 'var(--primary, #7f22fe)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    marginBottom: '0.5rem',
                  }}
                />
                <div>Loading table records...</div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: '2.5rem',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontStyle: 'italic',
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              <tr
                key={keyExtractor(row, rowIdx)}
                style={{
                  borderBottom: rowIdx === data.length - 1 ? 'none' : '1px solid #f1f5f9',
                  transition: 'background-color 0.12s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {columns.map((col, colIdx) => (
                  <td
                    key={col.key || colIdx}
                    style={{
                      padding: '0.85rem 1rem',
                      color: '#1e293b',
                      verticalAlign: 'middle',
                      textAlign: col.align || 'left',
                    }}
                  >
                    {col.render ? col.render(row, rowIdx) : row[col.accessor || col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

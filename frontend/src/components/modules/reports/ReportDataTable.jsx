'use client';

import { useState } from 'react';
import styles from './reports.module.css';
import { formatIndianCurrency, formatNumber } from './ReportSummaryCards';

export default function ReportDataTable({
  title,
  subtitle,
  columns = [],
  data = [],
  totals = null,
  isLoading = false,
  error = null,
  onRetry = null,
  emptyMessage = 'No report records found for the selected criteria.',
  pagination = null,
  onPageChange = null,
  actions = null,
}) {
  const [searchTerm, setSearchTerm] = useState('');

  if (isLoading) {
    return (
      <div className={styles.tableCard} style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', width: '2rem', height: '2rem', border: '3px solid #e4e4e7', borderTopColor: '#7f22fe', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '0.75rem', color: '#71717a', fontSize: '0.85rem' }}>Loading report data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.tableCard} style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
        <span style={{ fontSize: '2rem' }}>⚠️</span>
        <h4 style={{ margin: '0.5rem 0 0.25rem', color: '#b91c1c', fontSize: '1rem', fontWeight: 700 }}>Failed to Load Report</h4>
        <p style={{ color: '#71717a', fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
          {error.message || String(error)}
        </p>
        {onRetry && (
          <button type="button" className={styles.btnSecondary} onClick={onRetry}>
            🔄 Retry
          </button>
        )}
      </div>
    );
  }

  // Filter rows if client-side search is typed
  const filteredData = searchTerm.trim()
    ? data.filter((row) =>
        Object.values(row).some((val) =>
          String(val || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    : data;

  return (
    <div className={styles.tableCard}>
      {(title || actions || columns.length > 0) && (
        <div className={styles.tableHeaderBar}>
          <div>
            {title && <div className={styles.tableTitle}>{title}</div>}
            {subtitle && <div style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '2px' }}>{subtitle}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {data.length > 5 && (
              <input
                type="text"
                placeholder="Search report..."
                className={`${styles.filterInput} no-print`}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', width: '180px' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            )}
            {actions}
          </div>
        </div>
      )}

      {filteredData.length === 0 ? (
        <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#71717a' }}>
          <span style={{ fontSize: '1.75rem' }}>📂</span>
          <p style={{ marginTop: '0.5rem', fontSize: '0.88rem' }}>{emptyMessage}</p>
        </div>
      ) : (
        <div className={styles.tableResponsive}>
          <table className={styles.reportTable}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key || col.label}
                    style={{
                      textAlign: col.align || (col.isNumeric ? 'right' : 'left'),
                      width: col.width,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, rIdx) => (
                <tr key={row.id || row.code || rIdx}>
                  {columns.map((col) => {
                    const rawVal = row[col.key];
                    let renderedVal = rawVal;

                    if (col.render) {
                      renderedVal = col.render(rawVal, row, rIdx);
                    } else if (col.format === 'currency') {
                      renderedVal = formatIndianCurrency(rawVal);
                    } else if (col.format === 'number') {
                      renderedVal = formatNumber(rawVal, col.decimals || 0);
                    } else if (col.format === 'percent') {
                      renderedVal = rawVal !== null && rawVal !== undefined ? `${rawVal}%` : '-';
                    } else if (col.format === 'date') {
                      renderedVal = rawVal ? new Date(rawVal).toLocaleDateString('en-IN') : '-';
                    } else if (rawVal === null || rawVal === undefined || rawVal === '') {
                      renderedVal = '-';
                    }

                    return (
                      <td
                        key={col.key}
                        style={{
                          textAlign: col.align || (col.isNumeric ? 'right' : 'left'),
                        }}
                      >
                        {renderedVal}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {totals && (
                <tr className={styles.totalRow}>
                  {columns.map((col, cIdx) => {
                    const totalVal = totals[col.key];
                    let renderedTotal = totalVal;
                    if (cIdx === 0 && !totalVal) {
                      renderedTotal = 'Total';
                    } else if (col.format === 'currency' && totalVal !== undefined) {
                      renderedTotal = formatIndianCurrency(totalVal);
                    } else if (col.format === 'number' && totalVal !== undefined) {
                      renderedTotal = formatNumber(totalVal, col.decimals || 0);
                    } else if (totalVal === undefined) {
                      renderedTotal = '';
                    }

                    return (
                      <td
                        key={`total-${col.key}`}
                        style={{
                          textAlign: col.align || (col.isNumeric ? 'right' : 'left'),
                        }}
                      >
                        {renderedTotal}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', color: '#71717a' }} className="no-print">
          <div>
            Page {pagination.page} of {pagination.totalPages} ({pagination.totalRecords} records)
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              className={styles.btnSecondary}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
              disabled={pagination.page <= 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange?.(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


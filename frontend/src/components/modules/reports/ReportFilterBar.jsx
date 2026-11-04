'use client';

import { useState } from 'react';
import styles from './reports.module.css';

export default function ReportFilterBar({
  filters = {},
  onApplyFilters,
  onResetFilters,
  extraFilters = null,
  isLoading = false,
}) {
  const [fromDate, setFromDate] = useState(filters.fromDate || '');
  const [toDate, setToDate] = useState(filters.toDate || '');
  const [error, setError] = useState('');

  const handleApply = (e) => {
    e?.preventDefault();
    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
      setError('Start date cannot be later than end date.');
      return;
    }
    setError('');
    onApplyFilters({
      ...filters,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    });
  };

  const handleReset = () => {
    setFromDate('');
    setToDate('');
    setError('');
    onResetFilters();
  };

  return (
    <div className={`${styles.filterCard} no-print`}>
      <form onSubmit={handleApply} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '0.85rem', width: '100%' }}>
        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>From Date</label>
          <input
            type="date"
            className={styles.filterInput}
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              if (error) setError('');
            }}
          />
        </div>

        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>To Date</label>
          <input
            type="date"
            className={styles.filterInput}
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              if (error) setError('');
            }}
          />
        </div>

        {extraFilters}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'auto' }}>
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Apply Filters'}
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={handleReset}
            disabled={isLoading}
          >
            Reset
          </button>
        </div>

        {error && (
          <div style={{ width: '100%', color: '#b91c1c', fontSize: '0.78rem', fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        )}
      </form>
    </div>
  );
}


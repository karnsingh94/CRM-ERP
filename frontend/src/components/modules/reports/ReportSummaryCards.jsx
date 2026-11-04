'use client';

import styles from './reports.module.css';

export function formatIndianCurrency(val) {
  if (val === null || val === undefined) return 'N/A';
  const num = Number(val);
  if (isNaN(num)) return 'N/A';
  return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatNumber(val, decimals = 0) {
  if (val === null || val === undefined) return 'N/A';
  const num = Number(val);
  if (isNaN(num)) return 'N/A';
  return num.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function ReportSummaryCards({ cards = [] }) {
  if (!cards || cards.length === 0) return null;

  return (
    <div className={styles.kpiGrid}>
      {cards.map((card, idx) => {
        let displayVal = card.value;
        if (card.format === 'currency') {
          displayVal = formatIndianCurrency(card.value);
        } else if (card.format === 'number') {
          displayVal = formatNumber(card.value, card.decimals || 0);
        } else if (card.format === 'percent') {
          displayVal = card.value !== null && card.value !== undefined ? `${card.value}%` : 'N/A';
        } else if (displayVal === null || displayVal === undefined) {
          displayVal = 'N/A';
        }

        return (
          <div key={card.id || card.label || idx} className={styles.kpiCard}>
            <div className={styles.kpiLabel}>
              <span>{card.label}</span>
              {card.icon && <span style={{ fontSize: '1.1rem' }}>{card.icon}</span>}
            </div>
            <div
              className={styles.kpiValue}
              style={{ color: card.color || (card.value === null || card.value === undefined ? '#71717a' : '#18181b') }}
            >
              {displayVal}
            </div>
            {card.subtext && <div className={styles.kpiSubtext}>{card.subtext}</div>}
          </div>
        );
      })}
    </div>
  );
}


'use client';

import styles from '../DispatchModule.module.css';

function currencyFmt(val) {
  return `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function numberFmt(val) {
  return Number(val || 0).toLocaleString('en-IN');
}

export default function DispatchDashboardTab({
  dispatchMetrics,
  returnsMetrics,
  creditMetrics,
  onNavigateTab,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* KPI Cards Grid */}
      <div className={styles.stats}>
        <div className={styles.stat} onClick={() => onNavigateTab('planning')} style={{ cursor: 'pointer' }}>
          <span>📦</span>
          <div>
            <strong>{numberFmt(dispatchMetrics?.pendingSalesOrders)}</strong>
            <small>Pending Sales Orders</small>
          </div>
        </div>

        <div className={styles.stat} onClick={() => onNavigateTab('challans')} style={{ cursor: 'pointer' }}>
          <span>📋</span>
          <div>
            <strong>{numberFmt(dispatchMetrics?.readyToDispatch)}</strong>
            <small>Ready to Dispatch</small>
          </div>
        </div>

        <div className={styles.stat} onClick={() => onNavigateTab('tracking')} style={{ cursor: 'pointer' }}>
          <span>🚚</span>
          <div>
            <strong>{numberFmt(dispatchMetrics?.inTransit)}</strong>
            <small>In-Transit Shipments</small>
          </div>
        </div>

        <div className={styles.stat} onClick={() => onNavigateTab('tracking')} style={{ cursor: 'pointer' }}>
          <span>✅</span>
          <div>
            <strong>{numberFmt(dispatchMetrics?.delivered)}</strong>
            <small>Delivered Shipments</small>
          </div>
        </div>

        <div className={styles.stat} onClick={() => onNavigateTab('returns')} style={{ cursor: 'pointer' }}>
          <span>🔄</span>
          <div>
            <strong>{numberFmt(returnsMetrics?.pendingRma)}</strong>
            <small>Pending RMA Requests</small>
          </div>
        </div>

        <div className={styles.stat} onClick={() => onNavigateTab('qc')} style={{ cursor: 'pointer' }}>
          <span>🔬</span>
          <div>
            <strong>{numberFmt(returnsMetrics?.awaitingInspection)}</strong>
            <small>Awaiting QC Inspection</small>
          </div>
        </div>

        <div className={styles.stat} onClick={() => onNavigateTab('creditNotes')} style={{ cursor: 'pointer' }}>
          <span>💳</span>
          <div>
            <strong>{numberFmt(creditMetrics?.pendingCreditNotes)}</strong>
            <small>Pending Credit Notes</small>
          </div>
        </div>

        <div className={styles.stat}>
          <span>💰</span>
          <div>
            <strong>{currencyFmt(returnsMetrics?.totalReturnFinancialExposure)}</strong>
            <small>Total Return Exposure</small>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className={styles.cardGrid}>
        {/* Outbound Dispatch Metrics */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h4 className={styles.cardTitle}>Outbound Dispatch Summary</h4>
              <p className={styles.cardSubtitle}>Fulfillment performance and dispatched volume</p>
            </div>
            <button className={styles.secondary} onClick={() => onNavigateTab('challans')}>View All</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Total Dispatched Value</span>
              <strong style={{ color: '#0f172a' }}>{currencyFmt(dispatchMetrics?.totalDispatchedAmount)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Total Dispatched Units</span>
              <strong style={{ color: '#0f172a' }}>{numberFmt(dispatchMetrics?.totalDispatchedQty)} Units</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.4rem 0' }}>
              <span style={{ color: '#64748b' }}>Failed Delivery Attempts</span>
              <strong style={{ color: Number(dispatchMetrics?.failed) > 0 ? '#b91c1c' : '#15803d' }}>
                {numberFmt(dispatchMetrics?.failed)}
              </strong>
            </div>
          </div>
        </div>

        {/* Returned Stock by QC Disposition */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h4 className={styles.cardTitle}>Returned Stock Dispositions</h4>
              <p className={styles.cardSubtitle}>Reintegrated into Phase 4 inventory buckets</p>
            </div>
            <button className={styles.secondary} onClick={() => onNavigateTab('qc')}>Inspect</button>
          </div>

          <div className={styles.dispositionPills}>
            <div className={styles.dispPill} style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
              <b>{numberFmt(returnsMetrics?.returnedStockByDisposition?.restockQty)}</b>
              <small>Available</small>
            </div>
            <div className={styles.dispPill} style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1e40af' }}>
              <b>{numberFmt(returnsMetrics?.returnedStockByDisposition?.reworkQty)}</b>
              <small>WIP Rework</small>
            </div>
            <div className={styles.dispPill} style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
              <b>{numberFmt(returnsMetrics?.returnedStockByDisposition?.rejectQty)}</b>
              <small>Rejected</small>
            </div>
            <div className={styles.dispPill} style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
              <b>{numberFmt(returnsMetrics?.returnedStockByDisposition?.scrapQty)}</b>
              <small>Scrap</small>
            </div>
          </div>
        </div>

        {/* Financial Adjustments & Credit Notes */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h4 className={styles.cardTitle}>Customer Credit Exposure</h4>
              <p className={styles.cardSubtitle}>GST tax reversal & restocking fees</p>
            </div>
            <button className={styles.secondary} onClick={() => onNavigateTab('creditNotes')}>Manage</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Gross Return Value</span>
              <strong style={{ color: '#0f172a' }}>{currencyFmt(creditMetrics?.totalGrossCredit)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>GST Reversal Reversed</span>
              <strong style={{ color: '#0369a1' }}>{currencyFmt(creditMetrics?.totalTaxReversed)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Restocking Fee Earned</span>
              <strong style={{ color: '#15803d' }}>+{currencyFmt(creditMetrics?.totalRestockingFee)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.4rem 0' }}>
              <span style={{ color: '#64748b' }}>Net Customer Credit Payable</span>
              <strong style={{ color: '#b45309' }}>{currencyFmt(creditMetrics?.totalNetCreditAmount)}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


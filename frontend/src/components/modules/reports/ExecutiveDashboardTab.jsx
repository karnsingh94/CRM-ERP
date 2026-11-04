'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './reports.module.css';
import { api } from '../../../lib/api';
import ReportSummaryCards from './ReportSummaryCards';
import ReportFilterBar from './ReportFilterBar';
import ReportExportActions from './ReportExportActions';

export default function ExecutiveDashboardTab({
  activeCompany,
  showToast,
  currentUser,
}) {
  const companyId = activeCompany?.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({});
  const [kpis, setKpis] = useState(null);

  const fetchKpis = useCallback(async (currentFilters = filters) => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (currentFilters.fromDate) queryParams.set('fromDate', currentFilters.fromDate);
      if (currentFilters.toDate) queryParams.set('toDate', currentFilters.toDate);

      const qs = queryParams.toString();
      const endpoint = `/companies/${companyId}/reports/executive/summary${qs ? `?${qs}` : ''}`;
      const res = await api.get(endpoint);
      if (res?.success) {
        setKpis(res.data);
      } else {
        throw new Error(res?.message || 'Failed to load executive KPIs');
      }
    } catch (err) {
      console.error('Executive KPIs error:', err);
      setError(err.message || 'Could not fetch executive dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }, [companyId, filters]);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  const cards = kpis ? [
    {
      id: 'sales_val',
      label: 'Total Sales Orders',
      value: kpis.sales?.totalOrderValue,
      format: 'currency',
      icon: '📈',
      subtext: `${kpis.sales?.totalOrdersCount ?? 0} confirmed orders`,
    },
    {
      id: 'receivables',
      label: 'Receivables Outstanding',
      value: kpis.sales?.receivablesOutstanding,
      format: 'currency',
      icon: '💰',
      color: '#b91c1c',
      subtext: `Invoiced: ₹ ${(kpis.sales?.totalInvoicedAmount || 0).toLocaleString('en-IN')}`,
    },
    {
      id: 'purchases',
      label: 'Purchase Commitments',
      value: kpis.purchases?.totalOrderValue,
      format: 'currency',
      icon: '🛒',
      subtext: `${kpis.purchases?.totalOrdersCount ?? 0} purchase orders`,
    },
    {
      id: 'payables',
      label: 'Payables Outstanding',
      value: kpis.purchases?.payablesOutstanding,
      format: 'currency',
      icon: '💳',
      color: '#c2410c',
      subtext: `Billed: ₹ ${(kpis.purchases?.totalBilledAmount || 0).toLocaleString('en-IN')}`,
    },
    {
      id: 'cash_bank',
      label: 'Cash & Bank Balance',
      value: kpis.treasury?.cashAndBankBalance,
      format: 'currency',
      icon: '🏦',
      color: '#15803d',
      subtext: `${kpis.treasury?.activeCashBankAccounts ?? 0} active accounts`,
    },
    {
      id: 'stock_val',
      label: 'Inventory Valuation',
      value: kpis.inventory?.availableStockValuation,
      format: 'currency',
      icon: '📦',
      subtext: `${(kpis.inventory?.totalAvailableStockUnits ?? 0).toLocaleString('en-IN')} units available`,
    },
    {
      id: 'dispatch_val',
      label: 'Dispatched Value',
      value: kpis.dispatch?.totalDispatchedValue,
      format: 'currency',
      icon: '🚚',
      subtext: `${kpis.dispatch?.activeDispatchesCount ?? 0} dispatches (${kpis.dispatch?.totalPackages ?? 0} packages)`,
    },
    {
      id: 'returns_val',
      label: 'Customer Credit Notes',
      value: kpis.returns?.totalCreditAmount,
      format: 'currency',
      icon: '↩️',
      color: '#71717a',
      subtext: `${kpis.returns?.totalCreditNotesIssued ?? 0} credit notes issued`,
    },
    {
      id: 'payroll_net',
      label: 'Monthly Net Payroll',
      value: kpis.payroll?.totalNetPay,
      format: 'currency',
      icon: '👥',
      subtext: kpis.payroll?.latestPayrollMonth ? `Period: ${kpis.payroll.latestPayrollMonth}` : 'No posted payroll batch',
    },
    {
      id: 'solar_gen',
      label: 'Solar Energy (Today)',
      value: kpis.solar?.energyGeneratedTodayKwh,
      format: 'number',
      decimals: 1,
      icon: '☀️',
      color: '#0284c7',
      subtext: `Active Power: ${kpis.solar?.currentActivePowerKw ?? 0} kW | Open Tickets: ${kpis.solar?.openMaintenanceTicketsCount ?? 0}`,
    },
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Controls & Filter Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }} className="no-print">
        <ReportFilterBar
          filters={filters}
          isLoading={loading}
          onApplyFilters={(newF) => {
            setFilters(newF);
            fetchKpis(newF);
          }}
          onResetFilters={() => {
            setFilters({});
            fetchKpis({});
          }}
        />
        <ReportExportActions
          companyId={companyId}
          reportType="executive-summary"
          canExport={false}
          reportTitle="Executive KPI Dashboard"
          showToast={showToast}
        />
      </div>

      {loading && (
        <div className={styles.tableCard} style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: '2.5rem', height: '2.5rem', border: '3px solid #e4e4e7', borderTopColor: '#7f22fe', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '0.75rem', color: '#71717a', fontSize: '0.9rem' }}>Loading executive KPIs...</p>
        </div>
      )}

      {error && !loading && (
        <div className={styles.tableCard} style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
          <span style={{ fontSize: '2rem' }}>⚠️</span>
          <h4 style={{ margin: '0.5rem 0 0.25rem', color: '#b91c1c', fontSize: '1rem', fontWeight: 700 }}>Unable to Load Executive Dashboard</h4>
          <p style={{ color: '#71717a', fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto 1.25rem' }}>{error}</p>
          <button type="button" className={styles.btnSecondary} onClick={() => fetchKpis()}>
            🔄 Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="print-only" style={{ display: 'none' }}>
            <h2>Executive Management Dashboard</h2>
            <p>Generated: {new Date().toLocaleString('en-IN')}</p>
          </div>

          <ReportSummaryCards cards={cards} />

          {/* Quick Breakdown Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            <div className={styles.tableCard} style={{ padding: '1.25rem' }}>
              <div className={styles.tableTitle} style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📊 Commercial & Working Capital
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f4f4f5', paddingBottom: '0.4rem' }}>
                  <span style={{ color: '#71717a' }}>Net Working Capital (Receivables + Cash - Payables):</span>
                  <strong>
                    ₹ {(
                      Number(kpis?.sales?.receivablesOutstanding || 0) +
                      Number(kpis?.treasury?.cashAndBankBalance || 0) -
                      Number(kpis?.purchases?.payablesOutstanding || 0)
                    ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f4f4f5', paddingBottom: '0.4rem' }}>
                  <span style={{ color: '#71717a' }}>Total Invoiced vs Billed:</span>
                  <span>
                    ₹ {(kpis?.sales?.totalInvoicedAmount || 0).toLocaleString('en-IN')} / ₹ {(kpis?.purchases?.totalBilledAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#71717a' }}>Gross Payroll Commitment:</span>
                  <span>₹ {(kpis?.payroll?.totalGrossPay || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className={styles.tableCard} style={{ padding: '1.25rem' }}>
              <div className={styles.tableTitle} style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🏭 Operations & Clean Energy
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f4f4f5', paddingBottom: '0.4rem' }}>
                  <span style={{ color: '#71717a' }}>Dispatch Fulfillment (Packages):</span>
                  <strong>{kpis?.dispatch?.totalPackages || 0} packages dispatched</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f4f4f5', paddingBottom: '0.4rem' }}>
                  <span style={{ color: '#71717a' }}>Solar Instantaneous Power:</span>
                  <span>{kpis?.solar?.currentActivePowerKw || 0} kW</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#71717a' }}>Open Solar Maintenance Tickets:</span>
                  <span style={{ color: (kpis?.solar?.openMaintenanceTicketsCount || 0) > 0 ? '#b91c1c' : '#15803d', fontWeight: 700 }}>
                    {kpis?.solar?.openMaintenanceTicketsCount || 0} Open
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


'use client';

import { useState, useCallback } from 'react';
import styles from './reports.module.css';
import { api } from '../../../lib/api';
import ReportExportActions from './ReportExportActions';

const FLOW_TYPES = [
  {
    id: 'purchase-flow',
    label: '1. Purchase Three-Way Matching Flow',
    endpoint: '/cross-module/purchase-flow',
    idParam: 'purchaseOrderId',
    idPlaceholder: 'Enter Purchase Order ID (UUID)',
    description: 'Traces PO commitments against Goods Receipt Notes (GRN), Supplier Bills, and GL Vouchers.',
  },
  {
    id: 'sales-flow',
    label: '2. Sales Order Execution Flow',
    endpoint: '/cross-module/sales-flow',
    idParam: 'salesOrderId',
    idPlaceholder: 'Enter Sales Order ID (UUID)',
    description: 'Traces Sales Order confirmation, Production/Job Work link, Dispatch Orders, and Invoicing.',
  },
  {
    id: 'job-work-flow',
    label: '3. Job Work Material Reconciliation Flow',
    endpoint: '/cross-module/job-work-flow',
    idParam: 'jobWorkOrderId',
    idPlaceholder: 'Enter Job Work Order ID (UUID)',
    description: 'Traces raw material issuance to subcontractors, finished goods receipt, and excess scrap debits.',
  },
  {
    id: 'solar-maintenance-flow',
    label: '4. Solar Maintenance & Spares Flow',
    endpoint: '/cross-module/solar-maintenance-flow',
    idParam: 'ticketId',
    idPlaceholder: 'Enter Solar Maintenance Ticket ID (UUID)',
    description: 'Traces inverter fault alarm, technician ticket assignment, and FIFO spare parts consumption.',
  },
  {
    id: 'payroll-flow',
    label: '5. Payroll GL Accounting Flow',
    endpoint: '/cross-module/payroll-flow',
    idParam: 'batchId',
    idPlaceholder: 'Enter Payroll Batch ID (UUID)',
    description: 'Traces monthly payroll calculations, statutory deductions (EPF/ESIC/PT), and double-entry GL journal vouchers.',
  },
];

export default function CrossModuleFlowTab({
  activeCompany,
  showToast,
  currentUser,
}) {
  const companyId = activeCompany?.id;
  const [activeFlowId, setActiveFlowId] = useState('purchase-flow');
  const [entityId, setEntityId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [flowData, setFlowData] = useState(null);

  const activeFlow = FLOW_TYPES.find((f) => f.id === activeFlowId) || FLOW_TYPES[0];

  const handleTrace = useCallback(async (e) => {
    e?.preventDefault();
    if (!companyId) return;
    if (!entityId.trim()) {
      setError(`Please provide a valid ${activeFlow.idParam}.`);
      return;
    }

    setLoading(true);
    setError(null);
    setFlowData(null);

    try {
      const endpoint = `/companies/${companyId}/reports${activeFlow.endpoint}?${activeFlow.idParam}=${encodeURIComponent(entityId.trim())}`;
      const res = await api.get(endpoint);
      if (res?.success) {
        setFlowData(res.data);
      } else {
        throw new Error(res?.message || 'Flow trace query failed.');
      }
    } catch (err) {
      console.error('Cross-module flow trace error:', err);
      setError(err.message || 'Failed to trace cross-module workflow.');
    } finally {
      setLoading(false);
    }
  }, [companyId, activeFlow, entityId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Subtab selection */}
      <div className={`${styles.navTabs} no-print`}>
        {FLOW_TYPES.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`${styles.navTab} ${activeFlowId === f.id ? styles.navTabActive : ''}`}
            onClick={() => {
              setActiveFlowId(f.id);
              setEntityId('');
              setError(null);
              setFlowData(null);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Description & Query Form */}
      <div className={`${styles.tableCard} no-print`} style={{ padding: '1.25rem 1.5rem' }}>
        <p style={{ margin: '0 0 1rem 0', color: '#52525b', fontSize: '0.85rem' }}>
          {activeFlow.description}
        </p>

        <form onSubmit={handleTrace} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
          <input
            type="text"
            className={styles.filterInput}
            style={{ minWidth: '320px', flex: '1 1 300px' }}
            placeholder={activeFlow.idPlaceholder}
            value={entityId}
            onChange={(e) => {
              setEntityId(e.target.value);
              if (error) setError(null);
            }}
          />

          <button type="submit" className={styles.btnPrimary} disabled={loading}>
            {loading ? 'Tracing Flow...' : '🔍 Trace Cross-Module Flow'}
          </button>

          {flowData && (
            <ReportExportActions
              companyId={companyId}
              reportType="flow-trace"
              canExport={false}
              reportTitle={activeFlow.label}
              showToast={showToast}
            />
          )}
        </form>

        {error && (
          <div style={{ marginTop: '0.75rem', color: '#b91c1c', fontSize: '0.82rem', fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Trace Loading State */}
      {loading && (
        <div className={styles.tableCard} style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: '2.5rem', height: '2.5rem', border: '3px solid #e4e4e7', borderTopColor: '#7f22fe', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '0.75rem', color: '#71717a', fontSize: '0.88rem' }}>Reconciling cross-module audit trail...</p>
        </div>
      )}

      {/* Trace Results */}
      {!loading && flowData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Header Banner */}
          <div className={styles.headerCard}>
            <div>
              <div className={styles.headerTitle} style={{ fontSize: '1.1rem' }}>
                🔗 Flow Trace Result: {activeFlow.label}
              </div>
              <div className={styles.headerSubtitle}>
                Target Entity: <code>{entityId}</code> | Verified against company database records
              </div>
            </div>
            <span className={`${styles.badge} ${styles.badgeSuccess}`}>AUDIT VERIFIED</span>
          </div>

          {/* JSON Tree / Visual Steps */}
          <div className={styles.tableCard} style={{ padding: '1.25rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.92rem', fontWeight: 700, color: '#18181b' }}>
              Linked Workflow Stages & Data Payloads
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {Object.entries(flowData).map(([stageKey, stageVal]) => {
                const isArray = Array.isArray(stageVal);
                const count = isArray ? stageVal.length : (stageVal ? 1 : 0);

                return (
                  <div
                    key={stageKey}
                    style={{
                      border: '1px solid #e4e4e7',
                      borderRadius: '8px',
                      padding: '1rem',
                      background: '#fafafa',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', color: '#7f22fe' }}>
                        {stageKey.replace(/([A-Z])/g, ' $1')}
                      </span>
                      <span className={`${styles.badge} ${count > 0 ? styles.badgePrimary : styles.badgeNeutral}`}>
                        {count} linked {count === 1 ? 'record' : 'records'}
                      </span>
                    </div>

                    <pre style={{ margin: '0.5rem 0 0', padding: '0.65rem', background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '6px', fontSize: '0.75rem', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {JSON.stringify(stageVal, null, 2)}
                    </pre>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!loading && !flowData && !error && (
        <div className={styles.tableCard} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#71717a' }}>
          <span style={{ fontSize: '2rem' }}>🔍</span>
          <h4 style={{ margin: '0.5rem 0 0.25rem', color: '#18181b', fontSize: '0.95rem', fontWeight: 700 }}>
            No Flow Trace Executed
          </h4>
          <p style={{ fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto' }}>
            Enter a record ID above to inspect cross-module reconciliation between procurement, operations, dispatch, and accounting.
          </p>
        </div>
      )}
    </div>
  );
}


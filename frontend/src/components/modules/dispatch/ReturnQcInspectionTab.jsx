'use client';

import { useState } from 'react';
import styles from '../DispatchModule.module.css';
import Modal from '../../ui/Modal';
import EmptyState from '../../ui/EmptyState';

function numberFmt(val) {
  return Number(val || 0).toLocaleString('en-IN');
}

export default function ReturnQcInspectionTab({
  customerReturns = [],
  warehouses = [],
  loading = false,
  onInspectReturn,
  onRefresh,
}) {
  const [selectedReturnId, setSelectedReturnId] = useState(customerReturns.find((r) => r.status === 'GOODS_RECEIVED')?.id || customerReturns[0]?.id || null);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [targetWarehouseId, setTargetWarehouseId] = useState(warehouses[0]?.id || '');
  const [submitting, setSubmitting] = useState(false);

  // Per-item disposition inputs
  // { [sku]: { inspectedQty, restockQty, reworkQty, rejectQty, scrapQty, qcFindings } }
  const [dispositionInputs, setDispositionInputs] = useState({});

  const returnsAwaitingQC = customerReturns.filter((r) => r.status === 'GOODS_RECEIVED' || r.status === 'INSPECTED');
  const selectedReturn = customerReturns.find((r) => r.id === selectedReturnId) || returnsAwaitingQC[0];

  const handleOpenInspectModal = (ret) => {
    setSelectedReturnId(ret.id);
    const initialInputs = {};
    ret.items?.forEach((i) => {
      const pendingInspect = Math.max(0, Number(i.receivedQty || i.returnQty) - Number(i.inspectedQty || 0));
      initialInputs[i.sku] = {
        customerReturnItemId: i.id,
        sku: i.sku,
        inspectedQty: pendingInspect,
        restockQty: pendingInspect, // default to 100% restock
        reworkQty: 0,
        rejectQty: 0,
        scrapQty: 0,
        qcFindings: 'Goods inspected intact in quarantine.',
      };
    });
    setDispositionInputs(initialInputs);
    setTargetWarehouseId(ret.receivingWarehouseId || warehouses[0]?.id || '');
    setIsInspectModalOpen(true);
  };

  const handleDispositionChange = (sku, field, val) => {
    const num = Math.max(0, Number(val) || 0);
    setDispositionInputs((prev) => {
      const current = prev[sku] || {};
      return {
        ...prev,
        [sku]: {
          ...current,
          [field]: num,
        },
      };
    });
  };

  const handleInspectSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReturn) return;

    // Validate formula for each item: Restock + Rework + Reject + Scrap === Inspected
    const itemsPayload = [];
    for (const item of selectedReturn.items || []) {
      const inp = dispositionInputs[item.sku];
      if (!inp) continue;

      const restock = Number(inp.restockQty) || 0;
      const rework = Number(inp.reworkQty) || 0;
      const reject = Number(inp.rejectQty) || 0;
      const scrap = Number(inp.scrapQty) || 0;
      const inspected = Number(inp.inspectedQty) || 0;

      if (inspected <= 0) continue;

      const sumDispositions = restock + rework + reject + scrap;
      if (sumDispositions !== inspected) {
        alert(
          `Formula Mismatch for SKU ${item.sku}:\nRestock (${restock}) + Rework (${rework}) + Reject (${reject}) + Scrap (${scrap}) = ${sumDispositions}\nMust exactly equal Inspected Quantity (${inspected})!`
        );
        return;
      }

      itemsPayload.push({
        customerReturnItemId: inp.customerReturnItemId,
        sku: item.sku,
        inspectedQty: inspected,
        restockQty: restock,
        reworkQty: rework,
        rejectQty: reject,
        scrapQty: scrap,
        qcFindings: inp.qcFindings || 'Standard inspection completed.',
      });
    }

    if (itemsPayload.length === 0) {
      alert('Please specify at least one item with inspected quantity > 0.');
      return;
    }

    try {
      setSubmitting(true);
      await onInspectReturn(selectedReturn.id, {
        items: itemsPayload,
        targetWarehouseId,
      });
      setIsInspectModalOpen(false);
      alert('QC inspection completed and stock reintegrated into Phase 4 inventory buckets!');
    } catch (err) {
      alert(err.message || 'Inspection failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Returned Goods QC &amp; Inventory Reintegration</h3>
          <p>
            Quarantine inspection in RETURN_HOLD, strict disposition formula verification, and bucket routing (AVAILABLE, WIP, REJECTED, SCRAP)
          </p>
        </div>
        <div className={styles.quickActions}>
          <button className={styles.secondary} onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {returnsAwaitingQC.length === 0 ? (
        <EmptyState
          icon="🔬"
          title="No Returns Awaiting QC"
          description="Inward-receive approved returns in the Customer Returns tab to place stock into quarantine (RETURN_HOLD) for inspection."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem', alignItems: 'start' }}>
          {/* Returns Sidebar */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', background: '#fff', overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 800, fontSize: '0.82rem' }}>
              Quarantine Returns ({returnsAwaitingQC.length})
            </div>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {returnsAwaitingQC.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedReturnId(r.id)}
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    background: (selectedReturn?.id === r.id) ? '#f0f9ff' : 'transparent',
                    borderLeft: (selectedReturn?.id === r.id) ? '3px solid #0284c7' : '3px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>{r.rmaNo}</strong>
                    <span className={`${styles.badge} ${r.status === 'INSPECTED' ? styles.badgeGreen : styles.badgeAmber}`}>
                      {r.status === 'GOODS_RECEIVED' ? 'IN QUARANTINE' : r.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '3px' }}>
                    {r.customerName} &bull; {r.items?.length || 0} items
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Inspection View */}
          {selectedReturn && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', background: '#fff', padding: '1rem' }}>
                <div className={styles.sectionHeader} style={{ marginTop: 0, marginBottom: '0.75rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                      Inspection: {selectedReturn.rmaNo}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Customer: {selectedReturn.customerName} &nbsp;|&nbsp;
                      Reason: <span className={`${styles.badge} ${styles.badgeGray}`}>{selectedReturn.returnReason}</span> &nbsp;|&nbsp;
                      Status: <span className={`${styles.badge} ${selectedReturn.status === 'INSPECTED' ? styles.badgeGreen : styles.badgeAmber}`}>{selectedReturn.status}</span>
                    </span>
                  </div>

                  <div className={styles.quickActions}>
                    <button className={styles.primary} onClick={() => handleOpenInspectModal(selectedReturn)}>
                      🔬 Perform QC Inspection
                    </button>
                  </div>
                </div>

                {/* Return Items Inspection Summary */}
                <h5 style={{ fontSize: '0.82rem', fontWeight: 800, margin: '0 0 0.5rem', color: '#0f172a' }}>
                  Quarantine Line Items (RETURN_HOLD)
                </h5>

                <table className={styles.table} style={{ border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Product</th>
                      <th>Arrival Condition</th>
                      <th>Received Qty</th>
                      <th>Inspected Qty</th>
                      <th>Inspection Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReturn.items?.map((item) => (
                      <tr key={item.id}>
                        <td><code>{item.sku}</code></td>
                        <td>{item.productName}</td>
                        <td><span className={`${styles.badge} ${styles.badgeGray}`}>{item.conditionOnArrival || 'SEALED'}</span></td>
                        <td><strong>{numberFmt(item.receivedQty || item.returnQty)} {item.uom}</strong></td>
                        <td>{numberFmt(item.inspectedQty)} {item.uom}</td>
                        <td>
                          <span className={`${styles.badge} ${item.status === 'INSPECTED' ? styles.badgeGreen : styles.badgeAmber}`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Existing Inspection History */}
                {selectedReturn.inspections && selectedReturn.inspections.length > 0 && (
                  <div style={{ marginTop: '1.25rem' }}>
                    <h5 style={{ fontSize: '0.82rem', fontWeight: 800, margin: '0 0 0.5rem', color: '#0f172a' }}>
                      Completed Disposition Logs
                    </h5>
                    <table className={styles.table} style={{ border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                      <thead>
                        <tr>
                          <th>Inspection #</th>
                          <th>SKU</th>
                          <th>Restock (AVAILABLE)</th>
                          <th>Rework (WIP)</th>
                          <th>Reject (REJECTED)</th>
                          <th>Scrap (SCRAP)</th>
                          <th>Disposition</th>
                          <th>Inspector</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReturn.inspections.map((insp) => (
                          <tr key={insp.id}>
                            <td><code>{insp.inspectionNo}</code></td>
                            <td>{insp.sku}</td>
                            <td style={{ color: '#166534', fontWeight: 800 }}>+{numberFmt(insp.restockQty)}</td>
                            <td style={{ color: '#1e40af', fontWeight: 800 }}>+{numberFmt(insp.reworkQty)}</td>
                            <td style={{ color: '#991b1b', fontWeight: 800 }}>+{numberFmt(insp.rejectQty)}</td>
                            <td style={{ color: '#92400e', fontWeight: 800 }}>+{numberFmt(insp.scrapQty)}</td>
                            <td><span className={`${styles.badge} ${styles.badgeBlue}`}>{insp.disposition}</span></td>
                            <td>{insp.inspectedBy}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* QC INSPECTION MODAL */}
      <Modal isOpen={isInspectModalOpen} onClose={() => !submitting && setIsInspectModalOpen(false)} title={`QC Inspection Form: ${selectedReturn?.rmaNo}`} maxWidth="850px">
        <form onSubmit={handleInspectSubmit} className={styles.modalForm}>
          <div style={{ padding: '0.75rem', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '0.78rem', color: '#1e40af' }}>
            <strong>Mandatory Disposition Formula:</strong><br />
            Restock (AVAILABLE) + Rework (WIP) + Rejected (REJECTED) + Scrap (SCRAP) = Inspected Quantity
          </div>

          <div style={{ margin: '0.5rem 0' }}>
            {selectedReturn?.items?.map((item) => {
              const inp = dispositionInputs[item.sku] || {};
              const restock = Number(inp.restockQty) || 0;
              const rework = Number(inp.reworkQty) || 0;
              const reject = Number(inp.rejectQty) || 0;
              const scrap = Number(inp.scrapQty) || 0;
              const inspected = Number(inp.inspectedQty) || 0;
              const sum = restock + rework + reject + scrap;
              const isMatch = sum === inspected;

              return (
                <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem', marginBottom: '0.85rem', background: '#fcfcfd' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <strong>{item.sku} &bull; {item.productName}</strong>
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      Received in Quarantine: {numberFmt(item.receivedQty || item.returnQty)} {item.uom}
                    </span>
                  </div>

                  <div className={styles.formRow} style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                    <div className={styles.formGroup}>
                      <label>Inspected Qty</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={inp.inspectedQty ?? ''}
                        onChange={(e) => handleDispositionChange(item.sku, 'inspectedQty', e.target.value)}
                        style={{ fontWeight: 800 }}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label style={{ color: '#166534' }}>Restock (Available)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={inp.restockQty ?? ''}
                        onChange={(e) => handleDispositionChange(item.sku, 'restockQty', e.target.value)}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label style={{ color: '#1e40af' }}>Rework (WIP)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={inp.reworkQty ?? ''}
                        onChange={(e) => handleDispositionChange(item.sku, 'reworkQty', e.target.value)}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label style={{ color: '#991b1b' }}>Reject (Rejected)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={inp.rejectQty ?? ''}
                        onChange={(e) => handleDispositionChange(item.sku, 'rejectQty', e.target.value)}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label style={{ color: '#92400e' }}>Scrap (Scrap)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={inp.scrapQty ?? ''}
                        onChange={(e) => handleDispositionChange(item.sku, 'scrapQty', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Formula Verification Indicator */}
                  <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: isMatch ? '#166534' : '#b91c1c', fontWeight: 800 }}>
                      {isMatch ? `✓ Formula Balanced (${sum} = ${inspected})` : `⚠️ Sum mismatch (${sum} != ${inspected})`}
                    </span>
                    <input
                      type="text"
                      placeholder="QC findings and defect observations..."
                      value={inp.qcFindings || ''}
                      onChange={(e) => setDispositionInputs((prev) => ({
                        ...prev,
                        [item.sku]: { ...prev[item.sku], qcFindings: e.target.value },
                      }))}
                      style={{ width: '50%', padding: '0.2rem 0.4rem', fontSize: '0.72rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.formGroup}>
            <label>Target Warehouse for Reintegrated Stock</label>
            <select
              value={targetWarehouseId}
              onChange={(e) => setTargetWarehouseId(e.target.value)}
            >
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>{wh.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
            <button type="button" className={styles.secondary} onClick={() => setIsInspectModalOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={submitting}>
              {submitting ? 'Reintegrating Stock...' : 'Confirm QC & Reintegrate Stock'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}


'use client';

import { useState } from 'react';
import styles from '../DispatchModule.module.css';
import EmptyState from '../../ui/EmptyState';

function currencyFmt(val) {
  return `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function numberFmt(val) {
  return Number(val || 0).toLocaleString('en-IN');
}

export default function DispatchAllocationsTab({
  dispatchOrders = [],
  loading = false,
  onRunFIFOAllocation,
  onRefresh,
}) {
  const [selectedOrderId, setSelectedOrderId] = useState(dispatchOrders[0]?.id || null);
  const [allocating, setAllocating] = useState(false);

  const selectedOrder = dispatchOrders.find((d) => d.id === selectedOrderId) || dispatchOrders[0];

  const handleAllocate = async (orderId) => {
    try {
      setAllocating(true);
      await onRunFIFOAllocation(orderId);
    } catch (err) {
      alert(err.message || 'FIFO Allocation failed');
    } finally {
      setAllocating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Multi-Batch FIFO Stock Allocation</h3>
          <p>Inspect and execute multi-batch FIFO inventory deductions across warehouse stock</p>
        </div>
        <div className={styles.quickActions}>
          <button className={styles.secondary} onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {dispatchOrders.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No Active Dispatch Orders"
          description="Create a dispatch order from the Dispatch Planning tab to run FIFO batch allocations."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem', alignItems: 'start' }}>
          {/* Order Selector Sidebar */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', background: '#fff', overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 800, fontSize: '0.82rem' }}>
              Dispatch Orders ({dispatchOrders.length})
            </div>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {dispatchOrders.map((d) => (
                <div
                  key={d.id}
                  onClick={() => setSelectedOrderId(d.id)}
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    background: (selectedOrder?.id === d.id) ? '#f0f9ff' : 'transparent',
                    borderLeft: (selectedOrder?.id === d.id) ? '3px solid #0284c7' : '3px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>{d.dispatchNo}</strong>
                    <span className={`${styles.badge} ${d.status === 'DISPATCHED' ? styles.badgeGreen : styles.badgeBlue}`}>
                      {d.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '3px' }}>
                    {d.customerName} &bull; {d.items?.length || 0} items
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Allocation Detail View */}
          {selectedOrder && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', background: '#fff', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                      Order: {selectedOrder.dispatchNo}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Customer: {selectedOrder.customerName} &nbsp;|&nbsp; Sales Order: {selectedOrder.salesOrderNo || 'N/A'}
                    </span>
                  </div>

                  {!['DISPATCHED', 'DELIVERED', 'CANCELLED'].includes(selectedOrder.status) && (
                    <button
                      className={styles.primary}
                      onClick={() => handleAllocate(selectedOrder.id)}
                      disabled={allocating}
                    >
                      {allocating ? 'Allocating FIFO...' : '⚡ Re-Run FIFO Allocation'}
                    </button>
                  )}
                </div>

                {/* Items & Their Batch Breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {selectedOrder.items?.map((item) => {
                    const totalAllocated = item.batchAllocations?.reduce((sum, a) => sum + Number(a.allocatedQty), 0) || 0;
                    const required = Number(item.dispatchedQty);
                    const isFullyAllocated = totalAllocated >= required;

                    return (
                      <div
                        key={item.id}
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '0.75rem',
                          background: '#fcfcfd',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div>
                            <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>{item.sku}</strong> — {item.productName}
                          </div>
                          <div>
                            <span
                              className={`${styles.badge} ${isFullyAllocated ? styles.badgeGreen : styles.badgeAmber}`}
                            >
                              {isFullyAllocated ? 'Fully Allocated' : `Partial (${totalAllocated}/${required} ${item.uom})`}
                            </span>
                          </div>
                        </div>

                        {/* Batch Allocations Table */}
                        {item.batchAllocations && item.batchAllocations.length > 0 ? (
                          <table className={styles.table} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                            <thead>
                              <tr>
                                <th>Batch No</th>
                                <th>Allocated Qty</th>
                                <th>Unit Cost</th>
                                <th>Total Line Cost</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.batchAllocations.map((alloc) => (
                                <tr key={alloc.id}>
                                  <td><code>{alloc.batchNo}</code></td>
                                  <td><strong>{numberFmt(alloc.allocatedQty)} {item.uom}</strong></td>
                                  <td>{currencyFmt(alloc.unitCost)}</td>
                                  <td>{currencyFmt(Number(alloc.allocatedQty) * Number(alloc.unitCost))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div style={{ fontSize: '0.74rem', color: '#64748b', fontStyle: 'italic', padding: '0.4rem 0' }}>
                            No batches allocated yet. Click &quot;Re-Run FIFO Allocation&quot; above to allocate eligible available stock.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


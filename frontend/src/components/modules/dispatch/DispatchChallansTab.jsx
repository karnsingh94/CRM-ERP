'use client';

import { useState } from 'react';
import styles from '../DispatchModule.module.css';
import Modal from '../../ui/Modal';
import ConfirmDialog from '../../ui/ConfirmDialog';
import EmptyState from '../../ui/EmptyState';

function currencyFmt(val) {
  return `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function numberFmt(val) {
  return Number(val || 0).toLocaleString('en-IN');
}

export default function DispatchChallansTab({
  dispatchOrders = [],
  loading = false,
  onFetchDeliveryChallan,
  onGenerateGatePass,
  onExecuteDispatch,
  onCancelDispatch,
  onRefresh,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [challanDoc, setChallanDoc] = useState(null);
  const [isChallanModalOpen, setIsChallanModalOpen] = useState(false);
  const [isConfirmDispatchOpen, setIsConfirmDispatchOpen] = useState(false);
  const [orderToDispatch, setOrderToDispatch] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const filteredOrders = dispatchOrders.filter((d) => {
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      d.dispatchNo?.toLowerCase().includes(term) ||
      d.customerName?.toLowerCase().includes(term) ||
      d.salesOrderNo?.toLowerCase().includes(term) ||
      d.vehicleNo?.toLowerCase().includes(term) ||
      d.ewayBillNo?.toLowerCase().includes(term)
    );
  });

  const handleViewChallan = async (order) => {
    setSelectedOrder(order);
    try {
      setActionLoading(true);
      const doc = await onFetchDeliveryChallan(order.id);
      setChallanDoc(doc);
      setIsChallanModalOpen(true);
    } catch (err) {
      alert(err.message || 'Failed to fetch Delivery Challan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGatePass = async (orderId) => {
    try {
      setActionLoading(true);
      const res = await onGenerateGatePass(orderId);
      alert(`Outward Gate Pass ${res.gatePassNo} generated successfully!`);
    } catch (err) {
      alert(err.message || 'Failed to generate gate pass');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePromptDispatch = (order) => {
    setOrderToDispatch(order);
    setIsConfirmDispatchOpen(true);
  };

  const handleConfirmDispatch = async () => {
    if (!orderToDispatch) return;
    try {
      setActionLoading(true);
      await onExecuteDispatch(orderToDispatch.id);
      setIsConfirmDispatchOpen(false);
      setOrderToDispatch(null);
      alert(`Dispatch Order ${orderToDispatch.dispatchNo} physically dispatched and inventory deducted!`);
    } catch (err) {
      alert(err.message || 'Dispatch execution failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Delivery Challan &amp; Dispatch Execution</h3>
          <p>Print delivery challans, generate security gate passes, and confirm physical stock dispatch</p>
        </div>
        <div className={styles.quickActions}>
          <button className={styles.secondary} onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.filterInput}
          placeholder="Search by Dispatch #, Customer, Vehicle or e-Way Bill..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ minWidth: '320px' }}
        />

        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="DRAFT">DRAFT</option>
          <option value="PACKING">PACKING</option>
          <option value="READY_FOR_DISPATCH">READY_FOR_DISPATCH</option>
          <option value="DISPATCHED">DISPATCHED</option>
          <option value="DELIVERED">DELIVERED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>

        {(searchTerm || statusFilter !== 'ALL') && (
          <button
            className={styles.filterReset}
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className={styles.tableWrap}>
        {filteredOrders.length === 0 ? (
          <EmptyState
            icon="🚚"
            title="No Dispatch Orders Found"
            description="No orders match your filter criteria."
          />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Dispatch #</th>
                <th>Customer</th>
                <th>Sales Order</th>
                <th>Items</th>
                <th>Total Value</th>
                <th>Carrier / Vehicle</th>
                <th>Gate Pass</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((d) => (
                <tr key={d.id}>
                  <td><strong style={{ color: '#0f172a' }}>{d.dispatchNo}</strong></td>
                  <td>{d.customerName}</td>
                  <td>{d.salesOrderNo || 'N/A'}</td>
                  <td>{d.items?.length || 0} items ({numberFmt(d.totalDispatchedQty)} Units)</td>
                  <td><strong>{currencyFmt(d.totalDispatchedAmount)}</strong></td>
                  <td>
                    <div style={{ fontSize: '0.74rem' }}>{d.carrierName || 'Self Transport'}</div>
                    <small style={{ color: '#64748b' }}>{d.vehicleNo || 'Vehicle: N/A'}</small>
                  </td>
                  <td>
                    {d.gatePassNo ? (
                      <span className={`${styles.badge} ${styles.badgeGreen}`}>GP: {d.gatePassNo}</span>
                    ) : (
                      <button
                        className={styles.secondary}
                        style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                        onClick={() => handleGatePass(d.id)}
                        disabled={actionLoading}
                      >
                        + Gate Pass
                      </button>
                    )}
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        d.status === 'DISPATCHED'
                          ? styles.badgeGreen
                          : d.status === 'READY_FOR_DISPATCH'
                          ? styles.badgeBlue
                          : d.status === 'CANCELLED'
                          ? styles.badgeRed
                          : styles.badgeAmber
                      }`}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className={styles.actions} style={{ justifyContent: 'flex-end' }}>
                      <button onClick={() => handleViewChallan(d)}>
                        📄 Challan
                      </button>

                      {!['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].includes(d.status) && (
                        <button
                          className={styles.primary}
                          onClick={() => handlePromptDispatch(d)}
                          disabled={actionLoading}
                        >
                          🚀 Dispatch
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* DELIVERY CHALLAN DOCUMENT PREVIEW MODAL */}
      <Modal isOpen={isChallanModalOpen} onClose={() => setIsChallanModalOpen(false)} title="Delivery Challan Document" maxWidth="850px">
        {challanDoc && (
          <div className={styles.docPreview}>
            <div className={styles.docHeader}>
              <div className={styles.docCompany}>
                <h4>SHREE NATH EXPORTS</h4>
                <p style={{ margin: '3px 0', color: '#64748b' }}>Export Delivery Challan &amp; Dispatch Manifest</p>
                <small style={{ color: '#64748b' }}>GSTIN: 08AABCS1429B1Z0 &bull; State: Rajasthan (08)</small>
              </div>
              <div className={styles.docMeta}>
                <p><strong>Challan No:</strong> {challanDoc.challanNo}</p>
                <p><strong>Date:</strong> {new Date(challanDoc.challanDate).toLocaleDateString()}</p>
                <p><strong>Sales Order:</strong> {challanDoc.salesOrderNo || 'N/A'}</p>
                {challanDoc.gatePassNo && <p><strong>Gate Pass:</strong> {challanDoc.gatePassNo}</p>}
              </div>
            </div>

            <div className={styles.docSection}>
              <div>
                <strong>Consignee / Customer Details:</strong>
                <div>{challanDoc.customerName}</div>
                <div style={{ color: '#64748b', fontSize: '0.74rem' }}>
                  GSTIN: {challanDoc.customerGstin || 'Unregistered / Direct Consignee'}<br />
                  Shipping Address: {challanDoc.shippingAddress || 'Default Client Warehouse'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Transport &amp; Statutory Details:</strong>
                <div>Transporter: {challanDoc.transporter}</div>
                <div>Vehicle No: {challanDoc.vehicleNo}</div>
                <div>e-Way Bill: {challanDoc.ewayBillNo}</div>
                {challanDoc.driverName !== 'N/A' && <div>Driver: {challanDoc.driverName} ({challanDoc.driverPhone})</div>}
              </div>
            </div>

            <table className={styles.table} style={{ border: '1px solid #e2e8f0' }}>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product Description</th>
                  <th>HSN</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Taxable Amt</th>
                  <th>Tax</th>
                  <th>Gross Total</th>
                </tr>
              </thead>
              <tbody>
                {challanDoc.items?.map((item) => (
                  <tr key={item.sku}>
                    <td><code>{item.sku}</code></td>
                    <td>
                      {item.productName}
                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Batches: {item.batches}</div>
                    </td>
                    <td>{item.hsnCode}</td>
                    <td><strong>{numberFmt(item.dispatchedQty)} {item.uom}</strong></td>
                    <td>{currencyFmt(item.unitPrice)}</td>
                    <td>{currencyFmt(item.taxableAmount)}</td>
                    <td>{currencyFmt(item.taxAmount)} ({item.taxRate}%)</td>
                    <td><strong>{currencyFmt(item.grossAmount)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem', background: '#f8fafc', borderRadius: '8px' }}>
              <div>
                <strong>Total Items:</strong> {challanDoc.items?.length || 0} &nbsp;|&nbsp;
                <strong>Total Packages:</strong> {challanDoc.totalPackages} Box(es)
              </div>
              <div>
                <strong>Total Dispatch Value:</strong> <span style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 900 }}>{currencyFmt(challanDoc.totalDispatchedAmount)}</span>
              </div>
            </div>

            <div style={{ fontSize: '0.72rem', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
              <strong>Declaration:</strong> {challanDoc.terms}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px dashed #cbd5e1' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1px solid #94a3b8', width: '160px', height: '40px' }} />
                <small>Receiver&apos;s Signature</small>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1px solid #94a3b8', width: '160px', height: '40px' }} />
                <small>Authorized Signatory</small>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
              <button className={styles.secondary} onClick={() => window.print()}>
                🖨️ Print Delivery Challan
              </button>
              <button className={styles.primary} onClick={() => setIsChallanModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* CONFIRM PHYSICAL DISPATCH DIALOG */}
      <ConfirmDialog
        isOpen={isConfirmDispatchOpen}
        onClose={() => setIsConfirmDispatchOpen(false)}
        onConfirm={handleConfirmDispatch}
        title="Confirm Physical Dispatch Execution"
        message={`Are you sure you want to execute physical dispatch for ${orderToDispatch?.dispatchNo}? This will deduct inventory from active warehouse batches and transition shipment status to DISPATCHED.`}
        confirmLabel={actionLoading ? 'Dispatching...' : 'Yes, Confirm Physical Dispatch'}
        cancelLabel="Cancel"
      />
    </div>
  );
}


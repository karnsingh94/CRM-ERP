'use client';

import { useState } from 'react';
import styles from '../DispatchModule.module.css';
import Modal from '../../ui/Modal';
import EmptyState from '../../ui/EmptyState';

function currencyFmt(val) {
  return `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function numberFmt(val) {
  return Number(val || 0).toLocaleString('en-IN');
}

export default function DispatchPlanningTab({
  eligibleOrders = [],
  warehouses = [],
  loading = false,
  onCreateDispatch,
  onRefresh,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Modal Form State
  const [formData, setFormData] = useState({
    warehouseName: 'Main Warehouse',
    carrierName: '',
    vehicleNo: '',
    driverName: '',
    driverPhone: '',
    ewayBillNo: '',
    invoiceNo: '',
    notes: '',
    autoAllocateFIFO: true,
  });
  const [dispatchItemQuantities, setDispatchItemQuantities] = useState({});

  const filteredOrders = eligibleOrders.filter((so) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      so.orderNo?.toLowerCase().includes(term) ||
      so.customerName?.toLowerCase().includes(term) ||
      so.items?.some((i) => i.sku?.toLowerCase().includes(term) || i.productName?.toLowerCase().includes(term))
    );
  });

  const handleOpenDispatchModal = (order) => {
    setSelectedOrder(order);
    const initialQtys = {};
    order.items?.forEach((i) => {
      initialQtys[i.sku] = i.pendingQty || 0;
    });
    setDispatchItemQuantities(initialQtys);
    setFormData({
      warehouseName: warehouses[0]?.name || 'Main Warehouse',
      carrierName: '',
      vehicleNo: '',
      driverName: '',
      driverPhone: '',
      ewayBillNo: '',
      invoiceNo: '',
      notes: '',
      autoAllocateFIFO: true,
    });
    setIsModalOpen(true);
  };

  const handleQtyChange = (sku, val) => {
    const num = Math.max(0, Number(val) || 0);
    setDispatchItemQuantities((prev) => ({ ...prev, [sku]: num }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    const items = selectedOrder.items
      ?.map((item) => ({
        sku: item.sku,
        productName: item.productName,
        uom: item.uom,
        orderedQty: item.orderedQty,
        dispatchedQty: dispatchItemQuantities[item.sku] || 0,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        hsnCode: item.hsnCode,
      }))
      .filter((i) => i.dispatchedQty > 0);

    if (items.length === 0) {
      alert('Please specify at least one item with dispatched quantity greater than 0.');
      return;
    }

    try {
      setSubmitting(true);
      await onCreateDispatch({
        salesOrderId: selectedOrder.id,
        customerId: selectedOrder.customerId,
        customerName: selectedOrder.customerName,
        warehouseName: formData.warehouseName,
        carrierName: formData.carrierName,
        vehicleNo: formData.vehicleNo,
        driverName: formData.driverName,
        driverPhone: formData.driverPhone,
        ewayBillNo: formData.ewayBillNo,
        invoiceNo: formData.invoiceNo,
        notes: formData.notes,
        autoAllocateFIFO: formData.autoAllocateFIFO,
        items,
      });
      setIsModalOpen(false);
      setSelectedOrder(null);
    } catch (err) {
      alert(err.message || 'Failed to create dispatch order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Dispatch Planning &amp; Sales Order Fulfillment</h3>
          <p>Approved sales orders ready for partial or complete dispatch generation</p>
        </div>
        <div className={styles.quickActions}>
          <button className={styles.secondary} onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing...' : '↻ Refresh Queue'}
          </button>
        </div>
      </div>

      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.filterInput}
          placeholder="Search by Sales Order #, Customer or SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ minWidth: '320px' }}
        />
        {searchTerm && (
          <button className={styles.filterReset} onClick={() => setSearchTerm('')}>
            Clear Search
          </button>
        )}
      </div>

      <div className={styles.tableWrap}>
        {filteredOrders.length === 0 ? (
          <EmptyState
            icon="📦"
            title="No Eligible Sales Orders"
            description={searchTerm ? 'No sales orders match your search criteria.' : 'All approved sales orders are currently fulfilled.'}
          />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Order No</th>
                <th>Customer</th>
                <th>Order Date</th>
                <th>Ordered Units</th>
                <th>Pending Units</th>
                <th>Fulfillment %</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((so) => (
                <tr key={so.id}>
                  <td>
                    <strong style={{ color: '#0f172a' }}>{so.orderNo}</strong>
                  </td>
                  <td>{so.customerName}</td>
                  <td>{new Date(so.date).toLocaleDateString()}</td>
                  <td>{numberFmt(so.totalOrderedQty)}</td>
                  <td style={{ color: so.totalPendingQty > 0 ? '#b45309' : '#15803d', fontWeight: 750 }}>
                    {numberFmt(so.totalPendingQty)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '80px', height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${so.fulfillmentPercentage || 0}%`,
                            height: '100%',
                            background: so.fulfillmentPercentage === 100 ? '#10b981' : '#0284c7',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>{so.fulfillmentPercentage || 0}%</span>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles.badgeBlue}`}>{so.status}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className={`${styles.primary}`}
                      style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.74rem' }}
                      onClick={() => handleOpenDispatchModal(so)}
                    >
                      + Create Dispatch
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* CREATE DISPATCH ORDER MODAL */}
      <Modal isOpen={isModalOpen} onClose={() => !submitting && setIsModalOpen(false)} title={`Create Dispatch: ${selectedOrder?.orderNo}`} maxWidth="750px">
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.78rem' }}>
            <strong>Customer:</strong> {selectedOrder?.customerName} &nbsp;|&nbsp;
            <strong>Total Pending:</strong> {selectedOrder?.totalPendingQty} Units
          </div>

          <div style={{ margin: '0.5rem 0' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '0 0 0.5rem', color: '#0f172a' }}>
              Item Fulfillment Quantities
            </h4>
            <table className={styles.table} style={{ border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Pending</th>
                  <th>Unit Price</th>
                  <th style={{ width: '130px' }}>Dispatch Qty</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder?.items?.map((item) => (
                  <tr key={item.sku}>
                    <td><code>{item.sku}</code></td>
                    <td>{item.productName}</td>
                    <td>{item.pendingQty} {item.uom}</td>
                    <td>{currencyFmt(item.unitPrice)}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max={item.pendingQty}
                        step="any"
                        value={dispatchItemQuantities[item.sku] ?? item.pendingQty}
                        onChange={(e) => handleQtyChange(item.sku, e.target.value)}
                        style={{ width: '100%', padding: '0.3rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '5px', fontWeight: 750 }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Source Warehouse</label>
              <select
                value={formData.warehouseName}
                onChange={(e) => setFormData({ ...formData, warehouseName: e.target.value })}
              >
                {warehouses.length > 0 ? (
                  warehouses.map((wh) => (
                    <option key={wh.id} value={wh.name}>{wh.name}</option>
                  ))
                ) : (
                  <option value="Main Warehouse">Main Warehouse</option>
                )}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Transporter / Carrier</label>
              <input
                type="text"
                placeholder="e.g. Delhivery Express, V-Trans"
                value={formData.carrierName}
                onChange={(e) => setFormData({ ...formData, carrierName: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Vehicle Number</label>
              <input
                type="text"
                placeholder="e.g. RJ-14-GA-1234"
                value={formData.vehicleNo}
                onChange={(e) => setFormData({ ...formData, vehicleNo: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>e-Way Bill Number</label>
              <input
                type="text"
                placeholder="12-digit e-Way Bill #"
                value={formData.ewayBillNo}
                onChange={(e) => setFormData({ ...formData, ewayBillNo: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Driver Name</label>
              <input
                type="text"
                placeholder="Driver full name"
                value={formData.driverName}
                onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Driver Phone</label>
              <input
                type="text"
                placeholder="10-digit mobile number"
                value={formData.driverPhone}
                onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>
              <input
                type="checkbox"
                checked={formData.autoAllocateFIFO}
                onChange={(e) => setFormData({ ...formData, autoAllocateFIFO: e.target.checked })}
                style={{ marginRight: '6px' }}
              />
              Auto-Allocate Stock using Multi-Batch FIFO Logic
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.primary}
              style={{ padding: '0.5rem 1rem', borderRadius: '7px', fontWeight: 800 }}
              disabled={submitting}
            >
              {submitting ? 'Creating Dispatch...' : 'Confirm & Generate Dispatch'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}


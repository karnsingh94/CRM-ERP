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

export default function CustomerReturnsTab({
  customerReturns = [],
  eligibleDispatches = [],
  warehouses = [],
  loading = false,
  onCreateReturn,
  onSubmitApproval,
  onApproveReturn,
  onRejectReturn,
  onReceiveGoods,
  onRefresh,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isConfirmActionOpen, setIsConfirmActionOpen] = useState(false);
  const [actionConfig, setActionConfig] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // RMA Create Form
  const [selectedDispatchId, setSelectedDispatchId] = useState('');
  const [returnReason, setReturnReason] = useState('DEFECTIVE_PRODUCT');
  const [reasonDetails, setReasonDetails] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [receivingWarehouseId, setReceivingWarehouseId] = useState(warehouses[0]?.id || '');
  const [itemQuantities, setItemQuantities] = useState({});

  const selectedDispatch = eligibleDispatches.find((d) => d.id === selectedDispatchId);

  const filteredReturns = customerReturns.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.rmaNo?.toLowerCase().includes(term) ||
      r.customerName?.toLowerCase().includes(term) ||
      r.dispatchNo?.toLowerCase().includes(term) ||
      r.returnReason?.toLowerCase().includes(term)
    );
  });

  const handleOpenCreateModal = () => {
    setSelectedDispatchId(eligibleDispatches[0]?.id || '');
    setReturnReason('DEFECTIVE_PRODUCT');
    setReasonDetails('');
    setPickupAddress('');
    setReceivingWarehouseId(warehouses[0]?.id || '');
    const initialQtys = {};
    if (eligibleDispatches[0]?.items) {
      eligibleDispatches[0].items.forEach((i) => {
        initialQtys[i.sku] = i.returnableQty;
      });
    }
    setItemQuantities(initialQtys);
    setIsCreateModalOpen(true);
  };

  const handleDispatchSelect = (dspId) => {
    setSelectedDispatchId(dspId);
    const dsp = eligibleDispatches.find((d) => d.id === dspId);
    const initialQtys = {};
    if (dsp?.items) {
      dsp.items.forEach((i) => {
        initialQtys[i.sku] = i.returnableQty;
      });
    }
    setItemQuantities(initialQtys);
  };

  const handleQtyChange = (sku, val) => {
    const num = Math.max(0, Number(val) || 0);
    setItemQuantities((prev) => ({ ...prev, [sku]: num }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDispatch) {
      alert('Please select an eligible dispatch order.');
      return;
    }

    const items = selectedDispatch.items
      ?.map((item) => ({
        dispatchOrderItemId: item.dispatchOrderItemId,
        sku: item.sku,
        productName: item.productName,
        uom: item.uom,
        unitPrice: item.unitPrice,
        returnQty: itemQuantities[item.sku] || 0,
        returnReason,
      }))
      .filter((i) => i.returnQty > 0);

    if (items.length === 0) {
      alert('Please specify at least one item with return quantity greater than 0.');
      return;
    }

    try {
      setSubmitting(true);
      await onCreateReturn({
        dispatchOrderId: selectedDispatch.id,
        salesOrderId: selectedDispatch.salesOrderId,
        customerId: selectedDispatch.customerId,
        customerName: selectedDispatch.customerName,
        returnReason,
        reasonDetails,
        pickupAddress,
        receivingWarehouseId,
        items,
      });
      setIsCreateModalOpen(false);
      alert('Customer Return (RMA) created successfully!');
    } catch (err) {
      alert(err.message || 'Failed to create return request');
    } finally {
      setSubmitting(false);
    }
  };

  const promptAction = (action, ret) => {
    setActionConfig({ action, ret });
    setIsConfirmActionOpen(true);
  };

  const handleExecuteAction = async () => {
    if (!actionConfig) return;
    const { action, ret } = actionConfig;

    try {
      setSubmitting(true);
      if (action === 'submit') {
        await onSubmitApproval(ret.id);
        alert(`RMA ${ret.rmaNo} submitted for approval!`);
      } else if (action === 'approve') {
        await onApproveReturn(ret.id);
        alert(`RMA ${ret.rmaNo} approved! Ready for physical inward receiving.`);
      } else if (action === 'reject') {
        const reason = prompt('Please enter reason for rejection:');
        if (!reason) return;
        await onRejectReturn(ret.id, reason);
        alert(`RMA ${ret.rmaNo} rejected.`);
      } else if (action === 'receive') {
        await onReceiveGoods(ret.id, {
          receivingWarehouseId: ret.receivingWarehouseId || warehouses[0]?.id,
        });
        alert(`Returned goods for ${ret.rmaNo} received into quarantine (RETURN_HOLD)! Ready for QC inspection.`);
      }
      setIsConfirmActionOpen(false);
      setActionConfig(null);
    } catch (err) {
      alert(err.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Customer Returns &amp; RMA Management</h3>
          <p>RMA authorizations, returnable quantity validations, Maker-Checker SoD, and inward quarantine receiving</p>
        </div>
        <div className={styles.quickActions}>
          <button className={styles.secondary} onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
          <button className={styles.primary} onClick={handleOpenCreateModal}>
            + New Return Request (RMA)
          </button>
        </div>
      </div>

      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.filterInput}
          placeholder="Search by RMA #, Customer or Dispatch #..."
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
          <option value="REQUESTED">REQUESTED</option>
          <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
          <option value="APPROVED">APPROVED</option>
          <option value="GOODS_RECEIVED">GOODS_RECEIVED (In Quarantine)</option>
          <option value="INSPECTED">INSPECTED</option>
          <option value="REJECTED">REJECTED</option>
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
        {filteredReturns.length === 0 ? (
          <EmptyState
            icon="🔄"
            title="No Return Requests Found"
            description="No customer returns match your filters. Click '+ New Return Request (RMA)' to log a return."
          />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>RMA #</th>
                <th>Customer</th>
                <th>Dispatch #</th>
                <th>Reason</th>
                <th>Returned Units</th>
                <th>Total Value</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Workflow Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReturns.map((r) => (
                <tr key={r.id}>
                  <td><strong style={{ color: '#0f172a' }}>{r.rmaNo}</strong></td>
                  <td>{r.customerName}</td>
                  <td>{r.dispatchNo || 'N/A'}</td>
                  <td>
                    <span className={`${styles.badge} ${styles.badgeGray}`}>{r.returnReason}</span>
                  </td>
                  <td><strong>{numberFmt(r.totalReturnedQty)} Units</strong></td>
                  <td>{currencyFmt(r.totalReturnedAmount)}</td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        r.status === 'GOODS_RECEIVED'
                          ? styles.badgeAmber
                          : r.status === 'APPROVED' || r.status === 'INSPECTED'
                          ? styles.badgeGreen
                          : r.status === 'REJECTED'
                          ? styles.badgeRed
                          : styles.badgeBlue
                      }`}
                    >
                      {r.status === 'GOODS_RECEIVED' ? 'QUARANTINE (HOLD)' : r.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className={styles.actions} style={{ justifyContent: 'flex-end' }}>
                      {r.status === 'REQUESTED' && (
                        <button className={styles.secondary} onClick={() => promptAction('submit', r)}>
                          Submit Approval
                        </button>
                      )}

                      {r.status === 'PENDING_APPROVAL' && (
                        <>
                          <button className={styles.primary} onClick={() => promptAction('approve', r)}>
                            Approve
                          </button>
                          <button className={styles.secondary} onClick={() => promptAction('reject', r)} style={{ color: '#b91c1c' }}>
                            Reject
                          </button>
                        </>
                      )}

                      {r.status === 'APPROVED' && (
                        <button className={styles.primary} onClick={() => promptAction('receive', r)}>
                          📥 Inward Receive
                        </button>
                      )}

                      {r.status === 'GOODS_RECEIVED' && (
                        <span style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 800 }}>
                          Ready for QC
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* CREATE RMA MODAL */}
      <Modal isOpen={isCreateModalOpen} onClose={() => !submitting && setIsCreateModalOpen(false)} title="New Customer Return Request (RMA)" maxWidth="750px">
        <form onSubmit={handleCreateSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label>Select Original Dispatch Order *</label>
            <select
              required
              value={selectedDispatchId}
              onChange={(e) => handleDispatchSelect(e.target.value)}
            >
              {eligibleDispatches.length > 0 ? (
                eligibleDispatches.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.dispatchNo} — {d.customerName} (Eligible Returnable: {d.totalReturnableQty} Units)
                  </option>
                ))
              ) : (
                <option value="">No eligible dispatches available</option>
              )}
            </select>
          </div>

          {selectedDispatch && (
            <div style={{ margin: '0.5rem 0' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '0 0 0.5rem', color: '#0f172a' }}>
                Items &amp; Returnable Quantity Verification
              </h4>
              <table className={styles.table} style={{ border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Dispatched</th>
                    <th>Max Returnable</th>
                    <th style={{ width: '130px' }}>Return Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDispatch.items?.map((item) => (
                    <tr key={item.sku}>
                      <td><code>{item.sku}</code></td>
                      <td>{item.productName}</td>
                      <td>{item.dispatchedQty} {item.uom}</td>
                      <td><strong style={{ color: '#0369a1' }}>{item.returnableQty} {item.uom}</strong></td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max={item.returnableQty}
                          step="any"
                          value={itemQuantities[item.sku] ?? item.returnableQty}
                          onChange={(e) => handleQtyChange(item.sku, e.target.value)}
                          style={{ width: '100%', padding: '0.3rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '5px', fontWeight: 750 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Return Reason *</label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
              >
                <option value="DEFECTIVE_PRODUCT">Defective / Manufacturing Flaw</option>
                <option value="TRANSIT_DAMAGE">Transit / Shipping Damage</option>
                <option value="WRONG_ITEM_SENT">Wrong Item Dispatched</option>
                <option value="EXCESS_SHIPMENT">Excess Quantity Dispatched</option>
                <option value="SPECIFICATION_MISMATCH">Specification / Shade Mismatch</option>
                <option value="CUSTOMER_CANCELLED">Customer Cancellation</option>
                <option value="OTHER">Other Reason</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Receiving Quarantine Warehouse</label>
              <select
                value={receivingWarehouseId}
                onChange={(e) => setReceivingWarehouseId(e.target.value)}
              >
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>{wh.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Reason Details / Customer Feedback</label>
            <textarea
              rows={2}
              placeholder="Detailed description of defect or customer remarks..."
              value={reasonDetails}
              onChange={(e) => setReasonDetails(e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Customer Pickup Address</label>
            <input
              type="text"
              placeholder="Address from where returned goods will be collected"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
            <button type="button" className={styles.secondary} onClick={() => setIsCreateModalOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={submitting || !selectedDispatch}>
              {submitting ? 'Creating RMA...' : 'Submit RMA Request'}
            </button>
          </div>
        </form>
      </Modal>

      {/* WORKFLOW ACTION CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={isConfirmActionOpen}
        onClose={() => setIsConfirmActionOpen(false)}
        onConfirm={handleExecuteAction}
        title="Confirm RMA Action"
        message={`Are you sure you want to execute '${actionConfig?.action}' for RMA ${actionConfig?.ret?.rmaNo}?`}
        confirmLabel={submitting ? 'Executing...' : 'Yes, Confirm'}
        cancelLabel="Cancel"
      />
    </div>
  );
}


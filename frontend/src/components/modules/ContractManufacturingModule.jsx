'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import styles from './ContractManufacturingModule.module.css';

const TAB_ALIASES = {
  dashboard: 'dashboard',
  manufacturers: 'manufacturers',
  vendors: 'manufacturers',
  orders: 'orders',
  jwo: 'orders',
  dispatch: 'dispatch',
  challans: 'dispatch',
  custody: 'custody',
  returns: 'custody',
  milestones: 'milestones',
  stages: 'milestones',
  receipts: 'receipts',
  inward: 'receipts',
  qc: 'qc',
  quality: 'qc',
  reconciliation: 'reconciliation',
  recon: 'reconciliation',
  billing: 'billing',
  settlement: 'billing',
  rework: 'billing',
};

function numberFmt(val) {
  return Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function round2(val) {
  return Math.round((Number(val) || 0) * 100) / 100;
}

function round4(val) {
  return Math.round((Number(val) || 0) * 10000) / 10000;
}

function currencyFmt(val) {
  return `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateFmt(val) {
  if (!val) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(val));
  } catch {
    return String(val);
  }
}

function dateTimeFmt(val) {
  if (!val) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(val));
  } catch {
    return String(val);
  }
}

function StatusBadge({ value }) {
  const str = String(value || 'DRAFT').replace(/_/g, ' ');
  let tone = 'neutral';
  if (['APPROVED', 'COMPLETED', 'PASSED', 'DELIVERED', 'SETTLED', 'ACTIVE'].includes(value)) {
    tone = 'success';
  } else if (['PENDING', 'PENDING_APPROVAL', 'IN_PROGRESS', 'PENDING_QC', 'PENDING_AUDIT', 'DISPATCHED'].includes(value)) {
    tone = 'warning';
  } else if (['REJECTED', 'FAILED', 'CANCELLED', 'PAYMENT_HOLD', 'OVERDUE'].includes(value)) {
    tone = 'danger';
  } else if (['PARTIALLY_PASSED', 'PARTIAL', 'DISPATCHED_FOR_REWORK'].includes(value)) {
    tone = 'info';
  }
  return <span className={`${styles.badge} ${styles[tone]}`}>{str}</span>;
}

export default function ContractManufacturingModule({ activeCompany, showToast, initialSubTab }) {
  const companyId = activeCompany?.id;

  // Active Tab state
  const [activeTab, setActiveTab] = useState(() => {
    if (initialSubTab && TAB_ALIASES[initialSubTab.toLowerCase()]) {
      return TAB_ALIASES[initialSubTab.toLowerCase()];
    }
    return 'dashboard';
  });

  useEffect(() => {
    if (initialSubTab && TAB_ALIASES[initialSubTab.toLowerCase()]) {
      setActiveTab(TAB_ALIASES[initialSubTab.toLowerCase()]);
    }
  }, [initialSubTab]);

  // Loading & Error states
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Core Data States
  const [dashboardMetrics, setDashboardMetrics] = useState(null);
  const [manufacturers, setManufacturers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [challans, setChallans] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [approvedBoms, setApprovedBoms] = useState([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals & Active Selections
  const [modalType, setModalType] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedChallan, setSelectedChallan] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [selectedManufacturer, setSelectedManufacturer] = useState(null);
  const [reconciliationPreview, setReconciliationPreview] = useState(null);

  // Form States
  const [orderForm, setOrderForm] = useState({
    vendorId: '',
    outputProductId: '',
    bomId: '',
    targetQuantity: '',
    conversionRate: '',
    uom: 'MTR',
    deliveryAddress: '',
    expectedReturnDate: '',
    termsAndConditions: '',
  });

  const [dispatchForm, setDispatchForm] = useState({
    jobWorkOrderId: '',
    warehouseId: '',
    dispatchDate: new Date().toISOString().slice(0, 10),
    transporterName: '',
    vehicleNo: '',
    lrNumber: '',
    eWayBillNo: '',
    items: [],
  });

  const [returnForm, setReturnForm] = useState({
    jobWorkOrderId: '',
    warehouseId: '',
    items: [{ productId: '', rmBatchId: '', quantity: '', reason: '', isDefective: false }],
  });

  const [milestoneForm, setMilestoneForm] = useState({
    jobWorkOrderId: '',
    milestoneType: 'PRODUCTION_STARTED',
    statusDate: new Date().toISOString().slice(0, 10),
    reportedOutputQty: '',
    reportedScrapQty: '',
    remarks: '',
  });

  const [receiptForm, setReceiptForm] = useState({
    jobWorkOrderId: '',
    warehouseId: '',
    receivedQty: '',
    vendorDeliveryNote: '',
    vendorBatchNo: '',
    manufacturingDate: new Date().toISOString().slice(0, 10),
  });

  const [qcForm, setQcForm] = useState({
    receiptId: '',
    acceptedQty: '',
    rejectedQty: '',
    qcRemarks: '',
  });

  const [reworkForm, setReworkForm] = useState({
    receiptId: '',
    reworkQty: '',
    notes: '',
  });

  const [reconForm, setReconForm] = useState({
    jobWorkOrderId: '',
    notes: '',
    items: [],
  });

  // ====================================================================
  // DATA FETCHING
  // ====================================================================

  const fetchBaseData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [
        dashRes,
        mfgRes,
        orderRes,
        challanRes,
        receiptRes,
        reconRes,
        whRes,
        prodRes,
        bomRes,
      ] = await Promise.all([
        api.get(`/companies/${companyId}/job-work/dashboard`).catch(() => null),
        api.get(`/companies/${companyId}/job-work/manufacturers`).catch(() => null),
        api.get(`/companies/${companyId}/job-work/orders`).catch(() => null),
        api.get(`/companies/${companyId}/job-work/challans`).catch(() => null),
        api.get(`/companies/${companyId}/job-work/receipts`).catch(() => null),
        api.get(`/companies/${companyId}/job-work/reconciliations`).catch(() => null),
        api.get(`/companies/${companyId}/inventory/warehouses`).catch(() => null),
        api.get(`/companies/${companyId}/inventory/products`).catch(() => null),
        api.get(`/companies/${companyId}/production/boms?status=APPROVED`).catch(() => null),
      ]);

      if (dashRes?.data) setDashboardMetrics(dashRes.data);
      if (mfgRes?.data) setManufacturers(mfgRes.data);
      if (orderRes?.data) setOrders(orderRes.data);
      if (challanRes?.data) setChallans(challanRes.data);
      if (receiptRes?.data) setReceipts(receiptRes.data);
      if (reconRes?.data) setReconciliations(reconRes.data);
      if (whRes?.data) setWarehouses(whRes.data);
      if (prodRes?.data) setProducts(prodRes.data);
      if (bomRes?.data) setApprovedBoms(bomRes.data);
    } catch (err) {
      showToast?.(err.message || 'Error loading contract manufacturing data', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, showToast]);

  useEffect(() => {
    fetchBaseData();
  }, [fetchBaseData, refreshKey]);

  // ====================================================================
  // HANDLERS
  // ====================================================================

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      setLoading(true);
      await api.post(`/companies/${companyId}/job-work/orders`, orderForm);
      showToast?.('Job Work Order created successfully', 'success');
      setModalType(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showToast?.(err.message || 'Failed to create Job Work Order', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitApproval = async (orderId) => {
    if (!companyId) return;
    try {
      setLoading(true);
      await api.post(`/companies/${companyId}/job-work/orders/${orderId}/submit-approval`);
      showToast?.('Submitted for Phase 1 Approval Engine authorization', 'success');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showToast?.(err.message || 'Submission failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveOrder = async (orderId) => {
    if (!companyId) return;
    try {
      setLoading(true);
      await api.post(`/companies/${companyId}/job-work/orders/${orderId}/approve`);
      showToast?.('Job Work Order approved and locked', 'success');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showToast?.(err.message || 'Approval failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDispatchModal = async (order) => {
    setSelectedOrder(order);
    try {
      setLoading(true);
      const reqRes = await api.get(`/companies/${companyId}/job-work/orders/${order.id}/material-requirements`);
      const reqs = reqRes?.data?.requirements || [];
      setDispatchForm({
        jobWorkOrderId: order.id,
        warehouseId: warehouses[0]?.id || '',
        dispatchDate: new Date().toISOString().slice(0, 10),
        transporterName: '',
        vehicleNo: '',
        lrNumber: '',
        eWayBillNo: '',
        items: reqs.map((r) => ({
          productId: r.productId,
          sku: r.sku,
          name: r.name,
          uom: r.uom,
          remainingToDispatch: r.remainingToDispatch,
          quantity: r.remainingToDispatch,
        })),
      });
      setModalType('dispatch');
    } catch (err) {
      showToast?.(err.message || 'Failed to load material requirements', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDispatchMaterials = async (e) => {
    e.preventDefault();
    if (!companyId || !selectedOrder) return;
    try {
      setLoading(true);
      await api.post(`/companies/${companyId}/job-work/orders/${selectedOrder.id}/dispatch`, {
        warehouseId: dispatchForm.warehouseId,
        dispatchDate: dispatchForm.dispatchDate,
        transporterName: dispatchForm.transporterName,
        vehicleNo: dispatchForm.vehicleNo,
        lrNumber: dispatchForm.lrNumber,
        eWayBillNo: dispatchForm.eWayBillNo,
        items: dispatchForm.items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
      });
      showToast?.('Delivery Challan generated and FIFO stock moved to WIP', 'success');
      setModalType(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showToast?.(err.message || 'Dispatch failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledgeChallan = async (challanId) => {
    if (!companyId) return;
    const name = window.prompt('Enter vendor receiver name:');
    if (!name) return;
    try {
      setLoading(true);
      await api.post(`/companies/${companyId}/job-work/challans/${challanId}/acknowledge`, {
        acknowledgedBy: name,
      });
      showToast?.('Challan receipt acknowledged by external manufacturer', 'success');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showToast?.(err.message || 'Acknowledgment failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReturnMaterials = async (e) => {
    e.preventDefault();
    if (!companyId || !returnForm.jobWorkOrderId) return;
    try {
      setLoading(true);
      await api.post(`/companies/${companyId}/job-work/orders/${returnForm.jobWorkOrderId}/material-returns`, returnForm);
      showToast?.('Material return recorded and WIP custody decremented', 'success');
      setModalType(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showToast?.(err.message || 'Return failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMilestone = async (e) => {
    e.preventDefault();
    if (!companyId || !milestoneForm.jobWorkOrderId) return;
    try {
      setLoading(true);
      await api.post(`/companies/${companyId}/job-work/orders/${milestoneForm.jobWorkOrderId}/milestones`, milestoneForm);
      showToast?.('Milestone stage recorded', 'success');
      setModalType(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showToast?.(err.message || 'Milestone failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReceipt = async (e) => {
    e.preventDefault();
    if (!companyId || !receiptForm.jobWorkOrderId) return;
    try {
      setLoading(true);
      await api.post(`/companies/${companyId}/job-work/orders/${receiptForm.jobWorkOrderId}/receipts`, receiptForm);
      showToast?.('Finished goods received and isolated in QUALITY_HOLD', 'success');
      setModalType(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showToast?.(err.message || 'Receipt failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInspectQc = async (e) => {
    e.preventDefault();
    if (!companyId || !selectedReceipt) return;
    try {
      setLoading(true);
      await api.post(`/companies/${companyId}/job-work/receipts/${selectedReceipt.id}/qc`, {
        acceptedQty: Number(qcForm.acceptedQty || 0),
        rejectedQty: Number(qcForm.rejectedQty || 0),
        qcRemarks: qcForm.qcRemarks,
      });
      showToast?.('QC inspection saved: Accepted stock released to AVAILABLE', 'success');
      setModalType(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showToast?.(err.message || 'QC Inspection failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRework = async (e) => {
    e.preventDefault();
    if (!companyId || !selectedReceipt) return;
    try {
      setLoading(true);
      await api.post(`/companies/${companyId}/job-work/receipts/${selectedReceipt.id}/rework`, {
        reworkQty: Number(reworkForm.reworkQty),
        notes: reworkForm.notes,
      });
      showToast?.('Rejected goods dispatched back to vendor for external rework', 'success');
      setModalType(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showToast?.(err.message || 'Rework dispatch failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReconciliationModal = async (order) => {
    setSelectedOrder(order);
    try {
      setLoading(true);
      const prevRes = await api.get(`/companies/${companyId}/job-work/orders/${order.id}/reconciliation-preview`);
      setReconciliationPreview(prevRes?.data || null);
      setReconForm({
        jobWorkOrderId: order.id,
        notes: '',
        items: (prevRes?.data?.items || []).map((i) => ({
          productId: i.productId,
          sku: i.sku,
          consumedQty: i.consumedQty,
          actualScrapQty: i.actualScrapQty,
        })),
      });
      setModalType('reconciliation');
    } catch (err) {
      showToast?.(err.message || 'Failed to preview reconciliation', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeReconciliation = async (e) => {
    e.preventDefault();
    if (!companyId || !selectedOrder) return;
    try {
      setLoading(true);
      await api.post(`/companies/${companyId}/job-work/orders/${selectedOrder.id}/reconciliations`, {
        notes: reconForm.notes,
        items: reconForm.items.map((i) => ({
          productId: i.productId,
          consumedQty: Number(i.consumedQty),
          actualScrapQty: Number(i.actualScrapQty),
        })),
      });
      showToast?.('Material reconciliation finalized with excess wastage debit snapshot', 'success');
      setModalType(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showToast?.(err.message || 'Reconciliation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSettleJobWork = async (reconciliationId) => {
    if (!companyId) return;
    if (!window.confirm('Authorize vendor settlement and mark Job Work Order completed?')) return;
    try {
      setLoading(true);
      await api.post(`/companies/${companyId}/job-work/reconciliations/${reconciliationId}/settle`);
      showToast?.('Settlement approved. Order marked COMPLETED and payment hold cleared.', 'success');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showToast?.(err.message || 'Settlement failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePaymentHold = async (rec) => {
    if (!companyId) return;
    const isHold = !rec.isPaymentHold;
    const reason = isHold ? window.prompt('Enter reason for payment hold:', 'Pending material variance audit') : '';
    try {
      setLoading(true);
      await api.post(`/companies/${companyId}/job-work/reconciliations/${rec.id}/toggle-payment-hold`, {
        isPaymentHold: isHold,
        holdReason: reason,
      });
      showToast?.(`Payment hold ${isHold ? 'applied' : 'released'}`, 'success');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showToast?.(err.message || 'Toggle hold failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ====================================================================
  // FILTERED LISTS
  // ====================================================================

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch = !searchQuery || o.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) || o.vendor?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || o.outputProduct?.sku?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = !statusFilter || o.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  // ====================================================================
  // RENDER TABS
  // ====================================================================

  return (
    <div className={styles.module}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Subcontracting Operations</span>
          <h2>Contract Manufacturing & External Production</h2>
          <p>
            Manage external suppliers, GST Rule 55 delivery challans, FIFO material custody, milestone tracking,
            strict Quality Hold inspection, and material wastage reconciliation.
          </p>
        </div>
        <button type="button" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
          {loading ? 'Refreshing...' : '↻ Refresh Data'}
        </button>
      </div>

      {/* Subcontracting Pipeline Progress Flow */}
      <div className={styles.flow}>
        <span><b>1</b> JWO Created</span>
        <span><b>2</b> Approval & Lock</span>
        <span><b>3</b> FIFO Dispatch (Challan)</span>
        <span><b>4</b> Vendor Receipt Ack</span>
        <span><b>5</b> Production Milestones</span>
        <span><b>6</b> Inward (QUALITY_HOLD)</span>
        <span><b>7</b> QC Release (AVAILABLE)</span>
        <span><b>8</b> Scrap Reconciliation</span>
        <span><b>9</b> Settlement</span>
      </div>

      {/* 10 Functional Navigation Tabs */}
      <div className={styles.tabs}>
        <button type="button" className={activeTab === 'dashboard' ? styles.active : ''} onClick={() => setActiveTab('dashboard')}>
          1. Dashboard
        </button>
        <button type="button" className={activeTab === 'manufacturers' ? styles.active : ''} onClick={() => setActiveTab('manufacturers')}>
          2. Manufacturers <span className={styles.tabBadge}>{manufacturers.length}</span>
        </button>
        <button type="button" className={activeTab === 'orders' ? styles.active : ''} onClick={() => setActiveTab('orders')}>
          3. Job Work Orders <span className={styles.tabBadge}>{orders.length}</span>
        </button>
        <button type="button" className={activeTab === 'dispatch' ? styles.active : ''} onClick={() => setActiveTab('dispatch')}>
          4. FIFO Dispatch & Challans <span className={styles.tabBadge}>{challans.length}</span>
        </button>
        <button type="button" className={activeTab === 'custody' ? styles.active : ''} onClick={() => setActiveTab('custody')}>
          5. Material Custody & Returns
        </button>
        <button type="button" className={activeTab === 'milestones' ? styles.active : ''} onClick={() => setActiveTab('milestones')}>
          6. Milestones & Progress
        </button>
        <button type="button" className={activeTab === 'receipts' ? styles.active : ''} onClick={() => setActiveTab('receipts')}>
          7. Finished Goods Receipt <span className={styles.tabBadge}>{receipts.length}</span>
        </button>
        <button type="button" className={activeTab === 'qc' ? styles.active : ''} onClick={() => setActiveTab('qc')}>
          8. Subcontractor QC Gate
        </button>
        <button type="button" className={activeTab === 'reconciliation' ? styles.active : ''} onClick={() => setActiveTab('reconciliation')}>
          9. Scrap Reconciliation
        </button>
        <button type="button" className={activeTab === 'billing' ? styles.active : ''} onClick={() => setActiveTab('billing')}>
          10. Settlement & Payment Clearance <span className={styles.tabBadge}>{reconciliations.length}</span>
        </button>
      </div>

      {/* TAB 1: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span>📋</span>
              <div>
                <strong>{dashboardMetrics?.orders?.total || 0}</strong>
                <small>Total Job Work Orders ({dashboardMetrics?.orders?.inProgress || 0} in progress)</small>
              </div>
            </div>
            <div className={styles.stat}>
              <span>🚚</span>
              <div>
                <strong>{dashboardMetrics?.challans?.total || 0}</strong>
                <small>Delivery Challans ({dashboardMetrics?.challans?.overdue1Year || 0} statutory 1-yr alert)</small>
              </div>
            </div>
            <div className={styles.stat}>
              <span>🛡️</span>
              <div>
                <strong>{dashboardMetrics?.receipts?.pendingQc || 0}</strong>
                <small>Batches in Quality Hold Gate ({dashboardMetrics?.receipts?.passed || 0} released)</small>
              </div>
            </div>
            <div className={styles.stat}>
              <span>⚖️</span>
              <div>
                <strong>{dashboardMetrics?.reconciliations?.pendingAudit || 0}</strong>
                <small>Reconciliations Pending Audit ({dashboardMetrics?.reconciliations?.paymentHoldCount || 0} on hold)</small>
              </div>
            </div>
          </div>

          <div className={styles.sectionHeader}>
            <div>
              <h3>Active Subcontracting Pipelines</h3>
              <p>Current external production orders being processed across authorized contract manufacturers.</p>
            </div>
            <div className={styles.quickActions}>
              <button type="button" className={styles.primary} onClick={() => setModalType('createOrder')}>
                + New Job Work Order
              </button>
            </div>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Vendor / Manufacturer</th>
                    <th>Output Product</th>
                    <th>Target Qty</th>
                    <th>Received</th>
                    <th>Est. Cost</th>
                    <th>Status</th>
                    <th>Issue Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 6).map((o) => (
                    <tr key={o.id}>
                      <td><strong>{o.orderNo}</strong></td>
                      <td>{o.vendor?.name}</td>
                      <td>{o.outputProduct?.sku}</td>
                      <td>{numberFmt(o.targetQuantity)} {o.uom}</td>
                      <td>{numberFmt(o.receivedQuantity)} {o.uom}</td>
                      <td>{currencyFmt(o.estimatedTotalCost)}</td>
                      <td><StatusBadge value={o.status} /></td>
                      <td>{dateFmt(o.issueDate)}</td>
                      <td>
                        <div className={styles.actions}>
                          <button type="button" onClick={() => { setSelectedOrder(o); setModalType('viewOrder'); }}>
                            Inspect
                          </button>
                          {o.status === 'APPROVED' && (
                            <button type="button" className={styles.primary} onClick={() => handleOpenDispatchModal(o)}>
                              Dispatch
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                        No contract manufacturing orders found. Click "+ New Job Work Order" to begin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: MANUFACTURER DIRECTORY */}
      {activeTab === 'manufacturers' && (
        <>
          <div className={styles.sectionHeader}>
            <div>
              <h3>External Supplier & Manufacturer Directory</h3>
              <p>Audited contract manufacturers, active material custody, and historical job work fulfillment.</p>
            </div>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Vendor Code</th>
                    <th>Manufacturer Name</th>
                    <th>Contact Person</th>
                    <th>Phone / Email</th>
                    <th>Active Orders</th>
                    <th>Open Challans</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {manufacturers.map((v) => (
                    <tr key={v.id}>
                      <td><strong>{v.vendorCode}</strong></td>
                      <td>
                        <strong>{v.name}</strong>
                        <small>{v.address || 'Factory address on file'}</small>
                      </td>
                      <td>{v.contact || 'Production Manager'}</td>
                      <td>{v.phone || v.email}</td>
                      <td><strong>{v.activeOrdersCount}</strong> active</td>
                      <td><strong>{v.openChallansCount}</strong> open</td>
                      <td><StatusBadge value={v.status} /></td>
                      <td>
                        <div className={styles.actions}>
                          <button type="button" onClick={async () => {
                            const res = await api.get(`/companies/${companyId}/job-work/manufacturers/${v.id}/history`);
                            setSelectedManufacturer(res?.data || v);
                            setModalType('viewManufacturer');
                          }}>
                            View History
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {manufacturers.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                        No contract manufacturers registered in Vendor directory.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 3: JOB WORK ORDERS */}
      {activeTab === 'orders' && (
        <>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Job Work Orders (JWO)</h3>
              <p>Subcontracting order creation with automated BOM requirements scaling and Maker-Checker approval.</p>
            </div>
            <div className={styles.quickActions}>
              <button type="button" className={styles.primary} onClick={() => setModalType('createOrder')}>
                + Create Job Work Order
              </button>
            </div>
          </div>

          <div className={styles.filterBar}>
            <input
              type="text"
              placeholder="Search by order no, vendor or SKU..."
              className={styles.filterInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <button type="button" className={styles.filterReset} onClick={() => { setSearchQuery(''); setStatusFilter(''); }}>
              Reset Filters
            </button>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Vendor / Mill</th>
                    <th>Finished Output SKU</th>
                    <th>Target Qty</th>
                    <th>Est. Total Cost</th>
                    <th>Lock Status</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => (
                    <tr key={o.id}>
                      <td><strong>{o.orderNo}</strong></td>
                      <td>{o.vendor?.name}</td>
                      <td>
                        <strong>{o.outputProduct?.sku}</strong>
                        <small>{o.outputProduct?.name}</small>
                      </td>
                      <td>{numberFmt(o.targetQuantity)} {o.uom}</td>
                      <td>{currencyFmt(o.estimatedTotalCost)}</td>
                      <td>
                        {o.isLocked ? <span className={`${styles.badge} ${styles.info}`}>🔒 Locked (v{o.versionNumber})</span> : <span className={`${styles.badge} ${styles.neutral}`}>Editable</span>}
                      </td>
                      <td><StatusBadge value={o.status} /></td>
                      <td>
                        <div className={styles.actions}>
                          <button type="button" onClick={() => { setSelectedOrder(o); setModalType('viewOrder'); }}>
                            Details
                          </button>
                          {o.status === 'DRAFT' && (
                            <button type="button" className={styles.primary} onClick={() => handleSubmitApproval(o.id)}>
                              Submit Approval
                            </button>
                          )}
                          {o.status === 'PENDING_APPROVAL' && (
                            <button type="button" className={styles.successButton} onClick={() => handleApproveOrder(o.id)}>
                              Authorize
                            </button>
                          )}
                          {['APPROVED', 'IN_PROGRESS'].includes(o.status) && (
                            <button type="button" className={styles.primary} onClick={() => handleOpenDispatchModal(o)}>
                              Dispatch FIFO
                            </button>
                          )}
                          {o.status === 'IN_PROGRESS' && (
                            <button type="button" className={styles.warningButton} onClick={() => handleOpenReconciliationModal(o)}>
                              Reconcile
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                        No orders match filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 4: FIFO DISPATCH & DELIVERY CHALLANS */}
      {activeTab === 'dispatch' && (
        <>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Raw Material FIFO Dispatch & Delivery Challans</h3>
              <p>GST Rule 55 statutory Challans, vehicle & transporter tracking, and Section 143 one-year due dates.</p>
            </div>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Challan No</th>
                    <th>Job Work Order</th>
                    <th>Vendor Destination</th>
                    <th>Dispatch Date</th>
                    <th>Statutory 1-Yr Due</th>
                    <th>Taxable Value</th>
                    <th>Transporter / Vehicle</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {challans.map((c) => {
                    const isOverdue = c.statutory1YearDueDate && new Date(c.statutory1YearDueDate) < new Date() && c.status !== 'COMPLETED';
                    return (
                      <tr key={c.id}>
                        <td><strong>{c.challanNo}</strong></td>
                        <td>{c.jobWorkOrder?.orderNo}</td>
                        <td>{c.vendor?.name}</td>
                        <td>{dateFmt(c.dispatchDate)}</td>
                        <td>
                          {dateFmt(c.statutory1YearDueDate)}
                          {isOverdue && <span className={`${styles.badge} ${styles.danger}`} style={{ display: 'block', marginTop: '2px' }}>Overdue &gt; 1 Yr</span>}
                        </td>
                        <td>{currencyFmt(c.totalTaxableValue)}</td>
                        <td>
                          <small>{c.transporterName || '—'}</small>
                          <small>{c.vehicleNo ? `Veh: ${c.vehicleNo}` : ''}</small>
                        </td>
                        <td><StatusBadge value={c.status} /></td>
                        <td>
                          <div className={styles.actions}>
                            <button type="button" onClick={async () => {
                              const res = await api.get(`/companies/${companyId}/job-work/challans/${c.id}`);
                              setSelectedChallan(res?.data || c);
                              setModalType('viewChallanDoc');
                            }}>
                              Print Challan
                            </button>
                            {c.status === 'DISPATCHED' && (
                              <button type="button" className={styles.successButton} onClick={() => handleAcknowledgeChallan(c.id)}>
                                Ack Receipt
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {challans.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                        No delivery challans issued yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 5: MATERIAL CUSTODY & RETURNS */}
      {activeTab === 'custody' && (
        <>
          <div className={styles.sectionHeader}>
            <div>
              <h3>External Material Custody Tracking & Returns</h3>
              <p>Track raw materials currently in vendor possession (WIP) and record unused/defective material returns.</p>
            </div>
            <div className={styles.quickActions}>
              <button type="button" className={styles.primary} onClick={() => setModalType('returnMaterial')}>
                + Record Material Return
              </button>
            </div>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Vendor Mill</th>
                    <th>Component SKU</th>
                    <th>Dispatched (WIP)</th>
                    <th>Consumed</th>
                    <th>Returned</th>
                    <th>Outstanding Custody</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.filter((o) => ['IN_PROGRESS', 'COMPLETED', 'ON_HOLD'].includes(o.status) || (o.items || []).some((it) => Number(it.dispatchedQuantity) > 0)).map((o) => (
                    <tr key={o.id}>
                      <td><strong>{o.orderNo}</strong></td>
                      <td>{o.vendor?.name}</td>
                      <td>{o.outputProduct?.sku} Components</td>
                      <td>{numberFmt(o.items?.reduce((s, i) => s + Number(i.dispatchedQuantity), 0))} KG</td>
                      <td>{numberFmt(o.items?.reduce((s, i) => s + Number(i.consumedQuantity), 0))} KG</td>
                      <td>{numberFmt(o.items?.reduce((s, i) => s + Number(i.returnedQuantity), 0))} KG</td>
                      <td>
                        <strong>
                          {numberFmt(o.items?.reduce((s, i) => s + (Number(i.dispatchedQuantity) - Number(i.consumedQuantity) - Number(i.returnedQuantity)), 0))} KG
                        </strong>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button type="button" className={styles.primary} onClick={() => {
                            setReturnForm({
                              jobWorkOrderId: o.id,
                              warehouseId: warehouses[0]?.id || '',
                              items: (o.items || []).map((it) => ({
                                productId: it.productId,
                                rmBatchId: '',
                                quantity: '',
                                reason: 'Unused material return',
                                isDefective: false,
                              })),
                            });
                            setModalType('returnMaterial');
                          }}>
                            Return Materials
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 6: PRODUCTION MILESTONES */}
      {activeTab === 'milestones' && (
        <>
          <div className={styles.sectionHeader}>
            <div>
              <h3>External Production Milestones & Stage Tracking</h3>
              <p>Log and inspect vendor production milestones (cutting, dyeing, sewing, finishing, packing).</p>
            </div>
            <div className={styles.quickActions}>
              <button type="button" className={styles.primary} onClick={() => setModalType('addMilestone')}>
                + Log Production Milestone
              </button>
            </div>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Vendor</th>
                    <th>Milestone Stage</th>
                    <th>Reported Date</th>
                    <th>Reported Output</th>
                    <th>Reported Scrap</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) =>
                    (o.milestones || []).map((m) => (
                      <tr key={m.id}>
                        <td><strong>{o.orderNo}</strong></td>
                        <td>{o.vendor?.name}</td>
                        <td><StatusBadge value={m.milestoneType} /></td>
                        <td>{dateFmt(m.statusDate)}</td>
                        <td>{m.reportedOutputQty !== null ? `${numberFmt(m.reportedOutputQty)} ${o.uom}` : '—'}</td>
                        <td>{m.reportedScrapQty !== null ? `${numberFmt(m.reportedScrapQty)} KG` : '—'}</td>
                        <td>{m.remarks || '—'}</td>
                      </tr>
                    ))
                  )}
                  {orders.every((o) => !o.milestones?.length) && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                        No production milestones logged yet. Click "+ Log Production Milestone" to record progress.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 7: FINISHED GOODS RECEIPT */}
      {activeTab === 'receipts' && (
        <>
          <div className={styles.sectionHeader}>
            <div>
              <h3>External Finished Goods Inward Receipts</h3>
              <p>Record delivery note receipts from external manufacturers. All goods enter Quality Hold strictly.</p>
            </div>
            <div className={styles.quickActions}>
              <button type="button" className={styles.primary} onClick={() => setModalType('createReceipt')}>
                + Receive Finished Goods
              </button>
            </div>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Receipt No</th>
                    <th>Order No</th>
                    <th>Vendor Mill</th>
                    <th>Warehouse</th>
                    <th>Received Qty</th>
                    <th>Vendor Batch</th>
                    <th>QC Status</th>
                    <th>Received At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.receiptNo}</strong></td>
                      <td>{r.jobWorkOrder?.orderNo}</td>
                      <td>{r.jobWorkOrder?.vendor?.name}</td>
                      <td>{r.warehouse?.name}</td>
                      <td><strong>{numberFmt(r.receivedQty)} {r.uom}</strong></td>
                      <td>{r.vendorBatchNo || '—'}</td>
                      <td><StatusBadge value={r.qcStatus} /></td>
                      <td>{dateTimeFmt(r.receivedAt)}</td>
                      <td>
                        <div className={styles.actions}>
                          {r.qcStatus === 'PENDING_QC' && (
                            <button type="button" className={styles.primary} onClick={() => {
                              setSelectedReceipt(r);
                              setQcForm({
                                receiptId: r.id,
                                acceptedQty: r.receivedQty,
                                rejectedQty: 0,
                                qcRemarks: '',
                              });
                              setModalType('inspectQc');
                            }}>
                              Inspect QC
                            </button>
                          )}
                          {Number(r.rejectedQty) > 0 && (
                            <button type="button" className={styles.warningButton} onClick={() => {
                              setSelectedReceipt(r);
                              setReworkForm({
                                receiptId: r.id,
                                reworkQty: r.rejectedQty,
                                notes: 'Dispatch for external defect rectification',
                              });
                              setModalType('createRework');
                            }}>
                              Dispatch Rework
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {receipts.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                        No finished goods receipts recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 8: QUALITY CONTROL GATE */}
      {activeTab === 'qc' && (
        <>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Subcontractor Quality Control (QC Gate)</h3>
              <p>Strict quality enforcement: Only PASSED lots release from Quality Hold into Available inventory.</p>
            </div>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Receipt No</th>
                    <th>Job Work Order</th>
                    <th>Received Qty</th>
                    <th>Accepted (Available)</th>
                    <th>Rejected (Quarantine)</th>
                    <th>Inspection Result</th>
                    <th>Remarks</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.receiptNo}</strong></td>
                      <td>{r.jobWorkOrder?.orderNo}</td>
                      <td>{numberFmt(r.receivedQty)} {r.uom}</td>
                      <td style={{ color: '#16a34a' }}><strong>{numberFmt(r.acceptedQty)} {r.uom}</strong></td>
                      <td style={{ color: '#dc2626' }}><strong>{numberFmt(r.rejectedQty)} {r.uom}</strong></td>
                      <td><StatusBadge value={r.qcStatus} /></td>
                      <td><small>{r.qcRemarks || '—'}</small></td>
                      <td>
                        <div className={styles.actions}>
                          {r.qcStatus === 'PENDING_QC' && (
                            <button type="button" className={styles.primary} onClick={() => {
                              setSelectedReceipt(r);
                              setQcForm({
                                receiptId: r.id,
                                acceptedQty: r.receivedQty,
                                rejectedQty: 0,
                                qcRemarks: '',
                              });
                              setModalType('inspectQc');
                            }}>
                              Conduct Inspection
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {receipts.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                        No receipts awaiting quality inspection.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 9: MATERIAL SCRAP RECONCILIATION */}
      {activeTab === 'reconciliation' && (
        <>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Material Consumption & Scrap Reconciliation</h3>
              <p>Per-material reconciliation matrix: Dispatched vs Consumed vs Returned vs Actual Scrap = Variance.</p>
            </div>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Reconciliation No</th>
                    <th>Order No</th>
                    <th>Output Produced</th>
                    <th>Gross Charges</th>
                    <th>Excess Scrap Debit</th>
                    <th>Net Payable</th>
                    <th>Payment Hold</th>
                    <th>Settlement Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliations.map((rec) => (
                    <tr key={rec.id}>
                      <td><strong>{rec.reconciliationNo}</strong></td>
                      <td>{rec.jobWorkOrder?.orderNo}</td>
                      <td>{numberFmt(rec.actualOutputQty)}</td>
                      <td>{currencyFmt(rec.grossJobWorkCharges)}</td>
                      <td style={{ color: Number(rec.excessWastageDebit) > 0 ? '#dc2626' : 'inherit' }}>
                        <strong>{currencyFmt(rec.excessWastageDebit)}</strong>
                      </td>
                      <td><strong>{currencyFmt(rec.netPayableToVendor)}</strong></td>
                      <td>
                        {rec.isPaymentHold ? (
                          <span className={`${styles.badge} ${styles.danger}`}>⛔ Payment Hold</span>
                        ) : (
                          <span className={`${styles.badge} ${styles.success}`}>Cleared</span>
                        )}
                      </td>
                      <td><StatusBadge value={rec.settlementStatus} /></td>
                      <td>
                        <div className={styles.actions}>
                          <button type="button" onClick={() => handleTogglePaymentHold(rec)}>
                            {rec.isPaymentHold ? 'Release Hold' : 'Apply Hold'}
                          </button>
                          {rec.settlementStatus !== 'SETTLED' && (
                            <button type="button" className={styles.successButton} onClick={() => handleSettleJobWork(rec.id)}>
                              Settle
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {reconciliations.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                        No reconciliations finalized yet. Open Tab 3 (Job Work Orders) and click "Reconcile" on an in-progress order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 10: VENDOR BILLING & SETTLEMENT */}
      {activeTab === 'billing' && (
        <>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Vendor Billing, Rework & Payment Clearance</h3>
              <p>Settlement authorization, debit note offset for excessive wastage, and payment release controls.</p>
            </div>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Reconciliation Ref</th>
                    <th>Manufacturer</th>
                    <th>Job Work Order</th>
                    <th>Gross Charges</th>
                    <th>Wastage Debit</th>
                    <th>Net Amount Due</th>
                    <th>Hold Status</th>
                    <th>Audit Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliations.map((rec) => (
                    <tr key={rec.id}>
                      <td><strong>{rec.reconciliationNo}</strong></td>
                      <td>{rec.jobWorkOrder?.vendor?.name}</td>
                      <td>{rec.jobWorkOrder?.orderNo}</td>
                      <td>{currencyFmt(rec.grossJobWorkCharges)}</td>
                      <td style={{ color: '#dc2626' }}>{currencyFmt(rec.excessWastageDebit)}</td>
                      <td><strong>{currencyFmt(rec.netPayableToVendor)}</strong></td>
                      <td>
                        {rec.isPaymentHold ? (
                          <span className={`${styles.badge} ${styles.danger}`}>⛔ ON HOLD: {rec.holdReason || 'Audit needed'}</span>
                        ) : (
                          <span className={`${styles.badge} ${styles.success}`}>CLEARED FOR PAYMENT</span>
                        )}
                      </td>
                      <td><StatusBadge value={rec.settlementStatus} /></td>
                      <td>
                        <div className={styles.actions}>
                          <button type="button" onClick={() => handleTogglePaymentHold(rec)}>
                            Toggle Hold
                          </button>
                          {rec.settlementStatus !== 'SETTLED' && (
                            <button type="button" className={styles.primary} onClick={() => handleSettleJobWork(rec.id)}>
                              Authorize Clearance
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {reconciliations.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                        No billing settlement records available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* MODAL 1: CREATE JOB WORK ORDER */}
      {modalType === 'createOrder' && (
        <Modal title="Create Job Work Order" onClose={() => setModalType(null)}>
          <form onSubmit={handleCreateOrder}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Select Contract Manufacturer (Vendor) *</label>
                <select
                  required
                  value={orderForm.vendorId}
                  onChange={(e) => setOrderForm({ ...orderForm, vendorId: e.target.value })}
                >
                  <option value="">Select Vendor...</option>
                  {manufacturers.map((v) => (
                    <option key={v.id} value={v.id}>{v.name} ({v.vendorCode})</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Select Finished Output Product *</label>
                <select
                  required
                  value={orderForm.outputProductId}
                  onChange={(e) => setOrderForm({ ...orderForm, outputProductId: e.target.value })}
                >
                  <option value="">Select Product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Approved BOM Formula *</label>
                <select
                  required
                  value={orderForm.bomId}
                  onChange={(e) => setOrderForm({ ...orderForm, bomId: e.target.value })}
                >
                  <option value="">Select Approved BOM...</option>
                  {approvedBoms
                    .filter((b) => !orderForm.outputProductId || b.outputProductId === orderForm.outputProductId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>{b.bomCode} (v{b.version}) — {b.bomName}</option>
                    ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Target Quantity to Produce *</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  required
                  value={orderForm.targetQuantity}
                  onChange={(e) => setOrderForm({ ...orderForm, targetQuantity: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Conversion Rate (Per Unit Charge) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={orderForm.conversionRate}
                  onChange={(e) => setOrderForm({ ...orderForm, conversionRate: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Unit of Measure (UOM)</label>
                <input
                  type="text"
                  value={orderForm.uom}
                  onChange={(e) => setOrderForm({ ...orderForm, uom: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Expected Return Date</label>
                <input
                  type="date"
                  value={orderForm.expectedReturnDate}
                  onChange={(e) => setOrderForm({ ...orderForm, expectedReturnDate: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Delivery / Processing Factory Address</label>
                <input
                  type="text"
                  value={orderForm.deliveryAddress}
                  onChange={(e) => setOrderForm({ ...orderForm, deliveryAddress: e.target.value })}
                />
              </div>
            </div>

            <div className={styles.formActions}>
              <button type="button" onClick={() => setModalType(null)}>Cancel</button>
              <button type="submit" className={styles.primary} disabled={loading}>
                {loading ? 'Creating...' : 'Create Order & Scale BOM'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: FIFO DISPATCH & CHALLAN */}
      {modalType === 'dispatch' && selectedOrder && (
        <Modal title={`Dispatch Materials: ${selectedOrder.orderNo}`} onClose={() => setModalType(null)}>
          <form onSubmit={handleDispatchMaterials}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Dispatch From Warehouse *</label>
                <select
                  required
                  value={dispatchForm.warehouseId}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, warehouseId: e.target.value })}
                >
                  <option value="">Select Warehouse...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Dispatch Date</label>
                <input
                  type="date"
                  value={dispatchForm.dispatchDate}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, dispatchDate: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Transporter Name</label>
                <input
                  type="text"
                  placeholder="e.g. VRL Logistics"
                  value={dispatchForm.transporterName}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, transporterName: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Vehicle Number</label>
                <input
                  type="text"
                  placeholder="e.g. GJ-05-XX-1234"
                  value={dispatchForm.vehicleNo}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, vehicleNo: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label>E-Way Bill Number (Rule 138)</label>
                <input
                  type="text"
                  placeholder="12-digit E-Way Bill"
                  value={dispatchForm.eWayBillNo}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, eWayBillNo: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label>LR / Lorry Receipt Number</label>
                <input
                  type="text"
                  placeholder="Consignment LR No"
                  value={dispatchForm.lrNumber}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, lrNumber: e.target.value })}
                />
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <h4>Component Quantities to Dispatch (FIFO Allocation)</h4>
              <table style={{ width: '100%', marginTop: '.5rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '.5rem', textAlign: 'left' }}>Component SKU</th>
                    <th style={{ padding: '.5rem', textAlign: 'left' }}>Pending Qty</th>
                    <th style={{ padding: '.5rem', textAlign: 'left' }}>Dispatch Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatchForm.items.map((it, idx) => (
                    <tr key={it.productId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '.5rem' }}><strong>{it.sku}</strong> ({it.name})</td>
                      <td style={{ padding: '.5rem' }}>{numberFmt(it.remainingToDispatch)} {it.uom}</td>
                      <td style={{ padding: '.5rem' }}>
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          max={it.remainingToDispatch}
                          style={{ width: '120px', padding: '.4rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                          value={it.quantity}
                          onChange={(e) => {
                            const newItems = [...dispatchForm.items];
                            newItems[idx].quantity = e.target.value;
                            setDispatchForm({ ...dispatchForm, items: newItems });
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.formActions}>
              <button type="button" onClick={() => setModalType(null)}>Cancel</button>
              <button type="submit" className={styles.primary} disabled={loading}>
                {loading ? 'Allocating FIFO...' : 'Issue Delivery Challan'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: PRINTABLE DELIVERY CHALLAN */}
      {modalType === 'viewChallanDoc' && selectedChallan && (
        <Modal title={`Delivery Challan: ${selectedChallan.challanNo}`} onClose={() => setModalType(null)}>
          <div className={styles.challanDoc}>
            <div className={styles.challanHeader}>
              <h2>DELIVERY CHALLAN FOR JOB WORK</h2>
              <p>(Issued under Section 143 read with Rule 55 of Central Goods and Services Tax Rules, 2017)</p>
            </div>

            <div className={styles.challanMetaGrid}>
              <div>
                <strong>Challan No:</strong> {selectedChallan.challanNo}<br />
                <strong>Dispatch Date:</strong> {dateFmt(selectedChallan.dispatchDate)}<br />
                <strong>Statutory 1-Year Due:</strong> {dateFmt(selectedChallan.statutory1YearDueDate)}<br />
                <strong>Job Work Order:</strong> {selectedChallan.jobWorkOrder?.orderNo}<br />
                <strong>Warehouse (Origin):</strong> {selectedChallan.warehouse?.name}
              </div>
              <div>
                <strong>Transporter:</strong> {selectedChallan.transporterName || 'Self / Direct'}<br />
                <strong>Vehicle No:</strong> {selectedChallan.vehicleNo || '—'}<br />
                <strong>E-Way Bill:</strong> {selectedChallan.eWayBillNo || '—'}<br />
                <strong>Consignee (Job Worker):</strong> {selectedChallan.vendor?.name}<br />
                <strong>Destination:</strong> {selectedChallan.destinationAddress}
              </div>
            </div>

            <table className={styles.challanTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item Description</th>
                  <th>Batch / Lot No</th>
                  <th>HSN Code</th>
                  <th>Qty Dispatched</th>
                  <th>Unit Value</th>
                  <th>Taxable Value</th>
                </tr>
              </thead>
              <tbody>
                {(selectedChallan.items || []).map((ci, idx) => (
                  <tr key={ci.id}>
                    <td>{idx + 1}</td>
                    <td>{ci.product?.name || ci.sku}</td>
                    <td>{ci.rmBatchNo}</td>
                    <td>{ci.hsnCode || '5205'}</td>
                    <td>{numberFmt(ci.quantityDispatched)} {ci.uom}</td>
                    <td>{currencyFmt(ci.unitCost)}</td>
                    <td>{currencyFmt(ci.taxableValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p style={{ fontStyle: 'italic', fontSize: '.75rem', marginTop: '1rem' }}>
              Declaration: We declare that this delivery challan shows the actual quantity of goods described and that all particulars are true and correct. Inputs dispatched must be returned within 1 year as per GST provisions.
            </p>

            <div className={styles.challanSignatures}>
              <div className={styles.signBox}>
                Authorized Signatory<br />
                SHREE NATH EXPORTS
              </div>
              <div className={styles.signBox}>
                Received in Good Order<br />
                {selectedChallan.acknowledgedBy ? `Ack by: ${selectedChallan.acknowledgedBy}` : 'Vendor Signature & Mill Stamp'}
              </div>
            </div>
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={() => window.print()} className={styles.primary}>
              Print / Save PDF
            </button>
            <button type="button" onClick={() => setModalType(null)}>Close</button>
          </div>
        </Modal>
      )}

      {/* MODAL 4: INWARD FINISHED GOODS RECEIPT */}
      {modalType === 'createReceipt' && (
        <Modal title="Inward Finished Goods Receipt" onClose={() => setModalType(null)}>
          <form onSubmit={handleCreateReceipt}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Job Work Order *</label>
                <select
                  required
                  value={receiptForm.jobWorkOrderId}
                  onChange={(e) => setReceiptForm({ ...receiptForm, jobWorkOrderId: e.target.value })}
                >
                  <option value="">Select In-Progress Order...</option>
                  {orders.filter((o) => ['APPROVED', 'IN_PROGRESS'].includes(o.status)).map((o) => (
                    <option key={o.id} value={o.id}>{o.orderNo} — {o.vendor?.name} ({o.outputProduct?.sku})</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Receiving Warehouse *</label>
                <select
                  required
                  value={receiptForm.warehouseId}
                  onChange={(e) => setReceiptForm({ ...receiptForm, warehouseId: e.target.value })}
                >
                  <option value="">Select Warehouse...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Received Quantity *</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  required
                  value={receiptForm.receivedQty}
                  onChange={(e) => setReceiptForm({ ...receiptForm, receivedQty: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Vendor Delivery Note / Challan Ref</label>
                <input
                  type="text"
                  placeholder="e.g. DN-MILL-881"
                  value={receiptForm.vendorDeliveryNote}
                  onChange={(e) => setReceiptForm({ ...receiptForm, vendorDeliveryNote: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Vendor Production Lot / Batch No</label>
                <input
                  type="text"
                  placeholder="e.g. VLOT-FABRIC-A"
                  value={receiptForm.vendorBatchNo}
                  onChange={(e) => setReceiptForm({ ...receiptForm, vendorBatchNo: e.target.value })}
                />
              </div>
            </div>

            <div className={styles.alertWarning} style={{ marginTop: '1rem' }}>
              🛡️ Quality Rule: Goods will enter <strong>QUALITY_HOLD</strong> automatically. Stock will NOT be added to Available inventory until QC inspection is marked PASSED.
            </div>

            <div className={styles.formActions}>
              <button type="button" onClick={() => setModalType(null)}>Cancel</button>
              <button type="submit" className={styles.primary} disabled={loading}>
                {loading ? 'Receiving...' : 'Record Inward Receipt'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 5: QC INSPECTION GATE */}
      {modalType === 'inspectQc' && selectedReceipt && (
        <Modal title={`Quality Control Inspection: ${selectedReceipt.receiptNo}`} onClose={() => setModalType(null)}>
          <form onSubmit={handleInspectQc}>
            <p>
              Received: <strong>{numberFmt(selectedReceipt.receivedQty)} {selectedReceipt.uom}</strong> from <strong>{selectedReceipt.jobWorkOrder?.vendor?.name}</strong>.
            </p>

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Accepted Quantity (Release to AVAILABLE) *</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  max={selectedReceipt.receivedQty}
                  required
                  value={qcForm.acceptedQty}
                  onChange={(e) => {
                    const acc = Number(e.target.value || 0);
                    setQcForm({
                      ...qcForm,
                      acceptedQty: e.target.value,
                      rejectedQty: Math.max(0, Number(selectedReceipt.receivedQty) - acc),
                    });
                  }}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Rejected Quantity (Move to Quarantine)</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  max={selectedReceipt.receivedQty}
                  value={qcForm.rejectedQty}
                  onChange={(e) => {
                    const rej = Number(e.target.value || 0);
                    setQcForm({
                      ...qcForm,
                      rejectedQty: e.target.value,
                      acceptedQty: Math.max(0, Number(selectedReceipt.receivedQty) - rej),
                    });
                  }}
                />
              </div>
            </div>

            <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
              <label>Quality Remarks & Observations</label>
              <textarea
                rows={3}
                placeholder="Tested tensile strength, shade variation, dimensional stability..."
                value={qcForm.qcRemarks}
                onChange={(e) => setQcForm({ ...qcForm, qcRemarks: e.target.value })}
              />
            </div>

            <div className={styles.formActions}>
              <button type="button" onClick={() => setModalType(null)}>Cancel</button>
              <button type="submit" className={styles.successButton} disabled={loading}>
                {loading ? 'Releasing...' : 'Confirm QC Release'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 6: MATERIAL SCRAP RECONCILIATION */}
      {modalType === 'reconciliation' && selectedOrder && reconciliationPreview && (
        <Modal title={`Material Reconciliation: ${selectedOrder.orderNo}`} onClose={() => setModalType(null)}>
          <form onSubmit={handleFinalizeReconciliation}>
            <div className={styles.reconCard}>
              <div className={styles.reconRow}>
                <span>Target Output Planned:</span>
                <span>{numberFmt(reconciliationPreview.plannedOutputQty)} {selectedOrder.uom}</span>
              </div>
              <div className={styles.reconRow}>
                <span>Total Accepted Output:</span>
                <span style={{ color: '#16a34a' }}>{numberFmt(reconciliationPreview.actualOutputQty)} {selectedOrder.uom}</span>
              </div>
              <div className={styles.reconRow}>
                <span>Gross Job Work Charges ({currencyFmt(selectedOrder.conversionRate)}/unit):</span>
                <span>{currencyFmt(reconciliationPreview.grossJobWorkCharges)}</span>
              </div>
              <div className={styles.reconRow}>
                <span>Excess Scrap & Wastage Debit:</span>
                <span style={{ color: '#dc2626' }}>- {currencyFmt(reconciliationPreview.excessWastageDebit)}</span>
              </div>
              <div className={styles.reconRow}>
                <span>Net Payable to Vendor:</span>
                <span>{currencyFmt(reconciliationPreview.netPayableToVendor)}</span>
              </div>
            </div>

            <h4>Component Scrap & Consumption Reconciliation</h4>
            <div className={styles.tableScroll} style={{ marginTop: '.5rem', maxHeight: '250px' }}>
              <table style={{ width: '100%', fontSize: '.75rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '.4rem' }}>Component</th>
                    <th style={{ padding: '.4rem' }}>Dispatched</th>
                    <th style={{ padding: '.4rem' }}>Consumed</th>
                    <th style={{ padding: '.4rem' }}>Returned</th>
                    <th style={{ padding: '.4rem' }}>Actual Scrap</th>
                    <th style={{ padding: '.4rem' }}>Permissible</th>
                    <th style={{ padding: '.4rem' }}>Variance</th>
                    <th style={{ padding: '.4rem' }}>Debit (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliationPreview.items.map((it, idx) => {
                    const rowScrap = Number(reconForm.items[idx]?.actualScrapQty ?? it.actualScrapQty ?? 0);
                    const rowConsumed = Number(reconForm.items[idx]?.consumedQty ?? it.consumedQty ?? 0);
                    const rowDispatched = Number(it.dispatchedQty || 0);
                    const rowReturned = Number(it.returnedQty || 0);
                    const rowPermissible = round4(rowConsumed * ((it.scrapTolerancePct || 0) / 100));
                    const rowVariance = round4(rowDispatched - rowConsumed - rowReturned - rowScrap);
                    const rowExcessScrap = Math.max(0, round4(rowScrap - rowPermissible));
                    const rowDebit = round2(rowExcessScrap * (it.unitCost || 0));

                    return (
                      <tr key={it.productId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '.4rem' }}><strong>{it.sku}</strong></td>
                        <td style={{ padding: '.4rem' }}>{numberFmt(rowDispatched)} {it.uom}</td>
                        <td style={{ padding: '.4rem' }}>{numberFmt(rowConsumed)}</td>
                        <td style={{ padding: '.4rem' }}>{numberFmt(rowReturned)}</td>
                        <td style={{ padding: '.4rem' }}>
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            style={{ width: '80px', padding: '.2rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                            value={reconForm.items[idx]?.actualScrapQty ?? it.actualScrapQty}
                            onChange={(e) => {
                              const newItems = [...reconForm.items];
                              newItems[idx] = { ...newItems[idx], actualScrapQty: e.target.value };
                              setReconForm({ ...reconForm, items: newItems });
                            }}
                          />
                        </td>
                        <td style={{ padding: '.4rem' }}>{numberFmt(rowPermissible)}</td>
                        <td style={{ padding: '.4rem', color: rowVariance !== 0 ? '#dc2626' : 'inherit' }}>
                          <strong>{numberFmt(rowVariance)}</strong>
                        </td>
                        <td style={{ padding: '.4rem', color: rowDebit > 0 ? '#dc2626' : 'inherit' }}>
                          {currencyFmt(rowDebit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
              <label>Reconciliation Audit Notes & Debit Memo Reference</label>
              <textarea
                rows={2}
                placeholder="Vendor confirmed scrap levels. Excess wastage debited under terms."
                value={reconForm.notes}
                onChange={(e) => setReconForm({ ...reconForm, notes: e.target.value })}
              />
            </div>

            <div className={styles.formActions}>
              <button type="button" onClick={() => setModalType(null)}>Cancel</button>
              <button type="submit" className={styles.primary} disabled={loading}>
                {loading ? 'Finalizing...' : 'Finalize Reconciliation & Apply Hold'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 7: VIEW ORDER DETAILS */}
      {modalType === 'viewOrder' && selectedOrder && (
        <Modal title={`Job Work Order Details: ${selectedOrder.orderNo}`} onClose={() => setModalType(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.formGrid}>
              <div>
                <strong>Order No:</strong> {selectedOrder.orderNo}<br />
                <strong>Vendor Mill:</strong> {selectedOrder.vendor?.name}<br />
                <strong>Output Product:</strong> {selectedOrder.outputProduct?.sku} ({selectedOrder.outputProduct?.name})<br />
                <strong>Target Quantity:</strong> {numberFmt(selectedOrder.targetQuantity)} {selectedOrder.uom}
              </div>
              <div>
                <strong>Conversion Rate:</strong> {currencyFmt(selectedOrder.conversionRate)} / unit<br />
                <strong>Estimated Cost:</strong> {currencyFmt(selectedOrder.estimatedTotalCost)}<br />
                <strong>Status:</strong> <StatusBadge value={selectedOrder.status} /><br />
                <strong>Delivery Address:</strong> {selectedOrder.deliveryAddress || 'On file'}
              </div>
            </div>

            <h4>Required Components (Scaled from BOM)</h4>
            <table style={{ width: '100%', fontSize: '.8rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '.5rem', textAlign: 'left' }}>Component SKU</th>
                  <th style={{ padding: '.5rem', textAlign: 'left' }}>Required</th>
                  <th style={{ padding: '.5rem', textAlign: 'left' }}>Dispatched</th>
                  <th style={{ padding: '.5rem', textAlign: 'left' }}>Consumed</th>
                  <th style={{ padding: '.5rem', textAlign: 'left' }}>Returned</th>
                </tr>
              </thead>
              <tbody>
                {(selectedOrder.items || []).map((it) => (
                  <tr key={it.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '.5rem' }}><strong>{it.product?.sku}</strong> ({it.product?.name})</td>
                    <td style={{ padding: '.5rem' }}>{numberFmt(it.requiredQuantity)} {it.uom}</td>
                    <td style={{ padding: '.5rem' }}>{numberFmt(it.dispatchedQuantity)} {it.uom}</td>
                    <td style={{ padding: '.5rem' }}>{numberFmt(it.consumedQuantity)} {it.uom}</td>
                    <td style={{ padding: '.5rem' }}>{numberFmt(it.returnedQuantity)} {it.uom}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={styles.formActions}>
              <button type="button" onClick={() => setModalType(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useCompanyAuthContext } from '@/context/CompanyAuthContext';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import styles from './InventoryModule.module.css';

const TAB_ALIASES = {
  dashboard: 'dashboard',
  stock: 'stock',
  current: 'stock',
  transfers: 'stock',
  warehouses: 'warehouses',
  bins: 'warehouses',
  batches: 'batches',
  reservations: 'reservations',
  sampling: 'sampling',
  gatepass: 'gatepass',
  gate_pass: 'gatepass',
  inward: 'gatepass',
  outward: 'gatepass',
  register: 'gatepass',
  returnable: 'gatepass',
  verifications: 'verifications',
  verification: 'verifications',
  adjustments: 'adjustments',
  movements: 'movements',
  valuations: 'movements',
};

const BUCKET_DEFINITIONS = [
  { key: 'available', label: 'Available', css: 'AVAILABLE', icon: '🟢', desc: 'Ready for customer orders & dispatch' },
  { key: 'reserved', label: 'Reserved', css: 'RESERVED', icon: '🟠', desc: 'Committed to active sales orders' },
  { key: 'wip', label: 'Work In Progress', css: 'WIP', icon: '🔵', desc: 'Active production & manufacturing floor' },
  { key: 'qualityHold', label: 'Quality Hold', css: 'QUALITY_HOLD', icon: '🟣', desc: 'Under QC / laboratory inspection' },
  { key: 'rejected', label: 'Rejected', css: 'REJECTED', icon: '🔴', desc: 'Failed QC, pending return/vendor credit' },
  { key: 'sampling', label: 'Sampling', css: 'SAMPLING', icon: '🩵', desc: 'Issued to prospective buyers for testing' },
  { key: 'returnHold', label: 'Return Hold', css: 'RETURN_HOLD', icon: '🟡', desc: 'Customer returns pending inspection' },
  { key: 'scrap', label: 'Scrap / Waste', css: 'SCRAP', icon: '⚫', desc: 'Condemned scrap material for salvage' },
];

const EMPTY_STOCK = {
  productId: '', binId: '', sku: '', name: '', itemType: 'RAW_MATERIAL', warehouse: 'Main Warehouse',
  stock: '0', reorderLevel: '10', uom: 'PCS', binLocation: '', averageCost: '0',
};

const EMPTY_BUCKET_TRANSFER = {
  sku: '', warehouse: 'Main Warehouse', sourceBucket: 'AVAILABLE', destinationBucket: 'QUALITY_HOLD',
  quantity: '', batchNo: '', reason: '',
};

const EMPTY_WAREHOUSE = { code: '', name: '', address: '', contactName: '', contactPhone: '', isDefault: false };
const EMPTY_BIN = { code: '', aisle: '', rack: '', description: '' };

const EMPTY_BATCH = {
  sku: '', batchNo: '', warehouse: 'Main Warehouse', initialQty: '', availableQty: '',
  receivedDate: new Date().toISOString().split('T')[0], expiryDate: '', vendorName: '',
  qualityStatus: 'ACCEPTED', unitCost: '0',
};

const EMPTY_FIFO_QUERY = {
  sku: '', warehouse: 'Main Warehouse', quantity: '', autoReserve: false,
};

const EMPTY_RESERVATION = {
  sku: '', warehouse: 'Main Warehouse', batchNo: '', quantity: '',
  referenceType: 'SALES_ORDER', referenceNo: '', notes: '',
};

const EMPTY_SAMPLING = {
  sku: '', warehouse: 'Main Warehouse', batchNo: '', quantity: '', customerName: '',
  billingType: 'FREE', waivedReason: '', expectedReturnDate: '', responsiblePerson: '',
  referenceNo: '', notes: '',
};

const EMPTY_GATE_PASS = {
  gatePassType: 'SAMPLE', fromWarehouse: 'Main Warehouse', destination: '', purpose: '',
  expectedReturnDate: '', notes: '',
  items: [{ sku: '', name: '', qty: '1', uom: 'PCS', value: '0', serialOrBatch: '' }],
};

const EMPTY_VERIFICATION = {
  warehouse: 'Main Warehouse', scheduleFrequency: 'FORTNIGHTLY',
  scheduledDate: new Date().toISOString().split('T')[0], verifierName: '', notes: '',
};

const EMPTY_ADJUSTMENT = {
  sku: '', warehouse: 'Main Warehouse', bucket: 'AVAILABLE', adjustmentType: 'CORRECTION',
  adjustmentQty: '', reason: '', supportingDocUrl: '', notes: '',
};

function number(value) {
  return Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function dateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function dateOnly(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}

function Status({ value }) {
  const str = String(value || 'PENDING').replaceAll('_', ' ');
  const tone = ['ACTIVE', 'APPROVED', 'COMPLETED', 'DISPATCHED', 'RETURNED', 'PASSED_QC', 'ACCEPTED'].includes(value)
    ? 'success'
    : ['PENDING', 'PENDING_APPROVAL', 'IN_PROGRESS', 'PARTIALLY_RETURNED', 'HOLD', 'WAITING'].includes(value)
      ? 'warning'
      : ['CANCELLED', 'REJECTED', 'FAILED_QC', 'EXPIRED', 'DEPLETED'].includes(value)
        ? 'danger'
        : 'info';
  return <span className={`${styles.badge} ${styles[tone]}`}>{str}</span>;
}

function TableShell({ children }) {
  return <div className={styles.tableCard}><div className={styles.tableScroll}>{children}</div></div>;
}

function FormField({ label, children }) {
  return <label className={styles.field}><span>{label}</span>{children}</label>;
}

export default function InventoryModule({ activeCompany, showToast, initialSubTab }) {
  const { currentUser } = useCompanyAuthContext();
  const initialTab = TAB_ALIASES[initialSubTab] || initialSubTab || 'dashboard';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState(null);

  // Core Data States
  const [dashboard, setDashboard] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [samplings, setSamplings] = useState([]);
  const [gatePasses, setGatePasses] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [movements, setMovements] = useState([]);

  // Active Verification Session Detail (for entering counts)
  const [activeVerificationSession, setActiveVerificationSession] = useState(null);
  const [verificationCounts, setVerificationCounts] = useState({});

  // FIFO Allocation Simulator Result
  const [fifoResult, setFifoResult] = useState(null);

  // Form States
  const [stockForm, setStockForm] = useState(EMPTY_STOCK);
  const [transferBucketForm, setTransferBucketForm] = useState(EMPTY_BUCKET_TRANSFER);
  const [warehouseForm, setWarehouseForm] = useState(EMPTY_WAREHOUSE);
  const [binForm, setBinForm] = useState(EMPTY_BIN);
  const [batchForm, setBatchForm] = useState(EMPTY_BATCH);
  const [fifoForm, setFifoForm] = useState(EMPTY_FIFO_QUERY);
  const [reservationForm, setReservationForm] = useState(EMPTY_RESERVATION);
  const [samplingForm, setSamplingForm] = useState(EMPTY_SAMPLING);
  const [samplingReturnForm, setSamplingReturnForm] = useState({ returnedQty: '1', destinationBucket: 'AVAILABLE', inspectionStatus: 'PASSED_QC', notes: '' });
  const [gatePassForm, setGatePassForm] = useState(EMPTY_GATE_PASS);
  const [gatePassReturnForm, setGatePassReturnForm] = useState({ isPartial: false, notes: '' });
  const [verificationForm, setVerificationForm] = useState(EMPTY_VERIFICATION);
  const [adjustmentForm, setAdjustmentForm] = useState(EMPTY_ADJUSTMENT);
  const [locationBinId, setLocationBinId] = useState('');

  // Filters
  const [stockSearch, setStockSearch] = useState('');
  const [stockWarehouseFilter, setStockWarehouseFilter] = useState('');
  const [batchWarehouseFilter, setBatchWarehouseFilter] = useState('');
  const [batchQcFilter, setBatchQcFilter] = useState('');
  const [reservationStatusFilter, setReservationStatusFilter] = useState('');
  const [samplingStatusFilter, setSamplingStatusFilter] = useState('');
  const [gatePassTypeFilter, setGatePassTypeFilter] = useState('');
  const [gatePassStatusFilter, setGatePassStatusFilter] = useState('');
  const [verificationStatusFilter, setVerificationStatusFilter] = useState('');
  const [adjustmentStatusFilter, setAdjustmentStatusFilter] = useState('');
  const [movementBucketFilter, setMovementBucketFilter] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState('');
  const [movementSearch, setMovementSearch] = useState('');

  useEffect(() => {
    setActiveTab(TAB_ALIASES[initialSubTab] || initialSubTab || 'dashboard');
  }, [initialSubTab]);

  const companyPath = activeCompany?.id ? `/companies/${activeCompany.id}/inventory` : '';

  // Data Loader
  const loadAll = useCallback(async () => {
    if (!companyPath) return;
    setLoading(true);
    setLoadError('');

    const endpoints = [
      'dashboard', 'stocks', 'products', 'warehouses', 'batches',
      'reservations', 'samplings', 'gate-passes', 'verifications',
      'adjustments', 'movements',
    ];

    const results = await Promise.allSettled(
      endpoints.map((ep) => api.get(`${companyPath}/${ep}`, { noCache: true, timeout: 12000 }))
    );

    const setters = [
      setDashboard, setStocks, setProducts, setWarehouses, setBatches,
      setReservations, setSamplings, setGatePasses, setVerifications,
      setAdjustments, setMovements,
    ];

    results.forEach((res, i) => {
      if (res.status === 'fulfilled') {
        setters[i](res.value.data || (i === 0 ? null : []));
      }
    });

    const err = results.find((r) => r.status === 'rejected');
    if (err) setLoadError(err.reason?.message || 'Some inventory records could not be retrieved.');
    setLoading(false);
  }, [companyPath]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Derived options
  const warehouseNames = useMemo(() => {
    const set = new Set(['Main Warehouse']);
    warehouses.forEach((w) => set.add(w.name));
    stocks.forEach((s) => set.add(s.warehouse));
    return Array.from(set);
  }, [warehouses, stocks]);

  const selectedWarehouseBins = useMemo(() => {
    return warehouses.find((w) => w.name === stockForm.warehouse)?.bins || [];
  }, [warehouses, stockForm.warehouse]);

  const locationBins = useMemo(() => {
    return warehouses.find((w) => w.name === modal?.row?.warehouse)?.bins || [];
  }, [warehouses, modal?.row?.warehouse]);

  // Action Runner
  const runAction = async (action, successTitle, successMessage) => {
    setSaving(true);
    try {
      await action();
      setModal(null);
      await loadAll();
      showToast(successTitle, successMessage, 'success');
    } catch (err) {
      showToast('Inventory action failed', err.message || 'Please check input and try again.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  // 10 Tabs Definition
  const tabs = [
    ['dashboard', 'Dashboard'],
    ['stock', 'Stock Overview'],
    ['warehouses', 'Warehouse & Bins'],
    ['batches', 'Batch / Lot & FIFO'],
    ['reservations', 'Stock Reservations'],
    ['sampling', 'Customer Sampling'],
    ['gatepass', 'Gate Pass Register'],
    ['verifications', 'Physical Verification'],
    ['adjustments', 'Maker-Checker Adjustments'],
    ['movements', 'Movement Ledger'],
  ];

  // ==========================================================================
  // ACTION HANDLERS
  // ==========================================================================

  // Stock Master
  const submitStock = (e) => {
    e.preventDefault();
    runAction(
      () => api.post(`${companyPath}/stocks`, stockForm),
      'Stock Master Initialized',
      `${stockForm.sku.toUpperCase()} has been created across the 8 inventory buckets.`
    );
  };

  // Bucket Transfer
  const submitBucketTransfer = (e) => {
    e.preventDefault();
    runAction(
      () => api.post(`${companyPath}/stocks/transfer-bucket`, transferBucketForm),
      'Bucket Stock Transferred',
      `Transferred ${transferBucketForm.quantity} units of ${transferBucketForm.sku} from ${transferBucketForm.sourceBucket} to ${transferBucketForm.destinationBucket}.`
    );
  };

  // Warehouse & Bin
  const submitWarehouse = (e) => {
    e.preventDefault();
    runAction(
      () => api.post(`${companyPath}/warehouses`, warehouseForm),
      'Warehouse Registered',
      `${warehouseForm.name} (${warehouseForm.code}) is ready for stock operations.`
    );
  };

  const submitBin = (e) => {
    e.preventDefault();
    runAction(
      () => api.post(`${companyPath}/warehouses/${modal.row.id}/bins`, binForm),
      'Bin Location Added',
      `${binForm.code.toUpperCase()} is configured in ${modal.row.name}.`
    );
  };

  const submitLocation = (e) => {
    e.preventDefault();
    runAction(
      () => api.patch(`${companyPath}/stocks/${modal.row.id}/location`, { binId: locationBinId }),
      'Bin Location Linked',
      `${modal.row.sku} is mapped to the selected bin.`
    );
  };

  // Batches & FIFO
  const submitBatch = (e) => {
    e.preventDefault();
    runAction(
      () => api.post(`${companyPath}/batches`, batchForm),
      'Batch Created',
      `Batch ${batchForm.batchNo} for ${batchForm.sku} created with ${batchForm.initialQty} units.`
    );
  };

  const runFifoAllocation = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFifoResult(null);
    try {
      const res = await api.post(`${companyPath}/batches/allocate-fifo`, fifoForm);
      setFifoResult(res.data);
      if (fifoForm.autoReserve) {
        await loadAll();
        showToast('FIFO Allocation Reserved', `Successfully allocated and reserved ${res.data.allocatedQty} units across ${res.data.batchesAllocated.length} batches.`, 'success');
      } else {
        showToast('FIFO Calculation Complete', `Allocated ${res.data.allocatedQty} units across ${res.data.batchesAllocated.length} batches.`, 'info');
      }
    } catch (err) {
      showToast('FIFO Allocation Failed', err.message || 'Cannot allocate via FIFO.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  // Reservations
  const submitReservation = (e) => {
    e.preventDefault();
    runAction(
      () => api.post(`${companyPath}/reservations`, reservationForm),
      'Stock Reserved',
      `Reserved ${reservationForm.quantity} units of ${reservationForm.sku} from Available bucket.`
    );
  };

  const releaseReservation = (reservation) => {
    runAction(
      () => api.post(`${companyPath}/reservations/${reservation.id}/release`, { reason: 'Released from UI' }),
      'Reservation Released',
      `${reservation.reservationNo} released back to Available bucket.`
    );
  };

  const cancelReservation = (reservation) => {
    runAction(
      () => api.post(`${companyPath}/reservations/${reservation.id}/cancel`, { reason: 'Cancelled from UI' }),
      'Reservation Cancelled',
      `${reservation.reservationNo} cancelled.`
    );
  };

  // Sampling
  const submitSampling = (e) => {
    e.preventDefault();
    runAction(
      () => api.post(`${companyPath}/samplings`, samplingForm),
      'Sample Request Registered',
      `Sample ${samplingForm.quantity} units for ${samplingForm.customerName} created.`
    );
  };

  const approveWaivedSampling = (sampling) => {
    runAction(
      () => api.post(`${companyPath}/samplings/${sampling.id}/approve-waived`, {}),
      'Sample Fee Waiver Approved',
      `Sampling ${sampling.samplingNo} approved and issued to Sampling bucket.`
    );
  };

  const submitSamplingReturn = (e) => {
    e.preventDefault();
    runAction(
      () => api.post(`${companyPath}/samplings/${modal.row.id}/return`, samplingReturnForm),
      'Sample Return Recorded',
      `Returned ${samplingReturnForm.returnedQty} units of ${modal.row.sku} to ${samplingReturnForm.destinationBucket}.`
    );
  };

  // Gate Pass
  const submitGatePass = (e) => {
    e.preventDefault();
    runAction(
      () => api.post(`${companyPath}/gate-passes`, gatePassForm),
      'Gate Pass Created',
      `Gate Pass to ${gatePassForm.destination} created.`
    );
  };

  const dispatchGatePass = (gp) => {
    runAction(
      () => api.post(`${companyPath}/gate-passes/${gp.id}/dispatch`, {}),
      'Gate Pass Dispatched',
      `${gp.gatePassNo} marked as Dispatched from warehouse.`
    );
  };

  const submitGatePassReturn = (e) => {
    e.preventDefault();
    runAction(
      () => api.post(`${companyPath}/gate-passes/${modal.row.id}/return`, gatePassReturnForm),
      'Gate Pass Return Logged',
      `${modal.row.gatePassNo} return recorded.`
    );
  };

  // Physical Verification
  const submitVerificationSession = (e) => {
    e.preventDefault();
    runAction(
      () => api.post(`${companyPath}/verifications`, verificationForm),
      'Audit Session Initialized',
      `Fortnightly stock verification session created for ${verificationForm.warehouse}. System stock snapshot captured.`
    );
  };

  const openCountWorkspace = async (session) => {
    try {
      const res = await api.get(`${companyPath}/verifications/${session.id}`);
      setActiveVerificationSession(res.data);
      const initialCounts = {};
      (res.data.items || []).forEach((it) => {
        initialCounts[it.sku] = String(it.countedQty ?? it.systemQty ?? 0);
      });
      setVerificationCounts(initialCounts);
      setModal({ type: 'verification-counts', row: res.data });
    } catch (err) {
      showToast('Cannot Open Session', err.message, 'danger');
    }
  };

  const submitVerificationCounts = async (e) => {
    e.preventDefault();
    const items = (activeVerificationSession.items || []).map((it) => ({
      sku: it.sku,
      countedQty: Number.parseInt(verificationCounts[it.sku] || 0, 10),
      remarks: 'Physical count entry',
    }));

    runAction(
      () => api.post(`${companyPath}/verifications/${activeVerificationSession.id}/submit-counts`, { items }),
      'Counts Submitted',
      `Verification counts recorded with automated variance calculation. Ready for auditor/manager sign-off.`
    );
  };

  const approveVerificationSession = (session) => {
    runAction(
      () => api.post(`${companyPath}/verifications/${session.id}/approve`, {}),
      'Verification Session Approved',
      `Session ${session.sessionNo} approved.`
    );
  };

  // Maker-Checker Adjustments
  const submitAdjustment = (e) => {
    e.preventDefault();
    runAction(
      () => api.post(`${companyPath}/adjustments`, adjustmentForm),
      'Adjustment Submitted for Approval',
      `Adjustment ${adjustmentForm.adjustmentQty > 0 ? '+' : ''}${adjustmentForm.adjustmentQty} for ${adjustmentForm.sku} sent to maker-checker approval.`
    );
  };

  const approveAdjustment = (adj) => {
    runAction(
      () => api.post(`${companyPath}/adjustments/${adj.id}/approve`, {}),
      'Adjustment Approved',
      `Stock adjustment ${adj.adjustmentNo} approved and posted to ${adj.bucket} bucket.`
    );
  };

  const rejectAdjustment = (adj) => {
    const reason = window.prompt('Enter reason for rejecting this adjustment:', 'Rejected by manager');
    if (!reason) return;
    runAction(
      () => api.post(`${companyPath}/adjustments/${adj.id}/reject`, { reason }),
      'Adjustment Rejected',
      `Stock adjustment ${adj.adjustmentNo} rejected.`
    );
  };

  // ==========================================================================
  // TAB RENDERERS
  // ==========================================================================

  // 1. Dashboard Tab
  const renderDashboard = () => {
    const buckets = dashboard?.buckets || {};

    return (
      <>
        <div className={styles.sectionHeader}>
          <div>
            <h3>Eight Inventory Control Buckets</h3>
            <p>Mathematical reconciliation: Total On-Hand Stock = Σ(8 Dedicated Buckets).</p>
          </div>
          <div className={styles.quickActions}>
            <button
              className={styles.primary}
              onClick={() => {
                setTransferBucketForm({ ...EMPTY_BUCKET_TRANSFER, warehouse: warehouseNames[0] });
                setModal({ type: 'transfer-bucket' });
              }}
            >
              ⇄ Transfer Bucket
            </button>
            <button
              onClick={() => {
                setReservationForm({ ...EMPTY_RESERVATION, warehouse: warehouseNames[0] });
                setModal({ type: 'reservation' });
              }}
            >
              + Reserve Stock
            </button>
            <button
              onClick={() => {
                setSamplingForm({ ...EMPTY_SAMPLING, warehouse: warehouseNames[0] });
                setModal({ type: 'sampling' });
              }}
            >
              + Issue Sample
            </button>
            <button
              onClick={() => {
                setAdjustmentForm({ ...EMPTY_ADJUSTMENT, warehouse: warehouseNames[0] });
                setModal({ type: 'adjustment' });
              }}
            >
              ± Adjust Stock
            </button>
          </div>
        </div>

        {/* 8-Bucket KPI Cards */}
        <div className={styles.bucketGrid}>
          {BUCKET_DEFINITIONS.map((def) => {
            const qty = buckets[def.key] ?? 0;
            return (
              <div key={def.key} className={`${styles.bucketCard} ${styles[`bucket_${def.css}`]}`}>
                <div className={styles.bucketHeader}>
                  <span className={styles.bucketName}>{def.label}</span>
                  <span className={styles.bucketIcon}>{def.icon}</span>
                </div>
                <div className={styles.bucketQty}>{number(qty)}</div>
                <div className={styles.bucketDesc}>{def.desc}</div>
              </div>
            );
          })}
        </div>

        {/* Operational Health & Alert Badges */}
        <div className={styles.stats} style={{ marginTop: '0.8rem' }}>
          <div className={styles.stat}>
            <span>🏢</span>
            <div>
              <strong>{dashboard?.warehousesCount || warehouses.length}</strong>
              <small>Active Warehouses</small>
            </div>
          </div>
          <div className={styles.stat}>
            <span>🏷️</span>
            <div>
              <strong>{dashboard?.activeBatchesCount || batches.length}</strong>
              <small>Active Batches / Lots</small>
            </div>
          </div>
          <div className={styles.stat}>
            <span style={{ background: '#fef2f2' }}>⚠️</span>
            <div>
              <strong className={dashboard?.lowStockCount > 0 ? styles.low : styles.good}>
                {dashboard?.lowStockCount || 0}
              </strong>
              <small>Low Stock Alerts</small>
            </div>
          </div>
          <div className={styles.stat}>
            <span style={{ background: '#fffbeb' }}>⏳</span>
            <div>
              <strong>{dashboard?.nearExpiryBatchesCount || 0}</strong>
              <small>Near-Expiry Batches (&lt;30d)</small>
            </div>
          </div>
          <div className={styles.stat}>
            <span>🛡️</span>
            <div>
              <strong>{dashboard?.pendingAdjustments || 0}</strong>
              <small>Pending SoD Adjustments</small>
            </div>
          </div>
          <div className={styles.stat}>
            <span>📋</span>
            <div>
              <strong>{dashboard?.pendingVerifications || 0}</strong>
              <small>Pending Physical Audits</small>
            </div>
          </div>
          <div className={styles.stat}>
            <span>🧪</span>
            <div>
              <strong>{dashboard?.openSamplings || 0}</strong>
              <small>Open Customer Samples</small>
            </div>
          </div>
          <div className={styles.stat}>
            <span>🧮</span>
            <div>
              <strong>{number(buckets.totalOnHand)}</strong>
              <small>Total On-Hand Units</small>
            </div>
          </div>
        </div>

        {/* Recent Movements Activity */}
        <div className={styles.sectionHeader} style={{ marginTop: '1rem' }}>
          <div>
            <h3>Recent Warehouse Stock Movements</h3>
            <p>Chronological audit log showing bucket-to-bucket transitions and reference documents.</p>
          </div>
          <button onClick={() => setActiveTab('movements')}>View Full Ledger →</button>
        </div>

        {dashboard?.recentMovements?.length ? (
          renderMovementsTable(dashboard.recentMovements)
        ) : (
          <EmptyState
            icon="📒"
            title="No Movement Activity"
            description="Movements are automatically logged when stock is received, transferred between buckets, or adjusted."
          />
        )}
      </>
    );
  };

  // 2. Stock Overview Tab
  const renderStock = () => {
    const filtered = stocks.filter((s) => {
      const matchWarehouse = !stockWarehouseFilter || s.warehouse === stockWarehouseFilter;
      const matchSearch = !stockSearch ||
        s.sku.toLowerCase().includes(stockSearch.toLowerCase()) ||
        s.name.toLowerCase().includes(stockSearch.toLowerCase());
      return matchWarehouse && matchSearch;
    });

    return (
      <>
        <div className={styles.sectionHeader}>
          <div>
            <h3>Stock Master &amp; Bucket Allocation</h3>
            <p>Inspect exact quantities in each of the 8 buckets for every SKU and warehouse location.</p>
          </div>
          <div className={styles.quickActions}>
            <button
              className={styles.primary}
              onClick={() => {
                setStockForm({ ...EMPTY_STOCK, warehouse: warehouseNames[0] });
                setModal({ type: 'stock' });
              }}
            >
              + Add Stock Item
            </button>
            <button
              onClick={() => {
                setTransferBucketForm({ ...EMPTY_BUCKET_TRANSFER, warehouse: warehouseNames[0] });
                setModal({ type: 'transfer-bucket' });
              }}
            >
              ⇄ Transfer Between Buckets
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className={styles.filterBar}>
          <input
            className={styles.filterInput}
            style={{ width: '220px' }}
            placeholder="Search SKU or Name…"
            value={stockSearch}
            onChange={(e) => setStockSearch(e.target.value)}
          />
          <select
            className={styles.filterSelect}
            value={stockWarehouseFilter}
            onChange={(e) => setStockWarehouseFilter(e.target.value)}
          >
            <option value="">All Warehouses</option>
            {warehouseNames.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          {(stockSearch || stockWarehouseFilter) && (
            <button
              className={styles.filterReset}
              onClick={() => { setStockSearch(''); setStockWarehouseFilter(''); }}
            >
              Reset
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.74rem', color: '#64748b' }}>
            Showing {filtered.length} of {stocks.length} records
          </span>
        </div>

        {filtered.length ? (
          <TableShell>
            <table>
              <thead>
                <tr>
                  <th>SKU &amp; Product</th>
                  <th>Warehouse / Bin</th>
                  <th>Total On-Hand</th>
                  <th>Available (Pickable)</th>
                  <th>Reserved</th>
                  <th>WIP</th>
                  <th>Quality Hold</th>
                  <th>Rejected</th>
                  <th>Sampling</th>
                  <th>Return Hold</th>
                  <th>Scrap</th>
                  <th>Avg Cost</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.sku}</strong>
                      <small>{item.name} ({item.uom})</small>
                      {item.stock <= item.reorderLevel && (
                        <span className={`${styles.badge} ${styles.danger}`} style={{ marginTop: '3px' }}>
                          Reorder Alert (≤{item.reorderLevel})
                        </span>
                      )}
                    </td>
                    <td>
                      <strong>{item.warehouse}</strong>
                      <small>{item.bin?.code || item.binLocation || 'No bin assigned'}</small>
                    </td>
                    <td>
                      <strong>{number(item.stock)}</strong>
                    </td>
                    <td className={item.availableQty > 0 ? styles.good : styles.low}>
                      <strong>{number(item.availableQty)}</strong>
                    </td>
                    <td>{number(item.reservedStock)}</td>
                    <td>{number(item.wipQty)}</td>
                    <td>{number(item.qualityHoldQty)}</td>
                    <td>{number(item.rejectedQty)}</td>
                    <td>{number(item.samplingQty)}</td>
                    <td>{number(item.returnHoldQty)}</td>
                    <td>{number(item.scrapQty)}</td>
                    <td>₹{number(item.averageCost)}</td>
                    <td className={styles.actions}>
                      <button
                        onClick={() => {
                          setTransferBucketForm({
                            ...EMPTY_BUCKET_TRANSFER,
                            sku: item.sku,
                            warehouse: item.warehouse,
                          });
                          setModal({ type: 'transfer-bucket', row: item });
                        }}
                      >
                        ⇄ Transfer
                      </button>
                      <button
                        onClick={() => {
                          setLocationBinId(item.binId || '');
                          setModal({ type: 'location', row: item });
                        }}
                      >
                        Bin
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        ) : (
          <EmptyState
            icon="📦"
            title="No Stock Items Found"
            description="Create stock master items or transfer accepted goods from Phase 3 Purchase GRN."
            actionLabel="Add Stock Item"
            onAction={() => {
              setStockForm({ ...EMPTY_STOCK, warehouse: warehouseNames[0] });
              setModal({ type: 'stock' });
            }}
          />
        )}
      </>
    );
  };

  // 3. Warehouse Management Tab
  const renderWarehouses = () => (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Warehouses, Racks and Bins</h3>
          <p>Organize storage facilities, bays, racks, aisles, and discrete bins for inventory tracking.</p>
        </div>
        <button
          className={styles.primary}
          onClick={() => {
            setWarehouseForm(EMPTY_WAREHOUSE);
            setModal({ type: 'warehouse' });
          }}
        >
          + Add Warehouse
        </button>
      </div>

      {warehouses.length ? (
        <div className={styles.warehouseGrid}>
          {warehouses.map((wh) => (
            <article key={wh.id}>
              <div>
                <span style={{ fontSize: '1.4rem' }}>🏢</span>
                <Status value={wh.status} />
              </div>
              <h3>{wh.name}</h3>
              <strong>Code: {wh.code}</strong>
              <p>{wh.address || 'No physical address specified'}</p>
              <small>
                {wh.contactName || 'No manager assigned'}
                {wh.contactPhone ? ` • 📞 ${wh.contactPhone}` : ''}
              </small>
              {wh.isDefault && <em>Default Receiving Warehouse</em>}

              <div className={styles.binList}>
                {wh.bins?.length ? (
                  wh.bins.map((bin) => (
                    <span key={bin.id}>
                      {bin.code}
                      {bin.rack ? ` • R-${bin.rack}` : ''}
                      {bin.aisle ? ` • A-${bin.aisle}` : ''}
                    </span>
                  ))
                ) : (
                  <small>No bins configured</small>
                )}
              </div>

              <button
                className={styles.addBin}
                onClick={() => {
                  setBinForm(EMPTY_BIN);
                  setModal({ type: 'bin', row: wh });
                }}
              >
                + Add Bin / Rack
              </button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="🏢"
          title="No Warehouses Configured"
          description="Create your first warehouse location (e.g. Unit 2 Packaging Warehouse or Main Godown)."
          actionLabel="Add Warehouse"
          onAction={() => {
            setWarehouseForm(EMPTY_WAREHOUSE);
            setModal({ type: 'warehouse' });
          }}
        />
      )}
    </>
  );

  // 4. Batch / Lot Management & FIFO Tab
  const renderBatches = () => {
    const filtered = batches.filter((b) => {
      const matchWh = !batchWarehouseFilter || b.warehouse === batchWarehouseFilter;
      const matchQc = !batchQcFilter || b.qualityStatus === batchQcFilter;
      return matchWh && matchQc;
    });

    return (
      <>
        <div className={styles.sectionHeader}>
          <div>
            <h3>Batch / Lot Tracking &amp; FIFO Allocation Engine</h3>
            <p>Track manufacture dates, expiry schedules, QC acceptance, and run FIFO allocations from Available stock.</p>
          </div>
          <div className={styles.quickActions}>
            <button
              className={styles.primary}
              onClick={() => {
                setFifoForm({ ...EMPTY_FIFO_QUERY, warehouse: warehouseNames[0] });
                setFifoResult(null);
                setModal({ type: 'fifo-tool' });
              }}
            >
              ⚡ Run FIFO Allocation
            </button>
            <button
              onClick={() => {
                setBatchForm({ ...EMPTY_BATCH, warehouse: warehouseNames[0] });
                setModal({ type: 'batch' });
              }}
            >
              + Create Batch
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className={styles.filterBar}>
          <select
            className={styles.filterSelect}
            value={batchWarehouseFilter}
            onChange={(e) => setBatchWarehouseFilter(e.target.value)}
          >
            <option value="">All Warehouses</option>
            {warehouseNames.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <select
            className={styles.filterSelect}
            value={batchQcFilter}
            onChange={(e) => setBatchQcFilter(e.target.value)}
          >
            <option value="">All QC Statuses</option>
            <option value="ACCEPTED">ACCEPTED</option>
            <option value="HOLD">HOLD</option>
            <option value="REJECTED">REJECTED</option>
          </select>
          {(batchWarehouseFilter || batchQcFilter) && (
            <button
              className={styles.filterReset}
              onClick={() => { setBatchWarehouseFilter(''); setBatchQcFilter(''); }}
            >
              Reset
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.74rem', color: '#64748b' }}>
            {filtered.length} active batches
          </span>
        </div>

        {filtered.length ? (
          <TableShell>
            <table>
              <thead>
                <tr>
                  <th>Batch / Lot No</th>
                  <th>SKU / Product</th>
                  <th>Warehouse</th>
                  <th>Initial Qty</th>
                  <th>Available Qty</th>
                  <th>Reserved Qty</th>
                  <th>QC Status</th>
                  <th>Received Date</th>
                  <th>Expiry Date</th>
                  <th>Unit Cost</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const isExpired = b.expiryDate && new Date(b.expiryDate) <= new Date();
                  const isExpiringSoon = b.expiryDate && !isExpired && (new Date(b.expiryDate) - new Date()) / 86400000 <= 30;

                  return (
                    <tr key={b.id}>
                      <td>
                        <strong>{b.batchNo}</strong>
                        {b.grnNo && <small>GRN: {b.grnNo}</small>}
                      </td>
                      <td>
                        <strong>{b.sku}</strong>
                        {b.vendorName && <small>Vendor: {b.vendorName}</small>}
                      </td>
                      <td>{b.warehouse}</td>
                      <td>{number(b.initialQty)}</td>
                      <td className={b.availableQty > 0 ? styles.good : styles.low}>
                        <strong>{number(b.availableQty)}</strong>
                      </td>
                      <td>{number(b.reservedQty)}</td>
                      <td>
                        <Status value={b.qualityStatus} />
                      </td>
                      <td>{dateOnly(b.receivedDate)}</td>
                      <td>
                        {b.expiryDate ? (
                          <>
                            {dateOnly(b.expiryDate)}
                            {isExpired ? (
                              <span className={`${styles.badge} ${styles.danger}`} style={{ display: 'block', marginTop: '2px' }}>
                                EXPIRED
                              </span>
                            ) : isExpiringSoon ? (
                              <span className={`${styles.badge} ${styles.warning}`} style={{ display: 'block', marginTop: '2px' }}>
                                &lt;30d EXPIRY
                              </span>
                            ) : null}
                          </>
                        ) : '—'}
                      </td>
                      <td>₹{number(b.unitCost)}</td>
                      <td><Status value={b.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableShell>
        ) : (
          <EmptyState
            icon="🏷️"
            title="No Inventory Batches"
            description="Batches are automatically generated during Phase 3 GRN acceptance, or can be created manually."
            actionLabel="Create Batch"
            onAction={() => {
              setBatchForm({ ...EMPTY_BATCH, warehouse: warehouseNames[0] });
              setModal({ type: 'batch' });
            }}
          />
        )}
      </>
    );
  };

  // 5. Stock Reservations Tab
  const renderReservations = () => {
    const filtered = reservations.filter((r) => {
      return !reservationStatusFilter || r.status === reservationStatusFilter;
    });

    return (
      <>
        <div className={styles.sectionHeader}>
          <div>
            <h3>Stock Reservations Engine</h3>
            <p>Guaranteed order fulfillment: Stock reservations isolate units from Available to Reserved bucket.</p>
          </div>
          <button
            className={styles.primary}
            onClick={() => {
              setReservationForm({ ...EMPTY_RESERVATION, warehouse: warehouseNames[0] });
              setModal({ type: 'reservation' });
            }}
          >
            + New Reservation
          </button>
        </div>

        {/* Filter Bar */}
        <div className={styles.filterBar}>
          <select
            className={styles.filterSelect}
            value={reservationStatusFilter}
            onChange={(e) => setReservationStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="RELEASED">RELEASED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          {reservationStatusFilter && (
            <button className={styles.filterReset} onClick={() => setReservationStatusFilter('')}>Reset</button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.74rem', color: '#64748b' }}>
            {filtered.length} reservations
          </span>
        </div>

        {filtered.length ? (
          <TableShell>
            <table>
              <thead>
                <tr>
                  <th>Reservation No</th>
                  <th>SKU &amp; Warehouse</th>
                  <th>Batch / Lot</th>
                  <th>Quantity</th>
                  <th>Purpose / Reference</th>
                  <th>Reserved By</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((res) => (
                  <tr key={res.id}>
                    <td>
                      <strong>{res.reservationNo}</strong>
                    </td>
                    <td>
                      <strong>{res.sku}</strong>
                      <small>{res.warehouse}</small>
                    </td>
                    <td>{res.batchNo || 'Any Eligible Batch'}</td>
                    <td>
                      <strong style={{ color: '#c2410c' }}>{number(res.quantity)}</strong>
                    </td>
                    <td>
                      <strong>{res.referenceType}</strong>
                      <small>{res.referenceNo || res.notes || '—'}</small>
                    </td>
                    <td>{res.reservedBy}</td>
                    <td>{dateTime(res.createdAt)}</td>
                    <td><Status value={res.status} /></td>
                    <td className={styles.actions}>
                      {res.status === 'ACTIVE' && (
                        <>
                          <button
                            className={styles.successButton}
                            onClick={() => releaseReservation(res)}
                            disabled={saving}
                          >
                            Release
                          </button>
                          <button
                            className={styles.dangerButton}
                            onClick={() => cancelReservation(res)}
                            disabled={saving}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        ) : (
          <EmptyState
            icon="🔒"
            title="No Active Stock Reservations"
            description="Reserve available inventory for confirmed sales orders to prevent duplicate order commitment."
            actionLabel="New Reservation"
            onAction={() => {
              setReservationForm({ ...EMPTY_RESERVATION, warehouse: warehouseNames[0] });
              setModal({ type: 'reservation' });
            }}
          />
        )}
      </>
    );
  };

  // 6. Customer Sampling Management Tab
  const renderSampling = () => {
    const filtered = samplings.filter((s) => {
      return !samplingStatusFilter || s.status === samplingStatusFilter;
    });

    return (
      <>
        <div className={styles.sectionHeader}>
          <div>
            <h3>Customer Sampling Management</h3>
            <p>Track marketing &amp; sales samples in the Sampling bucket with fee waiver approvals and returns.</p>
          </div>
          <button
            className={styles.primary}
            onClick={() => {
              setSamplingForm({ ...EMPTY_SAMPLING, warehouse: warehouseNames[0] });
              setModal({ type: 'sampling' });
            }}
          >
            + Issue Sample Request
          </button>
        </div>

        {/* Filter Bar */}
        <div className={styles.filterBar}>
          <select
            className={styles.filterSelect}
            value={samplingStatusFilter}
            onChange={(e) => setSamplingStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="PENDING_APPROVAL">PENDING APPROVAL</option>
            <option value="ISSUED">ISSUED</option>
            <option value="PARTIALLY_RETURNED">PARTIALLY RETURNED</option>
            <option value="RETURNED">RETURNED</option>
          </select>
          {samplingStatusFilter && (
            <button className={styles.filterReset} onClick={() => setSamplingStatusFilter('')}>Reset</button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.74rem', color: '#64748b' }}>
            {filtered.length} samples
          </span>
        </div>

        {filtered.length ? (
          <TableShell>
            <table>
              <thead>
                <tr>
                  <th>Sampling No</th>
                  <th>Customer / Prospect</th>
                  <th>SKU &amp; Product</th>
                  <th>Sample Qty</th>
                  <th>Billing Type</th>
                  <th>Waiver Approval</th>
                  <th>Responsible Person</th>
                  <th>Expected Return</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.samplingNo}</strong>
                      <small>{dateTime(s.createdAt)}</small>
                    </td>
                    <td>
                      <strong>{s.customerName}</strong>
                      {s.referenceNo && <small>Ref: {s.referenceNo}</small>}
                    </td>
                    <td>
                      <strong>{s.sku}</strong>
                      <small>{s.name} ({s.warehouse})</small>
                    </td>
                    <td>
                      <strong style={{ color: '#0f766e' }}>{number(s.quantity)}</strong>
                      {s.returnedQty > 0 && <small>Returned: {s.returnedQty}</small>}
                    </td>
                    <td><Status value={s.billingType} /></td>
                    <td>
                      {s.billingType === 'PAYMENT_WAIVED' ? (
                        s.isWaivedApproved ? (
                          <span className={`${styles.badge} ${styles.success}`}>APPROVED</span>
                        ) : (
                          <span className={`${styles.badge} ${styles.warning}`}>PENDING WAIVER</span>
                        )
                      ) : (
                        <span className={`${styles.badge} ${styles.neutral}`}>N/A</span>
                      )}
                    </td>
                    <td>{s.responsiblePerson}</td>
                    <td>{dateOnly(s.expectedReturnDate)}</td>
                    <td><Status value={s.status} /></td>
                    <td className={styles.actions}>
                      {s.status === 'PENDING_APPROVAL' && !s.isWaivedApproved && (
                        <button
                          className={styles.successButton}
                          onClick={() => approveWaivedSampling(s)}
                          disabled={saving}
                        >
                          Approve Waiver
                        </button>
                      )}
                      {['ISSUED', 'PARTIALLY_RETURNED'].includes(s.status) && (
                        <button
                          onClick={() => {
                            setSamplingReturnForm({
                              returnedQty: String(s.quantity - s.returnedQty),
                              destinationBucket: 'AVAILABLE',
                              inspectionStatus: 'PASSED_QC',
                              notes: '',
                            });
                            setModal({ type: 'sampling-return', row: s });
                          }}
                        >
                          ↩ Return
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        ) : (
          <EmptyState
            icon="🧪"
            title="No Sampling Records"
            description="Register customer sample dispatches to maintain traceability and isolate stock from general available inventory."
            actionLabel="Issue Sample Request"
            onAction={() => {
              setSamplingForm({ ...EMPTY_SAMPLING, warehouse: warehouseNames[0] });
              setModal({ type: 'sampling' });
            }}
          />
        )}
      </>
    );
  };

  // 7. Gate Pass Register Tab
  const renderGatePass = () => {
    const filtered = gatePasses.filter((gp) => {
      const matchType = !gatePassTypeFilter || gp.gatePassType === gatePassTypeFilter;
      const matchStatus = !gatePassStatusFilter || gp.status === gatePassStatusFilter;
      return matchType && matchStatus;
    });

    return (
      <>
        <div className={styles.sectionHeader}>
          <div>
            <h3>Security Gate Pass Register</h3>
            <p>Track returnable and non-returnable materials leaving warehouse premises with delivery &amp; return verification.</p>
          </div>
          <button
            className={styles.primary}
            onClick={() => {
              setGatePassForm({ ...EMPTY_GATE_PASS, fromWarehouse: warehouseNames[0] });
              setModal({ type: 'gatepass' });
            }}
          >
            + Create Gate Pass
          </button>
        </div>

        {/* Filter Bar */}
        <div className={styles.filterBar}>
          <select
            className={styles.filterSelect}
            value={gatePassTypeFilter}
            onChange={(e) => setGatePassTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="RETURNABLE">RETURNABLE</option>
            <option value="NON_RETURNABLE">NON_RETURNABLE</option>
            <option value="SAMPLE">SAMPLE</option>
            <option value="JOB_WORK">JOB_WORK</option>
          </select>
          <select
            className={styles.filterSelect}
            value={gatePassStatusFilter}
            onChange={(e) => setGatePassStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="APPROVED">APPROVED</option>
            <option value="DISPATCHED">DISPATCHED</option>
            <option value="PARTIALLY_RETURNED">PARTIALLY RETURNED</option>
            <option value="RETURNED">RETURNED</option>
          </select>
          {(gatePassTypeFilter || gatePassStatusFilter) && (
            <button className={styles.filterReset} onClick={() => { setGatePassTypeFilter(''); setGatePassStatusFilter(''); }}>Reset</button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.74rem', color: '#64748b' }}>
            {filtered.length} passes
          </span>
        </div>

        {filtered.length ? (
          <TableShell>
            <table>
              <thead>
                <tr>
                  <th>Gate Pass No</th>
                  <th>Type</th>
                  <th>Destination Party</th>
                  <th>Purpose</th>
                  <th>From Warehouse</th>
                  <th>Items Summary</th>
                  <th>Issued By</th>
                  <th>Expected Return</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((gp) => (
                  <tr key={gp.id}>
                    <td>
                      <strong>{gp.gatePassNo}</strong>
                      <small>{dateTime(gp.createdAt)}</small>
                    </td>
                    <td><Status value={gp.gatePassType} /></td>
                    <td>
                      <strong>{gp.destination}</strong>
                    </td>
                    <td>{gp.purpose}</td>
                    <td>{gp.fromWarehouse}</td>
                    <td>
                      {Array.isArray(gp.items)
                        ? gp.items.map((it) => `${it.sku || it.name} (${it.qty || it.quantity} ${it.uom || 'PCS'})`).join(', ')
                        : '—'}
                    </td>
                    <td>{gp.issuedBy}</td>
                    <td>{dateOnly(gp.expectedReturnDate)}</td>
                    <td><Status value={gp.status} /></td>
                    <td className={styles.actions}>
                      {gp.status === 'APPROVED' && (
                        <button
                          className={styles.primary}
                          onClick={() => dispatchGatePass(gp)}
                          disabled={saving}
                        >
                          Dispatch
                        </button>
                      )}
                      {['DISPATCHED', 'PARTIALLY_RETURNED'].includes(gp.status) && gp.gatePassType !== 'NON_RETURNABLE' && (
                        <button
                          onClick={() => {
                            setGatePassReturnForm({ isPartial: false, notes: '' });
                            setModal({ type: 'gatepass-return', row: gp });
                          }}
                        >
                          ↩ Return
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        ) : (
          <EmptyState
            icon="🛡️"
            title="No Gate Passes Registered"
            description="Issue security gate passes for goods leaving warehouse premises for exhibition, repair, job-work, or sample inspection."
            actionLabel="Create Gate Pass"
            onAction={() => {
              setGatePassForm({ ...EMPTY_GATE_PASS, fromWarehouse: warehouseNames[0] });
              setModal({ type: 'gatepass' });
            }}
          />
        )}
      </>
    );
  };

  // 8. Physical Stock Verification Tab
  const renderVerifications = () => {
    const filtered = verifications.filter((v) => {
      return !verificationStatusFilter || v.status === verificationStatusFilter;
    });

    return (
      <>
        <div className={styles.sectionHeader}>
          <div>
            <h3>Fortnightly Physical Stock Verification</h3>
            <p>Periodic physical counts with automated system variance calculation and maker-checker sign-off.</p>
          </div>
          <button
            className={styles.primary}
            onClick={() => {
              setVerificationForm({
                ...EMPTY_VERIFICATION,
                warehouse: warehouseNames[0],
                verifierName: currentUser?.name || currentUser?.email || 'Auditor',
              });
              setModal({ type: 'verification' });
            }}
          >
            + New Audit Session
          </button>
        </div>

        {/* Filter Bar */}
        <div className={styles.filterBar}>
          <select
            className={styles.filterSelect}
            value={verificationStatusFilter}
            onChange={(e) => setVerificationStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="IN_PROGRESS">IN PROGRESS</option>
            <option value="PENDING_APPROVAL">PENDING APPROVAL</option>
            <option value="APPROVED">APPROVED</option>
          </select>
          {verificationStatusFilter && (
            <button className={styles.filterReset} onClick={() => setVerificationStatusFilter('')}>Reset</button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.74rem', color: '#64748b' }}>
            {filtered.length} audit sessions
          </span>
        </div>

        {filtered.length ? (
          <TableShell>
            <table>
              <thead>
                <tr>
                  <th>Session No</th>
                  <th>Warehouse</th>
                  <th>Frequency</th>
                  <th>Scheduled Date</th>
                  <th>Verifier</th>
                  <th>Variance Summary</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const isVerifier = s.verifierName && (currentUser?.name === s.verifierName || currentUser?.email === s.verifierName);

                  return (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.sessionNo}</strong>
                        {s.verifiedDate && <small>Verified: {dateOnly(s.verifiedDate)}</small>}
                      </td>
                      <td>{s.warehouse}</td>
                      <td>{s.scheduleFrequency}</td>
                      <td>{dateOnly(s.scheduledDate)}</td>
                      <td>{s.verifierName || '—'}</td>
                      <td>
                        {s.status !== 'IN_PROGRESS' ? (
                          <span>
                            Shortage: <strong className={styles.low}>-{number(s.totalVarianceShortage)}</strong> | Excess: <strong className={styles.good}>+{number(s.totalVarianceExcess)}</strong>
                          </span>
                        ) : (
                          <small>Counts in progress ({s.items?.length || 0} items)</small>
                        )}
                      </td>
                      <td><Status value={s.status} /></td>
                      <td className={styles.actions}>
                        {s.status === 'IN_PROGRESS' && (
                          <button
                            className={styles.primary}
                            onClick={() => openCountWorkspace(s)}
                          >
                            Enter Counts
                          </button>
                        )}
                        {s.status === 'PENDING_APPROVAL' && (
                          <>
                            <button
                              onClick={() => openCountWorkspace(s)}
                            >
                              Review
                            </button>
                            <button
                              className={styles.successButton}
                              disabled={isVerifier || saving}
                              title={isVerifier ? 'Maker-Checker rule: Verifier cannot approve their own verification session' : 'Approve verification'}
                              onClick={() => approveVerificationSession(s)}
                            >
                              {isVerifier ? 'SoD Locked' : 'Approve'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableShell>
        ) : (
          <EmptyState
            icon="📋"
            title="No Verification Sessions"
            description="Initialize a fortnightly physical inventory audit. The system auto-captures on-hand balances for variance comparison."
            actionLabel="Start Audit Session"
            onAction={() => {
              setVerificationForm({
                ...EMPTY_VERIFICATION,
                warehouse: warehouseNames[0],
                verifierName: currentUser?.name || currentUser?.email || 'Auditor',
              });
              setModal({ type: 'verification' });
            }}
          />
        )}
      </>
    );
  };

  // 9. Stock Adjustment Tab
  const renderAdjustments = () => {
    const filtered = adjustments.filter((adj) => {
      return !adjustmentStatusFilter || adj.status === adjustmentStatusFilter;
    });

    return (
      <>
        <div className={styles.sectionHeader}>
          <div>
            <h3>Stock Adjustments (Maker-Checker Control)</h3>
            <p>Strict Segregation of Duties: Creators cannot approve their own inventory adjustments.</p>
          </div>
          <button
            className={styles.primary}
            onClick={() => {
              setAdjustmentForm({ ...EMPTY_ADJUSTMENT, warehouse: warehouseNames[0] });
              setModal({ type: 'adjustment' });
            }}
          >
            + Create Stock Adjustment
          </button>
        </div>

        {/* Filter Bar */}
        <div className={styles.filterBar}>
          <select
            className={styles.filterSelect}
            value={adjustmentStatusFilter}
            onChange={(e) => setAdjustmentStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="PENDING_APPROVAL">PENDING APPROVAL</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
          {adjustmentStatusFilter && (
            <button className={styles.filterReset} onClick={() => setAdjustmentStatusFilter('')}>Reset</button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.74rem', color: '#64748b' }}>
            {filtered.length} adjustments
          </span>
        </div>

        {filtered.length ? (
          <TableShell>
            <table>
              <thead>
                <tr>
                  <th>Adjustment No</th>
                  <th>SKU &amp; Product</th>
                  <th>Warehouse / Bucket</th>
                  <th>Type</th>
                  <th>Qty Change</th>
                  <th>Before / After</th>
                  <th>Reason</th>
                  <th>Maker / Creator</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((adj) => {
                  const isCreator = adj.creatorId === currentUser?.id ||
                    adj.creatorName === (currentUser?.name || currentUser?.email);

                  return (
                    <tr key={adj.id}>
                      <td>
                        <strong>{adj.adjustmentNo}</strong>
                        <small>{dateTime(adj.createdAt)}</small>
                      </td>
                      <td>
                        <strong>{adj.sku}</strong>
                        <small>{adj.name}</small>
                      </td>
                      <td>
                        <strong>{adj.warehouse}</strong>
                        <small>{adj.bucket}</small>
                      </td>
                      <td>
                        <Status value={adj.adjustmentType} />
                        {adj.thresholdExceeded && (
                          <span className={`${styles.badge} ${styles.danger}`} style={{ display: 'block', marginTop: '2px' }}>
                            HIGH VALUE
                          </span>
                        )}
                      </td>
                      <td>
                        <strong className={adj.adjustmentQty > 0 ? styles.good : styles.low}>
                          {adj.adjustmentQty > 0 ? `+${adj.adjustmentQty}` : adj.adjustmentQty}
                        </strong>
                      </td>
                      <td>{adj.beforeQty} → {adj.afterQty}</td>
                      <td>
                        {adj.reason}
                        {adj.notes && <small>{adj.notes}</small>}
                      </td>
                      <td>{adj.creatorName}</td>
                      <td><Status value={adj.status} /></td>
                      <td className={styles.actions}>
                        {adj.status === 'PENDING_APPROVAL' && (
                          <>
                            <button
                              className={styles.successButton}
                              disabled={isCreator || saving}
                              title={isCreator ? 'Segregation of Duties: You cannot approve your own adjustment' : 'Approve adjustment'}
                              onClick={() => approveAdjustment(adj)}
                            >
                              {isCreator ? 'SoD Locked' : 'Approve'}
                            </button>
                            <button
                              className={styles.dangerButton}
                              disabled={saving}
                              onClick={() => rejectAdjustment(adj)}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableShell>
        ) : (
          <EmptyState
            icon="±"
            title="No Adjustments Recorded"
            description="Post physical discrepancies, transit damages, or count corrections through maker-checker authorization."
            actionLabel="Create Stock Adjustment"
            onAction={() => {
              setAdjustmentForm({ ...EMPTY_ADJUSTMENT, warehouse: warehouseNames[0] });
              setModal({ type: 'adjustment' });
            }}
          />
        )}
      </>
    );
  };

  // 10. Movement Ledger Tab
  const renderMovements = () => {
    const filtered = movements.filter((m) => {
      const matchBucket = !movementBucketFilter ||
        m.destinationBucket === movementBucketFilter ||
        m.sourceBucket === movementBucketFilter;
      const matchType = !movementTypeFilter || m.movementType === movementTypeFilter;
      const matchSearch = !movementSearch ||
        m.sku.toLowerCase().includes(movementSearch.toLowerCase()) ||
        m.movementNo.toLowerCase().includes(movementSearch.toLowerCase()) ||
        (m.referenceNo && m.referenceNo.toLowerCase().includes(movementSearch.toLowerCase()));

      return matchBucket && matchType && matchSearch;
    });

    return (
      <>
        <div className={styles.sectionHeader}>
          <div>
            <h3>Centralized Stock Movement Ledger</h3>
            <p>Immutable audit trail of all inward, outward, bucket-to-bucket transfers, reservations, and audit reconciliation.</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className={styles.filterBar}>
          <input
            className={styles.filterInput}
            style={{ width: '200px' }}
            placeholder="Search SKU, Mov No, Ref…"
            value={movementSearch}
            onChange={(e) => setMovementSearch(e.target.value)}
          />
          <select
            className={styles.filterSelect}
            value={movementBucketFilter}
            onChange={(e) => setMovementBucketFilter(e.target.value)}
          >
            <option value="">All Buckets</option>
            {BUCKET_DEFINITIONS.map((b) => (
              <option key={b.css} value={b.css}>{b.label}</option>
            ))}
          </select>
          <select
            className={styles.filterSelect}
            value={movementTypeFilter}
            onChange={(e) => setMovementTypeFilter(e.target.value)}
          >
            <option value="">All Movement Types</option>
            <option value="INWARD">INWARD</option>
            <option value="OUTWARD">OUTWARD</option>
            <option value="BUCKET_TRANSFER">BUCKET_TRANSFER</option>
            <option value="STOCK_RESERVATION">STOCK_RESERVATION</option>
            <option value="STOCK_RELEASE">STOCK_RELEASE</option>
            <option value="SAMPLING_ISSUE">SAMPLING_ISSUE</option>
            <option value="SAMPLING_RETURN">SAMPLING_RETURN</option>
            <option value="AUDIT_RECONCILIATION">AUDIT_RECONCILIATION</option>
            <option value="ADJUSTMENT">ADJUSTMENT</option>
          </select>
          {(movementSearch || movementBucketFilter || movementTypeFilter) && (
            <button
              className={styles.filterReset}
              onClick={() => { setMovementSearch(''); setMovementBucketFilter(''); setMovementTypeFilter(''); }}
            >
              Reset
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.74rem', color: '#64748b' }}>
            Showing {filtered.length} movements
          </span>
        </div>

        {filtered.length ? (
          renderMovementsTable(filtered)
        ) : (
          <EmptyState
            icon="📒"
            title="No Movement Records"
            description="Movements will automatically appear here as warehouse transactions occur."
          />
        )}
      </>
    );
  };

  // Helper Table for movements
  function renderMovementsTable(rows) {
    return (
      <TableShell>
        <table>
          <thead>
            <tr>
              <th>Movement No</th>
              <th>Date / Time</th>
              <th>Movement Type</th>
              <th>SKU &amp; Product</th>
              <th>Warehouse</th>
              <th>Batch / Lot</th>
              <th>Bucket Transition</th>
              <th>Quantity</th>
              <th>Balance After</th>
              <th>Reference Document</th>
              <th>Created By</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>
                  <strong>{m.movementNo}</strong>
                </td>
                <td>{dateTime(m.createdAt)}</td>
                <td><Status value={m.movementType} /></td>
                <td>
                  <strong>{m.sku}</strong>
                  <small>{m.itemName}</small>
                </td>
                <td>{m.warehouse}</td>
                <td>{m.batchNo || '—'}</td>
                <td>
                  <span style={{ fontSize: '0.74rem' }}>
                    {m.sourceBucket || 'EXTERNAL'} <b>→</b> {m.destinationBucket || 'EXTERNAL'}
                  </span>
                </td>
                <td>
                  <strong className={m.quantity < 0 ? styles.low : styles.good}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity} {m.uom}
                  </strong>
                </td>
                <td><strong>{m.balanceAfter} {m.uom}</strong></td>
                <td>
                  <strong>{m.referenceType || 'MANUAL'}</strong>
                  <small>{m.referenceNo || m.notes || '—'}</small>
                </td>
                <td>{m.createdBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    );
  }

  // Active Tab Content Selector
  const content =
    activeTab === 'dashboard' ? renderDashboard() :
    activeTab === 'stock' ? renderStock() :
    activeTab === 'warehouses' ? renderWarehouses() :
    activeTab === 'batches' ? renderBatches() :
    activeTab === 'reservations' ? renderReservations() :
    activeTab === 'sampling' ? renderSampling() :
    activeTab === 'gatepass' ? renderGatePass() :
    activeTab === 'verifications' ? renderVerifications() :
    activeTab === 'adjustments' ? renderAdjustments() :
    renderMovements();

  return (
    <div className={styles.module}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>AZZUNIQE Stock &amp; Warehouse Control</span>
          <h2>Inventory &amp; Warehouse Management</h2>
          <p>
            {activeCompany?.organizationName || 'Client Workspace'}: Real-time 8-bucket stock control,
            batch-wise FIFO allocations, sampling workflows, gate pass register, and maker-checker adjustments.
          </p>
        </div>
        <button onClick={loadAll} disabled={loading}>
          {loading ? 'Refreshing…' : '↻ Refresh Ledger'}
        </button>
      </header>

      {/* Process Flow Ribbon */}
      <div className={styles.flow}>
        <span>Phase 3 GRN Intake</span>
        <b>→</b>
        <span>Available Bucket</span>
        <b>→</b>
        <span>FIFO Allocation &amp; Reservation</span>
        <b>→</b>
        <span>Sampling &amp; Gate Pass</span>
        <b>→</b>
        <span>Physical Verification &amp; Maker-Checker Audit</span>
      </div>

      {/* 10 Navigation Tabs */}
      <nav className={styles.tabs}>
        {tabs.map(([key, label]) => (
          <button
            key={key}
            className={activeTab === key ? styles.active : ''}
            onClick={() => setActiveTab(key)}
          >
            {label}
            {key === 'adjustments' && dashboard?.pendingAdjustments > 0 && (
              <span className={styles.tabBadge}>{dashboard.pendingAdjustments}</span>
            )}
            {key === 'verifications' && dashboard?.pendingVerifications > 0 && (
              <span className={styles.tabBadge}>{dashboard.pendingVerifications}</span>
            )}
          </button>
        ))}
      </nav>

      {loadError && (
        <div className={styles.error}>
          <span>{loadError}</span>
          <button onClick={loadAll}>Retry</button>
        </div>
      )}

      {loading && !dashboard ? (
        <div className={styles.loading}>Loading inventory ledgers &amp; buckets…</div>
      ) : (
        content
      )}

      {/* ================================================================== */}
      {/* MODALS */}
      {/* ================================================================== */}

      {/* Modal 1: Add Stock Item Master */}
      <Modal
        isOpen={modal?.type === 'stock'}
        onClose={() => setModal(null)}
        title="Initialize Stock Master Item"
        maxWidth="760px"
      >
        <form className={styles.form} onSubmit={submitStock}>
          <FormField label="Select Product Master Item (leave empty for custom raw material)">
            <select
              value={stockForm.productId}
              onChange={(e) => {
                const prod = products.find((p) => p.id === e.target.value);
                if (prod) {
                  setStockForm({
                    ...stockForm,
                    productId: prod.id,
                    sku: prod.sku,
                    name: prod.name,
                    itemType: 'FINISHED_GOOD',
                    uom: prod.uom || 'PCS',
                    averageCost: String(prod.purchasePrice || 0),
                  });
                } else {
                  setStockForm({ ...stockForm, productId: '', sku: '', name: '', itemType: 'RAW_MATERIAL' });
                }
              }}
            >
              <option value="">Manual Raw Material / Packing Item</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
              ))}
            </select>
          </FormField>

          <div className={styles.formGrid}>
            <FormField label="SKU *">
              <input
                required
                disabled={Boolean(stockForm.productId)}
                value={stockForm.sku}
                onChange={(e) => setStockForm({ ...stockForm, sku: e.target.value })}
              />
            </FormField>
            <FormField label="Item Name *">
              <input
                required
                disabled={Boolean(stockForm.productId)}
                value={stockForm.name}
                onChange={(e) => setStockForm({ ...stockForm, name: e.target.value })}
              />
            </FormField>
            <FormField label="Item Type">
              <select
                disabled={Boolean(stockForm.productId)}
                value={stockForm.itemType}
                onChange={(e) => setStockForm({ ...stockForm, itemType: e.target.value })}
              >
                <option value="RAW_MATERIAL">RAW_MATERIAL</option>
                <option value="FINISHED_GOOD">FINISHED_GOOD</option>
                <option value="WORK_IN_PROGRESS">WORK_IN_PROGRESS</option>
                <option value="PACKAGING">PACKAGING</option>
              </select>
            </FormField>
            <FormField label="Warehouse *">
              <select
                value={stockForm.warehouse}
                onChange={(e) => setStockForm({ ...stockForm, warehouse: e.target.value, binId: '' })}
              >
                {warehouseNames.map((w) => <option key={w}>{w}</option>)}
              </select>
            </FormField>
            <FormField label="Bin / Rack">
              <select
                value={stockForm.binId}
                onChange={(e) => setStockForm({ ...stockForm, binId: e.target.value })}
              >
                <option value="">Assign Bin Later</option>
                {selectedWarehouseBins.map((bin) => (
                  <option key={bin.id} value={bin.id}>
                    {bin.code} {bin.rack ? `— Rack ${bin.rack}` : ''}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Opening Stock (Available Bucket)">
              <input
                type="number"
                min="0"
                required
                value={stockForm.stock}
                onChange={(e) => setStockForm({ ...stockForm, stock: e.target.value })}
              />
            </FormField>
            <FormField label="Reorder Alert Threshold">
              <input
                type="number"
                min="0"
                required
                value={stockForm.reorderLevel}
                onChange={(e) => setStockForm({ ...stockForm, reorderLevel: e.target.value })}
              />
            </FormField>
            <FormField label="Unit of Measure (UOM)">
              <input
                required
                value={stockForm.uom}
                onChange={(e) => setStockForm({ ...stockForm, uom: e.target.value })}
              />
            </FormField>
            <FormField label="Average Unit Cost (₹)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={stockForm.averageCost}
                onChange={(e) => setStockForm({ ...stockForm, averageCost: e.target.value })}
              />
            </FormField>
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>
              {saving ? 'Saving…' : 'Save Stock Master'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Transfer Between Buckets */}
      <Modal
        isOpen={modal?.type === 'transfer-bucket'}
        onClose={() => setModal(null)}
        title="Transfer Stock Between Buckets"
        maxWidth="680px"
      >
        <form className={styles.form} onSubmit={submitBucketTransfer}>
          <div className={styles.hint}>
            Moves stock between dedicated buckets (e.g. from Available to Quality Hold or Scrap) without altering total physical balance.
          </div>

          <div className={styles.formGrid}>
            <FormField label="SKU *">
              <input
                required
                placeholder="Enter SKU e.g. MASTER-BOX"
                value={transferBucketForm.sku}
                onChange={(e) => setTransferBucketForm({ ...transferBucketForm, sku: e.target.value })}
              />
            </FormField>
            <FormField label="Warehouse *">
              <select
                value={transferBucketForm.warehouse}
                onChange={(e) => setTransferBucketForm({ ...transferBucketForm, warehouse: e.target.value })}
              >
                {warehouseNames.map((w) => <option key={w}>{w}</option>)}
              </select>
            </FormField>
            <FormField label="Source Bucket *">
              <select
                value={transferBucketForm.sourceBucket}
                onChange={(e) => setTransferBucketForm({ ...transferBucketForm, sourceBucket: e.target.value })}
              >
                {BUCKET_DEFINITIONS.map((b) => (
                  <option key={b.css} value={b.css}>{b.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Destination Bucket *">
              <select
                value={transferBucketForm.destinationBucket}
                onChange={(e) => setTransferBucketForm({ ...transferBucketForm, destinationBucket: e.target.value })}
              >
                {BUCKET_DEFINITIONS.map((b) => (
                  <option key={b.css} value={b.css}>{b.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Quantity *">
              <input
                type="number"
                min="1"
                required
                placeholder="Units to transfer"
                value={transferBucketForm.quantity}
                onChange={(e) => setTransferBucketForm({ ...transferBucketForm, quantity: e.target.value })}
              />
            </FormField>
            <FormField label="Batch / Lot No (Optional)">
              <input
                placeholder="Optional Batch"
                value={transferBucketForm.batchNo}
                onChange={(e) => setTransferBucketForm({ ...transferBucketForm, batchNo: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label="Reason for Transfer *">
            <textarea
              required
              rows="2"
              placeholder="Detailed justification (e.g. In-process inspection, damaged during handling, etc.)"
              value={transferBucketForm.reason}
              onChange={(e) => setTransferBucketForm({ ...transferBucketForm, reason: e.target.value })}
            />
          </FormField>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>
              {saving ? 'Processing…' : 'Execute Bucket Transfer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 3: Add Warehouse */}
      <Modal
        isOpen={modal?.type === 'warehouse'}
        onClose={() => setModal(null)}
        title="Register Warehouse / Storage Godown"
        maxWidth="680px"
      >
        <form className={styles.form} onSubmit={submitWarehouse}>
          <div className={styles.formGrid}>
            <FormField label="Warehouse Code *">
              <input
                required
                placeholder="e.g. WH-MAIN or GODOWN-02"
                value={warehouseForm.code}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value })}
              />
            </FormField>
            <FormField label="Warehouse Name *">
              <input
                required
                placeholder="e.g. Unit 2 Packaging Warehouse"
                value={warehouseForm.name}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
              />
            </FormField>
            <FormField label="Contact Person">
              <input
                placeholder="Warehouse Manager"
                value={warehouseForm.contactName}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, contactName: e.target.value })}
              />
            </FormField>
            <FormField label="Contact Phone">
              <input
                placeholder="Phone number"
                value={warehouseForm.contactPhone}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, contactPhone: e.target.value })}
              />
            </FormField>
          </div>
          <FormField label="Address">
            <textarea
              rows="2"
              placeholder="Physical street address or premises"
              value={warehouseForm.address}
              onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })}
            />
          </FormField>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={warehouseForm.isDefault}
              onChange={(e) => setWarehouseForm({ ...warehouseForm, isDefault: e.target.checked })}
            />
            Make this the default receiving location
          </label>
          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>Create Warehouse</button>
          </div>
        </form>
      </Modal>

      {/* Modal 4: Add Bin / Rack */}
      <Modal
        isOpen={modal?.type === 'bin'}
        onClose={() => setModal(null)}
        title={`Add Bin / Rack — ${modal?.row?.name || ''}`}
        maxWidth="600px"
      >
        <form className={styles.form} onSubmit={submitBin}>
          <div className={styles.formGrid}>
            <FormField label="Bin Code *">
              <input
                required
                placeholder="e.g. BIN-A-01"
                value={binForm.code}
                onChange={(e) => setBinForm({ ...binForm, code: e.target.value })}
              />
            </FormField>
            <FormField label="Aisle">
              <input
                placeholder="e.g. Aisle 3"
                value={binForm.aisle}
                onChange={(e) => setBinForm({ ...binForm, aisle: e.target.value })}
              />
            </FormField>
            <FormField label="Rack">
              <input
                placeholder="e.g. R-04"
                value={binForm.rack}
                onChange={(e) => setBinForm({ ...binForm, rack: e.target.value })}
              />
            </FormField>
            <FormField label="Description">
              <input
                placeholder="Storage description"
                value={binForm.description}
                onChange={(e) => setBinForm({ ...binForm, description: e.target.value })}
              />
            </FormField>
          </div>
          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>Save Bin</button>
          </div>
        </form>
      </Modal>

      {/* Modal 5: Assign Bin to Stock */}
      <Modal
        isOpen={modal?.type === 'location'}
        onClose={() => setModal(null)}
        title={`Assign Storage Bin — ${modal?.row?.sku || ''}`}
      >
        <form className={styles.form} onSubmit={submitLocation}>
          <p className={styles.hint}>Warehouse: <strong>{modal?.row?.warehouse}</strong></p>
          <FormField label="Select Bin / Rack">
            <select
              value={locationBinId}
              onChange={(e) => setLocationBinId(e.target.value)}
            >
              <option value="">No Bin Assigned</option>
              {locationBins.map((bin) => (
                <option key={bin.id} value={bin.id}>
                  {bin.code} {bin.rack ? `— Rack ${bin.rack}` : ''} {bin.aisle ? `— Aisle ${bin.aisle}` : ''}
                </option>
              ))}
            </select>
          </FormField>
          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>Save Assignment</button>
          </div>
        </form>
      </Modal>

      {/* Modal 6: Create Batch / Lot */}
      <Modal
        isOpen={modal?.type === 'batch'}
        onClose={() => setModal(null)}
        title="Register Inventory Batch / Lot"
        maxWidth="680px"
      >
        <form className={styles.form} onSubmit={submitBatch}>
          <div className={styles.formGrid}>
            <FormField label="SKU *">
              <input
                required
                placeholder="Product SKU"
                value={batchForm.sku}
                onChange={(e) => setBatchForm({ ...batchForm, sku: e.target.value })}
              />
            </FormField>
            <FormField label="Batch No *">
              <input
                required
                placeholder="e.g. BATCH-2026-001"
                value={batchForm.batchNo}
                onChange={(e) => setBatchForm({ ...batchForm, batchNo: e.target.value })}
              />
            </FormField>
            <FormField label="Warehouse *">
              <select
                value={batchForm.warehouse}
                onChange={(e) => setBatchForm({ ...batchForm, warehouse: e.target.value })}
              >
                {warehouseNames.map((w) => <option key={w}>{w}</option>)}
              </select>
            </FormField>
            <FormField label="Initial Batch Qty *">
              <input
                type="number"
                min="1"
                required
                value={batchForm.initialQty}
                onChange={(e) => setBatchForm({ ...batchForm, initialQty: e.target.value, availableQty: e.target.value })}
              />
            </FormField>
            <FormField label="Received Date">
              <input
                type="date"
                value={batchForm.receivedDate}
                onChange={(e) => setBatchForm({ ...batchForm, receivedDate: e.target.value })}
              />
            </FormField>
            <FormField label="Expiry Date (Optional)">
              <input
                type="date"
                value={batchForm.expiryDate}
                onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })}
              />
            </FormField>
            <FormField label="QC Status">
              <select
                value={batchForm.qualityStatus}
                onChange={(e) => setBatchForm({ ...batchForm, qualityStatus: e.target.value })}
              >
                <option value="ACCEPTED">ACCEPTED</option>
                <option value="HOLD">HOLD</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </FormField>
            <FormField label="Unit Cost (₹)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={batchForm.unitCost}
                onChange={(e) => setBatchForm({ ...batchForm, unitCost: e.target.value })}
              />
            </FormField>
          </div>
          <FormField label="Vendor Name (Optional)">
            <input
              placeholder="Supplier name"
              value={batchForm.vendorName}
              onChange={(e) => setBatchForm({ ...batchForm, vendorName: e.target.value })}
            />
          </FormField>
          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>Save Batch</button>
          </div>
        </form>
      </Modal>

      {/* Modal 7: FIFO Allocation Tool & Simulator */}
      <Modal
        isOpen={modal?.type === 'fifo-tool'}
        onClose={() => setModal(null)}
        title="FIFO (First-In, First-Out) Allocation Engine"
        maxWidth="720px"
      >
        <form className={styles.form} onSubmit={runFifoAllocation}>
          <div className={styles.hint}>
            The FIFO Engine searches batches in chronological <code>receivedDate ASC</code> order, allocating exclusively from <code>AVAILABLE</code> unexpired stock.
          </div>

          <div className={styles.formGrid}>
            <FormField label="SKU *">
              <input
                required
                placeholder="Product SKU"
                value={fifoForm.sku}
                onChange={(e) => setFifoForm({ ...fifoForm, sku: e.target.value })}
              />
            </FormField>
            <FormField label="Warehouse *">
              <select
                value={fifoForm.warehouse}
                onChange={(e) => setFifoForm({ ...fifoForm, warehouse: e.target.value })}
              >
                {warehouseNames.map((w) => <option key={w}>{w}</option>)}
              </select>
            </FormField>
            <FormField label="Required Quantity *">
              <input
                type="number"
                min="1"
                required
                placeholder="Units required"
                value={fifoForm.quantity}
                onChange={(e) => setFifoForm({ ...fifoForm, quantity: e.target.value })}
              />
            </FormField>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '1.2rem' }}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={fifoForm.autoReserve}
                  onChange={(e) => setFifoForm({ ...fifoForm, autoReserve: e.target.checked })}
                />
                Auto-reserve allocated stock immediately
              </label>
            </div>
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Close</button>
            <button className={styles.primary} disabled={saving}>
              {saving ? 'Calculating FIFO…' : 'Run FIFO Allocation'}
            </button>
          </div>

          {fifoResult && (
            <div className={styles.fifoBox} style={{ marginTop: '1rem' }}>
              <div className={styles.fifoHeader}>
                <span>FIFO Allocation Summary</span>
                <span>
                  Allocated: <strong>{number(fifoResult.allocatedQty)}</strong> / {number(fifoResult.requiredQty)}
                </span>
              </div>
              {fifoResult.shortageQty > 0 && (
                <div className={styles.low} style={{ fontSize: '0.74rem', fontWeight: 700 }}>
                  ⚠️ Stock Shortage: {number(fifoResult.shortageQty)} units unfulfilled.
                </div>
              )}
              <div className={styles.fifoBatchList}>
                {(fifoResult.batchesAllocated || []).map((b, idx) => (
                  <div key={idx} className={styles.fifoBatchItem}>
                    <div>
                      <strong>Batch #{idx + 1}: {b.batchNo}</strong>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>
                        Received: {dateOnly(b.receivedDate)} | Exp: {dateOnly(b.expiryDate)}
                      </span>
                    </div>
                    <span>+{number(b.allocatedFromThisBatch)} units</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Modal 8: Create Stock Reservation */}
      <Modal
        isOpen={modal?.type === 'reservation'}
        onClose={() => setModal(null)}
        title="Create Stock Reservation"
        maxWidth="680px"
      >
        <form className={styles.form} onSubmit={submitReservation}>
          <div className={styles.hint}>
            Stock reservations isolate quantity strictly from the <strong>Available bucket</strong> into the <strong>Reserved bucket</strong>.
          </div>

          <div className={styles.formGrid}>
            <FormField label="SKU *">
              <input
                required
                placeholder="Product SKU"
                value={reservationForm.sku}
                onChange={(e) => setReservationForm({ ...reservationForm, sku: e.target.value })}
              />
            </FormField>
            <FormField label="Warehouse *">
              <select
                value={reservationForm.warehouse}
                onChange={(e) => setReservationForm({ ...reservationForm, warehouse: e.target.value })}
              >
                {warehouseNames.map((w) => <option key={w}>{w}</option>)}
              </select>
            </FormField>
            <FormField label="Quantity to Reserve *">
              <input
                type="number"
                min="1"
                required
                placeholder="Units to reserve"
                value={reservationForm.quantity}
                onChange={(e) => setReservationForm({ ...reservationForm, quantity: e.target.value })}
              />
            </FormField>
            <FormField label="Specific Batch No (Optional)">
              <input
                placeholder="Leave blank for any batch"
                value={reservationForm.batchNo}
                onChange={(e) => setReservationForm({ ...reservationForm, batchNo: e.target.value })}
              />
            </FormField>
            <FormField label="Reference Type">
              <select
                value={reservationForm.referenceType}
                onChange={(e) => setReservationForm({ ...reservationForm, referenceType: e.target.value })}
              >
                <option value="SALES_ORDER">SALES_ORDER</option>
                <option value="SAMPLE">SAMPLE</option>
                <option value="INTERNAL">INTERNAL</option>
              </select>
            </FormField>
            <FormField label="Reference Document No">
              <input
                placeholder="e.g. SO-2026-0042"
                value={reservationForm.referenceNo}
                onChange={(e) => setReservationForm({ ...reservationForm, referenceNo: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label="Notes">
            <textarea
              rows="2"
              placeholder="Commercial or delivery instructions"
              value={reservationForm.notes}
              onChange={(e) => setReservationForm({ ...reservationForm, notes: e.target.value })}
            />
          </FormField>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>Confirm Reservation</button>
          </div>
        </form>
      </Modal>

      {/* Modal 9: Create Sampling Request */}
      <Modal
        isOpen={modal?.type === 'sampling'}
        onClose={() => setModal(null)}
        title="Issue Customer Sample Request"
        maxWidth="680px"
      >
        <form className={styles.form} onSubmit={submitSampling}>
          <div className={styles.hint}>
            Sample quantities transition into the <strong>Sampling bucket</strong>. If <strong>Payment Waived</strong> is selected, manager approval via Phase 1 Approval Engine is required.
          </div>

          <div className={styles.formGrid}>
            <FormField label="Customer / Prospect Name *">
              <input
                required
                placeholder="Buyer / Company Name"
                value={samplingForm.customerName}
                onChange={(e) => setSamplingForm({ ...samplingForm, customerName: e.target.value })}
              />
            </FormField>
            <FormField label="SKU *">
              <input
                required
                placeholder="Sample SKU"
                value={samplingForm.sku}
                onChange={(e) => setSamplingForm({ ...samplingForm, sku: e.target.value })}
              />
            </FormField>
            <FormField label="Warehouse *">
              <select
                value={samplingForm.warehouse}
                onChange={(e) => setSamplingForm({ ...samplingForm, warehouse: e.target.value })}
              >
                {warehouseNames.map((w) => <option key={w}>{w}</option>)}
              </select>
            </FormField>
            <FormField label="Sample Quantity *">
              <input
                type="number"
                min="1"
                required
                value={samplingForm.quantity}
                onChange={(e) => setSamplingForm({ ...samplingForm, quantity: e.target.value })}
              />
            </FormField>
            <FormField label="Billing Type *">
              <select
                value={samplingForm.billingType}
                onChange={(e) => setSamplingForm({ ...samplingForm, billingType: e.target.value })}
              >
                <option value="FREE">FREE</option>
                <option value="PAID">PAID</option>
                <option value="PAYMENT_WAIVED">PAYMENT_WAIVED (Requires Manager Approval)</option>
              </select>
            </FormField>
            <FormField label="Expected Return Date">
              <input
                type="date"
                value={samplingForm.expectedReturnDate}
                onChange={(e) => setSamplingForm({ ...samplingForm, expectedReturnDate: e.target.value })}
              />
            </FormField>
            <FormField label="Responsible Person">
              <input
                placeholder="Sales Executive / Representative"
                value={samplingForm.responsiblePerson}
                onChange={(e) => setSamplingForm({ ...samplingForm, responsiblePerson: e.target.value })}
              />
            </FormField>
            <FormField label="Courier / AWB No (Optional)">
              <input
                placeholder="Airway Bill Number"
                value={samplingForm.referenceNo}
                onChange={(e) => setSamplingForm({ ...samplingForm, referenceNo: e.target.value })}
              />
            </FormField>
          </div>

          {samplingForm.billingType === 'PAYMENT_WAIVED' && (
            <FormField label="Fee Waiver Justification *">
              <textarea
                required
                rows="2"
                placeholder="Commercial reasoning for fee waiver (sent to Phase 1 Approval Engine)"
                value={samplingForm.waivedReason}
                onChange={(e) => setSamplingForm({ ...samplingForm, waivedReason: e.target.value })}
              />
            </FormField>
          )}

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>Submit Sample Request</button>
          </div>
        </form>
      </Modal>

      {/* Modal 10: Sampling Return */}
      <Modal
        isOpen={modal?.type === 'sampling-return'}
        onClose={() => setModal(null)}
        title={`Record Sample Return — ${modal?.row?.samplingNo || ''}`}
        maxWidth="600px"
      >
        <form className={styles.form} onSubmit={submitSamplingReturn}>
          <div className={styles.hint}>
            Pending sample return for <strong>{modal?.row?.sku}</strong> ({modal?.row?.customerName}).
          </div>

          <div className={styles.formGrid}>
            <FormField label="Returned Quantity *">
              <input
                type="number"
                min="1"
                required
                value={samplingReturnForm.returnedQty}
                onChange={(e) => setSamplingReturnForm({ ...samplingReturnForm, returnedQty: e.target.value })}
              />
            </FormField>
            <FormField label="Destination Bucket *">
              <select
                value={samplingReturnForm.destinationBucket}
                onChange={(e) => setSamplingReturnForm({ ...samplingReturnForm, destinationBucket: e.target.value })}
              >
                <option value="AVAILABLE">AVAILABLE (Restocked)</option>
                <option value="QUALITY_HOLD">QUALITY_HOLD (Inspect First)</option>
                <option value="SCRAP">SCRAP (Damaged / Non-reusable)</option>
              </select>
            </FormField>
            <FormField label="Inspection Status">
              <select
                value={samplingReturnForm.inspectionStatus}
                onChange={(e) => setSamplingReturnForm({ ...samplingReturnForm, inspectionStatus: e.target.value })}
              >
                <option value="PASSED_QC">PASSED_QC</option>
                <option value="DAMAGED">DAMAGED</option>
              </select>
            </FormField>
          </div>

          <FormField label="Return Notes">
            <textarea
              rows="2"
              placeholder="Condition upon return"
              value={samplingReturnForm.notes}
              onChange={(e) => setSamplingReturnForm({ ...samplingReturnForm, notes: e.target.value })}
            />
          </FormField>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>Log Sample Return</button>
          </div>
        </form>
      </Modal>

      {/* Modal 11: Create Gate Pass */}
      <Modal
        isOpen={modal?.type === 'gatepass'}
        onClose={() => setModal(null)}
        title="Create Outbound Gate Pass"
        maxWidth="760px"
      >
        <form className={styles.form} onSubmit={submitGatePass}>
          <div className={styles.formGrid}>
            <FormField label="Gate Pass Type *">
              <select
                value={gatePassForm.gatePassType}
                onChange={(e) => setGatePassForm({ ...gatePassForm, gatePassType: e.target.value })}
              >
                <option value="RETURNABLE">RETURNABLE</option>
                <option value="NON_RETURNABLE">NON_RETURNABLE</option>
                <option value="SAMPLE">SAMPLE</option>
                <option value="JOB_WORK">JOB_WORK</option>
              </select>
            </FormField>
            <FormField label="From Warehouse *">
              <select
                value={gatePassForm.fromWarehouse}
                onChange={(e) => setGatePassForm({ ...gatePassForm, fromWarehouse: e.target.value })}
              >
                {warehouseNames.map((w) => <option key={w}>{w}</option>)}
              </select>
            </FormField>
            <FormField label="Destination Party / Premises *">
              <input
                required
                placeholder="Receiver / Vendor / Customer"
                value={gatePassForm.destination}
                onChange={(e) => setGatePassForm({ ...gatePassForm, destination: e.target.value })}
              />
            </FormField>
            <FormField label="Purpose of Dispatch *">
              <input
                required
                placeholder="e.g. Exhibition, Subcontracting, Job-work"
                value={gatePassForm.purpose}
                onChange={(e) => setGatePassForm({ ...gatePassForm, purpose: e.target.value })}
              />
            </FormField>
            {gatePassForm.gatePassType !== 'NON_RETURNABLE' && (
              <FormField label="Expected Return Date">
                <input
                  type="date"
                  value={gatePassForm.expectedReturnDate}
                  onChange={(e) => setGatePassForm({ ...gatePassForm, expectedReturnDate: e.target.value })}
                />
              </FormField>
            )}
          </div>

          <div className={styles.sectionHeader} style={{ marginTop: '0.5rem' }}>
            <div><strong>Gate Pass Items</strong></div>
            <button
              type="button"
              className={styles.addLine}
              onClick={() => setGatePassForm({
                ...gatePassForm,
                items: [...gatePassForm.items, { sku: '', name: '', qty: '1', uom: 'PCS', value: '0', serialOrBatch: '' }],
              })}
            >
              + Add Item Line
            </button>
          </div>

          {gatePassForm.items.map((item, idx) => (
            <div key={idx} className={styles.materialRow}>
              <input
                required
                placeholder="SKU"
                value={item.sku}
                onChange={(e) => {
                  const items = [...gatePassForm.items];
                  items[idx].sku = e.target.value;
                  setGatePassForm({ ...gatePassForm, items });
                }}
              />
              <input
                required
                placeholder="Item Description"
                value={item.name}
                onChange={(e) => {
                  const items = [...gatePassForm.items];
                  items[idx].name = e.target.value;
                  setGatePassForm({ ...gatePassForm, items });
                }}
              />
              <input
                type="number"
                min="1"
                required
                placeholder="Qty"
                value={item.qty}
                onChange={(e) => {
                  const items = [...gatePassForm.items];
                  items[idx].qty = e.target.value;
                  setGatePassForm({ ...gatePassForm, items });
                }}
              />
              <input
                placeholder="UOM"
                value={item.uom}
                onChange={(e) => {
                  const items = [...gatePassForm.items];
                  items[idx].uom = e.target.value;
                  setGatePassForm({ ...gatePassForm, items });
                }}
              />
              <button
                type="button"
                disabled={gatePassForm.items.length === 1}
                onClick={() => {
                  const items = gatePassForm.items.filter((_, i) => i !== idx);
                  setGatePassForm({ ...gatePassForm, items });
                }}
              >
                ×
              </button>
            </div>
          ))}

          <FormField label="Security Notes / Carrier">
            <textarea
              rows="2"
              placeholder="Vehicle number, driver details, carrier notes"
              value={gatePassForm.notes}
              onChange={(e) => setGatePassForm({ ...gatePassForm, notes: e.target.value })}
            />
          </FormField>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>Issue Gate Pass</button>
          </div>
        </form>
      </Modal>

      {/* Modal 12: Gate Pass Return */}
      <Modal
        isOpen={modal?.type === 'gatepass-return'}
        onClose={() => setModal(null)}
        title={`Record Gate Pass Return — ${modal?.row?.gatePassNo || ''}`}
        maxWidth="600px"
      >
        <form className={styles.form} onSubmit={submitGatePassReturn}>
          <p className={styles.hint}>
            Recording security gate return from {modal?.row?.destination}.
          </p>

          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={gatePassReturnForm.isPartial}
              onChange={(e) => setGatePassReturnForm({ ...gatePassReturnForm, isPartial: e.target.checked })}
            />
            Partial Return (some items still outstanding at external premises)
          </label>

          <FormField label="Return Security Remarks">
            <textarea
              rows="3"
              placeholder="Security verification remarks, condition of return materials"
              value={gatePassReturnForm.notes}
              onChange={(e) => setGatePassReturnForm({ ...gatePassReturnForm, notes: e.target.value })}
            />
          </FormField>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>Complete Gate Return</button>
          </div>
        </form>
      </Modal>

      {/* Modal 13: New Verification Session */}
      <Modal
        isOpen={modal?.type === 'verification'}
        onClose={() => setModal(null)}
        title="Schedule Fortnightly Physical Verification"
        maxWidth="680px"
      >
        <form className={styles.form} onSubmit={submitVerificationSession}>
          <div className={styles.hint}>
            Creating an audit session captures an immutable system quantity snapshot for all items in the chosen warehouse.
          </div>

          <div className={styles.formGrid}>
            <FormField label="Warehouse *">
              <select
                value={verificationForm.warehouse}
                onChange={(e) => setVerificationForm({ ...verificationForm, warehouse: e.target.value })}
              >
                {warehouseNames.map((w) => <option key={w}>{w}</option>)}
              </select>
            </FormField>
            <FormField label="Schedule Frequency">
              <select
                value={verificationForm.scheduleFrequency}
                onChange={(e) => setVerificationForm({ ...verificationForm, scheduleFrequency: e.target.value })}
              >
                <option value="FORTNIGHTLY">FORTNIGHTLY (Every 14 Days)</option>
                <option value="MONTHLY">MONTHLY</option>
                <option value="ANNUAL">ANNUAL</option>
              </select>
            </FormField>
            <FormField label="Scheduled Date">
              <input
                type="date"
                value={verificationForm.scheduledDate}
                onChange={(e) => setVerificationForm({ ...verificationForm, scheduledDate: e.target.value })}
              />
            </FormField>
            <FormField label="Physical Verifier Name *">
              <input
                required
                placeholder="Stock Auditor Name"
                value={verificationForm.verifierName}
                onChange={(e) => setVerificationForm({ ...verificationForm, verifierName: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label="Audit Notes">
            <textarea
              rows="2"
              placeholder="Scope or special counting instructions"
              value={verificationForm.notes}
              onChange={(e) => setVerificationForm({ ...verificationForm, notes: e.target.value })}
            />
          </FormField>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>Initialize Session</button>
          </div>
        </form>
      </Modal>

      {/* Modal 14: Enter Physical Verification Counts & Real-time Variance */}
      <Modal
        isOpen={modal?.type === 'verification-counts'}
        onClose={() => setModal(null)}
        title={`Physical Count Entry — ${activeVerificationSession?.sessionNo || ''}`}
        maxWidth="840px"
      >
        <form className={styles.form} onSubmit={submitVerificationCounts}>
          <div className={styles.hint}>
            Warehouse: <strong>{activeVerificationSession?.warehouse}</strong> |
            Verifier: <strong>{activeVerificationSession?.verifierName}</strong>.
            Enter physical counts. Real-time variance = Physical Count - System Stock.
          </div>

          <TableShell>
            <table>
              <thead>
                <tr>
                  <th>SKU &amp; Product</th>
                  <th>UOM</th>
                  <th>System Stock (Snapshot)</th>
                  <th>Physical Count</th>
                  <th>Variance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(activeVerificationSession?.items || []).map((it) => {
                  const counted = Number.parseInt(verificationCounts[it.sku] ?? it.countedQty ?? 0, 10);
                  const systemQty = it.systemQty || 0;
                  const variance = counted - systemQty;

                  return (
                    <tr key={it.id || it.sku}>
                      <td>
                        <strong>{it.sku}</strong>
                        <small>{it.name}</small>
                      </td>
                      <td>{it.uom}</td>
                      <td><strong>{number(systemQty)}</strong></td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          required
                          className={styles.varianceCountInput}
                          value={verificationCounts[it.sku] ?? ''}
                          onChange={(e) => {
                            setVerificationCounts({
                              ...verificationCounts,
                              [it.sku]: e.target.value,
                            });
                          }}
                        />
                      </td>
                      <td>
                        <span className={variance > 0 ? styles.variancePos : variance < 0 ? styles.varianceNeg : styles.varianceZero}>
                          {variance > 0 ? `+${variance}` : variance}
                        </span>
                      </td>
                      <td>
                        {variance === 0 ? (
                          <span className={`${styles.badge} ${styles.success}`}>MATCH</span>
                        ) : variance < 0 ? (
                          <span className={`${styles.badge} ${styles.danger}`}>SHORTAGE</span>
                        ) : (
                          <span className={`${styles.badge} ${styles.info}`}>EXCESS</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableShell>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>
              {saving ? 'Submitting…' : 'Submit Counts for Sign-off'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 15: Create Stock Adjustment */}
      <Modal
        isOpen={modal?.type === 'adjustment'}
        onClose={() => setModal(null)}
        title="Create Stock Adjustment Request"
        maxWidth="680px"
      >
        <form className={styles.form} onSubmit={submitAdjustment}>
          <div className={styles.sodNotice}>
            🛡️ <strong>Segregation of Duties Enforcement:</strong> You are submitting this adjustment as the Maker ({currentUser?.name || currentUser?.email || 'User'}). A different authorized Manager/Checker must approve it before stock balances change.
          </div>

          <div className={styles.formGrid}>
            <FormField label="SKU *">
              <input
                required
                placeholder="Product SKU"
                value={adjustmentForm.sku}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, sku: e.target.value })}
              />
            </FormField>
            <FormField label="Warehouse *">
              <select
                value={adjustmentForm.warehouse}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, warehouse: e.target.value })}
              >
                {warehouseNames.map((w) => <option key={w}>{w}</option>)}
              </select>
            </FormField>
            <FormField label="Target Bucket *">
              <select
                value={adjustmentForm.bucket}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, bucket: e.target.value })}
              >
                {BUCKET_DEFINITIONS.map((b) => (
                  <option key={b.css} value={b.css}>{b.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Adjustment Type *">
              <select
                value={adjustmentForm.adjustmentType}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustmentType: e.target.value })}
              >
                <option value="CORRECTION">CORRECTION (Routine count match)</option>
                <option value="DAMAGE">DAMAGE (Damaged goods write-off)</option>
                <option value="EXPIRY">EXPIRY (Expired inventory write-off)</option>
                <option value="FOUND">FOUND (Found surplus inventory)</option>
                <option value="SHORTAGE">SHORTAGE (Unexplained physical loss)</option>
              </select>
            </FormField>
            <FormField label="Adjustment Quantity (+ for surplus, - for loss) *">
              <input
                type="number"
                required
                placeholder="e.g. -5 or +10"
                value={adjustmentForm.adjustmentQty}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustmentQty: e.target.value })}
              />
            </FormField>
            <FormField label="Supporting Doc URL (Optional)">
              <input
                placeholder="Link to incident / surveyor report"
                value={adjustmentForm.supportingDocUrl}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, supportingDocUrl: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label="Detailed Reason *">
            <textarea
              required
              rows="2"
              placeholder="Detailed justification for inventory adjustment"
              value={adjustmentForm.reason}
              onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
            />
          </FormField>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>Submit Adjustment</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

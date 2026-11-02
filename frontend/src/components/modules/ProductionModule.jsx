'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import styles from './ProductionModule.module.css';

const TAB_ALIASES = {
  dashboard: 'dashboard',
  boms: 'boms',
  bom: 'boms',
  costing: 'costing',
  plans: 'plans',
  planning: 'plans',
  orders: 'orders',
  work_orders: 'orders',
  material_issue: 'material_issue',
  fifo: 'material_issue',
  batches: 'batches',
  stages: 'stages',
  mixing: 'stages',
  dpr: 'dpr',
  yield: 'dpr',
  qc: 'qc',
  quality: 'qc',
  traceability: 'traceability',
  genealogy: 'traceability',
  reprocessing: 'reprocessing',
  rework: 'reprocessing',
};

const DEFAULT_STAGES = [
  { stepNumber: 1, stageName: 'Dispensing & Pre-Weighing', targetDuration: 30, targetTempC: 25.0 },
  { stepNumber: 2, stageName: 'Premixing & Dissolution', targetDuration: 45, targetTempC: 35.0 },
  { stepNumber: 3, stageName: 'Heating & Reaction Phase', targetDuration: 90, targetTempC: 75.0 },
  { stepNumber: 4, stageName: 'Homogenization & Agitation', targetDuration: 60, targetTempC: 60.0 },
  { stepNumber: 5, stageName: 'Controlled Cooling', targetDuration: 45, targetTempC: 30.0 },
  { stepNumber: 6, stageName: 'Filtration & Sifting', targetDuration: 30, targetTempC: 25.0 },
  { stepNumber: 7, stageName: 'Filling & Secondary Packaging', targetDuration: 60, targetTempC: 25.0 },
];

function numberFmt(val) {
  return Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
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
  if (['APPROVED', 'COMPLETED', 'PASSED', 'ACTIVE', 'RELEASE_TO_AVAILABLE', 'READY_TO_ISSUE', 'RELEASED'].includes(value)) {
    tone = 'success';
  } else if (['PENDING', 'PENDING_APPROVAL', 'IN_PROGRESS', 'IN_MIXING', 'IN_INSPECTION', 'QC_PENDING', 'MATERIAL_PENDING', 'READY_FOR_PRODUCTION'].includes(value)) {
    tone = 'warning';
  } else if (['REJECTED', 'FAILED', 'CANCELLED', 'HOLD_IN_QUALITY', 'SHORTAGE_DETECTED'].includes(value)) {
    tone = 'danger';
  } else if (['HIGH', 'PLANNED'].includes(value)) {
    tone = 'info';
  }
  return <span className={`${styles.badge} ${styles[tone]}`}>{str}</span>;
}

export default function ProductionModule({ activeCompany, showToast, initialSubTab }) {
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

  // Loading and Error states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Primary Data Collections
  const [products, setProducts] = useState([]);
  const [boms, setBoms] = useState([]);
  const [plans, setPlans] = useState([]);
  const [orders, setOrders] = useState([]);
  const [batches, setBatches] = useState([]);
  const [dprs, setDprs] = useState([]);
  const [qcInspections, setQcInspections] = useState([]);
  const [reprocessings, setReprocessings] = useState([]);

  // Selected Entities for Detail Views / Modals
  const [selectedBom, setSelectedBom] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [costingSimulation, setCostingSimulation] = useState(null);
  const [materialCheck, setMaterialCheck] = useState(null);
  const [genealogyData, setGenealogyData] = useState(null);

  // Modal Visibility states
  const [modalOpen, setModalOpen] = useState(null); // 'createBom', 'viewBom', 'branchRevision', 'createPlan', 'createOrder', 'orderDetails', 'issueMaterial', 'returnMaterial', 'createBatch', 'stepComplete', 'createDpr', 'createQc', 'receiveFg', 'createReprocessing', 'reprocessingQc'

  // Sub-search and Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Traceability search state
  const [traceSearchTerm, setTraceSearchTerm] = useState('');
  const [traceMode, setTraceMode] = useState('BACKWARD'); // 'BACKWARD' or 'FORWARD'
  const [forwardTraceData, setForwardTraceData] = useState(null);

  // ====================================================================
  // FORM STATES
  // ====================================================================

  // BOM Form State
  const [bomForm, setBomForm] = useState({
    bomCode: '',
    bomName: '',
    outputProductId: '',
    batchSize: '100',
    uom: 'KG',
    overheadCost: '0',
    laborCost: '0',
    items: [
      { productId: '', itemType: 'RAW_MATERIAL', percentage: '60.0000', scrapTolerancePct: '1.0' },
      { productId: '', itemType: 'RAW_MATERIAL', percentage: '40.0000', scrapTolerancePct: '1.0' },
    ],
  });

  // Branch Revision Form State
  const [branchForm, setBranchForm] = useState({ notes: '' });

  // Costing Simulation Input
  const [costingBatchSize, setCostingBatchSize] = useState('100');

  // Production Plan Form State
  const [planForm, setPlanForm] = useState({
    planNo: '',
    planName: '',
    outputProductId: '',
    bomId: '',
    plannedQuantity: '100',
    uom: 'KG',
    priority: 'MEDIUM',
    startDate: new Date().toISOString().split('T')[0],
    targetDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    notes: '',
  });

  // Production Order Form State
  const [orderForm, setOrderForm] = useState({
    orderNo: '',
    planId: '',
    outputProductId: '',
    bomId: '',
    targetQuantity: '100',
    uom: 'KG',
    priority: 'MEDIUM',
    scheduledStart: new Date().toISOString().split('T')[0],
    scheduledEnd: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    notes: '',
  });

  // Material Issue & Return Forms
  const [issueForm, setIssueForm] = useState({ orderId: '', batchId: '' });
  const [returnForm, setReturnForm] = useState({ orderId: '', rmBatchId: '', quantity: '', reason: '' });

  // Manufacturing Batch Form
  const [batchForm, setBatchForm] = useState({
    orderId: '',
    batchNo: '',
    batchQuantity: '100',
    machineName: 'Mixing Line 1',
    shift: 'Shift A',
    supervisorName: '',
    mfgDate: new Date().toISOString().split('T')[0],
    expDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
  });

  // Step Completion Form
  const [stepCompleteForm, setStepCompleteForm] = useState({
    batchId: '',
    stepNumber: 1,
    actualDuration: '',
    actualTempC: '',
    operatorName: '',
    notes: '',
  });

  // DPR Form State
  const [dprForm, setDprForm] = useState({
    dprDate: new Date().toISOString().split('T')[0],
    shift: 'Shift A',
    machineName: 'Mixing Line 1',
    orderId: '',
    plannedQty: '100',
    actualQty: '98',
    wastageQty: '2',
    downtimeMinutes: '0',
    downtimeReason: '',
    supervisorName: '',
    notes: '',
  });

  // QC Form State
  const [qcForm, setQcForm] = useState({
    batchId: '',
    testedQty: '100',
    passedQty: '100',
    rejectedQty: '0',
    status: 'PASSED',
    remarks: 'Complies with all technical and purity parameters',
    parameters: [
      { name: 'pH Value', spec: '6.5 - 7.5', result: '6.8', passed: true },
      { name: 'Viscosity (cP)', spec: '120 - 150', result: '135', passed: true },
      { name: 'Specific Gravity', spec: '1.02 - 1.05', result: '1.03', passed: true },
      { name: 'Appearance / Color', spec: 'Clear Homogeneous', result: 'Clear', passed: true },
    ],
  });

  // FG Receipt Form State
  const [fgReceiptForm, setFgReceiptForm] = useState({
    batchId: '',
    warehouse: 'Main Warehouse',
    actualOutputQty: '',
    notes: 'Finished Goods Receipt into warehouse from completed manufacturing batch',
  });

  // Reprocessing Form State
  const [reprocessForm, setReprocessForm] = useState({
    originalBatchId: '',
    reason: '',
    rootCause: '',
    reworkPlan: '',
    quantity: '',
  });

  // Reprocessing QC Form
  const [reprocessQcForm, setReprocessQcForm] = useState({
    reprocessId: '',
    status: 'PASSED',
    remarks: 'Post-rework quality parameters conforming to finished goods standard.',
  });

  // ====================================================================
  // DATA FETCHING
  // ====================================================================

  const fetchBaseData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Products
      const prodRes = await api.get(`/companies/${companyId}/inventory/products`).catch(() => null);
      if (prodRes?.data) setProducts(prodRes.data);

      // 2. BOMs
      const bomRes = await api.get(`/companies/${companyId}/production/boms`).catch(() => null);
      if (bomRes?.data) setBoms(bomRes.data);

      // 3. Plans
      const planRes = await api.get(`/companies/${companyId}/production/plans`).catch(() => null);
      if (planRes?.data) setPlans(planRes.data);

      // 4. Orders
      const orderRes = await api.get(`/companies/${companyId}/production/orders`).catch(() => null);
      if (orderRes?.data) setOrders(orderRes.data);

      // 5. DPRs
      const dprRes = await api.get(`/companies/${companyId}/production/dpr`).catch(() => null);
      if (dprRes?.data) setDprs(dprRes.data);

      // 6. QC Inspections
      const qcRes = await api.get(`/companies/${companyId}/production/qc-inspections`).catch(() => null);
      if (qcRes?.data) setQcInspections(qcRes.data);

      // 7. Reprocessings
      const reprRes = await api.get(`/companies/${companyId}/production/reprocessings`).catch(() => null);
      if (reprRes?.data) setReprocessings(reprRes.data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load manufacturing records.');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchBaseData();
  }, [fetchBaseData]);

  // Reload batches when selected order changes or on demand
  const refreshBatches = useCallback(async () => {
    if (!companyId) return;
    try {
      const orderList = await api.get(`/companies/${companyId}/production/orders`).catch(() => null);
      if (orderList?.data) {
        setOrders(orderList.data);
        const allBatches = [];
        orderList.data.forEach((o) => {
          if (Array.isArray(o.batches)) {
            o.batches.forEach((b) => allBatches.push({ ...b, orderNo: o.orderNo, outputProduct: o.outputProduct }));
          }
        });
        setBatches(allBatches);
      }
    } catch (e) {
      console.warn('Error refreshing batches:', e);
    }
  }, [companyId]);

  useEffect(() => {
    refreshBatches();
  }, [refreshBatches]);

  // Real-time formula percentage calculation
  const formulaTotalPercentage = useMemo(() => {
    const total = (bomForm.items || []).reduce((sum, item) => sum + (Number(item.percentage) || 0), 0);
    return Math.round(total * 10000) / 10000;
  }, [bomForm.items]);

  const isFormulaValid100 = useMemo(() => {
    return Math.abs(formulaTotalPercentage - 100.0000) < 0.0001;
  }, [formulaTotalPercentage]);

  // Dashboard Aggregates
  const dashboardStats = useMemo(() => {
    const totalPlans = plans.length;
    const activeOrders = orders.filter((o) => ['APPROVED', 'IN_PROGRESS', 'READY_FOR_PRODUCTION'].includes(o.status)).length;
    const completedOrders = orders.filter((o) => o.status === 'COMPLETED').length;
    const pendingQc = qcInspections.filter((q) => q.status === 'PENDING').length;
    const totalBatches = batches.length;
    const completedBatches = batches.filter((b) => b.status === 'COMPLETED').length;
    const activeReprocessing = reprocessings.filter((r) => r.status === 'PENDING_APPROVAL' || r.status === 'IN_REPROCESSING').length;

    let plannedVolume = 0;
    let actualVolume = 0;
    dprs.forEach((d) => {
      plannedVolume += Number(d.plannedQty || 0);
      actualVolume += Number(d.actualQty || 0);
    });
    const avgEfficiency = plannedVolume > 0 ? Math.round((actualVolume / plannedVolume) * 1000) / 10 : 0;

    return {
      totalPlans,
      activeOrders,
      completedOrders,
      pendingQc,
      totalBatches,
      completedBatches,
      activeReprocessing,
      plannedVolume,
      actualVolume,
      avgEfficiency,
    };
  }, [plans, orders, qcInspections, batches, reprocessings, dprs]);

  // ====================================================================
  // HANDLERS
  // ====================================================================

  // Handle BOM Creation
  const handleCreateBom = async (e) => {
    e.preventDefault();
    if (!isFormulaValid100) {
      showToast?.(`Formula sum must be exactly 100.0000%. Current sum: ${formulaTotalPercentage.toFixed(4)}%`, 'error');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        bomCode: bomForm.bomCode || undefined,
        bomName: bomForm.bomName,
        outputProductId: bomForm.outputProductId,
        batchSize: Number(bomForm.batchSize),
        uom: bomForm.uom,
        overheadCost: Number(bomForm.overheadCost || 0),
        laborCost: Number(bomForm.laborCost || 0),
        items: bomForm.items.map((i, idx) => ({
          productId: i.productId,
          itemType: i.itemType || 'RAW_MATERIAL',
          percentage: Number(i.percentage),
          scrapTolerancePct: Number(i.scrapTolerancePct || 0),
          sequenceOrder: idx + 1,
        })),
      };

      const res = await api.post(`/companies/${companyId}/production/boms`, payload);
      showToast?.(`BOM ${res.data?.bomCode || ''} created successfully in Draft status.`, 'success');
      setModalOpen(null);
      fetchBaseData();
    } catch (err) {
      showToast?.(err.message || 'Failed to create BOM.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Submit BOM for Approval
  const handleSubmitBomApproval = async (bomId) => {
    if (!confirm('Submit this BOM formula for commercial and technical approval?')) return;
    setLoading(true);
    try {
      await api.post(`/companies/${companyId}/production/boms/${bomId}/submit-approval`, {});
      showToast?.('BOM formula submitted for approval.', 'success');
      fetchBaseData();
    } catch (err) {
      showToast?.(err.message || 'Failed to submit BOM for approval.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Approve BOM
  const handleApproveBom = async (bomId) => {
    if (!confirm('Approve and permanently lock this BOM version? Approved versions cannot be edited in place.')) return;
    setLoading(true);
    try {
      await api.post(`/companies/${companyId}/production/boms/${bomId}/approve`, {});
      showToast?.('BOM version successfully approved and locked.', 'success');
      fetchBaseData();
    } catch (err) {
      showToast?.(err.message || 'Failed to approve BOM.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Branch Revision
  const handleBranchRevision = async (e) => {
    e.preventDefault();
    if (!selectedBom) return;
    setLoading(true);
    try {
      const res = await api.post(`/companies/${companyId}/production/boms/${selectedBom.id}/branch-revision`, {
        notes: branchForm.notes,
      });
      showToast?.(`Branched new revision ${res.data?.version || ''} from parent ${selectedBom.version}.`, 'success');
      setModalOpen(null);
      fetchBaseData();
    } catch (err) {
      showToast?.(err.message || 'Failed to branch BOM revision.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Simulate Costing
  const handleSimulateCosting = async (bomId, targetSize) => {
    setLoading(true);
    try {
      const res = await api.get(`/companies/${companyId}/production/boms/${bomId}/costing?targetBatchSize=${targetSize || 100}`);
      setCostingSimulation(res.data);
      setActiveTab('costing');
    } catch (err) {
      showToast?.(err.message || 'Failed to run costing simulation.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Create Production Plan
  const handleCreatePlan = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        planNo: planForm.planNo || undefined,
        planName: planForm.planName,
        outputProductId: planForm.outputProductId,
        bomId: planForm.bomId,
        plannedQuantity: Number(planForm.plannedQuantity),
        uom: planForm.uom,
        priority: planForm.priority,
        startDate: planForm.startDate,
        targetDate: planForm.targetDate,
        notes: planForm.notes,
      };
      const res = await api.post(`/companies/${companyId}/production/plans`, payload);
      showToast?.(`Production Plan ${res.data?.planNo || ''} created successfully.`, 'success');
      setModalOpen(null);
      fetchBaseData();
    } catch (err) {
      showToast?.(err.message || 'Failed to create plan.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Create Production Order
  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        orderNo: orderForm.orderNo || undefined,
        planId: orderForm.planId || undefined,
        outputProductId: orderForm.outputProductId,
        bomId: orderForm.bomId,
        targetQuantity: Number(orderForm.targetQuantity),
        uom: orderForm.uom,
        priority: orderForm.priority,
        scheduledStart: orderForm.scheduledStart,
        scheduledEnd: orderForm.scheduledEnd,
        notes: orderForm.notes,
      };
      const res = await api.post(`/companies/${companyId}/production/orders`, payload);
      showToast?.(`Production Order ${res.data?.orderNo || ''} created successfully with exploded requirements.`, 'success');
      setModalOpen(null);
      fetchBaseData();
    } catch (err) {
      showToast?.(err.message || 'Failed to create production order.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Update Order Status
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    setLoading(true);
    try {
      await api.patch(`/companies/${companyId}/production/orders/${orderId}/status`, { status: newStatus });
      showToast?.(`Production Order status updated to ${newStatus}.`, 'success');
      fetchBaseData();
      if (selectedOrder && selectedOrder.id === orderId) {
        const refreshed = await api.get(`/companies/${companyId}/production/orders/${orderId}`);
        setSelectedOrder(refreshed.data);
      }
    } catch (err) {
      showToast?.(err.message || 'Failed to update order status.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Check Material Availability
  const handleCheckMaterials = async (orderId) => {
    setLoading(true);
    try {
      const res = await api.get(`/companies/${companyId}/production/orders/${orderId}/material-check`);
      setMaterialCheck(res.data);
      setActiveTab('material_issue');
    } catch (err) {
      showToast?.(err.message || 'Failed to evaluate material shortages.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // FIFO Issue Materials
  const handleIssueMaterialsFIFO = async (e) => {
    e.preventDefault();
    if (!issueForm.orderId) return;
    setLoading(true);
    try {
      const res = await api.post(`/companies/${companyId}/production/orders/${issueForm.orderId}/issue-materials`, {
        batchId: issueForm.batchId || undefined,
      });
      showToast?.(`Successfully issued ${res.data?.issuedCount || 0} material lines to WIP bucket via FIFO.`, 'success');
      setModalOpen(null);
      fetchBaseData();
      refreshBatches();
      if (materialCheck?.orderId === issueForm.orderId) {
        handleCheckMaterials(issueForm.orderId);
      }
    } catch (err) {
      showToast?.(err.message || 'FIFO material issue failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Return Unused Material
  const handleReturnMaterial = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post(`/companies/${companyId}/production/material-return`, {
        orderId: returnForm.orderId || undefined,
        rmBatchId: returnForm.rmBatchId,
        quantity: Number(returnForm.quantity),
        reason: returnForm.reason,
      });
      showToast?.(`Returned ${res.data?.returnedQty} units from WIP to Available (Mov: ${res.data?.movementNo}).`, 'success');
      setModalOpen(null);
      fetchBaseData();
    } catch (err) {
      showToast?.(err.message || 'Return failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Create Manufacturing Batch
  const handleCreateBatch = async (e) => {
    e.preventDefault();
    if (!batchForm.orderId) {
      showToast?.('Please select a production order.', 'error');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        batchNo: batchForm.batchNo || undefined,
        batchQuantity: Number(batchForm.batchQuantity),
        machineName: batchForm.machineName,
        shift: batchForm.shift,
        supervisorName: batchForm.supervisorName,
        mfgDate: batchForm.mfgDate,
        expDate: batchForm.expDate,
      };
      const res = await api.post(`/companies/${companyId}/production/orders/${batchForm.orderId}/batches`, payload);
      showToast?.(`Manufacturing Batch ${res.data?.batchNo || ''} initialized with 7 sequential mixing stages.`, 'success');
      setModalOpen(null);
      refreshBatches();
    } catch (err) {
      showToast?.(err.message || 'Failed to create manufacturing batch.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Complete Process Stage (Sequential Gate Enforced)
  const handleCompleteProcessStep = async (e) => {
    e.preventDefault();
    const { batchId, stepNumber, actualDuration, actualTempC, operatorName, notes } = stepCompleteForm;
    setLoading(true);
    try {
      const res = await api.post(`/companies/${companyId}/production/batches/${batchId}/steps/${stepNumber}/complete`, {
        actualDuration: Number(actualDuration) || undefined,
        actualTempC: actualTempC ? Number(actualTempC) : undefined,
        operatorName,
        notes,
      });
      showToast?.(`Stage ${stepNumber} (${res.data?.stageName || ''}) completed and verified.`, 'success');
      setModalOpen(null);
      refreshBatches();
      // Refresh selected batch in stages tab
      if (selectedBatch && selectedBatch.id === batchId) {
        const gene = await api.get(`/companies/${companyId}/production/batches/${batchId}/genealogy`);
        setSelectedBatch((prev) => ({
          ...prev,
          steps: gene.data?.processStages || prev.steps,
          status: gene.data?.batchDetails?.status || prev.status,
        }));
      }
    } catch (err) {
      showToast?.(err.message || 'Sequential stage completion blocked.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Create DPR
  const handleCreateDpr = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        dprDate: dprForm.dprDate,
        shift: dprForm.shift,
        machineName: dprForm.machineName,
        orderId: dprForm.orderId || undefined,
        plannedQty: Number(dprForm.plannedQty),
        actualQty: Number(dprForm.actualQty),
        wastageQty: Number(dprForm.wastageQty || 0),
        downtimeMinutes: Number(dprForm.downtimeMinutes || 0),
        downtimeReason: dprForm.downtimeReason || undefined,
        supervisorName: dprForm.supervisorName,
        notes: dprForm.notes,
      };
      const res = await api.post(`/companies/${companyId}/production/dpr`, payload);
      showToast?.(`DPR ${res.data?.dprNo || ''} recorded. Efficiency: ${res.data?.efficiencyPct}%.`, 'success');
      setModalOpen(null);
      fetchBaseData();
    } catch (err) {
      showToast?.(err.message || 'Failed to record DPR.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Create QC Inspection
  const handleCreateQcInspection = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        batchId: qcForm.batchId,
        testedQty: Number(qcForm.testedQty),
        passedQty: Number(qcForm.passedQty),
        rejectedQty: Number(qcForm.rejectedQty || 0),
        status: qcForm.status,
        remarks: qcForm.remarks,
        parameterResults: qcForm.parameters,
      };
      const res = await api.post(`/companies/${companyId}/production/qc-inspections`, payload);
      showToast?.(`QC Inspection ${res.data?.qcNo || ''} logged with disposition: ${res.data?.disposition || res.data?.status}.`, 'success');
      setModalOpen(null);
      fetchBaseData();
      refreshBatches();
    } catch (err) {
      showToast?.(err.message || 'Failed to record QC inspection.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Receive Finished Goods (QC Gate Enforced)
  const handleReceiveFinishedGoods = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post(`/companies/${companyId}/production/batches/${fgReceiptForm.batchId}/receive-fg`, {
        warehouse: fgReceiptForm.warehouse,
        actualOutputQty: fgReceiptForm.actualOutputQty ? Number(fgReceiptForm.actualOutputQty) : undefined,
        notes: fgReceiptForm.notes,
      });
      showToast?.(`Finished goods received into AVAILABLE stock! Inward Movement: ${res.data?.movementNo || ''}.`, 'success');
      setModalOpen(null);
      fetchBaseData();
      refreshBatches();
    } catch (err) {
      showToast?.(err.message || 'FG receipt blocked: QC must be PASSED before stock receipt.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load Genealogy
  const handleLoadGenealogy = async (batchId) => {
    setLoading(true);
    try {
      const res = await api.get(`/companies/${companyId}/production/batches/${batchId}/genealogy`);
      setGenealogyData(res.data);
      setTraceMode('BACKWARD');
      setActiveTab('traceability');
    } catch (err) {
      showToast?.(err.message || 'Failed to load batch genealogy.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Forward Traceability Search
  const handleForwardTrace = async (rmBatchId) => {
    if (!rmBatchId) return;
    setLoading(true);
    try {
      const res = await api.get(`/companies/${companyId}/production/trace-rm/${rmBatchId}`);
      setForwardTraceData(res.data);
      setTraceMode('FORWARD');
    } catch (err) {
      showToast?.(err.message || 'Forward traceability search failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Create Reprocessing
  const handleCreateReprocessing = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        originalBatchId: reprocessForm.originalBatchId,
        reason: reprocessForm.reason,
        rootCause: reprocessForm.rootCause,
        reworkPlan: reprocessForm.reworkPlan,
        quantity: Number(reprocessForm.quantity),
      };
      const res = await api.post(`/companies/${companyId}/production/reprocessings`, payload);
      showToast?.(`Reprocessing ticket ${res.data?.reprocessNo || ''} created and submitted for approval.`, 'success');
      setModalOpen(null);
      fetchBaseData();
      refreshBatches();
    } catch (err) {
      showToast?.(err.message || 'Failed to create reprocessing ticket.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Complete Reprocessing QC
  const handleCompleteReprocessingQc = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/companies/${companyId}/production/reprocessings/${reprocessQcForm.reprocessId}/qc`, {
        status: reprocessQcForm.status,
        remarks: reprocessQcForm.remarks,
      });
      showToast?.('Post-reprocessing QC inspection logged. Rework ticket completed.', 'success');
      setModalOpen(null);
      fetchBaseData();
      refreshBatches();
    } catch (err) {
      showToast?.(err.message || 'Post-reprocessing QC failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.module}>
      {/* Module Header */}
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Phase 5 — Manufacturing &amp; Production</span>
          <h2>Shopfloor Operations &amp; Formulation Control</h2>
          <p>
            Formulas, BOM Costing, Work Releases, FIFO WIP Allocation, Sequential Mixing Gates, DPR Tracking &amp; Two-Way Batch Genealogy for <strong>{activeCompany?.organizationName || 'Shree Nath Exports'}</strong>
          </p>
        </div>
        <button type="button" onClick={fetchBaseData} disabled={loading}>
          {loading ? 'Refreshing...' : '🔄 Refresh Data'}
        </button>
      </div>

      {/* Process Flow Ribbon */}
      <div className={styles.flow}>
        <span>1. Approved BOM</span>
        <b>➔</b>
        <span>2. Production Plan</span>
        <b>➔</b>
        <span>3. Work Order</span>
        <b>➔</b>
        <span>4. FIFO Issue (WIP)</span>
        <b>➔</b>
        <span>5. Sequential Mixing (7 Stages)</span>
        <b>➔</b>
        <span>6. QC Inspection</span>
        <b>➔</b>
        <span>7. FG Receipt (Available)</span>
      </div>

      {/* 12-Tab Navigation Bar */}
      <div className={styles.tabs}>
        <button type="button" className={activeTab === 'dashboard' ? styles.active : ''} onClick={() => setActiveTab('dashboard')}>
          📊 1. Dashboard
        </button>
        <button type="button" className={activeTab === 'boms' ? styles.active : ''} onClick={() => setActiveTab('boms')}>
          🧪 2. BOM Master &amp; Formula <span className={styles.tabBadge}>{boms.length}</span>
        </button>
        <button type="button" className={activeTab === 'costing' ? styles.active : ''} onClick={() => setActiveTab('costing')}>
          💰 3. Costing &amp; Simulation
        </button>
        <button type="button" className={activeTab === 'plans' ? styles.active : ''} onClick={() => setActiveTab('plans')}>
          🗓️ 4. Production Planning <span className={styles.tabBadge}>{plans.length}</span>
        </button>
        <button type="button" className={activeTab === 'orders' ? styles.active : ''} onClick={() => setActiveTab('orders')}>
          📋 5. Work Orders <span className={styles.tabBadge}>{orders.length}</span>
        </button>
        <button type="button" className={activeTab === 'material_issue' ? styles.active : ''} onClick={() => setActiveTab('material_issue')}>
          📦 6. RM Needs &amp; FIFO Issue
        </button>
        <button type="button" className={activeTab === 'batches' ? styles.active : ''} onClick={() => setActiveTab('batches')}>
          🏭 7. Manufacturing Batches <span className={styles.tabBadge}>{batches.length}</span>
        </button>
        <button type="button" className={activeTab === 'stages' ? styles.active : ''} onClick={() => setActiveTab('stages')}>
          ⚙️ 8. Mixing &amp; Stage Gates
        </button>
        <button type="button" className={activeTab === 'dpr' ? styles.active : ''} onClick={() => setActiveTab('dpr')}>
          📝 9. Daily Production Report <span className={styles.tabBadge}>{dprs.length}</span>
        </button>
        <button type="button" className={activeTab === 'qc' ? styles.active : ''} onClick={() => setActiveTab('qc')}>
          🔬 10. Quality Control <span className={styles.tabBadge}>{qcInspections.length}</span>
        </button>
        <button type="button" className={activeTab === 'traceability' ? styles.active : ''} onClick={() => setActiveTab('traceability')}>
          🔗 11. Batch Traceability
        </button>
        <button type="button" className={activeTab === 'reprocessing' ? styles.active : ''} onClick={() => setActiveTab('reprocessing')}>
          ♻️ 12. Internal Reprocessing <span className={styles.tabBadge}>{reprocessings.length}</span>
        </button>
        <a href="/contract-manufacturing" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0.6rem 0.9rem', borderRadius: '8px', background: '#f5f3ff', color: '#7c3aed', fontWeight: 700, fontSize: '0.82rem', border: '1px solid #ddd6fe', marginLeft: 'auto' }} title="Open External Supplier Production and Job Work Order Workspace">
          🏭 External Contract Mfg ↗
        </a>
      </div>

      {/* Global Error Banner */}
      {errorMsg && (
        <div className={styles.alertDanger}>
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 1: MANUFACTURING DASHBOARD */}
      {/* ================================================================ */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span>🗓️</span>
              <div>
                <strong>{dashboardStats.totalPlans}</strong>
                <small>Total Production Plans</small>
              </div>
            </div>
            <div className={styles.stat}>
              <span>📋</span>
              <div>
                <strong>{dashboardStats.activeOrders}</strong>
                <small>Active Work Orders</small>
              </div>
            </div>
            <div className={styles.stat}>
              <span>🏭</span>
              <div>
                <strong>{dashboardStats.totalBatches}</strong>
                <small>Manufacturing Batches</small>
              </div>
            </div>
            <div className={styles.stat}>
              <span>⚡</span>
              <div>
                <strong>{dashboardStats.avgEfficiency}%</strong>
                <small>Average Efficiency (DPR)</small>
              </div>
            </div>
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <span>🔬</span>
              <div>
                <strong>{dashboardStats.pendingQc}</strong>
                <small>Pending QC Inspections</small>
              </div>
            </div>
            <div className={styles.stat}>
              <span>✅</span>
              <div>
                <strong>{dashboardStats.completedBatches}</strong>
                <small>Batches Completed &amp; Inwarded</small>
              </div>
            </div>
            <div className={styles.stat}>
              <span>♻️</span>
              <div>
                <strong>{dashboardStats.activeReprocessing}</strong>
                <small>Active Reprocessing Tickets</small>
              </div>
            </div>
            <div className={styles.stat}>
              <span>📦</span>
              <div>
                <strong>{numberFmt(dashboardStats.actualVolume)} KG</strong>
                <small>Actual Output Volume</small>
              </div>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 .85rem' }}>Quick Actions</h3>
            <div style={{ display: 'flex', gap: '.65rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={styles.primary}
                onClick={() => {
                  setBomForm({
                    bomCode: '',
                    bomName: '',
                    outputProductId: products.find((p) => p.category?.toLowerCase().includes('finish'))?.id || products[0]?.id || '',
                    batchSize: '100',
                    uom: 'KG',
                    overheadCost: '500',
                    laborCost: '300',
                    items: [
                      { productId: products[0]?.id || '', itemType: 'RAW_MATERIAL', percentage: '60.0000', scrapTolerancePct: '1.0' },
                      { productId: products[1]?.id || '', itemType: 'RAW_MATERIAL', percentage: '40.0000', scrapTolerancePct: '1.0' },
                    ],
                  });
                  setModalOpen('createBom');
                }}
              >
                + New BOM Formula
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlanForm({
                    planNo: '',
                    planName: '',
                    outputProductId: products[0]?.id || '',
                    bomId: boms.find((b) => b.status === 'APPROVED')?.id || boms[0]?.id || '',
                    plannedQuantity: '200',
                    uom: 'KG',
                    priority: 'HIGH',
                    startDate: new Date().toISOString().split('T')[0],
                    targetDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                    notes: '',
                  });
                  setModalOpen('createPlan');
                }}
              >
                + Create Production Plan
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderForm({
                    orderNo: '',
                    planId: plans[0]?.id || '',
                    outputProductId: products[0]?.id || '',
                    bomId: boms.find((b) => b.status === 'APPROVED')?.id || boms[0]?.id || '',
                    targetQuantity: '100',
                    uom: 'KG',
                    priority: 'MEDIUM',
                    scheduledStart: new Date().toISOString().split('T')[0],
                    scheduledEnd: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                    notes: '',
                  });
                  setModalOpen('createOrder');
                }}
              >
                + Create Work Order
              </button>
              <button
                type="button"
                onClick={() => {
                  setDprForm({
                    dprDate: new Date().toISOString().split('T')[0],
                    shift: 'Shift A',
                    machineName: 'Mixing Line 1',
                    orderId: orders[0]?.id || '',
                    plannedQty: '100',
                    actualQty: '98',
                    wastageQty: '2',
                    downtimeMinutes: '15',
                    downtimeReason: 'Nozzle calibration',
                    supervisorName: '',
                    notes: '',
                  });
                  setModalOpen('createDpr');
                }}
              >
                + Log Daily Production Report
              </button>
            </div>
          </div>

          {/* Recent Orders Overview */}
          <div className={styles.tableCard}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Recent Production Orders</h3>
              <button type="button" onClick={() => setActiveTab('orders')} style={{ fontSize: '0.76rem', color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 750 }}>
                View All Orders ➔
              </button>
            </div>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Product</th>
                    <th>Target Qty</th>
                    <th>Produced</th>
                    <th>Status</th>
                    <th>Scheduled</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 5).map((o) => (
                    <tr key={o.id}>
                      <td><strong>{o.orderNo}</strong></td>
                      <td>
                        <strong>{o.outputProduct?.name || o.outputProduct?.sku}</strong>
                        <small>{o.outputProduct?.sku}</small>
                      </td>
                      <td>{numberFmt(o.targetQuantity)} {o.uom}</td>
                      <td>{numberFmt(o.producedQuantity)} {o.uom}</td>
                      <td><StatusBadge value={o.status} /></td>
                      <td>{dateFmt(o.scheduledStart)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrder(o);
                            setModalOpen('orderDetails');
                          }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                        No production orders registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 2: BOM MASTER & FORMULA */}
      {/* ================================================================ */}
      {activeTab === 'boms' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Bill of Materials (BOM) &amp; Chemical Formulations</h3>
              <p>Strict 100.0000% formula validation, version immutability, and revision lineage tracking</p>
            </div>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                setBomForm({
                  bomCode: '',
                  bomName: '',
                  outputProductId: products[0]?.id || '',
                  batchSize: '100',
                  uom: 'KG',
                  overheadCost: '500',
                  laborCost: '300',
                  items: [
                    { productId: products[0]?.id || '', itemType: 'RAW_MATERIAL', percentage: '60.0000', scrapTolerancePct: '1.0' },
                    { productId: products[1]?.id || '', itemType: 'RAW_MATERIAL', percentage: '40.0000', scrapTolerancePct: '1.0' },
                  ],
                });
                setModalOpen('createBom');
              }}
            >
              + Create BOM Formula
            </button>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>BOM Code</th>
                    <th>Formula Name</th>
                    <th>Output Product</th>
                    <th>Version</th>
                    <th>Batch Size</th>
                    <th>Components</th>
                    <th>Std Cost</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {boms.map((b) => (
                    <tr key={b.id}>
                      <td><strong>{b.bomCode}</strong></td>
                      <td>{b.bomName}</td>
                      <td>
                        <strong>{b.outputProduct?.name}</strong>
                        <small>{b.outputProduct?.sku}</small>
                      </td>
                      <td>
                        <span style={{ fontWeight: 800, color: '#7c3aed' }}>v{b.version}</span>
                        {b.parentBom && <small>Parent: v{b.parentBom.version}</small>}
                      </td>
                      <td>{numberFmt(b.batchSize)} {b.uom}</td>
                      <td>{(b.items || []).length} items</td>
                      <td>{currencyFmt(b.standardCost)}</td>
                      <td>
                        <StatusBadge value={b.status} />
                        {b.isLocked && <span style={{ marginLeft: '4px', fontSize: '0.8rem' }} title="Version Permanently Locked">🔒</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className={styles.actions}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBom(b);
                              setModalOpen('viewBom');
                            }}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSimulateCosting(b.id, b.batchSize)}
                          >
                            Simulate
                          </button>
                          {b.status === 'DRAFT' && (
                            <button
                              type="button"
                              className={styles.primary}
                              onClick={() => handleSubmitBomApproval(b.id)}
                            >
                              Submit
                            </button>
                          )}
                          {b.status === 'PENDING_APPROVAL' && (
                            <button
                              type="button"
                              className={styles.successButton}
                              onClick={() => handleApproveBom(b.id)}
                            >
                              Approve
                            </button>
                          )}
                          {b.status === 'APPROVED' && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBom(b);
                                setBranchForm({ notes: `Revision branched from v${b.version}` });
                                setModalOpen('branchRevision');
                              }}
                            >
                              Branch Rev
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {boms.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                        <EmptyState
                          icon="🧪"
                          title="No BOM Formulas Configured"
                          description="Create your first Bill of Materials formula with exact 100.0000% component allocation."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 3: BOM COSTING & SIMULATION */}
      {/* ================================================================ */}
      {activeTab === 'costing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className={styles.sectionHeader}>
            <div>
              <h3>BOM Costing &amp; Batch Simulation Engine</h3>
              <p>Dynamic linear batch scaling, standard vs live cost variance, and component-wise scrap tolerances</p>
            </div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className={styles.formGroup} style={{ minWidth: '240px' }}>
              <label>Select BOM Formula</label>
              <select
                value={selectedBom?.id || ''}
                onChange={(e) => {
                  const b = boms.find((item) => item.id === e.target.value);
                  setSelectedBom(b);
                  if (b) handleSimulateCosting(b.id, costingBatchSize);
                }}
              >
                <option value="">-- Choose BOM --</option>
                {boms.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bomCode} v{b.version} — {b.outputProduct?.name} ({b.status})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup} style={{ width: '160px' }}>
              <label>Target Batch Size</label>
              <input
                type="number"
                step="any"
                min="0.1"
                value={costingBatchSize}
                onChange={(e) => setCostingBatchSize(e.target.value)}
              />
            </div>

            <button
              type="button"
              className={styles.primary}
              disabled={!selectedBom}
              onClick={() => {
                if (selectedBom) handleSimulateCosting(selectedBom.id, costingBatchSize);
              }}
            >
              Run Costing Simulation
            </button>
          </div>

          {costingSimulation && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <span>⚖️</span>
                  <div>
                    <strong>{costingSimulation.scaleFactor}x</strong>
                    <small>Scale Factor (vs Std {costingSimulation.standardBatchSize} KG)</small>
                  </div>
                </div>
                <div className={styles.stat}>
                  <span>📊</span>
                  <div>
                    <strong>{currencyFmt(costingSimulation.totalStandardCost)}</strong>
                    <small>Total Standard Cost</small>
                  </div>
                </div>
                <div className={styles.stat}>
                  <span>📈</span>
                  <div>
                    <strong>{currencyFmt(costingSimulation.totalLiveCost)}</strong>
                    <small>Total Live Market Cost</small>
                  </div>
                </div>
                <div className={styles.stat}>
                  <span>📉</span>
                  <div>
                    <strong style={{ color: costingSimulation.variance > 0 ? '#dc2626' : '#16a34a' }}>
                      {costingSimulation.variance > 0 ? `+${currencyFmt(costingSimulation.variance)}` : currencyFmt(costingSimulation.variance)}
                    </strong>
                    <small>Cost Variance ({costingSimulation.variancePct}%)</small>
                  </div>
                </div>
              </div>

              <div className={styles.tableCard}>
                <div style={{ padding: '0.85rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>
                  Scaled Component Breakdown for {costingSimulation.outputProduct?.name} ({costingSimulation.targetBatchSize} {costingSimulation.outputProduct?.uom || 'KG'})
                </div>
                <div className={styles.tableScroll}>
                  <table>
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Component Product</th>
                        <th>Formula %</th>
                        <th>Scaled Quantity</th>
                        <th>Std Unit Cost</th>
                        <th>Live Unit Cost</th>
                        <th>Total Std Cost</th>
                        <th>Total Live Cost</th>
                        <th>Scrap Tolerance</th>
                        <th>Est. Scrap Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costingSimulation.components?.map((c) => (
                        <tr key={c.productId}>
                          <td><strong>{c.sku}</strong></td>
                          <td>{c.name}</td>
                          <td><span style={{ fontWeight: 800 }}>{Number(c.percentage).toFixed(4)}%</span></td>
                          <td>{numberFmt(c.scaledQuantity)} {c.uom}</td>
                          <td>{currencyFmt(c.standardUnitCost)}</td>
                          <td>{currencyFmt(c.liveUnitCost)}</td>
                          <td>{currencyFmt(c.totalStandardCost)}</td>
                          <td>{currencyFmt(c.totalLiveCost)}</td>
                          <td>{c.scrapTolerancePct}%</td>
                          <td>{numberFmt(c.estimatedScrapQty)} {c.uom}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!costingSimulation && (
            <EmptyState
              icon="💰"
              title="No Costing Simulation Active"
              description="Select a BOM and enter a target batch quantity to run standard vs live costing analysis."
            />
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 4: PRODUCTION PLANNING */}
      {/* ================================================================ */}
      {activeTab === 'plans' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Master Production Planning</h3>
              <p>Schedule planned production runs linked to approved formulations and calculate required batch counts</p>
            </div>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                setPlanForm({
                  planNo: '',
                  planName: '',
                  outputProductId: products[0]?.id || '',
                  bomId: boms.find((b) => b.status === 'APPROVED')?.id || boms[0]?.id || '',
                  plannedQuantity: '200',
                  uom: 'KG',
                  priority: 'HIGH',
                  startDate: new Date().toISOString().split('T')[0],
                  targetDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                  notes: '',
                });
                setModalOpen('createPlan');
              }}
            >
              + Create Production Plan
            </button>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Plan No</th>
                    <th>Plan Name</th>
                    <th>Product</th>
                    <th>BOM Formula</th>
                    <th>Planned Qty</th>
                    <th>Batches</th>
                    <th>Priority</th>
                    <th>Schedule</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.planNo}</strong></td>
                      <td>{p.planName}</td>
                      <td>
                        <strong>{p.outputProduct?.name}</strong>
                        <small>{p.outputProduct?.sku}</small>
                      </td>
                      <td>{p.bom?.bomCode} v{p.bom?.version}</td>
                      <td>{numberFmt(p.plannedQuantity)} {p.uom}</td>
                      <td><strong>{p.plannedBatches}</strong> batches</td>
                      <td><StatusBadge value={p.priority} /></td>
                      <td>{dateFmt(p.startDate)} ➔ {dateFmt(p.targetDate)}</td>
                      <td><StatusBadge value={p.status} /></td>
                    </tr>
                  ))}
                  {plans.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                        <EmptyState
                          icon="🗓️"
                          title="No Production Plans Found"
                          description="Create a production plan linked to an approved BOM to begin scheduling manufacturing runs."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 5: PRODUCTION WORK ORDERS */}
      {/* ================================================================ */}
      {activeTab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Production Work Orders</h3>
              <p>Work releases, exploded material requirements, progress tracking, and shopfloor execution lifecycle</p>
            </div>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                setOrderForm({
                  orderNo: '',
                  planId: plans[0]?.id || '',
                  outputProductId: products[0]?.id || '',
                  bomId: boms.find((b) => b.status === 'APPROVED')?.id || boms[0]?.id || '',
                  targetQuantity: '100',
                  uom: 'KG',
                  priority: 'MEDIUM',
                  scheduledStart: new Date().toISOString().split('T')[0],
                  scheduledEnd: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                  notes: '',
                });
                setModalOpen('createOrder');
              }}
            >
              + Create Work Order
            </button>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Finished Product</th>
                    <th>Formula</th>
                    <th>Target Qty</th>
                    <th>Produced</th>
                    <th>Status</th>
                    <th>Scheduled</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td><strong>{o.orderNo}</strong></td>
                      <td>
                        <strong>{o.outputProduct?.name}</strong>
                        <small>{o.outputProduct?.sku}</small>
                      </td>
                      <td>{o.bom?.bomCode} v{o.bom?.version}</td>
                      <td>{numberFmt(o.targetQuantity)} {o.uom}</td>
                      <td>{numberFmt(o.producedQuantity)} {o.uom}</td>
                      <td><StatusBadge value={o.status} /></td>
                      <td>{dateFmt(o.scheduledStart)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className={styles.actions}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrder(o);
                              setModalOpen('orderDetails');
                            }}
                          >
                            Requirements ({o.materialReqs?.length || 0})
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCheckMaterials(o.id)}
                          >
                            Check RM Stock
                          </button>
                          {o.status === 'DRAFT' && (
                            <button
                              type="button"
                              className={styles.primary}
                              onClick={() => handleUpdateOrderStatus(o.id, 'APPROVED')}
                            >
                              Approve
                            </button>
                          )}
                          {o.status === 'APPROVED' && (
                            <button
                              type="button"
                              className={styles.warningButton}
                              onClick={() => handleUpdateOrderStatus(o.id, 'IN_PROGRESS')}
                            >
                              Start
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                        <EmptyState
                          icon="📋"
                          title="No Work Orders Registered"
                          description="Create a work order to automatically explode required raw materials from the approved BOM."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 6: RAW MATERIAL REQUIREMENTS & FIFO ISSUE */}
      {/* ================================================================ */}
      {activeTab === 'material_issue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Raw Material Requirements &amp; FIFO WIP Allocation</h3>
              <p>Strict FIFO issue from AVAILABLE bucket to WIP bucket and shopfloor return reconciliation</p>
            </div>
            <div className={styles.quickActions}>
              <button
                type="button"
                className={styles.primary}
                onClick={() => {
                  setIssueForm({ orderId: materialCheck?.orderId || orders[0]?.id || '', batchId: '' });
                  setModalOpen('issueMaterial');
                }}
              >
                + Issue Materials (FIFO ➔ WIP)
              </button>
              <button
                type="button"
                onClick={() => {
                  setReturnForm({ orderId: materialCheck?.orderId || orders[0]?.id || '', rmBatchId: '', quantity: '', reason: '' });
                  setModalOpen('returnMaterial');
                }}
              >
                ↩️ Return Unused RM (WIP ➔ Available)
              </button>
            </div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 750 }}>Evaluate Order:</label>
            <select
              style={{ padding: '.45rem .75rem', borderRadius: '7px', border: '1px solid #cbd5e1' }}
              value={materialCheck?.orderId || ''}
              onChange={(e) => {
                if (e.target.value) handleCheckMaterials(e.target.value);
              }}
            >
              <option value="">-- Select Work Order --</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNo} — {o.outputProduct?.name} ({o.status})
                </option>
              ))}
            </select>
          </div>

          {materialCheck && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {materialCheck.hasShortage ? (
                <div className={styles.alertDanger}>
                  <span>🚨</span>
                  <span>
                    <strong>Material Shortage Detected:</strong> One or more components do not have sufficient available FIFO lots to issue full requirement.
                  </span>
                </div>
              ) : (
                <div className={styles.alertSuccess}>
                  <span>✅</span>
                  <span>
                    <strong>All Materials Available:</strong> 100% of required raw materials and packaging components are available in active FIFO inventory lots.
                  </span>
                </div>
              )}

              <div className={styles.tableCard}>
                <div style={{ padding: '0.85rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>
                  Material Availability Breakdown for Order {materialCheck.orderNo}
                </div>
                <div className={styles.tableScroll}>
                  <table>
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Component Product</th>
                        <th>Required Qty</th>
                        <th>Issued to WIP</th>
                        <th>Remaining Needed</th>
                        <th>Available in Stock</th>
                        <th>Shortage Qty</th>
                        <th>Availability Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materialCheck.components?.map((c) => (
                        <tr key={c.requirementId}>
                          <td><strong>{c.sku}</strong></td>
                          <td>{c.name}</td>
                          <td>{numberFmt(c.requiredQty)} {c.uom}</td>
                          <td>{numberFmt(c.issuedQty)} {c.uom}</td>
                          <td>{numberFmt(c.remainingNeeded)} {c.uom}</td>
                          <td><strong>{numberFmt(c.availableInStock)}</strong> {c.uom}</td>
                          <td>
                            {c.shortageQty > 0 ? (
                              <span style={{ color: '#dc2626', fontWeight: 800 }}>-{numberFmt(c.shortageQty)} {c.uom}</span>
                            ) : (
                              '0'
                            )}
                          </td>
                          <td>
                            {c.isAvailable ? (
                              <span className={`${styles.badge} ${styles.success}`}>AVAILABLE</span>
                            ) : (
                              <span className={`${styles.badge} ${styles.danger}`}>SHORTAGE</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!materialCheck && (
            <EmptyState
              icon="📦"
              title="Select an Order to Check Material Availability"
              description="Review real-time component availability against warehouse stock before dispatching materials to shopfloor WIP."
            />
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 7: MANUFACTURING BATCH MANAGEMENT */}
      {/* ================================================================ */}
      {activeTab === 'batches' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Manufacturing Batches</h3>
              <p>Physical production runs, machinery allocation, shift supervision, and finished lot generation</p>
            </div>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                setBatchForm({
                  orderId: orders[0]?.id || '',
                  batchNo: '',
                  batchQuantity: '100',
                  machineName: 'Mixing Line 1',
                  shift: 'Shift A',
                  supervisorName: '',
                  mfgDate: new Date().toISOString().split('T')[0],
                  expDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
                });
                setModalOpen('createBatch');
              }}
            >
              + Create Manufacturing Batch
            </button>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Batch No</th>
                    <th>Work Order</th>
                    <th>Product</th>
                    <th>Batch Qty</th>
                    <th>Actual Output</th>
                    <th>Machine / Shift</th>
                    <th>Supervisor</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id}>
                      <td><strong>{b.batchNo}</strong></td>
                      <td>{b.orderNo || b.order?.orderNo}</td>
                      <td>
                        <strong>{b.outputProduct?.name}</strong>
                        <small>{b.outputProduct?.sku}</small>
                      </td>
                      <td>{numberFmt(b.batchQuantity)} {b.uom}</td>
                      <td>{numberFmt(b.actualOutputQty)} {b.uom}</td>
                      <td>{b.machineName} ({b.shift})</td>
                      <td>{b.supervisorName || '—'}</td>
                      <td><StatusBadge value={b.status} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <div className={styles.actions}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBatch(b);
                              setActiveTab('stages');
                            }}
                          >
                            Stages (7)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLoadGenealogy(b.id)}
                          >
                            Genealogy
                          </button>
                          {b.status === 'QC_PENDING' && (
                            <button
                              type="button"
                              className={styles.primary}
                              onClick={() => {
                                setQcForm({
                                  batchId: b.id,
                                  testedQty: String(b.batchQuantity || 100),
                                  passedQty: String(b.batchQuantity || 100),
                                  rejectedQty: '0',
                                  status: 'PASSED',
                                  remarks: 'Meets release criteria',
                                  parameters: [
                                    { name: 'pH Value', spec: '6.5 - 7.5', result: '6.8', passed: true },
                                    { name: 'Viscosity (cP)', spec: '120 - 150', result: '135', passed: true },
                                    { name: 'Microbial Count', spec: '< 100 cfu/g', result: '< 10', passed: true },
                                  ],
                                });
                                setModalOpen('createQc');
                              }}
                            >
                              QC Inspect
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {batches.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                        <EmptyState
                          icon="🏭"
                          title="No Batches Created Yet"
                          description="Create a manufacturing batch linked to an active work order to initialize mixing stages."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 8: MIXING SEQUENCE & PROCESS TRACKING */}
      {/* ================================================================ */}
      {activeTab === 'stages' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Mixing Sequence &amp; Stage Gates</h3>
              <p>Strict sequential advancement across 7 stages. Step N is blocked until Step N-1 is verified and completed.</p>
            </div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 750 }}>Select Batch:</label>
            <select
              style={{ padding: '.45rem .75rem', borderRadius: '7px', border: '1px solid #cbd5e1' }}
              value={selectedBatch?.id || ''}
              onChange={async (e) => {
                const b = batches.find((item) => item.id === e.target.value);
                if (b) {
                  const gene = await api.get(`/companies/${companyId}/production/batches/${b.id}/genealogy`).catch(() => null);
                  setSelectedBatch({
                    ...b,
                    steps: gene?.data?.processStages || b.steps || DEFAULT_STAGES,
                  });
                }
              }}
            >
              <option value="">-- Choose Manufacturing Batch --</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batchNo} — {b.outputProduct?.name} ({b.status})
                </option>
              ))}
            </select>
          </div>

          {selectedBatch ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '0.75rem 1rem', background: '#faf5ff', borderRadius: '10px', border: '1px solid #e9d5ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, color: '#5b21b6' }}>
                    Batch: <strong>{selectedBatch.batchNo}</strong> ({selectedBatch.outputProduct?.name})
                  </h4>
                  <small style={{ color: '#7c3aed' }}>Current Batch Status: <StatusBadge value={selectedBatch.status} /></small>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => handleLoadGenealogy(selectedBatch.id)}
                    style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #c084fc', background: '#fff', color: '#6b21a8', fontWeight: 750, cursor: 'pointer' }}
                  >
                    View Batch Genealogy ➔
                  </button>
                </div>
              </div>

              <div className={styles.stepper}>
                {(selectedBatch.steps || DEFAULT_STAGES).map((step, idx, arr) => {
                  const isCompleted = step.status === 'COMPLETED';
                  const prevStep = idx > 0 ? arr[idx - 1] : null;
                  const canComplete = !isCompleted && (!prevStep || prevStep.status === 'COMPLETED');
                  const isLocked = !isCompleted && prevStep && prevStep.status !== 'COMPLETED';

                  let cardClass = styles.stageCard;
                  if (isCompleted) cardClass += ` ${styles.stageCompleted}`;
                  else if (canComplete) cardClass += ` ${styles.stageActive}`;
                  else if (isLocked) cardClass += ` ${styles.stageLocked}`;

                  let numClass = styles.stageNum;
                  if (isCompleted) numClass += ` ${styles.numCompleted}`;
                  else if (canComplete) numClass += ` ${styles.numActive}`;
                  else numClass += ` ${styles.numPending}`;

                  return (
                    <div key={step.stepNumber} className={cardClass}>
                      <div className={styles.stageLeft}>
                        <div className={numClass}>
                          {isCompleted ? '✓' : step.stepNumber}
                        </div>
                        <div className={styles.stageInfo}>
                          <h4>
                            Step {step.stepNumber}: {step.stageName}
                          </h4>
                          <p>
                            Target Duration: {step.targetDuration} mins | Target Temp: {step.targetTempC}°C
                            {step.actualDuration && ` | Actual: ${step.actualDuration} mins`}
                            {step.actualTempC && ` | Temp: ${step.actualTempC}°C`}
                            {step.operatorName && ` | Operator: ${step.operatorName}`}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <StatusBadge value={step.status} />
                        {canComplete && (
                          <button
                            type="button"
                            className={styles.primary}
                            onClick={() => {
                              setStepCompleteForm({
                                batchId: selectedBatch.id,
                                stepNumber: step.stepNumber,
                                actualDuration: String(step.targetDuration),
                                actualTempC: String(step.targetTempC),
                                operatorName: '',
                                notes: `Completed Step ${step.stepNumber} in full conformity`,
                              });
                              setModalOpen('stepComplete');
                            }}
                          >
                            Verify &amp; Complete Stage
                          </button>
                        )}
                        {isLocked && (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                            🔒 Awaiting Step {step.stepNumber - 1} Completion
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyState
              icon="⚙️"
              title="No Batch Selected"
              description="Choose a manufacturing batch above to view and complete its sequential mixing stages."
            />
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 9: DAILY PRODUCTION REPORT (DPR) */}
      {/* ================================================================ */}
      {activeTab === 'dpr' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Daily Production Reports (DPR)</h3>
              <p>Shift-wise production outputs, machine downtime tracking, and automated efficiency percentage calculation</p>
            </div>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                setDprForm({
                  dprDate: new Date().toISOString().split('T')[0],
                  shift: 'Shift A',
                  machineName: 'Mixing Line 1',
                  orderId: orders[0]?.id || '',
                  plannedQty: '100',
                  actualQty: '98',
                  wastageQty: '2',
                  downtimeMinutes: '0',
                  downtimeReason: '',
                  supervisorName: '',
                  notes: '',
                });
                setModalOpen('createDpr');
              }}
            >
              + Log Daily Production Report
            </button>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>DPR No</th>
                    <th>Date</th>
                    <th>Shift</th>
                    <th>Machine</th>
                    <th>Work Order</th>
                    <th>Planned Qty</th>
                    <th>Actual Output</th>
                    <th>Wastage</th>
                    <th>Downtime</th>
                    <th>Efficiency %</th>
                  </tr>
                </thead>
                <tbody>
                  {dprs.map((d) => (
                    <tr key={d.id}>
                      <td><strong>{d.dprNo}</strong></td>
                      <td>{dateFmt(d.dprDate)}</td>
                      <td>{d.shift}</td>
                      <td>{d.machineName}</td>
                      <td>{d.order?.orderNo || '—'}</td>
                      <td>{numberFmt(d.plannedQty)}</td>
                      <td><strong>{numberFmt(d.actualQty)}</strong></td>
                      <td>{numberFmt(d.wastageQty)}</td>
                      <td>
                        {d.downtimeMinutes > 0 ? (
                          <span style={{ color: '#d97706', fontWeight: 750 }}>
                            {d.downtimeMinutes}m ({d.downtimeReason || 'Unspecified'})
                          </span>
                        ) : (
                          '0m'
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 850,
                            color: Number(d.efficiencyPct) >= 95 ? '#16a34a' : Number(d.efficiencyPct) >= 80 ? '#d97706' : '#dc2626',
                          }}
                        >
                          {Number(d.efficiencyPct).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {dprs.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '2rem' }}>
                        <EmptyState
                          icon="📝"
                          title="No Daily Production Reports Logged"
                          description="Log shift-wise DPR outputs to maintain manufacturing yield and machine uptime analytics."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 10: MANUFACTURING QUALITY CONTROL */}
      {/* ================================================================ */}
      {activeTab === 'qc' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Manufacturing Quality Control (QC) &amp; Finished Goods Gate</h3>
              <p>Strict quality enforcement: Finished goods stock receipt is blocked until a PASSED QC inspection exists</p>
            </div>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                setQcForm({
                  batchId: batches[0]?.id || '',
                  testedQty: '100',
                  passedQty: '100',
                  rejectedQty: '0',
                  status: 'PASSED',
                  remarks: 'Meets release criteria',
                  parameters: [
                    { name: 'pH Value', spec: '6.5 - 7.5', result: '6.8', passed: true },
                    { name: 'Viscosity (cP)', spec: '120 - 150', result: '135', passed: true },
                    { name: 'Appearance', spec: 'Homogeneous Clear', result: 'Clear', passed: true },
                  ],
                });
                setModalOpen('createQc');
              }}
            >
              + Record QC Inspection
            </button>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>QC No</th>
                    <th>Batch No</th>
                    <th>Product</th>
                    <th>Tested Qty</th>
                    <th>Passed Qty</th>
                    <th>Rejected Qty</th>
                    <th>QC Status</th>
                    <th>Disposition</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {qcInspections.map((q) => (
                    <tr key={q.id}>
                      <td><strong>{q.qcNo}</strong></td>
                      <td><strong>{q.batch?.batchNo || '—'}</strong></td>
                      <td>{q.product?.name || q.product?.sku}</td>
                      <td>{numberFmt(q.testedQty)}</td>
                      <td>{numberFmt(q.passedQty)}</td>
                      <td>{numberFmt(q.rejectedQty)}</td>
                      <td><StatusBadge value={q.status} /></td>
                      <td><StatusBadge value={q.disposition} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <div className={styles.actions}>
                          {q.status === 'PASSED' && q.batch?.status !== 'COMPLETED' && (
                            <button
                              type="button"
                              className={styles.successButton}
                              onClick={() => {
                                setFgReceiptForm({
                                  batchId: q.batchId,
                                  warehouse: 'Main Warehouse',
                                  actualOutputQty: String(q.passedQty),
                                  notes: `FG Receipt from passed QC ${q.qcNo}`,
                                });
                                setModalOpen('receiveFg');
                              }}
                            >
                              Receive FG ➔
                            </button>
                          )}
                          {q.status !== 'PASSED' && (
                            <span style={{ fontSize: '0.72rem', color: '#dc2626', fontStyle: 'italic' }}>
                              Receipt Blocked (QC Not Passed)
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {qcInspections.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                        <EmptyState
                          icon="🔬"
                          title="No QC Inspections Recorded"
                          description="Record laboratory and physical parameter inspections to authorize finished goods receipt."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 11: FINISHED GOODS & BATCH TRACEABILITY */}
      {/* ================================================================ */}
      {activeTab === 'traceability' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Two-Way Batch Traceability &amp; Genealogy</h3>
              <p>Bi-directional traceability: Backward from Finished Goods to Raw Materials, and Forward from Raw Materials to Finished Goods</p>
            </div>
            <div className={styles.quickActions}>
              <button
                type="button"
                className={traceMode === 'BACKWARD' ? styles.primary : ''}
                onClick={() => setTraceMode('BACKWARD')}
              >
                Backward (FG ➔ RM Lots)
              </button>
              <button
                type="button"
                className={traceMode === 'FORWARD' ? styles.primary : ''}
                onClick={() => setTraceMode('FORWARD')}
              >
                Forward (RM Lot ➔ FG Batches)
              </button>
            </div>
          </div>

          {/* Search Bar for Traceability */}
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 750 }}>
              {traceMode === 'BACKWARD' ? 'Select FG Batch:' : 'Enter RM Batch / Lot ID:'}
            </label>
            {traceMode === 'BACKWARD' ? (
              <select
                style={{ padding: '.5rem .8rem', borderRadius: '8px', border: '1px solid #cbd5e1', minWidth: '300px' }}
                value={genealogyData?.batchDetails?.id || ''}
                onChange={(e) => {
                  if (e.target.value) handleLoadGenealogy(e.target.value);
                }}
              >
                <option value="">-- Choose Finished Goods Batch --</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchNo} — {b.outputProduct?.name} ({b.status})
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                <input
                  type="text"
                  placeholder="Enter RM batch ID or Lot No..."
                  style={{ padding: '.5rem .8rem', borderRadius: '8px', border: '1px solid #cbd5e1', flex: 1 }}
                  value={traceSearchTerm}
                  onChange={(e) => setTraceSearchTerm(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => handleForwardTrace(traceSearchTerm)}
                >
                  Trace Forward
                </button>
              </div>
            )}
          </div>

          {/* Backward Traceability Results */}
          {traceMode === 'BACKWARD' && genealogyData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className={styles.genealogyGrid}>
                <div className={styles.genealogyCard}>
                  <h4>Finished Goods Batch Details</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <div><strong>Batch No:</strong> {genealogyData.batchDetails?.batchNo}</div>
                    <div><strong>Status:</strong> <StatusBadge value={genealogyData.batchDetails?.status} /></div>
                    <div><strong>Product:</strong> {genealogyData.batchDetails?.outputProduct?.name}</div>
                    <div><strong>SKU:</strong> {genealogyData.batchDetails?.outputProduct?.sku}</div>
                    <div><strong>Batch Qty:</strong> {numberFmt(genealogyData.batchDetails?.batchQuantity)} KG</div>
                    <div><strong>Actual Output:</strong> {numberFmt(genealogyData.batchDetails?.actualOutputQty)} KG</div>
                    <div><strong>Mfg Date:</strong> {dateFmt(genealogyData.batchDetails?.mfgDate)}</div>
                    <div><strong>Machine / Shift:</strong> {genealogyData.batchDetails?.machineName} ({genealogyData.batchDetails?.shift})</div>
                  </div>
                </div>

                <div className={styles.genealogyCard}>
                  <h4>Process Stage Verification Timestamps</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.76rem' }}>
                    {(genealogyData.processStages || []).map((s) => (
                      <div key={s.stepNumber} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '3px' }}>
                        <span>Step {s.stepNumber}: {s.stageName}</span>
                        <span><StatusBadge value={s.status} /> {s.verifiedAt ? dateTimeFmt(s.verifiedAt) : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Consumed Raw Materials Table */}
              <div className={styles.tableCard}>
                <div style={{ padding: '0.85rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>
                  Consumed Raw Material Batches (Backward Genealogy Trace)
                </div>
                <div className={styles.tableScroll}>
                  <table>
                    <thead>
                      <tr>
                        <th>RM SKU</th>
                        <th>Raw Material Name</th>
                        <th>RM Lot No</th>
                        <th>Vendor / Supplier</th>
                        <th>GRN Ref</th>
                        <th>Issued Qty</th>
                        <th>Unit Cost</th>
                        <th>Inward Movement No</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(genealogyData.consumedRawMaterials || genealogyData.rawMaterials || []).map((m) => (
                        <tr key={m.materialGenealogyId}>
                          <td><strong>{m.sku}</strong></td>
                          <td>{m.name}</td>
                          <td><span style={{ fontWeight: 800, color: '#7c3aed' }}>{m.rmBatchNo}</span></td>
                          <td>{m.vendorName}</td>
                          <td>{m.vendorGrnNo}</td>
                          <td>{numberFmt(m.issuedQty)} {m.uom}</td>
                          <td>{currencyFmt(m.unitCost)}</td>
                          <td>{m.movementNo || '—'}</td>
                        </tr>
                      ))}
                      {(genealogyData.consumedRawMaterials || []).length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem' }}>
                            No raw materials linked to this batch yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Forward Traceability Results */}
          {traceMode === 'FORWARD' && forwardTraceData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className={styles.tableCard}>
                <div style={{ padding: '0.85rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>
                  Finished Batches Consuming Raw Material Lot (Found {forwardTraceData.totalUsagesCount || 0} batches)
                </div>
                <div className={styles.tableScroll}>
                  <table>
                    <thead>
                      <tr>
                        <th>FG Batch No</th>
                        <th>Work Order</th>
                        <th>Output Product</th>
                        <th>Quantity Used</th>
                        <th>Batch Status</th>
                        <th>Mfg Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(forwardTraceData.affectedBatches || forwardTraceData.manufacturingBatches || []).map((b) => (
                        <tr key={b.mfgBatchId}>
                          <td><strong>{b.mfgBatchNo}</strong></td>
                          <td>{b.orderNo}</td>
                          <td>
                            <strong>{b.outputProductName}</strong>
                            <small>{b.outputProductSku}</small>
                          </td>
                          <td>{numberFmt(b.quantityUsed)} {b.uom}</td>
                          <td><StatusBadge value={b.status} /></td>
                          <td>{dateFmt(b.mfgDate)}</td>
                        </tr>
                      ))}
                      {(forwardTraceData.affectedBatches || []).length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                            No manufacturing batches have consumed this raw material lot.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!genealogyData && traceMode === 'BACKWARD' && (
            <EmptyState
              icon="🔗"
              title="Select a Batch to Trace Genealogy"
              description="Review backward material lineage from finished goods lot down to individual supplier GRNs and inventory movements."
            />
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 12: INTERNAL REPROCESSING */}
      {/* ================================================================ */}
      {activeTab === 'reprocessing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Internal Reprocessing &amp; Off-Spec Rework</h3>
              <p>Root cause investigation, corrective action recipes, approval workflows, and post-reprocessing QC clearance</p>
            </div>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                setReprocessForm({
                  originalBatchId: batches[0]?.id || '',
                  reason: 'Off-spec viscosity or pH deviation',
                  rootCause: 'Agitator speed variation during mixing step 4',
                  reworkPlan: 'Blend with corrective formulation and re-homogenize for 45 minutes',
                  quantity: '50',
                });
                setModalOpen('createReprocessing');
              }}
            >
              + Create Reprocessing Ticket
            </button>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Ticket No</th>
                    <th>Original Batch</th>
                    <th>Product</th>
                    <th>Reason / Defect</th>
                    <th>Rework Plan</th>
                    <th>Quantity</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reprocessings.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.reprocessNo}</strong></td>
                      <td><strong>{r.originalBatch?.batchNo}</strong></td>
                      <td>{r.originalBatch?.outputProduct?.name || r.originalBatch?.outputProduct?.sku}</td>
                      <td>
                        <strong>{r.reason}</strong>
                        {r.rootCause && <small>Cause: {r.rootCause}</small>}
                      </td>
                      <td><small>{r.reworkPlan}</small></td>
                      <td>{numberFmt(r.quantity)} KG</td>
                      <td><StatusBadge value={r.status} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <div className={styles.actions}>
                          {r.status === 'PENDING_APPROVAL' && (
                            <button
                              type="button"
                              className={styles.primary}
                              onClick={() => {
                                setReprocessQcForm({
                                  reprocessId: r.id,
                                  status: 'PASSED',
                                  remarks: 'Post-reprocessing parameters retested and fully conforming.',
                                });
                                setModalOpen('reprocessingQc');
                              }}
                            >
                              Post-Rework QC
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {reprocessings.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                        <EmptyState
                          icon="♻️"
                          title="No Active Reprocessing Tickets"
                          description="Log internal rework orders for off-spec or non-conforming batches to maintain GMP quality traceability."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* MODALS */}
      {/* ================================================================ */}

      {/* Modal: Create BOM Formula */}
      <Modal
        isOpen={modalOpen === 'createBom'}
        onClose={() => setModalOpen(null)}
        title="Create New Bill of Materials (BOM) Formula"
      >
        <form onSubmit={handleCreateBom} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>BOM Code (Optional, auto-generated)</label>
              <input
                type="text"
                placeholder="e.g. BOM-ELIXIR-001"
                value={bomForm.bomCode}
                onChange={(e) => setBomForm({ ...bomForm, bomCode: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Formula Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Premium Elixir Standard Formula"
                value={bomForm.bomName}
                onChange={(e) => setBomForm({ ...bomForm, bomName: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Finished Output Product *</label>
              <select
                required
                value={bomForm.outputProductId}
                onChange={(e) => setBomForm({ ...bomForm, outputProductId: e.target.value })}
              >
                <option value="">-- Select Output Product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) [{p.category}]
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Standard Batch Size *</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  required
                  value={bomForm.batchSize}
                  onChange={(e) => setBomForm({ ...bomForm, batchSize: e.target.value })}
                />
                <select
                  style={{ width: '90px' }}
                  value={bomForm.uom}
                  onChange={(e) => setBomForm({ ...bomForm, uom: e.target.value })}
                >
                  <option value="KG">KG</option>
                  <option value="LTR">LTR</option>
                  <option value="PCS">PCS</option>
                  <option value="NOS">NOS</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 800 }}>Formula Components &amp; Percentages</label>
              <button
                type="button"
                className={styles.addLine}
                onClick={() => {
                  setBomForm({
                    ...bomForm,
                    items: [
                      ...bomForm.items,
                      { productId: products[0]?.id || '', itemType: 'RAW_MATERIAL', percentage: '0.0000', scrapTolerancePct: '0.5' },
                    ],
                  });
                }}
              >
                + Add Component
              </button>
            </div>

            <table className={styles.formulaTable}>
              <thead>
                <tr>
                  <th>Component Product</th>
                  <th>Item Type</th>
                  <th style={{ width: '130px' }}>Percentage (%)</th>
                  <th style={{ width: '110px' }}>Scrap Tol (%)</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {bomForm.items.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <select
                        style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        value={item.productId}
                        onChange={(e) => {
                          const newItems = [...bomForm.items];
                          newItems[idx].productId = e.target.value;
                          setBomForm({ ...bomForm, items: newItems });
                        }}
                      >
                        <option value="">-- Choose RM / PKG --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        value={item.itemType}
                        onChange={(e) => {
                          const newItems = [...bomForm.items];
                          newItems[idx].itemType = e.target.value;
                          setBomForm({ ...bomForm, items: newItems });
                        }}
                      >
                        <option value="RAW_MATERIAL">RAW_MATERIAL</option>
                        <option value="PACKAGING">PACKAGING</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        max="100.0000"
                        style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        value={item.percentage}
                        onChange={(e) => {
                          const newItems = [...bomForm.items];
                          newItems[idx].percentage = e.target.value;
                          setBomForm({ ...bomForm, items: newItems });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        value={item.scrapTolerancePct}
                        onChange={(e) => {
                          const newItems = [...bomForm.items];
                          newItems[idx].scrapTolerancePct = e.target.value;
                          setBomForm({ ...bomForm, items: newItems });
                        }}
                      />
                    </td>
                    <td>
                      {bomForm.items.length > 1 && (
                        <button
                          type="button"
                          style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}
                          onClick={() => {
                            const newItems = bomForm.items.filter((_, i) => i !== idx);
                            setBomForm({ ...bomForm, items: newItems });
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 100.0000% Validation Meter */}
            <div
              className={styles.formulaMeter}
              style={{
                background: isFormulaValid100 ? '#f0fdf4' : '#fef2f2',
                color: isFormulaValid100 ? '#166534' : '#991b1b',
                border: isFormulaValid100 ? '1px solid #bbf7d0' : '1px solid #fecaca',
              }}
            >
              <span>Total Formula Percentage:</span>
              <span>
                {formulaTotalPercentage.toFixed(4)}% {isFormulaValid100 ? '✅ EXACT 100.0000%' : '❌ MUST EQUAL 100.0000%'}
              </span>
            </div>
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModalOpen(null)}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={loading || !isFormulaValid100}>
              {loading ? 'Validating...' : 'Save BOM (Draft)'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: View BOM Details */}
      <Modal
        isOpen={modalOpen === 'viewBom'}
        onClose={() => setModalOpen(null)}
        title={selectedBom ? `BOM Formula: ${selectedBom.bomCode} v${selectedBom.version}` : 'BOM Details'}
      >
        {selectedBom && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
              <div><strong>BOM Code:</strong> {selectedBom.bomCode}</div>
              <div><strong>Version:</strong> v{selectedBom.version} {selectedBom.isLocked && '🔒 (Locked)'}</div>
              <div><strong>Status:</strong> <StatusBadge value={selectedBom.status} /></div>
              <div><strong>Output Finished Good:</strong> {selectedBom.outputProduct?.name}</div>
              <div><strong>Standard Batch Size:</strong> {numberFmt(selectedBom.batchSize)} {selectedBom.uom}</div>
              <div><strong>Estimated Standard Cost:</strong> {currencyFmt(selectedBom.standardCost)}</div>
            </div>

            <h4 style={{ margin: '0.5rem 0 0', fontWeight: 800 }}>Component Formulations</h4>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Type</th>
                    <th>Percentage (%)</th>
                    <th>Qty per Batch</th>
                    <th>Scrap Tol (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedBom.items || []).map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.product?.name || item.productId}</strong></td>
                      <td>{item.itemType}</td>
                      <td><strong>{Number(item.percentage).toFixed(4)}%</strong></td>
                      <td>{numberFmt(item.quantityPerBatch)} {item.uom}</td>
                      <td>{item.scrapTolerancePct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.formActions}>
              <button type="button" onClick={() => setModalOpen(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Branch Revision */}
      <Modal
        isOpen={modalOpen === 'branchRevision'}
        onClose={() => setModalOpen(null)}
        title={selectedBom ? `Branch New Revision from ${selectedBom.bomCode} v${selectedBom.version}` : 'Branch Revision'}
      >
        <form onSubmit={handleBranchRevision} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
            This will create a new unlocked <strong>DRAFT</strong> revision with an incremented revision number, preserving the approved parent formula and all components for editing.
          </p>
          <div className={styles.formGroup}>
            <label>Revision Reason / Notes *</label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Formula optimization to adjust active solvent ratio..."
              value={branchForm.notes}
              onChange={(e) => setBranchForm({ ...branchForm, notes: e.target.value })}
            />
          </div>
          <div className={styles.formActions}>
            <button type="button" onClick={() => setModalOpen(null)}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={loading}>
              {loading ? 'Branching...' : 'Create New Revision'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Create Production Plan */}
      <Modal
        isOpen={modalOpen === 'createPlan'}
        onClose={() => setModalOpen(null)}
        title="Create Master Production Plan"
      >
        <form onSubmit={handleCreatePlan} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Plan Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Q4 Elixir Production Schedule"
                value={planForm.planName}
                onChange={(e) => setPlanForm({ ...planForm, planName: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Plan No (Optional)</label>
              <input
                type="text"
                placeholder="e.g. PP-2026-001"
                value={planForm.planNo}
                onChange={(e) => setPlanForm({ ...planForm, planNo: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Finished Output Product *</label>
              <select
                required
                value={planForm.outputProductId}
                onChange={(e) => setPlanForm({ ...planForm, outputProductId: e.target.value })}
              >
                <option value="">-- Choose Product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Approved BOM Formula *</label>
              <select
                required
                value={planForm.bomId}
                onChange={(e) => setPlanForm({ ...planForm, bomId: e.target.value })}
              >
                <option value="">-- Choose BOM --</option>
                {boms.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bomCode} v{b.version} ({b.status})
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Planned Target Quantity *</label>
              <input
                type="number"
                step="any"
                min="1"
                required
                value={planForm.plannedQuantity}
                onChange={(e) => setPlanForm({ ...planForm, plannedQuantity: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Priority</label>
              <select
                value={planForm.priority}
                onChange={(e) => setPlanForm({ ...planForm, priority: e.target.value })}
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Scheduled Start Date</label>
              <input
                type="date"
                value={planForm.startDate}
                onChange={(e) => setPlanForm({ ...planForm, startDate: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Target Completion Date</label>
              <input
                type="date"
                value={planForm.targetDate}
                onChange={(e) => setPlanForm({ ...planForm, targetDate: e.target.value })}
              />
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" onClick={() => setModalOpen(null)}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={loading}>
              {loading ? 'Scheduling...' : 'Create Plan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Create Production Work Order */}
      <Modal
        isOpen={modalOpen === 'createOrder'}
        onClose={() => setModalOpen(null)}
        title="Create Production Work Order"
      >
        <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Production Plan (Optional)</label>
              <select
                value={orderForm.planId}
                onChange={(e) => {
                  const plan = plans.find((p) => p.id === e.target.value);
                  setOrderForm({
                    ...orderForm,
                    planId: e.target.value,
                    outputProductId: plan ? plan.outputProductId : orderForm.outputProductId,
                    bomId: plan ? plan.bomId : orderForm.bomId,
                    targetQuantity: plan ? String(plan.plannedQuantity) : orderForm.targetQuantity,
                  });
                }}
              >
                <option value="">-- Standalone Work Order --</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.planNo} — {p.planName}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Order No (Optional, auto-generated)</label>
              <input
                type="text"
                placeholder="e.g. WO-2026-001"
                value={orderForm.orderNo}
                onChange={(e) => setOrderForm({ ...orderForm, orderNo: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Finished Output Product *</label>
              <select
                required
                value={orderForm.outputProductId}
                onChange={(e) => setOrderForm({ ...orderForm, outputProductId: e.target.value })}
              >
                <option value="">-- Choose Product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
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
                <option value="">-- Choose BOM --</option>
                {boms.map((b) => (
                  <option key={b.id} value={b.id}>{b.bomCode} v{b.version} ({b.status})</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Target Production Quantity *</label>
              <input
                type="number"
                step="any"
                min="1"
                required
                value={orderForm.targetQuantity}
                onChange={(e) => setOrderForm({ ...orderForm, targetQuantity: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Priority</label>
              <select
                value={orderForm.priority}
                onChange={(e) => setOrderForm({ ...orderForm, priority: e.target.value })}
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" onClick={() => setModalOpen(null)}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={loading}>
              {loading ? 'Creating...' : 'Create Order & Explode Requirements'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Order Requirements Details */}
      <Modal
        isOpen={modalOpen === 'orderDetails'}
        onClose={() => setModalOpen(null)}
        title={selectedOrder ? `Work Order: ${selectedOrder.orderNo} Requirements` : 'Order Details'}
      >
        {selectedOrder && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
              <div><strong>Order No:</strong> {selectedOrder.orderNo}</div>
              <div><strong>Status:</strong> <StatusBadge value={selectedOrder.status} /></div>
              <div><strong>Product:</strong> {selectedOrder.outputProduct?.name} ({selectedOrder.outputProduct?.sku})</div>
              <div><strong>BOM:</strong> {selectedOrder.bom?.bomCode} v{selectedOrder.bom?.version}</div>
              <div><strong>Target Quantity:</strong> {numberFmt(selectedOrder.targetQuantity)} {selectedOrder.uom}</div>
              <div><strong>Produced So Far:</strong> {numberFmt(selectedOrder.producedQuantity)} {selectedOrder.uom}</div>
            </div>

            <h4 style={{ margin: '0.5rem 0 0', fontWeight: 800 }}>Exploded Material Requirements</h4>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Component SKU</th>
                    <th>Product Name</th>
                    <th>Required Qty</th>
                    <th>Issued to WIP</th>
                    <th>Consumed</th>
                    <th>Returned</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedOrder.materialReqs || []).map((req) => (
                    <tr key={req.id}>
                      <td><strong>{req.product?.sku || req.productId}</strong></td>
                      <td>{req.product?.name}</td>
                      <td><strong>{numberFmt(req.requiredQty)} {req.uom}</strong></td>
                      <td>{numberFmt(req.issuedQty)} {req.uom}</td>
                      <td>{numberFmt(req.consumedQty)} {req.uom}</td>
                      <td>{numberFmt(req.returnedQty)} {req.uom}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.formActions}>
              <button type="button" onClick={() => setModalOpen(null)}>Close</button>
              <button
                type="button"
                className={styles.primary}
                onClick={() => {
                  setModalOpen(null);
                  handleCheckMaterials(selectedOrder.id);
                }}
              >
                Check Stock &amp; Issue FIFO ➔
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: FIFO Issue Materials to WIP */}
      <Modal
        isOpen={modalOpen === 'issueMaterial'}
        onClose={() => setModalOpen(null)}
        title="Issue Raw Materials to Shopfloor WIP (Strict FIFO)"
      >
        <form onSubmit={handleIssueMaterialsFIFO} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
            Executes strict FIFO inventory deduction: stock is moved from <strong>AVAILABLE</strong> to <strong>WIP</strong> and relational batch genealogy is recorded.
          </p>

          <div className={styles.formGroup}>
            <label>Select Production Order *</label>
            <select
              required
              value={issueForm.orderId}
              onChange={(e) => setIssueForm({ ...issueForm, orderId: e.target.value })}
            >
              <option value="">-- Choose Order --</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNo} — {o.outputProduct?.name} ({o.status})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Manufacturing Batch (Optional, links direct genealogy)</label>
            <select
              value={issueForm.batchId}
              onChange={(e) => setIssueForm({ ...issueForm, batchId: e.target.value })}
            >
              <option value="">-- Auto-link on batch creation --</option>
              {batches
                .filter((b) => !issueForm.orderId || b.orderId === issueForm.orderId)
                .map((b) => (
                  <option key={b.id} value={b.id}>{b.batchNo} ({b.status})</option>
                ))}
            </select>
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModalOpen(null)}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={loading || !issueForm.orderId}>
              {loading ? 'Allocating FIFO...' : 'Confirm FIFO Issue to WIP'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Return Unused Material from WIP to Available */}
      <Modal
        isOpen={modalOpen === 'returnMaterial'}
        onClose={() => setModalOpen(null)}
        title="Return Unused Shopfloor Material (WIP ➔ Available)"
      >
        <form onSubmit={handleReturnMaterial} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={styles.formGroup}>
            <label>Raw Material Batch ID *</label>
            <input
              type="text"
              required
              placeholder="e.g. UUID of raw material lot"
              value={returnForm.rmBatchId}
              onChange={(e) => setReturnForm({ ...returnForm, rmBatchId: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Quantity to Return to Available *</label>
            <input
              type="number"
              step="any"
              min="0.0001"
              required
              placeholder="Quantity"
              value={returnForm.quantity}
              onChange={(e) => setReturnForm({ ...returnForm, quantity: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Return Reason</label>
            <input
              type="text"
              placeholder="e.g. Excess dispensing returned after batch completion"
              value={returnForm.reason}
              onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
            />
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModalOpen(null)}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={loading}>
              {loading ? 'Reconciling...' : 'Confirm Return to Available'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Create Manufacturing Batch */}
      <Modal
        isOpen={modalOpen === 'createBatch'}
        onClose={() => setModalOpen(null)}
        title="Initialize Manufacturing Batch (7 Sequential Stages)"
      >
        <form onSubmit={handleCreateBatch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Production Order *</label>
              <select
                required
                value={batchForm.orderId}
                onChange={(e) => {
                  const o = orders.find((item) => item.id === e.target.value);
                  setBatchForm({
                    ...batchForm,
                    orderId: e.target.value,
                    batchQuantity: o ? String(o.targetQuantity) : batchForm.batchQuantity,
                  });
                }}
              >
                <option value="">-- Choose Order --</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNo} — {o.outputProduct?.name} ({o.status})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Batch No (Optional, auto-generated)</label>
              <input
                type="text"
                placeholder="e.g. MFG-2026-B01"
                value={batchForm.batchNo}
                onChange={(e) => setBatchForm({ ...batchForm, batchNo: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Batch Quantity *</label>
              <input
                type="number"
                step="any"
                min="0.1"
                required
                value={batchForm.batchQuantity}
                onChange={(e) => setBatchForm({ ...batchForm, batchQuantity: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Machine / Vessel Name</label>
              <input
                type="text"
                value={batchForm.machineName}
                onChange={(e) => setBatchForm({ ...batchForm, machineName: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Shift</label>
              <select
                value={batchForm.shift}
                onChange={(e) => setBatchForm({ ...batchForm, shift: e.target.value })}
              >
                <option value="Shift A">Shift A (Morning)</option>
                <option value="Shift B">Shift B (Evening)</option>
                <option value="Shift C">Shift C (Night)</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Supervisor Name</label>
              <input
                type="text"
                placeholder="Supervisor Name"
                value={batchForm.supervisorName}
                onChange={(e) => setBatchForm({ ...batchForm, supervisorName: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModalOpen(null)}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={loading}>
              {loading ? 'Initializing...' : 'Create Batch & Initialize Stages'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Complete Process Step */}
      <Modal
        isOpen={modalOpen === 'stepComplete'}
        onClose={() => setModalOpen(null)}
        title={`Verify & Complete Stage ${stepCompleteForm.stepNumber}`}
      >
        <form onSubmit={handleCompleteProcessStep} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Actual Duration (Minutes)</label>
              <input
                type="number"
                min="1"
                value={stepCompleteForm.actualDuration}
                onChange={(e) => setStepCompleteForm({ ...stepCompleteForm, actualDuration: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Actual Recorded Temperature (°C)</label>
              <input
                type="number"
                step="0.1"
                value={stepCompleteForm.actualTempC}
                onChange={(e) => setStepCompleteForm({ ...stepCompleteForm, actualTempC: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Shift Operator Name</label>
              <input
                type="text"
                placeholder="Operator Name"
                value={stepCompleteForm.operatorName}
                onChange={(e) => setStepCompleteForm({ ...stepCompleteForm, operatorName: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Process Notes / Deviations</label>
            <textarea
              rows={2}
              value={stepCompleteForm.notes}
              onChange={(e) => setStepCompleteForm({ ...stepCompleteForm, notes: e.target.value })}
            />
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModalOpen(null)}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={loading}>
              {loading ? 'Verifying...' : 'Sign Off Stage Completion'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Create DPR */}
      <Modal
        isOpen={modalOpen === 'createDpr'}
        onClose={() => setModalOpen(null)}
        title="Record Daily Production Report (DPR)"
      >
        <form onSubmit={handleCreateDpr} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Report Date *</label>
              <input
                type="date"
                required
                value={dprForm.dprDate}
                onChange={(e) => setDprForm({ ...dprForm, dprDate: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Shift</label>
              <select
                value={dprForm.shift}
                onChange={(e) => setDprForm({ ...dprForm, shift: e.target.value })}
              >
                <option value="Shift A">Shift A (Morning)</option>
                <option value="Shift B">Shift B (Evening)</option>
                <option value="Shift C">Shift C (Night)</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Production Order</label>
              <select
                value={dprForm.orderId}
                onChange={(e) => setDprForm({ ...dprForm, orderId: e.target.value })}
              >
                <option value="">-- Choose Order --</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>{o.orderNo} — {o.outputProduct?.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Machine Line</label>
              <input
                type="text"
                value={dprForm.machineName}
                onChange={(e) => setDprForm({ ...dprForm, machineName: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Planned Output (KG) *</label>
              <input
                type="number"
                step="any"
                min="0.1"
                required
                value={dprForm.plannedQty}
                onChange={(e) => setDprForm({ ...dprForm, plannedQty: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Actual Output (KG) *</label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={dprForm.actualQty}
                onChange={(e) => setDprForm({ ...dprForm, actualQty: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Wastage / Scrap (KG)</label>
              <input
                type="number"
                step="any"
                min="0"
                value={dprForm.wastageQty}
                onChange={(e) => setDprForm({ ...dprForm, wastageQty: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Downtime (Minutes)</label>
              <input
                type="number"
                min="0"
                value={dprForm.downtimeMinutes}
                onChange={(e) => setDprForm({ ...dprForm, downtimeMinutes: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Downtime Reason (if applicable)</label>
            <input
              type="text"
              placeholder="e.g. Pump seal maintenance, line changeover"
              value={dprForm.downtimeReason}
              onChange={(e) => setDprForm({ ...dprForm, downtimeReason: e.target.value })}
            />
          </div>

          {/* Efficiency Preview Meter */}
          <div className={styles.alertInfo}>
            <span>⚡</span>
            <span>
              Calculated Production Efficiency:{' '}
              <strong>
                {Number(dprForm.plannedQty) > 0
                  ? ((Number(dprForm.actualQty) / Number(dprForm.plannedQty)) * 100).toFixed(1)
                  : 0}
                %
              </strong>
            </span>
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModalOpen(null)}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={loading}>
              {loading ? 'Submitting...' : 'Save DPR Log'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Create QC Inspection */}
      <Modal
        isOpen={modalOpen === 'createQc'}
        onClose={() => setModalOpen(null)}
        title="Record Manufacturing Quality Inspection"
      >
        <form onSubmit={handleCreateQcInspection} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Manufacturing Batch *</label>
              <select
                required
                value={qcForm.batchId}
                onChange={(e) => setQcForm({ ...qcForm, batchId: e.target.value })}
              >
                <option value="">-- Choose Batch --</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.batchNo} — {b.outputProduct?.name} ({b.status})</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Tested Quantity *</label>
              <input
                type="number"
                step="any"
                min="0.1"
                required
                value={qcForm.testedQty}
                onChange={(e) => setQcForm({ ...qcForm, testedQty: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Passed Quantity</label>
              <input
                type="number"
                step="any"
                min="0"
                value={qcForm.passedQty}
                onChange={(e) => setQcForm({ ...qcForm, passedQty: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Overall QC Disposition *</label>
              <select
                value={qcForm.status}
                onChange={(e) => setQcForm({ ...qcForm, status: e.target.value })}
              >
                <option value="PASSED">PASSED (Release to Finished Goods)</option>
                <option value="QUALITY_HOLD">QUALITY_HOLD (Quarantine for Investigation)</option>
                <option value="FAILED">FAILED (Reject for Reprocessing / Scrap)</option>
              </select>
            </div>
          </div>

          <h4 style={{ margin: '0.5rem 0 0', fontWeight: 800 }}>Laboratory Inspection Parameters</h4>
          <div className={styles.tableScroll}>
            <table>
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Specification Range</th>
                  <th>Observed Result</th>
                  <th>Conforming?</th>
                </tr>
              </thead>
              <tbody>
                {qcForm.parameters.map((param, pIdx) => (
                  <tr key={pIdx}>
                    <td><strong>{param.name}</strong></td>
                    <td>{param.spec}</td>
                    <td>
                      <input
                        type="text"
                        style={{ padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', width: '120px' }}
                        value={param.result}
                        onChange={(e) => {
                          const newParams = [...qcForm.parameters];
                          newParams[pIdx].result = e.target.value;
                          setQcForm({ ...qcForm, parameters: newParams });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={param.passed}
                        onChange={(e) => {
                          const newParams = [...qcForm.parameters];
                          newParams[pIdx].passed = e.target.checked;
                          setQcForm({ ...qcForm, parameters: newParams });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.formGroup}>
            <label>Inspection Remarks / Certification</label>
            <textarea
              rows={2}
              value={qcForm.remarks}
              onChange={(e) => setQcForm({ ...qcForm, remarks: e.target.value })}
            />
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModalOpen(null)}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={loading}>
              {loading ? 'Submitting...' : 'Sign Off QC Inspection'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Receive Finished Goods (QC Gate Enforced) */}
      <Modal
        isOpen={modalOpen === 'receiveFg'}
        onClose={() => setModalOpen(null)}
        title="Receive Finished Goods into Available Inventory"
      >
        <form onSubmit={handleReceiveFinishedGoods} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={styles.alertSuccess}>
            <span>🔒</span>
            <span>
              <strong>QC Gate Verified:</strong> Batch quality inspection has PASSED. Finished Goods stock will be credited to the <strong>AVAILABLE</strong> inventory bucket.
            </span>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Destination Warehouse *</label>
              <input
                type="text"
                required
                value={fgReceiptForm.warehouse}
                onChange={(e) => setFgReceiptForm({ ...fgReceiptForm, warehouse: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Received Output Quantity (KG) *</label>
              <input
                type="number"
                step="any"
                min="0.1"
                required
                value={fgReceiptForm.actualOutputQty}
                onChange={(e) => setFgReceiptForm({ ...fgReceiptForm, actualOutputQty: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Receipt Notes</label>
            <input
              type="text"
              value={fgReceiptForm.notes}
              onChange={(e) => setFgReceiptForm({ ...fgReceiptForm, notes: e.target.value })}
            />
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModalOpen(null)}>Cancel</button>
            <button type="submit" className={styles.successButton} disabled={loading}>
              {loading ? 'Inwarding...' : 'Credit Stock to Available Bucket'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Create Reprocessing Ticket */}
      <Modal
        isOpen={modalOpen === 'createReprocessing'}
        onClose={() => setModalOpen(null)}
        title="Create Internal Reprocessing / Rework Ticket"
      >
        <form onSubmit={handleCreateReprocessing} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={styles.formGroup}>
            <label>Off-Spec / Rejected Batch *</label>
            <select
              required
              value={reprocessForm.originalBatchId}
              onChange={(e) => setReprocessForm({ ...reprocessForm, originalBatchId: e.target.value })}
            >
              <option value="">-- Choose Non-conforming Batch --</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.batchNo} — {b.outputProduct?.name} ({b.status})</option>
              ))}
            </select>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Non-conformance Reason *</label>
              <input
                type="text"
                required
                placeholder="e.g. Viscosity out of specification"
                value={reprocessForm.reason}
                onChange={(e) => setReprocessForm({ ...reprocessForm, reason: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Root Cause</label>
              <input
                type="text"
                placeholder="e.g. Over-heating during step 3"
                value={reprocessForm.rootCause}
                onChange={(e) => setReprocessForm({ ...reprocessForm, rootCause: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Corrective Action / Rework Recipe Instructions *</label>
            <textarea
              required
              rows={3}
              placeholder="Detailed reformulation steps and chemical additions required..."
              value={reprocessForm.reworkPlan}
              onChange={(e) => setReprocessForm({ ...reprocessForm, reworkPlan: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Quantity to Rework (KG) *</label>
            <input
              type="number"
              step="any"
              min="0.1"
              required
              value={reprocessForm.quantity}
              onChange={(e) => setReprocessForm({ ...reprocessForm, quantity: e.target.value })}
            />
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModalOpen(null)}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Rework Ticket for Approval'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Post-Reprocessing QC Clearance */}
      <Modal
        isOpen={modalOpen === 'reprocessingQc'}
        onClose={() => setModalOpen(null)}
        title="Post-Reprocessing Quality Clearance"
      >
        <form onSubmit={handleCompleteReprocessingQc} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={styles.formGroup}>
            <label>Post-Rework QC Disposition *</label>
            <select
              value={reprocessQcForm.status}
              onChange={(e) => setReprocessQcForm({ ...reprocessQcForm, status: e.target.value })}
            >
              <option value="PASSED">PASSED (Batch Conforming, Release to Available)</option>
              <option value="REJECTED">REJECTED (Condemn to Scrap)</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>QC Remarks / Laboratory Verification *</label>
            <textarea
              required
              rows={3}
              value={reprocessQcForm.remarks}
              onChange={(e) => setReprocessQcForm({ ...reprocessQcForm, remarks: e.target.value })}
            />
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModalOpen(null)}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={loading}>
              {loading ? 'Verifying...' : 'Sign Off Rework QC'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

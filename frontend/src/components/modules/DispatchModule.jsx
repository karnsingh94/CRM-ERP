'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import styles from './DispatchModule.module.css';

// Subcomponents for the 9 Tabs
import DispatchDashboardTab from './dispatch/DispatchDashboardTab';
import DispatchPlanningTab from './dispatch/DispatchPlanningTab';
import DispatchAllocationsTab from './dispatch/DispatchAllocationsTab';
import DispatchPackingTab from './dispatch/DispatchPackingTab';
import DispatchChallansTab from './dispatch/DispatchChallansTab';
import DispatchTrackingTab from './dispatch/DispatchTrackingTab';
import CustomerReturnsTab from './dispatch/CustomerReturnsTab';
import ReturnQcInspectionTab from './dispatch/ReturnQcInspectionTab';
import CustomerCreditNotesTab from './dispatch/CustomerCreditNotesTab';

const TABS = [
  { id: 'dashboard', label: '1. Dashboard', badgeKey: null },
  { id: 'planning', label: '2. Sales Orders & Planning', badgeKey: 'pendingOrders' },
  { id: 'allocations', label: '3. FIFO Batch Allocation', badgeKey: null },
  { id: 'packing', label: '4. Packing & Cartons', badgeKey: null },
  { id: 'challans', label: '5. Delivery Challans & Dispatch', badgeKey: 'readyToDispatch' },
  { id: 'tracking', label: '6. Tracking & POD', badgeKey: 'inTransit' },
  { id: 'returns', label: '7. Customer Returns (RMA)', badgeKey: 'pendingRma' },
  { id: 'qc', label: '8. Returned Goods QC', badgeKey: 'awaitingQc' },
  { id: 'creditNotes', label: '9. Credit Notes & Ledger', badgeKey: 'pendingCredit' },
];

export default function DispatchModule({ activeCompany, showToast }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);

  // Data states
  const [dispatchMetrics, setDispatchMetrics] = useState(null);
  const [returnsMetrics, setReturnsMetrics] = useState(null);
  const [creditMetrics, setCreditMetrics] = useState(null);
  const [eligibleOrders, setEligibleOrders] = useState([]);
  const [dispatchOrders, setDispatchOrders] = useState([]);
  const [customerReturns, setCustomerReturns] = useState([]);
  const [eligibleDispatches, setEligibleDispatches] = useState([]);
  const [creditNotes, setCreditNotes] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const companyId = activeCompany?.id || activeCompany?._id;

  const toast = useCallback((msg, type = 'success') => {
    if (typeof showToast === 'function') {
      showToast(msg, type);
    } else {
      console.log(`[Toast ${type}]: ${msg}`);
    }
  }, [showToast]);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);

      const [
        dspDashboardRes,
        retDashboardRes,
        crDashboardRes,
        eligibleOrdersRes,
        dispatchOrdersRes,
        returnsRes,
        eligibleDispatchesRes,
        creditNotesRes,
        warehousesRes,
      ] = await Promise.all([
        api.get(`/companies/${companyId}/dispatch/dashboard`).catch(() => ({ data: null })),
        api.get(`/companies/${companyId}/returns/dashboard`).catch(() => ({ data: null })),
        api.get(`/companies/${companyId}/credit-notes/dashboard`).catch(() => ({ data: null })),
        api.get(`/companies/${companyId}/dispatch/eligible-orders`).catch(() => ({ data: [] })),
        api.get(`/companies/${companyId}/dispatch/orders`).catch(() => ({ data: [] })),
        api.get(`/companies/${companyId}/returns`).catch(() => ({ data: [] })),
        api.get(`/companies/${companyId}/returns/eligible-dispatches`).catch(() => ({ data: [] })),
        api.get(`/companies/${companyId}/credit-notes`).catch(() => ({ data: [] })),
        api.get(`/companies/${companyId}/inventory/warehouses`).catch(() => ({ data: [] })),
      ]);

      setDispatchMetrics(dspDashboardRes?.data || null);
      setReturnsMetrics(retDashboardRes?.data || null);
      setCreditMetrics(crDashboardRes?.data || null);
      setEligibleOrders(eligibleOrdersRes?.data || []);
      setDispatchOrders(dispatchOrdersRes?.data || []);
      setCustomerReturns(returnsRes?.data || []);
      setEligibleDispatches(eligibleDispatchesRes?.data || []);
      setCreditNotes(creditNotesRes?.data || []);

      const whList = warehousesRes?.data || [];
      setWarehouses(Array.isArray(whList) ? whList : whList.warehouses || []);
    } catch (err) {
      console.error('Error loading Dispatch module data:', err);
      toast(err.message || 'Failed to load dispatch data', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tab Badge counts
  const badgeCounts = {
    pendingOrders: eligibleOrders.length || null,
    readyToDispatch: dispatchOrders.filter((d) => d.status === 'READY_FOR_DISPATCH').length || null,
    inTransit: dispatchOrders.filter((d) => ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(d.status)).length || null,
    pendingRma: customerReturns.filter((r) => ['REQUESTED', 'PENDING_APPROVAL'].includes(r.status)).length || null,
    awaitingQc: customerReturns.filter((r) => r.status === 'GOODS_RECEIVED').length || null,
    pendingCredit: creditNotes.filter((c) => c.status === 'DRAFT').length || null,
  };

  // Dispatch Handlers
  const handleCreateDispatch = async (payload) => {
    const res = await api.post(`/companies/${companyId}/dispatch/orders`, payload);
    toast(`Dispatch Order ${res?.data?.dispatchNo || ''} created successfully!`);
    await loadData();
    setActiveTab('challans');
    return res.data;
  };

  const handleRunFIFOAllocation = async (orderId) => {
    const res = await api.post(`/companies/${companyId}/dispatch/orders/${orderId}/allocate`, {});
    toast(`FIFO batch allocation executed for ${res?.data?.dispatchNo || ''}!`);
    await loadData();
    return res.data;
  };

  const handleCreatePackage = async (orderId, pkgData) => {
    const res = await api.post(`/companies/${companyId}/dispatch/orders/${orderId}/packages`, pkgData);
    toast(`Package ${res?.data?.packageCode || ''} added successfully!`);
    await loadData();
    return res.data;
  };

  const handleFetchPackingList = async (orderId) => {
    const res = await api.get(`/companies/${companyId}/dispatch/orders/${orderId}/packing-list`);
    return res.data;
  };

  const handleFetchDeliveryChallan = async (orderId) => {
    const res = await api.get(`/companies/${companyId}/dispatch/orders/${orderId}/delivery-challan`);
    return res.data;
  };

  const handleGenerateGatePass = async (orderId) => {
    const res = await api.post(`/companies/${companyId}/dispatch/orders/${orderId}/gate-pass`, {});
    toast(`Outward Gate Pass ${res?.data?.gatePassNo || ''} generated!`);
    await loadData();
    return res.data;
  };

  const handleExecuteDispatch = async (orderId) => {
    const res = await api.post(`/companies/${companyId}/dispatch/orders/${orderId}/dispatch`, {});
    toast(`Order ${res?.data?.dispatchNo || ''} dispatched & inventory deducted!`);
    await loadData();
    return res.data;
  };

  const handleCancelDispatch = async (orderId, reason) => {
    const res = await api.post(`/companies/${companyId}/dispatch/orders/${orderId}/cancel`, { reason });
    toast(`Dispatch order cancelled.`);
    await loadData();
    return res.data;
  };

  // Tracking Handlers
  const handleFetchTrackingHistory = async (orderId) => {
    const res = await api.get(`/companies/${companyId}/dispatch/orders/${orderId}/tracking`);
    return res.data;
  };

  const handleAddTrackingEvent = async (orderId, data) => {
    const res = await api.post(`/companies/${companyId}/dispatch/orders/${orderId}/tracking`, data);
    toast(`Milestone logged: ${data.status}`);
    await loadData();
    return res.data;
  };

  const handleRecordPOD = async (orderId, podData) => {
    const res = await api.post(`/companies/${companyId}/dispatch/orders/${orderId}/pod`, podData);
    toast(`Proof of Delivery (POD) confirmed!`);
    await loadData();
    return res.data;
  };

  const handleRecordFailedDelivery = async (orderId, failData) => {
    const res = await api.post(`/companies/${companyId}/dispatch/orders/${orderId}/failed`, failData);
    toast(`Delivery delay/failure recorded.`, 'warning');
    await loadData();
    return res.data;
  };

  // Return & RMA Handlers
  const handleCreateReturn = async (payload) => {
    const res = await api.post(`/companies/${companyId}/returns`, payload);
    toast(`RMA ${res?.data?.rmaNo || ''} created successfully!`);
    await loadData();
    return res.data;
  };

  const handleSubmitReturnApproval = async (returnId) => {
    const res = await api.post(`/companies/${companyId}/returns/${returnId}/submit-approval`, {});
    toast(`RMA submitted for approval!`);
    await loadData();
    return res.data;
  };

  const handleApproveReturn = async (returnId) => {
    const res = await api.post(`/companies/${companyId}/returns/${returnId}/approve`, {});
    toast(`RMA approved! Authorized for physical inward receiving.`);
    await loadData();
    return res.data;
  };

  const handleRejectReturn = async (returnId, reason) => {
    const res = await api.post(`/companies/${companyId}/returns/${returnId}/reject`, { reason });
    toast(`RMA rejected.`, 'warning');
    await loadData();
    return res.data;
  };

  const handleReceiveGoods = async (returnId, data) => {
    const res = await api.post(`/companies/${companyId}/returns/${returnId}/receive`, data);
    toast(`Goods received into quarantine (RETURN_HOLD)! Ready for QC.`);
    await loadData();
    return res.data;
  };

  const handleInspectReturn = async (returnId, inspectionData) => {
    const res = await api.post(`/companies/${companyId}/returns/${returnId}/inspect`, inspectionData);
    toast(`QC inspection completed and stock routed to target buckets!`);
    await loadData();
    return res.data;
  };

  // Credit Note Handlers
  const handleCreateCreditNote = async (payload) => {
    const res = await api.post(`/companies/${companyId}/credit-notes`, payload);
    toast(`Credit Note ${res?.data?.creditNoteNo || ''} issued in DRAFT status!`);
    await loadData();
    return res.data;
  };

  const handleApproveCreditNote = async (creditNoteId) => {
    const res = await api.post(`/companies/${companyId}/credit-notes/${creditNoteId}/approve`, {});
    toast(`Credit Note approved!`);
    await loadData();
    return res.data;
  };

  const handleApplyCreditNote = async (creditNoteId, data) => {
    const res = await api.post(`/companies/${companyId}/credit-notes/${creditNoteId}/apply`, data);
    toast(`Credit Note settled and applied to customer balance!`);
    await loadData();
    return res.data;
  };

  return (
    <div className={styles.module}>
      {/* Workspace Header */}
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Phase 7 Logistics &bull; Shree Nath Exports</span>
          <h2>Dispatch Operations &amp; Customer Returns</h2>
          <p>
            Sales order fulfillment, multi-batch FIFO allocations, packing manifests, delivery challans, shipment tracking &amp; POD, RMA quarantine &amp; QC, and customer credit notes.
          </p>
        </div>

        <button onClick={loadData} disabled={loading} title="Reload all metrics and queues">
          {loading ? 'Refreshing...' : '↻ Refresh Data'}
        </button>
      </div>

      {/* Operational Flow Banner */}
      <div className={styles.flow}>
        <span>1. Sales Order Queue</span> <b>→</b>
        <span>2. FIFO Allocation</span> <b>→</b>
        <span>3. Packing &amp; Cartonization</span> <b>→</b>
        <span>4. Delivery Challan &amp; Gate Pass</span> <b>→</b>
        <span>5. Dispatch &amp; Tracking (POD)</span> <b>→</b>
        <span>6. RMA Quarantine (RETURN_HOLD)</span> <b>→</b>
        <span>7. QC Disposition Sorting</span> <b>→</b>
        <span>8. Credit Note GST Reversal</span>
      </div>

      {/* 9 Functional Workspace Tabs */}
      <div className={styles.tabs}>
        {TABS.map((tab) => {
          const badgeCount = tab.badgeKey ? badgeCounts[tab.badgeKey] : null;
          return (
            <button
              key={tab.id}
              className={activeTab === tab.id ? styles.active : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {badgeCount ? <span className={styles.tabBadge}>{badgeCount}</span> : null}
            </button>
          );
        })}
      </div>

      {/* Active Tab View */}
      {activeTab === 'dashboard' && (
        <DispatchDashboardTab
          dispatchMetrics={dispatchMetrics}
          returnsMetrics={returnsMetrics}
          creditMetrics={creditMetrics}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === 'planning' && (
        <DispatchPlanningTab
          eligibleOrders={eligibleOrders}
          warehouses={warehouses}
          loading={loading}
          onCreateDispatch={handleCreateDispatch}
          onRefresh={loadData}
        />
      )}

      {activeTab === 'allocations' && (
        <DispatchAllocationsTab
          dispatchOrders={dispatchOrders}
          loading={loading}
          onRunFIFOAllocation={handleRunFIFOAllocation}
          onRefresh={loadData}
        />
      )}

      {activeTab === 'packing' && (
        <DispatchPackingTab
          dispatchOrders={dispatchOrders}
          loading={loading}
          onCreatePackage={handleCreatePackage}
          onFetchPackingList={handleFetchPackingList}
          onRefresh={loadData}
        />
      )}

      {activeTab === 'challans' && (
        <DispatchChallansTab
          dispatchOrders={dispatchOrders}
          loading={loading}
          onFetchDeliveryChallan={handleFetchDeliveryChallan}
          onGenerateGatePass={handleGenerateGatePass}
          onExecuteDispatch={handleExecuteDispatch}
          onCancelDispatch={handleCancelDispatch}
          onRefresh={loadData}
        />
      )}

      {activeTab === 'tracking' && (
        <DispatchTrackingTab
          dispatchOrders={dispatchOrders}
          loading={loading}
          onFetchTrackingHistory={handleFetchTrackingHistory}
          onAddTrackingEvent={handleAddTrackingEvent}
          onRecordPOD={handleRecordPOD}
          onRecordFailedDelivery={handleRecordFailedDelivery}
          onRefresh={loadData}
        />
      )}

      {activeTab === 'returns' && (
        <CustomerReturnsTab
          customerReturns={customerReturns}
          eligibleDispatches={eligibleDispatches}
          warehouses={warehouses}
          loading={loading}
          onCreateReturn={handleCreateReturn}
          onSubmitApproval={handleSubmitReturnApproval}
          onApproveReturn={handleApproveReturn}
          onRejectReturn={handleRejectReturn}
          onReceiveGoods={handleReceiveGoods}
          onRefresh={loadData}
        />
      )}

      {activeTab === 'qc' && (
        <ReturnQcInspectionTab
          customerReturns={customerReturns}
          warehouses={warehouses}
          loading={loading}
          onInspectReturn={handleInspectReturn}
          onRefresh={loadData}
        />
      )}

      {activeTab === 'creditNotes' && (
        <CustomerCreditNotesTab
          creditNotes={creditNotes}
          customerReturns={customerReturns}
          creditDashboard={creditMetrics}
          loading={loading}
          onCreateCreditNote={handleCreateCreditNote}
          onApproveCreditNote={handleApproveCreditNote}
          onApplyCreditNote={handleApplyCreditNote}
          onRefresh={loadData}
        />
      )}
    </div>
  );
}

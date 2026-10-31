'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import ServiceDepartments from '../departments/ServiceDepartments';
import styles from './PurchaseModule.module.css';

const TAB_ALIASES = {
  vendor: 'vendors',
  procurement: 'requests',
  grn: 'receipts',
  inspection: 'receipts',
  deviation: 'deviations',
};

const EMPTY_VENDOR = {
  vendorCode: '',
  name: '',
  legalName: '',
  pan: '',
  contact: '',
  email: '',
  phone: '',
  mobile: '',
  category: 'Raw Materials',
  taxId: '',
  address: '',
  registeredAddress: '',
  billingAddress: '',
  city: '',
  state: '',
  pincode: '',
  paymentTerms: '30 Days',
  creditPeriodDays: '30',
  leadTimeDays: '7',
  accountNumber: '',
  ifsc: '',
  bankName: '',
};

const EMPTY_REQUEST = {
  department: '',
  requestedBy: '',
  requiredBy: '',
  purpose: '',
  priority: 'MEDIUM',
  notes: '',
};

const EMPTY_QUOTE = {
  requestId: '',
  vendorId: '',
  vendorQuoteNo: '',
  validUntil: '',
  deliveryDays: '7',
  paymentTerms: '30 Days',
  taxAmount: '0',
  freightAmount: '0',
  loadingCharges: '0',
  unloadingCharges: '0',
  handlingCharges: '0',
  otherCharges: '0',
  transporterResponsibility: 'BUYER',
  notes: '',
};

const EMPTY_ORDER = {
  expectedDate: '',
  deliveryAddress: '',
  paymentTerms: '',
  transporterResponsibility: 'BUYER',
  loadingUnloadingCharges: '0',
  handlingCharges: '0',
  specialInstructions: '',
  terms: '',
};

const EMPTY_RECEIPT = {
  warehouse: 'Main Warehouse',
  vehicleNo: '',
  deliveryChallanNo: '',
  carrierName: '',
  inspectionRemarks: '',
  notes: '',
};

const EMPTY_BILL = {
  vendorInvoiceNo: '',
  invoiceDate: '',
  dueDate: '',
  taxableAmount: '',
  taxAmount: '',
  otherCharges: '',
  notes: '',
};

const EMPTY_ARTWORK = {
  orderId: '',
  title: 'PO Artwork Proof',
  buyerArtworkUrl: '',
  supplierProofUrl: '',
  comments: '',
};

const newRequestItem = () => ({ sku: '', name: '', qty: '', uom: 'PCS', specification: '' });

function number(value) {
  return Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function date(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}

function Status({ value }) {
  const status = String(value || 'PENDING').replaceAll('_', ' ');
  const success = ['ACTIVE', 'APPROVED', 'SELECTED', 'RECEIVED', 'PASSED', 'RETURNED', 'PAID', 'PO CREATED', 'RESOLVED'].includes(status);
  const danger = ['REJECTED', 'QC REJECTED', 'CANCELLED', 'PAYMENT HOLD'].includes(status);
  const warning = ['PENDING APPROVAL', 'PENDING REVIEW', 'PENDING QUOTATION', 'PARTIALLY RECEIVED', 'PARTIAL', 'PENDING DISPATCH', 'UNPAID', 'OPEN'].includes(status);
  return (
    <span className={`${styles.badge} ${success ? styles.successTone : danger ? styles.dangerTone : warning ? styles.warningTone : ''}`}>
      {status}
    </span>
  );
}

function Table({ children }) {
  return (
    <div className={styles.tableCard}>
      <div className={styles.tableScroll}>{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function PurchaseModule({ activeCompany, showToast, initialSubTab }) {
  const [activeTab, setActiveTab] = useState(TAB_ALIASES[initialSubTab] || initialSubTab || 'overview');
  const [dashboard, setDashboard] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [requests, setRequests] = useState([]);
  const [inventoryShortages, setInventoryShortages] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [orders, setOrders] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [deviations, setDeviations] = useState([]);
  const [artworkProofs, setArtworkProofs] = useState([]);
  const [returns, setReturns] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState(null);

  // Forms
  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR);
  const [requestForm, setRequestForm] = useState(EMPTY_REQUEST);
  const [requestItems, setRequestItems] = useState([newRequestItem()]);
  const [quoteForm, setQuoteForm] = useState(EMPTY_QUOTE);
  const [quoteItems, setQuoteItems] = useState([]);
  const [orderForm, setOrderForm] = useState(EMPTY_ORDER);
  const [receiptForm, setReceiptForm] = useState(EMPTY_RECEIPT);
  const [receiptItems, setReceiptItems] = useState([]);
  const [billForm, setBillForm] = useState(EMPTY_BILL);
  const [artworkForm, setArtworkForm] = useState(EMPTY_ARTWORK);

  // Modals specific state
  const [rejectReason, setRejectReason] = useState('');
  const [nonLowestJustification, setNonLowestJustification] = useState('');
  const [holdReleaseReason, setHoldReleaseReason] = useState('');
  const [deviationResolution, setDeviationResolution] = useState('');

  useEffect(() => {
    setActiveTab(TAB_ALIASES[initialSubTab] || initialSubTab || 'overview');
  }, [initialSubTab]);

  const companyPath = activeCompany?.id ? `/companies/${activeCompany.id}/purchase` : '';

  const loadAll = useCallback(async () => {
    if (!companyPath) return;
    setLoading(true);
    setLoadError('');
    const endpoints = [
      'dashboard',
      'vendors',
      'requests',
      'inventory-shortages',
      'quotations',
      'orders',
      'warehouses',
      'receipts',
      'deviations',
      'artwork-proofs',
      'returns',
      'bills',
    ];
    const setters = [
      setDashboard,
      setVendors,
      setRequests,
      setInventoryShortages,
      setQuotations,
      setOrders,
      setWarehouses,
      setReceipts,
      setDeviations,
      setArtworkProofs,
      setReturns,
      setBills,
    ];

    const results = await Promise.allSettled(
      endpoints.map((endpoint) => api.get(`${companyPath}/${endpoint}`, { noCache: true, timeout: 12000 }))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        setters[index](result.value.data || (index === 0 ? null : []));
      }
    });

    const serverError = results.find(
      (result) => result.status === 'rejected' && ![403, 404].includes(result.reason?.status)
    );
    if (serverError) {
      setLoadError(serverError.reason?.message || 'Some purchase records could not be loaded.');
    }
    setLoading(false);
  }, [companyPath]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const warehouseNames = useMemo(() => {
    const names = new Set(['Main Warehouse']);
    warehouses.forEach((warehouse) => names.add(warehouse.name));
    return Array.from(names);
  }, [warehouses]);

  const runAction = async (action, title, message) => {
    setSaving(true);
    try {
      await action();
      setModal(null);
      await loadAll();
      showToast(title, message, 'success');
    } catch (error) {
      showToast('Purchase action failed', error.message || 'Please try again.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  // Vendor actions
  const submitVendor = (event) => {
    event.preventDefault();
    const payload = {
      ...vendorForm,
      bankDetails: {
        accountNumber: vendorForm.accountNumber,
        ifsc: vendorForm.ifsc,
        bankName: vendorForm.bankName,
      },
    };
    runAction(() => api.post(`${companyPath}/vendors`, payload), 'Vendor registered', `${vendorForm.name} is submitted for onboarding.`);
  };

  const approveVendor = (vendor) => {
    runAction(() => api.post(`${companyPath}/vendors/${vendor.id}/approve`, {}), 'Vendor approved', `${vendor.name} is now approved for procurement.`);
  };

  // Request actions
  const submitRequest = (event) => {
    event.preventDefault();
    runAction(
      () => api.post(`${companyPath}/requests`, { ...requestForm, items: requestItems }),
      'Purchase request created',
      'The PR is created with immutable V1 snapshot and routed for approval.'
    );
  };

  const approveRequest = (request) => {
    runAction(() => api.post(`${companyPath}/requests/${request.id}/approve`, {}), 'PR Approved', `${request.requestNo} is approved and released for vendor sourcing.`);
  };

  const submitRejectRequest = (event) => {
    event.preventDefault();
    runAction(
      () => api.post(`${companyPath}/requests/${modal.row.id}/reject`, { reason: rejectReason }),
      'PR Rejected',
      `${modal.row.requestNo} was rejected. Sourcing blocked.`
    );
  };

  const createRequestFromShortage = (shortage) =>
    runAction(
      () => api.post(`${companyPath}/inventory-shortages/${shortage.id}/request`, {}),
      'Shortage accepted',
      `${shortage.sku} is converted to a purchase request.`
    );

  // Quote actions
  const openQuote = (request) => {
    setQuoteForm({ ...EMPTY_QUOTE, requestId: request.id });
    setQuoteItems((Array.isArray(request.items) ? request.items : []).map((item) => ({ ...item, unitRate: '' })));
    setModal({ type: 'quote', row: request });
  };

  const submitQuote = (event) => {
    event.preventDefault();
    runAction(
      () => api.post(`${companyPath}/quotations`, { ...quoteForm, items: quoteItems }),
      'Vendor quotation saved',
      'Quotation saved with full Landed Cost calculation.'
    );
  };

  const openSelectQuote = (quotation) => {
    setNonLowestJustification('');
    setModal({ type: 'selectQuote', row: quotation });
  };

  const submitSelectQuote = (event) => {
    event.preventDefault();
    runAction(
      () => api.post(`${companyPath}/quotations/${modal.row.id}/select`, { nonLowestJustification }),
      'Vendor Selected',
      `${modal.row.vendor?.name} selected for ${modal.row.request?.requestNo}.`
    );
  };

  const requestQuoteException = (request) => {
    const reason = prompt('Please enter manager exception justification for proceeding with fewer than 2 quotes:');
    if (!reason) return;
    runAction(
      () => api.post(`${companyPath}/requests/${request.id}/quote-exception`, { reason }),
      'Quote Exception Approved',
      `Exception approved for ${request.requestNo}.`
    );
  };

  // PO actions
  const openOrder = (quotation) => {
    setOrderForm({
      ...EMPTY_ORDER,
      paymentTerms: quotation.paymentTerms || '',
      transporterResponsibility: quotation.transporterResponsibility || 'BUYER',
      loadingUnloadingCharges: String(Number(quotation.loadingCharges || 0) + Number(quotation.unloadingCharges || 0)),
      handlingCharges: String(quotation.handlingCharges || 0),
    });
    setModal({ type: 'order', row: quotation });
  };

  const submitOrder = (event) => {
    event.preventDefault();
    runAction(
      () => api.post(`${companyPath}/quotations/${modal.row.id}/order`, orderForm),
      'Purchase Order Created',
      'PO created with immutable V1 snapshot and submitted for approval.'
    );
  };

  const approveOrder = (order) => {
    runAction(() => api.post(`${companyPath}/orders/${order.id}/approve`, {}), 'PO Approved', `${order.poNumber} is commercially approved.`);
  };

  // Artwork Proof actions
  const openArtwork = (order) => {
    setArtworkForm({ ...EMPTY_ARTWORK, orderId: order.id });
    setModal({ type: 'artwork', row: order });
  };

  const submitArtwork = (event) => {
    event.preventDefault();
    runAction(
      () => api.post(`${companyPath}/artwork-proofs`, artworkForm),
      'Artwork Proof Uploaded',
      'Proof submitted for separate Design and Commercial approvals.'
    );
  };

  const reviewArtwork = (proof, type, decision) => {
    const comments = prompt(`Enter comments for ${type} ${decision}:`) || '';
    const endpoint = type === 'design' ? 'design-review' : 'commercial-review';
    runAction(
      () => api.post(`${companyPath}/artwork-proofs/${proof.id}/${endpoint}`, { decision, comments }),
      `Artwork ${type} ${decision}`,
      `Proof ${proof.proofNo} review updated.`
    );
  };

  // GRN actions
  const openReceipt = (order) => {
    const accepted = new Map();
    (order.receipts || []).forEach((receipt) =>
      (receipt.items || []).forEach((line) =>
        accepted.set(line.sku, (accepted.get(line.sku) || 0) + Number(line.acceptedQty || 0))
      )
    );
    const items = (order.items || []).map((item) => {
      const outstanding = Math.max(0, Number(item.qty) - (accepted.get(item.sku) || 0));
      return {
        ...item,
        receivedQty: String(outstanding),
        acceptedQty: String(outstanding),
        rejectedQty: '0',
        shortQty: '0',
        damagedQty: '0',
        rejectionReason: '',
      };
    }).filter((item) => Number(item.receivedQty) > 0);

    setReceiptForm({
      ...EMPTY_RECEIPT,
      warehouse: warehouseNames[0],
      deliveryAddress: order.deliveryAddress || '',
    });
    setReceiptItems(items);
    setModal({ type: 'receipt', row: order });
  };

  const submitReceipt = (event) => {
    event.preventDefault();
    runAction(
      () => api.post(`${companyPath}/orders/${modal.row.id}/receipts`, { ...receiptForm, items: receiptItems }),
      'GRN & QC Completed',
      'Accepted stock routed to inventory. Discrepancies routed to Quality Hold & auto-deviation created.'
    );
  };

  // Deviations actions
  const openResolveDeviation = (deviation) => {
    setDeviationResolution('');
    setModal({ type: 'resolveDeviation', row: deviation });
  };

  const submitResolveDeviation = (event) => {
    event.preventDefault();
    runAction(
      () => api.post(`${companyPath}/deviations/${modal.row.id}/resolve`, {
        correctiveAction: deviationResolution,
        resolutionStatus: 'RESOLVED',
      }),
      'Deviation Resolved',
      `Deviation ${modal.row.deviationNo} marked resolved.`
    );
  };

  // Returns actions
  const dispatchReturn = (purchaseReturn) =>
    runAction(
      () => api.post(`${companyPath}/returns/${purchaseReturn.id}/dispatch`, {}),
      'Return dispatched',
      `${purchaseReturn.returnNo} marked as returned to vendor.`
    );

  // Bills & Payment Hold actions
  const openBill = (order) => {
    setBillForm({
      ...EMPTY_BILL,
      taxableAmount: String(order.subtotal || 0),
      taxAmount: String(order.taxAmount || 0),
      otherCharges: String(Number(order.freightAmount || 0) + Number(order.loadingUnloadingCharges || 0)),
    });
    setModal({ type: 'bill', row: order });
  };

  const submitBill = (event) => {
    event.preventDefault();
    runAction(
      () => api.post(`${companyPath}/orders/${modal.row.id}/bills`, billForm),
      'Supplier Bill Recorded',
      'Bill saved. Full payment hold applied if GRN quality inspection had discrepancies.'
    );
  };

  const openReleaseHold = (bill) => {
    setHoldReleaseReason('');
    setModal({ type: 'releaseHold', row: bill });
  };

  const submitReleaseHold = (event) => {
    event.preventDefault();
    runAction(
      () => api.post(`${companyPath}/bills/${modal.row.id}/release-hold`, { reason: holdReleaseReason }),
      'Payment Hold Released',
      `Hold on bill ${modal.row.billNo} released with audit justification.`
    );
  };

  const payBill = (bill) =>
    runAction(
      () => api.post(`${companyPath}/bills/${bill.id}/pay`, {}),
      'Bill Marked Paid',
      `${bill.billNo} has been closed as paid.`
    );

  const tabs = [
    ['overview', 'Overview'],
    ['vendors', 'Vendors'],
    ['requests', 'Purchase Requests'],
    ['quotations', 'Rate Comparison & Landed Cost'],
    ['orders', 'Purchase Orders'],
    ['artwork', 'Artwork Proofs (Dual Approval)'],
    ['receipts', 'Receipts & QC'],
    ['deviations', 'Quality Deviations'],
    ['returns', 'Returns'],
    ['bills', 'Bills & Payment Holds'],
    ['departments', 'Department Head'],
  ];

  const renderOverview = () => {
    const cards = [
      ['Active Vendors', dashboard?.vendors || 0, '🏢'],
      ['Open Requests', dashboard?.requests || 0, '📝'],
      ['Quotes to Compare', dashboard?.quotations || 0, '⚖️'],
      ['Open POs', dashboard?.orders || 0, '📄'],
      ['Goods Receipts', dashboard?.receipts || 0, '📥'],
      ['Open Deviations', deviations.filter((d) => d.resolutionStatus === 'OPEN').length, '⚠️'],
      ['Bills on Hold', bills.filter((b) => b.paymentHold).length, '🛑'],
      ['Total Ordered Value', `₹${number(dashboard?.totalOrderedValue)}`, '💰'],
    ];
    return (
      <>
        <div className={styles.stats}>
          {cards.map(([label, value, icon]) => (
            <div className={styles.stat} key={label}>
              <span>{icon}</span>
              <div>
                <strong>{value}</strong>
                <small>{label}</small>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.sectionHeader}>
          <div>
            <h3>Recent Purchase Orders</h3>
            <p>Latest orders issued to approved suppliers.</p>
          </div>
        </div>
        {dashboard?.recentOrders?.length ? (
          renderOrderTable(dashboard.recentOrders)
        ) : (
          <EmptyState
            icon="📄"
            title="No Purchase Orders Yet"
            description="Create a purchase request, compare vendor quotations with landed cost, and issue the first PO."
          />
        )}
      </>
    );
  };

  const renderVendors = () => (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Vendor Master &amp; Onboarding</h3>
          <p>Register and onboard suppliers with GSTIN, PAN, bank details and Phase 1 approval workflow.</p>
        </div>
        <button
          className={styles.primary}
          onClick={() => {
            setVendorForm(EMPTY_VENDOR);
            setModal({ type: 'vendor' });
          }}
        >
          + Register Vendor
        </button>
      </div>
      {vendors.length ? (
        <Table>
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Legal Name / PAN</th>
                <th>Contact</th>
                <th>Category</th>
                <th>Tax / Terms</th>
                <th>Approval</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={vendor.id}>
                  <td>
                    <strong>{vendor.vendorCode || '—'}</strong>
                    <small>{vendor.name}</small>
                  </td>
                  <td>
                    {vendor.legalName || '—'}
                    <small>PAN: {vendor.pan || '—'}</small>
                  </td>
                  <td>
                    {vendor.contact || '—'}
                    <small>{[vendor.email, vendor.phone || vendor.mobile].filter(Boolean).join(' • ') || 'No contact details'}</small>
                  </td>
                  <td>{vendor.category}</td>
                  <td>
                    {vendor.taxId || '—'}
                    <small>{vendor.paymentTerms || '—'}</small>
                  </td>
                  <td>
                    <Status value={vendor.approvalStatus || 'APPROVED'} />
                  </td>
                  <td>
                    <Status value={vendor.status} />
                  </td>
                  <td className={styles.actions}>
                    {vendor.approvalStatus === 'PENDING_APPROVAL' && (
                      <button className={styles.success} onClick={() => approveVendor(vendor)}>
                        Approve Onboarding
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Table>
      ) : (
        <EmptyState
          icon="🏢"
          title="No Vendors Registered"
          description="Register the first supplier to begin rate collection."
          actionLabel="Register Vendor"
          onAction={() => setModal({ type: 'vendor' })}
        />
      )}
    </>
  );

  const renderRequests = () => (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Purchase Requests &amp; Indents</h3>
          <p>Create material requests with priority, approval engine, and immutable V1 snapshots.</p>
        </div>
        <button
          className={styles.primary}
          onClick={() => {
            setRequestForm(EMPTY_REQUEST);
            setRequestItems([newRequestItem()]);
            setModal({ type: 'request' });
          }}
        >
          + New Purchase Request
        </button>
      </div>

      {inventoryShortages.length > 0 && (
        <>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Production Shortages from Inventory</h3>
              <p>Convert automatic shortages into purchase requests.</p>
            </div>
          </div>
          <Table>
            <table>
              <thead>
                <tr>
                  <th>Inventory Request</th>
                  <th>Required For</th>
                  <th>Raw Material</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {inventoryShortages.map((shortage) => (
                  <tr key={shortage.id}>
                    <td>
                      <strong>{shortage.requestNo}</strong>
                      <small>{date(shortage.createdAt)}</small>
                    </td>
                    <td>
                      {shortage.materialRequest?.productName}
                      <small>{shortage.materialRequest?.requestNo}</small>
                    </td>
                    <td>
                      <strong>{shortage.sku}</strong>
                      <small>{shortage.itemName}</small>
                    </td>
                    <td>
                      {shortage.requiredQty - shortage.receivedQty} {shortage.uom}
                    </td>
                    <td>
                      <Status value={shortage.purchaseRequest?.status || shortage.status} />
                    </td>
                    <td className={styles.actions}>
                      {shortage.purchaseRequest ? (
                        <small>{shortage.purchaseRequest.requestNo}</small>
                      ) : (
                        <button onClick={() => createRequestFromShortage(shortage)}>Create PR</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Table>
        </>
      )}

      {requests.length ? (
        <Table>
          <table>
            <thead>
              <tr>
                <th>Request No / Priority</th>
                <th>Department / Purpose</th>
                <th>Material List</th>
                <th>Required By</th>
                <th>Quotes</th>
                <th>Approval</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <strong>{request.requestNo}</strong>
                    <span className={`${styles.badge} ${request.priority === 'URGENT' || request.priority === 'HIGH' ? styles.dangerTone : styles.warningTone}`}>
                      {request.priority || 'MEDIUM'}
                    </span>
                    <small>v{request.versionNumber || 1}</small>
                  </td>
                  <td>
                    {request.department || 'General'}
                    <small>{request.purpose || '—'}</small>
                  </td>
                  <td>
                    {(request.items || []).map((item) => `${item.sku} × ${item.qty} ${item.uom}`).join(', ')}
                  </td>
                  <td>{date(request.requiredBy)}</td>
                  <td>{request.quotations?.length || 0} quotes</td>
                  <td>
                    <Status value={request.status === 'REJECTED' ? 'REJECTED' : request.approvedAt ? 'APPROVED' : 'PENDING_APPROVAL'} />
                  </td>
                  <td>
                    <Status value={request.status} />
                  </td>
                  <td className={styles.actions}>
                    {!request.approvedAt && request.status !== 'REJECTED' && (
                      <>
                        <button className={styles.success} onClick={() => approveRequest(request)}>
                          Approve PR
                        </button>
                        <button
                          onClick={() => {
                            setRejectReason('');
                            setModal({ type: 'rejectRequest', row: request });
                          }}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {request.approvedAt && request.status !== 'PO_CREATED' && (
                      <button onClick={() => openQuote(request)}>+ Add Quote</button>
                    )}
                    {request.approvedAt && (request.quotations?.length || 0) < 2 && (
                      <button onClick={() => requestQuoteException(request)}>Exception</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Table>
      ) : (
        <EmptyState
          icon="📝"
          title="No Purchase Requests"
          description="Create a material list with priority to start the vendor sourcing process."
        />
      )}
    </>
  );

  const renderQuotations = () => (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Rate Comparison &amp; Landed Cost Formula</h3>
          <p>
            Enforce target 5 quotes, min 2 quotes per item, Landed Cost (Basic + Tax + Freight + Loading + Unloading + Handling + Other), and non-lowest justification.
          </p>
        </div>
      </div>
      {quotations.length ? (
        <Table>
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Vendor</th>
                <th>Basic / Subtotal</th>
                <th>Freight &amp; Handling</th>
                <th>Landed Cost Total</th>
                <th>Lowest?</th>
                <th>Delivery / Terms</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((quotation) => (
                <tr key={quotation.id}>
                  <td>
                    <strong>{quotation.request?.requestNo}</strong>
                    <small>{quotation.quoteNo}</small>
                  </td>
                  <td>
                    <strong>{quotation.vendor?.name}</strong>
                    <small>{quotation.vendorQuoteNo || 'Internal quote'}</small>
                  </td>
                  <td>₹{number(quotation.subtotal)}</td>
                  <td>
                    <small>
                      Tax: ₹{number(quotation.taxAmount)} | Frt: ₹{number(quotation.freightAmount)}
                    </small>
                    <small>
                      Load/Unload/Hand: ₹{number(Number(quotation.loadingCharges || 0) + Number(quotation.unloadingCharges || 0) + Number(quotation.handlingCharges || 0))}
                    </small>
                  </td>
                  <td className={styles.compare}>
                    <strong>₹{number(quotation.landedCost || quotation.totalAmount)}</strong>
                  </td>
                  <td>
                    {quotation.isLowestLandedCost ? (
                      <span className={`${styles.badge} ${styles.successTone}`}>LOWEST</span>
                    ) : (
                      <span className={styles.badge}>HIGHER</span>
                    )}
                  </td>
                  <td>
                    {quotation.deliveryDays} day(s)
                    <small>{quotation.paymentTerms || '—'}</small>
                  </td>
                  <td>
                    <Status value={quotation.status} />
                  </td>
                  <td className={styles.actions}>
                    {quotation.status === 'RECEIVED' && (
                      <button onClick={() => openSelectQuote(quotation)}>Select Quote</button>
                    )}
                    {quotation.status === 'SELECTED' && !quotation.purchaseOrder && (
                      <button className={styles.success} onClick={() => openOrder(quotation)}>
                        Create PO
                      </button>
                    )}
                    {quotation.purchaseOrder && <small>{quotation.purchaseOrder.poNumber}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Table>
      ) : (
        <EmptyState
          icon="⚖️"
          title="No Vendor Quotations"
          description="Open an approved purchase request and enter vendor rates with landed cost components."
        />
      )}
    </>
  );

  function renderOrderTable(orderRows = orders) {
    return (
      <Table>
        <table>
          <thead>
            <tr>
              <th>Purchase Order</th>
              <th>Vendor</th>
              <th>Materials / Balance</th>
              <th>Order Value</th>
              <th>Approval</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orderRows.map((order) => {
              const receivedSum = (order.receipts || []).reduce(
                (sum, r) => sum + (r.items || []).reduce((s, i) => s + Number(i.acceptedQty || 0), 0),
                0
              );
              const totalOrdered = (order.items || []).reduce((s, i) => s + Number(i.qty || 0), 0);
              const balance = Math.max(0, totalOrdered - receivedSum);

              return (
                <tr key={order.id}>
                  <td>
                    <strong>{order.poNumber}</strong>
                    <small>v{order.versionNumber || 1} • {date(order.orderDate)}</small>
                  </td>
                  <td>{order.vendor?.name || '—'}</td>
                  <td>
                    {(order.items || []).map((item) => `${item.sku} × ${item.qty}`).join(', ')}
                    <small style={{ color: balance > 0 ? '#b45309' : '#047857', fontWeight: 700 }}>
                      Balance to receive: {balance} PCS
                    </small>
                  </td>
                  <td>
                    <strong>₹{number(order.totalAmount)}</strong>
                  </td>
                  <td>
                    <Status value={order.approvedAt ? 'APPROVED' : order.approvalStatus || 'PENDING_APPROVAL'} />
                  </td>
                  <td>
                    <Status value={order.status} />
                  </td>
                  <td className={styles.actions}>
                    {!order.approvedAt && (
                      <button className={styles.success} onClick={() => approveOrder(order)}>
                        Approve PO
                      </button>
                    )}
                    <button onClick={() => openArtwork(order)}>+ Artwork Proof</button>
                    {order.approvedAt && !['RECEIVED', 'CLOSED', 'CANCELLED'].includes(order.status) && (
                      <button onClick={() => openReceipt(order)}>Receive / QC</button>
                    )}
                    {order.receipts?.some((r) => r.acceptedQty > 0) && !order.bill && (
                      <button onClick={() => openBill(order)}>Create Bill</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Table>
    );
  }

  const renderOrders = () => (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Purchase Orders</h3>
          <p>Commercial orders with Phase 1 Document Versioning (immutable V1) and Dual Approval integration.</p>
        </div>
      </div>
      {orders.length ? (
        renderOrderTable()
      ) : (
        <EmptyState
          icon="📄"
          title="No Purchase Orders"
          description="Select an approved vendor quotation and create the purchase order."
        />
      )}
    </>
  );

  const renderArtwork = () => (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Artwork Proofs &amp; Dual Approval</h3>
          <p>Independent Technical Design Approval (design team) and Commercial PO Approval (commercial team).</p>
        </div>
      </div>
      {artworkProofs.length ? (
        <Table>
          <table>
            <thead>
              <tr>
                <th>Proof No</th>
                <th>Purchase Order</th>
                <th>Title / Proof Link</th>
                <th>Design Status</th>
                <th>Commercial Status</th>
                <th>Overall</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {artworkProofs.map((proof) => (
                <tr key={proof.id}>
                  <td>
                    <strong>{proof.proofNo}</strong>
                    <small>v{proof.versionNumber || 1}</small>
                  </td>
                  <td>{proof.order?.poNumber || '—'}</td>
                  <td>
                    <strong>{proof.title}</strong>
                    {proof.supplierProofUrl && (
                      <a href={proof.supplierProofUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: '#7c3aed' }}>
                        View Proof URL
                      </a>
                    )}
                  </td>
                  <td>
                    <Status value={proof.designStatus} />
                  </td>
                  <td>
                    <Status value={proof.commercialStatus} />
                  </td>
                  <td>
                    <Status value={proof.designStatus === 'APPROVED' && proof.commercialStatus === 'APPROVED' ? 'APPROVED' : 'PENDING_REVIEW'} />
                  </td>
                  <td className={styles.actions}>
                    {proof.designStatus !== 'APPROVED' && (
                      <button className={styles.success} onClick={() => reviewArtwork(proof, 'design', 'APPROVED')}>
                        Approve Design
                      </button>
                    )}
                    {proof.commercialStatus !== 'APPROVED' && (
                      <button onClick={() => reviewArtwork(proof, 'commercial', 'APPROVED')}>
                        Approve Commercial
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Table>
      ) : (
        <EmptyState
          icon="🎨"
          title="No Artwork Proofs"
          description="Upload an artwork proof from the Purchase Orders tab to start the dual approval review."
        />
      )}
    </>
  );

  const renderReceipts = () => (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Goods Receipt Notes (GRN) &amp; QC</h3>
          <p>Multiple partial receipts, vehicle &amp; challan tracking, QC breakdown (Accepted, Rejected, Damaged, Short).</p>
        </div>
      </div>
      {receipts.length ? (
        <Table>
          <table>
            <thead>
              <tr>
                <th>GRN No</th>
                <th>PO / Vendor</th>
                <th>Vehicle &amp; Challan</th>
                <th>Warehouse</th>
                <th>Received</th>
                <th>Accepted (Stock)</th>
                <th>QC Discrepancy</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => {
                const totalDiscrepancy = Number(receipt.rejectedQty || 0) + Number(receipt.damagedQty || 0) + Number(receipt.shortQty || 0);
                return (
                  <tr key={receipt.id}>
                    <td>
                      <strong>{receipt.grnNo}</strong>
                      <small>{date(receipt.receivedAt)}</small>
                    </td>
                    <td>
                      {receipt.order?.poNumber}
                      <small>{receipt.order?.vendor?.name}</small>
                    </td>
                    <td>
                      {receipt.vehicleNo || '—'}
                      <small>DC: {receipt.deliveryChallanNo || '—'}</small>
                    </td>
                    <td>{receipt.warehouse}</td>
                    <td>{receipt.receivedQty}</td>
                    <td className={styles.compare}>
                      <strong>{receipt.acceptedQty}</strong>
                    </td>
                    <td>
                      {totalDiscrepancy > 0 ? (
                        <span className={`${styles.badge} ${styles.dangerTone}`}>
                          Rej: {receipt.rejectedQty} | Dmg: {receipt.damagedQty || 0} | Sh: {receipt.shortQty || 0}
                        </span>
                      ) : (
                        <span className={`${styles.badge} ${styles.successTone}`}>0 Issues</span>
                      )}
                    </td>
                    <td>
                      <Status value={receipt.qcStatus} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Table>
      ) : (
        <EmptyState
          icon="📥"
          title="No Goods Receipts"
          description="Receive material against an approved PO. Accepted stock routes to inventory; discrepancies create Quality Hold deviations."
        />
      )}
    </>
  );

  const renderDeviations = () => (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Quality Inspection Deviations</h3>
          <p>Auto-generated from short/damaged/rejected GRN materials on Quality Hold.</p>
        </div>
      </div>
      {deviations.length ? (
        <Table>
          <table>
            <thead>
              <tr>
                <th>Deviation No</th>
                <th>GRN / PO</th>
                <th>Category</th>
                <th>SKU &amp; Affected Qty</th>
                <th>Root Cause</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {deviations.map((dev) => (
                <tr key={dev.id}>
                  <td>
                    <strong>{dev.deviationNo}</strong>
                    <small>{date(dev.createdAt)}</small>
                  </td>
                  <td>
                    {dev.receipt?.grnNo}
                    <small>{dev.order?.poNumber}</small>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles.dangerTone}`}>{dev.deviationCategory}</span>
                  </td>
                  <td>
                    <strong>{dev.affectedSku}</strong>
                    <small>{dev.affectedQty} units</small>
                  </td>
                  <td>{dev.rootCause || 'Under inspection'}</td>
                  <td>
                    <Status value={dev.resolutionStatus} />
                  </td>
                  <td className={styles.actions}>
                    {dev.resolutionStatus === 'OPEN' && (
                      <button className={styles.success} onClick={() => openResolveDeviation(dev)}>
                        Resolve Deviation
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Table>
      ) : (
        <EmptyState
          icon="✅"
          title="No Open Deviations"
          description="All received materials have passed quality inspection with zero short, damaged, or rejected items."
        />
      )}
    </>
  );

  const renderReturns = () => (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Purchase Returns (RTV)</h3>
          <p>Return rejected materials back to suppliers with return dispatch notes.</p>
        </div>
      </div>
      {returns.length ? (
        <Table>
          <table>
            <thead>
              <tr>
                <th>Return No</th>
                <th>GRN / PO</th>
                <th>Vendor</th>
                <th>Rejected Materials</th>
                <th>Total Qty</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((purchaseReturn) => (
                <tr key={purchaseReturn.id}>
                  <td>
                    <strong>{purchaseReturn.returnNo}</strong>
                    <small>{date(purchaseReturn.createdAt)}</small>
                  </td>
                  <td>
                    {purchaseReturn.receipt?.grnNo}
                    <small>{purchaseReturn.order?.poNumber}</small>
                  </td>
                  <td>{purchaseReturn.order?.vendor?.name}</td>
                  <td>
                    {(purchaseReturn.items || []).map((item) => `${item.sku} × ${item.qty}: ${item.reason}`).join(', ')}
                  </td>
                  <td>{purchaseReturn.totalQty}</td>
                  <td>
                    <Status value={purchaseReturn.status} />
                  </td>
                  <td className={styles.actions}>
                    {purchaseReturn.status === 'PENDING_DISPATCH' && (
                      <button onClick={() => dispatchReturn(purchaseReturn)}>Dispatch Return</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Table>
      ) : (
        <EmptyState
          icon="↩️"
          title="No Purchase Returns"
          description="Rejected GRN materials automatically route here for return dispatch to vendors."
        />
      )}
    </>
  );

  const renderBills = () => (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Supplier Bills &amp; Full Invoice Payment Holds</h3>
          <p>If GRN quality inspection has short/damaged/rejected materials, invoice is placed on strict payment hold.</p>
        </div>
      </div>
      {bills.length ? (
        <Table>
          <table>
            <thead>
              <tr>
                <th>Bill No</th>
                <th>Vendor Invoice</th>
                <th>PO / Vendor</th>
                <th>Due Date</th>
                <th>Total Amount</th>
                <th>Payment Hold</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id}>
                  <td>
                    <strong>{bill.billNo}</strong>
                    <small>{date(bill.invoiceDate)}</small>
                  </td>
                  <td>{bill.vendorInvoiceNo}</td>
                  <td>
                    {bill.order?.poNumber}
                    <small>{bill.order?.vendor?.name}</small>
                  </td>
                  <td>{date(bill.dueDate)}</td>
                  <td>
                    <strong>₹{number(bill.totalAmount)}</strong>
                  </td>
                  <td>
                    {bill.paymentHold ? (
                      <span className={`${styles.badge} ${styles.dangerTone}`}>
                        🛑 FULL HOLD: {bill.holdReason || 'GRN QC Discrepancy'}
                      </span>
                    ) : (
                      <span className={`${styles.badge} ${styles.successTone}`}>NO HOLD</span>
                    )}
                  </td>
                  <td>
                    <Status value={bill.status} />
                  </td>
                  <td className={styles.actions}>
                    {bill.paymentHold && (
                      <button className={styles.warningTone} onClick={() => openReleaseHold(bill)}>
                        Release Hold
                      </button>
                    )}
                    {bill.status !== 'PAID' && (
                      <button
                        className={styles.success}
                        disabled={bill.paymentHold}
                        title={bill.paymentHold ? 'Cannot pay: invoice on hold' : 'Mark paid'}
                        onClick={() => payBill(bill)}
                      >
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Table>
      ) : (
        <EmptyState
          icon="🧾"
          title="No Purchase Bills"
          description="Create a supplier bill after accepted material is received against a purchase order."
        />
      )}
    </>
  );

  const content =
    activeTab === 'overview'
      ? renderOverview()
      : activeTab === 'vendors'
      ? renderVendors()
      : activeTab === 'requests'
      ? renderRequests()
      : activeTab === 'quotations'
      ? renderQuotations()
      : activeTab === 'orders'
      ? renderOrders()
      : activeTab === 'artwork'
      ? renderArtwork()
      : activeTab === 'receipts'
      ? renderReceipts()
      : activeTab === 'deviations'
      ? renderDeviations()
      : activeTab === 'returns'
      ? renderReturns()
      : activeTab === 'bills'
      ? renderBills()
      : <ServiceDepartments activeCompany={activeCompany} serviceCode="purchase_vendor" showToast={showToast} />;

  return (
    <div className={styles.module}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Procure-to-Pay &amp; Quality Control</span>
          <h2>Purchase &amp; Vendor Management</h2>
          <p>
            Vendor onboarding, PR approvals, landed cost quotation comparison, artwork dual approval, partial GRN, deviation hold, and full invoice payment control for {activeCompany?.organizationName}.
          </p>
        </div>
        <button onClick={loadAll} disabled={loading}>
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </header>

      <div className={styles.flow}>
        <span>Vendor Onboarding</span>
        <b>→</b>
        <span>PR Priority &amp; Approval</span>
        <b>→</b>
        <span>5-Quote Landed Cost</span>
        <b>→</b>
        <span>Select Vendor</span>
        <b>→</b>
        <span>PO &amp; Artwork Dual Approval</span>
        <b>→</b>
        <span>Partial GRN &amp; QC</span>
        <b>→</b>
        <span>Quality Hold / Deviation</span>
        <b>→</b>
        <span>Bill &amp; Payment Hold Release</span>
      </div>

      <nav className={styles.tabs}>
        {tabs.map(([key, label]) => (
          <button
            key={key}
            className={activeTab === key ? styles.active : ''}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {loadError && <div className={styles.error}>{loadError}</div>}
      {loading && !dashboard ? <div className={styles.loading}>Loading purchase records…</div> : content}

      {/* 1. Modal: Register Vendor */}
      <Modal isOpen={modal?.type === 'vendor'} onClose={() => setModal(null)} title="Register Supplier (Vendor Master)" maxWidth="760px">
        <form className={styles.form} onSubmit={submitVendor}>
          <div className={styles.formGrid}>
            <Field label="Vendor Code">
              <input value={vendorForm.vendorCode} onChange={(e) => setVendorForm({ ...vendorForm, vendorCode: e.target.value })} placeholder="Auto-generated if blank" />
            </Field>
            <Field label="Vendor Company Name *">
              <input required value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} />
            </Field>
            <Field label="Legal Business Name">
              <input value={vendorForm.legalName} onChange={(e) => setVendorForm({ ...vendorForm, legalName: e.target.value })} placeholder="As per PAN / GST" />
            </Field>
            <Field label="PAN Number">
              <input value={vendorForm.pan} onChange={(e) => setVendorForm({ ...vendorForm, pan: e.target.value })} placeholder="e.g. ABCDE1234F" />
            </Field>
            <Field label="GSTIN / Tax ID">
              <input value={vendorForm.taxId} onChange={(e) => setVendorForm({ ...vendorForm, taxId: e.target.value })} placeholder="e.g. 24ABCDE1234F1Z5" />
            </Field>
            <Field label="Contact Person">
              <input value={vendorForm.contact} onChange={(e) => setVendorForm({ ...vendorForm, contact: e.target.value })} />
            </Field>
            <Field label="Email">
              <input type="email" value={vendorForm.email} onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })} />
            </Field>
            <Field label="Mobile / Phone">
              <input value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} />
            </Field>
            <Field label="Category">
              <select value={vendorForm.category} onChange={(e) => setVendorForm({ ...vendorForm, category: e.target.value })}>
                <option>Raw Materials</option>
                <option>Packaging Materials</option>
                <option>Machinery Parts</option>
                <option>Services</option>
              </select>
            </Field>
            <Field label="Payment Terms">
              <input value={vendorForm.paymentTerms} onChange={(e) => setVendorForm({ ...vendorForm, paymentTerms: e.target.value })} />
            </Field>
            <Field label="Bank Name">
              <input value={vendorForm.bankName} onChange={(e) => setVendorForm({ ...vendorForm, bankName: e.target.value })} placeholder="e.g. HDFC Bank" />
            </Field>
            <Field label="Account Number">
              <input value={vendorForm.accountNumber} onChange={(e) => setVendorForm({ ...vendorForm, accountNumber: e.target.value })} />
            </Field>
            <Field label="IFSC Code">
              <input value={vendorForm.ifsc} onChange={(e) => setVendorForm({ ...vendorForm, ifsc: e.target.value })} />
            </Field>
            <Field label="Lead Time (Days)">
              <input type="number" min="0" value={vendorForm.leadTimeDays} onChange={(e) => setVendorForm({ ...vendorForm, leadTimeDays: e.target.value })} />
            </Field>
          </div>
          <Field label="Registered Address">
            <textarea rows="2" value={vendorForm.registeredAddress} onChange={(e) => setVendorForm({ ...vendorForm, registeredAddress: e.target.value })} />
          </Field>
          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>Submit for Onboarding</button>
          </div>
        </form>
      </Modal>

      {/* 2. Modal: Create PR */}
      <Modal isOpen={modal?.type === 'request'} onClose={() => setModal(null)} title="Create Purchase Request" maxWidth="900px">
        <form className={styles.form} onSubmit={submitRequest}>
          <div className={styles.formGrid}>
            <Field label="Department">
              <input value={requestForm.department} onChange={(e) => setRequestForm({ ...requestForm, department: e.target.value })} />
            </Field>
            <Field label="Priority *">
              <select value={requestForm.priority} onChange={(e) => setRequestForm({ ...requestForm, priority: e.target.value })}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </Field>
            <Field label="Requested By">
              <input value={requestForm.requestedBy} onChange={(e) => setRequestForm({ ...requestForm, requestedBy: e.target.value })} />
            </Field>
            <Field label="Required By Date">
              <input type="date" value={requestForm.requiredBy} onChange={(e) => setRequestForm({ ...requestForm, requiredBy: e.target.value })} />
            </Field>
            <Field label="Purpose">
              <input value={requestForm.purpose} onChange={(e) => setRequestForm({ ...requestForm, purpose: e.target.value })} placeholder="Production, Packing, Maintenance…" />
            </Field>
          </div>
          {requestItems.map((item, index) => (
            <div className={styles.lineRow} key={index}>
              <input required placeholder="SKU" value={item.sku} onChange={(e) => setRequestItems(requestItems.map((row, i) => (i === index ? { ...row, sku: e.target.value } : row)))} />
              <input required placeholder="Material name" value={item.name} onChange={(e) => setRequestItems(requestItems.map((row, i) => (i === index ? { ...row, name: e.target.value } : row)))} />
              <input required type="number" min="1" placeholder="Qty" value={item.qty} onChange={(e) => setRequestItems(requestItems.map((row, i) => (i === index ? { ...row, qty: e.target.value } : row)))} />
              <input required placeholder="UOM" value={item.uom} onChange={(e) => setRequestItems(requestItems.map((row, i) => (i === index ? { ...row, uom: e.target.value } : row)))} />
              <button type="button" disabled={requestItems.length === 1} onClick={() => setRequestItems(requestItems.filter((_, i) => i !== index))}>×</button>
            </div>
          ))}
          <button type="button" className={styles.addLine} onClick={() => setRequestItems([...requestItems, newRequestItem()])}>+ Add Material</button>
          <Field label="Notes">
            <textarea rows="2" value={requestForm.notes} onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })} />
          </Field>
          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>Create PR (V1 Snapshot)</button>
          </div>
        </form>
      </Modal>

      {/* 3. Modal: Reject PR */}
      <Modal isOpen={modal?.type === 'rejectRequest'} onClose={() => setModal(null)} title={`Reject Purchase Request — ${modal?.row?.requestNo || ''}`}>
        <form className={styles.form} onSubmit={submitRejectRequest}>
          <Field label="Rejection Reason *">
            <textarea required rows="3" placeholder="Provide formal reason for rejecting this purchase request..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          </Field>
          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.dangerTone} style={{ border: 'none', padding: '0.62rem 0.9rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 800 }} disabled={saving}>
              Confirm Rejection
            </button>
          </div>
        </form>
      </Modal>

      {/* 4. Modal: Add Quote */}
      <Modal isOpen={modal?.type === 'quote'} onClose={() => setModal(null)} title={`Add Vendor Rate (Landed Cost) — ${modal?.row?.requestNo || ''}`} maxWidth="900px">
        <form className={styles.form} onSubmit={submitQuote}>
          <div className={styles.formGrid}>
            <Field label="Vendor *">
              <select required value={quoteForm.vendorId} onChange={(e) => {
                const vendor = vendors.find((r) => r.id === e.target.value);
                setQuoteForm({
                  ...quoteForm,
                  vendorId: e.target.value,
                  deliveryDays: String(vendor?.leadTimeDays || 7),
                  paymentTerms: vendor?.paymentTerms || '30 Days',
                });
              }}>
                <option value="">Select vendor</option>
                {vendors.filter((v) => v.status === 'ACTIVE').map((v) => (
                  <option key={v.id} value={v.id}>{v.vendorCode} — {v.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Vendor Quote Number">
              <input value={quoteForm.vendorQuoteNo} onChange={(e) => setQuoteForm({ ...quoteForm, vendorQuoteNo: e.target.value })} />
            </Field>
            <Field label="Delivery Days">
              <input required type="number" min="1" value={quoteForm.deliveryDays} onChange={(e) => setQuoteForm({ ...quoteForm, deliveryDays: e.target.value })} />
            </Field>
            <Field label="Transporter Responsibility">
              <select value={quoteForm.transporterResponsibility} onChange={(e) => setQuoteForm({ ...quoteForm, transporterResponsibility: e.target.value })}>
                <option value="BUYER">Buyer (Ex-Works)</option>
                <option value="SUPPLIER">Supplier (FOR Destination)</option>
              </select>
            </Field>
          </div>

          <div className={`${styles.lineRow} ${styles.quoteRow}`}>
            <strong>SKU</strong>
            <strong>Material</strong>
            <strong>Qty</strong>
            <strong>Rate (₹)</strong>
            <strong>Basic Amount</strong>
          </div>
          {quoteItems.map((item, index) => (
            <div className={`${styles.lineRow} ${styles.quoteRow}`} key={item.sku}>
              <input disabled value={item.sku} />
              <input disabled value={item.name} />
              <input disabled value={`${item.qty} ${item.uom}`} />
              <input required type="number" min="0.01" step="0.01" placeholder="Unit rate" value={item.unitRate} onChange={(e) => setQuoteItems(quoteItems.map((row, i) => (i === index ? { ...row, unitRate: e.target.value } : row)))} />
              <input disabled value={`₹${number(Number(item.qty) * Number(item.unitRate))}`} />
            </div>
          ))}

          <div className={styles.formGrid}>
            <Field label="Tax Amount (₹)">
              <input type="number" min="0" step="0.01" value={quoteForm.taxAmount} onChange={(e) => setQuoteForm({ ...quoteForm, taxAmount: e.target.value })} />
            </Field>
            <Field label="Freight Charges (₹)">
              <input type="number" min="0" step="0.01" value={quoteForm.freightAmount} onChange={(e) => setQuoteForm({ ...quoteForm, freightAmount: e.target.value })} />
            </Field>
            <Field label="Loading Charges (₹)">
              <input type="number" min="0" step="0.01" value={quoteForm.loadingCharges} onChange={(e) => setQuoteForm({ ...quoteForm, loadingCharges: e.target.value })} />
            </Field>
            <Field label="Unloading Charges (₹)">
              <input type="number" min="0" step="0.01" value={quoteForm.unloadingCharges} onChange={(e) => setQuoteForm({ ...quoteForm, unloadingCharges: e.target.value })} />
            </Field>
            <Field label="Handling Charges (₹)">
              <input type="number" min="0" step="0.01" value={quoteForm.handlingCharges} onChange={(e) => setQuoteForm({ ...quoteForm, handlingCharges: e.target.value })} />
            </Field>
            <Field label="Other Charges (₹)">
              <input type="number" min="0" step="0.01" value={quoteForm.otherCharges} onChange={(e) => setQuoteForm({ ...quoteForm, otherCharges: e.target.value })} />
            </Field>
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>Save Quote (Compute Landed Cost)</button>
          </div>
        </form>
      </Modal>

      {/* 5. Modal: Select Quote (Non-Lowest Justification) */}
      <Modal isOpen={modal?.type === 'selectQuote'} onClose={() => setModal(null)} title={`Select Vendor Quote — ${modal?.row?.quoteNo || ''}`}>
        <form className={styles.form} onSubmit={submitSelectQuote}>
          <p className={styles.hint}>
            Vendor: <strong>{modal?.row?.vendor?.name}</strong> • Landed Cost: <strong>₹{number(modal?.row?.landedCost || modal?.row?.totalAmount)}</strong>
            <br />
            {modal?.row?.isLowestLandedCost ? (
              <span style={{ color: '#047857', fontWeight: 800 }}>This is the lowest landed cost quotation.</span>
            ) : (
              <span style={{ color: '#b45309', fontWeight: 800 }}>
                This is NOT the lowest quote. Written justification is mandatory per procurement policy.
              </span>
            )}
          </p>
          {!modal?.row?.isLowestLandedCost && (
            <Field label="Non-Lowest Selection Justification *">
              <textarea
                required
                rows="3"
                placeholder="Explain why this vendor is selected over the lowest bidder (quality, lead time, technical reliability)..."
                value={nonLowestJustification}
                onChange={(e) => setNonLowestJustification(e.target.value)}
              />
            </Field>
          )}
          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>Confirm Vendor Selection</button>
          </div>
        </form>
      </Modal>

      {/* 6. Modal: Create PO */}
      <Modal isOpen={modal?.type === 'order'} onClose={() => setModal(null)} title={`Issue Purchase Order — ${modal?.row?.vendor?.name || ''}`} maxWidth="700px">
        <form className={styles.form} onSubmit={submitOrder}>
          <p className={styles.hint}>
            Selected Quote: <strong>{modal?.row?.quoteNo}</strong> • Total PO Value: <strong>₹{number(modal?.row?.totalAmount)}</strong>
          </p>
          <div className={styles.formGrid}>
            <Field label="Expected Delivery Date">
              <input type="date" value={orderForm.expectedDate} onChange={(e) => setOrderForm({ ...orderForm, expectedDate: e.target.value })} />
            </Field>
            <Field label="Payment Terms">
              <input value={orderForm.paymentTerms} onChange={(e) => setOrderForm({ ...orderForm, paymentTerms: e.target.value })} />
            </Field>
          </div>
          <Field label="Delivery Address">
            <textarea rows="2" value={orderForm.deliveryAddress} onChange={(e) => setOrderForm({ ...orderForm, deliveryAddress: e.target.value })} />
          </Field>
          <Field label="Special Commercial Terms &amp; Instructions">
            <textarea rows="2" value={orderForm.specialInstructions} onChange={(e) => setOrderForm({ ...orderForm, specialInstructions: e.target.value })} />
          </Field>
          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>Issue PO (V1 Snapshot &amp; Approval)</button>
          </div>
        </form>
      </Modal>

      {/* 7. Modal: Artwork Proof */}
      <Modal isOpen={modal?.type === 'artwork'} onClose={() => setModal(null)} title={`Upload Artwork Proof — ${modal?.row?.poNumber || ''}`}>
        <form className={styles.form} onSubmit={submitArtwork}>
          <Field label="Proof Title *">
            <input required value={artworkForm.title} onChange={(e) => setArtworkForm({ ...artworkForm, title: e.target.value })} />
          </Field>
          <Field label="Buyer Artwork URL">
            <input placeholder="https://..." value={artworkForm.buyerArtworkUrl} onChange={(e) => setArtworkForm({ ...artworkForm, buyerArtworkUrl: e.target.value })} />
          </Field>
          <Field label="Supplier Proof URL">
            <input placeholder="https://..." value={artworkForm.supplierProofUrl} onChange={(e) => setArtworkForm({ ...artworkForm, supplierProofUrl: e.target.value })} />
          </Field>
          <Field label="Comments / Instructions">
            <textarea rows="2" value={artworkForm.comments} onChange={(e) => setArtworkForm({ ...artworkForm, comments: e.target.value })} />
          </Field>
          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>Submit Artwork for Dual Approval</button>
          </div>
        </form>
      </Modal>

      {/* 8. Modal: Goods Receipt (GRN & Quality Check) */}
      <Modal isOpen={modal?.type === 'receipt'} onClose={() => setModal(null)} title={`Receive & Inspect — ${modal?.row?.poNumber || ''}`} maxWidth="1000px">
        <form className={styles.form} onSubmit={submitReceipt}>
          <div className={styles.formGrid}>
            <Field label="Receiving Warehouse">
              <select value={receiptForm.warehouse} onChange={(e) => setReceiptForm({ ...receiptForm, warehouse: e.target.value })}>
                {warehouseNames.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </Field>
            <Field label="Delivery Challan No *">
              <input required value={receiptForm.deliveryChallanNo} onChange={(e) => setReceiptForm({ ...receiptForm, deliveryChallanNo: e.target.value })} placeholder="Supplier Challan / LR No" />
            </Field>
            <Field label="Vehicle Number">
              <input value={receiptForm.vehicleNo} onChange={(e) => setReceiptForm({ ...receiptForm, vehicleNo: e.target.value })} placeholder="e.g. GJ-01-AB-1234" />
            </Field>
            <Field label="Carrier / Transporter">
              <input value={receiptForm.carrierName} onChange={(e) => setReceiptForm({ ...receiptForm, carrierName: e.target.value })} />
            </Field>
          </div>

          <div className={`${styles.lineRow} ${styles.receiptRow}`}>
            <strong>SKU</strong>
            <strong>Rcvd</strong>
            <strong>Acc (Stock)</strong>
            <strong>Rej</strong>
            <strong>Short</strong>
            <strong>Reason</strong>
          </div>
          {receiptItems.map((item, index) => (
            <div className={`${styles.lineRow} ${styles.receiptRow}`} key={item.sku}>
              <input disabled value={item.sku} />
              <input required type="number" min="1" value={item.receivedQty} onChange={(e) => setReceiptItems(receiptItems.map((r, i) => (i === index ? { ...r, receivedQty: e.target.value } : r)))} />
              <input required type="number" min="0" value={item.acceptedQty} onChange={(e) => setReceiptItems(receiptItems.map((r, i) => (i === index ? { ...r, acceptedQty: e.target.value } : r)))} />
              <input required type="number" min="0" value={item.rejectedQty} onChange={(e) => setReceiptItems(receiptItems.map((r, i) => (i === index ? { ...r, rejectedQty: e.target.value } : r)))} />
              <input required type="number" min="0" value={item.shortQty} onChange={(e) => setReceiptItems(receiptItems.map((r, i) => (i === index ? { ...r, shortQty: e.target.value } : r)))} />
              <input value={item.rejectionReason} onChange={(e) => setReceiptItems(receiptItems.map((r, i) => (i === index ? { ...r, rejectionReason: e.target.value } : r)))} placeholder="Reason" />
            </div>
          ))}

          <Field label="Inspection Remarks">
            <textarea rows="2" value={receiptForm.inspectionRemarks} onChange={(e) => setReceiptForm({ ...receiptForm, inspectionRemarks: e.target.value })} placeholder="QC observations, lab results..." />
          </Field>
          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving || receiptItems.length === 0}>
              Post GRN &amp; Update Stock / Quality Hold
            </button>
          </div>
        </form>
      </Modal>

      {/* 9. Modal: Resolve Deviation */}
      <Modal isOpen={modal?.type === 'resolveDeviation'} onClose={() => setModal(null)} title={`Resolve Deviation — ${modal?.row?.deviationNo || ''}`}>
        <form className={styles.form} onSubmit={submitResolveDeviation}>
          <Field label="Corrective / Preventive Action *">
            <textarea required rows="3" placeholder="Enter root cause corrective action or debit note settlement..." value={deviationResolution} onChange={(e) => setDeviationResolution(e.target.value)} />
          </Field>
          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>Resolve Deviation</button>
          </div>
        </form>
      </Modal>

      {/* 10. Modal: Create Bill */}
      <Modal isOpen={modal?.type === 'bill'} onClose={() => setModal(null)} title={`Create Purchase Bill — ${modal?.row?.poNumber || ''}`}>
        <form className={styles.form} onSubmit={submitBill}>
          <div className={styles.formGrid}>
            <Field label="Vendor Invoice Number *">
              <input required value={billForm.vendorInvoiceNo} onChange={(e) => setBillForm({ ...billForm, vendorInvoiceNo: e.target.value })} />
            </Field>
            <Field label="Invoice Date">
              <input type="date" value={billForm.invoiceDate} onChange={(e) => setBillForm({ ...billForm, invoiceDate: e.target.value })} />
            </Field>
            <Field label="Due Date">
              <input type="date" value={billForm.dueDate} onChange={(e) => setBillForm({ ...billForm, dueDate: e.target.value })} />
            </Field>
            <Field label="Taxable Amount (₹)">
              <input type="number" min="0" step="0.01" value={billForm.taxableAmount} onChange={(e) => setBillForm({ ...billForm, taxableAmount: e.target.value })} />
            </Field>
            <Field label="Tax Amount (₹)">
              <input type="number" min="0" step="0.01" value={billForm.taxAmount} onChange={(e) => setBillForm({ ...billForm, taxAmount: e.target.value })} />
            </Field>
            <Field label="Freight / Other Charges (₹)">
              <input type="number" min="0" step="0.01" value={billForm.otherCharges} onChange={(e) => setBillForm({ ...billForm, otherCharges: e.target.value })} />
            </Field>
          </div>
          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>Record Supplier Bill</button>
          </div>
        </form>
      </Modal>

      {/* 11. Modal: Release Payment Hold */}
      <Modal isOpen={modal?.type === 'releaseHold'} onClose={() => setModal(null)} title={`Release Payment Hold — ${modal?.row?.billNo || ''}`}>
        <form className={styles.form} onSubmit={submitReleaseHold}>
          <p className={styles.hint}>
            Hold Reason: <strong>{modal?.row?.holdReason || 'Unresolved GRN Discrepancy'}</strong>
            <br />
            Releasing full payment hold requires manager authorization and recorded justification.
          </p>
          <Field label="Hold Release Justification *">
            <textarea required rows="3" placeholder="Provide manager justification for releasing payment hold (e.g. credit note received, deviation resolved, replacement verified)..." value={holdReleaseReason} onChange={(e) => setHoldReleaseReason(e.target.value)} />
          </Field>
          <div className={styles.formActions}>
            <button type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.primary} disabled={saving}>Authorize &amp; Release Hold</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

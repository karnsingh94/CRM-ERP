'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import ServiceDepartments from '../departments/ServiceDepartments';
import styles from './PurchaseModule.module.css';

const TAB_ALIASES = { vendor: 'vendors', procurement: 'requests', grn: 'receipts', inspection: 'receipts' };
const EMPTY_VENDOR = { vendorCode: '', name: '', contact: '', email: '', phone: '', category: 'Raw Materials', taxId: '', address: '', paymentTerms: '30 Days', leadTimeDays: '7' };
const EMPTY_REQUEST = { department: '', requestedBy: '', requiredBy: '', purpose: '', notes: '' };
const EMPTY_QUOTE = { requestId: '', vendorId: '', vendorQuoteNo: '', validUntil: '', deliveryDays: '7', paymentTerms: '30 Days', taxAmount: '0', freightAmount: '0', notes: '' };
const EMPTY_ORDER = { expectedDate: '', deliveryAddress: '', paymentTerms: '', terms: '' };
const EMPTY_RECEIPT = { warehouse: 'Main Warehouse', notes: '' };
const EMPTY_BILL = { vendorInvoiceNo: '', invoiceDate: '', dueDate: '', taxableAmount: '', taxAmount: '', otherCharges: '', notes: '' };
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
  const success = ['ACTIVE', 'SELECTED', 'RECEIVED', 'PASSED', 'RETURNED', 'PAID', 'PO CREATED'].includes(status);
  const danger = ['REJECTED', 'QC REJECTED', 'CANCELLED'].includes(status);
  const warning = ['PENDING QUOTATION', 'PARTIALLY RECEIVED', 'PARTIAL', 'PENDING DISPATCH', 'UNPAID'].includes(status);
  return <span className={`${styles.badge} ${success ? styles.successTone : danger ? styles.dangerTone : warning ? styles.warningTone : ''}`}>{status}</span>;
}

function Table({ children }) {
  return <div className={styles.tableCard}><div className={styles.tableScroll}>{children}</div></div>;
}

function Field({ label, children }) {
  return <label className={styles.field}><span>{label}</span>{children}</label>;
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
  const [returns, setReturns] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState(null);
  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR);
  const [requestForm, setRequestForm] = useState(EMPTY_REQUEST);
  const [requestItems, setRequestItems] = useState([newRequestItem()]);
  const [quoteForm, setQuoteForm] = useState(EMPTY_QUOTE);
  const [quoteItems, setQuoteItems] = useState([]);
  const [orderForm, setOrderForm] = useState(EMPTY_ORDER);
  const [receiptForm, setReceiptForm] = useState(EMPTY_RECEIPT);
  const [receiptItems, setReceiptItems] = useState([]);
  const [billForm, setBillForm] = useState(EMPTY_BILL);

  useEffect(() => {
    setActiveTab(TAB_ALIASES[initialSubTab] || initialSubTab || 'overview');
  }, [initialSubTab]);

  const companyPath = activeCompany?.id ? `/companies/${activeCompany.id}/purchase` : '';
  const loadAll = useCallback(async () => {
    if (!companyPath) return;
    setLoading(true);
    setLoadError('');
    const endpoints = ['dashboard', 'vendors', 'requests', 'inventory-shortages', 'quotations', 'orders', 'warehouses', 'receipts', 'returns', 'bills'];
    const setters = [setDashboard, setVendors, setRequests, setInventoryShortages, setQuotations, setOrders, setWarehouses, setReceipts, setReturns, setBills];
    const results = await Promise.allSettled(endpoints.map((endpoint) => api.get(`${companyPath}/${endpoint}`, { noCache: true, timeout: 12000 })));
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') setters[index](result.value.data || (index === 0 ? null : []));
    });
    const serverError = results.find((result) => result.status === 'rejected' && ![403, 404].includes(result.reason?.status));
    if (serverError) setLoadError(serverError.reason?.message || 'Some purchase records could not be loaded.');
    setLoading(false);
  }, [companyPath]);

  useEffect(() => { loadAll(); }, [loadAll]);

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

  const submitVendor = (event) => {
    event.preventDefault();
    runAction(() => api.post(`${companyPath}/vendors`, vendorForm), 'Vendor registered', `${vendorForm.name} is ready for quotation requests.`);
  };

  const submitRequest = (event) => {
    event.preventDefault();
    runAction(() => api.post(`${companyPath}/requests`, { ...requestForm, items: requestItems }), 'Purchase request created', 'The material list is ready for vendor rates.');
  };

  const createRequestFromShortage = (shortage) => runAction(
    () => api.post(`${companyPath}/inventory-shortages/${shortage.id}/request`, {}),
    'Inventory shortage accepted', `${shortage.sku} is now in the vendor quotation flow.`,
  );

  const openQuote = (request) => {
    setQuoteForm({ ...EMPTY_QUOTE, requestId: request.id });
    setQuoteItems((Array.isArray(request.items) ? request.items : []).map((item) => ({ ...item, unitRate: '' })));
    setModal({ type: 'quote', row: request });
  };

  const submitQuote = (event) => {
    event.preventDefault();
    runAction(() => api.post(`${companyPath}/quotations`, { ...quoteForm, items: quoteItems }), 'Vendor rate saved', 'The quotation is available in the rate comparison.');
  };

  const selectQuotation = (quotation) => runAction(
    () => api.post(`${companyPath}/quotations/${quotation.id}/select`, {}),
    'Vendor selected', `${quotation.vendor.name} was selected for ${quotation.request.requestNo}.`,
  );

  const openOrder = (quotation) => {
    setOrderForm({ ...EMPTY_ORDER, paymentTerms: quotation.paymentTerms || '' });
    setModal({ type: 'order', row: quotation });
  };

  const submitOrder = (event) => {
    event.preventDefault();
    runAction(() => api.post(`${companyPath}/quotations/${modal.row.id}/order`, orderForm), 'Purchase order created', 'The PO is ready for vendor delivery and warehouse receipt.');
  };

  const openReceipt = (order) => {
    const accepted = new Map();
    (order.receipts || []).forEach((receipt) => (receipt.items || []).forEach((line) => accepted.set(line.sku, (accepted.get(line.sku) || 0) + Number(line.acceptedQty || 0))));
    const items = (order.items || []).map((item) => {
      const outstanding = Math.max(0, Number(item.qty) - (accepted.get(item.sku) || 0));
      return { ...item, receivedQty: String(outstanding), acceptedQty: String(outstanding), rejectedQty: '0', rejectionReason: '' };
    }).filter((item) => Number(item.receivedQty) > 0);
    setReceiptForm({ ...EMPTY_RECEIPT, warehouse: warehouseNames[0] });
    setReceiptItems(items);
    setModal({ type: 'receipt', row: order });
  };

  const submitReceipt = (event) => {
    event.preventDefault();
    runAction(() => api.post(`${companyPath}/orders/${modal.row.id}/receipts`, { ...receiptForm, items: receiptItems }), 'GRN recorded', 'Accepted material updated warehouse stock. Rejected material was added to the return queue.');
  };

  const dispatchReturn = (purchaseReturn) => runAction(
    () => api.post(`${companyPath}/returns/${purchaseReturn.id}/dispatch`, {}),
    'Return dispatched', `${purchaseReturn.returnNo} is marked as returned to the vendor.`,
  );

  const openBill = (order) => {
    setBillForm({ ...EMPTY_BILL, taxableAmount: String(order.subtotal || 0), taxAmount: String(order.taxAmount || 0), otherCharges: String(order.freightAmount || 0) });
    setModal({ type: 'bill', row: order });
  };

  const submitBill = (event) => {
    event.preventDefault();
    runAction(() => api.post(`${companyPath}/orders/${modal.row.id}/bills`, billForm), 'Purchase bill created', 'The vendor invoice is now tracked in the bill register.');
  };

  const payBill = (bill) => runAction(
    () => api.post(`${companyPath}/bills/${bill.id}/pay`, {}),
    'Bill marked paid', `${bill.billNo} has been closed as paid.`,
  );

  const tabs = [
    ['overview', 'Overview'], ['vendors', 'Vendors'], ['requests', 'Purchase Requests'], ['quotations', 'Rate Comparison'],
    ['orders', 'Purchase Orders'], ['receipts', 'Receipts & QC'], ['returns', 'Returns'], ['bills', 'Bills'], ['departments', 'Department Head'],
  ];

  const renderOverview = () => {
    const cards = [
      ['Active Vendors', dashboard?.vendors || 0, '🏢'], ['Open Requests', dashboard?.requests || 0, '📝'],
      ['Quotes to Compare', dashboard?.quotations || 0, '⚖️'], ['Open Purchase Orders', dashboard?.orders || 0, '📄'],
      ['Goods Receipts', dashboard?.receipts || 0, '📥'], ['Pending Returns', dashboard?.returns || 0, '↩️'],
      ['Unpaid Bills', dashboard?.unpaidBills || 0, '🧾'], ['Total Ordered Value', `₹${number(dashboard?.totalOrderedValue)}`, '💰'],
    ];
    return <><div className={styles.stats}>{cards.map(([label, value, icon]) => <div className={styles.stat} key={label}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>)}</div><div className={styles.sectionHeader}><div><h3>Recent Purchase Orders</h3><p>Latest orders issued to selected vendors.</p></div></div>{dashboard?.recentOrders?.length ? renderOrderTable(dashboard.recentOrders) : <EmptyState icon="📄" title="No Purchase Orders Yet" description="Create a purchase request, compare vendor quotations, and issue the first PO." />}</>;
  };

  const renderVendors = () => <>
    <div className={styles.sectionHeader}><div><h3>Vendor Directory</h3><p>Register suppliers before requesting prices or creating purchase orders.</p></div><button className={styles.primary} onClick={() => { setVendorForm(EMPTY_VENDOR); setModal({ type: 'vendor' }); }}>+ Register Vendor</button></div>
    {vendors.length ? <Table><table><thead><tr><th>Vendor</th><th>Contact</th><th>Category</th><th>Tax / Terms</th><th>Lead Time</th><th>Activity</th><th>Status</th></tr></thead><tbody>{vendors.map((vendor) => <tr key={vendor.id}><td><strong>{vendor.vendorCode || '—'}</strong><small>{vendor.name}</small></td><td>{vendor.contact || '—'}<small>{[vendor.email, vendor.phone].filter(Boolean).join(' • ') || 'No contact details'}</small></td><td>{vendor.category}</td><td>{vendor.taxId || '—'}<small>{vendor.paymentTerms || '—'}</small></td><td>{vendor.leadTimeDays} day(s)</td><td>{vendor._count?.quotations || 0} quotes<small>{vendor._count?.purchaseOrders || 0} orders</small></td><td><Status value={vendor.status} /></td></tr>)}</tbody></table></Table> : <EmptyState icon="🏢" title="No Vendors Registered" description="Register the first supplier to begin rate collection." actionLabel="Register Vendor" onAction={() => setModal({ type: 'vendor' })} />}
  </>;

  const renderRequests = () => <>
    <div className={styles.sectionHeader}><div><h3>Material Purchase Requests</h3><p>Prepare the raw-material list and required quantity before collecting vendor rates.</p></div><button className={styles.primary} onClick={() => { setRequestForm(EMPTY_REQUEST); setRequestItems([newRequestItem()]); setModal({ type: 'request' }); }}>+ New Purchase Request</button></div>
    {inventoryShortages.length > 0 && <><div className={styles.sectionHeader}><div><h3>Production Shortages from Inventory</h3><p>Convert these automatic shortages into purchase requests without entering the material again.</p></div></div><Table><table><thead><tr><th>Inventory Request</th><th>Required For</th><th>Raw Material</th><th>Outstanding</th><th>Status</th><th></th></tr></thead><tbody>{inventoryShortages.map((shortage) => <tr key={shortage.id}><td><strong>{shortage.requestNo}</strong><small>{date(shortage.createdAt)}</small></td><td>{shortage.materialRequest?.productName}<small>{shortage.materialRequest?.requestNo}</small></td><td><strong>{shortage.sku}</strong><small>{shortage.itemName}</small></td><td>{shortage.requiredQty - shortage.receivedQty} {shortage.uom}</td><td><Status value={shortage.purchaseRequest?.status || shortage.status} /></td><td className={styles.actions}>{shortage.purchaseRequest ? <small>{shortage.purchaseRequest.requestNo}</small> : <button onClick={() => createRequestFromShortage(shortage)}>Create Purchase Request</button>}</td></tr>)}</tbody></table></Table></>}
    {requests.length ? <Table><table><thead><tr><th>Request</th><th>Department / Purpose</th><th>Material List</th><th>Required By</th><th>Quotes</th><th>Status</th><th></th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td><strong>{request.requestNo}</strong><small>{date(request.requestDate)}</small></td><td>{request.department || 'General'}<small>{request.purpose || '—'}</small></td><td>{(request.items || []).map((item) => `${item.sku} × ${item.qty} ${item.uom}`).join(', ')}</td><td>{date(request.requiredBy)}</td><td>{request.quotations?.length || 0}</td><td><Status value={request.status} /></td><td className={styles.actions}>{request.status !== 'PO_CREATED' && <button onClick={() => openQuote(request)}>Add Vendor Rate</button>}</td></tr>)}</tbody></table></Table> : <EmptyState icon="📝" title="No Purchase Requests" description="Create a material list to start the vendor quotation process." />}
  </>;

  const renderQuotations = () => quotations.length ? <Table><table><thead><tr><th>Request</th><th>Vendor</th><th>Quoted Materials</th><th>Subtotal</th><th>Tax + Freight</th><th>Total</th><th>Delivery</th><th>Status</th><th></th></tr></thead><tbody>{quotations.map((quotation) => <tr key={quotation.id}><td><strong>{quotation.request.requestNo}</strong><small>{quotation.quoteNo}</small></td><td><strong>{quotation.vendor.name}</strong><small>{quotation.vendorQuoteNo || 'Internal quote'}</small></td><td>{(quotation.items || []).map((item) => `${item.sku}: ₹${number(item.unitRate)}`).join(', ')}</td><td>₹{number(quotation.subtotal)}</td><td>₹{number(Number(quotation.taxAmount) + Number(quotation.freightAmount))}</td><td className={styles.compare}>₹{number(quotation.totalAmount)}</td><td>{quotation.deliveryDays} day(s)<small>{quotation.paymentTerms || '—'}</small></td><td><Status value={quotation.status} /></td><td className={styles.actions}>{quotation.status === 'RECEIVED' && <button onClick={() => selectQuotation(quotation)}>Select Vendor</button>}{quotation.status === 'SELECTED' && !quotation.purchaseOrder && <button className={styles.success} onClick={() => openOrder(quotation)}>Create PO</button>}{quotation.purchaseOrder && <small>{quotation.purchaseOrder.poNumber}</small>}</td></tr>)}</tbody></table></Table> : <EmptyState icon="⚖️" title="No Vendor Quotations" description="Open a purchase request and enter rates received from each vendor." />;

  function renderOrderTable(orderRows = orders) {
    return <Table><table><thead><tr><th>Purchase Order</th><th>Vendor</th><th>Materials</th><th>Order Value</th><th>Expected</th><th>Status</th><th></th></tr></thead><tbody>{orderRows.map((order) => <tr key={order.id}><td><strong>{order.poNumber}</strong><small>{date(order.orderDate)}</small></td><td>{order.vendor?.name || '—'}</td><td>{(order.items || []).map((item) => `${item.sku} × ${item.qty}`).join(', ')}</td><td><strong>₹{number(order.totalAmount)}</strong></td><td>{date(order.expectedDate)}</td><td><Status value={order.status} /></td><td className={styles.actions}>{!['RECEIVED', 'CLOSED', 'CANCELLED'].includes(order.status) && <button onClick={() => openReceipt(order)}>Receive / QC</button>}{order.receipts?.some((receipt) => receipt.acceptedQty > 0) && !order.bill && <button onClick={() => openBill(order)}>Create Bill</button>}</td></tr>)}</tbody></table></Table>;
  }

  const renderOrders = () => orders.length ? renderOrderTable() : <EmptyState icon="📄" title="No Purchase Orders" description="Select a vendor quotation and create the purchase order." />;

  const renderReceipts = () => receipts.length ? <Table><table><thead><tr><th>GRN</th><th>Purchase Order / Vendor</th><th>Warehouse</th><th>Received</th><th>Accepted</th><th>Rejected</th><th>QC</th><th>Date</th></tr></thead><tbody>{receipts.map((receipt) => <tr key={receipt.id}><td><strong>{receipt.grnNo}</strong></td><td>{receipt.order.poNumber}<small>{receipt.order.vendor.name}</small></td><td>{receipt.warehouse}</td><td>{receipt.receivedQty}</td><td className={styles.compare}>{receipt.acceptedQty}</td><td>{receipt.rejectedQty}</td><td><Status value={receipt.qcStatus} /></td><td>{date(receipt.receivedAt)}</td></tr>)}</tbody></table></Table> : <EmptyState icon="📥" title="No Goods Receipts" description="Receive material against an issued purchase order. Accepted quantity will update warehouse stock." />;

  const renderReturns = () => returns.length ? <Table><table><thead><tr><th>Return</th><th>GRN / PO</th><th>Vendor</th><th>Rejected Materials</th><th>Total Qty</th><th>Status</th><th></th></tr></thead><tbody>{returns.map((purchaseReturn) => <tr key={purchaseReturn.id}><td><strong>{purchaseReturn.returnNo}</strong><small>{date(purchaseReturn.createdAt)}</small></td><td>{purchaseReturn.receipt.grnNo}<small>{purchaseReturn.order.poNumber}</small></td><td>{purchaseReturn.order.vendor.name}</td><td>{(purchaseReturn.items || []).map((item) => `${item.sku} × ${item.qty}: ${item.reason}`).join(', ')}</td><td>{purchaseReturn.totalQty}</td><td><Status value={purchaseReturn.status} /></td><td className={styles.actions}>{purchaseReturn.status === 'PENDING_DISPATCH' && <button onClick={() => dispatchReturn(purchaseReturn)}>Dispatch Return</button>}</td></tr>)}</tbody></table></Table> : <EmptyState icon="↩️" title="No Purchase Returns" description="Rejected GRN quantities automatically appear here for return to the vendor." />;

  const renderBills = () => bills.length ? <Table><table><thead><tr><th>Bill</th><th>Vendor Invoice</th><th>PO / Vendor</th><th>Invoice Date</th><th>Due Date</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>{bills.map((bill) => <tr key={bill.id}><td><strong>{bill.billNo}</strong></td><td>{bill.vendorInvoiceNo}</td><td>{bill.order.poNumber}<small>{bill.order.vendor.name}</small></td><td>{date(bill.invoiceDate)}</td><td>{date(bill.dueDate)}</td><td><strong>₹{number(bill.totalAmount)}</strong></td><td><Status value={bill.status} /></td><td className={styles.actions}>{bill.status !== 'PAID' && <button className={styles.success} onClick={() => payBill(bill)}>Mark Paid</button>}</td></tr>)}</tbody></table></Table> : <EmptyState icon="🧾" title="No Purchase Bills" description="Create a vendor bill after accepted material is received against a purchase order." />;

  const content = activeTab === 'overview' ? renderOverview() : activeTab === 'vendors' ? renderVendors() : activeTab === 'requests' ? renderRequests() : activeTab === 'quotations' ? renderQuotations() : activeTab === 'orders' ? renderOrders() : activeTab === 'receipts' ? renderReceipts() : activeTab === 'returns' ? renderReturns() : activeTab === 'bills' ? renderBills() : <ServiceDepartments activeCompany={activeCompany} serviceCode="purchase_vendor" showToast={showToast} />;

  return <div className={styles.module}>
    <header className={styles.header}><div><span className={styles.eyebrow}>Complete Procure-to-Pay Control</span><h2>Purchase &amp; Vendor Management</h2><p>Register vendors, compare rates, issue purchase orders, inspect receipts, return rejected material, update warehouse stock and create vendor bills for {activeCompany?.organizationName}.</p></div><button onClick={loadAll} disabled={loading}>{loading ? 'Refreshing…' : '↻ Refresh'}</button></header>
    <div className={styles.flow}><span>Register Vendor</span><b>→</b><span>Purchase Request</span><b>→</b><span>Collect &amp; Compare Rates</span><b>→</b><span>Select Vendor</span><b>→</b><span>Purchase Order</span><b>→</b><span>GRN &amp; Quality Check</span><b>→</b><span>Warehouse Stock / Return</span><b>→</b><span>Purchase Bill</span></div>
    <nav className={styles.tabs}>{tabs.map(([key, label]) => <button key={key} className={activeTab === key ? styles.active : ''} onClick={() => setActiveTab(key)}>{label}</button>)}</nav>
    {loadError && <div className={styles.error}>{loadError}</div>}
    {loading && !dashboard ? <div className={styles.loading}>Loading purchase records…</div> : content}

    <Modal isOpen={modal?.type === 'vendor'} onClose={() => setModal(null)} title="Register Vendor" maxWidth="760px"><form className={styles.form} onSubmit={submitVendor}><div className={styles.formGrid}><Field label="Vendor Code"><input value={vendorForm.vendorCode} onChange={(e) => setVendorForm({ ...vendorForm, vendorCode: e.target.value })} placeholder="Auto-generated if blank" /></Field><Field label="Vendor Company Name *"><input required value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} /></Field><Field label="Contact Person"><input value={vendorForm.contact} onChange={(e) => setVendorForm({ ...vendorForm, contact: e.target.value })} /></Field><Field label="Category"><select value={vendorForm.category} onChange={(e) => setVendorForm({ ...vendorForm, category: e.target.value })}><option>Raw Materials</option><option>Packaging Materials</option><option>Machinery Parts</option><option>Services</option></select></Field><Field label="Email"><input type="email" value={vendorForm.email} onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })} /></Field><Field label="Phone"><input value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} /></Field><Field label="GST / Tax ID"><input value={vendorForm.taxId} onChange={(e) => setVendorForm({ ...vendorForm, taxId: e.target.value })} /></Field><Field label="Payment Terms"><input value={vendorForm.paymentTerms} onChange={(e) => setVendorForm({ ...vendorForm, paymentTerms: e.target.value })} /></Field><Field label="Lead Time (days)"><input type="number" min="0" value={vendorForm.leadTimeDays} onChange={(e) => setVendorForm({ ...vendorForm, leadTimeDays: e.target.value })} /></Field></div><Field label="Address"><textarea rows="2" value={vendorForm.address} onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })} /></Field><div className={styles.formActions}><button type="button" onClick={() => setModal(null)}>Cancel</button><button className={styles.primary} disabled={saving}>Save Vendor</button></div></form></Modal>

    <Modal isOpen={modal?.type === 'request'} onClose={() => setModal(null)} title="Create Purchase Request" maxWidth="900px"><form className={styles.form} onSubmit={submitRequest}><div className={styles.formGrid}><Field label="Department"><input value={requestForm.department} onChange={(e) => setRequestForm({ ...requestForm, department: e.target.value })} /></Field><Field label="Requested By"><input value={requestForm.requestedBy} onChange={(e) => setRequestForm({ ...requestForm, requestedBy: e.target.value })} /></Field><Field label="Required By"><input type="date" value={requestForm.requiredBy} onChange={(e) => setRequestForm({ ...requestForm, requiredBy: e.target.value })} /></Field><Field label="Purpose"><input value={requestForm.purpose} onChange={(e) => setRequestForm({ ...requestForm, purpose: e.target.value })} placeholder="Production, maintenance, packing…" /></Field></div>{requestItems.map((item, index) => <div className={styles.lineRow} key={index}><input required placeholder="SKU" value={item.sku} onChange={(e) => setRequestItems(requestItems.map((row, i) => i === index ? { ...row, sku: e.target.value } : row))} /><input required placeholder="Material name" value={item.name} onChange={(e) => setRequestItems(requestItems.map((row, i) => i === index ? { ...row, name: e.target.value } : row))} /><input required type="number" min="1" placeholder="Qty" value={item.qty} onChange={(e) => setRequestItems(requestItems.map((row, i) => i === index ? { ...row, qty: e.target.value } : row))} /><input required placeholder="UOM" value={item.uom} onChange={(e) => setRequestItems(requestItems.map((row, i) => i === index ? { ...row, uom: e.target.value } : row))} /><button type="button" disabled={requestItems.length === 1} onClick={() => setRequestItems(requestItems.filter((_, i) => i !== index))}>×</button></div>)}<button type="button" className={styles.addLine} onClick={() => setRequestItems([...requestItems, newRequestItem()])}>+ Add Material</button><Field label="Notes"><textarea rows="2" value={requestForm.notes} onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })} /></Field><div className={styles.formActions}><button type="button" onClick={() => setModal(null)}>Cancel</button><button className={styles.primary} disabled={saving}>Create Request</button></div></form></Modal>

    <Modal isOpen={modal?.type === 'quote'} onClose={() => setModal(null)} title={`Add Vendor Rate — ${modal?.row?.requestNo || ''}`} maxWidth="900px"><form className={styles.form} onSubmit={submitQuote}><div className={styles.formGrid}><Field label="Vendor *"><select required value={quoteForm.vendorId} onChange={(e) => { const vendor = vendors.find((row) => row.id === e.target.value); setQuoteForm({ ...quoteForm, vendorId: e.target.value, deliveryDays: String(vendor?.leadTimeDays || 7), paymentTerms: vendor?.paymentTerms || '30 Days' }); }}><option value="">Select vendor</option>{vendors.filter((vendor) => vendor.status === 'ACTIVE').map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.vendorCode} — {vendor.name}</option>)}</select></Field><Field label="Vendor Quote Number"><input value={quoteForm.vendorQuoteNo} onChange={(e) => setQuoteForm({ ...quoteForm, vendorQuoteNo: e.target.value })} /></Field><Field label="Delivery Days"><input required type="number" min="1" value={quoteForm.deliveryDays} onChange={(e) => setQuoteForm({ ...quoteForm, deliveryDays: e.target.value })} /></Field><Field label="Payment Terms"><input value={quoteForm.paymentTerms} onChange={(e) => setQuoteForm({ ...quoteForm, paymentTerms: e.target.value })} /></Field><Field label="Valid Until"><input type="date" value={quoteForm.validUntil} onChange={(e) => setQuoteForm({ ...quoteForm, validUntil: e.target.value })} /></Field></div><div className={`${styles.lineRow} ${styles.quoteRow}`}><strong>SKU</strong><strong>Material</strong><strong>Qty</strong><strong>Rate</strong><strong>Line Total</strong></div>{quoteItems.map((item, index) => <div className={`${styles.lineRow} ${styles.quoteRow}`} key={item.sku}><input disabled value={item.sku} /><input disabled value={item.name} /><input disabled value={`${item.qty} ${item.uom}`} /><input required type="number" min="0.01" step="0.01" placeholder="Unit rate" value={item.unitRate} onChange={(e) => setQuoteItems(quoteItems.map((row, i) => i === index ? { ...row, unitRate: e.target.value } : row))} /><input disabled value={`₹${number(Number(item.qty) * Number(item.unitRate))}`} /></div>)}<div className={styles.formGrid}><Field label="Tax Amount (₹)"><input type="number" min="0" step="0.01" value={quoteForm.taxAmount} onChange={(e) => setQuoteForm({ ...quoteForm, taxAmount: e.target.value })} /></Field><Field label="Freight Amount (₹)"><input type="number" min="0" step="0.01" value={quoteForm.freightAmount} onChange={(e) => setQuoteForm({ ...quoteForm, freightAmount: e.target.value })} /></Field></div><Field label="Notes"><textarea rows="2" value={quoteForm.notes} onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })} /></Field><div className={styles.formActions}><button type="button" onClick={() => setModal(null)}>Cancel</button><button className={styles.primary} disabled={saving}>Save Vendor Rate</button></div></form></Modal>

    <Modal isOpen={modal?.type === 'order'} onClose={() => setModal(null)} title={`Create Purchase Order — ${modal?.row?.vendor?.name || ''}`}><form className={styles.form} onSubmit={submitOrder}><p className={styles.hint}>Selected quotation: <strong>{modal?.row?.quoteNo}</strong> • Total: <strong>₹{number(modal?.row?.totalAmount)}</strong></p><div className={styles.formGrid}><Field label="Expected Delivery Date"><input type="date" value={orderForm.expectedDate} onChange={(e) => setOrderForm({ ...orderForm, expectedDate: e.target.value })} /></Field><Field label="Payment Terms"><input value={orderForm.paymentTerms} onChange={(e) => setOrderForm({ ...orderForm, paymentTerms: e.target.value })} /></Field></div><Field label="Delivery Address"><textarea rows="2" value={orderForm.deliveryAddress} onChange={(e) => setOrderForm({ ...orderForm, deliveryAddress: e.target.value })} /></Field><Field label="Purchase Terms"><textarea rows="2" value={orderForm.terms} onChange={(e) => setOrderForm({ ...orderForm, terms: e.target.value })} /></Field><div className={styles.formActions}><button type="button" onClick={() => setModal(null)}>Cancel</button><button className={styles.primary} disabled={saving}>Issue Purchase Order</button></div></form></Modal>

    <Modal isOpen={modal?.type === 'receipt'} onClose={() => setModal(null)} title={`Receive & Inspect — ${modal?.row?.poNumber || ''}`} maxWidth="1000px"><form className={styles.form} onSubmit={submitReceipt}><div className={styles.formGrid}><Field label="Receiving Warehouse"><select value={receiptForm.warehouse} onChange={(e) => setReceiptForm({ ...receiptForm, warehouse: e.target.value })}>{warehouseNames.map((name) => <option key={name}>{name}</option>)}</select></Field></div><div className={`${styles.lineRow} ${styles.receiptRow}`}><strong>SKU</strong><strong>Material</strong><strong>Received</strong><strong>Accepted</strong><strong>Rejected</strong><strong>Rejection Reason</strong></div>{receiptItems.map((item, index) => <div className={`${styles.lineRow} ${styles.receiptRow}`} key={item.sku}><input disabled value={item.sku} /><input disabled value={item.name} /><input required type="number" min="1" value={item.receivedQty} onChange={(e) => setReceiptItems(receiptItems.map((row, i) => i === index ? { ...row, receivedQty: e.target.value } : row))} /><input required type="number" min="0" value={item.acceptedQty} onChange={(e) => setReceiptItems(receiptItems.map((row, i) => i === index ? { ...row, acceptedQty: e.target.value } : row))} /><input required type="number" min="0" value={item.rejectedQty} onChange={(e) => setReceiptItems(receiptItems.map((row, i) => i === index ? { ...row, rejectedQty: e.target.value } : row))} /><input value={item.rejectionReason} onChange={(e) => setReceiptItems(receiptItems.map((row, i) => i === index ? { ...row, rejectionReason: e.target.value } : row))} placeholder="Required when rejected" /></div>)}{receiptItems.length === 0 && <div className={styles.error}>All ordered quantities are already accepted.</div>}<Field label="GRN Notes"><textarea rows="2" value={receiptForm.notes} onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })} /></Field><div className={styles.formActions}><button type="button" onClick={() => setModal(null)}>Cancel</button><button className={styles.primary} disabled={saving || receiptItems.length === 0}>Post GRN &amp; Update Stock</button></div></form></Modal>

    <Modal isOpen={modal?.type === 'bill'} onClose={() => setModal(null)} title={`Create Purchase Bill — ${modal?.row?.poNumber || ''}`}><form className={styles.form} onSubmit={submitBill}><div className={styles.formGrid}><Field label="Vendor Invoice Number *"><input required value={billForm.vendorInvoiceNo} onChange={(e) => setBillForm({ ...billForm, vendorInvoiceNo: e.target.value })} /></Field><Field label="Invoice Date"><input type="date" value={billForm.invoiceDate} onChange={(e) => setBillForm({ ...billForm, invoiceDate: e.target.value })} /></Field><Field label="Due Date"><input type="date" value={billForm.dueDate} onChange={(e) => setBillForm({ ...billForm, dueDate: e.target.value })} /></Field><Field label="Taxable Amount (₹)"><input type="number" min="0" step="0.01" value={billForm.taxableAmount} onChange={(e) => setBillForm({ ...billForm, taxableAmount: e.target.value })} /></Field><Field label="Tax Amount (₹)"><input type="number" min="0" step="0.01" value={billForm.taxAmount} onChange={(e) => setBillForm({ ...billForm, taxAmount: e.target.value })} /></Field><Field label="Freight / Other Charges (₹)"><input type="number" min="0" step="0.01" value={billForm.otherCharges} onChange={(e) => setBillForm({ ...billForm, otherCharges: e.target.value })} /></Field></div><Field label="Notes"><textarea rows="2" value={billForm.notes} onChange={(e) => setBillForm({ ...billForm, notes: e.target.value })} /></Field><div className={styles.formActions}><button type="button" onClick={() => setModal(null)}>Cancel</button><button className={styles.primary} disabled={saving}>Create Bill</button></div></form></Modal>
  </div>;
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import ServiceDepartments from '../departments/ServiceDepartments';
import styles from './InventoryModule.module.css';

const EMPTY_STOCK = {
  productId: '', binId: '', sku: '', name: '', itemType: 'RAW_MATERIAL', warehouse: 'Main Warehouse',
  stock: '0', reorderLevel: '10', uom: 'PCS', binLocation: '', averageCost: '0',
};
const EMPTY_WAREHOUSE = { code: '', name: '', address: '', contactName: '', contactPhone: '', isDefault: false };
const EMPTY_BIN = { code: '', aisle: '', rack: '', description: '' };
const EMPTY_TRANSFER = { fromWarehouse: '', toWarehouse: '', notes: '' };
const EMPTY_ADJUSTMENT = { qtyDiff: '', reason: 'PHYSICAL_COUNT_RECONCILIATION', notes: '' };
const EMPTY_PURCHASE = { receivedQty: '', vendorName: '', unitCost: '', warehouse: 'Main Warehouse', notes: '' };
const EMPTY_PRODUCTION = { producedQty: '', wasteQty: '0', wasteReason: '', warehouse: 'Main Warehouse', unitCost: '', notes: '' };
const newMaterial = () => ({ sku: '', name: '', qty: '', uom: 'PCS' });

const TAB_ALIASES = {
  adjustments: 'stock', valuations: 'movements', bins: 'warehouses',
};

function number(value) {
  return Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function dateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function Status({ value }) {
  const tone = value === 'FULFILLED' || value === 'COMPLETED' || value === 'RECEIVED'
    ? 'success'
    : value === 'WAITING_PURCHASE' || value === 'MANUFACTURING_REQUIRED' || value === 'PENDING_PURCHASE'
      ? 'warning'
      : value === 'CANCELLED'
        ? 'danger'
        : 'info';
  return <span className={`${styles.badge} ${styles[tone]}`}>{String(value || 'PENDING').replaceAll('_', ' ')}</span>;
}

function TableShell({ children }) {
  return <div className={styles.tableCard}><div className={styles.tableScroll}>{children}</div></div>;
}

function FormField({ label, children }) {
  return <label className={styles.field}><span>{label}</span>{children}</label>;
}

export default function InventoryModule({ activeCompany, showToast, initialSubTab }) {
  const initialTab = TAB_ALIASES[initialSubTab] || initialSubTab || 'dashboard';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [dashboard, setDashboard] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [materialRequests, setMaterialRequests] = useState([]);
  const [procurements, setProcurements] = useState([]);
  const [movements, setMovements] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState(null);
  const [stockForm, setStockForm] = useState(EMPTY_STOCK);
  const [warehouseForm, setWarehouseForm] = useState(EMPTY_WAREHOUSE);
  const [binForm, setBinForm] = useState(EMPTY_BIN);
  const [transferForm, setTransferForm] = useState(EMPTY_TRANSFER);
  const [transferItems, setTransferItems] = useState([{ sku: '', qty: '' }]);
  const [adjustForm, setAdjustForm] = useState(EMPTY_ADJUSTMENT);
  const [locationBinId, setLocationBinId] = useState('');
  const [materials, setMaterials] = useState([newMaterial()]);
  const [purchaseForm, setPurchaseForm] = useState(EMPTY_PURCHASE);
  const [productionForm, setProductionForm] = useState(EMPTY_PRODUCTION);
  const [productionReturns, setProductionReturns] = useState([]);

  useEffect(() => {
    setActiveTab(TAB_ALIASES[initialSubTab] || initialSubTab || 'dashboard');
  }, [initialSubTab]);

  const companyPath = activeCompany?.id ? `/companies/${activeCompany.id}/inventory` : '';
  const loadAll = useCallback(async () => {
    if (!companyPath) return;
    setLoading(true);
    setLoadError('');
    const endpoints = ['dashboard', 'stocks', 'products', 'sales-orders', 'material-requests', 'procurements', 'movements', 'warehouses', 'transfers'];
    const results = await Promise.allSettled(endpoints.map((endpoint) => api.get(`${companyPath}/${endpoint}`, { noCache: true, timeout: 12000 })));
    const setters = [setDashboard, setStocks, setProducts, setOrders, setMaterialRequests, setProcurements, setMovements, setWarehouses, setTransfers];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') setters[index](result.value.data || (index === 0 ? null : []));
    });
    const firstError = results.find((result) => result.status === 'rejected');
    if (firstError) setLoadError(firstError.reason?.message || 'Some inventory data could not be loaded.');
    setLoading(false);
  }, [companyPath]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const warehouseNames = useMemo(() => {
    const names = new Set(['Main Warehouse']);
    warehouses.forEach((warehouse) => names.add(warehouse.name));
    stocks.forEach((stock) => names.add(stock.warehouse));
    return Array.from(names);
  }, [stocks, warehouses]);
  const selectedWarehouseBins = warehouses.find((warehouse) => warehouse.name === stockForm.warehouse)?.bins || [];
  const sourceWarehouseStocks = stocks.filter((stock) => stock.warehouse === transferForm.fromWarehouse && stock.stock > 0);
  const locationBins = warehouses.find((warehouse) => warehouse.name === modal?.row?.warehouse)?.bins || [];

  const runAction = async (action, successTitle, successMessage) => {
    setSaving(true);
    try {
      await action();
      setModal(null);
      await loadAll();
      showToast(successTitle, successMessage, 'success');
    } catch (error) {
      showToast('Inventory action failed', error.message || 'Please try again.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const submitStock = (event) => {
    event.preventDefault();
    runAction(() => api.post(`${companyPath}/stocks`, stockForm), 'Stock item created', `${stockForm.sku.toUpperCase()} is now tracked in the warehouse ledger.`);
  };

  const submitWarehouse = (event) => {
    event.preventDefault();
    runAction(() => api.post(`${companyPath}/warehouses`, warehouseForm), 'Warehouse created', `${warehouseForm.name} is ready for stock allocation.`);
  };

  const submitBin = (event) => {
    event.preventDefault();
    runAction(() => api.post(`${companyPath}/warehouses/${modal.row.id}/bins`, binForm), 'Bin/Rack added', `${binForm.code.toUpperCase()} is ready in ${modal.row.name}.`);
  };

  const openTransfer = () => {
    const fromWarehouse = warehouseNames[0] || '';
    const toWarehouse = warehouseNames.find((name) => name !== fromWarehouse) || '';
    setTransferForm({ ...EMPTY_TRANSFER, fromWarehouse, toWarehouse });
    setTransferItems([{ sku: '', qty: '' }]);
    setModal({ type: 'transfer' });
  };

  const submitTransfer = (event) => {
    event.preventDefault();
    runAction(() => api.post(`${companyPath}/transfers`, { ...transferForm, items: transferItems }), 'Transfer started', 'Source warehouse stock is reduced. Destination warehouse can now receive it.');
  };

  const receiveTransfer = (transfer) => runAction(
    () => api.post(`${companyPath}/transfers/${transfer.id}/receive`, {}),
    'Transfer received', `${transfer.toWarehouse} stock has been updated.`,
  );

  const submitAdjustment = (event) => {
    event.preventDefault();
    runAction(() => api.patch(`${companyPath}/stocks/${modal.row.id}/adjust`, adjustForm), 'Stock adjusted', `${modal.row.sku} balance and movement ledger were updated.`);
  };

  const submitLocation = (event) => {
    event.preventDefault();
    runAction(() => api.patch(`${companyPath}/stocks/${modal.row.id}/location`, { binId: locationBinId }), 'Bin updated', `${modal.row.sku} is now linked to the selected bin/rack.`);
  };

  const processOrder = (order) => runAction(
    () => api.post(`${companyPath}/sales-orders/${order.id}/process`, {}),
    'Sales order processed', 'Stock was dispatched, or a manufacturing request was created for the shortage.',
  );

  const openMaterials = (request) => {
    setMaterials(Array.isArray(request.rawMaterials) && request.rawMaterials.length ? request.rawMaterials : [newMaterial()]);
    setModal({ type: 'materials', row: request });
  };

  const submitMaterials = (event) => {
    event.preventDefault();
    runAction(() => api.put(`${companyPath}/material-requests/${modal.row.id}/materials`, { materials }), 'Material list checked', 'Available materials are ready to issue; shortages were sent to purchase.');
  };

  const issueMaterials = (request) => runAction(
    () => api.post(`${companyPath}/material-requests/${request.id}/issue`, {}),
    'Materials issued', `${request.requestNo} raw materials were deducted and issued to production.`,
  );

  const openPurchase = (request) => {
    setPurchaseForm({ ...EMPTY_PURCHASE, receivedQty: String(request.requiredQty - request.receivedQty), warehouse: warehouseNames[0] });
    setModal({ type: 'purchase', row: request });
  };

  const submitPurchase = (event) => {
    event.preventDefault();
    runAction(() => api.post(`${companyPath}/procurements/${modal.row.id}/receive`, purchaseForm), 'Purchase received', `${modal.row.sku} was added to stock with vendor and cost details.`);
  };

  const openProduction = (request) => {
    setProductionForm({ ...EMPTY_PRODUCTION, producedQty: String(request.requestedQty), warehouse: warehouseNames[0] });
    setProductionReturns(Array.isArray(request.rawMaterials) ? request.rawMaterials.map((item) => ({ ...item, returnQty: '0' })) : []);
    setModal({ type: 'production', row: request });
  };

  const submitProduction = (event) => {
    event.preventDefault();
    const returnedMaterials = productionReturns.filter((item) => Number(item.returnQty) > 0).map((item) => ({ sku: item.sku, qty: item.returnQty }));
    runAction(() => api.post(`${companyPath}/material-requests/${modal.row.id}/production-receipt`, { ...productionForm, returnedMaterials }), 'Production received', 'Finished goods, unused material return, wastage and order update are recorded.');
  };

  const tabs = [
    ['dashboard', 'Overview'], ['orders', 'Sales Orders'], ['stock', 'Products & Stock'],
    ['manufacturing', 'Production Flow'], ['purchases', 'Material Purchasing'],
    ['transfers', 'Warehouse Transfer'], ['movements', 'Movement Ledger'], ['warehouses', 'Warehouse / Bin'], ['departments', 'Department Head'],
  ];

  const renderDashboard = () => {
    const cards = [
      ['Tracked SKUs', dashboard?.totalSkus || 0, '📦'], ['Units On Hand', number(dashboard?.totalUnits), '🧮'],
      ['Low Stock', dashboard?.lowStock || 0, '⚠️'], ['Stock Value', `₹${number(dashboard?.stockValue)}`, '💰'],
      ['Orders in Flow', dashboard?.openOrders || 0, '🛒'], ['Material Requests', dashboard?.openMaterials || 0, '🏭'],
      ['Purchase Shortages', dashboard?.openPurchases || 0, '🚚'], ['Active Warehouses', dashboard?.warehouses || 0, '🏢'],
      ['Raw Material Purchased', number(dashboard?.movementTotals?.PURCHASE_RECEIPT), '🧾'],
      ['Issued to Production', number(dashboard?.movementTotals?.PRODUCTION_ISSUE), '↗️'],
      ['Finished Goods Received', number(dashboard?.movementTotals?.PRODUCTION_RECEIPT), '↘️'],
      ['Production Wastage', number(dashboard?.movementTotals?.PRODUCTION_WASTAGE), '♻️'],
      ['Material Returned', number(dashboard?.movementTotals?.PRODUCTION_RETURN), '↩️'],
      ['Warehouse Transfer', number(dashboard?.movementTotals?.WAREHOUSE_TRANSFER_OUT), '🔁'],
    ];
    return <><div className={styles.stats}>{cards.map(([label, value, icon]) => <div className={styles.stat} key={label}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>)}</div><div className={styles.sectionHeader}><div><h3>Recent inventory activity</h3><p>Latest stock-in, stock-out, production and wastage entries.</p></div></div>{dashboard?.recentMovements?.length ? renderMovements(dashboard.recentMovements) : <EmptyState icon="📒" title="No ledger activity yet" description="Create an opening stock balance or process a sales order to start the movement ledger." />}</>;
  };

  const renderOrders = () => orders.length ? <TableShell><table><thead><tr><th>Sales Order</th><th>Customer</th><th>Items</th><th>Order Status</th><th>Inventory Flow</th><th></th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong>{order.orderNo}</strong><small>{dateTime(order.date)}</small></td><td>{order.customer}</td><td>{Array.isArray(order.items) ? order.items.map((item) => `${item.item || item.name} × ${item.qty || item.quantity}`).join(', ') : `${order.itemsCount} item(s)`}</td><td><Status value={order.status} /></td><td><Status value={order.inventoryFulfillment?.status || 'NOT CHECKED'} /></td><td className={styles.actions}><button disabled={saving || order.inventoryFulfillment?.status === 'FULFILLED'} onClick={() => processOrder(order)}>{order.inventoryFulfillment?.status === 'FULFILLED' ? 'Dispatched' : 'Check & Process'}</button></td></tr>)}</tbody></table></TableShell> : <EmptyState icon="🛒" title="No approved sales orders" description="Approved or confirmed sales orders will appear here for stock checking and fulfilment." />;

  const addProductToStock = (product) => {
    setStockForm({
      ...EMPTY_STOCK,
      productId: product.id,
      sku: product.sku,
      name: product.name,
      itemType: 'FINISHED_GOOD',
      uom: product.uom,
      averageCost: String(product.purchasePrice || 0),
      warehouse: warehouseNames[0],
    });
    setModal({ type: 'stock' });
  };

  const renderStock = () => <>
    <div className={styles.sectionHeader}><div><h3>Products and Stock</h3><p>All Product Master items appear here. Stock updates automatically after production or purchase.</p></div><button className={styles.primary} onClick={() => { setStockForm({ ...EMPTY_STOCK, warehouse: warehouseNames[0] }); setModal({ type: 'stock' }); }}>+ Add Material / Stock</button></div>
    {products.length > 0 && <TableShell><table><thead><tr><th>Product</th><th>Category</th><th>Total Stock</th><th>Warehouses</th><th>Selling Price</th><th></th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><strong>{product.sku}</strong><small>{product.name}</small></td><td>{product.category}</td><td className={product.inventoryQty > 0 ? styles.good : styles.low}><strong>{number(product.inventoryQty)} {product.uom}</strong><small>Available: {number(product.availableQty)} {product.uom}</small></td><td>{product.warehouseCount || 0}</td><td>₹{number(product.sellingPrice)}</td><td className={styles.actions}><button onClick={() => addProductToStock(product)}>Add to Stock</button></td></tr>)}</tbody></table></TableShell>}
    <div className={styles.sectionHeader}><div><h3>Warehouse Stock</h3><p>See the warehouse and bin location of every product and raw material.</p></div></div>
    {stocks.length ? <TableShell><table><thead><tr><th>SKU / Item</th><th>Type</th><th>Warehouse / Bin</th><th>Current Stock</th><th>Reorder Level</th><th>Average Cost</th><th></th></tr></thead><tbody>{stocks.map((item) => <tr key={item.id}><td><strong>{item.sku}</strong><small>{item.name}</small></td><td><Status value={item.itemType} /></td><td>{item.warehouse}<small>{item.bin?.code || item.binLocation || 'No bin selected'}</small></td><td className={item.stock <= item.reorderLevel ? styles.low : styles.good}><strong>{number(item.stock)} {item.uom}</strong></td><td>{number(item.reorderLevel)} {item.uom}</td><td>₹{number(item.averageCost)}</td><td className={styles.actions}><button onClick={() => { setLocationBinId(item.binId || ''); setModal({ type: 'location', row: item }); }}>Choose Bin</button><button onClick={() => { setAdjustForm(EMPTY_ADJUSTMENT); setModal({ type: 'adjust', row: item }); }}>Adjust Stock</button></td></tr>)}</tbody></table></TableShell> : <EmptyState icon="📦" title="No Stock Available" description="Add a product or raw material to a warehouse with an opening quantity." actionLabel="Add Stock" onAction={() => setModal({ type: 'stock' })} />}
  </>;

  const renderManufacturing = () => materialRequests.length ? <TableShell><table><thead><tr><th>Request</th><th>Sales Order</th><th>Product Required</th><th>Raw Materials</th><th>Status</th><th></th></tr></thead><tbody>{materialRequests.map((request) => <tr key={request.id}><td><strong>{request.requestNo}</strong><small>{dateTime(request.createdAt)}</small></td><td>{request.fulfillment?.orderNo}<small>{request.fulfillment?.customer}</small></td><td><strong>{request.productSku}</strong><small>{request.productName} × {request.requestedQty} {request.uom}</small></td><td>{Array.isArray(request.rawMaterials) ? `${request.rawMaterials.length} material(s)` : 'Awaiting list'}</td><td><Status value={request.status} /></td><td className={styles.actions}>{['MATERIAL_LIST_PENDING', 'WAITING_PURCHASE', 'READY_FOR_ISSUE'].includes(request.status) && <button onClick={() => openMaterials(request)}>Material List</button>}{request.status === 'READY_FOR_ISSUE' && <button className={styles.successButton} disabled={saving} onClick={() => issueMaterials(request)}>Issue</button>}{request.status === 'MATERIAL_ISSUED' && <button className={styles.primary} onClick={() => openProduction(request)}>Receive Output</button>}</td></tr>)}</tbody></table></TableShell> : <EmptyState icon="🏭" title="No manufacturing requests" description="When a sales order is short on finished goods, its production request appears here automatically." />;

  const renderPurchases = () => procurements.length ? <TableShell><table><thead><tr><th>Purchase Request</th><th>For Production</th><th>Raw Material</th><th>Required</th><th>Received</th><th>Vendor</th><th>Status</th><th></th></tr></thead><tbody>{procurements.map((request) => <tr key={request.id}><td><strong>{request.requestNo}</strong><small>{dateTime(request.createdAt)}</small></td><td>{request.materialRequest?.requestNo}<small>{request.materialRequest?.productName}</small></td><td><strong>{request.sku}</strong><small>{request.itemName}</small></td><td>{request.requiredQty} {request.uom}</td><td>{request.receivedQty} {request.uom}</td><td>{request.vendorName || '—'}</td><td><Status value={request.status} /></td><td className={styles.actions}>{request.status !== 'RECEIVED' && <button className={styles.primary} onClick={() => openPurchase(request)}>Receive Purchase</button>}</td></tr>)}</tbody></table></TableShell> : <EmptyState icon="🚚" title="No purchase shortages" description="Purchase requests are created automatically when production raw materials are not in stock." />;

  function renderMovements(rows = movements) {
    return rows.length ? <TableShell><table><thead><tr><th>Movement</th><th>Date / Reference</th><th>SKU / Item</th><th>Warehouse</th><th>Quantity</th><th>Balance</th><th>Reason</th></tr></thead><tbody>{rows.map((movement) => <tr key={movement.id}><td><strong>{movement.movementNo}</strong><small><Status value={movement.movementType} /></small></td><td>{dateTime(movement.createdAt)}<small>{movement.referenceNo || 'Manual inventory'}</small></td><td><strong>{movement.sku}</strong><small>{movement.itemName}</small></td><td>{movement.warehouse}</td><td className={movement.quantity < 0 ? styles.low : styles.good}><strong>{movement.quantity > 0 ? '+' : ''}{movement.quantity} {movement.uom}</strong></td><td>{movement.balanceAfter} {movement.uom}</td><td>{movement.reason || '—'}<small>{movement.notes}</small></td></tr>)}</tbody></table></TableShell> : <EmptyState icon="📒" title="No stock movements" description="Every opening balance, adjustment, issue, purchase, production receipt and dispatch will be recorded here." />;
  }

  const renderTransfers = () => <>
    <div className={styles.sectionHeader}><div><h3>Move Stock Between Warehouses</h3><p>Source stock decreases when sent. Destination stock increases after receipt.</p></div><button className={styles.primary} disabled={warehouses.length < 2} onClick={openTransfer}>+ New Transfer</button></div>
    {warehouses.length < 2 && <div className={styles.error}>Create at least two warehouses before starting a transfer.</div>}
    {transfers.length ? <TableShell><table><thead><tr><th>Transfer No.</th><th>From</th><th>To</th><th>Items</th><th>Status</th><th>Sent At</th><th></th></tr></thead><tbody>{transfers.map((transfer) => <tr key={transfer.id}><td><strong>{transfer.transferNo}</strong></td><td>{transfer.fromWarehouse}</td><td>{transfer.toWarehouse}</td><td>{Array.isArray(transfer.items) ? transfer.items.map((item) => `${item.sku} × ${item.qty}`).join(', ') : '—'}</td><td><Status value={transfer.status} /></td><td>{dateTime(transfer.dispatchedAt)}</td><td className={styles.actions}>{transfer.status === 'IN_TRANSIT' && <button className={styles.successButton} disabled={saving} onClick={() => receiveTransfer(transfer)}>Receive Stock</button>}</td></tr>)}</tbody></table></TableShell> : <EmptyState icon="🔁" title="No Warehouse Transfers" description="Every stock movement between warehouses will be recorded here." />}
  </>;

  const renderWarehouses = () => <><div className={styles.sectionHeader}><div><h3>Warehouses, Racks and Bins</h3><p>Create a warehouse, then add bins and racks to track exact storage locations.</p></div><button className={styles.primary} onClick={() => { setWarehouseForm(EMPTY_WAREHOUSE); setModal({ type: 'warehouse' }); }}>+ Add Warehouse</button></div>{warehouses.length ? <div className={styles.warehouseGrid}>{warehouses.map((warehouse) => <article key={warehouse.id}><div><span>🏢</span><Status value={warehouse.status} /></div><h3>{warehouse.name}</h3><strong>{warehouse.code}</strong><p>{warehouse.address || 'No address provided'}</p><small>{warehouse.contactName || 'No contact provided'} {warehouse.contactPhone ? `• ${warehouse.contactPhone}` : ''}</small>{warehouse.isDefault && <em>Default receiving warehouse</em>}<div className={styles.binList}>{warehouse.bins?.length ? warehouse.bins.map((bin) => <span key={bin.id}>{bin.code}{bin.rack ? ` • Rack ${bin.rack}` : ''}</span>) : <small>No bins or racks yet</small>}</div><button className={styles.addBin} onClick={() => { setBinForm(EMPTY_BIN); setModal({ type: 'bin', row: warehouse }); }}>+ Add Bin / Rack</button></article>)}</div> : <EmptyState icon="🏢" title="No Warehouses Configured" description="Create the first warehouse. It will become the default receiving location." actionLabel="Add Warehouse" onAction={() => setModal({ type: 'warehouse' })} />}</>;

  const content = activeTab === 'dashboard' ? renderDashboard() : activeTab === 'orders' ? renderOrders() : activeTab === 'stock' ? renderStock() : activeTab === 'manufacturing' ? renderManufacturing() : activeTab === 'purchases' ? renderPurchases() : activeTab === 'transfers' ? renderTransfers() : activeTab === 'movements' ? renderMovements() : activeTab === 'warehouses' ? renderWarehouses() : <ServiceDepartments activeCompany={activeCompany} serviceCode="inventory_warehouse" showToast={showToast} />;

  return <div className={styles.module}>
    <header className={styles.header}><div><span className={styles.eyebrow}>Complete Stock Control</span><h2>Inventory &amp; Warehouse</h2><p>{activeCompany?.organizationName}: track available stock, storage locations, production issues, returns and wastage in one place.</p></div><button onClick={loadAll} disabled={loading}>{loading ? 'Refreshing…' : '↻ Refresh'}</button></header>
    <div className={styles.flow}><span>Sales Order Received</span><b>→</b><span>Check Product Stock</span><b>→</b><span>Send Shortage to Production</span><b>→</b><span>Purchase Missing Material</span><b>→</b><span>Receive Finished Product</span><b>→</b><span>Customer Dispatch</span></div>
    <nav className={styles.tabs}>{tabs.map(([key, label]) => <button key={key} className={activeTab === key ? styles.active : ''} onClick={() => setActiveTab(key)}>{label}</button>)}</nav>
    {loadError && <div className={styles.error}>{loadError} <button onClick={loadAll}>Retry</button></div>}
    {loading && !dashboard ? <div className={styles.loading}>Loading inventory records…</div> : content}

    <Modal isOpen={modal?.type === 'stock'} onClose={() => setModal(null)} title="Add Stock Item" maxWidth="760px"><form className={styles.form} onSubmit={submitStock}><FormField label="Select a Product Master item (leave blank for raw material)"><select value={stockForm.productId} onChange={(e) => { const product = products.find((item) => item.id === e.target.value); setStockForm(product ? { ...stockForm, productId: product.id, sku: product.sku, name: product.name, itemType: 'FINISHED_GOOD', uom: product.uom, averageCost: String(product.purchasePrice || 0) } : { ...stockForm, productId: '', sku: '', name: '', itemType: 'RAW_MATERIAL' }); }}><option value="">Manual raw material / packing item</option>{products.map((product) => <option key={product.id} value={product.id}>{product.sku} — {product.name}</option>)}</select></FormField><div className={styles.formGrid}><FormField label="SKU *"><input required disabled={Boolean(stockForm.productId)} value={stockForm.sku} onChange={(e) => setStockForm({ ...stockForm, sku: e.target.value })} /></FormField><FormField label="Item Name *"><input required disabled={Boolean(stockForm.productId)} value={stockForm.name} onChange={(e) => setStockForm({ ...stockForm, name: e.target.value })} /></FormField><FormField label="Item type"><select disabled={Boolean(stockForm.productId)} value={stockForm.itemType} onChange={(e) => setStockForm({ ...stockForm, itemType: e.target.value })}><option>RAW_MATERIAL</option><option>FINISHED_GOOD</option><option>WORK_IN_PROGRESS</option><option>PACKAGING</option></select></FormField><FormField label="Warehouse"><select value={stockForm.warehouse} onChange={(e) => setStockForm({ ...stockForm, warehouse: e.target.value, binId: '' })}>{warehouseNames.map((name) => <option key={name}>{name}</option>)}</select></FormField><FormField label="Bin / Rack"><select value={stockForm.binId} onChange={(e) => setStockForm({ ...stockForm, binId: e.target.value })}><option value="">Select bin later</option>{selectedWarehouseBins.map((bin) => <option key={bin.id} value={bin.id}>{bin.code}{bin.rack ? ` — Rack ${bin.rack}` : ''}</option>)}</select></FormField><FormField label="Opening Quantity"><input type="number" min="0" required value={stockForm.stock} onChange={(e) => setStockForm({ ...stockForm, stock: e.target.value })} /></FormField><FormField label="Low-Stock Alert Level"><input type="number" min="0" required value={stockForm.reorderLevel} onChange={(e) => setStockForm({ ...stockForm, reorderLevel: e.target.value })} /></FormField><FormField label="Unit"><input required value={stockForm.uom} onChange={(e) => setStockForm({ ...stockForm, uom: e.target.value })} /></FormField><FormField label="Unit Cost (₹)"><input type="number" min="0" step="0.01" value={stockForm.averageCost} onChange={(e) => setStockForm({ ...stockForm, averageCost: e.target.value })} /></FormField></div><div className={styles.formActions}><button type="button" onClick={() => setModal(null)}>Cancel</button><button className={styles.primary} disabled={saving}>{saving ? 'Saving…' : 'Save Stock'}</button></div></form></Modal>

    <Modal isOpen={modal?.type === 'adjust'} onClose={() => setModal(null)} title={`Adjust Stock — ${modal?.row?.sku || ''}`}><form className={styles.form} onSubmit={submitAdjustment}><p className={styles.hint}>Current balance: <strong>{modal?.row?.stock} {modal?.row?.uom}</strong> in {modal?.row?.warehouse}</p><FormField label="Quantity change (+ or -) *"><input type="number" required value={adjustForm.qtyDiff} onChange={(e) => setAdjustForm({ ...adjustForm, qtyDiff: e.target.value })} /></FormField><FormField label="Reason *"><select value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}><option value="PHYSICAL_COUNT_RECONCILIATION">Physical count reconciliation</option><option value="DAMAGED_IN_STORAGE">Damaged / expired in warehouse</option><option value="SCRAP_WRITE_OFF">Scrap write-off</option><option value="INTERNAL_CONSUMPTION">Internal consumption</option></select></FormField><FormField label="Notes"><textarea rows="3" value={adjustForm.notes} onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })} /></FormField><div className={styles.formActions}><button type="button" onClick={() => setModal(null)}>Cancel</button><button className={styles.primary} disabled={saving}>Save Adjustment</button></div></form></Modal>

    <Modal isOpen={modal?.type === 'location'} onClose={() => setModal(null)} title={`Choose Bin — ${modal?.row?.sku || ''}`}><form className={styles.form} onSubmit={submitLocation}><p className={styles.hint}>Warehouse: <strong>{modal?.row?.warehouse}</strong></p><FormField label="Bin / Rack"><select value={locationBinId} onChange={(e) => setLocationBinId(e.target.value)}><option value="">No bin assigned</option>{locationBins.map((bin) => <option key={bin.id} value={bin.id}>{bin.code}{bin.rack ? ` — Rack ${bin.rack}` : ''}{bin.aisle ? ` — ${bin.aisle}` : ''}</option>)}</select></FormField>{locationBins.length === 0 && <div className={styles.error}>Create a bin or rack in this warehouse first.</div>}<div className={styles.formActions}><button type="button" onClick={() => setModal(null)}>Cancel</button><button className={styles.primary} disabled={saving}>Save Bin</button></div></form></Modal>

    <Modal isOpen={modal?.type === 'warehouse'} onClose={() => setModal(null)} title="Add Warehouse"><form className={styles.form} onSubmit={submitWarehouse}><div className={styles.formGrid}><FormField label="Warehouse code *"><input required value={warehouseForm.code} onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value })} /></FormField><FormField label="Warehouse name *"><input required value={warehouseForm.name} onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })} /></FormField><FormField label="Contact person"><input value={warehouseForm.contactName} onChange={(e) => setWarehouseForm({ ...warehouseForm, contactName: e.target.value })} /></FormField><FormField label="Contact phone"><input value={warehouseForm.contactPhone} onChange={(e) => setWarehouseForm({ ...warehouseForm, contactPhone: e.target.value })} /></FormField></div><FormField label="Address"><textarea rows="3" value={warehouseForm.address} onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })} /></FormField><label className={styles.checkbox}><input type="checkbox" checked={warehouseForm.isDefault} onChange={(e) => setWarehouseForm({ ...warehouseForm, isDefault: e.target.checked })} /> Make this the default receiving warehouse</label><div className={styles.formActions}><button type="button" onClick={() => setModal(null)}>Cancel</button><button className={styles.primary} disabled={saving}>Create Warehouse</button></div></form></Modal>

    <Modal isOpen={modal?.type === 'bin'} onClose={() => setModal(null)} title={`Add Bin / Rack — ${modal?.row?.name || ''}`}><form className={styles.form} onSubmit={submitBin}><div className={styles.formGrid}><FormField label="Bin code *"><input required placeholder="e.g. BIN-A-01" value={binForm.code} onChange={(e) => setBinForm({ ...binForm, code: e.target.value })} /></FormField><FormField label="Aisle"><input placeholder="e.g. Aisle A" value={binForm.aisle} onChange={(e) => setBinForm({ ...binForm, aisle: e.target.value })} /></FormField><FormField label="Rack"><input placeholder="e.g. R-01" value={binForm.rack} onChange={(e) => setBinForm({ ...binForm, rack: e.target.value })} /></FormField><FormField label="Description"><input placeholder="What type of stock is stored here?" value={binForm.description} onChange={(e) => setBinForm({ ...binForm, description: e.target.value })} /></FormField></div><div className={styles.formActions}><button type="button" onClick={() => setModal(null)}>Cancel</button><button className={styles.primary} disabled={saving}>Save Bin</button></div></form></Modal>

    <Modal isOpen={modal?.type === 'transfer'} onClose={() => setModal(null)} title="Warehouse Transfer" maxWidth="820px"><form className={styles.form} onSubmit={submitTransfer}><div className={styles.formGrid}><FormField label="From Warehouse *"><select required value={transferForm.fromWarehouse} onChange={(e) => { const fromWarehouse = e.target.value; setTransferForm({ ...transferForm, fromWarehouse, toWarehouse: transferForm.toWarehouse === fromWarehouse ? '' : transferForm.toWarehouse }); setTransferItems([{ sku: '', qty: '' }]); }}>{warehouseNames.map((name) => <option key={name}>{name}</option>)}</select></FormField><FormField label="To Warehouse *"><select required value={transferForm.toWarehouse} onChange={(e) => setTransferForm({ ...transferForm, toWarehouse: e.target.value })}><option value="">Select Warehouse</option>{warehouseNames.filter((name) => name !== transferForm.fromWarehouse).map((name) => <option key={name}>{name}</option>)}</select></FormField></div>{transferItems.map((item, index) => <div className={styles.transferRow} key={index}><select required value={item.sku} onChange={(e) => setTransferItems(transferItems.map((row, i) => i === index ? { ...row, sku: e.target.value } : row))}><option value="">Select Stock Item</option>{sourceWarehouseStocks.map((stock) => <option key={stock.id} value={stock.sku}>{stock.sku} — {stock.name} ({stock.stock} {stock.uom})</option>)}</select><input required type="number" min="1" placeholder="Quantity" value={item.qty} onChange={(e) => setTransferItems(transferItems.map((row, i) => i === index ? { ...row, qty: e.target.value } : row))} /><button type="button" disabled={transferItems.length === 1} onClick={() => setTransferItems(transferItems.filter((_, i) => i !== index))}>×</button></div>)}<button type="button" className={styles.addLine} onClick={() => setTransferItems([...transferItems, { sku: '', qty: '' }])}>+ Add Another Item</button><FormField label="Notes"><textarea rows="2" value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} /></FormField><div className={styles.formActions}><button type="button" onClick={() => setModal(null)}>Cancel</button><button className={styles.primary} disabled={saving}>Send Stock</button></div></form></Modal>

    <Modal isOpen={modal?.type === 'materials'} onClose={() => setModal(null)} title={`Raw Material List — ${modal?.row?.requestNo || ''}`} maxWidth="820px"><form className={styles.form} onSubmit={submitMaterials}><p className={styles.hint}>Production requirement: <strong>{modal?.row?.productName} × {modal?.row?.requestedQty} {modal?.row?.uom}</strong></p>{materials.map((material, index) => <div className={styles.materialRow} key={index}><input required placeholder="Raw material SKU" value={material.sku} onChange={(e) => setMaterials(materials.map((row, i) => i === index ? { ...row, sku: e.target.value } : row))} /><input required placeholder="Material name" value={material.name} onChange={(e) => setMaterials(materials.map((row, i) => i === index ? { ...row, name: e.target.value } : row))} /><input required type="number" min="1" placeholder="Qty" value={material.qty} onChange={(e) => setMaterials(materials.map((row, i) => i === index ? { ...row, qty: e.target.value } : row))} /><input required placeholder="UOM" value={material.uom} onChange={(e) => setMaterials(materials.map((row, i) => i === index ? { ...row, uom: e.target.value } : row))} /><button type="button" disabled={materials.length === 1} onClick={() => setMaterials(materials.filter((_, i) => i !== index))}>×</button></div>)}<button type="button" className={styles.addLine} onClick={() => setMaterials([...materials, newMaterial()])}>+ Add Raw Material</button><div className={styles.formActions}><button type="button" onClick={() => setModal(null)}>Cancel</button><button className={styles.primary} disabled={saving}>Check Stock &amp; Submit</button></div></form></Modal>

    <Modal isOpen={modal?.type === 'purchase'} onClose={() => setModal(null)} title={`Receive Purchase — ${modal?.row?.requestNo || ''}`}><form className={styles.form} onSubmit={submitPurchase}><p className={styles.hint}><strong>{modal?.row?.sku} — {modal?.row?.itemName}</strong><br />Outstanding: {(modal?.row?.requiredQty || 0) - (modal?.row?.receivedQty || 0)} {modal?.row?.uom}</p><div className={styles.formGrid}><FormField label="Received quantity *"><input type="number" min="1" required value={purchaseForm.receivedQty} onChange={(e) => setPurchaseForm({ ...purchaseForm, receivedQty: e.target.value })} /></FormField><FormField label="Vendor *"><input required value={purchaseForm.vendorName} onChange={(e) => setPurchaseForm({ ...purchaseForm, vendorName: e.target.value })} /></FormField><FormField label="Unit cost (₹)"><input type="number" min="0" step="0.01" value={purchaseForm.unitCost} onChange={(e) => setPurchaseForm({ ...purchaseForm, unitCost: e.target.value })} /></FormField><FormField label="Receiving warehouse"><select value={purchaseForm.warehouse} onChange={(e) => setPurchaseForm({ ...purchaseForm, warehouse: e.target.value })}>{warehouseNames.map((name) => <option key={name}>{name}</option>)}</select></FormField></div><FormField label="Notes"><textarea rows="2" value={purchaseForm.notes} onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })} /></FormField><div className={styles.formActions}><button type="button" onClick={() => setModal(null)}>Cancel</button><button className={styles.primary} disabled={saving}>Post Purchase Receipt</button></div></form></Modal>

    <Modal isOpen={modal?.type === 'production'} onClose={() => setModal(null)} title={`Receive Production Output — ${modal?.row?.requestNo || ''}`} maxWidth="760px"><form className={styles.form} onSubmit={submitProduction}><p className={styles.hint}><strong>{modal?.row?.productSku} — {modal?.row?.productName}</strong><br />Planned Output: {modal?.row?.requestedQty} {modal?.row?.uom}</p><div className={styles.formGrid}><FormField label="Finished Quantity *"><input type="number" min="1" required value={productionForm.producedQty} onChange={(e) => setProductionForm({ ...productionForm, producedQty: e.target.value })} /></FormField><FormField label="Wastage Quantity"><input type="number" min="0" required value={productionForm.wasteQty} onChange={(e) => setProductionForm({ ...productionForm, wasteQty: e.target.value })} /></FormField><FormField label="Wastage Reason"><input value={productionForm.wasteReason} onChange={(e) => setProductionForm({ ...productionForm, wasteReason: e.target.value })} /></FormField><FormField label="Finished Product Unit Cost (₹)"><input type="number" min="0" step="0.01" value={productionForm.unitCost} onChange={(e) => setProductionForm({ ...productionForm, unitCost: e.target.value })} /></FormField><FormField label="Receiving Warehouse"><select value={productionForm.warehouse} onChange={(e) => setProductionForm({ ...productionForm, warehouse: e.target.value })}>{warehouseNames.map((name) => <option key={name}>{name}</option>)}</select></FormField></div>{productionReturns.length > 0 && <div><p className={styles.hint}><strong>Return Unused Raw Material</strong><br />Enter the quantity of each issued material that was not used.</p>{productionReturns.map((item, index) => <div className={styles.returnRow} key={item.sku}><span><strong>{item.sku}</strong><small>{item.name} • Issued {item.qty} {item.uom}</small></span><input type="number" min="0" max={item.qty} value={item.returnQty} onChange={(e) => setProductionReturns(productionReturns.map((row, i) => i === index ? { ...row, returnQty: e.target.value } : row))} /><span>{item.uom}</span></div>)}</div>}<FormField label="Production notes"><textarea rows="2" value={productionForm.notes} onChange={(e) => setProductionForm({ ...productionForm, notes: e.target.value })} /></FormField><div className={styles.formActions}><button type="button" onClick={() => setModal(null)}>Cancel</button><button className={styles.primary} disabled={saving}>Receive and Update Stock</button></div></form></Modal>
  </div>;
}

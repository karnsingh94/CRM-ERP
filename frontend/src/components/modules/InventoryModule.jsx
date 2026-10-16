'use client';

import { useState } from 'react';
import { IconLayers, IconPlus, IconAlertTriangle } from '../ui/Icons';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import ServiceDepartments from '../departments/ServiceDepartments';

export default function InventoryModule({ activeCompany, showToast }) {
  const [activeTab, setActiveTab] = useState('stock'); // 'stock', 'departments'
  const [stockItems, setStockItems] = useState([
    { id: 1, sku: 'PRD-RAW-001', name: 'High-Density Polymer Resin A4', warehouse: 'Central Depot Bay 1', stock: 450, uom: 'KG', minLevel: 100 },
    { id: 2, sku: 'PRD-FIN-102', name: 'Industrial Valve Coupling 50mm', warehouse: 'Finished Goods Bay 3', stock: 64, uom: 'PCS', minLevel: 25 },
    { id: 3, sku: 'PRD-PKG-033', name: 'Reinforced Corrugated Box Type-B', warehouse: 'Packaging Depot', stock: 1200, uom: 'BOX', minLevel: 300 },
    { id: 4, sku: 'PRD-WIP-088', name: 'Machined Brass Cylinder Core', warehouse: 'Shopfloor WIP Rack', stock: 18, uom: 'PCS', minLevel: 30 },
  ]);

  const [adjustModalItem, setAdjustModalItem] = useState(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('PHYSICAL_COUNT_RECONCILIATION');

  const handleAdjustStock = (e) => {
    e.preventDefault();
    if (!adjustModalItem || !adjustQty) return;
    const diff = parseInt(adjustQty);
    setStockItems(stockItems.map(item =>
      item.id === adjustModalItem.id
        ? { ...item, stock: Math.max(0, item.stock + diff) }
        : item
    ));
    showToast('Stock Adjusted! 📦', `Adjusted ${diff > 0 ? `+${diff}` : diff} units for ${adjustModalItem.sku}.`, 'success');
    setAdjustModalItem(null);
    setAdjustQty('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>Inventory &amp; Warehouse Ledger</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Multi-location stock balances, reorder warnings, and warehouse movements for {activeCompany?.organizationName}
          </p>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('stock')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: activeTab === 'stock' ? 800 : 600,
            color: activeTab === 'stock' ? '#2563eb' : '#64748b',
            borderBottom: activeTab === 'stock' ? '2px solid #2563eb' : '2px solid transparent',
            fontSize: '0.88rem',
          }}
        >
          Stock Inventory ({stockItems.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('departments')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: activeTab === 'departments' ? 800 : 600,
            color: activeTab === 'departments' ? '#2563eb' : '#64748b',
            borderBottom: activeTab === 'departments' ? '2px solid #2563eb' : '2px solid transparent',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <span>🏢</span>
          <span>Departments</span>
        </button>
      </div>

      {activeTab === 'departments' ? (
        <ServiceDepartments
          activeCompany={activeCompany}
          serviceCode="inventory_warehouse"
          showToast={showToast}
        />
      ) : (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>SKU Code</th>
                <th style={{ padding: '0.85rem 1rem' }}>Item Description</th>
                <th style={{ padding: '0.85rem 1rem' }}>Storage Facility</th>
                <th style={{ padding: '0.85rem 1rem' }}>Reorder Level</th>
                <th style={{ padding: '0.85rem 1rem' }}>Available Balance</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stockItems.map((item) => {
                const isLow = item.stock < item.minLevel;
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#2563eb' }}>
                      {item.sku}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                      {item.name}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#64748b' }}>
                      {item.warehouse}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: 600 }}>
                      {item.minLevel} {item.uom}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.92rem', color: isLow ? '#dc2626' : '#15803d' }}>
                        {item.stock} {item.uom}
                      </span>
                      {isLow && (
                        <span style={{ marginLeft: '8px', padding: '1px 6px', borderRadius: '4px', background: '#fef2f2', color: '#b91c1c', fontSize: '0.7rem', fontWeight: 800 }}>
                          LOW STOCK
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => setAdjustModalItem(item)}
                        style={{
                          padding: '0.4rem 0.85rem',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#2563eb',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                        }}
                      >
                        Adjust Stock
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Adjust Modal */}
      <Modal
        isOpen={Boolean(adjustModalItem)}
        onClose={() => setAdjustModalItem(null)}
        title={`Adjust Stock — ${adjustModalItem?.sku}`}
      >
        <form onSubmit={handleAdjustStock} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.75rem' }}>
              Current on-hand balance: <strong>{adjustModalItem?.stock} {adjustModalItem?.uom}</strong> at {adjustModalItem?.warehouse}
            </div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Quantity Change (+/-) *
            </label>
            <input
              type="number"
              required
              placeholder="e.g. +25 or -10"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Reason for Adjustment *
            </label>
            <select
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}
            >
              <option value="PHYSICAL_COUNT_RECONCILIATION">Physical Count Reconciliation</option>
              <option value="DAMAGED_IN_STORAGE">Damaged / Expired in Warehouse</option>
              <option value="SCRAP_WRITE_OFF">Scrap Write-off</option>
              <option value="INTERNAL_CONSUMPTION">Internal R&amp;D Testing</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => setAdjustModalItem(null)}
              style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#ffffff', fontWeight: 700 }}
            >
              Save Adjustment
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

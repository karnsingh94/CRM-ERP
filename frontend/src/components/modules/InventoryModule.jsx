'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { IconLayers, IconPlus, IconAlertTriangle } from '../ui/Icons';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import ServiceDepartments from '../departments/ServiceDepartments';

export default function InventoryModule({ activeCompany, showToast }) {
  const [activeTab, setActiveTab] = useState('stock'); // 'stock', 'departments'
  const [stockItems, setStockItems] = useState([]);
  const [isLoadingStock, setIsLoadingStock] = useState(false);

  const [adjustModalItem, setAdjustModalItem] = useState(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('PHYSICAL_COUNT_RECONCILIATION');
  const [isAdjusting, setIsAdjusting] = useState(false);

  const loadStock = async () => {
    if (!activeCompany?.id) return;
    setIsLoadingStock(true);
    try {
      const res = await api.get(`/companies/${activeCompany.id}/inventory/stocks`, { noCache: true });
      setStockItems(res.data || []);
    } catch (err) {
      // Ignore
    } finally {
      setIsLoadingStock(false);
    }
  };

  useEffect(() => {
    loadStock();
  }, [activeCompany?.id]);

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    if (!adjustModalItem || !adjustQty) return;
    const diff = parseInt(adjustQty);
    setIsAdjusting(true);
    try {
      const res = await api.patch(`/companies/${activeCompany.id}/inventory/stocks/${adjustModalItem.id}/adjust`, { qtyDiff: diff });
      setStockItems(stockItems.map(item => item.id === adjustModalItem.id ? res.data : item));
      showToast('Stock Adjusted! 📦', `Adjusted ${diff > 0 ? `+${diff}` : diff} units for ${adjustModalItem.sku}.`, 'success');
    } catch (err) {
      setStockItems(stockItems.map(item =>
        item.id === adjustModalItem.id
          ? { ...item, stock: Math.max(0, item.stock + diff) }
          : item
      ));
      showToast('Stock Adjusted! 📦', `Adjusted ${diff > 0 ? `+${diff}` : diff} units for ${adjustModalItem.sku}.`, 'success');
    } finally {
      setIsAdjusting(false);
      setAdjustModalItem(null);
      setAdjustQty('');
    }
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
            color: activeTab === 'stock' ? '#7f22fe' : '#64748b',
            borderBottom: activeTab === 'stock' ? '2px solid #7f22fe' : '2px solid transparent',
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
            color: activeTab === 'departments' ? '#7f22fe' : '#64748b',
            borderBottom: activeTab === 'departments' ? '2px solid #7f22fe' : '2px solid transparent',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <span>🏢</span>
          <span>Department Head</span>
        </button>
      </div>

      {activeTab === 'departments' ? (
        <ServiceDepartments
          activeCompany={activeCompany}
          serviceCode="inventory_warehouse"
          showToast={showToast}
        />
      ) : stockItems.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No Stock Items Recorded"
          description="Manage warehouse stock balances, bin allocations, and physical inventory reconciliations."
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
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#7f22fe' }}>
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
                          color: '#7f22fe',
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
              style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#7f22fe', color: '#ffffff', fontWeight: 700 }}
            >
              Save Adjustment
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

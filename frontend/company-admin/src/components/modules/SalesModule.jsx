'use client';

import { useState } from 'react';
import { IconPlus, IconSearch, IconShoppingBag, IconFileText } from '../ui/Icons';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';

export default function SalesModule({ activeCompany, showToast }) {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'quotes'
  const [searchQuery, setSearchQuery] = useState('');

  const [orders, setOrders] = useState([
    {
      id: 1,
      orderNo: 'SO-2026-089',
      customer: 'Apex Technologies Pvt Ltd',
      date: '2026-10-13',
      itemsCount: 3,
      amount: 142500.00,
      status: 'APPROVED',
      paymentStatus: 'PAID',
    },
    {
      id: 2,
      orderNo: 'SO-2026-090',
      customer: 'Zenith Logistics Ltd',
      date: '2026-10-12',
      itemsCount: 1,
      amount: 48900.00,
      status: 'PENDING_APPROVAL',
      paymentStatus: 'PENDING',
    },
    {
      id: 3,
      orderNo: 'SO-2026-091',
      customer: 'Kaveri Infotech Solutions',
      date: '2026-10-14',
      itemsCount: 5,
      amount: 320000.00,
      status: 'DELIVERED',
      paymentStatus: 'PAID',
    },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    customer: '',
    itemsCount: 1,
    amount: '',
    status: 'PENDING_APPROVAL',
  });

  const handleCreateOrder = (e) => {
    e.preventDefault();
    if (!form.customer || !form.amount) {
      showToast('Validation Error', 'Customer and order amount are required', 'danger');
      return;
    }
    const newO = {
      id: Date.now(),
      orderNo: `SO-2026-${String(Math.floor(Math.random() * 900) + 100)}`,
      customer: form.customer,
      date: new Date().toISOString().split('T')[0],
      itemsCount: parseInt(form.itemsCount) || 1,
      amount: parseFloat(form.amount) || 0,
      status: form.status,
      paymentStatus: 'PENDING',
    };
    setOrders([newO, ...orders]);
    setShowAddModal(false);
    setForm({ customer: '', itemsCount: 1, amount: '', status: 'PENDING_APPROVAL' });
    showToast('Sales Order Created! 📑', `Order ${newO.orderNo} registered.`, 'success');
  };

  const filtered = orders.filter(o =>
    o.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.customer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>Sales Operations &amp; Commercial Orders</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Quotations, Proforma Invoices, and Confirmed Sales Orders for {activeCompany?.organizationName}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            background: '#2563eb',
            color: '#ffffff',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.86rem',
            boxShadow: '0 4px 6px rgba(37, 99, 235, 0.25)',
          }}
        >
          <IconPlus size={16} /> Create Sales Order
        </button>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <input
            type="text"
            placeholder="Search by order number or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', maxWidth: '340px', padding: '0.5rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon="📑"
            title="No Sales Orders"
            description="No sales orders have been registered yet. Click 'Create Sales Order' to record customer purchases."
            actionLabel="Create Order"
            onAction={() => setShowAddModal(true)}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Order Number</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Client Customer</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Order Date</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Line Items</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Total Amount</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Order Status</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Payment</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#2563eb' }}>
                      {o.orderNo}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                      {o.customer}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#64748b' }}>
                      {o.date}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#334155', fontWeight: 600 }}>
                      {o.itemsCount} SKUs
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#0f172a' }}>
                      ₹ {o.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '9999px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: o.status === 'APPROVED' ? '#ecfdf5' : o.status === 'DELIVERED' ? '#eff6ff' : '#fffbeb',
                          color: o.status === 'APPROVED' ? '#047857' : o.status === 'DELIVERED' ? '#1d4ed8' : '#b45309',
                          border: `1px solid ${o.status === 'APPROVED' ? '#a7f3d0' : o.status === 'DELIVERED' ? '#bfdbfe' : '#fde68a'}`,
                        }}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.78rem', color: o.paymentStatus === 'PAID' ? '#10b981' : '#f59e0b' }}>
                        {o.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Generate New Sales Order">
        <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Customer Organization *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Apex Technologies Pvt Ltd"
              value={form.customer}
              onChange={(e) => setForm({ ...form, customer: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Item Count
              </label>
              <input
                type="number"
                min="1"
                value={form.itemsCount}
                onChange={(e) => setForm({ ...form, itemsCount: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Net Order Value (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#ffffff', fontWeight: 700 }}
            >
              Confirm Sales Order
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

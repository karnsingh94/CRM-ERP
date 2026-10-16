'use client';

import { useState } from 'react';
import { IconPlus, IconTruck, IconUsers, IconFileText } from '../ui/Icons';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import ServiceDepartments from '../departments/ServiceDepartments';

export default function PurchaseModule({ activeCompany, showToast }) {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'vendors'
  const [searchQuery, setSearchQuery] = useState('');

  const [vendors, setVendors] = useState([
    {
      id: 1,
      name: 'Sterling Steel & Alloy Corp',
      contact: 'Vikram Seth',
      email: 'vikram@sterlingsteel.com',
      phone: '+91 98200 11223',
      category: 'Raw Materials',
      rating: '4.8 ★',
    },
    {
      id: 2,
      name: 'PolyChem Polymers India',
      contact: 'Neha Deshmukh',
      email: 'sales@polychem.in',
      phone: '+91 97654 33221',
      category: 'Chemicals & Resins',
      rating: '4.5 ★',
    },
  ]);

  const [orders, setOrders] = useState([
    {
      id: 1,
      poNumber: 'PO-2026-034',
      vendor: 'Sterling Steel & Alloy Corp',
      date: '2026-10-11',
      expectedDate: '2026-10-18',
      amount: 285000.00,
      status: 'ISSUED',
    },
    {
      id: 2,
      poNumber: 'PO-2026-035',
      vendor: 'PolyChem Polymers India',
      date: '2026-10-13',
      expectedDate: '2026-10-20',
      amount: 98000.00,
      status: 'GRN_PENDING',
    },
  ]);

  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [vendorForm, setVendorForm] = useState({ name: '', contact: '', email: '', phone: '', category: 'Raw Materials' });

  const handleCreateVendor = (e) => {
    e.preventDefault();
    if (!vendorForm.name) return;
    const newV = {
      id: Date.now(),
      ...vendorForm,
      rating: '5.0 ★',
    };
    setVendors([newV, ...vendors]);
    setShowAddVendorModal(false);
    setVendorForm({ name: '', contact: '', email: '', phone: '', category: 'Raw Materials' });
    showToast('Vendor Registered', `"${newV.name}" added to vendor directory.`, 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>Purchase &amp; Vendor Management</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Supplier database, purchase orders, and procurement workflows for {activeCompany?.organizationName}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddVendorModal(true)}
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
          <IconPlus size={16} /> Register Vendor
        </button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: activeTab === 'orders' ? 800 : 600,
            color: activeTab === 'orders' ? '#2563eb' : '#64748b',
            borderBottom: activeTab === 'orders' ? '2px solid #2563eb' : '2px solid transparent',
            fontSize: '0.88rem',
          }}
        >
          Purchase Orders ({orders.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('vendors')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: activeTab === 'vendors' ? 800 : 600,
            color: activeTab === 'vendors' ? '#2563eb' : '#64748b',
            borderBottom: activeTab === 'vendors' ? '2px solid #2563eb' : '2px solid transparent',
            fontSize: '0.88rem',
          }}
        >
          Vendor Directory ({vendors.length})
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
          serviceCode="purchase_vendor"
          showToast={showToast}
        />
      ) : activeTab === 'orders' ? (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '0.85rem 1.25rem' }}>PO Number</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Supplier Vendor</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Order Date</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Delivery Expected</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Order Amount</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((po) => (
                  <tr key={po.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#2563eb' }}>
                      {po.poNumber}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                      {po.vendor}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#64748b' }}>
                      {po.date}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#334155', fontWeight: 600 }}>
                      {po.expectedDate}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#0f172a' }}>
                      ₹ {po.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                        {po.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Vendor Name</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Contact Person</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Category</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Email / Mobile</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Supplier Rating</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#0f172a' }}>
                      {v.name}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                      {v.contact}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 600 }}>
                        {v.category}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.78rem' }}>
                      {v.email} • {v.phone}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: 800, color: '#f59e0b' }}>
                      {v.rating}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Vendor Modal */}
      <Modal isOpen={showAddVendorModal} onClose={() => setShowAddVendorModal(false)} title="Register Supplier Vendor">
        <form onSubmit={handleCreateVendor} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Vendor Company Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Apex Industrial Supplies Ltd"
              value={vendorForm.name}
              onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Contact Person
              </label>
              <input
                type="text"
                placeholder="e.g. Rajesh Nair"
                value={vendorForm.contact}
                onChange={(e) => setVendorForm({ ...vendorForm, contact: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Supply Category
              </label>
              <select
                value={vendorForm.category}
                onChange={(e) => setVendorForm({ ...vendorForm, category: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}
              >
                <option value="Raw Materials">Raw Materials</option>
                <option value="Machinery Parts">Machinery Parts</option>
                <option value="Chemicals & Resins">Chemicals & Resins</option>
                <option value="Packaging Materials">Packaging Materials</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Email
              </label>
              <input
                type="email"
                placeholder="sales@vendor.com"
                value={vendorForm.email}
                onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Phone Number
              </label>
              <input
                type="text"
                placeholder="+91 98765 43210"
                value={vendorForm.phone}
                onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => setShowAddVendorModal(false)}
              style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#ffffff', fontWeight: 700 }}
            >
              Save Vendor
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

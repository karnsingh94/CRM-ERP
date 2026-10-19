'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { IconPlus, IconSearch, IconBox, IconLayers } from '../ui/Icons';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import ServiceDepartments from '../departments/ServiceDepartments';

export default function ProductsModule({ activeCompany, showToast, initialSubTab }) {
  const router = useRouter();
  const pathname = usePathname();

  const TAB_ROUTES = {
    all: '/products',
    categories: '/products/categories',
    pricing: '/products/pricing',
    departments: '/services/crm-sales/departments',
  };

  const [activeTab, setActiveTab] = useState(initialSubTab || 'all');

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab);
    } else if (pathname) {
      if (pathname.includes('/products/categories')) setActiveTab('categories');
      else if (pathname.includes('/products/pricing')) setActiveTab('pricing');
      else if (pathname.includes('/departments')) setActiveTab('departments');
      else if (pathname.includes('/products')) setActiveTab('all');
    }
  }, [initialSubTab, pathname]);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(
    initialSubTab === 'categories' ? 'Raw Material' : 'ALL'
  );

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchQuery('');
    const targetRoute = TAB_ROUTES[newTab];
    if (targetRoute && pathname !== targetRoute) {
      router.push(targetRoute);
    }
  };

  const [products, setProducts] = useState([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [form, setForm] = useState({
    sku: '',
    name: '',
    category: 'Finished Goods',
    uom: 'PCS',
    sellingPrice: '',
    purchasePrice: '',
    stock: '',
  });

  const handleCreateProduct = (e) => {
    e.preventDefault();
    if (!form.sku || !form.name) {
      showToast('Validation Error', 'SKU code and product name are required', 'danger');
      return;
    }
    const newP = {
      id: Date.now(),
      sku: form.sku.trim().toUpperCase(),
      name: form.name.trim(),
      category: form.category,
      uom: form.uom,
      sellingPrice: parseFloat(form.sellingPrice) || 0,
      purchasePrice: parseFloat(form.purchasePrice) || 0,
      stock: parseInt(form.stock) || 0,
      status: 'ACTIVE',
    };
    setProducts([newP, ...products]);
    setShowAddModal(false);
    setForm({ sku: '', name: '', category: 'Finished Goods', uom: 'PCS', sellingPrice: '', purchasePrice: '', stock: '' });
    showToast('Product Registered! 📦', `"${newP.name}" added to company catalogue.`, 'success');
  };

  const handleDelete = () => {
    if (!productToDelete) return;
    setProducts(products.filter(p => p.id !== productToDelete.id));
    showToast('Product Removed', `Product "${productToDelete.sku}" removed.`, 'danger');
    setProductToDelete(null);
  };

  const filtered = (products || []).filter(p => {
    if (!p) return false;
    const q = (searchQuery || '').toLowerCase().trim();
    const matchesSearch = !q ||
      String(p.sku || '').toLowerCase().includes(q) ||
      String(p.name || '').toLowerCase().includes(q);
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>Product Catalogue &amp; Master SKUs</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Catalogued materials, finished goods, and pricing registered for {activeCompany?.organizationName}
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
            background: '#7f22fe',
            color: '#ffffff',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.86rem',
            boxShadow: '0 4px 6px rgba(127, 34, 254, 0.25)',
          }}
        >
          <IconPlus size={16} /> Register New SKU
        </button>
      </div>

      {/* Module Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => handleTabChange('all')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: activeTab === 'all' ? 800 : 600,
            color: activeTab === 'all' ? '#7f22fe' : '#64748b',
            borderBottom: activeTab === 'all' ? '2px solid #7f22fe' : '2px solid transparent',
            background: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            fontSize: '0.88rem',
            cursor: 'pointer',
          }}
        >
          Product Directory ({products.length})
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('categories')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: activeTab === 'categories' ? 800 : 600,
            color: activeTab === 'categories' ? '#7f22fe' : '#64748b',
            borderBottom: activeTab === 'categories' ? '2px solid #7f22fe' : '2px solid transparent',
            background: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            fontSize: '0.88rem',
            cursor: 'pointer',
          }}
        >
          Categories
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('pricing')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: activeTab === 'pricing' ? 800 : 600,
            color: activeTab === 'pricing' ? '#7f22fe' : '#64748b',
            borderBottom: activeTab === 'pricing' ? '2px solid #7f22fe' : '2px solid transparent',
            background: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            fontSize: '0.88rem',
            cursor: 'pointer',
          }}
        >
          Pricing &amp; Plans
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('departments')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: activeTab === 'departments' ? 800 : 600,
            color: activeTab === 'departments' ? '#7f22fe' : '#64748b',
            borderBottom: activeTab === 'departments' ? '2px solid #7f22fe' : '2px solid transparent',
            background: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            cursor: 'pointer',
          }}
        >
          <span>🏢</span>
          <span>Departments</span>
        </button>
      </div>

      {activeTab === 'departments' ? (
        <ServiceDepartments
          activeCompany={activeCompany}
          serviceCode="crm_sales"
          showToast={showToast}
        />
      ) : (
      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {/* Filter Bar */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '220px' }}>
            <input
              type="text"
              placeholder="Search by SKU code or product title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '360px',
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.84rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                background: '#ffffff',
              }}
            >
              <option value="ALL">All Categories</option>
              <option value="Raw Material">Raw Material</option>
              <option value="Finished Goods">Finished Goods</option>
              <option value="WIP Semi-Finished">WIP Semi-Finished</option>
              <option value="Packaging">Packaging</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <EmptyState
            icon="📦"
            title="No Products Found"
            description="No SKU matches your query. Register products to begin creating quotes and stock receipts."
            actionLabel="Register Product"
            onAction={() => setShowAddModal(true)}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '0.85rem 1.25rem' }}>SKU Code</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Product Name</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Category</th>
                  <th style={{ padding: '0.85rem 1rem' }}>UOM</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Selling Rate</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Purchase Rate</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Available Stock</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#7f22fe' }}>
                      {p.sku}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                      {p.name}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 600, background: '#f1f5f9', color: '#334155' }}>
                        {p.category}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#64748b' }}>
                      {p.uom}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                      ₹ {p.sellingPrice.toFixed(2)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#64748b' }}>
                      ₹ {p.purchasePrice.toFixed(2)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ fontWeight: 800, color: p.stock < 20 ? '#ef4444' : '#10b981' }}>
                        {p.stock} {p.uom}
                      </span>
                      {p.stock < 20 && (
                        <span style={{ marginLeft: '6px', fontSize: '0.68rem', background: '#fef2f2', color: '#b91c1c', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                          LOW
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => setProductToDelete(p)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          color: '#dc2626',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Add Product Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Register New Catalogue SKU">
        <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                SKU Code *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. PRD-FIN-501"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Category *
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}
              >
                <option value="Raw Material">Raw Material</option>
                <option value="Finished Goods">Finished Goods</option>
                <option value="WIP Semi-Finished">WIP Semi-Finished</option>
                <option value="Packaging">Packaging</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Product Title / Description *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Precision CNC Machined Flange 100mm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Unit of Measure (UOM)
              </label>
              <select
                value={form.uom}
                onChange={(e) => setForm({ ...form, uom: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}
              >
                <option value="PCS">PCS (Pieces)</option>
                <option value="KG">KG (Kilograms)</option>
                <option value="LTR">LTR (Liters)</option>
                <option value="BOX">BOX (Boxes)</option>
                <option value="MTR">MTR (Meters)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Selling Rate (₹)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.sellingPrice}
                onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Initial Stock
              </label>
              <input
                type="number"
                placeholder="0"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
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
              style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#7f22fe', color: '#ffffff', fontWeight: 700 }}
            >
              Register SKU
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(productToDelete)}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Catalogue SKU?"
        message={`Are you sure you want to remove product "${productToDelete?.name}" (${productToDelete?.sku})?`}
        confirmLabel="Delete SKU"
        isDanger={true}
      />
    </div>
  );
}

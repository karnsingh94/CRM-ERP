'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '../../lib/api';
import {
  IconPlus,
  IconSearch,
  IconShoppingBag,
  IconFileText,
  IconTrash,
  IconCheck,
} from '../ui/Icons';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import ServiceDepartments from '../departments/ServiceDepartments';

export default function SalesModule({ activeCompany, showToast, initialSubTab }) {
  const router = useRouter();
  const pathname = usePathname();

  // Route map for Sales tabs
  const TAB_ROUTES = {
    orders: '/sales/orders',
    quotes: '/sales/quotations',
    proforma: '/sales/proforma',
    departments: '/services/crm-sales/department-head',
  };

  const [activeTab, setActiveTab] = useState(initialSubTab || 'orders');

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab);
    } else if (pathname) {
      if (pathname.includes('/sales/quotations')) setActiveTab('quotes');
      else if (pathname.includes('/sales/proforma')) setActiveTab('proforma');
      else if (pathname.includes('/departments')) setActiveTab('departments');
      else if (pathname.includes('/sales/orders')) setActiveTab('orders');
    }
  }, [initialSubTab, pathname]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Handle Tab Change and sync URL route immediately
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchQuery('');
    setStatusFilter('ALL');

    const targetRoute = TAB_ROUTES[newTab];
    if (targetRoute && pathname !== targetRoute) {
      router.push(targetRoute);
    }
  };

  // -------------------------------------------------------------
  // 1. SALES ORDERS
  // -------------------------------------------------------------
  const [orders, setOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [orderForm, setOrderForm] = useState({
    customer: '',
    itemsCount: 1,
    amount: '',
    status: 'PENDING_APPROVAL',
  });

  const loadOrders = async () => {
    if (!activeCompany?.id) return;
    setIsLoadingOrders(true);
    try {
      const res = await api.get(`/companies/${activeCompany.id}/sales/orders`, { noCache: true });
      setOrders(res.data || []);
    } catch (err) {
      // Ignore
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [activeCompany?.id]);

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!orderForm.customer || !orderForm.amount) {
      showToast('Validation Error', 'Customer and order amount are required', 'danger');
      return;
    }
    setIsSavingOrder(true);
    try {
      const res = await api.post(`/companies/${activeCompany.id}/sales/orders`, orderForm);
      setOrders([res.data, ...orders]);
      setShowAddOrderModal(false);
      setOrderForm({ customer: '', itemsCount: 1, amount: '', status: 'PENDING_APPROVAL' });
      showToast('Sales Order Created! 📑', `Order ${res.data.orderNo} registered in database.`, 'success');
    } catch (err) {
      showToast('Error', err.message || 'Could not create order.', 'danger');
    } finally {
      setIsSavingOrder(false);
    }
  };

  // -------------------------------------------------------------
  // 2. QUOTATIONS
  // -------------------------------------------------------------
  const [quotes, setQuotes] = useState([]);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [showAddQuoteModal, setShowAddQuoteModal] = useState(false);
  const [isSavingQuote, setIsSavingQuote] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    customer: '',
    title: '',
    amount: '',
    validUntil: '',
    status: 'DRAFT',
  });

  const loadQuotes = async () => {
    if (!activeCompany?.id) return;
    setIsLoadingQuotes(true);
    try {
      const res = await api.get(`/companies/${activeCompany.id}/sales/quotations`, { noCache: true });
      setQuotes(res.data || []);
    } catch (err) {
      // Ignore
    } finally {
      setIsLoadingQuotes(false);
    }
  };

  useEffect(() => {
    loadQuotes();
  }, [activeCompany?.id]);

  const handleCreateQuote = async (e) => {
    e.preventDefault();
    if (!quoteForm.customer || !quoteForm.amount) {
      showToast('Validation Error', 'Client name and quotation value are required', 'danger');
      return;
    }
    setIsSavingQuote(true);
    try {
      const res = await api.post(`/companies/${activeCompany.id}/sales/quotations`, quoteForm);
      setQuotes([res.data, ...quotes]);
      setShowAddQuoteModal(false);
      setQuoteForm({ customer: '', title: '', amount: '', validUntil: '', status: 'DRAFT' });
      showToast('Quotation Created! 📄', `Quote ${res.data.quoteNo} saved to database.`, 'success');
    } catch (err) {
      showToast('Error', err.message || 'Could not create quotation.', 'danger');
    } finally {
      setIsSavingQuote(false);
    }
  };

  // -------------------------------------------------------------
  // 3. PROFORMA INVOICES
  // -------------------------------------------------------------
  const [proformas, setProformas] = useState([]);
  const [isLoadingProformas, setIsLoadingProformas] = useState(false);
  const [showAddProformaModal, setShowAddProformaModal] = useState(false);
  const [isSavingProforma, setIsSavingProforma] = useState(false);
  const [proformaForm, setProformaForm] = useState({
    customer: '',
    refOrder: '',
    amount: '',
    dueDate: '',
    gstRate: '18',
    status: 'ISSUED',
  });

  const loadProformas = async () => {
    if (!activeCompany?.id) return;
    setIsLoadingProformas(true);
    try {
      const res = await api.get(`/companies/${activeCompany.id}/sales/proforma`, { noCache: true });
      setProformas(res.data || []);
    } catch (err) {
      // Ignore
    } finally {
      setIsLoadingProformas(false);
    }
  };

  useEffect(() => {
    loadProformas();
  }, [activeCompany?.id]);

  const handleCreateProforma = async (e) => {
    e.preventDefault();
    if (!proformaForm.customer || !proformaForm.amount) {
      showToast('Validation Error', 'Customer name and invoice amount are required', 'danger');
      return;
    }
    setIsSavingProforma(true);
    try {
      const res = await api.post(`/companies/${activeCompany.id}/sales/proforma`, {
        customer: proformaForm.customer,
        orderRef: proformaForm.refOrder,
        amount: proformaForm.amount,
        status: proformaForm.status,
      });
      setProformas([res.data, ...proformas]);
      setShowAddProformaModal(false);
      setProformaForm({ customer: '', refOrder: '', amount: '', dueDate: '', gstRate: '18', status: 'ISSUED' });
      showToast('Proforma Issued! 🧾', `Proforma Invoice ${res.data.invoiceNo} saved to database.`, 'success');
    } catch (err) {
      showToast('Error', err.message || 'Could not issue proforma.', 'danger');
    } finally {
      setIsSavingProforma(false);
    }
  };

  // Delete Item helper
  const [itemToDelete, setItemToDelete] = useState(null);
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (itemToDelete.type === 'order') {
        await api.delete(`/companies/${activeCompany.id}/sales/orders/${itemToDelete.item.id}`);
        setOrders(orders.filter(o => o.id !== itemToDelete.item.id));
        showToast('Order Deleted', `Sales order ${itemToDelete.name} deleted.`, 'danger');
      } else if (itemToDelete.type === 'quote') {
        await api.delete(`/companies/${activeCompany.id}/sales/quotations/${itemToDelete.item.id}`);
        setQuotes(quotes.filter(q => q.id !== itemToDelete.item.id));
        showToast('Quote Deleted', `Quotation ${itemToDelete.name} deleted.`, 'danger');
      } else if (itemToDelete.type === 'proforma') {
        await api.delete(`/companies/${activeCompany.id}/sales/proforma/${itemToDelete.item.id}`);
        setProformas(proformas.filter(p => p.id !== itemToDelete.item.id));
        showToast('Proforma Deleted', `Proforma Invoice ${itemToDelete.name} deleted.`, 'danger');
      }
    } catch (err) {
      showToast('Error', err.message || 'Could not delete item.', 'danger');
    } finally {
      setItemToDelete(null);
    }
  };

  // Filtered lists
  const filteredOrders = orders.filter((o) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q || o.orderNo.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredQuotes = quotes.filter((q) => {
    const s = searchQuery.toLowerCase().trim();
    const matchSearch = !s || q.quoteNo.toLowerCase().includes(s) || q.customer.toLowerCase().includes(s) || q.title.toLowerCase().includes(s);
    const matchStatus = statusFilter === 'ALL' || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredProformas = proformas.filter((p) => {
    const s = searchQuery.toLowerCase().trim();
    const matchSearch = !s || p.piNo.toLowerCase().includes(s) || p.customer.toLowerCase().includes(s);
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Module Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
            Sales Operations &amp; Commercial Orders
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Quotations, Proforma Invoices, and Confirmed Sales Orders for {activeCompany?.organizationName || 'your organization'}
          </p>
        </div>

        {/* Dynamic Action Button based on active tab */}
        {activeTab === 'orders' && (
          <button
            type="button"
            onClick={() => setShowAddOrderModal(true)}
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
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <IconPlus size={16} /> Create Sales Order
          </button>
        )}

        {activeTab === 'quotes' && (
          <button
            type="button"
            onClick={() => setShowAddQuoteModal(true)}
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
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <IconPlus size={16} /> New Quotation
          </button>
        )}

        {activeTab === 'proforma' && (
          <button
            type="button"
            onClick={() => setShowAddProformaModal(true)}
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
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <IconPlus size={16} /> Issue Proforma Invoice
          </button>
        )}
      </div>

      {/* Module Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => handleTabChange('orders')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: activeTab === 'orders' ? 800 : 600,
            color: activeTab === 'orders' ? '#7f22fe' : '#64748b',
            borderBottom: activeTab === 'orders' ? '2px solid #7f22fe' : '2px solid transparent',
            background: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            fontSize: '0.88rem',
            cursor: 'pointer',
          }}
        >
          Sales Orders ({orders.length})
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('quotes')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: activeTab === 'quotes' ? 800 : 600,
            color: activeTab === 'quotes' ? '#7f22fe' : '#64748b',
            borderBottom: activeTab === 'quotes' ? '2px solid #7f22fe' : '2px solid transparent',
            background: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            fontSize: '0.88rem',
            cursor: 'pointer',
          }}
        >
          Quotations ({quotes.length})
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('proforma')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: activeTab === 'proforma' ? 800 : 600,
            color: activeTab === 'proforma' ? '#7f22fe' : '#64748b',
            borderBottom: activeTab === 'proforma' ? '2px solid #7f22fe' : '2px solid transparent',
            background: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            fontSize: '0.88rem',
            cursor: 'pointer',
          }}
        >
          Proforma Invoices ({proformas.length})
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
          <span>Department Head</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. SALES ORDERS CONTENT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'orders' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search by order number or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', maxWidth: '340px', padding: '0.5rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#ffffff' }}
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="DELIVERED">Delivered</option>
              </select>
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <EmptyState
              icon="📑"
              title="No Sales Orders"
              description="No sales orders have been registered yet. Click 'Create Sales Order' to record customer purchases."
              actionLabel="Create Sales Order"
              onAction={() => setShowAddOrderModal(true)}
            />
          ) : (
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>Order Number</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Client Customer</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Order Date</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Line Items</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Total Amount</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Order Status</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Payment</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => (
                    <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#7f22fe', whiteSpace: 'nowrap' }}>
                        {o.orderNo}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {o.customer}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {o.date}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {o.itemsCount} SKUs
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        ₹ {o.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
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
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.78rem', color: o.paymentStatus === 'PAID' ? '#10b981' : '#f59e0b' }}>
                          {o.paymentStatus}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => setItemToDelete({ type: 'order', item: o, name: o.orderNo })}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            color: '#dc2626',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            cursor: 'pointer',
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

      {/* ------------------------------------------------------------- */}
      {/* 2. QUOTATIONS CONTENT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'quotes' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search by quote number, customer, or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', maxWidth: '340px', padding: '0.5rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#ffffff' }}
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="SENT">Sent</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          {filteredQuotes.length === 0 ? (
            <EmptyState
              icon="📄"
              title="No Quotations Issued"
              description="No formal price proposals issued yet. Click 'New Quotation' to generate a commercial quote."
              actionLabel="New Quotation"
              onAction={() => setShowAddQuoteModal(true)}
            />
          ) : (
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>Quote Number</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Proposal Title</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Client Organization</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Issued Date</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Valid Until</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Quoted Amount</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotes.map((q) => (
                    <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#7f22fe', whiteSpace: 'nowrap' }}>
                        {q.quoteNo}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {q.title}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                        {q.customer}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {q.date}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#b45309', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {q.validUntil}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        ₹ {q.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: q.status === 'ACCEPTED' ? '#ecfdf5' : q.status === 'SENT' ? '#eff6ff' : '#fffbeb',
                            color: q.status === 'ACCEPTED' ? '#047857' : q.status === 'SENT' ? '#1d4ed8' : '#b45309',
                            border: `1px solid ${q.status === 'ACCEPTED' ? '#a7f3d0' : q.status === 'SENT' ? '#bfdbfe' : '#fde68a'}`,
                          }}
                        >
                          {q.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => setItemToDelete({ type: 'quote', item: q, name: q.quoteNo })}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            color: '#dc2626',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            cursor: 'pointer',
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

      {/* ------------------------------------------------------------- */}
      {/* 3. PROFORMA INVOICES CONTENT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'proforma' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search by PI number or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', maxWidth: '340px', padding: '0.5rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#ffffff' }}
              >
                <option value="ALL">All Statuses</option>
                <option value="ISSUED">Issued</option>
                <option value="PAID">Paid</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {filteredProformas.length === 0 ? (
            <EmptyState
              icon="🧾"
              title="No Proforma Invoices"
              description="No proforma commercial invoices issued yet. Click 'Issue Proforma Invoice' to request advance customer payments."
              actionLabel="Issue Proforma Invoice"
              onAction={() => setShowAddProformaModal(true)}
            />
          ) : (
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>PI Number</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Client Organization</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Ref Sales Order</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Issue Date</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Due Date</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Taxable Amount</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Gross Total (Incl. GST)</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProformas.map((pi) => (
                    <tr key={pi.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#7f22fe', whiteSpace: 'nowrap' }}>
                        {pi.piNo}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {pi.customer}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {pi.refOrder}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {pi.date}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#b91c1c', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {pi.dueDate}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#334155', whiteSpace: 'nowrap' }}>
                        ₹ {pi.baseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        ₹ {pi.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: pi.status === 'PAID' ? '#ecfdf5' : pi.status === 'ISSUED' ? '#eff6ff' : '#fef2f2',
                            color: pi.status === 'PAID' ? '#047857' : pi.status === 'ISSUED' ? '#1d4ed8' : '#b91c1c',
                            border: `1px solid ${pi.status === 'PAID' ? '#a7f3d0' : pi.status === 'ISSUED' ? '#bfdbfe' : '#fecaca'}`,
                          }}
                        >
                          {pi.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => setItemToDelete({ type: 'proforma', item: pi, name: pi.piNo })}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            color: '#dc2626',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            cursor: 'pointer',
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

      {/* ------------------------------------------------------------- */}
      {/* 4. DEPARTMENTS CONTENT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'departments' && (
        <ServiceDepartments
          activeCompany={activeCompany}
          serviceCode="crm_sales"
          showToast={showToast}
        />
      )}

      {/* Create Sales Order Modal */}
      <Modal isOpen={showAddOrderModal} onClose={() => setShowAddOrderModal(false)} title="Generate New Sales Order">
        <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Customer Organization *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Corporation"
              value={orderForm.customer}
              onChange={(e) => setOrderForm({ ...orderForm, customer: e.target.value })}
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
                value={orderForm.itemsCount}
                onChange={(e) => setOrderForm({ ...orderForm, itemsCount: e.target.value })}
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
                value={orderForm.amount}
                onChange={(e) => setOrderForm({ ...orderForm, amount: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => setShowAddOrderModal(false)}
              style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#7f22fe', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
            >
              Confirm Sales Order
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Quotation Modal */}
      <Modal isOpen={showAddQuoteModal} onClose={() => setShowAddQuoteModal(false)} title="Issue New Quotation Proposal">
        <form onSubmit={handleCreateQuote} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Client Organization *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Zenith Tech Solutions"
              value={quoteForm.customer}
              onChange={(e) => setQuoteForm({ ...quoteForm, customer: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Proposal Title
            </label>
            <input
              type="text"
              placeholder="e.g. Annual Cloud Infrastructure Licensing"
              value={quoteForm.title}
              onChange={(e) => setQuoteForm({ ...quoteForm, title: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Quoted Total (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={quoteForm.amount}
                onChange={(e) => setQuoteForm({ ...quoteForm, amount: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Valid Until
              </label>
              <input
                type="date"
                value={quoteForm.validUntil}
                onChange={(e) => setQuoteForm({ ...quoteForm, validUntil: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => setShowAddQuoteModal(false)}
              style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#7f22fe', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
            >
              Generate Quotation
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Proforma Invoice Modal */}
      <Modal isOpen={showAddProformaModal} onClose={() => setShowAddProformaModal(false)} title="Issue Proforma Commercial Invoice">
        <form onSubmit={handleCreateProforma} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Customer Account *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Apex Global Systems"
              value={proformaForm.customer}
              onChange={(e) => setProformaForm({ ...proformaForm, customer: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Ref Sales Order #
              </label>
              <input
                type="text"
                placeholder="e.g. SO-2026-104"
                value={proformaForm.refOrder}
                onChange={(e) => setProformaForm({ ...proformaForm, refOrder: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Payment Due Date
              </label>
              <input
                type="date"
                value={proformaForm.dueDate}
                onChange={(e) => setProformaForm({ ...proformaForm, dueDate: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Taxable Base Value (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={proformaForm.amount}
                onChange={(e) => setProformaForm({ ...proformaForm, amount: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Applicable GST Rate (%)
              </label>
              <select
                value={proformaForm.gstRate}
                onChange={(e) => setProformaForm({ ...proformaForm, gstRate: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}
              >
                <option value="0">0% (Exempt)</option>
                <option value="5">5% (Essential Goods)</option>
                <option value="12">12% (Standard Low)</option>
                <option value="18">18% (Standard Services/Goods)</option>
                <option value="28">28% (Luxury/Special)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => setShowAddProformaModal(false)}
              style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#7f22fe', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
            >
              Issue Commercial Proforma
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(itemToDelete)}
        title="Confirm Record Deletion"
        message={`Are you sure you want to permanently delete "${itemToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Permanently"
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
}

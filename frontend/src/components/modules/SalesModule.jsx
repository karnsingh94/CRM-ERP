'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';
import {
  IconPlus,
  IconSearch,
  IconShoppingBag,
  IconFileText,
  IconTrash,
  IconCheck,
  IconAlertTriangle,
  IconCheckCircle,
  IconClipboardCheck,
  IconBuilding,
  IconFilter,
} from '../ui/Icons';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import ServiceDepartments from '../departments/ServiceDepartments';
import QuotationModal from '../sales/QuotationModal';
import SalesOrderModal from '../sales/SalesOrderModal';

export default function SalesModule({ activeCompany, showToast, initialSubTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const customerParam = searchParams ? searchParams.get('customer') : null;
  const opportunityIdParam = searchParams ? searchParams.get('opportunityId') : null;

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
      if (activeTab !== initialSubTab) {
        setActiveTab(initialSubTab);
      }
    } else if (pathname) {
      let resolved = 'orders';
      if (pathname.includes('/sales/quotations')) resolved = 'quotes';
      else if (pathname.includes('/sales/proforma')) resolved = 'proforma';
      else if (pathname.includes('/departments')) resolved = 'departments';
      if (activeTab !== resolved) {
        setActiveTab(resolved);
      }
    }
  }, [initialSubTab, pathname, activeTab]);

  useEffect(() => {
    if (customerParam) {
      if (pathname.includes('/sales/quotations')) {
        setQuoteForm((prev) => ({
          ...prev,
          customer: customerParam,
          opportunityId: opportunityIdParam || prev.opportunityId,
        }));
        setShowAddQuoteModal(true);
      } else if (pathname.includes('/sales/orders')) {
        setOrderForm((prev) => ({ ...prev, customer: customerParam }));
        setShowAddOrderModal(true);
      }
    }
  }, [customerParam, opportunityIdParam, pathname]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Handle Tab Change and sync URL route immediately
  const handleTabChange = (newTab) => {
    if (activeTab === newTab) return;
    setActiveTab(newTab);
    setSearchQuery('');
    setStatusFilter('ALL');

    const targetRoute = TAB_ROUTES[newTab];
    if (targetRoute && pathname !== targetRoute) {
      router.push(targetRoute, { scroll: false });
    }
  };

  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // 1. SALES ORDERS
  // -------------------------------------------------------------
  const [orders, setOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState([]);

  const createEmptyLineItem = () => ({
    item: '',
    qty: 1,
    rate: '',
    gst: '18',
    total: 0,
  });

  const calculateItemLineTotal = (it) => {
    const qty = parseFloat(it.qty) || 0;
    const rate = parseFloat(it.rate) || 0;
    const gstPct = parseFloat(it.gst) || 0;
    const base = qty * rate;
    return base + (base * gstPct) / 100;
  };

  const [orderForm, setOrderForm] = useState({
    customer: '',
    assignedTo: '',
    items: [createEmptyLineItem()],
    notes: '',
    itemsCount: 1,
    amount: '',
    status: 'PENDING_APPROVAL',
  });

  const handleOrderItemChange = (index, field, value) => {
    setOrderForm((prev) => {
      const updated = [...prev.items];
      const target = { ...updated[index], [field]: value };

      // If user selected an item from catalog, auto-fill unit selling price
      if (field === 'item') {
        const found = catalogProducts.find((p) => p.name === value || p.sku === value);
        if (found && found.sellingPrice) {
          target.rate = found.sellingPrice;
        }
      }

      target.total = calculateItemLineTotal(target);
      updated[index] = target;

      const grandTotal = updated.reduce((sum, it) => sum + (parseFloat(it.total) || 0), 0);
      const totalUnits = updated.reduce((sum, it) => sum + (parseInt(it.qty) || 1), 0);

      return {
        ...prev,
        items: updated,
        itemsCount: totalUnits,
        amount: grandTotal > 0 ? grandTotal.toFixed(2) : prev.amount,
      };
    });
  };

  const handleAddOrderItem = () => {
    setOrderForm((prev) => ({
      ...prev,
      items: [...prev.items, createEmptyLineItem()],
    }));
  };

  const handleRemoveOrderItem = (index) => {
    setOrderForm((prev) => {
      if (prev.items.length <= 1) return prev;
      const updated = prev.items.filter((_, i) => i !== index);
      const grandTotal = updated.reduce((sum, it) => sum + (parseFloat(it.total) || 0), 0);
      const totalUnits = updated.reduce((sum, it) => sum + (parseInt(it.qty) || 1), 0);
      return {
        ...prev,
        items: updated,
        itemsCount: totalUnits,
        amount: grandTotal > 0 ? grandTotal.toFixed(2) : '',
      };
    });
  };

  const loadOrders = async () => {
    if (!activeCompany?.id) return;
    if (orders.length === 0) {
      setIsLoadingOrders(true);
    }
    try {
      const res = await api.get(`/companies/${activeCompany.id}/sales/orders`, { noCache: true });
      setOrders(res.data || []);
    } catch (err) {
      // Ignore
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // Load catalog products for auto-suggestion
  useEffect(() => {
    if (!activeCompany?.id) return;
    const fetchCatalog = async () => {
      try {
        const res = await api.get(`/companies/${activeCompany.id}/products`);
        if (res.data) setCatalogProducts(res.data);
      } catch {}
    };
    fetchCatalog();
  }, [activeCompany?.id]);

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
      setOrderForm({ customer: '', assignedTo: '', items: [createEmptyLineItem()], notes: '', itemsCount: 1, amount: '', status: 'PENDING_APPROVAL' });
      showToast('Sales Order Created! 📑', `Order ${res.data.orderNo} registered with line items.`, 'success');
    } catch (err) {
      showToast('Error', err.message || 'Could not create order.', 'danger');
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus, newPaymentStatus) => {
    try {
      const payload = {};
      if (newStatus !== undefined) payload.status = newStatus;
      if (newPaymentStatus !== undefined) payload.paymentStatus = newPaymentStatus;
      const res = await api.patch(`/companies/${activeCompany.id}/sales/orders/${orderId}/status`, payload);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? (res.data || { ...o, ...payload }) : o)));
      showToast('Order Updated! 🚀', `Order status updated successfully.`, 'success');
    } catch (err) {
      showToast('Error', err.message || 'Could not update order status.', 'danger');
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
    items: [createEmptyLineItem()],
    notes: '',
    amount: '',
    validUntil: '',
    status: 'DRAFT',
  });

  const handleQuoteItemChange = (index, field, value) => {
    setQuoteForm((prev) => {
      const updated = [...prev.items];
      const target = { ...updated[index], [field]: value };

      // Auto-fill price if selected from catalog
      if (field === 'item') {
        const found = catalogProducts.find((p) => p.name === value || p.sku === value);
        if (found && found.sellingPrice) {
          target.rate = found.sellingPrice;
        }
      }

      target.total = calculateItemLineTotal(target);
      updated[index] = target;

      const grandTotal = updated.reduce((sum, it) => sum + (parseFloat(it.total) || 0), 0);
      return {
        ...prev,
        items: updated,
        amount: grandTotal > 0 ? grandTotal.toFixed(2) : prev.amount,
      };
    });
  };

  const handleAddQuoteItem = () => {
    setQuoteForm((prev) => ({
      ...prev,
      items: [...prev.items, createEmptyLineItem()],
    }));
  };

  const handleRemoveQuoteItem = (index) => {
    setQuoteForm((prev) => {
      if (prev.items.length <= 1) return prev;
      const updated = prev.items.filter((_, i) => i !== index);
      const grandTotal = updated.reduce((sum, it) => sum + (parseFloat(it.total) || 0), 0);
      return {
        ...prev,
        items: updated,
        amount: grandTotal > 0 ? grandTotal.toFixed(2) : '',
      };
    });
  };

  const loadQuotes = async () => {
    if (!activeCompany?.id) return;
    if (quotes.length === 0) {
      setIsLoadingQuotes(true);
    }
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
      setQuoteForm({ customer: '', title: '', items: [createEmptyLineItem()], notes: '', amount: '', validUntil: '', status: 'DRAFT' });
      showToast('Quotation Created! 📄', `Quote ${res.data.quoteNo} saved with itemized line items.`, 'success');
    } catch (err) {
      showToast('Error', err.message || 'Could not create quotation.', 'danger');
    } finally {
      setIsSavingQuote(false);
    }
  };

  const handleUpdateQuoteStatus = async (quoteId, newStatus) => {
    try {
      const res = await api.patch(`/companies/${activeCompany.id}/sales/quotations/${quoteId}/status`, { status: newStatus });
      setQuotes((prev) => prev.map((q) => (q.id === quoteId ? (res.data || { ...q, status: newStatus }) : q)));
      showToast('Quotation Updated! 📄', `Status marked as ${newStatus}.`, 'success');
    } catch (err) {
      showToast('Error', err.message || 'Could not update quotation.', 'danger');
    }
  };

  const handleConvertQuoteToOrder = async (quote) => {
    try {
      const res = await api.post(`/companies/${activeCompany.id}/sales/quotations/${quote.id}/convert-to-order`);
      if (res.data) {
        setOrders((prev) => [res.data, ...prev]);
      } else {
        loadOrders();
      }
      setQuotes((prev) => prev.map((q) => (q.id === quote.id ? { ...q, status: 'ACCEPTED' } : q)));
      showToast('Converted to Sales Order! ⚡', `Sales order created for ${quote.customer}.`, 'success');
      setActiveTab('orders');
    } catch (err) {
      showToast('Error', err.message || 'Could not convert quote to order.', 'danger');
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
    if (proformas.length === 0) {
      setIsLoadingProformas(true);
    }
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

  const handleUpdateProformaStatus = async (proformaId, newStatus) => {
    try {
      const res = await api.patch(`/companies/${activeCompany.id}/sales/proforma/${proformaId}/status`, { status: newStatus });
      setProformas((prev) => prev.map((p) => (p.id === proformaId ? (res.data || { ...p, status: newStatus }) : p)));
      showToast('Proforma Updated! 🧾', `Status updated to ${newStatus}.`, 'success');
    } catch (err) {
      showToast('Error', err.message || 'Could not update proforma status.', 'danger');
    }
  };

  const formatDate = (dateVal) => {
    if (!dateVal) return '-';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return String(dateVal);
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
    const matchSearch = !s || q.quoteNo.toLowerCase().includes(s) || q.customer.toLowerCase().includes(s) || (q.title && q.title.toLowerCase().includes(s));
    const matchStatus = statusFilter === 'ALL' || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredProformas = proformas.filter((p) => {
    const s = searchQuery.toLowerCase().trim();
    const piNum = (p.invoiceNo || p.piNo || '').toLowerCase();
    const matchSearch = !s || piNum.includes(s) || (p.customer && p.customer.toLowerCase().includes(s));
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // KPI Calculations
  const pendingOrdersCount = orders.filter((o) => o.status === 'PENDING_APPROVAL').length;
  const approvedOrdersCount = orders.filter((o) => o.status === 'APPROVED' || o.status === 'DELIVERED').length;
  const totalRevenue = orders
    .filter((o) => o.status === 'APPROVED' || o.status === 'DELIVERED')
    .reduce((acc, o) => acc + (parseFloat(o.amount) || 0), 0);
  const totalPendingAmount = orders
    .filter((o) => o.status === 'PENDING_APPROVAL')
    .reduce((acc, o) => acc + (parseFloat(o.amount) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Module Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', background: '#ffffff', padding: '1.25rem 1.5rem', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '2px 9px', borderRadius: '999px', background: '#f5f3ff', color: '#7f22fe', fontSize: '0.73rem', fontWeight: 700, marginBottom: '0.35rem' }}>
            <span>●</span> CRM &amp; Commercial Sales
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            Sales Operations &amp; Commercial Orders
          </h2>
          <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '0.25rem 0 0' }}>
            Manage quotations, approve incoming commercial orders, and issue proforma invoices for {activeCompany?.organizationName || 'your organization'}
          </p>
        </div>

        {/* Dynamic Action Button based on active tab */}
        {activeTab === 'orders' && (
          <button
            type="button"
            onClick={() => setShowAddOrderModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              background: 'linear-gradient(135deg, #7f22fe 0%, #6d28d9 100%)',
              color: '#ffffff',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.86rem',
              boxShadow: '0 4px 10px rgba(127, 34, 254, 0.28)',
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
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              background: 'linear-gradient(135deg, #7f22fe 0%, #6d28d9 100%)',
              color: '#ffffff',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.86rem',
              boxShadow: '0 4px 10px rgba(127, 34, 254, 0.28)',
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
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              background: 'linear-gradient(135deg, #7f22fe 0%, #6d28d9 100%)',
              color: '#ffffff',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.86rem',
              boxShadow: '0 4px 10px rgba(127, 34, 254, 0.28)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <IconPlus size={16} /> Issue Proforma Invoice
          </button>
        )}
      </div>

      {/* KPI Metric Summary Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem' }}>
        {/* Card 1: Total Orders */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '1.1rem 1.25rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Orders
            </span>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#f5f3ff', color: '#7f22fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconShoppingBag size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {orders.length}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#7f22fe' }}></span>
            <span>{orders.filter(o => o.status === 'DELIVERED').length} delivered • {orders.filter(o => o.paymentStatus === 'PAID').length} paid</span>
          </div>
        </div>

        {/* Card 2: Awaiting Approval */}
        <div style={{
          background: pendingOrdersCount > 0 ? '#fffdf7' : '#ffffff',
          border: pendingOrdersCount > 0 ? '1px solid #fde68a' : '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '1.1rem 1.25rem',
          boxShadow: pendingOrdersCount > 0 ? '0 2px 8px rgba(245, 158, 11, 0.08)' : '0 1px 3px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: pendingOrdersCount > 0 ? '#b45309' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Awaiting Approval
            </span>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: pendingOrdersCount > 0 ? '#fef3c7' : '#f8fafc', color: pendingOrdersCount > 0 ? '#d97706' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconAlertTriangle size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: pendingOrdersCount > 0 ? '#b45309' : '#0f172a', letterSpacing: '-0.02em' }}>
              {pendingOrdersCount}
            </span>
            {pendingOrdersCount > 0 && (
              <span style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', border: '1px solid #fde68a' }}>
                Action Req
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.74rem', color: pendingOrdersCount > 0 ? '#92400e' : '#64748b', marginTop: '0.35rem', fontWeight: pendingOrdersCount > 0 ? 600 : 400 }}>
            {pendingOrdersCount > 0 ? `Total Value: ₹ ${totalPendingAmount.toLocaleString('en-IN')}` : 'All orders approved ✓'}
          </div>
        </div>

        {/* Card 3: Confirmed Revenue */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '1.1rem 1.25rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Confirmed Revenue
            </span>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconCheckCircle size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', letterSpacing: '-0.02em' }}>
            ₹ {totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.35rem' }}>
            From {approvedOrdersCount} authorized orders
          </div>
        </div>

        {/* Card 4: Quotations & Pipeline */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '1.1rem 1.25rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Proposals &amp; Invoices
            </span>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconFileText size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {quotes.length} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Quotes</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.35rem' }}>
            {quotes.filter(q => q.status === 'ACCEPTED').length} accepted • {proformas.length} proformas
          </div>
        </div>
      </div>

      {/* Pending Approval Alert Banner */}
      {pendingOrdersCount > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          border: '1px solid #fde68a',
          borderRadius: '12px',
          padding: '0.9rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          boxShadow: '0 2px 6px rgba(245, 158, 11, 0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #fde68a' }}>
              <IconAlertTriangle size={18} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#92400e' }}>
                {pendingOrdersCount} Sales Order{pendingOrdersCount > 1 ? 's' : ''} Awaiting Commercial Approval
              </p>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: '#b45309' }}>
                Review customer details and verify pricing below, then click <strong>&quot;✓ Approve&quot;</strong> to confirm fulfilment and billing.
              </p>
            </div>
          </div>
          {activeTab !== 'orders' ? (
            <button
              type="button"
              onClick={() => handleTabChange('orders')}
              style={{
                padding: '0.5rem 1.1rem',
                borderRadius: '8px',
                background: '#d97706',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.8rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(217, 119, 6, 0.25)',
              }}
            >
              Review Orders →
            </button>
          ) : (
            <span style={{ fontSize: '0.76rem', color: '#92400e', fontWeight: 700, background: '#ffffff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #fde68a' }}>
              Review order row below ↓
            </span>
          )}
        </div>
      )}

      {/* Module Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '0.35rem', flexWrap: 'wrap', paddingBottom: '0.2rem' }}>
        <button
          type="button"
          onClick={() => handleTabChange('orders')}
          style={{
            padding: '0.65rem 1.15rem',
            fontWeight: activeTab === 'orders' ? 700 : 600,
            color: activeTab === 'orders' ? '#7f22fe' : '#64748b',
            borderBottom: activeTab === 'orders' ? '2px solid #7f22fe' : '2px solid transparent',
            background: activeTab === 'orders' ? '#faf5ff' : 'transparent',
            borderRadius: '8px 8px 0 0',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            fontSize: '0.86rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          <IconShoppingBag size={16} />
          <span>Sales Orders</span>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '1px 7px',
            borderRadius: '999px',
            background: pendingOrdersCount > 0 ? '#fef3c7' : (activeTab === 'orders' ? '#e9d5ff' : '#f1f5f9'),
            color: pendingOrdersCount > 0 ? '#b45309' : (activeTab === 'orders' ? '#7f22fe' : '#64748b'),
            border: pendingOrdersCount > 0 ? '1px solid #fde68a' : 'none',
          }}>
            {pendingOrdersCount > 0 ? `${orders.length} (${pendingOrdersCount} Pending)` : orders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('quotes')}
          style={{
            padding: '0.65rem 1.15rem',
            fontWeight: activeTab === 'quotes' ? 700 : 600,
            color: activeTab === 'quotes' ? '#7f22fe' : '#64748b',
            borderBottom: activeTab === 'quotes' ? '2px solid #7f22fe' : '2px solid transparent',
            background: activeTab === 'quotes' ? '#faf5ff' : 'transparent',
            borderRadius: '8px 8px 0 0',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            fontSize: '0.86rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          <IconFileText size={16} />
          <span>Quotations</span>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '1px 7px',
            borderRadius: '999px',
            background: activeTab === 'quotes' ? '#e9d5ff' : '#f1f5f9',
            color: activeTab === 'quotes' ? '#7f22fe' : '#64748b',
          }}>
            {quotes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('proforma')}
          style={{
            padding: '0.65rem 1.15rem',
            fontWeight: activeTab === 'proforma' ? 700 : 600,
            color: activeTab === 'proforma' ? '#7f22fe' : '#64748b',
            borderBottom: activeTab === 'proforma' ? '2px solid #7f22fe' : '2px solid transparent',
            background: activeTab === 'proforma' ? '#faf5ff' : 'transparent',
            borderRadius: '8px 8px 0 0',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            fontSize: '0.86rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          <IconClipboardCheck size={16} />
          <span>Proforma Invoices</span>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '1px 7px',
            borderRadius: '999px',
            background: activeTab === 'proforma' ? '#e9d5ff' : '#f1f5f9',
            color: activeTab === 'proforma' ? '#7f22fe' : '#64748b',
          }}>
            {proformas.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('departments')}
          style={{
            padding: '0.65rem 1.15rem',
            fontWeight: activeTab === 'departments' ? 700 : 600,
            color: activeTab === 'departments' ? '#7f22fe' : '#64748b',
            borderBottom: activeTab === 'departments' ? '2px solid #7f22fe' : '2px solid transparent',
            background: activeTab === 'departments' ? '#faf5ff' : 'transparent',
            borderRadius: '8px 8px 0 0',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            fontSize: '0.86rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          <IconBuilding size={16} />
          <span>Department Head</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. SALES ORDERS CONTENT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'orders' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
              <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                <IconSearch size={15} />
              </span>
              <input
                type="text"
                placeholder="Search by order # or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.85rem 0.55rem 2.35rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                  outline: 'none',
                  background: '#f8fafc',
                  color: '#0f172a',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <IconFilter size={14} /> Filter:
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#ffffff', color: '#334155', fontWeight: 600 }}
              >
                <option value="ALL">All Statuses ({orders.length})</option>
                <option value="PENDING_APPROVAL">Pending Approval ({pendingOrdersCount})</option>
                <option value="APPROVED">Approved ({orders.filter(o => o.status === 'APPROVED').length})</option>
                <option value="DELIVERED">Delivered ({orders.filter(o => o.status === 'DELIVERED').length})</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <EmptyState
              icon="📑"
              title="No Sales Orders Found"
              description="No sales orders match your criteria. Click 'Create Sales Order' to record customer purchases."
              actionLabel="Create Sales Order"
              onAction={() => setShowAddOrderModal(true)}
            />
          ) : (
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', minWidth: '940px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                    <th style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>Order Number</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Client Customer</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Order Date</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Line Items</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Total Amount</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Order Status</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Payment</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions &amp; Approvals</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => (
                    <tr
                      key={o.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: o.status === 'PENDING_APPROVAL' ? '#fffdf7' : 'transparent',
                        borderLeft: o.status === 'PENDING_APPROVAL' ? '3px solid #f59e0b' : '3px solid transparent',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 800, color: '#7f22fe', background: '#faf5ff', padding: '3px 8px', borderRadius: '6px', border: '1px solid #f3e8ff', fontSize: '0.83rem' }}>
                          {o.orderNo}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        <div>{o.customer}</div>
                        {o.assignedTo && (
                          <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600 }}>
                            👤 Rep: {o.assignedTo}
                          </div>
                        )}
                        {o.notes && (
                          <div style={{ fontSize: '0.71rem', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.notes}>
                            📝 {o.notes}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                        {formatDate(o.date || o.createdAt)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {Array.isArray(o.items) && o.items.length > 0 ? (
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>
                              {o.items.length} Item{o.items.length > 1 ? 's' : ''} ({o.itemsCount || o.items.reduce((acc, it) => acc + (parseInt(it.qty) || 1), 0)} Qty)
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.items.map(it => `${it.item} (x${it.qty})`).join(', ')}>
                              {o.items.map(it => `${it.item} (x${it.qty})`).join(', ')}
                            </div>
                          </div>
                        ) : (
                          `${o.itemsCount} SKU${o.itemsCount > 1 ? 's' : ''}`
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', fontSize: '0.88rem' }}>
                        ₹ {parseFloat(o.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 12px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            letterSpacing: '0.01em',
                            background:
                              o.status === 'APPROVED' ? '#ecfdf5' :
                              o.status === 'DELIVERED' ? '#eff6ff' :
                              o.status === 'REJECTED' ? '#fef2f2' : '#fffbeb',
                            color:
                              o.status === 'APPROVED' ? '#047857' :
                              o.status === 'DELIVERED' ? '#1d4ed8' :
                              o.status === 'REJECTED' ? '#b91c1c' : '#b45309',
                            border: `1px solid ${
                              o.status === 'APPROVED' ? '#a7f3d0' :
                              o.status === 'DELIVERED' ? '#bfdbfe' :
                              o.status === 'REJECTED' ? '#fecaca' : '#fde68a'
                            }`,
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background:
                                o.status === 'APPROVED' ? '#10b981' :
                                o.status === 'DELIVERED' ? '#3b82f6' :
                                o.status === 'REJECTED' ? '#ef4444' : '#f59e0b',
                            }}
                          />
                          {o.status === 'PENDING_APPROVAL' && 'Pending Approval'}
                          {o.status === 'APPROVED' && 'Approved'}
                          {o.status === 'DELIVERED' && 'Delivered'}
                          {o.status === 'REJECTED' && 'Rejected'}
                          {!['PENDING_APPROVAL', 'APPROVED', 'DELIVERED', 'REJECTED'].includes(o.status) && (o.status || 'Pending')}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handleUpdateOrderStatus(o.id, undefined, o.paymentStatus === 'PAID' ? 'PENDING' : 'PAID')}
                          style={{
                            fontWeight: 700,
                            fontSize: '0.74rem',
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            border: `1px solid ${o.paymentStatus === 'PAID' ? '#a7f3d0' : '#fed7aa'}`,
                            background: o.paymentStatus === 'PAID' ? '#ecfdf5' : '#fff7ed',
                            color: o.paymentStatus === 'PAID' ? '#059669' : '#c2410c',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                          title="Click to toggle Payment Status (PAID / PENDING)"
                        >
                          <span style={{ fontSize: '0.65rem' }}>{o.paymentStatus === 'PAID' ? '✓' : '⏳'}</span>
                          <span>{o.paymentStatus === 'PAID' ? 'Paid' : 'Pending'}</span>
                        </button>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', justifyContent: 'flex-end' }}>
                          {o.status === 'PENDING_APPROVAL' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateOrderStatus(o.id, 'APPROVED')}
                                style={{
                                  padding: '5px 12px',
                                  borderRadius: '6px',
                                  color: '#ffffff',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  border: 'none',
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Approve this order"
                              >
                                <span>✓</span> Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateOrderStatus(o.id, 'REJECTED')}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  color: '#dc2626',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: '#ffffff',
                                  border: '1px solid #fecaca',
                                  cursor: 'pointer',
                                }}
                                title="Reject this order"
                              >
                                ✕ Reject
                              </button>
                            </>
                          )}
                          {o.status === 'APPROVED' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateOrderStatus(o.id, 'DELIVERED')}
                              style={{
                                padding: '5px 12px',
                                borderRadius: '6px',
                                color: '#ffffff',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title="Mark goods as Delivered"
                            >
                              <span>🚚</span> Deliver
                            </button>
                          )}
                          {o.status === 'REJECTED' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateOrderStatus(o.id, 'PENDING_APPROVAL')}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                color: '#b45309',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: '#fffbeb',
                                border: '1px solid #fde68a',
                                cursor: 'pointer',
                              }}
                              title="Reopen order for approval"
                            >
                              ↺ Re-open
                            </button>
                          )}
                          {o.status === 'DELIVERED' && (
                            <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 700, padding: '4px 8px', background: '#ecfdf5', borderRadius: '4px' }}>
                              ✓ Fulfilled
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setItemToDelete({ type: 'order', item: o, name: o.orderNo })}
                            style={{
                              padding: '5px 9px',
                              borderRadius: '6px',
                              color: '#94a3b8',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: 'transparent',
                              border: '1px solid #e2e8f0',
                              cursor: 'pointer',
                            }}
                            title="Delete order"
                          >
                            Delete
                          </button>
                        </div>
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
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
              <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                <IconSearch size={15} />
              </span>
              <input
                type="text"
                placeholder="Search by quote #, customer, or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.85rem 0.55rem 2.35rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                  outline: 'none',
                  background: '#f8fafc',
                  color: '#0f172a',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <IconFilter size={14} /> Filter:
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#ffffff', color: '#334155', fontWeight: 600 }}
              >
                <option value="ALL">All Statuses ({quotes.length})</option>
                <option value="DRAFT">Draft ({quotes.filter(q => q.status === 'DRAFT').length})</option>
                <option value="SENT">Sent ({quotes.filter(q => q.status === 'SENT').length})</option>
                <option value="ACCEPTED">Accepted ({quotes.filter(q => q.status === 'ACCEPTED').length})</option>
                <option value="REJECTED">Rejected ({quotes.filter(q => q.status === 'REJECTED').length})</option>
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
              <table style={{ width: '100%', minWidth: '940px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                    <th style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>Quote Number</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Proposal Title</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Client Organization</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Issued Date</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Valid Until</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Quoted Amount</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions &amp; Workflow</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotes.map((q) => (
                    <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#7f22fe', whiteSpace: 'nowrap' }}>
                        {q.quoteNo}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        <div>{q.title}</div>
                        {Array.isArray(q.items) && q.items.length > 0 && (
                          <div style={{ fontSize: '0.72rem', color: '#7f22fe', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={q.items.map(it => `${it.item} (x${it.qty})`).join(', ')}>
                            📦 {q.items.map(it => `${it.item} (x${it.qty})`).join(', ')}
                          </div>
                        )}
                        {q.notes && (
                          <div style={{ fontSize: '0.71rem', color: '#64748b', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={q.notes}>
                            📝 {q.notes}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                        {q.customer}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                        {formatDate(q.date || q.createdAt)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#b45309', fontWeight: 600, whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                        {formatDate(q.validUntil)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        ₹ {parseFloat(q.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 12px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            letterSpacing: '0.01em',
                            background:
                              q.status === 'ACCEPTED' ? '#ecfdf5' :
                              q.status === 'SENT' ? '#eff6ff' :
                              q.status === 'REJECTED' ? '#fef2f2' : '#fffbeb',
                            color:
                              q.status === 'ACCEPTED' ? '#047857' :
                              q.status === 'SENT' ? '#1d4ed8' :
                              q.status === 'REJECTED' ? '#b91c1c' : '#b45309',
                            border: `1px solid ${
                              q.status === 'ACCEPTED' ? '#a7f3d0' :
                              q.status === 'SENT' ? '#bfdbfe' :
                              q.status === 'REJECTED' ? '#fecaca' : '#fde68a'
                            }`,
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background:
                                q.status === 'ACCEPTED' ? '#10b981' :
                                q.status === 'SENT' ? '#3b82f6' :
                                q.status === 'REJECTED' ? '#ef4444' : '#f59e0b',
                            }}
                          />
                          {q.status === 'ACCEPTED' && 'Accepted'}
                          {q.status === 'SENT' && 'Sent'}
                          {q.status === 'REJECTED' && 'Rejected'}
                          {q.status === 'DRAFT' && 'Draft'}
                          {!['ACCEPTED', 'SENT', 'REJECTED', 'DRAFT'].includes(q.status) && (q.status || 'Draft')}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', justifyContent: 'flex-end' }}>
                          {q.status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateQuoteStatus(q.id, 'SENT')}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                color: '#ffffff',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 1px 3px rgba(37, 99, 235, 0.25)',
                              }}
                              title="Mark proposal as Sent to customer"
                            >
                              📤 Send
                            </button>
                          )}
                          {q.status === 'SENT' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateQuoteStatus(q.id, 'ACCEPTED')}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  color: '#ffffff',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  border: 'none',
                                  cursor: 'pointer',
                                  boxShadow: '0 1px 3px rgba(5, 150, 105, 0.25)',
                                }}
                                title="Mark proposal as Accepted by customer"
                              >
                                ✓ Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateQuoteStatus(q.id, 'REJECTED')}
                                style={{
                                  padding: '4px 9px',
                                  borderRadius: '6px',
                                  background: '#fff1f2',
                                  color: '#e11d48',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  border: '1px solid #fecdd3',
                                  cursor: 'pointer',
                                }}
                                title="Mark as Rejected"
                              >
                                ✕ Reject
                              </button>
                            </>
                          )}
                          {q.status === 'ACCEPTED' && (
                            <button
                              type="button"
                              onClick={() => handleConvertQuoteToOrder(q)}
                              style={{
                                padding: '5px 12px',
                                borderRadius: '6px',
                                background: 'linear-gradient(135deg, #7f22fe 0%, #6917d0 100%)',
                                color: '#ffffff',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                border: 'none',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                boxShadow: '0 2px 6px rgba(127, 34, 254, 0.3)',
                              }}
                              title="Convert Accepted Quote to Confirmed Sales Order"
                            >
                              <span>⚡</span> Convert to Order
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setItemToDelete({ type: 'quote', item: q, name: q.quoteNo })}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              color: '#64748b',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            Delete
                          </button>
                        </div>
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
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
              <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                <IconSearch size={15} />
              </span>
              <input
                type="text"
                placeholder="Search by PI # or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.85rem 0.55rem 2.35rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                  outline: 'none',
                  background: '#f8fafc',
                  color: '#0f172a',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <IconFilter size={14} /> Filter:
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#ffffff', color: '#334155', fontWeight: 600 }}
              >
                <option value="ALL">All Statuses ({proformas.length})</option>
                <option value="ISSUED">Issued ({proformas.filter(p => p.status === 'ISSUED').length})</option>
                <option value="PAID">Paid ({proformas.filter(p => p.status === 'PAID').length})</option>
                <option value="CANCELLED">Cancelled ({proformas.filter(p => p.status === 'CANCELLED').length})</option>
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
              <table style={{ width: '100%', minWidth: '880px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                    <th style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>PI Number</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Client Organization</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Ref Sales Order</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Issue Date</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Due Date</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Total Amount</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProformas.map((pi) => (
                    <tr key={pi.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#7f22fe', whiteSpace: 'nowrap' }}>
                        {pi.invoiceNo || pi.piNo || 'PI-Pending'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {pi.customer}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {pi.orderRef || '-'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                        {formatDate(pi.date || pi.createdAt)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#b91c1c', fontWeight: 600, whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                        {formatDate(pi.dueDate)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        ₹ {parseFloat(pi.amount || pi.totalAmount || pi.baseAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 12px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            letterSpacing: '0.01em',
                            background: pi.status === 'PAID' ? '#ecfdf5' : pi.status === 'ISSUED' ? '#eff6ff' : '#fef2f2',
                            color: pi.status === 'PAID' ? '#047857' : pi.status === 'ISSUED' ? '#1d4ed8' : '#b91c1c',
                            border: `1px solid ${pi.status === 'PAID' ? '#a7f3d0' : pi.status === 'ISSUED' ? '#bfdbfe' : '#fecaca'}`,
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: pi.status === 'PAID' ? '#10b981' : pi.status === 'ISSUED' ? '#3b82f6' : '#ef4444',
                            }}
                          />
                          {pi.status === 'PAID' && 'Paid'}
                          {pi.status === 'ISSUED' && 'Issued'}
                          {pi.status === 'CANCELLED' && 'Cancelled'}
                          {!['PAID', 'ISSUED', 'CANCELLED'].includes(pi.status) && (pi.status || 'Issued')}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', justifyContent: 'flex-end' }}>
                          {pi.status === 'ISSUED' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateProformaStatus(pi.id, 'PAID')}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: '#ffffff',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 1px 3px rgba(5, 150, 105, 0.25)',
                              }}
                              title="Mark invoice as Paid"
                            >
                              ✓ Paid
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setItemToDelete({ type: 'proforma', item: pi, name: pi.invoiceNo || pi.piNo })}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              color: '#64748b',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            Delete
                          </button>
                        </div>
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
      <SalesOrderModal
        isOpen={showAddOrderModal}
        onClose={() => setShowAddOrderModal(false)}
        orderForm={orderForm}
        setOrderForm={setOrderForm}
        handleCreateOrder={handleCreateOrder}
        isSavingOrder={isSavingOrder}
        handleAddOrderItem={handleAddOrderItem}
        handleOrderItemChange={handleOrderItemChange}
        handleRemoveOrderItem={handleRemoveOrderItem}
      />

      {/* Create Quotation Modal */}
      <QuotationModal
        isOpen={showAddQuoteModal}
        onClose={() => setShowAddQuoteModal(false)}
        quoteForm={quoteForm}
        setQuoteForm={setQuoteForm}
        handleCreateQuote={handleCreateQuote}
        isSavingQuote={isSavingQuote}
        handleAddQuoteItem={handleAddQuoteItem}
        handleQuoteItemChange={handleQuoteItemChange}
        handleRemoveQuoteItem={handleRemoveQuoteItem}
      />

      {/* Datalist for autocomplete if products exist */}
      <datalist id="sales-catalog-products">
        {catalogProducts.map((p) => (
          <option key={p.id} value={p.name}>
            {p.sku} • ₹{p.sellingPrice}
          </option>
        ))}
      </datalist>

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
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onClose={() => setItemToDelete(null)}
      />
    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import styles from '../AccountsModule.module.css';
import Modal from '../../ui/Modal';
import ConfirmDialog from '../../ui/ConfirmDialog';
import { api } from '../../../lib/api';

export default function SalesInvoicesTab({
  invoices = [],
  customers = [],
  companyId,
  activeCompany,
  onRefresh,
  showToast,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmPostId, setConfirmPostId] = useState(null);

  // Invoice Form State
  const [form, setForm] = useState({
    customerId: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    paymentTerms: 'NET 30',
    isInterState: false,
    notes: '',
    items: [
      { sku: 'SOL-MOD-540W', description: '540W Monocrystalline Solar Panel', quantity: 10, unitPrice: 12500, taxRate: 18, hsnCode: '8541' },
    ],
  });

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchStatus = !statusFilter || inv.status === statusFilter;
      const matchSearch =
        !searchTerm ||
        inv.invoiceNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customer?.companyName?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [invoices, statusFilter, searchTerm]);

  const handleAddItem = () => {
    setForm({
      ...form,
      items: [
        ...form.items,
        { sku: '', description: '', quantity: 1, unitPrice: 0, taxRate: 18, hsnCode: '' },
      ],
    });
  };

  const handleRemoveItem = (index) => {
    if (form.items.length <= 1) return;
    setForm({
      ...form,
      items: form.items.filter((_, i) => i !== index),
    });
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...form.items];
    updated[index][field] = value;
    setForm({ ...form, items: updated });
  };

  const formCalculations = useMemo(() => {
    let taxable = 0;
    let tax = 0;
    form.items.forEach((item) => {
      const lineTaxable = Number(item.quantity || 0) * Number(item.unitPrice || 0);
      const lineTax = (lineTaxable * Number(item.taxRate || 0)) / 100;
      taxable += lineTaxable;
      tax += lineTax;
    });
    return {
      taxable,
      tax,
      total: taxable + tax,
    };
  }, [form.items]);

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (!form.customerId || form.items.length === 0) {
      showToast('Please select a customer and add at least one line item.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/companies/${companyId}/accounting/invoices`, {
        customerId: form.customerId,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate,
        paymentTerms: form.paymentTerms,
        isInterState: form.isInterState,
        notes: form.notes,
        items: form.items.map((it) => ({
          sku: it.sku || 'SKU-ITEM',
          description: it.description || 'Goods / Services',
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          taxRate: Number(it.taxRate),
          hsnCode: it.hsnCode || null,
        })),
      });

      showToast('Sales Invoice created as DRAFT.');
      setIsCreateModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to create invoice.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostInvoice = async () => {
    if (!confirmPostId) return;
    try {
      setSubmitting(true);
      await api.post(`/companies/${companyId}/accounting/invoices/${confirmPostId}/post`, {});
      showToast('Sales invoice POSTED. Double-entry GL voucher generated.');
      setConfirmPostId(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to post invoice.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div className={styles.sectionHeader}>
        <div>
          <h3>Sales Invoicing &amp; Accounts Receivable</h3>
          <p>Issue GST tax invoices, track payment receipts, and manage customer credit balances.</p>
        </div>
        <div className={styles.quickActions}>
          <button className={styles.primary} onClick={() => setIsCreateModalOpen(true)}>
            + Create Tax Invoice
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.filterInput}
          placeholder="Search by invoice no or customer..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ minWidth: '240px' }}
        />

        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">DRAFT</option>
          <option value="POSTED">POSTED (Unpaid)</option>
          <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
          <option value="PAID">PAID</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>

        {(searchTerm || statusFilter) && (
          <button
            className={styles.filterReset}
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('');
            }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Invoices Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Due Date</th>
              <th>Taxable Amount</th>
              <th>GST Amount</th>
              <th>Total Amount</th>
              <th>Outstanding</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No sales invoices found matching the criteria.
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td style={{ fontWeight: 800, color: '#7f22fe' }}>{inv.invoiceNo}</td>
                  <td style={{ fontWeight: 700, color: '#0f172a' }}>
                    {inv.customerName || inv.customer?.companyName || 'Valued Customer'}
                  </td>
                  <td>{new Date(inv.invoiceDate).toLocaleDateString('en-IN')}</td>
                  <td>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN') : '—'}</td>
                  <td>₹ {Number(inv.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td>₹ {Number(inv.taxAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td style={{ fontWeight: 800, color: '#0f172a' }}>
                    ₹ {Number(inv.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ fontWeight: 800, color: Number(inv.outstandingAmount || 0) > 0 ? '#b91c1c' : '#15803d' }}>
                    ₹ {Number(inv.outstandingAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td>
                    <span
                      className={
                        styles.badge +
                        ' ' +
                        (inv.status === 'PAID'
                          ? styles.badgeGreen
                          : inv.status === 'POSTED'
                          ? styles.badgeBlue
                          : inv.status === 'PARTIALLY_PAID'
                          ? styles.badgeAmber
                          : inv.status === 'DRAFT'
                          ? styles.badgeGray
                          : styles.badgeRed)
                      }
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className={styles.actions} style={{ justifyContent: 'flex-end' }}>
                      <button className={styles.secondary} onClick={() => setPreviewInvoice(inv)}>
                        View / Print
                      </button>
                      {inv.status === 'DRAFT' && (
                        <button className={styles.primary} onClick={() => setConfirmPostId(inv.id)}>
                          Post GL
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Sales Invoice Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Commercial Tax Invoice"
        maxWidth="820px"
      >
        <form onSubmit={handleCreateInvoice} className={styles.modalForm}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Select Customer *</label>
              <select
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                required
              >
                <option value="">Select Client Customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} {c.gstin ? `(${c.gstin})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Invoice Date *</label>
              <input
                type="date"
                value={form.invoiceDate}
                onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Due Date *</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Payment Terms</label>
              <input
                type="text"
                placeholder="e.g. NET 30"
                value={form.paymentTerms}
                onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
              />
            </div>
            <div className={styles.formGroup} style={{ justifyContent: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1rem' }}>
                <input
                  type="checkbox"
                  checked={form.isInterState}
                  onChange={(e) => setForm({ ...form, isInterState: e.target.checked })}
                />
                Inter-state Supply (IGST Applicable)
              </label>
            </div>
          </div>

          {/* Line Items */}
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>Invoice Line Items</strong>
              <button type="button" className={styles.secondary} onClick={handleAddItem} style={{ fontSize: '0.72rem' }}>
                + Add Item
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {form.items.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 0.8fr 1fr 0.8fr 0.5fr', gap: '0.4rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="SKU"
                    value={item.sku}
                    onChange={(e) => handleItemChange(idx, 'sku', e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    placeholder="Price (₹)"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                    required
                  />
                  <select
                    value={item.taxRate}
                    onChange={(e) => handleItemChange(idx, 'taxRate', e.target.value)}
                  >
                    <option value="0">0% GST</option>
                    <option value="5">5% GST</option>
                    <option value="12">12% GST</option>
                    <option value="18">18% GST</option>
                    <option value="28">28% GST</option>
                  </select>
                  <button
                    type="button"
                    className={styles.danger}
                    onClick={() => handleRemoveItem(idx)}
                    disabled={form.items.length <= 1}
                    style={{ padding: '0.45rem', fontSize: '0.75rem' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Summary */}
          <div style={{ background: '#f8fafc', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '2rem', fontSize: '0.82rem' }}>
              <div>Taxable: <b>₹ {formCalculations.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></div>
              <div>GST: <b>₹ {formCalculations.tax += 0, formCalculations.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></div>
              <div style={{ color: '#7f22fe', fontSize: '0.92rem' }}>Total: <b>₹ {formCalculations.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
            <button type="button" className={styles.secondary} onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save as DRAFT Invoice'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Invoice View Modal */}
      {previewInvoice && (
        <Modal
          isOpen={Boolean(previewInvoice)}
          onClose={() => setPreviewInvoice(null)}
          title={`Tax Invoice: ${previewInvoice.invoiceNo}`}
          maxWidth="760px"
        >
          <div className={styles.docPreview} id="printable-tax-invoice">
            <div className={styles.docHeader}>
              <div className={styles.docCompany}>
                <h4>{activeCompany?.organizationName || 'AZZUNIQE ENERGY PVT LTD'}</h4>
                <p style={{ margin: '2px 0', color: '#64748b' }}>Original for Recipient — Tax Invoice</p>
                <small style={{ color: '#64748b' }}>State: Rajasthan | Code: 08</small>
              </div>
              <div className={styles.docMeta}>
                <h3 style={{ margin: '0 0 4px', color: '#7f22fe' }}>{previewInvoice.invoiceNo}</h3>
                <p>Date: <b>{new Date(previewInvoice.invoiceDate).toLocaleDateString('en-IN')}</b></p>
                <p>Due Date: <b>{previewInvoice.dueDate ? new Date(previewInvoice.dueDate).toLocaleDateString('en-IN') : 'N/A'}</b></p>
                <span className={styles.badge + ' ' + (previewInvoice.status === 'PAID' ? styles.badgeGreen : styles.badgeBlue)}>
                  {previewInvoice.status}
                </span>
              </div>
            </div>

            <div className={styles.docSection}>
              <div>
                <strong style={{ color: '#475569', fontSize: '0.72rem', textTransform: 'uppercase' }}>Billed To:</strong>
                <p style={{ margin: '2px 0', fontWeight: 800 }}>{previewInvoice.customerName || previewInvoice.customer?.companyName}</p>
                <p style={{ margin: '2px 0', color: '#64748b' }}>GSTIN: {previewInvoice.customerGstin || previewInvoice.customer?.gstin || 'Unregistered'}</p>
                <p style={{ margin: '2px 0', color: '#64748b' }}>{previewInvoice.billingAddress || previewInvoice.customer?.billingAddress || 'India'}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong style={{ color: '#475569', fontSize: '0.72rem', textTransform: 'uppercase' }}>Payment Details:</strong>
                <p style={{ margin: '2px 0' }}>Terms: <b>{previewInvoice.paymentTerms || 'Net 30'}</b></p>
                <p style={{ margin: '2px 0' }}>Outstanding Balance: <b style={{ color: '#b91c1c' }}>₹ {Number(previewInvoice.outstandingAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></p>
              </div>
            </div>

            <table className={styles.table} style={{ border: '1px solid #e2e8f0', marginTop: '0.5rem' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item / Description</th>
                  <th>HSN</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Taxable</th>
                  <th>GST Rate</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(previewInvoice.items || []).map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td>{idx + 1}</td>
                    <td><b>{it.sku}</b><br /><small style={{ color: '#64748b' }}>{it.description}</small></td>
                    <td>{it.hsnCode || '—'}</td>
                    <td>{it.quantity}</td>
                    <td>₹ {Number(it.unitPrice).toFixed(2)}</td>
                    <td>₹ {Number(it.taxableAmount || (it.quantity * it.unitPrice)).toFixed(2)}</td>
                    <td>{it.taxRate}%</td>
                    <td>₹ {Number(it.totalAmount || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <div style={{ minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Taxable Value:</span>
                  <b>₹ {Number(previewInvoice.taxableAmount || 0).toFixed(2)}</b>
                </div>
                {previewInvoice.isInterState ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>IGST:</span>
                    <b>₹ {Number(previewInvoice.igstAmount || previewInvoice.taxAmount || 0).toFixed(2)}</b>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>CGST (9%):</span>
                      <b>₹ {Number(previewInvoice.cgstAmount || (previewInvoice.taxAmount / 2) || 0).toFixed(2)}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>SGST (9%):</span>
                      <b>₹ {Number(previewInvoice.sgstAmount || (previewInvoice.taxAmount / 2) || 0).toFixed(2)}</b>
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: '4px', fontSize: '0.95rem', color: '#7f22fe' }}>
                  <span>Total Amount:</span>
                  <b>₹ {Number(previewInvoice.totalAmount || 0).toFixed(2)}</b>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.8rem' }}>
              <small style={{ color: '#64748b' }}>Computer generated invoice under AZZUNIQE ERP.</small>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className={styles.secondary} onClick={() => window.print()}>
                  🖨️ Print Invoice
                </button>
                <button type="button" className={styles.primary} onClick={() => setPreviewInvoice(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm Post Dialog */}
      <ConfirmDialog
        isOpen={Boolean(confirmPostId)}
        onClose={() => setConfirmPostId(null)}
        onConfirm={handlePostInvoice}
        title="Post Tax Invoice to General Ledger?"
        message="Posting this invoice will generate a double-entry Journal Voucher (Dr Sundry Debtors / Cr Sales Revenue & Output GST). Once posted, the invoice becomes authoritative and immutable."
        confirmLabel="Yes, Post Invoice"
      />
    </div>
  );
}


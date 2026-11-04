'use client';

import { useState } from 'react';
import styles from '../DispatchModule.module.css';
import Modal from '../../ui/Modal';
import ConfirmDialog from '../../ui/ConfirmDialog';
import EmptyState from '../../ui/EmptyState';

function currencyFmt(val) {
  return `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CustomerCreditNotesTab({
  creditNotes = [],
  customerReturns = [],
  creditDashboard = {},
  loading = false,
  onCreateCreditNote,
  onApproveCreditNote,
  onApplyCreditNote,
  onRefresh,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedCreditNote, setSelectedCreditNote] = useState(null);
  const [isConfirmActionOpen, setIsConfirmActionOpen] = useState(false);
  const [actionConfig, setActionConfig] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedRmaId, setSelectedRmaId] = useState('');
  const [restockingFeeRate, setRestockingFeeRate] = useState(5);
  const [settlementType, setSettlementType] = useState('LEDGER_CREDIT');
  const [notes, setNotes] = useState('');

  // Filter returns eligible for credit note (approved or inspected, without existing active credit note)
  const eligibleReturns = customerReturns.filter(
    (r) => ['APPROVED', 'GOODS_RECEIVED', 'INSPECTED', 'CLOSED'].includes(r.status) &&
           (!r.creditNotes || r.creditNotes.length === 0)
  );

  const selectedRma = customerReturns.find((r) => r.id === selectedRmaId) || eligibleReturns[0];

  // Derived financial preview
  const previewTaxable = selectedRma ? Number(selectedRma.totalReturnedAmount || 0) : 0;
  const previewTax = previewTaxable * 0.18; // 18% standard GST reversal
  const previewGross = previewTaxable + previewTax;
  const previewFee = (previewGross * Number(restockingFeeRate || 0)) / 100;
  const previewNet = previewGross - previewFee;

  const filteredCreditNotes = creditNotes.filter((cn) => {
    if (statusFilter !== 'ALL' && cn.status !== statusFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      cn.creditNoteNo?.toLowerCase().includes(term) ||
      cn.customerName?.toLowerCase().includes(term) ||
      cn.originalInvoiceNo?.toLowerCase().includes(term)
    );
  });

  const handleOpenCreateModal = () => {
    setSelectedRmaId(eligibleReturns[0]?.id || '');
    setRestockingFeeRate(5);
    setSettlementType('LEDGER_CREDIT');
    setNotes('');
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRma) {
      alert('Please select an approved customer return.');
      return;
    }

    try {
      setSubmitting(true);
      await onCreateCreditNote({
        customerReturnId: selectedRma.id,
        salesOrderId: selectedRma.salesOrderId,
        customerId: selectedRma.customerId,
        customerName: selectedRma.customerName,
        restockingFeeRate: Number(restockingFeeRate) || 0,
        settlementType,
        notes,
      });
      setIsCreateModalOpen(false);
      alert('Customer Credit Note created successfully in DRAFT status!');
    } catch (err) {
      alert(err.message || 'Failed to create credit note');
    } finally {
      setSubmitting(false);
    }
  };

  const promptAction = (action, cn) => {
    setActionConfig({ action, cn });
    setIsConfirmActionOpen(true);
  };

  const handleExecuteAction = async () => {
    if (!actionConfig) return;
    const { action, cn } = actionConfig;

    try {
      setSubmitting(true);
      if (action === 'approve') {
        await onApproveCreditNote(cn.id);
        alert(`Credit Note ${cn.creditNoteNo} approved by Commercial Authority!`);
      } else if (action === 'apply') {
        await onApplyCreditNote(cn.id, { settlementType: cn.settlementType });
        alert(`Credit Note ${cn.creditNoteNo} settled and applied to customer balance!`);
      }
      setIsConfirmActionOpen(false);
      setActionConfig(null);
    } catch (err) {
      alert(err.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewPreview = (cn) => {
    setSelectedCreditNote(cn);
    setIsPreviewModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Customer Credit Notes &amp; Financial Adjustments</h3>
          <p>
            GST tax reversals (CGST/SGST/IGST), restocking fee debit deductions, and ledger settlement authorization
          </p>
        </div>
        <div className={styles.quickActions}>
          <button className={styles.secondary} onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
          <button className={styles.primary} onClick={handleOpenCreateModal}>
            + Issue Credit Note
          </button>
        </div>
      </div>

      {/* Credit Financial Metrics */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span>💳</span>
          <div>
            <strong>{currencyFmt(creditDashboard?.totalNetCreditAmount)}</strong>
            <small>Net Credit Issued</small>
          </div>
        </div>

        <div className={styles.stat}>
          <span>🏷️</span>
          <div>
            <strong>{currencyFmt(creditDashboard?.totalTaxableAmount)}</strong>
            <small>Taxable Amount</small>
          </div>
        </div>

        <div className={styles.stat}>
          <span>⚖️</span>
          <div>
            <strong>{currencyFmt(creditDashboard?.totalTaxReversed)}</strong>
            <small>GST Reversal</small>
          </div>
        </div>

        <div className={styles.stat}>
          <span>💼</span>
          <div>
            <strong>+{currencyFmt(creditDashboard?.totalRestockingFee)}</strong>
            <small>Restocking Fees Earned</small>
          </div>
        </div>
      </div>

      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.filterInput}
          placeholder="Search by Credit Note #, Customer or Invoice..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ minWidth: '320px' }}
        />

        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="DRAFT">DRAFT</option>
          <option value="APPROVED">APPROVED</option>
          <option value="APPLIED">APPLIED (Settled)</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>

        {(searchTerm || statusFilter !== 'ALL') && (
          <button
            className={styles.filterReset}
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className={styles.tableWrap}>
        {filteredCreditNotes.length === 0 ? (
          <EmptyState
            icon="💳"
            title="No Credit Notes Found"
            description="No credit notes match your criteria. Click '+ Issue Credit Note' to create a credit note against an approved return."
          />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Credit Note #</th>
                <th>Customer</th>
                <th>Return (RMA)</th>
                <th>Taxable</th>
                <th>GST Reversal</th>
                <th>Restocking Fee</th>
                <th>Net Credit</th>
                <th>Settlement</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCreditNotes.map((cn) => {
                const totalGst = Number(cn.cgstAmount || 0) + Number(cn.sgstAmount || 0) + Number(cn.igstAmount || 0);

                return (
                  <tr key={cn.id}>
                    <td><strong style={{ color: '#0f172a' }}>{cn.creditNoteNo}</strong></td>
                    <td>{cn.customerName}</td>
                    <td><code>{cn.customerReturn?.rmaNo || 'Direct RMA'}</code></td>
                    <td>{currencyFmt(cn.taxableAmount)}</td>
                    <td style={{ color: '#0369a1', fontWeight: 750 }}>{currencyFmt(totalGst)}</td>
                    <td style={{ color: '#15803d' }}>-{currencyFmt(cn.restockingFeeAmount)}</td>
                    <td><strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>{currencyFmt(cn.netCreditAmount)}</strong></td>
                    <td>
                      <span className={`${styles.badge} ${styles.badgeGray}`}>{cn.settlementType}</span>
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          cn.status === 'APPLIED'
                            ? styles.badgeGreen
                            : cn.status === 'APPROVED'
                            ? styles.badgeBlue
                            : cn.status === 'CANCELLED'
                            ? styles.badgeRed
                            : styles.badgeAmber
                        }`}
                      >
                        {cn.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className={styles.actions} style={{ justifyContent: 'flex-end' }}>
                        <button onClick={() => handleViewPreview(cn)}>
                          📄 Preview
                        </button>

                        {cn.status === 'DRAFT' && (
                          <button className={styles.primary} onClick={() => promptAction('approve', cn)}>
                            ✓ Approve
                          </button>
                        )}

                        {cn.status === 'APPROVED' && (
                          <button className={styles.primary} onClick={() => promptAction('apply', cn)}>
                            ⚡ Apply Credit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* CREATE CREDIT NOTE MODAL */}
      <Modal isOpen={isCreateModalOpen} onClose={() => !submitting && setIsCreateModalOpen(false)} title="Issue Customer Credit Note" maxWidth="680px">
        <form onSubmit={handleCreateSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label>Select Approved Customer Return (RMA) *</label>
            <select
              required
              value={selectedRmaId}
              onChange={(e) => setSelectedRmaId(e.target.value)}
            >
              {eligibleReturns.length > 0 ? (
                eligibleReturns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.rmaNo} — {r.customerName} (Return Amount: {currencyFmt(r.totalReturnedAmount)})
                  </option>
                ))
              ) : (
                <option value="">No approved return awaiting credit note</option>
              )}
            </select>
          </div>

          {selectedRma && (
            <div style={{ padding: '0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h5 style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', fontWeight: 800 }}>Financial Calculation Breakdown</h5>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.78rem' }}>
                <div>Taxable Return Amount: <strong>{currencyFmt(previewTaxable)}</strong></div>
                <div>GST Tax Reversal (18%): <strong>{currencyFmt(previewTax)}</strong></div>
                <div>Gross Return Value: <strong>{currencyFmt(previewGross)}</strong></div>
                <div>Restocking Fee ({restockingFeeRate}%): <strong style={{ color: '#15803d' }}>-{currencyFmt(previewFee)}</strong></div>
              </div>
              <div style={{ marginTop: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid #cbd5e1', fontSize: '0.88rem' }}>
                <strong>Net Credit Amount Payable: </strong>
                <span style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 900 }}>{currencyFmt(previewNet)}</span>
              </div>
            </div>
          )}

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Restocking Fee Rate (%)</label>
              <input
                type="number"
                min="0"
                max="50"
                step="any"
                value={restockingFeeRate}
                onChange={(e) => setRestockingFeeRate(e.target.value)}
              />
              <small style={{ color: '#64748b' }}>Standard policy: 5% for restocking inspection</small>
            </div>

            <div className={styles.formGroup}>
              <label>Settlement Mode *</label>
              <select
                value={settlementType}
                onChange={(e) => setSettlementType(e.target.value)}
              >
                <option value="LEDGER_CREDIT">Ledger Credit (Adjust against future orders)</option>
                <option value="REFUND_BANK">Bank Refund (Remit back to client bank)</option>
                <option value="REPLACEMENT_ORDER">Replacement Order (Offset against reorder)</option>
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Credit Note Remarks / Justification</label>
            <textarea
              rows={2}
              placeholder="Commercial reference, ledger credit approval notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
            <button type="button" className={styles.secondary} onClick={() => setIsCreateModalOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={submitting || !selectedRma}>
              {submitting ? 'Creating...' : 'Generate Credit Note'}
            </button>
          </div>
        </form>
      </Modal>

      {/* PREVIEW CREDIT NOTE MODAL */}
      <Modal isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)} title="Credit Note Voucher" maxWidth="700px">
        {selectedCreditNote && (
          <div className={styles.docPreview}>
            <div className={styles.docHeader}>
              <div className={styles.docCompany}>
                <h4>SHREE NATH EXPORTS</h4>
                <p style={{ margin: '3px 0', color: '#64748b' }}>Credit Note Voucher (GST Reversal)</p>
                <small style={{ color: '#64748b' }}>GSTIN: 08AABCS1429B1Z0 &bull; State: Rajasthan (08)</small>
              </div>
              <div className={styles.docMeta}>
                <p><strong>Credit Note #:</strong> {selectedCreditNote.creditNoteNo}</p>
                <p><strong>Date:</strong> {new Date(selectedCreditNote.createdAt).toLocaleDateString()}</p>
                <p><strong>RMA Reference:</strong> {selectedCreditNote.customerReturn?.rmaNo || 'N/A'}</p>
                <p><strong>Status:</strong> <span className={`${styles.badge} ${styles.badgeGreen}`}>{selectedCreditNote.status}</span></p>
              </div>
            </div>

            <div className={styles.docSection}>
              <div>
                <strong>Client / Customer:</strong>
                <div>{selectedCreditNote.customerName}</div>
                <div style={{ color: '#64748b', fontSize: '0.74rem' }}>
                  GSTIN: {selectedCreditNote.customerGstin || 'Unregistered'}<br />
                  Settlement Mode: <strong>{selectedCreditNote.settlementType}</strong>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Original Invoice Ref:</strong>
                <div>Invoice #: {selectedCreditNote.originalInvoiceNo || 'N/A'}</div>
                <div>Invoice Date: {selectedCreditNote.originalInvoiceDate ? new Date(selectedCreditNote.originalInvoiceDate).toLocaleDateString() : 'N/A'}</div>
              </div>
            </div>

            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #e2e8f0' }}>
                <span>Taxable Amount</span>
                <strong>{currencyFmt(selectedCreditNote.taxableAmount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #e2e8f0' }}>
                <span>CGST Reversal (9%)</span>
                <span>{currencyFmt(selectedCreditNote.cgstAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #e2e8f0' }}>
                <span>SGST Reversal (9%)</span>
                <span>{currencyFmt(selectedCreditNote.sgstAmount)}</span>
              </div>
              {Number(selectedCreditNote.igstAmount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #e2e8f0' }}>
                  <span>IGST Reversal (18%)</span>
                  <span>{currencyFmt(selectedCreditNote.igstAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #e2e8f0' }}>
                <span>Gross Value</span>
                <strong>{currencyFmt(selectedCreditNote.totalAmount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #e2e8f0', color: '#15803d' }}>
                <span>Restocking Fee Debit ({selectedCreditNote.restockingFeeRate}%)</span>
                <strong>-{currencyFmt(selectedCreditNote.restockingFeeAmount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0 0.2rem', fontSize: '1.05rem', color: '#0f172a' }}>
                <strong>Net Credit Adjusted</strong>
                <strong style={{ color: '#0284c7' }}>{currencyFmt(selectedCreditNote.netCreditAmount)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
              <button className={styles.secondary} onClick={() => window.print()}>
                🖨️ Print Credit Note
              </button>
              <button className={styles.primary} onClick={() => setIsPreviewModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* CONFIRM ACTION DIALOG */}
      <ConfirmDialog
        isOpen={isConfirmActionOpen}
        onClose={() => setIsConfirmActionOpen(false)}
        onConfirm={handleExecuteAction}
        title="Confirm Credit Note Action"
        message={`Are you sure you want to execute '${actionConfig?.action}' for Credit Note ${actionConfig?.cn?.creditNoteNo}?`}
        confirmLabel={submitting ? 'Executing...' : 'Yes, Confirm'}
        cancelLabel="Cancel"
      />
    </div>
  );
}


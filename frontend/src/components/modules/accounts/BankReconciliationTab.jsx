'use client';

import { useState } from 'react';
import styles from '../AccountsModule.module.css';
import Modal from '../../ui/Modal';
import ConfirmDialog from '../../ui/ConfirmDialog';
import { api } from '../../../lib/api';

export default function BankReconciliationTab({
  sessions = [],
  bankAccounts = [],
  companyId,
  onRefresh,
  showToast,
}) {
  const [selectedSessionId, setSelectedSessionId] = useState(sessions[0]?.id || null);
  const [sessionDetail, setSessionDetail] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isBrsModalOpen, setIsBrsModalOpen] = useState(false);
  const [brsReport, setBrsReport] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Manual Match State
  const [matchData, setMatchData] = useState({
    bankTransactionId: '',
    voucherItemId: '',
    matchedAmount: '',
  });

  // Create Session Form
  const [createForm, setCreateForm] = useState({
    bankAccountId: bankAccounts[0]?.id || '',
    statementDate: new Date().toISOString().slice(0, 10),
    statementClosingBalance: '',
    notes: '',
  });

  // Adjustment Form
  const [adjForm, setAdjForm] = useState({
    adjustmentType: 'BANK_CHARGES',
    amount: '',
    referenceNo: '',
    narration: '',
  });

  // Close Session Form
  const [closeForm, setCloseForm] = useState({
    authorizedExceptionReason: '',
    notes: '',
  });

  const loadSessionDetails = async (sessionId) => {
    try {
      setSelectedSessionId(sessionId);
      const res = await api.get(`/companies/${companyId}/accounting/reconciliations/${sessionId}`);
      setSessionDetail(res?.data || res || null);
    } catch (err) {
      showToast(err.message || 'Failed to load reconciliation session details.', 'error');
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!createForm.bankAccountId || !createForm.statementClosingBalance) {
      showToast('Please provide bank account and statement closing balance.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post(`/companies/${companyId}/accounting/reconciliations`, {
        bankAccountId: createForm.bankAccountId,
        statementDate: createForm.statementDate,
        statementClosingBalance: Number(createForm.statementClosingBalance),
        notes: createForm.notes,
      });

      showToast('Reconciliation session created.');
      setIsCreateModalOpen(false);
      if (onRefresh) await onRefresh();
      if (res?.data?.id) await loadSessionDetails(res.data.id);
    } catch (err) {
      showToast(err.message || 'Failed to create reconciliation session.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoMatch = async () => {
    if (!selectedSessionId) return;
    try {
      setSubmitting(true);
      const res = await api.post(
        `/companies/${companyId}/accounting/reconciliations/${selectedSessionId}/auto-match`,
        { dateToleranceDays: 7 }
      );
      showToast(`Auto-reconciliation complete: ${res?.data?.matchedCount || 0} items matched.`);
      await loadSessionDetails(selectedSessionId);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Auto-matching failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualMatch = async () => {
    if (!matchData.bankTransactionId || !matchData.voucherItemId) {
      showToast('Please select both a bank transaction and a voucher line item.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/companies/${companyId}/accounting/reconciliations/${selectedSessionId}/match`, {
        bankTransactionId: matchData.bankTransactionId,
        voucherItemId: matchData.voucherItemId,
        matchedAmount: matchData.matchedAmount ? Number(matchData.matchedAmount) : undefined,
      });

      showToast('Items matched successfully.');
      setMatchData({ bankTransactionId: '', voucherItemId: '', matchedAmount: '' });
      await loadSessionDetails(selectedSessionId);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Manual match failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnmatch = async (itemId) => {
    try {
      setSubmitting(true);
      await api.post(
        `/companies/${companyId}/accounting/reconciliations/${selectedSessionId}/items/${itemId}/unmatch`,
        {}
      );
      showToast('Item unmatched. Reverted to UNRECONCILED.');
      await loadSessionDetails(selectedSessionId);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Unmatch failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostAdjustment = async (e) => {
    e.preventDefault();
    if (!adjForm.amount || Number(adjForm.amount) <= 0) {
      showToast('Please enter a valid adjustment amount.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(
        `/companies/${companyId}/accounting/reconciliations/${selectedSessionId}/adjustments`,
        {
          adjustmentType: adjForm.adjustmentType,
          amount: Number(adjForm.amount),
          referenceNo: adjForm.referenceNo,
          narration: adjForm.narration,
        }
      );

      showToast(`Bank adjustment posted & auto-matched (${adjForm.adjustmentType}).`);
      setIsAdjModalOpen(false);
      setAdjForm({ adjustmentType: 'BANK_CHARGES', amount: '', referenceNo: '', narration: '' });
      await loadSessionDetails(selectedSessionId);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Adjustment posting failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseSession = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post(
        `/companies/${companyId}/accounting/reconciliations/${selectedSessionId}/close`,
        {
          authorizedExceptionReason: closeForm.authorizedExceptionReason,
          notes: closeForm.notes,
        }
      );

      showToast('Reconciliation session closed as COMPLETED.');
      setIsCloseModalOpen(false);
      await loadSessionDetails(selectedSessionId);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Cannot close reconciliation session.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadBrs = async (bankAccountId, statementDate) => {
    try {
      const res = await api.get(
        `/companies/${companyId}/accounting/reports/brs/${bankAccountId}?asOfDate=${statementDate}`
      );
      setBrsReport(res?.data || res || null);
      setIsBrsModalOpen(true);
    } catch (err) {
      showToast(err.message || 'Failed to load BRS report.', 'error');
    }
  };

  const currentSession = sessionDetail?.session || sessions.find((s) => s.id === selectedSessionId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div className={styles.sectionHeader}>
        <div>
          <h3>Bank Reconciliation Engine &amp; BRS Statements</h3>
          <p>Match bank transactions with General Ledger vouchers, adjust bank charges/interest, and close sessions.</p>
        </div>
        <div className={styles.quickActions}>
          <button className={styles.primary} onClick={() => setIsCreateModalOpen(true)}>
            + New Reconciliation Session
          </button>
        </div>
      </div>

      {/* Sessions Bar */}
      <div className={styles.filterBar} style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 750, color: '#334155' }}>Select Session:</label>
          <select
            className={styles.filterSelect}
            value={selectedSessionId || ''}
            onChange={(e) => loadSessionDetails(e.target.value)}
          >
            <option value="">Select Session...</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.bankAccount?.bankName} ({new Date(s.statementDate).toLocaleDateString('en-IN')}) — {s.status}
              </option>
            ))}
          </select>
        </div>

        {currentSession && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className={styles.badge + ' ' + (currentSession.status === 'COMPLETED' ? styles.badgeGreen : styles.badgeAmber)}>
              {currentSession.status}
            </span>
            <button
              className={styles.secondary}
              onClick={() => handleLoadBrs(currentSession.bankAccountId, currentSession.statementDate)}
            >
              📄 Printable BRS Report
            </button>
          </div>
        )}
      </div>

      {currentSession ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Session Overview Stats */}
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span>🏦</span>
              <div>
                <small>Statement Closing Balance</small>
                <strong>₹ {Number(currentSession.statementClosingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>

            <div className={styles.stat}>
              <span>📖</span>
              <div>
                <small>Ledger Closing Balance</small>
                <strong>₹ {Number(currentSession.ledgerClosingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>

            <div className={styles.stat}>
              <span>⚖️</span>
              <div>
                <small>Reconciliation Difference</small>
                <strong style={{ color: Number(currentSession.differenceAmount || 0) === 0 ? '#15803d' : '#b91c1c' }}>
                  ₹ {Number(currentSession.differenceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>

            <div className={styles.stat}>
              <span>⚡</span>
              <div>
                <small>Session Actions</small>
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem' }}>
                  {currentSession.status === 'IN_PROGRESS' && (
                    <>
                      <button className={styles.primary} onClick={handleAutoMatch} disabled={submitting} style={{ fontSize: '0.72rem', padding: '3px 8px' }}>
                        Auto-Match
                      </button>
                      <button className={styles.secondary} onClick={() => setIsAdjModalOpen(true)} style={{ fontSize: '0.72rem', padding: '3px 8px' }}>
                        + Adjustment
                      </button>
                      <button className={styles.danger} onClick={() => setIsCloseModalOpen(true)} style={{ fontSize: '0.72rem', padding: '3px 8px' }}>
                        Close Session
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Matched Items Table */}
          <div className={styles.tableWrap}>
            <div style={{ padding: '0.65rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>
                Reconciled &amp; Matched Transactions ({currentSession.items?.length || 0})
              </strong>
            </div>

            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Bank Txn Date</th>
                  <th>Statement Description</th>
                  <th>Matched Voucher No</th>
                  <th>Matched Amount</th>
                  <th>Match Type</th>
                  <th>Clearance Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(!currentSession.items || currentSession.items.length === 0) ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                      No transactions matched yet in this session.
                    </td>
                  </tr>
                ) : (
                  currentSession.items.map((item) => (
                    <tr key={item.id}>
                      <td>{new Date(item.bankTransaction?.transactionDate || item.clearanceDate).toLocaleDateString('en-IN')}</td>
                      <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.bankTransaction?.description || 'Bank Movement'}
                      </td>
                      <td style={{ fontWeight: 700, color: '#7f22fe' }}>
                        {item.voucher?.voucherNo || 'VOUCHER'}
                      </td>
                      <td style={{ fontWeight: 800 }}>
                        ₹ {Number(item.matchedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span className={styles.badge + ' ' + (item.matchType === 'AUTO' ? styles.badgeGreen : styles.badgeBlue)}>
                          {item.matchType}
                        </span>
                      </td>
                      <td>{new Date(item.clearanceDate).toLocaleDateString('en-IN')}</td>
                      <td style={{ textAlign: 'right' }}>
                        {currentSession.status === 'IN_PROGRESS' && (
                          <button
                            className={styles.danger}
                            style={{ fontSize: '0.72rem', padding: '2px 6px' }}
                            onClick={() => handleUnmatch(item.id)}
                            disabled={submitting}
                          >
                            Unmatch
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Manual Matching Workbench (If in progress and details loaded) */}
          {currentSession.status === 'IN_PROGRESS' && sessionDetail && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                  🎯 Manual Matching Workbench
                </h4>
                <button
                  className={styles.primary}
                  onClick={handleManualMatch}
                  disabled={submitting || !matchData.bankTransactionId || !matchData.voucherItemId}
                >
                  Confirm Manual Match
                </button>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>1. Select Unmatched Bank Statement Txn ({sessionDetail.unmatchedBankTransactions?.length || 0})</label>
                  <select
                    value={matchData.bankTransactionId}
                    onChange={(e) => setMatchData({ ...matchData, bankTransactionId: e.target.value })}
                  >
                    <option value="">Select Statement Line...</option>
                    {(sessionDetail.unmatchedBankTransactions || []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {new Date(t.transactionDate).toLocaleDateString('en-IN')} &bull; {Number(t.creditAmount) > 0 ? `CR ₹${Number(t.creditAmount)}` : `DR ₹${Number(t.debitAmount)}`} &bull; {t.description?.slice(0, 30)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>2. Select Unmatched Book Voucher Item ({sessionDetail.unmatchedVoucherItems?.length || 0})</label>
                  <select
                    value={matchData.voucherItemId}
                    onChange={(e) => setMatchData({ ...matchData, voucherItemId: e.target.value })}
                  >
                    <option value="">Select Book Line Item...</option>
                    {(sessionDetail.unmatchedVoucherItems || []).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.voucher?.voucherNo} ({new Date(v.voucher?.voucherDate).toLocaleDateString('en-IN')}) &bull; {Number(v.debitAmount) > 0 ? `DR ₹${Number(v.debitAmount)}` : `CR ₹${Number(v.creditAmount)}`} &bull; {v.narration || v.voucher?.narration}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Matched Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Leave blank for auto-calc"
                    value={matchData.matchedAmount}
                    onChange={(e) => setMatchData({ ...matchData, matchedAmount: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '3rem', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
          Select a reconciliation session from the dropdown above or click &quot;New Reconciliation Session&quot; to begin.
        </div>
      )}

      {/* Create Session Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Start Bank Reconciliation Session"
        maxWidth="500px"
      >
        <form onSubmit={handleCreateSession} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label>Select Bank Account *</label>
            <select
              value={createForm.bankAccountId}
              onChange={(e) => setCreateForm({ ...createForm, bankAccountId: e.target.value })}
              required
            >
              <option value="">Select Bank Account...</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bankName} ({b.maskedAccountNumber}) — Ledger Bal: ₹{Number(b.currentBalance || 0).toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Statement Cutoff Date *</label>
            <input
              type="date"
              value={createForm.statementDate}
              onChange={(e) => setCreateForm({ ...createForm, statementDate: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Statement Closing Balance (₹) *</label>
            <input
              type="number"
              step="0.01"
              placeholder="As per bank statement"
              value={createForm.statementClosingBalance}
              onChange={(e) => setCreateForm({ ...createForm, statementClosingBalance: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Notes / Session Ref</label>
            <input
              type="text"
              placeholder="e.g. Month-end BRS closing"
              value={createForm.notes}
              onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
            <button type="button" className={styles.secondary} onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={submitting}>
              {submitting ? 'Creating...' : 'Calculate & Open Session'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bank Adjustment Voucher Modal */}
      <Modal
        isOpen={isAdjModalOpen}
        onClose={() => setIsAdjModalOpen(false)}
        title="Post Bank Difference Voucher"
        maxWidth="500px"
      >
        <form onSubmit={handlePostAdjustment} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label>Adjustment Nature *</label>
            <select
              value={adjForm.adjustmentType}
              onChange={(e) => setAdjForm({ ...adjForm, adjustmentType: e.target.value })}
              required
            >
              <option value="BANK_CHARGES">Bank Charges / Processing Fee (Dr Expense, Cr Bank)</option>
              <option value="INTEREST_RECEIVED">Bank Interest Received (Dr Bank, Cr Income)</option>
              <option value="INTEREST_CHARGED">Bank Overdraft Interest Charged (Dr Expense, Cr Bank)</option>
              <option value="DIRECT_DEBIT">Direct Bank Debit (Utility / Mandate)</option>
              <option value="DIRECT_CREDIT">Direct Bank Credit</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Adjustment Amount (₹) *</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={adjForm.amount}
              onChange={(e) => setAdjForm({ ...adjForm, amount: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Reference No (Transaction Ref)</label>
            <input
              type="text"
              placeholder="e.g. CHG-MAY-01"
              value={adjForm.referenceNo}
              onChange={(e) => setAdjForm({ ...adjForm, referenceNo: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Narration *</label>
            <input
              type="text"
              placeholder="e.g. Monthly corporate current account maintenance charges"
              value={adjForm.narration}
              onChange={(e) => setAdjForm({ ...adjForm, narration: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
            <button type="button" className={styles.secondary} onClick={() => setIsAdjModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={submitting}>
              {submitting ? 'Posting...' : 'Post & Match Adjustment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Close Session Modal */}
      <Modal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        title="Complete Bank Reconciliation Session"
        maxWidth="500px"
      >
        <form onSubmit={handleCloseSession} className={styles.modalForm}>
          <div style={{ background: '#f8fafc', padding: '0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
            <div>Current Difference: <b style={{ color: Number(currentSession?.differenceAmount || 0) === 0 ? '#15803d' : '#b91c1c' }}>₹ {Number(currentSession?.differenceAmount || 0).toFixed(2)}</b></div>
            {Number(currentSession?.differenceAmount || 0) !== 0 && (
              <small style={{ color: '#b91c1c', display: 'block', marginTop: '4px' }}>
                ⚠️ An unresolved difference exists. Under accounting integrity rules, you must enter an explicit authorized exception reason to close.
              </small>
            )}
          </div>

          {Number(currentSession?.differenceAmount || 0) !== 0 && (
            <div className={styles.formGroup}>
              <label>Authorized Exception Reason *</label>
              <textarea
                rows="3"
                placeholder="e.g. Authorized by CFO: ₹7,320 electricity bill debit pending bill voucher creation"
                value={closeForm.authorizedExceptionReason}
                onChange={(e) => setCloseForm({ ...closeForm, authorizedExceptionReason: e.target.value })}
                required
              />
            </div>
          )}

          <div className={styles.formGroup}>
            <label>Closing Notes</label>
            <input
              type="text"
              placeholder="e.g. May 2026 reconciliation audit completed"
              value={closeForm.notes}
              onChange={(e) => setCloseForm({ ...closeForm, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
            <button type="button" className={styles.secondary} onClick={() => setIsCloseModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={submitting}>
              {submitting ? 'Closing...' : 'Close & Finalize Session'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable BRS Report Modal */}
      {isBrsModalOpen && brsReport && (
        <Modal
          isOpen={isBrsModalOpen}
          onClose={() => setIsBrsModalOpen(false)}
          title={`Bank Reconciliation Statement: ${brsReport.bankName}`}
          maxWidth="720px"
        >
          <div className={styles.docPreview}>
            <div className={styles.docHeader}>
              <div>
                <h4 style={{ margin: 0, color: '#0f172a' }}>{brsReport.bankName}</h4>
                <p style={{ margin: '2px 0', color: '#64748b' }}>Bank Reconciliation Statement (BRS)</p>
                <small style={{ color: '#64748b' }}>As of: {new Date(brsReport.asOfDate).toLocaleDateString('en-IN')}</small>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p>Account: <b>{brsReport.maskedAccountNumber}</b></p>
                <p>Net Variance: <b style={{ color: Number(brsReport.reconciliationDifference) === 0 ? '#15803d' : '#b91c1c' }}>
                  ₹ {Number(brsReport.reconciliationDifference || 0).toFixed(2)}
                </b></p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.84rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #e2e8f0' }}>
                <span>Balance as per Company Books (General Ledger):</span>
                <b>₹ {Number(brsReport.balanceAsPerBooks || 0).toFixed(2)}</b>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', color: '#0369a1' }}>
                <span>(+) Add: Unpresented Cheques (Issued in books, not yet debited by bank):</span>
                <b>+ ₹ {Number(brsReport.addItems?.total || 0).toFixed(2)}</b>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', color: '#b45309' }}>
                <span>(-) Less: Uncredited Deposits (Deposited in books, not yet cleared by bank):</span>
                <b>- ₹ {Number(brsReport.lessItems?.total || 0).toFixed(2)}</b>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderTop: '1px solid #0f172a', fontWeight: 800 }}>
                <span>Adjusted Book Balance:</span>
                <b>₹ {Number(brsReport.adjustedBookBalance || 0).toFixed(2)}</b>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '2px solid #0f172a', fontWeight: 800, color: '#7f22fe' }}>
                <span>Balance as per Bank Statement:</span>
                <b>₹ {Number(brsReport.balanceAsPerStatement || 0).toFixed(2)}</b>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button className={styles.secondary} onClick={() => window.print()}>
                🖨️ Print BRS
              </button>
              <button className={styles.primary} onClick={() => setIsBrsModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


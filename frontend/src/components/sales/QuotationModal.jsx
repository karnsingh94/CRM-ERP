'use client';

import Modal from '../ui/Modal';

export default function QuotationModal({
  isOpen,
  onClose,
  quoteForm,
  setQuoteForm,
  handleCreateQuote,
  isSavingQuote,
  handleAddQuoteItem,
  handleQuoteItemChange,
  handleRemoveQuoteItem,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Issue New Quotation Proposal" maxWidth="880px">
      <form onSubmit={handleCreateQuote} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#1e293b' }}>
              Client Organization *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Zenith Tech Solutions"
              value={quoteForm.customer}
              onChange={(e) => setQuoteForm({ ...quoteForm, customer: e.target.value })}
              style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#1e293b' }}>
              Proposal Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Quotation for Office Workstations"
              value={quoteForm.title}
              onChange={(e) => setQuoteForm({ ...quoteForm, title: e.target.value })}
              style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {/* ITEM BUILDER */}
        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <div>
              <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>📦</span> Quoted Products &amp; Services *
              </label>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.15rem' }}>
                List the specific products, quantities, rates and GST taxes proposed to client.
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddQuoteItem}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.42rem 0.9rem',
                borderRadius: '7px',
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
              }}
            >
              <span style={{ fontSize: '0.95rem', lineHeight: 1 }}>+</span> Add Item
            </button>
          </div>

          {/* Column Headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(210px, 2.6fr) 85px 125px 90px 145px 36px',
              gap: '0.6rem',
              marginBottom: '0.45rem',
              padding: '0.45rem 0.65rem',
              background: '#edf2f7',
              borderRadius: '8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#475569',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            <div>Product / Item Description</div>
            <div style={{ textAlign: 'center' }}>Qty</div>
            <div style={{ textAlign: 'right' }}>Rate (₹)</div>
            <div style={{ textAlign: 'center' }}>GST %</div>
            <div style={{ textAlign: 'right' }}>Total (₹)</div>
            <div></div>
          </div>

          {/* Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {quoteForm.items.map((it, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(210px, 2.6fr) 85px 125px 90px 145px 36px',
                  gap: '0.6rem',
                  alignItems: 'center',
                  padding: '0.35rem 0.65rem',
                  background: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                }}
              >
                <input
                  type="text"
                  required
                  placeholder="e.g. Dell OptiPlex Desktop"
                  value={it.item}
                  onChange={(e) => handleQuoteItemChange(idx, 'item', e.target.value)}
                  list="sales-catalog-products"
                  style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.83rem', width: '100%' }}
                />
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="Qty"
                  value={it.qty}
                  onChange={(e) => handleQuoteItemChange(idx, 'qty', e.target.value)}
                  style={{ padding: '0.45rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.83rem', textAlign: 'center', width: '100%' }}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={it.rate}
                  onChange={(e) => handleQuoteItemChange(idx, 'rate', e.target.value)}
                  style={{ padding: '0.45rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.83rem', textAlign: 'right', width: '100%' }}
                />
                <select
                  value={it.gst}
                  onChange={(e) => handleQuoteItemChange(idx, 'gst', e.target.value)}
                  style={{ padding: '0.45rem 0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.81rem', background: '#ffffff', textAlign: 'center', width: '100%' }}
                >
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    color: '#0f172a',
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                    letterSpacing: '-0.01em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  ₹{parseFloat(it.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {quoteForm.items.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveQuoteItem(idx)}
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '6px',
                      border: '1px solid #fecaca',
                      background: '#fff1f2',
                      color: '#e11d48',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                    title="Remove item"
                  >
                    ×
                  </button>
                ) : <span />}
              </div>
            ))}
          </div>

          {/* Totals Summary Footer */}
          <div
            style={{
              borderTop: '1px solid #cbd5e1',
              marginTop: '0.85rem',
              paddingTop: '0.85rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '20px',
                  background: '#e0e7ff',
                  color: '#4338ca',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {quoteForm.items.length} SKU{quoteForm.items.length > 1 ? 's' : ''}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Total Units: <strong style={{ color: '#1e293b' }}>{quoteForm.items.reduce((acc, it) => acc + (parseInt(it.qty) || 0), 0)}</strong>
              </span>
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: '0.6rem',
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                background: '#f3e8ff',
                border: '1px solid #d8b4fe',
              }}
            >
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b21a8', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                Quoted Grand Total (incl. GST):
              </span>
              <span
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  color: '#6b21a8',
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ₹{parseFloat(quoteForm.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#1e293b' }}>
              Quotation Terms &amp; Scope of Work
            </label>
            <textarea
              rows={2}
              placeholder="e.g. 50% advance, delivery within 7 working days, 1 year onsite warranty included."
              value={quoteForm.notes}
              onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
              style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#1e293b' }}>
              Valid Until Date
            </label>
            <input
              type="date"
              value={quoteForm.validUntil}
              onChange={(e) => setQuoteForm({ ...quoteForm, validUntil: e.target.value })}
              style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.65rem 1.35rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSavingQuote}
            style={{
              padding: '0.65rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              color: '#ffffff',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
            }}
          >
            {isSavingQuote ? 'Saving...' : 'Generate Quotation'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

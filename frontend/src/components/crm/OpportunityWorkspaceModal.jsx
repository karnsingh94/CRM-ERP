'use client';

import Modal from '../ui/Modal';

export default function OpportunityWorkspaceModal({
  isOpen,
  onClose,
  viewingOpportunity,
  manageOppForm,
  setManageOppForm,
  renderStageBadge,
  handleUpdateOpportunityDetails,
  isUpdatingOpportunity,
}) {
  if (!viewingOpportunity) return null;

  const currentStage = manageOppForm?.stage || viewingOpportunity?.stage;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Deal Pipeline & Closing 💼"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Header info card */}
        <div
          style={{
            padding: '1rem',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
              {viewingOpportunity.title}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span>🏢 Client: <strong style={{ color: '#0f172a' }}>{viewingOpportunity.companyName}</strong></span>
              <span>•</span>
              <span>📅 Opened: {viewingOpportunity.createdAt ? new Date(viewingOpportunity.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
            </div>
          </div>
          <div>
            {renderStageBadge ? renderStageBadge(currentStage) : currentStage}
          </div>
        </div>

        {/* Interactive Visual Pipeline Stage Stepper */}
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pipeline Progress Stage (Click to Advance Deal)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' }}>
            {[
              { stage: 'DISCOVERY', label: '1. Discovery', desc: 'Requirement Gathering', color: '#0284c7', prob: '25%' },
              { stage: 'PROPOSAL', label: '2. Proposal', desc: 'Quotation Sent', color: '#7c3aed', prob: '50%' },
              { stage: 'NEGOTIATION', label: '3. Negotiation', desc: 'Price / Terms Discussion', color: '#d97706', prob: '75%' },
              { stage: 'WON', label: '4. Closed Won', desc: 'PO / Advance Received', color: '#16a34a', prob: '100%' },
              { stage: 'LOST', label: '5. Closed Lost', desc: 'Deal Dropped', color: '#dc2626', prob: '0%' },
            ].map((st) => {
              const isActive = currentStage === st.stage;
              return (
                <button
                  key={st.stage}
                  type="button"
                  onClick={() => {
                    setManageOppForm((prev) => ({
                      ...prev,
                      stage: st.stage,
                      probability: st.prob,
                    }));
                  }}
                  style={{
                    padding: '0.75rem 0.5rem',
                    borderRadius: '8px',
                    border: isActive ? `2px solid ${st.color}` : '1px solid #e2e8f0',
                    background: isActive ? `${st.color}15` : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: isActive ? st.color : '#334155' }}>
                    {st.label}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: isActive ? st.color : '#94a3b8', marginTop: '2px', lineHeight: 1.2 }}>
                    {st.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stage Context Banner */}
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            background:
              manageOppForm.stage === 'WON'
                ? '#f0fdf4'
                : manageOppForm.stage === 'LOST'
                ? '#fef2f2'
                : '#f8fafc',
            border: `1px solid ${
              manageOppForm.stage === 'WON'
                ? '#bbf7d0'
                : manageOppForm.stage === 'LOST'
                ? '#fecaca'
                : '#e2e8f0'
            }`,
          }}
        >
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
            💡 Stage Trigger & Ground Reality:
          </div>
          <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px', lineHeight: 1.5 }}>
            {manageOppForm.stage === 'DISCOVERY' &&
              'Requirement gathering phase. Sales representative interacts with client SPOC to understand specifications, quantity, and budget.'}
            {manageOppForm.stage === 'PROPOSAL' &&
              'Quotation phase. Representative has sent formal sales quote. Click "📄 Create / Open Quotation" below to view or generate QT document.'}
            {manageOppForm.stage === 'NEGOTIATION' &&
              'Commercial discussion phase. Client has received the quote and is discussing discounts, credit period, or scope modifications.'}
            {manageOppForm.stage === 'WON' &&
              'Deal successfully closed! Client has confirmed the Purchase Order (PO) or provided token advance payment. Ready for dispatch & billing.'}
            {manageOppForm.stage === 'LOST' &&
              'Deal dropped or lost to competitor. Reason can be tracked for future pipeline optimization.'}
          </div>
        </div>

        {/* Editable Deal Properties Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleUpdateOpportunityDetails();
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
              Deal / Opportunity Title
            </label>
            <input
              type="text"
              required
              value={manageOppForm.title}
              onChange={(e) => setManageOppForm({ ...manageOppForm, title: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Estimated Value
              </label>
              <input
                type="text"
                placeholder="e.g. ₹ 8,50,000"
                value={manageOppForm.value}
                onChange={(e) => setManageOppForm({ ...manageOppForm, value: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Win Probability
              </label>
              <select
                value={manageOppForm.probability}
                onChange={(e) => setManageOppForm({ ...manageOppForm, probability: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '0.85rem' }}
              >
                <option value="25%">25% (Early Stage)</option>
                <option value="50%">50% (Proposal Active)</option>
                <option value="75%">75% (Shortlisted / Verbal)</option>
                <option value="90%">90% (Final Legal Review)</option>
                <option value="100%">100% (Signed)</option>
                <option value="0%">0% (Lost / Cancelled)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Target Closing Date
              </label>
              <input
                type="date"
                value={manageOppForm.expectedCloseDate}
                onChange={(e) => setManageOppForm({ ...manageOppForm, expectedCloseDate: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Action buttons row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '0.5rem',
              flexWrap: 'wrap',
              gap: '0.75rem',
              paddingTop: '1rem',
              borderTop: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <a
                href={`/sales/quotations?customer=${encodeURIComponent(viewingOpportunity.companyName)}&opportunityId=${encodeURIComponent(viewingOpportunity.id)}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.55rem 0.95rem',
                  borderRadius: '6px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                <span>📄</span> Create Quotation ↗
              </a>

              {manageOppForm.stage !== 'WON' && (
                <button
                  type="button"
                  disabled={isUpdatingOpportunity}
                  onClick={() => handleUpdateOpportunityDetails('WON')}
                  style={{
                    padding: '0.55rem 0.95rem',
                    borderRadius: '6px',
                    background: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  🏆 Mark WON
                </button>
              )}

              {manageOppForm.stage !== 'LOST' && (
                <button
                  type="button"
                  disabled={isUpdatingOpportunity}
                  onClick={() => handleUpdateOpportunityDetails('LOST')}
                  style={{
                    padding: '0.55rem 0.95rem',
                    borderRadius: '6px',
                    background: '#ffffff',
                    color: '#dc2626',
                    border: '1px solid #fca5a5',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ❌ Mark LOST
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.6rem 1.25rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isUpdatingOpportunity}
                style={{
                  padding: '0.6rem 1.4rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#7f22fe',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {isUpdatingOpportunity ? 'Saving...' : 'Save Deal Updates'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}

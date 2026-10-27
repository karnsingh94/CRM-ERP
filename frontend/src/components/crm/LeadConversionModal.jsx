'use client';

import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';

export default function LeadConversionModal({
  isOpen,
  onClose,
  leadToConvert,
  convertForm,
  setConvertForm,
  handleConvertLeadToCustomer,
  isConvertingLead,
  existingCustomers = [],
}) {
  const [conversionMode, setConversionMode] = useState('new'); // 'new' | 'existing'
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      setConversionMode('new');
      setSelectedCustomerId('');
      setCustomerSearch('');
    }
  }, [isOpen]);

  const filteredCustomers = existingCustomers.filter((c) => {
    const q = customerSearch.toLowerCase();
    return (
      (c.companyName && c.companyName.toLowerCase().includes(q)) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  const onSubmit = (e) => {
    e.preventDefault();
    if (conversionMode === 'existing') {
      if (!selectedCustomerId) {
        alert('Please select an existing customer from the list.');
        return;
      }
      handleConvertLeadToCustomer(e, { existingCustomerId: selectedCustomerId });
    } else {
      handleConvertLeadToCustomer(e);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Convert Lead to Corporate Customer 🏢">
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ padding: '0.75rem 1rem', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '0.84rem', color: '#1e40af' }}>
          <span>💡 <strong>Lead Conversion:</strong> Promotes this lead into an active Customer Account, marks the lead as <strong>WON</strong>, and links commercial history.</span>
        </div>

        {/* Mode Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => {
              setConversionMode('new');
              setConvertForm((prev) => ({ ...prev, existingCustomerId: undefined }));
            }}
            style={{
              padding: '0.65rem 0.9rem',
              borderRadius: '8px',
              border: conversionMode === 'new' ? '2px solid #7f22fe' : '1px solid #cbd5e1',
              background: conversionMode === 'new' ? '#faf5ff' : '#ffffff',
              color: conversionMode === 'new' ? '#7f22fe' : '#475569',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            <span>✨</span> Create New Customer
          </button>
          <button
            type="button"
            onClick={() => {
              setConversionMode('existing');
            }}
            style={{
              padding: '0.65rem 0.9rem',
              borderRadius: '8px',
              border: conversionMode === 'existing' ? '2px solid #7f22fe' : '1px solid #cbd5e1',
              background: conversionMode === 'existing' ? '#faf5ff' : '#ffffff',
              color: conversionMode === 'existing' ? '#7f22fe' : '#475569',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            <span>🔗</span> Link to Existing Customer
          </button>
        </div>

        {conversionMode === 'existing' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
              Select Existing Customer Account *
            </label>
            <input
              type="text"
              placeholder="Search existing customer by company, contact or email..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              style={{ width: '100%', padding: '0.55rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
            />
            <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff' }}>
              {filteredCustomers.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                  No matching customers found.
                </div>
              ) : (
                filteredCustomers.map((cust) => (
                  <div
                    key={cust.id}
                    onClick={() => setSelectedCustomerId(cust.id)}
                    style={{
                      padding: '0.6rem 0.85rem',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      background: selectedCustomerId === cust.id ? '#ede9fe' : 'transparent',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#1e293b' }}>{cust.companyName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {cust.contactPerson || 'No Contact'} • {cust.email || cust.phone || 'No direct contact'}
                      </div>
                    </div>
                    {selectedCustomerId === cust.id && (
                      <span style={{ fontSize: '0.8rem', color: '#7f22fe', fontWeight: 800 }}>✓ Selected</span>
                    )}
                  </div>
                ))
              )}
            </div>
            {selectedCustomerId && (
              <div style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600 }}>
                Selected customer account will be linked to this lead and prevent duplicate creation.
              </div>
            )}
          </div>
        ) : (
          <>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Company / Account Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Acme Corp Pvt Ltd"
                value={convertForm.companyName}
                onChange={(e) => setConvertForm({ ...convertForm, companyName: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  Primary Contact Person
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kulkarni"
                  value={convertForm.contactPerson}
                  onChange={(e) => setConvertForm({ ...convertForm, contactPerson: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  Official Email Address
                </label>
                <input
                  type="email"
                  placeholder="ramesh@example.com"
                  value={convertForm.email}
                  onChange={(e) => setConvertForm({ ...convertForm, email: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                    Phone Number
                  </label>
                  <span style={{ fontSize: '0.72rem', color: convertForm.phone?.length === 10 ? '#10b981' : '#64748b' }}>
                    {convertForm.phone ? `${convertForm.phone.length}/10` : '10 digits'}
                  </span>
                </div>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="e.g. 9876500000"
                  value={convertForm.phone}
                  onChange={(e) => setConvertForm({ ...convertForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  GSTIN / Tax Registration No
                </label>
                <input
                  type="text"
                  placeholder="e.g. 27AABCM1234F1Z9"
                  value={convertForm.gstin}
                  onChange={(e) => setConvertForm({ ...convertForm, gstin: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Industry / Domain
              </label>
              <select
                value={convertForm.industry}
                onChange={(e) => setConvertForm({ ...convertForm, industry: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
              >
                <option value="Technology & IT">Technology &amp; IT</option>
                <option value="Manufacturing & Industrial">Manufacturing &amp; Industrial</option>
                <option value="Logistics & Supply Chain">Logistics &amp; Supply Chain</option>
                <option value="Retail & E-commerce">Retail &amp; E-commerce</option>
                <option value="Healthcare & Pharma">Healthcare &amp; Pharma</option>
                <option value="Construction & Real Estate">Construction &amp; Real Estate</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Customer Requirement / Notes (Carried Over)
              </label>
              <textarea
                rows={2}
                placeholder="Customer requirements..."
                value={convertForm.requirements}
                onChange={(e) => setConvertForm({ ...convertForm, requirements: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.84rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Assigned Account Manager / Sales Rep
              </label>
              <input
                type="text"
                placeholder="e.g. Karan"
                value={convertForm.assignedTo}
                onChange={(e) => setConvertForm({ ...convertForm, assignedTo: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.84rem' }}
              />
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isConvertingLead}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.6rem 1.4rem',
              borderRadius: '6px',
              border: 'none',
              background: '#7f22fe',
              color: '#ffffff',
              fontWeight: 700,
              cursor: isConvertingLead ? 'wait' : 'pointer',
              boxShadow: '0 4px 6px rgba(127, 34, 254, 0.25)',
            }}
          >
            {isConvertingLead ? 'Converting...' : conversionMode === 'existing' ? '🔗 Link & Move to Customers 🚀' : '🏢 Confirm & Move to Customers 🚀'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

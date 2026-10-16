'use client';

import { useState } from 'react';
import { IconShield, IconPlus } from '../ui/Icons';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';

export default function GatePassModule({ activeCompany, showToast, initialSubTab }) {
  const filterType = initialSubTab ? initialSubTab.toUpperCase() : 'ALL';
  const [passes, setPasses] = useState([
    {
      id: 1,
      passNo: 'GP-OUT-2026-081',
      type: 'OUTWARD',
      vehicleNo: 'MH 12 AB 4589',
      driver: 'Mahesh Patil',
      purpose: 'Client Delivery - SO-2026-089',
      carrier: 'SafeXpress Logistics',
      status: 'GATE_CLEARED',
      issuedAt: '2026-10-14 11:30 AM',
    },
    {
      id: 2,
      passNo: 'GP-IN-2026-092',
      type: 'INWARD',
      vehicleNo: 'GJ 06 CD 1022',
      driver: 'Suresh Kumar',
      purpose: 'Vendor Delivery - PO-2026-034',
      carrier: 'Gujarat Freight Lines',
      status: 'SECURITY_CHECKED',
      issuedAt: '2026-10-14 09:15 AM',
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    type: 'OUTWARD',
    vehicleNo: '',
    driver: '',
    purpose: '',
    carrier: '',
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.vehicleNo || !form.driver) return;
    const newP = {
      id: Date.now(),
      passNo: `GP-${form.type === 'INWARD' ? 'IN' : 'OUT'}-2026-${Math.floor(Math.random() * 900) + 100}`,
      issuedAt: new Date().toLocaleString(),
      status: 'ISSUED',
      ...form,
    };
    setPasses([newP, ...passes]);
    setShowModal(false);
    setForm({ type: 'OUTWARD', vehicleNo: '', driver: '', purpose: '', carrier: '' });
    showToast('Gate Pass Created! 🛡️', `Security pass ${newP.passNo} registered.`, 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>Factory Gate Pass &amp; Logistics Control</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Inward raw material entry and outward delivery tracking for {activeCompany?.organizationName}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
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
          <IconPlus size={16} /> Issue Gate Pass
        </button>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>Pass Number</th>
                <th style={{ padding: '0.85rem 1rem' }}>Pass Type</th>
                <th style={{ padding: '0.85rem 1rem' }}>Vehicle Number</th>
                <th style={{ padding: '0.85rem 1rem' }}>Driver / Carrier</th>
                <th style={{ padding: '0.85rem 1rem' }}>Purpose / Order Ref</th>
                <th style={{ padding: '0.85rem 1rem' }}>Issued Timestamp</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Gate Status</th>
              </tr>
            </thead>
            <tbody>
              {(filterType === 'ALL' || filterType === 'RETURNABLE' ? passes : passes.filter(p => p.type === filterType)).map((gp) => (
                <tr key={gp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#2563eb' }}>
                    {gp.passNo}
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        background: gp.type === 'INWARD' ? '#eff6ff' : '#f0fdf4',
                        color: gp.type === 'INWARD' ? '#1d4ed8' : '#15803d',
                        border: `1px solid ${gp.type === 'INWARD' ? '#bfdbfe' : '#bbf7d0'}`,
                      }}
                    >
                      {gp.type}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                    {gp.vehicleNo}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>
                    {gp.driver} ({gp.carrier})
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                    {gp.purpose}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.78rem' }}>
                    {gp.issuedAt}
                  </td>
                  <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                      {gp.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Issue Factory Gate Pass">
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>Pass Movement Type *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}
              >
                <option value="OUTWARD">OUTWARD (Finished Goods / Dispatch)</option>
                <option value="INWARD">INWARD (Raw Materials / Delivery)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>Vehicle Registration No *</label>
              <input
                type="text"
                required
                placeholder="e.g. MH 12 AB 9988"
                value={form.vehicleNo}
                onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>Driver Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Anand Shinde"
                value={form.driver}
                onChange={(e) => setForm({ ...form, driver: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>Logistics Carrier / Transporter</label>
              <input
                type="text"
                placeholder="e.g. VRL Logistics"
                value={form.carrier}
                onChange={(e) => setForm({ ...form, carrier: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>Purpose &amp; Order Reference *</label>
            <input
              type="text"
              required
              placeholder="e.g. Dispatch for Sales Order SO-2026-089"
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#ffffff', fontWeight: 700 }}
            >
              Issue Gate Pass
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

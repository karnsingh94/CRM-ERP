'use client';

import { useState } from 'react';
import { IconPlus, IconClipboardCheck, IconTruck } from '../ui/Icons';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';

export default function GrnModule({ activeCompany, showToast }) {
  const [grns, setGrns] = useState([
    {
      id: 1,
      grnNo: 'GRN-2026-104',
      poRef: 'PO-2026-034',
      vendor: 'Sterling Steel & Alloy Corp',
      receiptDate: '2026-10-14',
      item: 'Precision Cold-Rolled Steel Sheet',
      orderedQty: 500,
      receivedQty: 500,
      acceptedQty: 495,
      rejectedQty: 5,
      qcStatus: 'PASSED',
      warehouse: 'Main Warehouse - Bay 3',
    },
    {
      id: 2,
      grnNo: 'GRN-2026-105',
      poRef: 'PO-2026-035',
      vendor: 'PolyChem Polymers India',
      receiptDate: '2026-10-13',
      item: 'Polymer Resin Pellets Grade B',
      orderedQty: 200,
      receivedQty: 200,
      acceptedQty: 200,
      rejectedQty: 0,
      qcStatus: 'PASSED',
      warehouse: 'Chemical Depot A',
    },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    poRef: '',
    vendor: '',
    item: '',
    receivedQty: '',
    acceptedQty: '',
    rejectedQty: '0',
    warehouse: 'Main Warehouse - Bay 1',
  });

  const handleCreateGrn = (e) => {
    e.preventDefault();
    if (!form.poRef || !form.item) {
      showToast('Validation Error', 'PO reference and item name are required', 'danger');
      return;
    }
    const newG = {
      id: Date.now(),
      grnNo: `GRN-2026-${Math.floor(Math.random() * 900) + 100}`,
      receiptDate: new Date().toISOString().split('T')[0],
      orderedQty: parseInt(form.receivedQty) || 0,
      receivedQty: parseInt(form.receivedQty) || 0,
      acceptedQty: parseInt(form.acceptedQty) || parseInt(form.receivedQty) || 0,
      rejectedQty: parseInt(form.rejectedQty) || 0,
      qcStatus: parseInt(form.rejectedQty) > 0 ? 'PARTIAL' : 'PASSED',
      ...form,
    };
    setGrns([newG, ...grns]);
    setShowAddModal(false);
    setForm({ poRef: '', vendor: '', item: '', receivedQty: '', acceptedQty: '', rejectedQty: '0', warehouse: 'Main Warehouse - Bay 1' });
    showToast('GRN Recorded! 📥', `Inward Receipt ${newG.grnNo} logged.`, 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>Goods Receipt Notes (GRN) &amp; QC</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Inward material inspection, stock receipt notes, and warehouse put-away for {activeCompany?.organizationName}
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
            background: '#2563eb',
            color: '#ffffff',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.86rem',
            boxShadow: '0 4px 6px rgba(37, 99, 235, 0.25)',
          }}
        >
          <IconPlus size={16} /> Record Inward GRN
        </button>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>GRN Number</th>
                <th style={{ padding: '0.85rem 1rem' }}>PO Reference</th>
                <th style={{ padding: '0.85rem 1rem' }}>Supplier</th>
                <th style={{ padding: '0.85rem 1rem' }}>Material / Item</th>
                <th style={{ padding: '0.85rem 1rem' }}>Received / Accepted</th>
                <th style={{ padding: '0.85rem 1rem' }}>QC Status</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Put-away Location</th>
              </tr>
            </thead>
            <tbody>
              {grns.map((g) => (
                <tr key={g.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#2563eb' }}>
                    {g.grnNo}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#475569' }}>
                    {g.poRef}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#0f172a', fontWeight: 700 }}>
                    {g.vendor}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                    {g.item}
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{g.receivedQty}</span>
                    <span style={{ color: '#10b981', fontWeight: 700 }}> ({g.acceptedQty} ok)</span>
                    {g.rejectedQty > 0 && (
                      <span style={{ color: '#ef4444', fontWeight: 700 }}> / {g.rejectedQty} rej</span>
                    )}
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                      {g.qcStatus}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', color: '#64748b', fontSize: '0.78rem' }}>
                    {g.warehouse}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Log Inward Goods Receipt Note (GRN)">
        <form onSubmit={handleCreateGrn} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Purchase Order (PO) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. PO-2026-034"
                value={form.poRef}
                onChange={(e) => setForm({ ...form, poRef: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Supplier Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Sterling Steel Corp"
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Material Description *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Industrial Steel Tubes 2 inch"
              value={form.item}
              onChange={(e) => setForm({ ...form, item: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Received Qty *
              </label>
              <input
                type="number"
                required
                placeholder="0"
                value={form.receivedQty}
                onChange={(e) => setForm({ ...form, receivedQty: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Accepted Qty
              </label>
              <input
                type="number"
                placeholder="0"
                value={form.acceptedQty}
                onChange={(e) => setForm({ ...form, acceptedQty: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Rejected Qty
              </label>
              <input
                type="number"
                placeholder="0"
                value={form.rejectedQty}
                onChange={(e) => setForm({ ...form, rejectedQty: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Put-away Warehouse Location
            </label>
            <input
              type="text"
              placeholder="e.g. Main Warehouse - Bay 4"
              value={form.warehouse}
              onChange={(e) => setForm({ ...form, warehouse: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
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
              style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#ffffff', fontWeight: 700 }}
            >
              Confirm Inward GRN
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

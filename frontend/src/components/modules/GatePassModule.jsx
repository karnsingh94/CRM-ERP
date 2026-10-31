'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { IconShield, IconPlus } from '../ui/Icons';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';

export default function GatePassModule({ activeCompany, showToast, initialSubTab }) {
  const filterType = initialSubTab ? initialSubTab.toUpperCase() : 'ALL';
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    type: 'OUTWARD',
    vehicleNo: '',
    driver: '',
    purpose: '',
    carrier: '',
    destination: '',
    fromWarehouse: 'Main Warehouse',
  });

  const companyPath = activeCompany?.id ? `/companies/${activeCompany.id}/inventory` : '';

  const loadPasses = useCallback(async () => {
    if (!companyPath) return;
    setLoading(true);
    try {
      const res = await api.get(`${companyPath}/gate-passes`, { noCache: true });
      setPasses(res.data || []);
    } catch (err) {
      showToast('Gate Pass load failed', err.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [companyPath, showToast]);

  useEffect(() => {
    loadPasses();
  }, [loadPasses]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.destination || !form.purpose) return;
    setSaving(true);
    try {
      await api.post(`${companyPath}/gate-passes`, {
        gatePassType: form.type === 'INWARD' ? 'JOB_WORK' : 'RETURNABLE',
        destination: form.destination || form.driver,
        purpose: `${form.purpose} (Vehicle: ${form.vehicleNo || 'N/A'}, Carrier: ${form.carrier || 'N/A'})`,
        fromWarehouse: form.fromWarehouse || 'Main Warehouse',
        items: [{ sku: 'GATE-ENTRY', name: form.purpose, qty: 1, uom: 'UNIT' }],
      });
      setShowModal(false);
      setForm({
        type: 'OUTWARD',
        vehicleNo: '',
        driver: '',
        purpose: '',
        carrier: '',
        destination: '',
        fromWarehouse: 'Main Warehouse',
      });
      await loadPasses();
      showToast('Gate Pass Registered 🛡️', 'Security pass logged in inventory register.', 'success');
    } catch (err) {
      showToast('Failed to create Gate Pass', err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleDispatch = async (id) => {
    try {
      await api.post(`${companyPath}/gate-passes/${id}/dispatch`, {});
      await loadPasses();
      showToast('Gate Pass Dispatched', 'Status updated to DISPATCHED.', 'success');
    } catch (err) {
      showToast('Dispatch failed', err.message, 'danger');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>Factory Gate Pass &amp; Logistics Control</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Inward material intake and outward delivery tracking for {activeCompany?.organizationName}
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
          <IconPlus size={16} /> Issue Gate Pass
        </button>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {passes.length === 0 ? (
          <EmptyState
            icon="🚧"
            title="No Gate Passes Issued"
            description="Issue inbound or outbound factory gate passes for security and vehicle tracking."
            actionLabel="Issue Gate Pass"
            onAction={() => setShowModal(true)}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Pass Number</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Type</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Destination / Party</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Warehouse</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Purpose</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Issued By</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Date</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Status / Action</th>
                </tr>
              </thead>
              <tbody>
                {passes.map((gp) => (
                  <tr key={gp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#7f22fe' }}>
                      {gp.gatePassNo}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          background: '#f5f3ff',
                          color: '#6d28d9',
                          border: '1px solid #ddd6fe',
                        }}
                      >
                        {gp.gatePassType}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                      {gp.destination}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>
                      {gp.fromWarehouse}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                      {gp.purpose}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.78rem' }}>
                      {gp.issuedBy}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.78rem' }}>
                      {new Date(gp.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                        {gp.status}
                      </span>
                      {gp.status === 'APPROVED' && (
                        <button
                          type="button"
                          onClick={() => handleDispatch(gp.id)}
                          style={{ marginLeft: '6px', padding: '3px 8px', border: 'none', background: '#7f22fe', color: '#fff', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Dispatch
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Issue Factory Gate Pass">
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>Movement Type *</label>
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
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>Destination / Receiving Party *</label>
              <input
                type="text"
                required
                placeholder="Receiver / Vendor Name"
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>Vehicle Registration No</label>
              <input
                type="text"
                placeholder="e.g. MH 12 AB 9988"
                value={form.vehicleNo}
                onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>Driver Full Name</label>
              <input
                type="text"
                placeholder="Driver name"
                value={form.driver}
                onChange={(e) => setForm({ ...form, driver: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>Logistics Carrier</label>
              <input
                type="text"
                placeholder="e.g. VRL Logistics"
                value={form.carrier}
                onChange={(e) => setForm({ ...form, carrier: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>From Warehouse</label>
              <input
                type="text"
                value={form.fromWarehouse}
                onChange={(e) => setForm({ ...form, fromWarehouse: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>Purpose &amp; Details *</label>
            <input
              type="text"
              required
              placeholder="e.g. Outbound delivery for Sales Order SO-2026-089"
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
              disabled={saving}
              style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#7f22fe', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
            >
              {saving ? 'Issuing…' : 'Issue Gate Pass'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

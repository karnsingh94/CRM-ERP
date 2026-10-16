'use client';

import { useState } from 'react';
import { IconPackage, IconPlus, IconTruck, IconCornerDownLeft } from '../ui/Icons';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';

export default function DispatchModule({ activeCompany, showToast }) {
  const [dispatches, setDispatches] = useState([
    {
      id: 1,
      dispatchNo: 'DSP-2026-077',
      orderRef: 'SO-2026-089',
      recipient: 'Apex Technologies Pvt Ltd',
      destination: 'Pune Distribution Center',
      carrier: 'SafeXpress Track #SFX88921',
      date: '2026-10-14',
      status: 'IN_TRANSIT',
    },
    {
      id: 2,
      dispatchNo: 'DSP-2026-078',
      orderRef: 'SO-2026-091',
      recipient: 'Kaveri Infotech Solutions',
      destination: 'Bengaluru Facility',
      carrier: 'BlueDart Air Waybill #BD9921',
      date: '2026-10-13',
      status: 'DELIVERED',
    },
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>Dispatch Operations &amp; Returns</h2>
        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Delivery challans, logistics shipment tracking, and customer returns for {activeCompany?.organizationName}
        </p>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>Dispatch No</th>
                <th style={{ padding: '0.85rem 1rem' }}>Order Ref</th>
                <th style={{ padding: '0.85rem 1rem' }}>Recipient Client</th>
                <th style={{ padding: '0.85rem 1rem' }}>Destination</th>
                <th style={{ padding: '0.85rem 1rem' }}>Carrier &amp; Tracking</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Logistics Status</th>
              </tr>
            </thead>
            <tbody>
              {dispatches.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#2563eb' }}>{d.dispatchNo}</td>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#475569' }}>{d.orderRef}</td>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>{d.recipient}</td>
                  <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>{d.destination}</td>
                  <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.78rem' }}>{d.carrier}</td>
                  <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: d.status === 'DELIVERED' ? '#ecfdf5' : '#eff6ff', color: d.status === 'DELIVERED' ? '#065f46' : '#1d4ed8', border: `1px solid ${d.status === 'DELIVERED' ? '#a7f3d0' : '#bfdbfe'}` }}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

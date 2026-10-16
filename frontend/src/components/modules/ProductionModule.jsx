'use client';

import { useState } from 'react';
import { IconCpu, IconPlus, IconLayers } from '../ui/Icons';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';

export default function ProductionModule({ activeCompany, showToast }) {
  const [boms, setBoms] = useState([
    {
      id: 1,
      bomCode: 'BOM-VALVE-50MM',
      outputProduct: 'Industrial Valve Coupling 50mm',
      batchSize: '100 PCS',
      rawMaterialsCount: 4,
      costEstimate: '₹ 82,000',
      status: 'APPROVED',
    },
    {
      id: 2,
      bomCode: 'BOM-BRASS-CORE',
      outputProduct: 'Machined Brass Cylinder Core',
      batchSize: '50 PCS',
      rawMaterialsCount: 3,
      costEstimate: '₹ 28,500',
      status: 'APPROVED',
    },
  ]);

  const [productionOrders, setProductionOrders] = useState([
    {
      id: 1,
      batchNo: 'PRD-BATCH-2026-018',
      bomCode: 'BOM-VALVE-50MM',
      plannedQty: '100 PCS',
      producedQty: '65 PCS',
      startDate: '2026-10-12',
      status: 'IN_PROGRESS',
    },
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>Manufacturing, BOM &amp; Shopfloor</h2>
        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Bill of Materials (BOM), shopfloor work orders, and production batches for {activeCompany?.organizationName}
        </p>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.85rem' }}>
          Active Bill of Materials (BOM) Formulas
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem' }}>BOM Code</th>
                <th style={{ padding: '0.75rem 1rem' }}>Output Finished Product</th>
                <th style={{ padding: '0.75rem 1rem' }}>Standard Batch Size</th>
                <th style={{ padding: '0.75rem 1rem' }}>Raw Materials</th>
                <th style={{ padding: '0.75rem 1rem' }}>Estimated Unit Cost</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {boms.map((b) => (
                <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#2563eb' }}>{b.bomCode}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{b.outputProduct}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>{b.batchSize}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{b.rawMaterialsCount} items</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{b.costEstimate}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                      {b.status}
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

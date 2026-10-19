'use client';

import { useState } from 'react';
import { IconCreditCard, IconFileText, IconPlus } from '../ui/Icons';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';

export default function AccountsModule({ activeCompany, showToast }) {
  const [invoices, setInvoices] = useState([]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>Accounts &amp; Commercial Billing</h2>
        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Tax invoices, accounts receivable, and payment receipts for {activeCompany?.organizationName}
        </p>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {invoices.length === 0 ? (
          <EmptyState
            icon="💳"
            title="No Invoices Issued"
            description="No tax invoices or commercial billings have been generated yet."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Invoice No</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Order Ref</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Client Customer</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Taxable Amount</th>
                  <th style={{ padding: '0.85rem 1rem' }}>GST (18%)</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Total Payable</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#7f22fe' }}>{inv.invoiceNo}</td>
                    <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>{inv.orderRef}</td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>{inv.customer}</td>
                    <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>₹ {inv.amount.toLocaleString()}</td>
                    <td style={{ padding: '0.85rem 1rem', color: '#64748b' }}>₹ {inv.tax.toLocaleString()}</td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#0f172a' }}>₹ {inv.total.toLocaleString()}</td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: inv.status === 'PAID' ? '#ecfdf5' : '#fef2f2', color: inv.status === 'PAID' ? '#065f46' : '#b91c1c', border: `1px solid ${inv.status === 'PAID' ? '#a7f3d0' : '#fecaca'}` }}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

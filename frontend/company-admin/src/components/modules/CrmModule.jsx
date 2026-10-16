'use client';

import { useState } from 'react';
import { IconPlus, IconSearch, IconFilter, IconUsers, IconShoppingBag } from '../ui/Icons';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import ServiceDepartments from '../departments/ServiceDepartments';

export default function CrmModule({ activeCompany, showToast }) {
  const [activeTab, setActiveTab] = useState('leads'); // 'leads', 'customers', 'opportunities'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Leads state
  const [leads, setLeads] = useState([
    {
      id: 1,
      name: 'Rajesh Sharma',
      company: 'Apex Technologies',
      email: 'rajesh@apextech.in',
      phone: '+91 98765 43210',
      source: 'Website Inquiry',
      value: '₹ 2,40,000',
      status: 'QUALIFIED',
      date: '2026-10-12',
    },
    {
      id: 2,
      name: 'Ananya Verma',
      company: 'Zenith Logistics',
      email: 'ananya@zenith.com',
      phone: '+91 91234 56789',
      source: 'Trade Expo',
      value: '₹ 5,80,000',
      status: 'PROPOSAL',
      date: '2026-10-10',
    },
    {
      id: 3,
      name: 'Amit Patel',
      company: 'Gujarat Manufacturing Ltd',
      email: 'amit@gujaratmfg.com',
      phone: '+91 99887 76655',
      source: 'Direct Referral',
      value: '₹ 1,50,000',
      status: 'NEW',
      date: '2026-10-14',
    },
    {
      id: 4,
      name: 'Sunita Rao',
      company: 'Kaveri Infotech',
      email: 'srao@kaveri.io',
      phone: '+91 88776 65544',
      source: 'LinkedIn',
      value: '₹ 8,20,000',
      status: 'WON',
      date: '2026-10-08',
    },
  ]);

  // Modal states
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [newLeadForm, setNewLeadForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    source: 'Website Inquiry',
    value: '',
    status: 'NEW',
  });

  const handleCreateLead = (e) => {
    e.preventDefault();
    if (!newLeadForm.name || !newLeadForm.email) {
      showToast('Validation Error', 'Lead name and email are required', 'danger');
      return;
    }
    const newEntry = {
      id: Date.now(),
      ...newLeadForm,
      date: new Date().toISOString().split('T')[0],
    };
    setLeads([newEntry, ...leads]);
    setShowAddLeadModal(false);
    setNewLeadForm({ name: '', company: '', email: '', phone: '', source: 'Website Inquiry', value: '', status: 'NEW' });
    showToast('Lead Created! 🎉', `Lead for "${newEntry.name}" added to pipeline.`, 'success');
  };

  const handleDeleteLead = () => {
    if (!leadToDelete) return;
    setLeads(leads.filter(l => l.id !== leadToDelete.id));
    showToast('Lead Removed', `Lead "${leadToDelete.name}" has been removed.`, 'danger');
    setLeadToDelete(null);
  };

  const handleStatusChange = (id, newStatus) => {
    setLeads(leads.map(l => l.id === id ? { ...l, status: newStatus } : l));
    showToast('Status Updated', `Lead status updated to ${newStatus}.`, 'success');
  };

  // Filtered leads
  const filteredLeads = leads.filter(l => {
    const matchesSearch =
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'NEW':
        return <span style={{ padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>NEW</span>;
      case 'CONTACTED':
        return <span style={{ padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' }}>CONTACTED</span>;
      case 'QUALIFIED':
        return <span style={{ padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>QUALIFIED</span>;
      case 'PROPOSAL':
        return <span style={{ padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>PROPOSAL</span>;
      case 'WON':
        return <span style={{ padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 800, background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>WON</span>;
      case 'LOST':
        return <span style={{ padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>LOST</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header & Sub-nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>CRM &amp; Sales Pipeline</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Manage leads, corporate clients, customer engagements and deals for {activeCompany?.organizationName}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddLeadModal(true)}
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
          <IconPlus size={16} /> Add New Lead
        </button>
      </div>

      {/* Module Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('leads')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: activeTab === 'leads' ? 800 : 600,
            color: activeTab === 'leads' ? '#2563eb' : '#64748b',
            borderBottom: activeTab === 'leads' ? '2px solid #2563eb' : '2px solid transparent',
            fontSize: '0.88rem',
          }}
        >
          Leads Pipeline ({leads.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('customers')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: activeTab === 'customers' ? 800 : 600,
            color: activeTab === 'customers' ? '#2563eb' : '#64748b',
            borderBottom: activeTab === 'customers' ? '2px solid #2563eb' : '2px solid transparent',
            fontSize: '0.88rem',
          }}
        >
          Customer Directory
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('departments')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: activeTab === 'departments' ? 800 : 600,
            color: activeTab === 'departments' ? '#2563eb' : '#64748b',
            borderBottom: activeTab === 'departments' ? '2px solid #2563eb' : '2px solid transparent',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <span>🏢</span>
          <span>Departments</span>
        </button>
      </div>

      {/* Departments Tab Content */}
      {activeTab === 'departments' && (
        <ServiceDepartments
          activeCompany={activeCompany}
          serviceCode="crm_sales"
          showToast={showToast}
        />
      )}

      {/* Leads Tab Content */}
      {activeTab === 'leads' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Filter Bar */}
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                placeholder="Search by contact name, company, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  maxWidth: '360px',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  background: '#ffffff',
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="NEW">New</option>
                <option value="CONTACTED">Contacted</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="PROPOSAL">Proposal</option>
                <option value="WON">Won</option>
                <option value="LOST">Lost</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {filteredLeads.length === 0 ? (
            <EmptyState
              icon="🎯"
              title="No Leads Found"
              description="No active leads match your search criteria. Click 'Add New Lead' to record a new business inquiry."
              actionLabel="Add Lead"
              onAction={() => setShowAddLeadModal(true)}
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '0.85rem 1.25rem' }}>Lead Contact</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Organization</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Source</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Deal Value</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Date</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{lead.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{lead.email} • {lead.phone}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#334155' }}>
                        {lead.company}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b' }}>
                        {lead.source}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                        {lead.value || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <select
                          value={lead.status}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: '#ffffff',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="NEW">NEW</option>
                          <option value="CONTACTED">CONTACTED</option>
                          <option value="QUALIFIED">QUALIFIED</option>
                          <option value="PROPOSAL">PROPOSAL</option>
                          <option value="WON">WON</option>
                          <option value="LOST">LOST</option>
                        </select>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.78rem' }}>
                        {lead.date}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => setLeadToDelete(lead)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            color: '#dc2626',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Customer Directory Tab */}
      {activeTab === 'customers' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
            Active Corporate Accounts
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1.25rem' }}>
            Accounts provisioned and active under {activeCompany?.organizationName}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>Apex Technologies Pvt Ltd</div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>GST: 27AABCA1234F1Z5</div>
              <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700, marginTop: '8px' }}>Active Enterprise Customer</div>
            </div>
            <div style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>Kaveri Infotech Solutions</div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>GST: 29XYZPA5678B1Z2</div>
              <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700, marginTop: '8px' }}>Active Enterprise Customer</div>
            </div>
          </div>
        </div>
      )}

      {/* Create Lead Modal */}
      <Modal isOpen={showAddLeadModal} onClose={() => setShowAddLeadModal(false)} title="Create New CRM Lead">
        <form onSubmit={handleCreateLead} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Contact Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Kulkarni"
              value={newLeadForm.name}
              onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Company / Organization
              </label>
              <input
                type="text"
                placeholder="e.g. Kulkarni Enterprises"
                value={newLeadForm.company}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, company: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="ramesh@example.com"
                value={newLeadForm.email}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Phone Number
              </label>
              <input
                type="text"
                placeholder="+91 98765 00000"
                value={newLeadForm.phone}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Estimated Value (₹)
              </label>
              <input
                type="text"
                placeholder="e.g. ₹ 3,50,000"
                value={newLeadForm.value}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, value: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => setShowAddLeadModal(false)}
              style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#ffffff', fontWeight: 700 }}
            >
              Save Lead
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(leadToDelete)}
        onClose={() => setLeadToDelete(null)}
        onConfirm={handleDeleteLead}
        title="Delete Lead Record?"
        message={`Are you sure you want to remove lead "${leadToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Lead"
        isDanger={true}
      />
    </div>
  );
}

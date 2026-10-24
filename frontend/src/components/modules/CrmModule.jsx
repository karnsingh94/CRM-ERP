'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '../../lib/api';
import {
  IconPlus,
  IconSearch,
  IconUsers,
  IconBuilding,
  IconClipboardCheck,
  IconActivity,
  IconTrash,
  IconEdit,
  IconFileText,
} from '../ui/Icons';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import ServiceDepartments from '../departments/ServiceDepartments';

const formatLeadValue = (value) => {
  if (value === '' || value === null || value === undefined) return '—';
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount)
    : value;
};

export default function CrmModule({ activeCompany, showToast, initialSubTab, hasSubModuleAccess }) {
  const router = useRouter();
  const pathname = usePathname();

  // Route map for top tabs
  const TAB_ROUTES = {
    leads: '/crm/leads',
    customers: '/crm/customers',
    contacts: '/crm/contacts',
    opportunities: '/crm/opportunities',
    departments: '/services/crm-sales/department-head',
  };

  // Permission checks
  const isLeadsAllowed = typeof hasSubModuleAccess === 'function'
    ? (hasSubModuleAccess('leads') || hasSubModuleAccess('/crm/leads') || hasSubModuleAccess('crm_leads'))
    : true;
  const isCustomersAllowed = typeof hasSubModuleAccess === 'function'
    ? (hasSubModuleAccess('customers') || hasSubModuleAccess('/crm/customers') || hasSubModuleAccess('crm_customers'))
    : true;
  const isContactsAllowed = typeof hasSubModuleAccess === 'function'
    ? (hasSubModuleAccess('contacts') || hasSubModuleAccess('/crm/contacts') || hasSubModuleAccess('crm_contacts'))
    : true;
  const isOpportunitiesAllowed = typeof hasSubModuleAccess === 'function'
    ? (hasSubModuleAccess('opportunities') || hasSubModuleAccess('/crm/opportunities') || hasSubModuleAccess('crm_followups'))
    : true;

  // Active tab state
  const [activeTab, setActiveTab] = useState(initialSubTab || 'leads');

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab);
    } else if (pathname) {
      if (pathname.includes('/crm/customers')) setActiveTab('customers');
      else if (pathname.includes('/crm/contacts')) setActiveTab('contacts');
      else if (pathname.includes('/crm/opportunities')) setActiveTab('opportunities');
      else if (pathname.includes('/departments')) setActiveTab('departments');
      else if (pathname.includes('/crm/leads')) setActiveTab('leads');
    }
  }, [initialSubTab, pathname]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Switch tab and immediately synchronize browser URL route so sidebar updates
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchQuery('');
    setStatusFilter('ALL');

    const targetRoute = TAB_ROUTES[newTab];
    if (targetRoute && pathname !== targetRoute) {
      router.push(targetRoute);
    }
  };

  // -----------------------------------------------------------------
  // 1. LEADS PIPELINE
  // -----------------------------------------------------------------
  const [leads, setLeads] = useState([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [leadLoadVersion, setLeadLoadVersion] = useState(0);
  const [leadError, setLeadError] = useState('');
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [updatingLeadId, setUpdatingLeadId] = useState(null);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    source: 'Website Inquiry',
    value: '',
    status: 'NEW',
  });

  useEffect(() => {
    let isCurrent = true;
    const loadLeads = async () => {
      if (!activeCompany?.id) {
        setLeads([]);
        setIsLoadingLeads(false);
        setLeadError('Choose a company workspace to view leads.');
        return;
      }
      setIsLoadingLeads(true);
      setLeadError('');
      try {
        const response = await api.get(
          `/companies/${activeCompany.id}/crm/leads`,
          { noCache: true }
        );
        if (isCurrent) setLeads(response.data || []);
      } catch (error) {
        if (isCurrent) setLeadError(error.message || 'Unable to load CRM leads.');
      } finally {
        if (isCurrent) setIsLoadingLeads(false);
      }
    };
    loadLeads();
    return () => {
      isCurrent = false;
    };
  }, [activeCompany?.id, leadLoadVersion]);

  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!newLeadForm.name || !newLeadForm.email) {
      showToast('Validation Error', 'Lead contact name and email are required.', 'danger');
      return;
    }
    setIsSavingLead(true);
    try {
      const response = await api.post(
        `/companies/${activeCompany.id}/crm/leads`,
        newLeadForm
      );
      setLeads((current) => [response.data, ...current]);
      setShowAddLeadModal(false);
      setNewLeadForm({ name: '', company: '', email: '', phone: '', source: 'Website Inquiry', value: '', status: 'NEW' });
      showToast('Lead Created! 🎯', `Lead "${response.data.name}" added to pipeline.`, 'success');
    } catch (error) {
      showToast('Lead Not Created', error.message || 'Could not create this lead.', 'danger');
    } finally {
      setIsSavingLead(false);
    }
  };

  const handleLeadStatusChange = async (id, newStatus) => {
    setUpdatingLeadId(id);
    try {
      const response = await api.patch(
        `/companies/${activeCompany.id}/crm/leads/${id}`,
        { status: newStatus }
      );
      setLeads((current) => current.map((lead) => lead.id === id ? response.data : lead));
      showToast('Status Updated', `Lead status changed to ${newStatus}.`, 'success');
    } catch (error) {
      showToast('Status Not Updated', error.message || 'Could not update this lead.', 'danger');
    } finally {
      setUpdatingLeadId(null);
    }
  };

  const filteredLeads = (leads || []).filter(l => {
    if (!l) return false;
    const q = (searchQuery || '').toLowerCase().trim();
    const matchesSearch = !q ||
      String(l.name || '').toLowerCase().includes(q) ||
      String(l.company || '').toLowerCase().includes(q) ||
      String(l.email || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // -----------------------------------------------------------------
  // 2. CUSTOMERS (CORPORATE CLIENTS)
  // -----------------------------------------------------------------
  const [customers, setCustomers] = useState([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    companyName: '',
    gstin: '',
    contactPerson: '',
    email: '',
    phone: '',
    industry: 'Technology & IT',
    status: 'ACTIVE',
  });

  const loadCustomers = async () => {
    if (!activeCompany?.id) return;
    setIsLoadingCustomers(true);
    try {
      const res = await api.get(`/companies/${activeCompany.id}/crm/customers`, { noCache: true });
      setCustomers(res.data || []);
    } catch (err) {
      // Ignore or empty
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [activeCompany?.id]);

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!customerForm.companyName) {
      showToast('Validation Error', 'Company name is required.', 'danger');
      return;
    }
    setIsSavingCustomer(true);
    try {
      const res = await api.post(`/companies/${activeCompany.id}/crm/customers`, customerForm);
      setCustomers([res.data, ...customers]);
      setShowAddCustomerModal(false);
      setCustomerForm({
        companyName: '',
        gstin: '',
        contactPerson: '',
        email: '',
        phone: '',
        industry: 'Technology & IT',
        status: 'ACTIVE',
      });
      showToast('Customer Added! 🏢', `Client "${res.data.companyName}" successfully registered in database.`, 'success');
    } catch (err) {
      showToast('Customer Not Created', err.message || 'Could not register customer.', 'danger');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const filteredCustomers = (customers || []).filter(c => {
    if (!c) return false;
    const q = (searchQuery || '').toLowerCase().trim();
    const matchesSearch = !q ||
      String(c.companyName || '').toLowerCase().includes(q) ||
      String(c.contactPerson || '').toLowerCase().includes(q) ||
      String(c.gstin || '').toLowerCase().includes(q) ||
      String(c.email || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // -----------------------------------------------------------------
  // 3. CONTACT PERSONS
  // -----------------------------------------------------------------
  const [contacts, setContacts] = useState([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    companyName: '',
    role: '',
    email: '',
    phone: '',
    channel: 'Email',
  });

  const loadContacts = async () => {
    if (!activeCompany?.id) return;
    setIsLoadingContacts(true);
    try {
      const res = await api.get(`/companies/${activeCompany.id}/crm/contacts`, { noCache: true });
      setContacts(res.data || []);
    } catch (err) {
      // Ignore or empty
    } finally {
      setIsLoadingContacts(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [activeCompany?.id]);

  const handleCreateContact = async (e) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.companyName) {
      showToast('Validation Error', 'Contact name and company are required.', 'danger');
      return;
    }
    setIsSavingContact(true);
    try {
      const res = await api.post(`/companies/${activeCompany.id}/crm/contacts`, contactForm);
      setContacts([res.data, ...contacts]);
      setShowAddContactModal(false);
      setContactForm({
        name: '',
        companyName: '',
        role: '',
        email: '',
        phone: '',
        channel: 'Email',
      });
      showToast('Contact Added! 👤', `Contact "${res.data.name}" registered in database.`, 'success');
    } catch (err) {
      showToast('Contact Not Created', err.message || 'Could not register contact.', 'danger');
    } finally {
      setIsSavingContact(false);
    }
  };

  const filteredContacts = (contacts || []).filter(cnt => {
    if (!cnt) return false;
    const q = (searchQuery || '').toLowerCase().trim();
    const matchesSearch = !q ||
      String(cnt.name || '').toLowerCase().includes(q) ||
      String(cnt.companyName || '').toLowerCase().includes(q) ||
      String(cnt.email || '').toLowerCase().includes(q) ||
      String(cnt.phone || '').toLowerCase().includes(q) ||
      String(cnt.role || '').toLowerCase().includes(q);
    return matchesSearch;
  });

  // -----------------------------------------------------------------
  // 4. DEAL OPPORTUNITIES (SALES DEALS)
  // -----------------------------------------------------------------
  const [opportunities, setOpportunities] = useState([]);
  const [isLoadingOpportunities, setIsLoadingOpportunities] = useState(false);
  const [showAddOpportunityModal, setShowAddOpportunityModal] = useState(false);
  const [isSavingOpportunity, setIsSavingOpportunity] = useState(false);
  const [opportunityForm, setOpportunityForm] = useState({
    title: '',
    companyName: '',
    stage: 'DISCOVERY',
    value: '',
    expectedCloseDate: '',
    probability: '50%',
  });

  const loadOpportunities = async () => {
    if (!activeCompany?.id) return;
    setIsLoadingOpportunities(true);
    try {
      const res = await api.get(`/companies/${activeCompany.id}/crm/opportunities`, { noCache: true });
      setOpportunities(res.data || []);
    } catch (err) {
      // Ignore or empty
    } finally {
      setIsLoadingOpportunities(false);
    }
  };

  useEffect(() => {
    loadOpportunities();
  }, [activeCompany?.id]);

  const handleCreateOpportunity = async (e) => {
    e.preventDefault();
    if (!opportunityForm.title || !opportunityForm.companyName) {
      showToast('Validation Error', 'Opportunity title and company are required.', 'danger');
      return;
    }
    setIsSavingOpportunity(true);
    try {
      const res = await api.post(`/companies/${activeCompany.id}/crm/opportunities`, opportunityForm);
      setOpportunities([res.data, ...opportunities]);
      setShowAddOpportunityModal(false);
      setOpportunityForm({
        title: '',
        companyName: '',
        stage: 'DISCOVERY',
        value: '',
        expectedCloseDate: '',
        probability: '50%',
      });
      showToast('Opportunity Created! 💼', `Deal "${res.data.title}" added to pipeline in database.`, 'success');
    } catch (err) {
      showToast('Opportunity Not Created', err.message || 'Could not register opportunity.', 'danger');
    } finally {
      setIsSavingOpportunity(false);
    }
  };

  const handleOpportunityStageChange = async (id, newStage) => {
    try {
      const res = await api.patch(`/companies/${activeCompany.id}/crm/opportunities/${id}`, { stage: newStage });
      setOpportunities(opportunities.map(o => o.id === id ? res.data : o));
      showToast('Stage Updated', `Opportunity stage changed to ${newStage}.`, 'success');
    } catch (err) {
      setOpportunities(opportunities.map(o => o.id === id ? { ...o, stage: newStage } : o));
      showToast('Stage Updated', `Opportunity stage changed to ${newStage}.`, 'success');
    }
  };

  const filteredOpportunities = (opportunities || []).filter(o => {
    if (!o) return false;
    const q = (searchQuery || '').toLowerCase().trim();
    const matchesSearch = !q ||
      String(o.title || '').toLowerCase().includes(q) ||
      String(o.companyName || '').toLowerCase().includes(q);
    const matchesStage = statusFilter === 'ALL' || o.stage === statusFilter;
    return matchesSearch && matchesStage;
  });

  // -----------------------------------------------------------------
  // Generic Delete Dialog
  // -----------------------------------------------------------------
  const [itemToDelete, setItemToDelete] = useState(null); // { type, item, name }

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    const { type, item } = itemToDelete;
    if (type === 'lead') {
      try {
        await api.delete(`/companies/${activeCompany.id}/crm/leads/${item.id}`);
        setLeads((current) => current.filter((lead) => lead.id !== item.id));
        showToast('Lead Deleted', `Lead "${item.name}" was removed.`, 'danger');
      } catch (error) {
        showToast('Lead Not Deleted', error.message || 'Could not delete this lead.', 'danger');
      }
    } else if (type === 'customer') {
      try {
        await api.delete(`/companies/${activeCompany.id}/crm/customers/${item.id}`);
        setCustomers((curr) => curr.filter((c) => c.id !== item.id));
        showToast('Customer Removed', `Customer "${item.companyName}" was removed from database.`, 'danger');
      } catch (err) {
        setCustomers((curr) => curr.filter((c) => c.id !== item.id));
        showToast('Customer Removed', `Customer "${item.companyName}" was removed.`, 'danger');
      }
    } else if (type === 'contact') {
      try {
        await api.delete(`/companies/${activeCompany.id}/crm/contacts/${item.id}`);
        setContacts((curr) => curr.filter((c) => c.id !== item.id));
        showToast('Contact Deleted', `Contact "${item.name}" was removed from database.`, 'danger');
      } catch (err) {
        setContacts((curr) => curr.filter((c) => c.id !== item.id));
        showToast('Contact Deleted', `Contact "${item.name}" was removed.`, 'danger');
      }
    } else if (type === 'opportunity') {
      try {
        await api.delete(`/companies/${activeCompany.id}/crm/opportunities/${item.id}`);
        setOpportunities((curr) => curr.filter((o) => o.id !== item.id));
        showToast('Opportunity Removed', `Deal "${item.title}" was removed from database.`, 'danger');
      } catch (err) {
        setOpportunities((curr) => curr.filter((o) => o.id !== item.id));
        showToast('Opportunity Removed', `Deal "${item.title}" was removed.`, 'danger');
      }
    }
    setItemToDelete(null);
  };

  // -----------------------------------------------------------------
  // Badge Helpers
  // -----------------------------------------------------------------
  const renderLeadStatusBadge = (status) => {
    const config = {
      NEW: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
      CONTACTED: { bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' },
      QUALIFIED: { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
      PROPOSAL: { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
      WON: { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
      LOST: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
    }[status] || { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };

    return (
      <span style={{ padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 800, background: config.bg, color: config.color, border: `1px solid ${config.border}` }}>
        {status}
      </span>
    );
  };

  const renderStageBadge = (stage) => {
    const config = {
      DISCOVERY: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
      PROPOSAL: { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
      NEGOTIATION: { bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' },
      WON: { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
      LOST: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
    }[stage] || { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };

    return (
      <span style={{ padding: '3px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 800, background: config.bg, color: config.color, border: `1px solid ${config.border}` }}>
        {stage}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>CRM &amp; Sales Pipeline</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Manage leads, corporate clients, key contacts, and deal opportunities for {activeCompany?.organizationName}
          </p>
        </div>

        {/* Dynamic Action Button based on Active Tab */}
        {activeTab === 'leads' && (
          <button
            type="button"
            onClick={() => setShowAddLeadModal(true)}
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
            <IconPlus size={16} /> Add New Lead
          </button>
        )}

        {activeTab === 'customers' && (
          <button
            type="button"
            onClick={() => setShowAddCustomerModal(true)}
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
            <IconPlus size={16} /> Add Customer
          </button>
        )}

        {activeTab === 'contacts' && (
          <button
            type="button"
            onClick={() => setShowAddContactModal(true)}
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
            <IconPlus size={16} /> Add Contact
          </button>
        )}

        {activeTab === 'opportunities' && (
          <button
            type="button"
            onClick={() => setShowAddOpportunityModal(true)}
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
            <IconPlus size={16} /> New Opportunity
          </button>
        )}
      </div>

      {/* Module Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '0.5rem', flexWrap: 'wrap' }}>
        {isLeadsAllowed && (
          <button
            type="button"
            onClick={() => handleTabChange('leads')}
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: activeTab === 'leads' ? 800 : 600,
              color: activeTab === 'leads' ? '#7f22fe' : '#64748b',
              borderBottom: activeTab === 'leads' ? '2px solid #7f22fe' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            Leads Pipeline ({leads.length})
          </button>
        )}

        {isCustomersAllowed && (
          <button
            type="button"
            onClick={() => handleTabChange('customers')}
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: activeTab === 'customers' ? 800 : 600,
              color: activeTab === 'customers' ? '#7f22fe' : '#64748b',
              borderBottom: activeTab === 'customers' ? '2px solid #7f22fe' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            Customers ({customers.length})
          </button>
        )}

        {isContactsAllowed && (
          <button
            type="button"
            onClick={() => handleTabChange('contacts')}
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: activeTab === 'contacts' ? 800 : 600,
              color: activeTab === 'contacts' ? '#7f22fe' : '#64748b',
              borderBottom: activeTab === 'contacts' ? '2px solid #7f22fe' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            Contacts ({contacts.length})
          </button>
        )}

        {isOpportunitiesAllowed && (
          <button
            type="button"
            onClick={() => handleTabChange('opportunities')}
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: activeTab === 'opportunities' ? 800 : 600,
              color: activeTab === 'opportunities' ? '#7f22fe' : '#64748b',
              borderBottom: activeTab === 'opportunities' ? '2px solid #7f22fe' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            Opportunities ({opportunities.length})
          </button>
        )}

        <button
          type="button"
          onClick={() => handleTabChange('departments')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: activeTab === 'departments' ? 800 : 600,
            color: activeTab === 'departments' ? '#7f22fe' : '#64748b',
            borderBottom: activeTab === 'departments' ? '2px solid #7f22fe' : '2px solid transparent',
            background: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            cursor: 'pointer',
          }}
        >
          <span>🏢</span>
          <span>Department Head</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* DEPARTMENTS TAB CONTENT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'departments' && (
        <ServiceDepartments
          activeCompany={activeCompany}
          serviceCode="crm_sales"
          showToast={showToast}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* LEADS PIPELINE TAB CONTENT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'leads' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Filter Bar */}
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                placeholder="Search leads by contact name, organization, or email..."
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

          {/* Table or Empty State */}
          {leadError ? (
            <div role="alert" style={{ padding: '1.5rem', color: '#991b1b', background: '#fef2f2' }}>
              <p style={{ margin: '0 0 0.75rem' }}>{leadError}</p>
              {activeCompany?.id && (
                <button
                  type="button"
                  onClick={() => setLeadLoadVersion((version) => version + 1)}
                  style={{ padding: '0.45rem 0.8rem', border: '1px solid #fecaca', borderRadius: '6px', background: '#fff', color: '#991b1b', fontWeight: 700, cursor: 'pointer' }}
                >
                  Try again
                </button>
              )}
            </div>
          ) : isLoadingLeads ? (
            <p role="status" style={{ padding: '1.5rem', color: '#64748b', textAlign: 'center' }}>Loading leads...</p>
          ) : filteredLeads.length === 0 ? (
            <EmptyState
              icon="🎯"
              title="No Leads Found"
              description="No incoming business inquiries recorded yet. Click 'Add New Lead' to record a prospect and start qualifying."
              actionLabel="Add New Lead"
              onAction={() => setShowAddLeadModal(true)}
            />
          ) : (
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>Lead Contact</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Organization</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Source</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Deal Value</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Date</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{lead.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{lead.email} {lead.phone ? `• ${lead.phone}` : ''}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                        {lead.company || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {lead.source}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {formatLeadValue(lead.value)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <select
                          value={lead.status}
                          disabled={updatingLeadId === lead.id}
                          onChange={(e) => handleLeadStatusChange(lead.id, e.target.value)}
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
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {lead.date}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => setItemToDelete({ type: 'lead', item: lead, name: lead.name })}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            color: '#dc2626',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            cursor: 'pointer',
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

      {/* ------------------------------------------------------------- */}
      {/* CUSTOMERS TAB CONTENT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'customers' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Filter Bar */}
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                placeholder="Search customers by company name, GSTIN, or contact person..."
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
                <option value="ACTIVE">Active</option>
                <option value="ONBOARDING">Onboarding</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          {filteredCustomers.length === 0 ? (
            <EmptyState
              icon="🏢"
              title="No Customers Registered"
              description="No enterprise client accounts registered under this company yet. Click 'Add Customer' to register a verified client."
              actionLabel="Add Customer"
              onAction={() => setShowAddCustomerModal(true)}
            />
          ) : (
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>Company Name</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>GSTIN / Tax ID</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Primary Contact</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Industry</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((cust) => (
                    <tr key={cust.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{cust.companyName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Added: {cust.createdAt}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', color: '#475569', whiteSpace: 'nowrap' }}>
                        {cust.gstin || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#334155' }}>{cust.contactPerson || '—'}</div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{cust.email} {cust.phone ? `• ${cust.phone}` : ''}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {cust.industry}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '9999px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: cust.status === 'ACTIVE' ? '#ecfdf5' : '#fef3c7',
                          color: cust.status === 'ACTIVE' ? '#065f46' : '#92400e',
                          border: cust.status === 'ACTIVE' ? '1px solid #a7f3d0' : '1px solid #fde68a',
                        }}>
                          {cust.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => setItemToDelete({ type: 'customer', item: cust, name: cust.companyName })}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            color: '#dc2626',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            cursor: 'pointer',
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

      {/* ------------------------------------------------------------- */}
      {/* CONTACTS TAB CONTENT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'contacts' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Filter Bar */}
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                placeholder="Search contacts by name, company, email, or role..."
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
          </div>

          {filteredContacts.length === 0 ? (
            <EmptyState
              icon="👥"
              title="No Contacts Registered"
              description="No key decision makers or client stakeholders registered yet. Click 'Add Contact' to maintain your business communication directory."
              actionLabel="Add Contact"
              onAction={() => setShowAddContactModal(true)}
            />
          ) : (
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>Contact Person</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Client Organization</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Designation / Role</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Contact Channels</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Preferred Channel</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map((cnt) => (
                    <tr key={cnt.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{cnt.name}</div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Added: {cnt.createdAt}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                        {cnt.companyName}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#475569', whiteSpace: 'nowrap' }}>
                        {cnt.role || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '0.82rem', color: '#0f172a' }}>{cnt.email || '—'}</div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{cnt.phone || '—'}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, background: '#f1f5f9', color: '#334155' }}>
                          {cnt.channel}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => setItemToDelete({ type: 'contact', item: cnt, name: cnt.name })}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            color: '#dc2626',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            cursor: 'pointer',
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

      {/* ------------------------------------------------------------- */}
      {/* OPPORTUNITIES (DEALS) TAB CONTENT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'opportunities' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Filter Bar */}
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                placeholder="Search deal opportunities by title or company..."
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
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Stage:</span>
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
                <option value="ALL">All Stages</option>
                <option value="DISCOVERY">Discovery</option>
                <option value="PROPOSAL">Proposal Sent</option>
                <option value="NEGOTIATION">Negotiation</option>
                <option value="WON">Closed Won</option>
                <option value="LOST">Closed Lost</option>
              </select>
            </div>
          </div>

          {filteredOpportunities.length === 0 ? (
            <EmptyState
              icon="💼"
              title="No Deal Opportunities"
              description="No active sales deals or contract opportunities in the pipeline yet. Click 'New Opportunity' to start tracking a revenue engagement."
              actionLabel="New Opportunity"
              onAction={() => setShowAddOpportunityModal(true)}
            />
          ) : (
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>Opportunity / Deal</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Client Organization</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Stage</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Estimated Value</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Win Probability</th>
                    <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Target Closing</th>
                    <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOpportunities.map((opp) => (
                    <tr key={opp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 800, color: '#7f22fe' }}>{opp.title}</div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Created: {opp.createdAt}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {opp.companyName}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <select
                          value={opp.stage}
                          onChange={(e) => handleOpportunityStageChange(opp.id, e.target.value)}
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
                          <option value="DISCOVERY">DISCOVERY</option>
                          <option value="PROPOSAL">PROPOSAL</option>
                          <option value="NEGOTIATION">NEGOTIATION</option>
                          <option value="WON">WON</option>
                          <option value="LOST">LOST</option>
                        </select>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {opp.value || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#16a34a', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {opp.probability}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {opp.expectedCloseDate || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => setItemToDelete({ type: 'opportunity', item: opp, name: opp.title })}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            color: '#dc2626',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            cursor: 'pointer',
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

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: CREATE LEAD */}
      {/* ------------------------------------------------------------- */}
      <Modal isOpen={showAddLeadModal} onClose={() => setShowAddLeadModal(false)} title="Create New CRM Lead">
        <form onSubmit={handleCreateLead} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
              Contact Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Kulkarni"
              value={newLeadForm.name}
              onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Company / Organization
              </label>
              <input
                type="text"
                placeholder="e.g. Kulkarni Enterprises"
                value={newLeadForm.company}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, company: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="ramesh@example.com"
                value={newLeadForm.email}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Phone Number
              </label>
              <input
                type="text"
                placeholder="+91 98765 00000"
                value={newLeadForm.phone}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Estimated Deal Value
              </label>
              <input
                type="text"
                placeholder="e.g. ₹ 3,50,000"
                value={newLeadForm.value}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, value: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
              Lead Source
            </label>
            <input
              type="text"
              maxLength={100}
              placeholder="e.g. Website Inquiry"
              value={newLeadForm.source}
              onChange={(e) => setNewLeadForm({ ...newLeadForm, source: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => setShowAddLeadModal(false)}
              style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingLead}
              style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#7f22fe', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
            >
              {isSavingLead ? 'Saving...' : 'Save Lead'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: CREATE CUSTOMER */}
      {/* ------------------------------------------------------------- */}
      <Modal isOpen={showAddCustomerModal} onClose={() => setShowAddCustomerModal(false)} title="Register Corporate Customer">
        <form onSubmit={handleCreateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
              Company / Account Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Mahindra Logistics Ltd"
              value={customerForm.companyName}
              onChange={(e) => setCustomerForm({ ...customerForm, companyName: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                GSTIN / Tax Registration No
              </label>
              <input
                type="text"
                placeholder="e.g. 27AABCM1234F1Z9"
                value={customerForm.gstin}
                onChange={(e) => setCustomerForm({ ...customerForm, gstin: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Industry / Domain
              </label>
              <select
                value={customerForm.industry}
                onChange={(e) => setCustomerForm({ ...customerForm, industry: e.target.value })}
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
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Primary Contact Person
              </label>
              <input
                type="text"
                placeholder="e.g. Anand Mahindra"
                value={customerForm.contactPerson}
                onChange={(e) => setCustomerForm({ ...customerForm, contactPerson: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Official Email Address
              </label>
              <input
                type="email"
                placeholder="procurement@mahindra.com"
                value={customerForm.email}
                onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => setShowAddCustomerModal(false)}
              style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#7f22fe', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
            >
              Save Customer
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: CREATE CONTACT */}
      {/* ------------------------------------------------------------- */}
      <Modal isOpen={showAddContactModal} onClose={() => setShowAddContactModal(false)} title="Register Business Contact">
        <form onSubmit={handleCreateContact} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Contact Person Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Priya Sharma"
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Company / Organization *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Apex Technologies"
                value={contactForm.companyName}
                onChange={(e) => setContactForm({ ...contactForm, companyName: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Designation / Job Title
              </label>
              <input
                type="text"
                placeholder="e.g. Head of Procurement"
                value={contactForm.role}
                onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Preferred Channel
              </label>
              <select
                value={contactForm.channel}
                onChange={(e) => setContactForm({ ...contactForm, channel: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}
              >
                <option value="Email">Email</option>
                <option value="Phone Call">Phone Call</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Direct Meeting">Direct Meeting</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="priya@example.com"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Mobile / Phone
              </label>
              <input
                type="text"
                placeholder="+91 98200 00000"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => setShowAddContactModal(false)}
              style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#7f22fe', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
            >
              Save Contact
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: CREATE OPPORTUNITY */}
      {/* ------------------------------------------------------------- */}
      <Modal isOpen={showAddOpportunityModal} onClose={() => setShowAddOpportunityModal(false)} title="Create Deal Opportunity">
        <form onSubmit={handleCreateOpportunity} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Opportunity / Deal Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Annual ERP Enterprise Licensing"
              value={opportunityForm.title}
              onChange={(e) => setOpportunityForm({ ...opportunityForm, title: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Client / Company *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Tata Motors Ltd"
                value={opportunityForm.companyName}
                onChange={(e) => setOpportunityForm({ ...opportunityForm, companyName: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Pipeline Stage
              </label>
              <select
                value={opportunityForm.stage}
                onChange={(e) => setOpportunityForm({ ...opportunityForm, stage: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}
              >
                <option value="DISCOVERY">Discovery / Initial Contact</option>
                <option value="PROPOSAL">Proposal / Quote Sent</option>
                <option value="NEGOTIATION">Commercial Negotiation</option>
                <option value="WON">Closed Won</option>
                <option value="LOST">Closed Lost</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Estimated Deal Value
              </label>
              <input
                type="text"
                placeholder="e.g. ₹ 12,50,000"
                value={opportunityForm.value}
                onChange={(e) => setOpportunityForm({ ...opportunityForm, value: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Win Probability
              </label>
              <select
                value={opportunityForm.probability}
                onChange={(e) => setOpportunityForm({ ...opportunityForm, probability: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}
              >
                <option value="25%">25% (Early Stage)</option>
                <option value="50%">50% (Proposal Active)</option>
                <option value="75%">75% (Shortlisted / Verbal)</option>
                <option value="90%">90% (Final Legal Review)</option>
                <option value="100%">100% (Signed)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Target Closing Date
              </label>
              <input
                type="date"
                value={opportunityForm.expectedCloseDate}
                onChange={(e) => setOpportunityForm({ ...opportunityForm, expectedCloseDate: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => setShowAddOpportunityModal(false)}
              style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#7f22fe', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
            >
              Save Opportunity
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* DELETE CONFIRMATION DIALOG */}
      {/* ------------------------------------------------------------- */}
      <ConfirmDialog
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={`Delete ${itemToDelete?.type?.toUpperCase()}?`}
        message={`Are you sure you want to delete "${itemToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Confirm Delete"
        isDanger={true}
      />
    </div>
  );
}

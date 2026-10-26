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
import LeadIntegrationsModal from '../crm/LeadIntegrationsModal';
import { useCompanyAuth } from '../../hooks/useCompanyAuth';

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
  const { currentUser } = useCompanyAuth();

  // Route map for top tabs
  const TAB_ROUTES = {
    leads: '/crm/leads',
    customers: '/crm/customers',
    contacts: '/crm/contacts',
    opportunities: '/crm/opportunities',
    departments: '/services/crm-sales/department-head',
  };

  // Permission checks for viewing screens
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

  // Granular action-level permission checking:
  // Employees can VIEW all modules across the team for pipeline visibility,
  // but can only PERFORM WORK / ACTIONS (create, edit, delete, status change) if assigned!
  const canPerformAction = (featureKey) => {
    const role = currentUser?.role || currentUser?.accessRole;
    if (
      !role ||
      role === 'SUPER_ADMIN' ||
      role === 'COMPANY_ADMIN' ||
      role === 'DEPARTMENT_HEAD' ||
      role === 'SERVICE_HEAD' ||
      role === 'TEAM_LEADER'
    ) {
      return true;
    }

    if (role === 'EMPLOYEE' && typeof hasSubModuleAccess === 'function') {
      const featureAliases = {
        leads: ['leads', '/crm/leads', 'crm_leads'],
        customers: ['customers', '/crm/customers', 'crm_customers'],
        contacts: ['contacts', '/crm/contacts', 'crm_contacts'],
        opportunities: ['opportunities', '/crm/opportunities', 'crm_followups'],
      };
      return (featureAliases[featureKey] || [featureKey])
        .some((alias) => hasSubModuleAccess(alias));
    }

    const featureAccess = currentUser?.permissions?.featureAccess;
    if (!featureAccess) return true;

    const moduleIds = Array.isArray(featureAccess.moduleIds) ? featureAccess.moduleIds.map(String) : [];
    const subModuleIds = Array.isArray(featureAccess.subModuleIds) ? featureAccess.subModuleIds.map(String) : [];

    // If both arrays are empty, employee is view-only
    if (moduleIds.length === 0 && subModuleIds.length === 0) {
      return false;
    }

    if (moduleIds.includes('crm') || moduleIds.includes('75a55710-cea5-11f1-9511-b05cda618678')) {
      return true;
    }

    const KEY_MAP = {
      leads: ['crm_leads', 'leads', '75a5bf39-cea5-11f1-9511-b05cda618678'],
      customers: ['crm_customers', 'customers', '75a5e4f8-cea5-11f1-9511-b05cda618678'],
      contacts: ['crm_contacts', 'contacts', '75a5e73f-cea5-11f1-9511-b05cda618678'],
      opportunities: ['crm_followups', 'opportunities', 'followups', '75a5e896-cea5-11f1-9511-b05cda618678'],
    };

    const targetList = KEY_MAP[featureKey] || [featureKey];
    return targetList.some((target) => subModuleIds.includes(target) || moduleIds.includes(target));
  };

  // Active tab state
  const [activeTab, setActiveTab] = useState(initialSubTab || 'leads');

  useEffect(() => {
    if (initialSubTab) {
      if (activeTab !== initialSubTab) {
        setActiveTab(initialSubTab);
      }
    } else if (pathname) {
      let resolved = 'leads';
      if (pathname.includes('/crm/customers')) resolved = 'customers';
      else if (pathname.includes('/crm/contacts')) resolved = 'contacts';
      else if (pathname.includes('/crm/opportunities')) resolved = 'opportunities';
      else if (pathname.includes('/departments')) resolved = 'departments';
      if (activeTab !== resolved) {
        setActiveTab(resolved);
      }
    }
  }, [initialSubTab, pathname, activeTab]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Switch tab and immediately synchronize browser URL route so sidebar updates
  const handleTabChange = (newTab) => {
    if (activeTab === newTab) return;
    setActiveTab(newTab);
    setSearchQuery('');
    setStatusFilter('ALL');

    const targetRoute = TAB_ROUTES[newTab];
    if (targetRoute && pathname !== targetRoute) {
      router.push(targetRoute, { scroll: false });
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
  const [showIntegrationsModal, setShowIntegrationsModal] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [isSyncingIndiaMart, setIsSyncingIndiaMart] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    source: 'Manual',
    value: '',
    requirements: '',
    assignedTo: '',
    status: 'NEW',
  });
  const [leadIntegrations, setLeadIntegrations] = useState([]);

  useEffect(() => {
    if (!activeCompany?.id || (currentUser?.role === 'EMPLOYEE' && !isLeadsAllowed)) return;
    let isCurrent = true;
    const fetchLeadIntegrations = async () => {
      try {
        const res = await api.get(`/companies/${activeCompany.id}/crm/lead-integrations`);
        if (isCurrent && res.data) {
          setLeadIntegrations(res.data);
        }
      } catch {}
    };
    fetchLeadIntegrations();
    return () => { isCurrent = false; };
  }, [activeCompany?.id, currentUser?.role, isLeadsAllowed, leadLoadVersion]);

  // Only channels that were configured and activated by Super Admin
  const activeLeadChannels = leadIntegrations.filter(
    (item) => item.status === 'ACTIVE' && item.configured
  );

  const PROVIDER_SOURCE_META = {
    INDIAMART: { label: 'IndiaMART', icon: '🇮🇳' },
    META_FACEBOOK: { label: 'Facebook Ads', icon: '📘' },
    META_INSTAGRAM: { label: 'Instagram', icon: '📸' },
    WEBSITE_WEBHOOK: { label: 'Website Inquiry', icon: '🌐' },
    GMAIL: { label: 'Email Inquiry', icon: '✉️' },
    JUSTDIAL: { label: 'JustDial', icon: '📞' },
  };

  const availableLeadSources = [
    { value: 'Manual', label: '👤 Manual (Direct / Self-Created)' },
    ...activeLeadChannels.map((channel) => {
      const meta = PROVIDER_SOURCE_META[channel.id] || {
        label: channel.name || channel.id,
        icon: channel.icon || '🔗',
      };
      return {
        value: meta.label,
        label: `${meta.icon} ${meta.label}`,
      };
    }),
  ];

  const isIndiaMartActive = activeLeadChannels.some(
    (item) => item.id === 'INDIAMART'
  );

  const handleQuickSyncIndiaMart = async () => {
    if (!activeCompany?.id) return;
    setIsSyncingIndiaMart(true);
    try {
      const res = await api.post(`/companies/${activeCompany.id}/crm/lead-integrations/sync-indiamart`, {});
      if (showToast) {
        showToast('IndiaMART Sync Complete! 🇮🇳', res.message || 'Leads synchronized.', 'success');
      }
      setLeadLoadVersion((v) => v + 1);
    } catch (err) {
      if (showToast) {
        showToast('IndiaMART Sync Notice', err.message || 'Configure your IndiaMART CRM Key first.', 'danger');
      }
    } finally {
      setIsSyncingIndiaMart(false);
    }
  };

  const renderLeadSourceBadge = (source = '') => {
    const s = String(source || '').toLowerCase();
    if (s.includes('indiamart')) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}>
          <span>🇮🇳</span> IndiaMART
        </span>
      );
    }
    if (s.includes('facebook')) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700, background: '#eff6ff', color: '#1877f2', border: '1px solid #c7d2fe', whiteSpace: 'nowrap' }}>
          <span>📘</span> Facebook
        </span>
      );
    }
    if (s.includes('instagram')) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700, background: '#fdf2f8', color: '#db2777', border: '1px solid #fbcfe8', whiteSpace: 'nowrap' }}>
          <span>📸</span> Instagram
        </span>
      );
    }
    if (s.includes('website') || s.includes('webhook')) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', whiteSpace: 'nowrap' }}>
          <span>🌐</span> Website Form
        </span>
      );
    }
    if (s.includes('mail')) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', whiteSpace: 'nowrap' }}>
          <span>✉️</span> Email
        </span>
      );
    }
    if (s.includes('justdial')) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700, background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', whiteSpace: 'nowrap' }}>
          <span>📞</span> JustDial
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 600, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
        <span>👤</span> {source || 'Manual'}
      </span>
    );
  };

  useEffect(() => {
    let isCurrent = true;
    const loadLeads = async () => {
      if (!activeCompany?.id || (currentUser?.role === 'EMPLOYEE' && !isLeadsAllowed)) {
        setLeads([]);
        setIsLoadingLeads(false);
        setLeadError(activeCompany?.id ? '' : 'Choose a company workspace to view leads.');
        return;
      }
      if (leads.length === 0) {
        setIsLoadingLeads(true);
      }
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
  }, [activeCompany?.id, currentUser?.role, isLeadsAllowed, leadLoadVersion]);

  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!newLeadForm.name || !newLeadForm.email) {
      showToast('Validation Error', 'Lead contact name and email are required.', 'danger');
      return;
    }
    if (newLeadForm.phone && newLeadForm.phone.length !== 10) {
      showToast('Validation Error', 'Phone number must be exactly 10 digits.', 'danger');
      return;
    }
    setIsSavingLead(true);
    try {
      const response = await api.post(
        `/companies/${activeCompany.id}/crm/leads`,
        {
          ...newLeadForm,
          source: newLeadForm.source || 'Manual',
        }
      );
      setLeads((current) => [response.data, ...current]);
      setShowAddLeadModal(false);
      setNewLeadForm({ name: '', company: '', email: '', phone: '', source: 'Manual', value: '', requirements: '', assignedTo: '', status: 'NEW' });
      showToast('Lead Created! 🎯', `Lead "${response.data.name}" added to pipeline.`, 'success');
    } catch (error) {
      showToast('Lead Not Created', error.message || 'Could not create this lead.', 'danger');
    } finally {
      setIsSavingLead(false);
    }
  };

  const [viewingLead, setViewingLead] = useState(null);

  const handleLeadStatusChange = async (id, newStatus) => {
    setUpdatingLeadId(id);
    try {
      const response = await api.patch(
        `/companies/${activeCompany.id}/crm/leads/${id}`,
        { status: newStatus }
      );
      setLeads((current) => current.map((lead) => lead.id === id ? response.data : lead));
      if (viewingLead && viewingLead.id === id) {
        setViewingLead(response.data);
      }
      const labelMap = {
        CONTACTED: 'In Discussion / Contacted',
        QUALIFIED: 'Approved / Qualified',
        LOST: 'Rejected / Lost',
        WON: 'Converted to Customer',
        NEW: 'New Lead',
      };
      showToast('Status Updated', `Lead status changed to "${labelMap[newStatus] || newStatus}".`, 'success');
      return response.data;
    } catch (error) {
      showToast('Status Not Updated', error.message || 'Could not update this lead.', 'danger');
      return null;
    } finally {
      setUpdatingLeadId(null);
    }
  };

  const handleApproveAndConvert = async (lead) => {
    await handleLeadStatusChange(lead.id, 'QUALIFIED');
    setViewingLead(null);
    handleOpenConvertModal({ ...lead, status: 'QUALIFIED' });
  };

  // Convert Lead to Customer state & handlers
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [leadToConvert, setLeadToConvert] = useState(null);
  const [isConvertingLead, setIsConvertingLead] = useState(false);
  const [convertForm, setConvertForm] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    gstin: '',
    industry: 'Technology & IT',
    requirements: '',
    assignedTo: '',
  });

  const handleOpenConvertModal = (lead) => {
    setLeadToConvert(lead);
    setConvertForm({
      companyName: lead.company?.trim() || lead.name?.trim() || '',
      contactPerson: lead.name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      gstin: '',
      industry: 'Technology & IT',
      requirements: lead.requirements || '',
      assignedTo: lead.assignedTo || '',
    });
    setShowConvertModal(true);
  };

  const handleConvertLeadToCustomer = async (e) => {
    e.preventDefault();
    if (!convertForm.companyName.trim()) {
      showToast('Validation Error', 'Company / Account name is required.', 'danger');
      return;
    }
    setIsConvertingLead(true);
    try {
      // Use dedicated lead convert endpoint (requires crm_leads access, no cross-module 403!)
      const res = await api.post(
        `/companies/${activeCompany.id}/crm/leads/${leadToConvert.id}/convert`,
        convertForm
      );

      const convertedLead = res.data?.data?.lead || { ...leadToConvert, status: 'WON' };
      const createdCustomer = res.data?.data?.customer;

      // 1. Update lead in local state so status immediately displays WON
      setLeads((current) => current.map((l) => (l.id === leadToConvert.id ? convertedLead : l)));

      // 2. Update customer state if returned
      if (createdCustomer) {
        setCustomers((current) => [createdCustomer, ...current]);
        if (createdCustomer.createdContact) {
          setContacts((current) => [createdCustomer.createdContact, ...current]);
        }
      }

      setShowConvertModal(false);
      const targetName = convertForm.companyName;
      setLeadToConvert(null);
      if (viewingLead?.id === leadToConvert.id) {
        setViewingLead(null);
      }

      showToast(
        'Lead Converted! 🏢',
        `"${targetName}" successfully converted into a Customer account and marked as WON.`,
        'success'
      );

      // 3. Switch to Customers tab only if employee has customer viewing permission!
      if (canPerformAction('customers')) {
        handleTabChange('customers');
      }
    } catch (err) {
      showToast('Conversion Failed', err.message || 'Could not convert lead to customer.', 'danger');
    } finally {
      setIsConvertingLead(false);
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
    const matchesSource = sourceFilter === 'ALL' || String(l.source || '').toLowerCase().includes(sourceFilter.toLowerCase());
    return matchesSearch && matchesStatus && matchesSource;
  });

  // -----------------------------------------------------------------
  // 2. CUSTOMERS (CORPORATE CLIENTS)
  // -----------------------------------------------------------------
  const [customers, setCustomers] = useState([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState(null);
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
    if (customers.length === 0) {
      setIsLoadingCustomers(true);
    }
    if (!activeCompany?.id || (currentUser?.role === 'EMPLOYEE' && !isCustomersAllowed)) return;
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
    if (contacts.length === 0) {
      setIsLoadingContacts(true);
    }
    if (!activeCompany?.id || (currentUser?.role === 'EMPLOYEE' && !isContactsAllowed)) return;
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
    if (opportunities.length === 0) {
      setIsLoadingOpportunities(true);
    }
    if (!activeCompany?.id || (currentUser?.role === 'EMPLOYEE' && !isOpportunitiesAllowed)) return;
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
      NEW: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: '🔵 New' },
      CONTACTED: { bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe', label: '🟣 Contacted' },
      QUALIFIED: { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0', label: '🟢 Qualified' },
      PROPOSAL: { bg: '#fffbeb', color: '#b45309', border: '#fde68a', label: '🟡 Proposal' },
      WON: { bg: '#dcfce7', color: '#15803d', border: '#86efac', label: '✅ Customer (Won)' },
      LOST: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', label: '❌ Lost' },
    }[status] || { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', label: status };

    return (
      <span style={{ padding: '4px 10px', borderRadius: '9999px', fontSize: '0.74rem', fontWeight: 800, background: config.bg, color: config.color, border: `1px solid ${config.border}`, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
        {config.label || status}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            {/* Render Lead Channels modal trigger ONLY if Super Admin has activated channels */}
            {activeLeadChannels.length > 0 && (
              <button
                type="button"
                onClick={() => setShowIntegrationsModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.62rem 1.1rem',
                  background: '#ffffff',
                  color: '#7f22fe',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  border: '1px solid #c4b5fd',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease',
                }}
                title={`${activeLeadChannels.length} active lead channels provisioned by Super Admin`}
              >
                <span>⚡</span> Connected Channels ({activeLeadChannels.length})
              </button>
            )}

            {/* Render IndiaMART quick sync button ONLY if IndiaMART is provisioned & active by Super Admin */}
            {isIndiaMartActive && (
              <button
                type="button"
                onClick={handleQuickSyncIndiaMart}
                disabled={isSyncingIndiaMart}
                title="Click to fetch latest buyer inquiries from IndiaMART"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.62rem 1.1rem',
                  background: '#005b9f',
                  color: '#ffffff',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  border: 'none',
                  cursor: isSyncingIndiaMart ? 'wait' : 'pointer',
                  boxShadow: '0 2px 6px rgba(0, 91, 159, 0.25)',
                }}
              >
                <span>🇮🇳</span> {isSyncingIndiaMart ? 'Syncing...' : 'Sync IndiaMART'}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (!canPerformAction('leads')) {
                  showToast('View Only Mode', 'You have view-only access to Leads. Modification is assigned to another team member.', 'danger');
                  return;
                }
                setShowAddLeadModal(true);
              }}
              title={!canPerformAction('leads') ? '🔒 View Only: You can view leads, but only assigned team members can create or edit leads.' : 'Add New Lead'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.25rem',
                background: !canPerformAction('leads') ? '#94a3b8' : '#7f22fe',
                color: '#ffffff',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.86rem',
                boxShadow: !canPerformAction('leads') ? 'none' : '0 4px 6px rgba(127, 34, 254, 0.25)',
                border: 'none',
                cursor: !canPerformAction('leads') ? 'not-allowed' : 'pointer',
                opacity: !canPerformAction('leads') ? 0.8 : 1,
              }}
            >
              {!canPerformAction('leads') ? '🔒 View Only' : <><IconPlus size={16} /> Add New Lead</>}
            </button>
          </div>
        )}

        {activeTab === 'customers' && (
          <button
            type="button"
            onClick={() => {
              if (!canPerformAction('customers')) {
                showToast('View Only Mode', 'You have view-only access to Customers. Modification is assigned to another team member.', 'danger');
                return;
              }
              setShowAddCustomerModal(true);
            }}
            title={!canPerformAction('customers') ? '🔒 View Only: Customer registration is restricted to assigned team members.' : 'Add Customer'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              background: !canPerformAction('customers') ? '#94a3b8' : '#7f22fe',
              color: '#ffffff',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.86rem',
              boxShadow: !canPerformAction('customers') ? 'none' : '0 4px 6px rgba(127, 34, 254, 0.25)',
              border: 'none',
              cursor: !canPerformAction('customers') ? 'not-allowed' : 'pointer',
              opacity: !canPerformAction('customers') ? 0.8 : 1,
            }}
          >
            {!canPerformAction('customers') ? '🔒 View Only' : <><IconPlus size={16} /> Add Customer</>}
          </button>
        )}

        {activeTab === 'contacts' && (
          <button
            type="button"
            onClick={() => {
              if (!canPerformAction('contacts')) {
                showToast('View Only Mode', 'You have view-only access to Contacts. Modification is assigned to another team member.', 'danger');
                return;
              }
              setShowAddContactModal(true);
            }}
            title={!canPerformAction('contacts') ? '🔒 View Only: Contact management is restricted to assigned team members.' : 'Add Contact'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              background: !canPerformAction('contacts') ? '#94a3b8' : '#7f22fe',
              color: '#ffffff',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.86rem',
              boxShadow: !canPerformAction('contacts') ? 'none' : '0 4px 6px rgba(127, 34, 254, 0.25)',
              border: 'none',
              cursor: !canPerformAction('contacts') ? 'not-allowed' : 'pointer',
              opacity: !canPerformAction('contacts') ? 0.8 : 1,
            }}
          >
            {!canPerformAction('contacts') ? '🔒 View Only' : <><IconPlus size={16} /> Add Contact</>}
          </button>
        )}

        {activeTab === 'opportunities' && (
          <button
            type="button"
            onClick={() => {
              if (!canPerformAction('opportunities')) {
                showToast('View Only Mode', 'You have view-only access to Opportunities. Modification is assigned to another team member.', 'danger');
                return;
              }
              setShowAddOpportunityModal(true);
            }}
            title={!canPerformAction('opportunities') ? '🔒 View Only: Deal opportunity creation is restricted to assigned team members.' : 'New Opportunity'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              background: !canPerformAction('opportunities') ? '#94a3b8' : '#7f22fe',
              color: '#ffffff',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.86rem',
              boxShadow: !canPerformAction('opportunities') ? 'none' : '0 4px 6px rgba(127, 34, 254, 0.25)',
              border: 'none',
              cursor: !canPerformAction('opportunities') ? 'not-allowed' : 'pointer',
              opacity: !canPerformAction('opportunities') ? 0.8 : 1,
            }}
          >
            {!canPerformAction('opportunities') ? '🔒 View Only' : <><IconPlus size={16} /> New Opportunity</>}
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

        {currentUser?.role !== 'EMPLOYEE' && (
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
        )}
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
          {!canPerformAction('leads') && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.65rem 1.25rem',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              color: '#475569',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}>
              <span>👁️</span>
              <span>
                <strong>Team View-Only Access:</strong> You can view all company leads for visibility and pipeline tracking. Creating, editing, or deleting leads is restricted to authorized team members.
              </span>
            </div>
          )}

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

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Source:</span>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  style={{
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    background: '#ffffff',
                  }}
                >
                  <option value="ALL">All Sources</option>
                  <option value="manual">👤 Manual</option>
                  <option value="indiamart">🇮🇳 IndiaMART</option>
                  <option value="facebook">📘 Facebook</option>
                  <option value="instagram">📸 Instagram</option>
                  <option value="website">🌐 Website Form</option>
                  <option value="mail">✉️ Email</option>
                  <option value="justdial">📞 JustDial</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
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
                    <tr
                      key={lead.id}
                      onClick={() => setViewingLead(lead)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
                      title="Click to view full lead details and discussion actions"
                    >
                      <td style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>{lead.name}</span>
                          <span style={{ fontSize: '0.68rem', color: '#7c3aed', background: '#f5f3ff', padding: '1px 6px', borderRadius: '4px', border: '1px solid #ddd6fe' }}>
                            View 👁️
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{lead.email} {lead.phone ? `• ${lead.phone}` : ''}</div>
                        {lead.assignedTo && (
                          <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600, marginTop: '2px' }}>
                            👤 Rep: {lead.assignedTo}
                          </div>
                        )}
                        {lead.requirements && (
                          <div style={{ fontSize: '0.72rem', color: '#6b21a8', marginTop: '3px', background: '#f5f3ff', padding: '2px 6px', borderRadius: '4px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lead.requirements}>
                            📝 Req: {lead.requirements}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                        {lead.company || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        {renderLeadSourceBadge(lead.source)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {formatLeadValue(lead.value)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        {renderLeadStatusBadge(lead.status)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {lead.date}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingLead(lead);
                            }}
                            title="Click to view details and discussion history"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.38rem 0.65rem',
                              borderRadius: '6px',
                              background: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <span>👁️</span> Details
                          </button>

                          {canPerformAction('leads') && (
                            lead.status === 'WON' ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (canPerformAction('customers')) {
                                    handleTabChange('customers');
                                  } else {
                                    setViewingLead(lead);
                                  }
                                }}
                                title="Lead converted! Click to view in Customers tab"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  padding: '0.38rem 0.75rem',
                                  borderRadius: '6px',
                                  background: '#ecfdf5',
                                  color: '#059669',
                                  border: '1px solid #a7f3d0',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                <span>✓</span> Customer ➡️
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenConvertModal(lead);
                                }}
                                title="Click to promote this lead to an official Customer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  padding: '0.38rem 0.8rem',
                                  borderRadius: '6px',
                                  background: '#7f22fe',
                                  color: '#ffffff',
                                  border: 'none',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 4px rgba(127, 34, 254, 0.25)',
                                }}
                              >
                                <span>🏢</span> Convert
                              </button>
                            )
                          )}

                          {canPerformAction('leads') ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setItemToDelete({ type: 'lead', item: lead, name: lead.name });
                              }}
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
                          ) : (
                            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>🔒 View Only</span>
                          )}
                        </div>
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
          {!canPerformAction('customers') && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.65rem 1.25rem',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              color: '#475569',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}>
              <span>👁️</span>
              <span>
                <strong>Team View-Only Access:</strong> You can view all company customer accounts for visibility. Registering or deleting customers is restricted to authorized team members.
              </span>
            </div>
          )}

          {/* Sales Workflow Guidance Banner */}
          <div style={{
            margin: '1.25rem 1.25rem 0.5rem 1.25rem',
            padding: '1rem 1.25rem',
            background: 'linear-gradient(135deg, #f5f0ff 0%, #eff6ff 100%)',
            borderRadius: '10px',
            border: '1px solid #ebdfff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '1.15rem' }}>🏢</span>
                <span style={{ fontSize: '0.94rem', fontWeight: 800, color: '#1e1b4b' }}>
                  Verified Customer Directory &amp; Sales Pipeline
                </span>
                <span style={{ padding: '2px 8px', borderRadius: '9999px', background: '#dcfce7', color: '#15803d', fontSize: '0.72rem', fontWeight: 800 }}>
                  {customers.length} Accounts Active
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
                Lead convert hone ke baad customer yahan add ho jata hai. Ab aap yahan se direct customer ko <strong>Quotation</strong> bhej sakte hain aur <strong>Sales Order</strong> issue kar sakte hain.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => router.push('/sales/quotations')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.9rem',
                  borderRadius: '6px',
                  background: '#ffffff',
                  color: '#7f22fe',
                  border: '1px solid #ddd6fe',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                <span>📄</span> All Quotations ➡️
              </button>
              <button
                type="button"
                onClick={() => router.push('/sales/orders')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.9rem',
                  borderRadius: '6px',
                  background: '#7f22fe',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(127, 34, 254, 0.25)',
                }}
              >
                <span>🛒</span> All Sales Orders ➡️
              </button>
            </div>
          </div>

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
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          Added: {cust.createdAt ? new Date(cust.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', color: '#475569', whiteSpace: 'nowrap' }}>
                        {cust.gstin || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#334155' }}>{cust.contactPerson || '—'}</div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{cust.email} {cust.phone ? `• ${cust.phone}` : ''}</div>
                        {cust.assignedTo && (
                          <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600, marginTop: '2px' }}>
                            👤 Rep: {cust.assignedTo}
                          </div>
                        )}
                        {cust.requirements && (
                          <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '3px', background: '#f8fafc', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cust.requirements}>
                            📝 Req: {cust.requirements}
                          </div>
                        )}
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
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => router.push(`/sales/quotations?customer=${encodeURIComponent(cust.companyName)}`)}
                            title="Generate Quotation for this Customer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.35rem 0.65rem',
                              borderRadius: '6px',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <span>📄</span> Quote
                          </button>

                          <button
                            type="button"
                            onClick={() => router.push(`/sales/orders?customer=${encodeURIComponent(cust.companyName)}`)}
                            title="Create Sales Order for this Customer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.35rem 0.65rem',
                              borderRadius: '6px',
                              background: '#f5f3ff',
                              color: '#6d28d9',
                              border: '1px solid #ddd6fe',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <span>🛒</span> Order
                          </button>

                          <button
                            type="button"
                            onClick={() => setViewingCustomer(cust)}
                            title="View Customer Profile & Details"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.35rem 0.65rem',
                              borderRadius: '6px',
                              background: '#ffffff',
                              color: '#475569',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <span>👁️</span> Details
                          </button>

                          {canPerformAction('customers') ? (
                            <button
                              type="button"
                              onClick={() => setItemToDelete({ type: 'customer', item: cust, name: cust.companyName })}
                              style={{
                                padding: '0.35rem 0.55rem',
                                borderRadius: '6px',
                                color: '#dc2626',
                                fontSize: '0.74rem',
                                fontWeight: 600,
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                cursor: 'pointer',
                              }}
                            >
                              Delete
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>🔒 View Only</span>
                          )}
                        </div>
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
          {!canPerformAction('contacts') && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.65rem 1.25rem',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              color: '#475569',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}>
              <span>👁️</span>
              <span>
                <strong>Team View-Only Access:</strong> You can view all company contacts for stakeholder collaboration. Adding or deleting contacts is restricted to authorized team members.
              </span>
            </div>
          )}

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
                        {canPerformAction('contacts') ? (
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
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>🔒 View Only</span>
                        )}
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
          {!canPerformAction('opportunities') && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.65rem 1.25rem',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              color: '#475569',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}>
              <span>👁️</span>
              <span>
                <strong>Team View-Only Access:</strong> You can view all deals in the revenue pipeline. Modifying stages or creating deals is restricted to authorized team members.
              </span>
            </div>
          )}

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
                        {canPerformAction('opportunities') ? (
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
                        ) : (
                          renderStageBadge(opp.stage)
                        )}
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
                        {canPerformAction('opportunities') ? (
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
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>🔒 View Only</span>
                        )}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                  Phone Number
                </label>
                <span style={{ fontSize: '0.72rem', color: newLeadForm.phone?.length === 10 ? '#10b981' : '#64748b' }}>
                  {newLeadForm.phone ? `${newLeadForm.phone.length}/10` : '10 digits'}
                </span>
              </div>
              <input
                type="tel"
                maxLength={10}
                placeholder="e.g. 9876500000"
                value={newLeadForm.phone}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setNewLeadForm({ ...newLeadForm, phone: cleaned });
                }}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
              />
              {newLeadForm.phone && newLeadForm.phone.length > 0 && newLeadForm.phone.length < 10 && (
                <span style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '0.25rem', display: 'block' }}>
                  Please enter 10 digits ({newLeadForm.phone.length}/10 entered)
                </span>
              )}
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
            <select
              value={availableLeadSources.some((s) => s.value === newLeadForm.source) ? newLeadForm.source : 'Manual'}
              onChange={(e) => setNewLeadForm({ ...newLeadForm, source: e.target.value })}
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#0f172a',
                fontSize: '0.88rem',
                cursor: 'pointer',
              }}
            >
              {availableLeadSources.map((sourceItem) => (
                <option key={sourceItem.value} value={sourceItem.value}>
                  {sourceItem.label}
                </option>
              ))}
            </select>
            {activeLeadChannels.length === 0 ? (
              <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                Only Manual is active. Connected sources (IndiaMART, Facebook, Webhooks, etc.) will appear here when active.
              </span>
            ) : (
              <span style={{ fontSize: '0.72rem', color: '#10b981', marginTop: '0.25rem', display: 'block' }}>
                ✓ {activeLeadChannels.length} active channel{activeLeadChannels.length > 1 ? 's' : ''} connected
              </span>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
              Customer Requirement / Product Specifics
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Inquired for 50 Units of Laptops (Core i7, 16GB RAM) + 50 Wireless Mice. Required by next week."
              value={newLeadForm.requirements}
              onChange={(e) => setNewLeadForm({ ...newLeadForm, requirements: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '0.84rem' }}
            />
            <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
              💡 Detail what the customer asked for so any handover employee can quote accurately.
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
              Assigned Sales Executive / Handled By
            </label>
            <input
              type="text"
              placeholder="e.g. Karan / Alok (Name of sales executive handling this lead)"
              value={newLeadForm.assignedTo}
              onChange={(e) => setNewLeadForm({ ...newLeadForm, assignedTo: e.target.value })}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '0.84rem' }}
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
      {/* MODAL 1B: CONVERT LEAD TO CUSTOMER */}
      {/* ------------------------------------------------------------- */}
      <Modal isOpen={showConvertModal} onClose={() => { setShowConvertModal(false); setLeadToConvert(null); }} title="Convert Lead to Corporate Customer 🏢">
        <form onSubmit={handleConvertLeadToCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ padding: '0.75rem 1rem', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '0.84rem', color: '#1e40af' }}>
            <span>💡 <strong>Lead Conversion:</strong> Promotes this lead into an active Customer Account in your CRM, marks the lead as <strong>WON</strong>, and immediately takes you to the Customers list.</span>
          </div>

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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => { setShowConvertModal(false); setLeadToConvert(null); }}
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
              {isConvertingLead ? 'Converting...' : '🏢 Confirm & Move to Customers 🚀'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1C: LEAD DETAILS & STATUS WORKFLOW REVIEW */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={Boolean(viewingLead)}
        onClose={() => setViewingLead(null)}
        title="📋 Lead Details & Discussion Review"
        maxWidth="680px"
      >
        {viewingLead && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            {/* Top Hero Card */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '0.85rem',
                padding: '1rem 1.25rem',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                  {viewingLead.name}
                </div>
                {viewingLead.company && (
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#475569', marginTop: '2px' }}>
                    🏢 {viewingLead.company}
                  </div>
                )}
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {renderLeadStatusBadge(viewingLead.status)}
                  {renderLeadSourceBadge(viewingLead.source)}
                </div>
              </div>

              {viewingLead.value && (
                <div
                  style={{
                    padding: '0.5rem 0.95rem',
                    borderRadius: '8px',
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    textAlign: 'right',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#047857', textTransform: 'uppercase' }}>
                    Estimated Deal Value
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#047857', whiteSpace: 'nowrap' }}>
                    {formatLeadValue(viewingLead.value)}
                  </div>
                </div>
              )}
            </div>

            {/* Information Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '0.85rem',
              }}
            >
              <div style={{ padding: '0.75rem 0.95rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
                  Email Address
                </span>
                <a
                  href={`mailto:${viewingLead.email}`}
                  style={{ fontSize: '0.86rem', fontWeight: 600, color: '#2563eb', textDecoration: 'none', wordBreak: 'break-all' }}
                >
                  ✉️ {viewingLead.email}
                </a>
              </div>

              <div style={{ padding: '0.75rem 0.95rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
                  Phone Number
                </span>
                {viewingLead.phone ? (
                  <a
                    href={`tel:${viewingLead.phone}`}
                    style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a', textDecoration: 'none' }}
                  >
                    📞 {viewingLead.phone}
                  </a>
                ) : (
                  <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>Not provided</span>
                )}
              </div>

              <div style={{ padding: '0.75rem 0.95rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
                  Assigned Representative
                </span>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0284c7' }}>
                  👤 {viewingLead.assignedTo || 'Unassigned'}
                </span>
              </div>

              <div style={{ padding: '0.75rem 0.95rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
                  Capture Date
                </span>
                <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#334155' }}>
                  📅 {viewingLead.date}
                </span>
              </div>
            </div>

            {/* Customer Requirement / Notes Section */}
            <div
              style={{
                padding: '0.9rem 1rem',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>📝</span> Customer Requirement &amp; Discussion Scope
              </div>
              <div
                style={{
                  fontSize: '0.85rem',
                  color: viewingLead.requirements ? '#334155' : '#94a3b8',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {viewingLead.requirements || 'No specific requirements or notes entered yet for this lead.'}
              </div>
            </div>

            {/* Action Buttons Bar */}
            <div
              style={{
                borderTop: '1px solid #e2e8f0',
                paddingTop: '1rem',
                marginTop: '0.25rem',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <button
                type="button"
                onClick={() => setViewingLead(null)}
                style={{
                  padding: '0.55rem 1.15rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>

              {canPerformAction('leads') && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                  {viewingLead.status === 'WON' ? (
                    <div
                      style={{
                        padding: '0.45rem 0.95rem',
                        borderRadius: '6px',
                        background: '#dcfce7',
                        color: '#15803d',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <span>🏆</span> Converted to Customer
                    </div>
                  ) : (
                    <>
                      {/* Button 1: Mark as Contacted / In Discussion */}
                      {viewingLead.status !== 'CONTACTED' && (
                        <button
                          type="button"
                          disabled={updatingLeadId === viewingLead.id}
                          onClick={() => handleLeadStatusChange(viewingLead.id, 'CONTACTED')}
                          style={{
                            padding: '0.55rem 0.95rem',
                            borderRadius: '6px',
                            border: '1px solid #ddd6fe',
                            background: '#f5f3ff',
                            color: '#6d28d9',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                          }}
                          title="Mark lead as spoken with / contacted"
                        >
                          <span>📞</span> In Discussion
                        </button>
                      )}

                      {/* Button 2: Reject Lead (Customer Refused) */}
                      {viewingLead.status !== 'LOST' && (
                        <button
                          type="button"
                          disabled={updatingLeadId === viewingLead.id}
                          onClick={() => handleLeadStatusChange(viewingLead.id, 'LOST')}
                          style={{
                            padding: '0.55rem 0.95rem',
                            borderRadius: '6px',
                            border: '1px solid #fecaca',
                            background: '#fef2f2',
                            color: '#b91c1c',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                          }}
                          title="Customer refused or lead is unqualified"
                        >
                          <span>❌</span> Reject Lead
                        </button>
                      )}

                      {/* Button 3: Approve & Open Convert Modal */}
                      <button
                        type="button"
                        onClick={() => handleApproveAndConvert(viewingLead)}
                        style={{
                          padding: '0.55rem 1.15rem',
                          borderRadius: '6px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)',
                        }}
                        title="Approve this lead and convert to official Customer"
                      >
                        <span>✓</span> Approve &amp; Convert 🏢
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
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
      {/* MODAL 2B: VIEW CUSTOMER PROFILE & ACTIONS */}
      {/* ------------------------------------------------------------- */}
      <Modal isOpen={Boolean(viewingCustomer)} onClose={() => setViewingCustomer(null)} title="Customer Account Details 🏢">
        {viewingCustomer && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                  {viewingCustomer.companyName}
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Registered Customer Account • Industry: {viewingCustomer.industry || 'Technology & IT'}
                </span>
              </div>
              <span style={{
                padding: '4px 10px',
                borderRadius: '9999px',
                fontSize: '0.74rem',
                fontWeight: 700,
                background: viewingCustomer.status === 'ACTIVE' ? '#ecfdf5' : '#fef3c7',
                color: viewingCustomer.status === 'ACTIVE' ? '#065f46' : '#92400e',
                border: viewingCustomer.status === 'ACTIVE' ? '1px solid #a7f3d0' : '1px solid #fde68a',
              }}>
                {viewingCustomer.status}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ padding: '0.85rem 1rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Primary Contact Person
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                  {viewingCustomer.contactPerson || '—'}
                </span>
              </div>

              <div style={{ padding: '0.85rem 1rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  GSTIN / Tax ID
                </span>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                  {viewingCustomer.gstin || '—'}
                </span>
              </div>

              <div style={{ padding: '0.85rem 1rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Email Address
                </span>
                <span style={{ fontSize: '0.85rem', color: '#0f172a' }}>
                  {viewingCustomer.email || '—'}
                </span>
              </div>

              <div style={{ padding: '0.85rem 1rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Mobile / Phone Number
                </span>
                <span style={{ fontSize: '0.85rem', color: '#0f172a' }}>
                  {viewingCustomer.phone || '—'}
                </span>
              </div>
            </div>

            <div style={{ padding: '1rem', background: '#f5f0ff', borderRadius: '8px', border: '1px solid #ebdfff' }}>
              <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#5b21b6', marginBottom: '0.35rem' }}>
                ⚡ Quick Sales Execution Actions for {viewingCustomer.companyName}:
              </span>
              <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.78rem', color: '#6b21a8' }}>
                Yahan se direct is customer ke naam par Quotation banayein ya Sales Order issue karein.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    const custName = viewingCustomer.companyName;
                    setViewingCustomer(null);
                    router.push(`/sales/quotations?customer=${encodeURIComponent(custName)}`);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.55rem 1rem',
                    borderRadius: '6px',
                    background: '#ffffff',
                    color: '#7f22fe',
                    border: '1px solid #c4b5fd',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  <span>📄</span> Issue Quotation Proposal ➡️
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const custName = viewingCustomer.companyName;
                    setViewingCustomer(null);
                    router.push(`/sales/orders?customer=${encodeURIComponent(custName)}`);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.55rem 1rem',
                    borderRadius: '6px',
                    background: '#7f22fe',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(127, 34, 254, 0.25)',
                  }}
                >
                  <span>🛒</span> Create Sales Order ➡️
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                style={{ padding: '0.55rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        )}
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
                type="tel"
                maxLength={10}
                placeholder="e.g. 9820000000"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
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

      {/* MULTI-CHANNEL LEAD INTEGRATIONS MODAL */}
      <LeadIntegrationsModal
        companyId={activeCompany?.id}
        isOpen={showIntegrationsModal}
        onClose={() => setShowIntegrationsModal(false)}
        showToast={showToast}
        onLeadsSynced={() => setLeadLoadVersion((v) => v + 1)}
      />
    </div>
  );
}

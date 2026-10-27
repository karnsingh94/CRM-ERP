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
        sales: ['sales', 'sales_quotations', 'sales_orders', 'quotations', 'orders', '/sales/quotations', '/sales/orders'],
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
      sales: ['sales', 'sales_quotations', 'sales_orders', 'quotations', 'orders', '75a5cb8a-cea5-11f1-9511-b05cda618678'],
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
    pan: '',
    contactPerson: '',
    email: '',
    phone: '',
    industry: 'Technology & IT',
    billingAddress: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    shippingAddress: '',
    website: '',
    paymentTerms: '',
    requirements: '',
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
      const metadata = {
        billingAddress: customerForm.billingAddress || '',
        city: customerForm.city || '',
        state: customerForm.state || '',
        pincode: customerForm.pincode || '',
        country: customerForm.country || 'India',
        shippingAddress: customerForm.shippingAddress || '',
        pan: customerForm.pan || '',
        website: customerForm.website || '',
        paymentTerms: customerForm.paymentTerms || '',
      };
      const serialized = serializeCustomerRequirementsAndLogs(customerForm.requirements || '', [], metadata);
      const payload = {
        companyName: customerForm.companyName,
        gstin: customerForm.gstin,
        contactPerson: customerForm.contactPerson,
        email: customerForm.email,
        phone: customerForm.phone,
        industry: customerForm.industry,
        status: customerForm.status || 'ACTIVE',
        requirements: serialized,
      };
      const res = await api.post(`/companies/${activeCompany.id}/crm/customers`, payload);
      setCustomers([res.data, ...customers]);
      setShowAddCustomerModal(false);
      setCustomerForm({
        companyName: '',
        gstin: '',
        pan: '',
        contactPerson: '',
        email: '',
        phone: '',
        industry: 'Technology & IT',
        billingAddress: '',
        city: '',
        state: '',
        pincode: '',
        country: 'India',
        shippingAddress: '',
        website: '',
        paymentTerms: '',
        requirements: '',
        status: 'ACTIVE',
      });
      showToast('Customer Added! 🏢', `Client "${res.data.companyName}" successfully registered in database.`, 'success');
    } catch (err) {
      showToast('Customer Not Created', err.message || 'Could not register customer.', 'danger');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Helper to parse requirements, metadata (address/pan/terms), and activities log
  const parseCustomerRequirementsAndLogs = (rawRequirements) => {
    const defaultMeta = {
      billingAddress: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
      shippingAddress: '',
      pan: '',
      website: '',
      paymentTerms: '',
      claimRequest: null,
    };

    if (!rawRequirements) return { requirementsText: '', activities: [], metadata: defaultMeta };
    if (typeof rawRequirements !== 'string') return { requirementsText: String(rawRequirements), activities: [], metadata: defaultMeta };

    let textPart = rawRequirements;
    let activities = [];
    let metadata = { ...defaultMeta };

    // 1. Parse Activities
    if (textPart.includes('__CRM_ACTIVITIES__:')) {
      const parts = textPart.split('__CRM_ACTIVITIES__:');
      textPart = (parts[0] || '').trim();
      try {
        const parsedLogs = JSON.parse(parts[1]?.trim() || '[]');
        activities = Array.isArray(parsedLogs) ? parsedLogs : [];
      } catch {
        activities = [];
      }
    }

    // 2. Parse Metadata (Address, PAN, etc.)
    if (textPart.includes('__CRM_METADATA__:')) {
      const parts = textPart.split('__CRM_METADATA__:');
      textPart = (parts[0] || '').trim();
      try {
        const parsedMeta = JSON.parse(parts[1]?.trim() || '{}');
        metadata = { ...defaultMeta, ...(typeof parsedMeta === 'object' && parsedMeta !== null ? parsedMeta : {}) };
      } catch {
        metadata = { ...defaultMeta };
      }
    }

    return { requirementsText: textPart.trim(), activities, metadata };
  };

  const serializeCustomerRequirementsAndLogs = (requirementsText, activities, metadata) => {
    let output = (requirementsText || '').trim();
    if (metadata && Object.keys(metadata).length > 0) {
      output = `${output}\n\n__CRM_METADATA__:\n${JSON.stringify(metadata)}`;
    }
    if (activities && activities.length > 0) {
      output = `${output}\n\n__CRM_ACTIVITIES__:\n${JSON.stringify(activities)}`;
    }
    return output;
  };

  const currentRepName = currentUser?.name || currentUser?.email?.split('@')[0] || 'Employee';

  const [customerOwnershipFilter, setCustomerOwnershipFilter] = useState('ALL'); // 'ALL' | 'MINE' | 'UNASSIGNED'
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isUpdatingCustomer, setIsUpdatingCustomer] = useState(false);
  const [editCustomerForm, setEditCustomerForm] = useState({
    companyName: '',
    gstin: '',
    pan: '',
    contactPerson: '',
    email: '',
    phone: '',
    industry: 'Technology & IT',
    billingAddress: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    shippingAddress: '',
    website: '',
    paymentTerms: '',
    requirements: '',
    assignedTo: '',
    status: 'ACTIVE',
  });

  // Touchpoint / Interaction Logging State
  const [loggingTouchpointCustomer, setLoggingTouchpointCustomer] = useState(null);
  const [touchpointForm, setTouchpointForm] = useState({
    type: 'CALL', // 'CALL' | 'MEETING' | 'EMAIL' | 'NOTE' | 'ISSUE'
    title: '',
    notes: '',
    nextFollowUp: '',
  });
  const [isSavingTouchpoint, setIsSavingTouchpoint] = useState(false);

  // Customer Details Modal State
  const [customerModalTab, setCustomerModalTab] = useState('overview'); // 'overview' | 'timeline'
  const [inlineReqDraft, setInlineReqDraft] = useState('');
  const [isSavingInlineReq, setIsSavingInlineReq] = useState(false);

  const handleOpenCustomerDetails = (customer) => {
    setViewingCustomer(customer);
    const { requirementsText } = parseCustomerRequirementsAndLogs(customer.requirements);
    setInlineReqDraft(requirementsText);
    setCustomerModalTab('overview');
  };

  const handleOpenEditCustomerModal = (customer) => {
    setEditingCustomer(customer);
    const { requirementsText, metadata } = parseCustomerRequirementsAndLogs(customer.requirements);
    setEditCustomerForm({
      companyName: customer.companyName || '',
      gstin: customer.gstin || '',
      pan: metadata.pan || '',
      contactPerson: customer.contactPerson || '',
      email: customer.email || '',
      phone: customer.phone || '',
      industry: customer.industry || 'Technology & IT',
      billingAddress: metadata.billingAddress || '',
      city: metadata.city || '',
      state: metadata.state || '',
      pincode: metadata.pincode || '',
      country: metadata.country || 'India',
      shippingAddress: metadata.shippingAddress || '',
      website: metadata.website || '',
      paymentTerms: metadata.paymentTerms || '',
      requirements: requirementsText || '',
      assignedTo: customer.assignedTo || '',
      status: customer.status || 'ACTIVE',
    });
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    if (!editCustomerForm.companyName?.trim()) {
      showToast('Validation Error', 'Company name is required.', 'danger');
      return;
    }
    setIsUpdatingCustomer(true);
    try {
      const { activities } = parseCustomerRequirementsAndLogs(editingCustomer.requirements);
      const metadata = {
        billingAddress: editCustomerForm.billingAddress || '',
        city: editCustomerForm.city || '',
        state: editCustomerForm.state || '',
        pincode: editCustomerForm.pincode || '',
        country: editCustomerForm.country || 'India',
        shippingAddress: editCustomerForm.shippingAddress || '',
        pan: editCustomerForm.pan || '',
        website: editCustomerForm.website || '',
        paymentTerms: editCustomerForm.paymentTerms || '',
      };
      const serialized = serializeCustomerRequirementsAndLogs(editCustomerForm.requirements, activities, metadata);
      const res = await api.patch(
        `/companies/${activeCompany.id}/crm/customers/${editingCustomer.id}`,
        {
          companyName: editCustomerForm.companyName,
          gstin: editCustomerForm.gstin,
          contactPerson: editCustomerForm.contactPerson,
          email: editCustomerForm.email,
          phone: editCustomerForm.phone,
          industry: editCustomerForm.industry,
          assignedTo: editCustomerForm.assignedTo,
          status: editCustomerForm.status,
          requirements: serialized,
        }
      );
      const updated = res.data?.data || res.data;
      setCustomers((current) => current.map((c) => (c.id === editingCustomer.id ? updated : c)));
      if (viewingCustomer?.id === editingCustomer.id) {
        setViewingCustomer(updated);
      }
      setEditingCustomer(null);
      showToast('Customer Profile & KYC Updated! 🏢', `Client "${updated.companyName}" details saved successfully.`, 'success');
    } catch (err) {
      showToast('Update Failed', err.message || 'Could not update customer.', 'danger');
    } finally {
      setIsUpdatingCustomer(false);
    }
  };

  // Role check for approving transfer requests (Admin, Dept Head, Team Leader)
  const userRole = currentUser?.role || currentUser?.accessRole;
  const canApproveClaimTransfer = [
    'SUPER_ADMIN',
    'COMPANY_ADMIN',
    'DEPARTMENT_HEAD',
    'SERVICE_HEAD',
    'TEAM_LEADER',
  ].includes(userRole);

  // Transfer claim request state
  const [requestingTransferCustomer, setRequestingTransferCustomer] = useState(null);
  const [transferReason, setTransferReason] = useState('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Account Claim & Transfer Handler
  const handleClaimCustomer = async (customer) => {
    // If account is already owned by another representative, initiate approval request
    if (customer.assignedTo && customer.assignedTo.toLowerCase() !== currentRepName.toLowerCase()) {
      handleOpenRequestTransfer(customer);
      return;
    }

    try {
      const res = await api.patch(
        `/companies/${activeCompany.id}/crm/customers/${customer.id}`,
        { assignedTo: currentRepName }
      );
      const updated = res.data?.data || res.data;
      setCustomers((current) => current.map((c) => (c.id === customer.id ? updated : c)));
      if (viewingCustomer?.id === customer.id) {
        setViewingCustomer(updated);
      }
      showToast('Account Claimed! 👤', `Customer "${customer.companyName}" assigned to you (${currentRepName}).`, 'success');
    } catch (err) {
      showToast('Claim Failed', err.message || 'Could not assign customer.', 'danger');
    }
  };

  const handleOpenRequestTransfer = (customer) => {
    setRequestingTransferCustomer(customer);
    setTransferReason('Customer called my direct line for urgent order inquiry / quotation support.');
  };

  const handleSubmitClaimTransfer = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!requestingTransferCustomer) return;
    if (!transferReason.trim()) {
      showToast('Validation Error', 'Please enter the call reason or context for this transfer request.', 'danger');
      return;
    }

    setIsSubmittingTransfer(true);
    try {
      const parsed = parseCustomerRequirementsAndLogs(requestingTransferCustomer.requirements);
      const claimRequest = {
        requestedBy: currentRepName,
        currentRep: requestingTransferCustomer.assignedTo || 'Unassigned',
        reason: transferReason.trim(),
        status: 'PENDING',
        requestedAt: new Date().toISOString(),
      };

      const newActivity = {
        id: 'req_' + Date.now(),
        type: 'NOTE',
        title: `🔄 Ownership Transfer Requested by ${currentRepName}`,
        notes: `Transfer requested from "${requestingTransferCustomer.assignedTo}". Reason: ${transferReason.trim()}`,
        authorName: currentRepName,
        createdAt: new Date().toISOString(),
      };

      const updatedMeta = { ...parsed.metadata, claimRequest };
      const updatedActivities = [newActivity, ...(parsed.activities || [])];
      const serialized = serializeCustomerRequirementsAndLogs(parsed.requirementsText, updatedActivities, updatedMeta);

      const res = await api.patch(
        `/companies/${activeCompany.id}/crm/customers/${requestingTransferCustomer.id}`,
        { requirements: serialized }
      );
      const updated = res.data?.data || res.data;
      setCustomers((current) => current.map((c) => (c.id === requestingTransferCustomer.id ? updated : c)));
      if (viewingCustomer?.id === requestingTransferCustomer.id) {
        setViewingCustomer(updated);
      }
      setRequestingTransferCustomer(null);
      setTransferReason('');
      showToast(
        'Transfer Request Submitted! 📬',
        `Request sent to Team Head, Department Head, and Admin for approval.`,
        'success'
      );
    } catch (err) {
      showToast('Request Failed', err.message || 'Could not submit transfer request.', 'danger');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleApproveClaimTransfer = async (customer) => {
    const parsed = parseCustomerRequirementsAndLogs(customer.requirements);
    const req = parsed.metadata?.claimRequest;
    if (!req || req.status !== 'PENDING') return;

    try {
      const updatedClaim = {
        ...req,
        status: 'APPROVED',
        reviewedBy: currentRepName,
        reviewedAt: new Date().toISOString(),
      };

      const newActivity = {
        id: 'app_' + Date.now(),
        type: 'NOTE',
        title: `✓ Ownership Transfer Approved by ${currentRepName}`,
        notes: `Account reassigned from "${req.currentRep}" to "${req.requestedBy}". Original transfer reason was: "${req.reason}"`,
        authorName: currentRepName,
        createdAt: new Date().toISOString(),
      };

      const updatedMeta = { ...parsed.metadata, claimRequest: updatedClaim };
      const updatedActivities = [newActivity, ...(parsed.activities || [])];
      const serialized = serializeCustomerRequirementsAndLogs(parsed.requirementsText, updatedActivities, updatedMeta);

      const res = await api.patch(
        `/companies/${activeCompany.id}/crm/customers/${customer.id}`,
        {
          assignedTo: req.requestedBy,
          requirements: serialized,
        }
      );
      const updated = res.data?.data || res.data;
      setCustomers((current) => current.map((c) => (c.id === customer.id ? updated : c)));
      if (viewingCustomer?.id === customer.id) {
        setViewingCustomer(updated);
      }
      showToast('Transfer Approved! ✓', `Account ownership transferred to ${req.requestedBy}.`, 'success');
    } catch (err) {
      showToast('Approval Failed', err.message || 'Could not approve transfer.', 'danger');
    }
  };

  const handleRejectClaimTransfer = async (customer, rejectReason = 'Rejected by Management') => {
    const parsed = parseCustomerRequirementsAndLogs(customer.requirements);
    const req = parsed.metadata?.claimRequest;
    if (!req || req.status !== 'PENDING') return;

    try {
      const updatedClaim = {
        ...req,
        status: 'REJECTED',
        reviewedBy: currentRepName,
        reviewedAt: new Date().toISOString(),
        rejectReason,
      };

      const newActivity = {
        id: 'rej_' + Date.now(),
        type: 'NOTE',
        title: `✗ Ownership Transfer Rejected by ${currentRepName}`,
        notes: `Transfer request from "${req.requestedBy}" rejected. Account remains with "${req.currentRep}".`,
        authorName: currentRepName,
        createdAt: new Date().toISOString(),
      };

      const updatedMeta = { ...parsed.metadata, claimRequest: updatedClaim };
      const updatedActivities = [newActivity, ...(parsed.activities || [])];
      const serialized = serializeCustomerRequirementsAndLogs(parsed.requirementsText, updatedActivities, updatedMeta);

      const res = await api.patch(
        `/companies/${activeCompany.id}/crm/customers/${customer.id}`,
        { requirements: serialized }
      );
      const updated = res.data?.data || res.data;
      setCustomers((current) => current.map((c) => (c.id === customer.id ? updated : c)));
      if (viewingCustomer?.id === customer.id) {
        setViewingCustomer(updated);
      }
      showToast('Transfer Request Rejected', `Account ownership remains with ${req.currentRep}.`, 'info');
    } catch (err) {
      showToast('Action Failed', err.message || 'Could not reject transfer.', 'danger');
    }
  };

  // Quick Status Change Handler
  const handleQuickStatusChange = async (customer, newStatus) => {
    try {
      const res = await api.patch(
        `/companies/${activeCompany.id}/crm/customers/${customer.id}`,
        { status: newStatus }
      );
      const updated = res.data?.data || res.data;
      setCustomers((current) => current.map((c) => (c.id === customer.id ? updated : c)));
      if (viewingCustomer?.id === customer.id) {
        setViewingCustomer(updated);
      }
      showToast('Status Updated! 🏷️', `Customer status set to ${newStatus}.`, 'success');
    } catch (err) {
      showToast('Update Failed', err.message || 'Could not update status.', 'danger');
    }
  };

  // Open Log Touchpoint Modal
  const handleOpenLogTouchpoint = (customer) => {
    setLoggingTouchpointCustomer(customer);
    setTouchpointForm({
      type: 'CALL',
      title: 'Customer Follow-up Discussion',
      notes: '',
      nextFollowUp: '',
    });
  };

  // Save Touchpoint (Call, Meeting, Email, Note)
  const handleSaveTouchpoint = async (e, customTarget = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const target = customTarget || loggingTouchpointCustomer;
    if (!target) return;

    if (!touchpointForm.notes?.trim() && !touchpointForm.title?.trim()) {
      showToast('Validation Error', 'Please enter discussion notes or touchpoint summary.', 'danger');
      return;
    }

    setIsSavingTouchpoint(true);
    try {
      const parsed = parseCustomerRequirementsAndLogs(target.requirements);
      const newActivity = {
        id: 'tp_' + Date.now(),
        type: touchpointForm.type || 'CALL',
        title: touchpointForm.title?.trim() || `${touchpointForm.type || 'CALL'} with Client`,
        notes: touchpointForm.notes?.trim(),
        nextFollowUp: touchpointForm.nextFollowUp || null,
        authorName: currentRepName,
        createdAt: new Date().toISOString(),
      };
      const updatedActivities = [newActivity, ...(parsed.activities || [])];
      const serialized = serializeCustomerRequirementsAndLogs(parsed.requirementsText, updatedActivities, parsed.metadata);

      const payload = { requirements: serialized };
      if (!target.assignedTo) {
        payload.assignedTo = currentRepName;
      }
      if (touchpointForm.nextFollowUp) {
        payload.status = 'FOLLOW_UP_NEEDED';
      }

      const res = await api.patch(
        `/companies/${activeCompany.id}/crm/customers/${target.id}`,
        payload
      );
      const updated = res.data?.data || res.data;
      setCustomers((current) => current.map((c) => (c.id === target.id ? updated : c)));
      if (viewingCustomer?.id === target.id) {
        setViewingCustomer(updated);
      }
      setLoggingTouchpointCustomer(null);
      setTouchpointForm({ type: 'CALL', title: '', notes: '', nextFollowUp: '' });
      showToast('Touchpoint Logged! 📞', `Activity successfully recorded for "${target.companyName}".`, 'success');
    } catch (err) {
      showToast('Save Failed', err.message || 'Could not record touchpoint.', 'danger');
    } finally {
      setIsSavingTouchpoint(false);
    }
  };

  // Save Inline Requirements from Details Modal
  const handleSaveInlineRequirements = async () => {
    if (!viewingCustomer) return;
    setIsSavingInlineReq(true);
    try {
      const parsed = parseCustomerRequirementsAndLogs(viewingCustomer.requirements);
      const serialized = serializeCustomerRequirementsAndLogs(inlineReqDraft, parsed.activities, parsed.metadata);
      const res = await api.patch(
        `/companies/${activeCompany.id}/crm/customers/${viewingCustomer.id}`,
        { requirements: serialized }
      );
      const updated = res.data?.data || res.data;
      setCustomers((current) => current.map((c) => (c.id === viewingCustomer.id ? updated : c)));
      setViewingCustomer(updated);
      showToast('Requirements Saved! 📝', `Scope updated for "${updated.companyName}".`, 'success');
    } catch (err) {
      showToast('Save Failed', err.message || 'Could not update requirements.', 'danger');
    } finally {
      setIsSavingInlineReq(false);
    }
  };

  // Filtered Customers based on Search, Status, and Ownership
  const filteredCustomers = (customers || []).filter(c => {
    if (!c) return false;
    const q = (searchQuery || '').toLowerCase().trim();
    const parsed = parseCustomerRequirementsAndLogs(c.requirements);
    const matchesSearch = !q ||
      String(c.companyName || '').toLowerCase().includes(q) ||
      String(c.contactPerson || '').toLowerCase().includes(q) ||
      String(c.gstin || '').toLowerCase().includes(q) ||
      String(c.email || '').toLowerCase().includes(q) ||
      parsed.requirementsText.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;

    let matchesOwnership = true;
    if (customerOwnershipFilter === 'MINE') {
      matchesOwnership = String(c.assignedTo || '').toLowerCase() === currentRepName.toLowerCase();
    } else if (customerOwnershipFilter === 'UNASSIGNED') {
      matchesOwnership = !c.assignedTo;
    } else if (customerOwnershipFilter === 'PENDING_TRANSFER') {
      matchesOwnership = parsed.metadata?.claimRequest?.status === 'PENDING';
    }

    return matchesSearch && matchesStatus && matchesOwnership;
  });

  // -----------------------------------------------------------------
  // 3. CONTACT PERSONS
  // -----------------------------------------------------------------
  const [contacts, setContacts] = useState([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [viewingContact, setViewingContact] = useState(null);
  const [editingContact, setEditingContact] = useState(null);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [isUpdatingContact, setIsUpdatingContact] = useState(false);
  const [contactRoleFilter, setContactRoleFilter] = useState('ALL');
  const [contactForm, setContactForm] = useState({
    name: '',
    companyName: '',
    role: 'Primary Account Contact',
    email: '',
    phone: '',
    channel: 'Email',
  });
  const [editContactForm, setEditContactForm] = useState({
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
      setActiveTab('contacts');
      setContactForm({
        name: '',
        companyName: '',
        role: 'Primary Account Contact',
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

  const handleConvertCustomerToContact = (customer) => {
    setContactForm({
      name: customer.contactPerson || customer.companyName,
      companyName: customer.companyName,
      role: 'Primary Account Contact',
      email: customer.email || '',
      phone: (customer.phone || '').replace(/\D/g, '').slice(-10),
      channel: 'Customer Account',
    });
    setShowAddContactModal(true);
  };

  const handleConvertContactToOpportunity = (cnt) => {
    const matchedCust = (customers || []).find(
      (c) => String(c.companyName || '').toLowerCase().trim() === String(cnt.companyName || '').toLowerCase().trim()
    );
    const parsed = matchedCust ? parseCustomerRequirementsAndLogs(matchedCust.requirements) : null;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 15);
    const defaultCloseDate = targetDate.toISOString().slice(0, 10);

    let defaultVal = '₹ 5,00,000';
    if (parsed?.requirementsText) {
      const match = parsed.requirementsText.match(/(\d[\d,]*\s*(?:lakh|cr|k|rs|inr)?)/i);
      if (match) defaultVal = match[0];
    }

    setOpportunityForm({
      title: `${cnt.companyName} - Deal Opportunity`,
      companyName: cnt.companyName,
      stage: 'DISCOVERY',
      value: defaultVal,
      expectedCloseDate: defaultCloseDate,
      probability: '50%',
    });
    setShowAddOpportunityModal(true);
  };

  const handleOpenEditContact = (cnt) => {
    setEditingContact(cnt);
    setEditContactForm({
      name: cnt.name || '',
      companyName: cnt.companyName || '',
      role: cnt.role || '',
      email: cnt.email || '',
      phone: cnt.phone || '',
      channel: cnt.channel || 'Email',
    });
  };

  const handleUpdateContact = async (e) => {
    e.preventDefault();
    if (!editContactForm.name.trim()) {
      showToast('Validation Error', 'Contact name is required.', 'danger');
      return;
    }
    setIsUpdatingContact(true);
    try {
      const res = await api.patch(
        `/companies/${activeCompany.id}/crm/contacts/${editingContact.id}`,
        editContactForm
      );
      const updated = res.data?.data || res.data;
      setContacts((current) => current.map((c) => (c.id === editingContact.id ? updated : c)));
      if (viewingContact?.id === editingContact.id) {
        setViewingContact(updated);
      }
      setEditingContact(null);
      showToast('Contact Updated! 👤', `Details updated for "${updated.name}".`, 'success');
    } catch (err) {
      showToast('Update Failed', err.message || 'Could not update contact.', 'danger');
    } finally {
      setIsUpdatingContact(false);
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

    let matchesRole = true;
    if (contactRoleFilter !== 'ALL') {
      matchesRole = String(cnt.role || '').toLowerCase().includes(contactRoleFilter.toLowerCase());
    }
    return matchesSearch && matchesRole;
  });

  // -----------------------------------------------------------------
  // 4. DEAL OPPORTUNITIES (SALES DEALS)
  // -----------------------------------------------------------------
  const [opportunities, setOpportunities] = useState([]);
  const [isLoadingOpportunities, setIsLoadingOpportunities] = useState(false);
  const [showAddOpportunityModal, setShowAddOpportunityModal] = useState(false);
  const [isSavingOpportunity, setIsSavingOpportunity] = useState(false);
  const [viewingOpportunity, setViewingOpportunity] = useState(null);
  const [isUpdatingOpportunity, setIsUpdatingOpportunity] = useState(false);
  const [manageOppForm, setManageOppForm] = useState({
    title: '',
    stage: 'DISCOVERY',
    value: '',
    expectedCloseDate: '',
    probability: '50%',
  });
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

  const handleOpenNewOpportunityModal = (defaultCompany = '') => {
    const targetComp = defaultCompany || customers[0]?.companyName || '';
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 15);
    const defaultCloseDate = targetDate.toISOString().slice(0, 10);

    setOpportunityForm({
      title: targetComp ? `${targetComp} - Deal Opportunity` : '',
      companyName: targetComp,
      stage: 'DISCOVERY',
      value: '₹ 5,00,000',
      expectedCloseDate: defaultCloseDate,
      probability: '50%',
    });
    setShowAddOpportunityModal(true);
  };

  const handleOpenManageOpportunity = (opp) => {
    setViewingOpportunity(opp);
    const closeDate = opp.expectedCloseDate
      ? new Date(opp.expectedCloseDate).toISOString().slice(0, 10)
      : '';
    setManageOppForm({
      title: opp.title || '',
      stage: opp.stage || 'DISCOVERY',
      value: opp.value || '',
      expectedCloseDate: closeDate,
      probability: opp.probability || '50%',
    });
  };

  const handleUpdateOpportunityDetails = async (customStage = null) => {
    if (!viewingOpportunity) return;
    setIsUpdatingOpportunity(true);
    const stageToSave = customStage || manageOppForm.stage;
    let probToSave = manageOppForm.probability;
    if (customStage) {
      if (customStage === 'WON') probToSave = '100%';
      else if (customStage === 'LOST') probToSave = '0%';
      else if (customStage === 'DISCOVERY') probToSave = '25%';
      else if (customStage === 'PROPOSAL') probToSave = '50%';
      else if (customStage === 'NEGOTIATION') probToSave = '75%';
    }
    try {
      const payload = {
        title: manageOppForm.title,
        stage: stageToSave,
        value: manageOppForm.value,
        expectedCloseDate: manageOppForm.expectedCloseDate,
        probability: probToSave,
      };
      const res = await api.patch(
        `/companies/${activeCompany.id}/crm/opportunities/${viewingOpportunity.id}`,
        payload
      );
      const updated = res.data?.data || res.data;
      setOpportunities((current) =>
        current.map((o) => (o.id === viewingOpportunity.id ? updated : o))
      );
      setViewingOpportunity(updated);
      setManageOppForm((prev) => ({ ...prev, stage: stageToSave, probability: probToSave }));
      showToast('Deal Updated! 💼', `Opportunity stage updated to "${stageToSave}".`, 'success');
    } catch (err) {
      showToast('Update Failed', err.message || 'Could not update deal.', 'danger');
    } finally {
      setIsUpdatingOpportunity(false);
    }
  };

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
      setActiveTab('opportunities');
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
              handleOpenNewOpportunityModal();
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!canPerformAction('customers') && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.65rem 1.25rem',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
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

          {/* Customer Relationship Executive KPI Summary Cards */}
          {(() => {
            const totalAccounts = customers.length;
            const myAccounts = customers.filter(c => String(c.assignedTo || '').toLowerCase() === currentRepName.toLowerCase()).length;
            const followUpNeeded = customers.filter(c => c.status === 'FOLLOW_UP_NEEDED').length;
            const onboardingCount = customers.filter(c => c.status === 'ONBOARDING').length;

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
                <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem 1.15rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>TOTAL ACCOUNTS</span>
                    <span style={{ fontSize: '1.2rem' }}>🏢</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{totalAccounts}</div>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Verified client directory</span>
                </div>

                <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #c7d2fe', padding: '1rem 1.15rem', boxShadow: '0 1px 3px rgba(99,102,241,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4338ca' }}>MY ASSIGNED ACCOUNTS</span>
                    <span style={{ fontSize: '1.2rem' }}>👤</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3730a3' }}>{myAccounts}</div>
                  <span style={{ fontSize: '0.74rem', color: '#6366f1', fontWeight: 600 }}>Managed by you ({currentRepName})</span>
                </div>

                <div style={{ background: followUpNeeded > 0 ? '#fffbeb' : '#ffffff', borderRadius: '10px', border: followUpNeeded > 0 ? '1px solid #fde68a' : '1px solid #e2e8f0', padding: '1rem 1.15rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: followUpNeeded > 0 ? '#b45309' : '#64748b' }}>FOLLOW-UP NEEDED</span>
                    <span style={{ fontSize: '1.2rem' }}>📞</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: followUpNeeded > 0 ? '#92400e' : '#0f172a' }}>{followUpNeeded}</div>
                  <span style={{ fontSize: '0.74rem', color: followUpNeeded > 0 ? '#b45309' : '#64748b', fontWeight: followUpNeeded > 0 ? 700 : 500 }}>
                    {followUpNeeded > 0 ? 'Scheduled calls pending' : 'All accounts touched'}
                  </span>
                </div>

                <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem 1.15rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>ONBOARDING STAGE</span>
                    <span style={{ fontSize: '1.2rem' }}>🚀</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{onboardingCount}</div>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>KYC / Scope setup in progress</span>
                </div>
              </div>
            );
          })()}

          {/* Main Customers Workspace Table Container */}
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {/* Filter & Ownership Control Bar */}
            <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', background: '#fafaf9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '220px' }}>
                <input
                  type="text"
                  placeholder="Search by company name, GSTIN, SPOC, or requirement..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    maxWidth: '360px',
                    padding: '0.5rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    background: '#ffffff',
                  }}
                />
              </div>

              {/* Ownership Filter Pills */}
              {(() => {
                const pendingTransfersCount = customers.filter(c => {
                  const parsed = parseCustomerRequirementsAndLogs(c.requirements);
                  return parsed.metadata?.claimRequest?.status === 'PENDING';
                }).length;

                return (
                  <div style={{ display: 'flex', alignItems: 'center', background: '#e2e8f0', padding: '3px', borderRadius: '8px', gap: '2px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setCustomerOwnershipFilter('ALL')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '0.78rem',
                        fontWeight: customerOwnershipFilter === 'ALL' ? 700 : 600,
                        background: customerOwnershipFilter === 'ALL' ? '#ffffff' : 'transparent',
                        color: customerOwnershipFilter === 'ALL' ? '#0f172a' : '#64748b',
                        cursor: 'pointer',
                        boxShadow: customerOwnershipFilter === 'ALL' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                      }}
                    >
                      All Accounts ({customers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerOwnershipFilter('MINE')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '0.78rem',
                        fontWeight: customerOwnershipFilter === 'MINE' ? 700 : 600,
                        background: customerOwnershipFilter === 'MINE' ? '#ffffff' : 'transparent',
                        color: customerOwnershipFilter === 'MINE' ? '#4338ca' : '#64748b',
                        cursor: 'pointer',
                        boxShadow: customerOwnershipFilter === 'MINE' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                      }}
                    >
                      👤 My Accounts ({customers.filter(c => String(c.assignedTo || '').toLowerCase() === currentRepName.toLowerCase()).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerOwnershipFilter('UNASSIGNED')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '0.78rem',
                        fontWeight: customerOwnershipFilter === 'UNASSIGNED' ? 700 : 600,
                        background: customerOwnershipFilter === 'UNASSIGNED' ? '#ffffff' : 'transparent',
                        color: customerOwnershipFilter === 'UNASSIGNED' ? '#0f172a' : '#64748b',
                        cursor: 'pointer',
                        boxShadow: customerOwnershipFilter === 'UNASSIGNED' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                      }}
                    >
                      Unassigned ({customers.filter(c => !c.assignedTo).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerOwnershipFilter('PENDING_TRANSFER')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '0.78rem',
                        fontWeight: customerOwnershipFilter === 'PENDING_TRANSFER' ? 800 : 600,
                        background: customerOwnershipFilter === 'PENDING_TRANSFER' ? (pendingTransfersCount > 0 ? '#fef3c7' : '#ffffff') : 'transparent',
                        color: customerOwnershipFilter === 'PENDING_TRANSFER' ? (pendingTransfersCount > 0 ? '#92400e' : '#0f172a') : (pendingTransfersCount > 0 ? '#b45309' : '#64748b'),
                        cursor: 'pointer',
                        boxShadow: customerOwnershipFilter === 'PENDING_TRANSFER' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <span>⏳ Transfers Pending</span>
                      {pendingTransfersCount > 0 && (
                        <span style={{
                          background: '#d97706',
                          color: '#ffffff',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: '9999px',
                        }}>
                          {pendingTransfersCount}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })()}

              {/* Status Filter Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem',
                    background: '#ffffff',
                    fontWeight: 600,
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Regular</option>
                  <option value="ONBOARDING">Onboarding Stage</option>
                  <option value="FOLLOW_UP_NEEDED">Follow-up Needed</option>
                  <option value="KEY_ACCOUNT">Key VIP Account</option>
                  <option value="INACTIVE">Inactive / Dormant</option>
                </select>
              </div>
            </div>

            {filteredCustomers.length === 0 ? (
              <EmptyState
                icon="🏢"
                title="No Customers Match Filters"
                description={customerOwnershipFilter === 'MINE'
                  ? `No accounts are currently assigned to you (${currentRepName}). You can claim unassigned accounts from the 'All Accounts' tab.`
                  : "No enterprise client accounts found matching the search criteria. Click 'Add Customer' to register a new account."}
                actionLabel={customerOwnershipFilter === 'MINE' ? "View All Accounts" : "Add Customer"}
                onAction={() => customerOwnershipFilter === 'MINE' ? setCustomerOwnershipFilter('ALL') : setShowAddCustomerModal(true)}
              />
            ) : (
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                      <th style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>Company / Client Account</th>
                      <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>GSTIN / Tax ID</th>
                      <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Primary SPOC &amp; Contacts</th>
                      <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Assigned Rep</th>
                      <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Industry &amp; Scope</th>
                      <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Relationship Stage</th>
                      <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((cust) => {
                      const parsed = parseCustomerRequirementsAndLogs(cust.requirements);
                      const isAssignedToMe = String(cust.assignedTo || '').toLowerCase() === currentRepName.toLowerCase();

                      // Status Badge Styling
                      let statusBg = '#ecfdf5';
                      let statusColor = '#065f46';
                      let statusBorder = '#a7f3d0';
                      let statusLabel = cust.status || 'ACTIVE';

                      if (cust.status === 'ONBOARDING') {
                        statusBg = '#eff6ff';
                        statusColor = '#1d4ed8';
                        statusBorder = '#bfdbfe';
                        statusLabel = 'ONBOARDING';
                      } else if (cust.status === 'FOLLOW_UP_NEEDED') {
                        statusBg = '#fffbeb';
                        statusColor = '#b45309';
                        statusBorder = '#fde68a';
                        statusLabel = 'FOLLOW-UP NEEDED';
                      } else if (cust.status === 'KEY_ACCOUNT') {
                        statusBg = '#faf5ff';
                        statusColor = '#7e22ce';
                        statusBorder = '#e9d5ff';
                        statusLabel = 'KEY ACCOUNT ⭐';
                      } else if (cust.status === 'INACTIVE') {
                        statusBg = '#f1f5f9';
                        statusColor = '#64748b';
                        statusBorder = '#cbd5e1';
                        statusLabel = 'INACTIVE';
                      }

                      return (
                        <tr key={cust.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}>
                          <td style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>{cust.companyName}</div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                              Added: {cust.createdAt ? new Date(cust.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </div>
                          </td>

                          <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', color: '#334155', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                            {cust.gstin ? (
                              <span style={{ background: '#f8fafc', padding: '3px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                {cust.gstin}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>

                          <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{cust.contactPerson || '—'}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '3px' }}>
                              {cust.phone && (
                                <a
                                  href={`tel:${cust.phone}`}
                                  title={`Click to call ${cust.phone}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                    padding: '2px 6px',
                                    background: '#f0fdf4',
                                    color: '#15803d',
                                    borderRadius: '4px',
                                    border: '1px solid #bbf7d0',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                  }}
                                >
                                  📞 {cust.phone}
                                </a>
                              )}
                              {cust.email && (
                                <a
                                  href={`mailto:${cust.email}`}
                                  title={`Email ${cust.email}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                    padding: '2px 6px',
                                    background: '#eff6ff',
                                    color: '#1d4ed8',
                                    borderRadius: '4px',
                                    border: '1px solid #bfdbfe',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                  }}
                                >
                                  ✉️ Email
                                </a>
                              )}
                            </div>
                          </td>

                          <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                            {cust.assignedTo ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <span style={{
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    color: isAssignedToMe ? '#3730a3' : '#0369a1',
                                    background: isAssignedToMe ? '#e0e7ff' : '#f0f9ff',
                                    padding: '2px 7px',
                                    borderRadius: '6px',
                                    border: isAssignedToMe ? '1px solid #c7d2fe' : '1px solid #bae6fd',
                                  }}>
                                    👤 {cust.assignedTo} {isAssignedToMe && '(You)'}
                                  </span>

                                  {!isAssignedToMe && canPerformAction('customers') && (
                                    parsed.metadata?.claimRequest?.status === 'PENDING' ? (
                                      canApproveClaimTransfer ? (
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                          <button
                                            type="button"
                                            onClick={() => handleApproveClaimTransfer(cust)}
                                            title={`Approve transfer to ${parsed.metadata.claimRequest.requestedBy}`}
                                            style={{
                                              padding: '2px 6px',
                                              borderRadius: '4px',
                                              background: '#dcfce7',
                                              color: '#15803d',
                                              border: '1px solid #86efac',
                                              fontSize: '0.68rem',
                                              fontWeight: 800,
                                              cursor: 'pointer',
                                            }}
                                          >
                                            ✓ Approve
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRejectClaimTransfer(cust)}
                                            title="Reject transfer request"
                                            style={{
                                              padding: '2px 6px',
                                              borderRadius: '4px',
                                              background: '#fee2e2',
                                              color: '#b91c1c',
                                              border: '1px solid #fca5a5',
                                              fontSize: '0.68rem',
                                              fontWeight: 800,
                                              cursor: 'pointer',
                                            }}
                                          >
                                            ✗
                                          </button>
                                        </div>
                                      ) : (
                                        <span style={{
                                          fontSize: '0.68rem',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          background: '#fef3c7',
                                          color: '#b45309',
                                          border: '1px solid #fde68a',
                                          fontWeight: 700,
                                        }}>
                                          ⏳ Transfer Pending
                                        </span>
                                      )
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenRequestTransfer(cust)}
                                        title={`Customer called your line? Request ownership transfer from ${cust.assignedTo} (Requires Team Head / Admin approval)`}
                                        style={{
                                          fontSize: '0.68rem',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          background: '#ffffff',
                                          border: '1px solid #cbd5e1',
                                          color: '#475569',
                                          cursor: 'pointer',
                                          fontWeight: 700,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '2px',
                                        }}
                                      >
                                        <span>🔄</span> Transfer
                                      </button>
                                    )
                                  )}
                                </div>
                                {parsed.metadata?.claimRequest?.status === 'PENDING' && (
                                  <div style={{ fontSize: '0.66rem', color: '#b45309', background: '#fffbeb', padding: '1px 5px', borderRadius: '4px', border: '1px solid #fde68a', marginTop: '2px' }}>
                                    Req by: <strong>{parsed.metadata.claimRequest.requestedBy}</strong>
                                  </div>
                                )}
                              </div>
                            ) : (
                            <button
                              type="button"
                              onClick={() => handleClaimCustomer(cust)}
                              title="Click to claim and manage this unassigned client"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: '#fef3c7',
                                color: '#b45309',
                                border: '1px solid #fde68a',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              👤 Claim Account
                            </button>
                          )}
                          </td>

                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>{cust.industry}</div>
                            {parsed.requirementsText && (
                              <div
                                style={{
                                  fontSize: '0.72rem',
                                  color: '#334155',
                                  marginTop: '3px',
                                  background: '#f8fafc',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid #e2e8f0',
                                  maxWidth: '220px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={parsed.requirementsText}
                              >
                                📝 {parsed.requirementsText}
                              </div>
                            )}
                            {parsed.activities.length > 0 && (
                              <span style={{
                                display: 'inline-block',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: '#7e22ce',
                                background: '#faf5ff',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                border: '1px solid #f3e8ff',
                                marginTop: '3px',
                              }}>
                                💬 {parsed.activities.length} touchpoint(s)
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                            <span style={{
                              padding: '3px 9px',
                              borderRadius: '9999px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              background: statusBg,
                              color: statusColor,
                              border: `1px solid ${statusBorder}`,
                            }}>
                              {statusLabel}
                            </span>
                          </td>

                          <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }}>
                              {/* Prominent Quick Log Call / Note Action */}
                              {canPerformAction('customers') && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenLogTouchpoint(cust)}
                                  title="Log a phone call, client meeting, or follow-up note"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    padding: '0.38rem 0.75rem',
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
                                  <span>📞</span> Log Call
                                </button>
                              )}

                              {/* Convert to Contact */}
                              {canPerformAction('contacts') && (
                                <button
                                  type="button"
                                  onClick={() => handleConvertCustomerToContact(cust)}
                                  title={`Register ${cust.contactPerson || cust.companyName} as a Key Contact in directory`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.38rem 0.65rem',
                                    borderRadius: '6px',
                                    background: '#eff6ff',
                                    color: '#1d4ed8',
                                    border: '1px solid #bfdbfe',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <span>👤</span> To Contact
                                </button>
                              )}

                              {/* Details & Account Hub */}
                              <button
                                type="button"
                                onClick={() => handleOpenCustomerDetails(cust)}
                                title="Open Complete Account Hub & Timeline"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.38rem 0.65rem',
                                  borderRadius: '6px',
                                  background: '#ffffff',
                                  color: '#334155',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                <span>👁️</span> Details
                              </button>

                              {/* Edit Profile */}
                              {canPerformAction('customers') && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditCustomerModal(cust)}
                                  title="Edit Customer Profile & Requirements"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.38rem 0.65rem',
                                    borderRadius: '6px',
                                    background: '#eff6ff',
                                    color: '#1d4ed8',
                                    border: '1px solid #bfdbfe',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <span>✏️</span> Edit
                                </button>
                              )}

                              {/* Quotation Proposal Button */}
                              {canPerformAction('sales') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    router.push(`/sales/quotations?customer=${encodeURIComponent(cust.companyName)}`);
                                  }}
                                  title="Generate Quotation for this Customer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.38rem 0.65rem',
                                    borderRadius: '6px',
                                    background: '#faf5ff',
                                    color: '#7e22ce',
                                    border: '1px solid #e9d5ff',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <span>📄</span> Quote
                                </button>
                              )}

                              {/* Delete Customer */}
                              {canPerformAction('customers') ? (
                                <button
                                  type="button"
                                  onClick={() => setItemToDelete({ type: 'customer', item: cust, name: cust.companyName })}
                                  style={{
                                    padding: '0.38rem 0.55rem',
                                    borderRadius: '6px',
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CONTACTS TAB CONTENT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'contacts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!canPerformAction('contacts') && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.65rem 1.25rem',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
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

          {/* Stakeholders & SPOC KPI Cards */}
          {(() => {
            const totalContacts = contacts.length;
            const uniqueCompanies = new Set(contacts.map(c => c.companyName).filter(Boolean)).size;
            const phoneReady = contacts.filter(c => c.phone).length;
            const primarySpocs = contacts.filter(c => (c.role || '').toLowerCase().includes('primary')).length;

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
                <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem 1.15rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>TOTAL STAKEHOLDERS</span>
                    <span style={{ fontSize: '1.2rem' }}>👥</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{totalContacts}</div>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Registered B2B decision makers</span>
                </div>

                <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem 1.15rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>CLIENT ACCOUNTS</span>
                    <span style={{ fontSize: '1.2rem' }}>🏢</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{uniqueCompanies}</div>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Distinct client organizations</span>
                </div>

                <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #bbf7d0', padding: '1rem 1.15rem', boxShadow: '0 1px 3px rgba(34,197,94,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#166534' }}>CALL &amp; WHATSAPP READY</span>
                    <span style={{ fontSize: '1.2rem' }}>📞</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#14532d' }}>{phoneReady}</div>
                  <span style={{ fontSize: '0.74rem', color: '#15803d', fontWeight: 600 }}>Verified mobile numbers</span>
                </div>

                <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #c7d2fe', padding: '1rem 1.15rem', boxShadow: '0 1px 3px rgba(99,102,241,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4338ca' }}>PRIMARY SPOCs</span>
                    <span style={{ fontSize: '1.2rem' }}>⭐</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3730a3' }}>{primarySpocs}</div>
                  <span style={{ fontSize: '0.74rem', color: '#6366f1', fontWeight: 600 }}>Key point of contacts</span>
                </div>
              </div>
            );
          })()}

          {/* Main Card */}
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {/* Filter Bar with Role Filter Pills */}
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}>
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

              {/* Role Filter Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b', marginRight: '0.2rem' }}>Role:</span>
                {[
                  { id: 'ALL', label: 'All Roles' },
                  { id: 'PRIMARY', label: '⭐ Primary SPOC' },
                  { id: 'PROCUREMENT', label: '🛒 Purchase / Procurement' },
                  { id: 'FINANCE', label: '💳 Finance / Accounts' },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setContactRoleFilter(pill.id)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: contactRoleFilter === pill.id ? 800 : 600,
                      border: contactRoleFilter === pill.id ? '1px solid #7f22fe' : '1px solid #e2e8f0',
                      background: contactRoleFilter === pill.id ? '#f3e8ff' : '#ffffff',
                      color: contactRoleFilter === pill.id ? '#7e22ce' : '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredContacts.length === 0 ? (
              <EmptyState
                icon="👥"
                title="No Contacts Registered"
                description="No key decision makers or client stakeholders match your filter. Click 'Add Contact' to maintain your business communication directory."
                actionLabel="Add Contact"
                onAction={() => setShowAddContactModal(true)}
              />
            ) : (
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                      <th style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>Contact Person</th>
                      <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Client Organization</th>
                      <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Designation / Stakeholder Role</th>
                      <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Instant Communication</th>
                      <th style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>Source</th>
                      <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions &amp; Follow-up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContacts.map((cnt) => {
                      const matchedCustomer = customers.find(
                        c => String(c.companyName || '').toLowerCase() === String(cnt.companyName || '').toLowerCase()
                      );
                      const isPrimary = String(cnt.role || '').toLowerCase().includes('primary');
                      const isProcurement = String(cnt.role || '').toLowerCase().includes('procurement') || String(cnt.role || '').toLowerCase().includes('purchase');
                      const isFinance = String(cnt.role || '').toLowerCase().includes('finance') || String(cnt.role || '').toLowerCase().includes('account');
                      const cleanPhone = (cnt.phone || '').replace(/\D/g, '').slice(-10);

                      return (
                        <tr key={cnt.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          {/* Contact Person Name & Avatar */}
                          <td style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                              <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: isPrimary ? '#f3e8ff' : '#e0f2fe',
                                color: isPrimary ? '#7e22ce' : '#0369a1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.84rem',
                                border: isPrimary ? '1px solid #d8b4fe' : '1px solid #bae6fd',
                                flexShrink: 0,
                              }}>
                                {String(cnt.name || 'C').slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{cnt.name}</div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>
                                  Added: {cnt.createdAt ? new Date(cnt.createdAt).toLocaleDateString() : '—'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Client Organization (Clickable link to Customer Hub) */}
                          <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                            {matchedCustomer ? (
                              <button
                                type="button"
                                onClick={() => handleOpenCustomerDetails(matchedCustomer)}
                                title={`Click to open ${cnt.companyName} Customer Workspace`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '6px',
                                  background: '#f8fafc',
                                  color: '#334155',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                <span>🏢</span>
                                <span>{cnt.companyName}</span>
                                <span style={{ color: '#7f22fe', fontSize: '0.72rem' }}>↗</span>
                              </button>
                            ) : (
                              <span style={{ fontWeight: 600, color: '#334155' }}>
                                {cnt.companyName || '—'}
                              </span>
                            )}
                          </td>

                          {/* Designation / Role */}
                          <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              background: isPrimary ? '#faf5ff' : isProcurement ? '#eff6ff' : isFinance ? '#f0fdf4' : '#f8fafc',
                              color: isPrimary ? '#7e22ce' : isProcurement ? '#1d4ed8' : isFinance ? '#15803d' : '#475569',
                              border: isPrimary ? '1px solid #e9d5ff' : isProcurement ? '1px solid #bfdbfe' : isFinance ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                            }}>
                              <span>{isPrimary ? '⭐' : isProcurement ? '🛒' : isFinance ? '💳' : '👤'}</span>
                              <span>{cnt.role || 'Primary Account Contact'}</span>
                            </span>
                          </td>

                          {/* Instant Communication Channels */}
                          <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {cnt.phone && (
                                <>
                                  <a
                                    href={`tel:${cnt.phone}`}
                                    title={`Call ${cnt.name} (${cnt.phone})`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.2rem',
                                      padding: '2px 7px',
                                      background: '#f0fdf4',
                                      color: '#15803d',
                                      borderRadius: '4px',
                                      border: '1px solid #bbf7d0',
                                      fontSize: '0.74rem',
                                      fontWeight: 700,
                                      textDecoration: 'none',
                                    }}
                                  >
                                    📞 {cnt.phone}
                                  </a>
                                  <a
                                    href={`https://wa.me/91${cleanPhone}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title={`WhatsApp message to ${cnt.name}`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.2rem',
                                      padding: '2px 7px',
                                      background: '#ecfdf5',
                                      color: '#047857',
                                      borderRadius: '4px',
                                      border: '1px solid #a7f3d0',
                                      fontSize: '0.74rem',
                                      fontWeight: 700,
                                      textDecoration: 'none',
                                    }}
                                  >
                                    💬 WA
                                  </a>
                                </>
                              )}

                              {cnt.email && (
                                <a
                                  href={`mailto:${cnt.email}`}
                                  title={`Send Email to ${cnt.email}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                    padding: '2px 7px',
                                    background: '#eff6ff',
                                    color: '#1d4ed8',
                                    borderRadius: '4px',
                                    border: '1px solid #bfdbfe',
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                  }}
                                >
                                  ✉️ Email
                                </a>
                              )}

                              {!cnt.phone && !cnt.email && (
                                <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>— No channels recorded</span>
                              )}
                            </div>
                          </td>

                          {/* Source / Channel */}
                          <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                            <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, background: '#f1f5f9', color: '#475569' }}>
                              {cnt.channel || 'Direct'}
                            </span>
                          </td>

                          {/* Actions Column */}
                          <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                              {/* Move to Deal Opportunity Pipeline */}
                              {canPerformAction('opportunities') && (
                                <button
                                  type="button"
                                  onClick={() => handleConvertContactToOpportunity(cnt)}
                                  title={`Promote ${cnt.name} (${cnt.companyName}) into Deal Opportunities Pipeline`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.28rem',
                                    padding: '0.36rem 0.72rem',
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
                                  <span>💼</span> Move to Deal
                                </button>
                              )}

                              {/* View Details */}
                              <button
                                type="button"
                                onClick={() => setViewingContact(cnt)}
                                title="View Complete Contact Profile"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '6px',
                                  background: '#ffffff',
                                  color: '#334155',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                <span>👁️</span> Details
                              </button>

                              {/* Edit Profile */}
                              {canPerformAction('contacts') && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditContact(cnt)}
                                  title="Edit Contact Designation & Channels"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '6px',
                                    background: '#eff6ff',
                                    color: '#1d4ed8',
                                    border: '1px solid #bfdbfe',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <span>✏️</span> Edit
                                </button>
                              )}

                              {/* Log Touchpoint / Discussion Note */}
                              {canPerformAction('customers') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const targetCust = matchedCustomer || {
                                      companyName: cnt.companyName,
                                      contactPerson: cnt.name,
                                      phone: cnt.phone,
                                      email: cnt.email,
                                    };
                                    handleOpenLogTouchpoint(targetCust);
                                  }}
                                  title={`Log Call or Discussion Note with ${cnt.name}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '6px',
                                    background: '#faf5ff',
                                    color: '#7e22ce',
                                    border: '1px solid #e9d5ff',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <span>📞</span> Note
                                </button>
                              )}

                              {/* Delete Contact */}
                              {canPerformAction('contacts') ? (
                                <button
                                  type="button"
                                  onClick={() => setItemToDelete({ type: 'contact', item: cnt, name: cnt.name })}
                                  style={{
                                    padding: '0.35rem 0.55rem',
                                    borderRadius: '6px',
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
              onAction={() => handleOpenNewOpportunityModal()}
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
                    <tr
                      key={opp.id}
                      onClick={() => handleOpenManageOpportunity(opp)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      title="Click row to open Deal Workspace & Pipeline Modal"
                    >
                      <td style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 800, color: '#7f22fe' }}>{opp.title}</div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          Created: {opp.createdAt ? new Date(opp.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {opp.companyName}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        {renderStageBadge(opp.stage)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {opp.value ? (String(opp.value).startsWith('₹') ? opp.value : `₹ ${Number(opp.value) ? Number(opp.value).toLocaleString('en-IN') : opp.value}`) : '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#16a34a', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {opp.probability}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {opp.expectedCloseDate ? new Date(opp.expectedCloseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenManageOpportunity(opp);
                            }}
                            title="Open Deal Pipeline Workspace"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              background: '#f3e8ff',
                              color: '#7e22ce',
                              border: '1px solid #d8b4fe',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <span>💼</span> Manage Deal
                          </button>
                          <a
                            href={`/sales/quotations?customer=${encodeURIComponent(opp.companyName)}`}
                            onClick={(e) => e.stopPropagation()}
                            title="Generate Formal Sales Quotation for this Deal"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              textDecoration: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <span>📄</span> Quotation ↗
                          </a>
                          {canPerformAction('opportunities') ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setItemToDelete({ type: 'opportunity', item: opp, name: opp.title });
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
                onChange={(e) => setCustomerForm({ ...customerForm, gstin: e.target.value.toUpperCase() })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontFamily: 'monospace' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                PAN Number
              </label>
              <input
                type="text"
                placeholder="e.g. ABCDE1234F"
                value={customerForm.pan}
                onChange={(e) => setCustomerForm({ ...customerForm, pan: e.target.value.toUpperCase() })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontFamily: 'monospace' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Mobile / Phone Number
              </label>
              <input
                type="text"
                placeholder="e.g. 9876543210"
                value={customerForm.phone}
                onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
              />
            </div>
          </div>

          {/* Address & Commercials Section */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '0.65rem' }}>
              📍 Billing &amp; Delivery Address (KYC)
            </span>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: '#334155' }}>
                Registered Billing Street Address
              </label>
              <input
                type="text"
                placeholder="Plot / Flat No, Industrial Area, Road..."
                value={customerForm.billingAddress}
                onChange={(e) => setCustomerForm({ ...customerForm, billingAddress: e.target.value })}
                style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.84rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', color: '#334155' }}>
                  City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai / Delhi"
                  value={customerForm.city}
                  onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.84rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', color: '#334155' }}>
                  State
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maharashtra"
                  value={customerForm.state}
                  onChange={(e) => setCustomerForm({ ...customerForm, state: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.84rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', color: '#334155' }}>
                  PIN Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. 400001"
                  value={customerForm.pincode}
                  onChange={(e) => setCustomerForm({ ...customerForm, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.84rem' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', color: '#334155' }}>
                Payment Terms
              </label>
              <input
                type="text"
                placeholder="e.g. Net 30 Days / 50% Advance / Immediate"
                value={customerForm.paymentTerms}
                onChange={(e) => setCustomerForm({ ...customerForm, paymentTerms: e.target.value })}
                style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.84rem' }}
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
      {/* MODAL 2B: CUSTOMER ACCOUNT HUB & ACTIVITY WORKSPACE */}
      {/* ------------------------------------------------------------- */}
      <Modal isOpen={Boolean(viewingCustomer)} onClose={() => setViewingCustomer(null)} title="Customer Account Workspace & Relationship Hub 🏢">
        {viewingCustomer && (() => {
          const parsed = parseCustomerRequirementsAndLogs(viewingCustomer.requirements);
          const isAssignedToMe = String(viewingCustomer.assignedTo || '').toLowerCase() === currentRepName.toLowerCase();
          const matchedOpportunities = (opportunities || []).filter(
            (o) => String(o?.companyName || '').toLowerCase().trim() === String(viewingCustomer.companyName || '').toLowerCase().trim()
          );

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              {/* Account Header Bar with Quick Status Selector */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                    {viewingCustomer.companyName}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span>Industry: <strong>{viewingCustomer.industry || 'Technology & IT'}</strong></span>
                    <span>•</span>
                    <span>Rep: <strong style={{ color: isAssignedToMe ? '#4338ca' : '#0284c7' }}>{viewingCustomer.assignedTo || 'Unassigned'}</strong> {isAssignedToMe && '(You)'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                  {/* Quick Status Dropdown */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>Stage:</span>
                    <select
                      value={viewingCustomer.status || 'ACTIVE'}
                      onChange={(e) => handleQuickStatusChange(viewingCustomer, e.target.value)}
                      disabled={!canPerformAction('customers')}
                      style={{
                        padding: '0.38rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        background: '#ffffff',
                        color: viewingCustomer.status === 'FOLLOW_UP_NEEDED' ? '#b45309' : '#0f172a',
                      }}
                    >
                      <option value="ACTIVE">ACTIVE CLIENT</option>
                      <option value="ONBOARDING">ONBOARDING STAGE</option>
                      <option value="FOLLOW_UP_NEEDED">FOLLOW-UP NEEDED</option>
                      <option value="KEY_ACCOUNT">KEY VIP ACCOUNT ⭐</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </div>

                  {!isAssignedToMe && canPerformAction('customers') && (
                    !viewingCustomer.assignedTo ? (
                      <button
                        type="button"
                        onClick={() => handleClaimCustomer(viewingCustomer)}
                        style={{
                          padding: '0.38rem 0.75rem',
                          borderRadius: '6px',
                          border: '1px solid #c7d2fe',
                          background: '#e0e7ff',
                          color: '#4338ca',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        👤 Claim Account
                      </button>
                    ) : parsed.metadata?.claimRequest?.status === 'PENDING' ? (
                      canApproveClaimTransfer ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => handleApproveClaimTransfer(viewingCustomer)}
                            style={{
                              padding: '0.35rem 0.65rem',
                              borderRadius: '6px',
                              background: '#dcfce7',
                              color: '#15803d',
                              border: '1px solid #86efac',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            ✓ Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectClaimTransfer(viewingCustomer)}
                            style={{
                              padding: '0.35rem 0.55rem',
                              borderRadius: '6px',
                              background: '#fee2e2',
                              color: '#b91c1c',
                              border: '1px solid #fca5a5',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            ✗
                          </button>
                        </div>
                      ) : (
                        <span style={{
                          fontSize: '0.74rem',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          background: '#fef3c7',
                          color: '#b45309',
                          border: '1px solid #fde68a',
                          fontWeight: 700,
                        }}>
                          ⏳ Transfer Pending
                        </span>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenRequestTransfer(viewingCustomer)}
                        title={`Customer called your line? Request account transfer from ${viewingCustomer.assignedTo}`}
                        style={{
                          padding: '0.38rem 0.75rem',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#475569',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <span>🔄</span> Request Transfer
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Pending Transfer Approval Alert Banner inside Customer Hub */}
              {parsed.metadata?.claimRequest?.status === 'PENDING' && (
                <div style={{
                  padding: '0.9rem 1.15rem',
                  background: '#fffbeb',
                  borderRadius: '8px',
                  border: '1px solid #fde68a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                    <span style={{ fontSize: '1.35rem' }}>⏳</span>
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#92400e' }}>
                        Customer Account Transfer Request Pending
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#b45309', marginTop: '2px', lineHeight: 1.5 }}>
                        Representative <strong>{parsed.metadata.claimRequest.requestedBy}</strong> has requested to claim this account from <strong>{parsed.metadata.claimRequest.currentRep}</strong>.
                        <br />
                        Customer Call Reason: <em>"{parsed.metadata.claimRequest.reason}"</em>
                      </div>
                    </div>
                  </div>

                  {canApproveClaimTransfer ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => handleApproveClaimTransfer(viewingCustomer)}
                        style={{
                          padding: '0.45rem 0.95rem',
                          borderRadius: '6px',
                          background: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
                        }}
                      >
                        ✓ Approve Transfer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectClaimTransfer(viewingCustomer)}
                        style={{
                          padding: '0.45rem 0.85rem',
                          borderRadius: '6px',
                          background: '#ffffff',
                          color: '#dc2626',
                          border: '1px solid #fca5a5',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        ✗ Reject
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.76rem', color: '#b45309', fontWeight: 700, background: '#fef3c7', padding: '4px 8px', borderRadius: '6px' }}>
                      Awaiting review by Team Head, Dept Head, or Admin
                    </span>
                  )}
                </div>
              )}

              {/* Quick Communication Actions Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 1rem',
                background: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {viewingCustomer.phone && (
                    <>
                      <a
                        href={`tel:${viewingCustomer.phone}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.4rem 0.8rem',
                          background: '#f0fdf4',
                          color: '#166534',
                          border: '1px solid #bbf7d0',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          textDecoration: 'none',
                        }}
                      >
                        📞 Call SPOC ({viewingCustomer.phone})
                      </a>
                      <a
                        href={`https://wa.me/91${viewingCustomer.phone.replace(/\D/g, '').slice(-10)}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.4rem 0.8rem',
                          background: '#ecfdf5',
                          color: '#047857',
                          border: '1px solid #a7f3d0',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          textDecoration: 'none',
                        }}
                      >
                        💬 WhatsApp
                      </a>
                    </>
                  )}

                  {viewingCustomer.email && (
                    <a
                      href={`mailto:${viewingCustomer.email}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.4rem 0.8rem',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      ✉️ Email Client
                    </a>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {canPerformAction('contacts') && (
                    <button
                      type="button"
                      onClick={() => {
                        const cust = viewingCustomer;
                        setViewingCustomer(null);
                        handleConvertCustomerToContact(cust);
                      }}
                      title={`Register ${viewingCustomer.contactPerson || viewingCustomer.companyName} into Contacts directory`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.45rem 0.85rem',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <span>👤</span> + Move to Contacts
                    </button>
                  )}

                  {canPerformAction('opportunities') && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpportunityForm({
                          title: `Deal - ${viewingCustomer.companyName}`,
                          companyName: viewingCustomer.companyName,
                          stage: 'DISCOVERY',
                          value: '',
                          expectedCloseDate: '',
                          probability: '50%',
                        });
                        setShowAddOpportunityModal(true);
                      }}
                      title={`Create a new sales deal / opportunity for ${viewingCustomer.companyName}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.45rem 0.85rem',
                        background: '#faf5ff',
                        color: '#7e22ce',
                        border: '1px solid #d8b4fe',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <span>💼</span> + New Deal / Opportunity
                    </button>
                  )}

                  {canPerformAction('customers') && (
                    <button
                      type="button"
                      onClick={() => handleOpenLogTouchpoint(viewingCustomer)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.45rem 0.95rem',
                        background: '#7f22fe',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(127, 34, 254, 0.25)',
                      }}
                    >
                      <span>📞</span> + Log Touchpoint / Call Note
                    </button>
                  )}
                </div>
              </div>

              {/* Internal Modal Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setCustomerModalTab('overview')}
                  style={{
                    padding: '0.55rem 1rem',
                    fontWeight: customerModalTab === 'overview' ? 800 : 600,
                    color: customerModalTab === 'overview' ? '#7f22fe' : '#64748b',
                    borderBottom: customerModalTab === 'overview' ? '2px solid #7f22fe' : '2px solid transparent',
                    background: 'transparent',
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                  }}
                >
                  🏢 Account Overview &amp; Scope
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerModalTab('timeline')}
                  style={{
                    padding: '0.55rem 1rem',
                    fontWeight: customerModalTab === 'timeline' ? 800 : 600,
                    color: customerModalTab === 'timeline' ? '#7f22fe' : '#64748b',
                    borderBottom: customerModalTab === 'timeline' ? '2px solid #7f22fe' : '2px solid transparent',
                    background: 'transparent',
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <span>📞 Interaction Timeline</span>
                  <span style={{
                    fontSize: '0.72rem',
                    background: parsed.activities.length > 0 ? '#f3e8ff' : '#f1f5f9',
                    color: parsed.activities.length > 0 ? '#7e22ce' : '#64748b',
                    padding: '1px 6px',
                    borderRadius: '9999px',
                    fontWeight: 800,
                  }}>
                    {parsed.activities.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerModalTab('deals')}
                  style={{
                    padding: '0.55rem 1rem',
                    fontWeight: customerModalTab === 'deals' ? 800 : 600,
                    color: customerModalTab === 'deals' ? '#7f22fe' : '#64748b',
                    borderBottom: customerModalTab === 'deals' ? '2px solid #7f22fe' : '2px solid transparent',
                    background: 'transparent',
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <span>💼 Deals &amp; Opportunities</span>
                  <span style={{
                    fontSize: '0.72rem',
                    background: matchedOpportunities.length > 0 ? '#dcfce7' : '#f1f5f9',
                    color: matchedOpportunities.length > 0 ? '#15803d' : '#64748b',
                    padding: '1px 6px',
                    borderRadius: '9999px',
                    fontWeight: 800,
                  }}>
                    {matchedOpportunities.length}
                  </span>
                </button>
              </div>

              {/* TAB 1: OVERVIEW & SCOPE */}
              {customerModalTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                    <div style={{ padding: '0.8rem 1rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                        Primary Contact Person
                      </span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                        {viewingCustomer.contactPerson || '—'}
                      </span>
                    </div>

                    <div style={{ padding: '0.8rem 1rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                        GSTIN / Tax ID
                      </span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                        {viewingCustomer.gstin || '—'}
                      </span>
                    </div>

                    <div style={{ padding: '0.8rem 1rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                        Official Email
                      </span>
                      <span style={{ fontSize: '0.85rem', color: '#0f172a' }}>
                        {viewingCustomer.email || '—'}
                      </span>
                    </div>

                    <div style={{ padding: '0.8rem 1rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                        Mobile / Phone Number
                      </span>
                      <span style={{ fontSize: '0.85rem', color: '#0f172a' }}>
                        {viewingCustomer.phone || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Commercial Terms & Tax Profile */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                    <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                        PAN Number
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                        {parsed.metadata?.pan || '— Not Provided'}
                      </span>
                    </div>

                    <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                        Payment Terms
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                        {parsed.metadata?.paymentTerms || 'Standard (Net 30 Days)'}
                      </span>
                    </div>

                    <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                        Official Website
                      </span>
                      {parsed.metadata?.website ? (
                        <a
                          href={parsed.metadata.website.startsWith('http') ? parsed.metadata.website : `https://${parsed.metadata.website}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '0.84rem', color: '#7f22fe', fontWeight: 700, textDecoration: 'underline' }}
                        >
                          {parsed.metadata.website} ↗
                        </a>
                      ) : (
                        <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>— Not Provided</span>
                      )}
                    </div>
                  </div>

                  {/* Registered Billing & Shipping Address Cards */}
                  {Boolean(parsed.metadata?.billingAddress || parsed.metadata?.city || parsed.metadata?.state || parsed.metadata?.pincode) ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
                      <div style={{ padding: '0.9rem 1.1rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                          <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span>📍</span> Registered Billing Address
                          </span>
                          <span style={{ fontSize: '0.7rem', padding: '1px 6px', background: '#f1f5f9', color: '#475569', borderRadius: '4px', fontWeight: 600 }}>
                            Tax / Invoice Site
                          </span>
                        </div>
                        <div style={{ fontSize: '0.86rem', color: '#334155', lineHeight: 1.55 }}>
                          {parsed.metadata?.billingAddress && (
                            <div>{parsed.metadata.billingAddress}</div>
                          )}
                          <div>
                            {[parsed.metadata?.city, parsed.metadata?.state].filter(Boolean).join(', ')}
                            {parsed.metadata?.pincode && ` - ${parsed.metadata.pincode}`}
                          </div>
                          {parsed.metadata?.country && (
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>{parsed.metadata.country}</div>
                          )}
                        </div>
                      </div>

                      <div style={{ padding: '0.9rem 1.1rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                          <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span>🚚</span> Shipping / Delivery Site
                          </span>
                          <span style={{ fontSize: '0.7rem', padding: '1px 6px', background: '#f1f5f9', color: '#475569', borderRadius: '4px', fontWeight: 600 }}>
                            Warehouse / Logistics
                          </span>
                        </div>
                        <div style={{ fontSize: '0.86rem', color: '#334155', lineHeight: 1.55 }}>
                          {parsed.metadata?.shippingAddress ? (
                            <div>{parsed.metadata.shippingAddress}</div>
                          ) : (
                            <div style={{ color: '#64748b', fontStyle: 'italic' }}>
                              Same as Registered Billing Address
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Prompt when address is missing */
                    <div style={{
                      padding: '0.9rem 1.15rem',
                      background: '#fffbeb',
                      borderRadius: '8px',
                      border: '1px solid #fde68a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>📍</span>
                        <div>
                          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#92400e' }}>
                            Customer Address &amp; KYC Incomplete
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#b45309', marginTop: '2px' }}>
                            Lead convert hone ke baad Billing Address aur Delivery details customer onboarding rep yahan se fill karta hai.
                          </div>
                        </div>
                      </div>

                      {canPerformAction('customers') && (
                        <button
                          type="button"
                          onClick={() => {
                            const cust = viewingCustomer;
                            setViewingCustomer(null);
                            handleOpenEditCustomerModal(cust);
                          }}
                          style={{
                            padding: '0.45rem 0.95rem',
                            borderRadius: '6px',
                            background: '#d97706',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          ✏️ Add Address &amp; KYC Info
                        </button>
                      )}
                    </div>
                  )}

                  {/* Customer Requirements & Scope of Work Editor */}
                  <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 800, textTransform: 'uppercase' }}>
                        📝 Customer Requirements &amp; Scope of Work (Carried from Lead)
                      </span>
                      {canPerformAction('customers') && (
                        <button
                          type="button"
                          onClick={handleSaveInlineRequirements}
                          disabled={isSavingInlineReq}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            background: '#7f22fe',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: isSavingInlineReq ? 'wait' : 'pointer',
                          }}
                        >
                          {isSavingInlineReq ? 'Saving...' : 'Save Scope Updates'}
                        </button>
                      )}
                    </div>
                    {canPerformAction('customers') ? (
                      <textarea
                        rows={3}
                        value={inlineReqDraft}
                        onChange={(e) => setInlineReqDraft(e.target.value)}
                        placeholder="Detail the exact customer requirements, required quantities, customization needs, or delivery timelines..."
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.84rem',
                          background: '#ffffff',
                          color: '#0f172a',
                          lineHeight: 1.5,
                        }}
                      />
                    ) : (
                      <p style={{ margin: 0, fontSize: '0.86rem', color: parsed.requirementsText ? '#1e293b' : '#94a3b8', lineHeight: 1.5 }}>
                        {parsed.requirementsText || 'No specific product requirements recorded yet.'}
                      </p>
                    )}
                  </div>

                  {/* Sales Handover Section */}
                  {canPerformAction('sales') ? (
                    <div style={{ padding: '1rem', background: '#f5f0ff', borderRadius: '8px', border: '1px solid #ebdfff' }}>
                      <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#5b21b6', marginBottom: '0.35rem' }}>
                        ⚡ Sales Execution Actions for {viewingCustomer.companyName}:
                      </span>
                      <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.78rem', color: '#6b21a8' }}>
                        Requirements finalize ho chuki hain. Yahan se direct Quotation banayein ya Sales Order issue karein.
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
                          }}
                        >
                          <span>🛒</span> Create Sales Order ➡️
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '0.85rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>🤝</span>
                      <span style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.5 }}>
                        <strong>Customer Management &amp; Sales Handover:</strong> Is customer ki verified requirements aur interaction logs yahan maintain karein. Sales team in requirements ke aadhar par Quotation aur Order process karegi.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: INTERACTION & ACTIVITY TIMELINE */}
              {customerModalTab === 'timeline' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Quick Inline Log Touchpoint Box */}
                  {canPerformAction('customers') && (
                    <div style={{ padding: '0.9rem 1rem', background: '#faf5ff', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                      <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#6b21a8', marginBottom: '0.5rem' }}>
                        📞 Record New Call / Discussion Note:
                      </span>
                      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 140px', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                        <select
                          value={touchpointForm.type}
                          onChange={(e) => setTouchpointForm({ ...touchpointForm, type: e.target.value })}
                          style={{ padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', background: '#ffffff' }}
                        >
                          <option value="CALL">📞 Phone Call</option>
                          <option value="MEETING">🤝 Client Meeting</option>
                          <option value="EMAIL">✉️ Email Update</option>
                          <option value="NOTE">📝 Account Note</option>
                          <option value="ISSUE">⚠️ Client Grievance</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Summary / Discussion note..."
                          value={touchpointForm.notes}
                          onChange={(e) => setTouchpointForm({ ...touchpointForm, notes: e.target.value })}
                          style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', background: '#ffffff' }}
                        />
                        <button
                          type="button"
                          onClick={(e) => handleSaveTouchpoint(e, viewingCustomer)}
                          disabled={isSavingTouchpoint}
                          style={{
                            padding: '0.45rem 0.85rem',
                            borderRadius: '6px',
                            background: '#7f22fe',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: isSavingTouchpoint ? 'wait' : 'pointer',
                          }}
                        >
                          {isSavingTouchpoint ? 'Saving...' : 'Save Log'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Activity Timeline List */}
                  {parsed.activities.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                      <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.35rem' }}>📋</span>
                      <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.9rem' }}>No Touchpoints Logged Yet</div>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                        Record customer phone calls, feedback, or follow-up notes using the form above to track relationship history.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                      {parsed.activities.map((act) => {
                        let icon = '📞';
                        let badgeBg = '#f0fdf4';
                        let badgeColor = '#166534';
                        if (act.type === 'MEETING') { icon = '🤝'; badgeBg = '#eff6ff'; badgeColor = '#1d4ed8'; }
                        if (act.type === 'EMAIL') { icon = '✉️'; badgeBg = '#f5f3ff'; badgeColor = '#6d28d9'; }
                        if (act.type === 'NOTE') { icon = '📝'; badgeBg = '#f8fafc'; badgeColor = '#475569'; }
                        if (act.type === 'ISSUE') { icon = '⚠️'; badgeBg = '#fef2f2'; badgeColor = '#b91c1c'; }

                        return (
                          <div
                            key={act.id || act.createdAt}
                            style={{
                              padding: '0.85rem 1rem',
                              background: '#ffffff',
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                              borderLeft: `4px solid ${badgeColor}`,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <span style={{ padding: '2px 7px', borderRadius: '4px', background: badgeBg, color: badgeColor, fontSize: '0.72rem', fontWeight: 800 }}>
                                  {icon} {act.type || 'CALL'}
                                </span>
                                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                                  {act.title || 'Client Discussion'}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                {act.createdAt ? new Date(act.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </span>
                            </div>

                            <p style={{ margin: '0.25rem 0', fontSize: '0.82rem', color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                              {act.notes}
                            </p>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.45rem', fontSize: '0.72rem', color: '#64748b' }}>
                              <span>Logged by: <strong style={{ color: '#0f172a' }}>{act.authorName || 'Rep'}</strong></span>
                              {act.nextFollowUp && (
                                <span style={{ color: '#b45309', fontWeight: 700, background: '#fffbeb', padding: '1px 6px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                                  📅 Next Follow-Up: {act.nextFollowUp}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: DEALS & OPPORTUNITIES PIPELINE */}
              {customerModalTab === 'deals' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                        Active Revenue Deals for {viewingCustomer.companyName}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        Track commercial proposals, order quotations, and deal closing stages.
                      </div>
                    </div>
                    {canPerformAction('opportunities') && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpportunityForm({
                            title: `Deal - ${viewingCustomer.companyName}`,
                            companyName: viewingCustomer.companyName,
                            stage: 'DISCOVERY',
                            value: '',
                            expectedCloseDate: '',
                            probability: '50%',
                          });
                          setShowAddOpportunityModal(true);
                        }}
                        style={{
                          padding: '0.4rem 0.85rem',
                          borderRadius: '6px',
                          background: '#7f22fe',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <span>+</span> Create New Deal
                      </button>
                    )}
                  </div>

                  {matchedOpportunities.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', background: '#ffffff', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                      <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.35rem' }}>💼</span>
                      <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.9rem' }}>No Active Deals for this Client</div>
                      <p style={{ margin: '0.25rem 0 0.85rem', fontSize: '0.78rem', color: '#64748b' }}>
                        Jab customer se koi naya order, project, ya quotation ki baat shuru ho, yahan se Deal create karein.
                      </p>
                      {canPerformAction('opportunities') && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpportunityForm({
                              title: `Deal - ${viewingCustomer.companyName}`,
                              companyName: viewingCustomer.companyName,
                              stage: 'DISCOVERY',
                              value: '',
                              expectedCloseDate: '',
                              probability: '50%',
                            });
                            setShowAddOpportunityModal(true);
                          }}
                          style={{
                            padding: '0.45rem 0.95rem',
                            borderRadius: '6px',
                            background: '#7f22fe',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          + Create First Opportunity
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '340px', overflowY: 'auto' }}>
                      {matchedOpportunities.map((opp) => (
                        <div
                          key={opp.id}
                          style={{
                            padding: '0.85rem 1rem',
                            background: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 800, color: '#7f22fe', fontSize: '0.9rem' }}>{opp.title}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                              Expected Close: <strong>{opp.expectedCloseDate || '—'}</strong> • Probability: <strong>{opp.probability || '50%'}</strong>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>DEAL VALUE</div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{opp.value || '—'}</div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              {renderStageBadge(opp.stage)}
                              <button
                                type="button"
                                onClick={() => handleOpenManageOpportunity(opp)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  background: '#f3e8ff',
                                  color: '#7e22ce',
                                  border: '1px solid #d8b4fe',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Manage 💼
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Modal Footer Controls */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem' }}>
                {canPerformAction('customers') && (
                  <button
                    type="button"
                    onClick={() => {
                      const toEdit = viewingCustomer;
                      setViewingCustomer(null);
                      handleOpenEditCustomerModal(toEdit);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.55rem 1.25rem',
                      borderRadius: '6px',
                      border: '1px solid #bfdbfe',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                    }}
                  >
                    <span>✏️</span> Edit Profile
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingCustomer(null)}
                  style={{
                    padding: '0.55rem 1.25rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2B-2: DEDICATED LOG CUSTOMER TOUCHPOINT / CALL MODAL */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={Boolean(loggingTouchpointCustomer)}
        onClose={() => setLoggingTouchpointCustomer(null)}
        title="Log Customer Call & Discussion 📞"
      >
        {loggingTouchpointCustomer && (
          <form onSubmit={handleSaveTouchpoint} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '0.85rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>
                {loggingTouchpointCustomer.companyName}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                SPOC: <strong>{loggingTouchpointCustomer.contactPerson || 'Primary Contact'}</strong>
                {loggingTouchpointCustomer.phone && ` • 📞 ${loggingTouchpointCustomer.phone}`}
                {loggingTouchpointCustomer.email && ` • ✉️ ${loggingTouchpointCustomer.email}`}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  Touchpoint Channel *
                </label>
                <select
                  value={touchpointForm.type}
                  onChange={(e) => setTouchpointForm({ ...touchpointForm, type: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '0.84rem' }}
                >
                  <option value="CALL">📞 Phone Call</option>
                  <option value="MEETING">🤝 Client Meeting</option>
                  <option value="EMAIL">✉️ Email Communication</option>
                  <option value="NOTE">📝 Account Note / Status</option>
                  <option value="ISSUE">⚠️ Client Grievance / Ticket</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  Next Follow-Up Date (Optional)
                </label>
                <input
                  type="date"
                  value={touchpointForm.nextFollowUp}
                  onChange={(e) => setTouchpointForm({ ...touchpointForm, nextFollowUp: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '0.84rem' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Subject / Purpose
              </label>
              <input
                type="text"
                placeholder="e.g. Rate discussion for 500 units / KYC verification"
                value={touchpointForm.title}
                onChange={(e) => setTouchpointForm({ ...touchpointForm, title: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '0.84rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Discussion Summary &amp; Client Feedback *
              </label>
              <textarea
                required
                rows={4}
                placeholder="Customer se kya baat hui? (e.g. Spoke with Anand. He approved the specs, wants formal quotation by tomorrow 3 PM)..."
                value={touchpointForm.notes}
                onChange={(e) => setTouchpointForm({ ...touchpointForm, notes: e.target.value })}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '0.84rem', lineHeight: 1.5 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setLoggingTouchpointCustomer(null)}
                style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingTouchpoint}
                style={{
                  padding: '0.6rem 1.35rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#7f22fe',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: isSavingTouchpoint ? 'wait' : 'pointer',
                  boxShadow: '0 2px 6px rgba(127, 34, 254, 0.3)',
                }}
              >
                {isSavingTouchpoint ? 'Saving...' : 'Save Touchpoint'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2C: EDIT CUSTOMER PROFILE */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={Boolean(editingCustomer)}
        onClose={() => setEditingCustomer(null)}
        title="Edit Customer Profile & Requirements 🏢"
      >
        {editingCustomer && (
          <form onSubmit={handleUpdateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  Company / Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={editCustomerForm.companyName}
                  onChange={(e) => setEditCustomerForm({ ...editCustomerForm, companyName: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  GSTIN / Tax ID
                </label>
                <input
                  type="text"
                  value={editCustomerForm.gstin}
                  onChange={(e) => setEditCustomerForm({ ...editCustomerForm, gstin: e.target.value.toUpperCase() })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontFamily: 'monospace' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  Primary Contact Person
                </label>
                <input
                  type="text"
                  value={editCustomerForm.contactPerson}
                  onChange={(e) => setEditCustomerForm({ ...editCustomerForm, contactPerson: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  Official Email Address
                </label>
                <input
                  type="email"
                  value={editCustomerForm.email}
                  onChange={(e) => setEditCustomerForm({ ...editCustomerForm, email: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  Mobile / Phone Number
                </label>
                <input
                  type="text"
                  value={editCustomerForm.phone}
                  onChange={(e) => setEditCustomerForm({ ...editCustomerForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  Account Status
                </label>
                <select
                  value={editCustomerForm.status}
                  onChange={(e) => setEditCustomerForm({ ...editCustomerForm, status: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="ONBOARDING">ONBOARDING</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  Industry Vertical
                </label>
                <select
                  value={editCustomerForm.industry}
                  onChange={(e) => setEditCustomerForm({ ...editCustomerForm, industry: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
                >
                  <option value="Technology & IT">Technology & IT</option>
                  <option value="Manufacturing & Industrial">Manufacturing & Industrial</option>
                  <option value="Construction & Real Estate">Construction & Real Estate</option>
                  <option value="Healthcare & Pharma">Healthcare & Pharma</option>
                  <option value="Finance & Banking">Finance & Banking</option>
                  <option value="Retail & E-commerce">Retail & E-commerce</option>
                  <option value="Services & Consulting">Services & Consulting</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  Assigned Account Rep / Executive
                </label>
                <input
                  type="text"
                  placeholder="e.g. manoj or sales_rep"
                  value={editCustomerForm.assignedTo}
                  onChange={(e) => setEditCustomerForm({ ...editCustomerForm, assignedTo: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
                />
              </div>
            </div>

            {/* Commercial & Tax Identification */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  PAN Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. ABCDE1234F"
                  value={editCustomerForm.pan}
                  onChange={(e) => setEditCustomerForm({ ...editCustomerForm, pan: e.target.value.toUpperCase() })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  Commercial Payment Terms
                </label>
                <input
                  type="text"
                  placeholder="e.g. Net 30 Days / 50% Advance / Immediate"
                  value={editCustomerForm.paymentTerms}
                  onChange={(e) => setEditCustomerForm({ ...editCustomerForm, paymentTerms: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Official Website
              </label>
              <input
                type="text"
                placeholder="e.g. https://company.com"
                value={editCustomerForm.website}
                onChange={(e) => setEditCustomerForm({ ...editCustomerForm, website: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
              />
            </div>

            {/* Registered Billing Address Section */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.9rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', display: 'block', marginBottom: '0.65rem' }}>
                📍 Registered Billing Address (Invoice Location)
              </span>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: '#334155' }}>
                  Street / Industrial Area Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Plot No 42, MIDC Industrial Area, Phase 2"
                  value={editCustomerForm.billingAddress}
                  onChange={(e) => setEditCustomerForm({ ...editCustomerForm, billingAddress: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.84rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', color: '#334155' }}>
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai"
                    value={editCustomerForm.city}
                    onChange={(e) => setEditCustomerForm({ ...editCustomerForm, city: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.84rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', color: '#334155' }}>
                    State
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maharashtra"
                    value={editCustomerForm.state}
                    onChange={(e) => setEditCustomerForm({ ...editCustomerForm, state: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.84rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', color: '#334155' }}>
                    PIN Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 400001"
                    value={editCustomerForm.pincode}
                    onChange={(e) => setEditCustomerForm({ ...editCustomerForm, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', fontSize: '0.84rem' }}
                  />
                </div>
              </div>
            </div>

            {/* Delivery / Shipping Address Section */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase' }}>
                  🚚 Delivery / Shipping Site Address
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const fullBilling = [
                      editCustomerForm.billingAddress,
                      editCustomerForm.city,
                      editCustomerForm.state,
                      editCustomerForm.pincode ? `PIN: ${editCustomerForm.pincode}` : '',
                    ].filter(Boolean).join(', ');
                    setEditCustomerForm({ ...editCustomerForm, shippingAddress: fullBilling });
                  }}
                  style={{
                    fontSize: '0.74rem',
                    background: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe',
                    borderRadius: '5px',
                    padding: '2px 8px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Copy from Billing Address
                </button>
              </div>
              <textarea
                rows={2}
                placeholder="Warehouse address, delivery contact person, landmark (leave empty if same as billing)..."
                value={editCustomerForm.shippingAddress}
                onChange={(e) => setEditCustomerForm({ ...editCustomerForm, shippingAddress: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', resize: 'vertical', fontSize: '0.84rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Customer Requirements & Scope of Work (Carried from Lead)
              </label>
              <textarea
                rows={3}
                placeholder="Product specifications, customization needs, quantity requirement..."
                value={editCustomerForm.requirements}
                onChange={(e) => setEditCustomerForm({ ...editCustomerForm, requirements: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingCustomer}
                style={{
                  padding: '0.6rem 1.35rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#1d4ed8',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: isUpdatingCustomer ? 'not-allowed' : 'pointer',
                  opacity: isUpdatingCustomer ? 0.7 : 1,
                }}
              >
                {isUpdatingCustomer ? 'Saving...' : 'Update Customer Profile'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2D: REQUEST ACCOUNT TRANSFER / RE-CLAIM */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={Boolean(requestingTransferCustomer)}
        onClose={() => setRequestingTransferCustomer(null)}
        title="Request Customer Account Transfer 🔄"
      >
        {requestingTransferCustomer && (
          <form onSubmit={handleSubmitClaimTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '0.85rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>
                {requestingTransferCustomer.companyName}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3px' }}>
                Current Assigned Rep: <strong style={{ color: '#0369a1' }}>{requestingTransferCustomer.assignedTo || 'Another Representative'}</strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                Transferring To: <strong style={{ color: '#4338ca' }}>{currentRepName} (You)</strong>
              </div>
            </div>

            <div style={{ padding: '0.85rem 1rem', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
              <span style={{ fontSize: '0.78rem', color: '#1e40af', fontWeight: 600, lineHeight: 1.5 }}>
                🔒 <strong>Account Governance Rule:</strong> Kyunki yeh account already <strong>{requestingTransferCustomer.assignedTo}</strong> ko assigned hai, direct transfer nahi kiya ja sakta. Agar customer ka direct call aapke paas aaya hai, toh reason darj karke request submit karein. Yeh request <strong>Team Head, Department Head, aur Admin</strong> ke paas approval ke liye jayegi.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Reason for Transfer / Customer Call Context *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Customer ne direct mere phone par call kiya for urgent quotation / Customer requested me as SPOC..."
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '0.84rem',
                  lineHeight: 1.5,
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setRequestingTransferCustomer(null)}
                style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingTransfer}
                style={{
                  padding: '0.6rem 1.35rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#7f22fe',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: isSubmittingTransfer ? 'wait' : 'pointer',
                  boxShadow: '0 2px 6px rgba(127, 34, 254, 0.3)',
                }}
              >
                {isSubmittingTransfer ? 'Submitting...' : 'Submit Request for Approval 📬'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: CREATE CONTACT */}
      {/* ------------------------------------------------------------- */}
      <Modal isOpen={showAddContactModal} onClose={() => setShowAddContactModal(false)} title="Register Business Stakeholder / Contact 👤">
        <form onSubmit={handleCreateContact} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Contact Person Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Anand Mahindra / Priya Sharma"
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Client Organization / Company *
              </label>
              <input
                type="text"
                required
                list="registered-customers-list"
                placeholder="e.g. rahulpvt or choose from existing"
                value={contactForm.companyName}
                onChange={(e) => setContactForm({ ...contactForm, companyName: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
              />
              <datalist id="registered-customers-list">
                {customers.map((c) => (
                  <option key={c.id} value={c.companyName} />
                ))}
              </datalist>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Designation / Stakeholder Role
              </label>
              <input
                type="text"
                list="contact-roles-list"
                placeholder="e.g. Head of Procurement / Purchase Manager"
                value={contactForm.role}
                onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
              />
              <datalist id="contact-roles-list">
                <option value="Primary Account Contact" />
                <option value="Managing Director / Owner" />
                <option value="Head of Procurement / Purchase" />
                <option value="Finance & Accounts Manager" />
                <option value="Site / Warehouse Logistics Head" />
                <option value="Technical Project Lead" />
              </datalist>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Preferred Communication Channel
              </label>
              <select
                value={contactForm.channel}
                onChange={(e) => setContactForm({ ...contactForm, channel: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
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
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Official Email Address
              </label>
              <input
                type="email"
                placeholder="contact@company.com"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                Direct Phone / Mobile (10 Digits)
              </label>
              <input
                type="tel"
                maxLength={10}
                placeholder="e.g. 9876543210"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
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
              disabled={isSavingContact}
              style={{ padding: '0.6rem 1.35rem', borderRadius: '6px', border: 'none', background: '#7f22fe', color: '#ffffff', fontWeight: 700, cursor: isSavingContact ? 'wait' : 'pointer' }}
            >
              {isSavingContact ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3B: VIEW CONTACT DETAILS & TOUCHPOINT HUB */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={Boolean(viewingContact)}
        onClose={() => setViewingContact(null)}
        title="Business Stakeholder Profile &amp; Contact Hub 👤"
      >
        {viewingContact && (() => {
          const matchedCust = customers.find(
            c => String(c.companyName || '').toLowerCase() === String(viewingContact.companyName || '').toLowerCase()
          );
          const cleanPhone = (viewingContact.phone || '').replace(/\D/g, '').slice(-10);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Header Box */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.1rem 1.25rem',
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: '#f3e8ff',
                    color: '#7e22ce',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                    border: '2px solid #d8b4fe',
                  }}>
                    {String(viewingContact.name || 'C').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                      {viewingContact.name}
                    </h3>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>Role: <strong style={{ color: '#7e22ce' }}>{viewingContact.role || 'Primary Account Contact'}</strong></span>
                      <span>•</span>
                      <span>Account: <strong>{viewingContact.companyName}</strong></span>
                    </div>
                  </div>
                </div>

                {matchedCust && (
                  <button
                    type="button"
                    onClick={() => {
                      const c = matchedCust;
                      setViewingContact(null);
                      handleOpenCustomerDetails(c);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.45rem 0.85rem',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      color: '#4338ca',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <span>🏢</span> Open Customer Workspace ↗
                  </button>
                )}
              </div>

              {/* Instant Communication Action Buttons */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                flexWrap: 'wrap',
                padding: '0.85rem 1rem',
                background: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}>
                {viewingContact.phone && (
                  <>
                    <a
                      href={`tel:${viewingContact.phone}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.5rem 0.95rem',
                        background: '#f0fdf4',
                        color: '#166534',
                        border: '1px solid #bbf7d0',
                        borderRadius: '6px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      📞 Call Direct ({viewingContact.phone})
                    </a>
                    <a
                      href={`https://wa.me/91${cleanPhone}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.5rem 0.95rem',
                        background: '#ecfdf5',
                        color: '#047857',
                        border: '1px solid #a7f3d0',
                        borderRadius: '6px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      💬 WhatsApp Chat
                    </a>
                  </>
                )}

                {viewingContact.email && (
                  <a
                    href={`mailto:${viewingContact.email}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.5rem 0.95rem',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    ✉️ Email {viewingContact.email}
                  </a>
                )}

                {canPerformAction('customers') && (
                  <button
                    type="button"
                    onClick={() => {
                      const c = matchedCust || {
                        companyName: viewingContact.companyName,
                        contactPerson: viewingContact.name,
                        phone: viewingContact.phone,
                        email: viewingContact.email,
                      };
                      setViewingContact(null);
                      handleOpenLogTouchpoint(c);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.5rem 0.95rem',
                      background: '#7f22fe',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <span>📞</span> + Log Touchpoint / Discussion
                  </button>
                )}
              </div>

              {/* Stakeholder Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                <div style={{ padding: '0.8rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Direct Phone Number
                  </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                    {viewingContact.phone || '— Not Provided'}
                  </span>
                </div>

                <div style={{ padding: '0.8rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Official Email
                  </span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>
                    {viewingContact.email || '— Not Provided'}
                  </span>
                </div>

                <div style={{ padding: '0.8rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Preferred Communication Channel
                  </span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                    {viewingContact.channel || 'Email'}
                  </span>
                </div>

                <div style={{ padding: '0.8rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Added to Directory
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#0f172a' }}>
                    {viewingContact.createdAt ? new Date(viewingContact.createdAt).toLocaleString() : '—'}
                  </span>
                </div>
              </div>

              {/* Helper Advisory */}
              <div style={{ padding: '0.85rem 1rem', background: '#f5f3ff', borderRadius: '8px', border: '1px solid #ede9fe' }}>
                <span style={{ fontSize: '0.78rem', color: '#6d28d9', fontWeight: 600 }}>
                  💡 <strong>B2B Multi-Stakeholder Directory:</strong> Is contact se kiye gaye conversations ya negotiation points ko <strong>Log Touchpoint</strong> ke through customer account timeline par record karein taaki poori team ko context rahe.
                </span>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                {canPerformAction('opportunities') && (
                  <button
                    type="button"
                    onClick={() => {
                      const cnt = viewingContact;
                      setViewingContact(null);
                      handleConvertContactToOpportunity(cnt);
                    }}
                    style={{
                      padding: '0.55rem 1.15rem',
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
                    💼 Move to Deal Opportunity
                  </button>
                )}
                {canPerformAction('contacts') && (
                  <button
                    type="button"
                    onClick={() => {
                      const cnt = viewingContact;
                      setViewingContact(null);
                      handleOpenEditContact(cnt);
                    }}
                    style={{
                      padding: '0.55rem 1.15rem',
                      borderRadius: '6px',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    ✏️ Edit Profile
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingContact(null)}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3C: EDIT CONTACT PROFILE */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={Boolean(editingContact)}
        onClose={() => setEditingContact(null)}
        title="Edit Business Stakeholder Profile 👤"
      >
        {editingContact && (
          <form onSubmit={handleUpdateContact} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  Contact Person Name *
                </label>
                <input
                  type="text"
                  required
                  value={editContactForm.name}
                  onChange={(e) => setEditContactForm({ ...editContactForm, name: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  Client Organization / Company *
                </label>
                <input
                  type="text"
                  required
                  list="registered-customers-list"
                  value={editContactForm.companyName}
                  onChange={(e) => setEditContactForm({ ...editContactForm, companyName: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  Designation / Stakeholder Role
                </label>
                <input
                  type="text"
                  list="contact-roles-list"
                  placeholder="e.g. Head of Procurement / Purchase Manager"
                  value={editContactForm.role}
                  onChange={(e) => setEditContactForm({ ...editContactForm, role: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  Preferred Communication Channel
                </label>
                <select
                  value={editContactForm.channel}
                  onChange={(e) => setEditContactForm({ ...editContactForm, channel: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
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
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  Official Email Address
                </label>
                <input
                  type="email"
                  value={editContactForm.email}
                  onChange={(e) => setEditContactForm({ ...editContactForm, email: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  Direct Phone / Mobile
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={editContactForm.phone}
                  onChange={(e) => setEditContactForm({ ...editContactForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', background: '#ffffff' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setEditingContact(null)}
                style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingContact}
                style={{
                  padding: '0.6rem 1.35rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#1d4ed8',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: isUpdatingContact ? 'wait' : 'pointer',
                }}
              >
                {isUpdatingContact ? 'Saving...' : 'Update Contact'}
              </button>
            </div>
          </form>
        )}
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
              {customers.length > 0 ? (
                <select
                  required
                  value={opportunityForm.companyName}
                  onChange={(e) => {
                    const comp = e.target.value;
                    setOpportunityForm({
                      ...opportunityForm,
                      companyName: comp,
                      title: opportunityForm.title || `${comp} - Deal Opportunity`,
                    });
                  }}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
                >
                  <option value="">-- Choose Registered Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.companyName}>
                      {c.companyName} {c.contactPerson ? `(SPOC: ${c.contactPerson})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  placeholder="Enter registered customer company..."
                  value={opportunityForm.companyName}
                  onChange={(e) => setOpportunityForm({ ...opportunityForm, companyName: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              )}
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
      {/* MODAL 4B: MANAGE DEAL PIPELINE & WORKSPACE (viewingOpportunity) */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={Boolean(viewingOpportunity)}
        onClose={() => setViewingOpportunity(null)}
        title="Manage Deal Pipeline & Closing 💼"
      >
        {viewingOpportunity && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header info card */}
            <div
              style={{
                padding: '1rem',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  {viewingOpportunity.title}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span>🏢 Client: <strong style={{ color: '#0f172a' }}>{viewingOpportunity.companyName}</strong></span>
                  <span>•</span>
                  <span>📅 Opened: {viewingOpportunity.createdAt ? new Date(viewingOpportunity.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
                </div>
              </div>
              <div>
                {renderStageBadge(manageOppForm.stage || viewingOpportunity.stage)}
              </div>
            </div>

            {/* Interactive Visual Pipeline Stage Stepper */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Pipeline Progress Stage (Click to Advance Deal)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' }}>
                {[
                  { stage: 'DISCOVERY', label: '1. Discovery', desc: 'Requirement Gathering', color: '#0284c7', prob: '25%' },
                  { stage: 'PROPOSAL', label: '2. Proposal', desc: 'Quotation Sent', color: '#7c3aed', prob: '50%' },
                  { stage: 'NEGOTIATION', label: '3. Negotiation', desc: 'Price / Terms Discussion', color: '#d97706', prob: '75%' },
                  { stage: 'WON', label: '4. Closed Won', desc: 'PO / Advance Received', color: '#16a34a', prob: '100%' },
                  { stage: 'LOST', label: '5. Closed Lost', desc: 'Deal Dropped', color: '#dc2626', prob: '0%' },
                ].map((st) => {
                  const isActive = (manageOppForm.stage || viewingOpportunity.stage) === st.stage;
                  return (
                    <button
                      key={st.stage}
                      type="button"
                      onClick={() => {
                        setManageOppForm((prev) => ({
                          ...prev,
                          stage: st.stage,
                          probability: st.prob,
                        }));
                      }}
                      style={{
                        padding: '0.75rem 0.5rem',
                        borderRadius: '8px',
                        border: isActive ? `2px solid ${st.color}` : '1px solid #e2e8f0',
                        background: isActive ? `${st.color}15` : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: isActive ? st.color : '#334155' }}>
                        {st.label}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: isActive ? st.color : '#94a3b8', marginTop: '2px', lineHeight: 1.2 }}>
                        {st.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stage Context Banner */}
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                background:
                  manageOppForm.stage === 'WON'
                    ? '#f0fdf4'
                    : manageOppForm.stage === 'LOST'
                    ? '#fef2f2'
                    : '#f8fafc',
                border: `1px solid ${
                  manageOppForm.stage === 'WON'
                    ? '#bbf7d0'
                    : manageOppForm.stage === 'LOST'
                    ? '#fecaca'
                    : '#e2e8f0'
                }`,
              }}
            >
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                💡 Stage Trigger & Ground Reality:
              </div>
              <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px', lineHeight: 1.5 }}>
                {manageOppForm.stage === 'DISCOVERY' &&
                  'Requirement gathering phase. Sales representative interacts with client SPOC to understand specifications, quantity, and budget.'}
                {manageOppForm.stage === 'PROPOSAL' &&
                  'Quotation phase. Representative has sent formal sales quote. Click "📄 Create / Open Quotation" below to view or generate QT document.'}
                {manageOppForm.stage === 'NEGOTIATION' &&
                  'Commercial discussion phase. Client has received the quote and is discussing discounts, credit period, or scope modifications.'}
                {manageOppForm.stage === 'WON' &&
                  'Deal successfully closed! Client has confirmed the Purchase Order (PO) or provided token advance payment. Ready for dispatch & billing.'}
                {manageOppForm.stage === 'LOST' &&
                  'Deal dropped or lost to competitor. Reason can be tracked for future pipeline optimization.'}
              </div>
            </div>

            {/* Editable Deal Properties Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateOpportunityDetails();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                  Deal / Opportunity Title
                </label>
                <input
                  type="text"
                  required
                  value={manageOppForm.title}
                  onChange={(e) => setManageOppForm({ ...manageOppForm, title: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                    Estimated Value
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ₹ 8,50,000"
                    value={manageOppForm.value}
                    onChange={(e) => setManageOppForm({ ...manageOppForm, value: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                    Win Probability
                  </label>
                  <select
                    value={manageOppForm.probability}
                    onChange={(e) => setManageOppForm({ ...manageOppForm, probability: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '0.85rem' }}
                  >
                    <option value="25%">25% (Early Stage)</option>
                    <option value="50%">50% (Proposal Active)</option>
                    <option value="75%">75% (Shortlisted / Verbal)</option>
                    <option value="90%">90% (Final Legal Review)</option>
                    <option value="100%">100% (Signed)</option>
                    <option value="0%">0% (Lost / Cancelled)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                    Target Closing Date
                  </label>
                  <input
                    type="date"
                    value={manageOppForm.expectedCloseDate}
                    onChange={(e) => setManageOppForm({ ...manageOppForm, expectedCloseDate: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Action buttons row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '0.5rem',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <a
                    href={`/sales/quotations?customer=${encodeURIComponent(viewingOpportunity.companyName)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.55rem 0.95rem',
                      borderRadius: '6px',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    <span>📄</span> Create Quotation ↗
                  </a>

                  {manageOppForm.stage !== 'WON' && (
                    <button
                      type="button"
                      disabled={isUpdatingOpportunity}
                      onClick={() => handleUpdateOpportunityDetails('WON')}
                      style={{
                        padding: '0.55rem 0.95rem',
                        borderRadius: '6px',
                        background: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      🏆 Mark WON
                    </button>
                  )}

                  {manageOppForm.stage !== 'LOST' && (
                    <button
                      type="button"
                      disabled={isUpdatingOpportunity}
                      onClick={() => handleUpdateOpportunityDetails('LOST')}
                      style={{
                        padding: '0.55rem 0.95rem',
                        borderRadius: '6px',
                        background: '#ffffff',
                        color: '#dc2626',
                        border: '1px solid #fca5a5',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      ❌ Mark LOST
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setViewingOpportunity(null)}
                    style={{
                      padding: '0.6rem 1.25rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingOpportunity}
                    style={{
                      padding: '0.6rem 1.4rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#7f22fe',
                      color: '#ffffff',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {isUpdatingOpportunity ? 'Saving...' : 'Save Deal Updates'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
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

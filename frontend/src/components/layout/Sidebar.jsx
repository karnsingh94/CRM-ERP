'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconDashboard,
  IconCRM,
  IconTruck,
  IconLayers,
  IconCpu,
  IconPackage,
  IconCreditCard,
  IconShield,
  IconSettings,
  IconChevronDown,
  IconChevronRight,
  IconBuilding,
} from '../ui/Icons';
import { getHierarchyFromPathname } from '@/config/routes.config';

// Canonical sub-page definitions mapped strictly to each submodule
const SUBMODULE_PAGES = {
  // 1. CRM & Sales
  crm: [
    { label: 'Leads Pipeline', href: '/crm/leads' },
    { label: 'Customers', href: '/crm/customers' },
    { label: 'Contacts', href: '/crm/contacts' },
    { label: 'Opportunities', href: '/crm/opportunities' },
  ],
  product: [
    { label: 'Product Directory', href: '/products' },
    { label: 'Categories', href: '/products/categories' },
    { label: 'Pricing & Plans', href: '/products/pricing' },
  ],
  sales: [
    { label: 'Sales Orders', href: '/sales/orders' },
    { label: 'Quotations', href: '/sales/quotations' },
    { label: 'Proforma Invoices', href: '/sales/proforma' },
  ],

  // 2. Purchase & Vendor
  vendor: [
    { label: 'Vendor Directory', href: '/vendors' },
    { label: 'Supplier Ratings', href: '/vendors/evaluation' },
  ],
  procurement: [
    { label: 'Purchase Orders', href: '/procurement/orders' },
    { label: 'Purchase Requests', href: '/procurement/requests' },
    { label: 'RFQ & Quotes', href: '/procurement/rfq' },
  ],
  grn: [
    { label: 'Goods Receipts', href: '/grn' },
    { label: 'Quality Inspection', href: '/grn/inspection' },
  ],

  // 3. Inventory & Warehouse
  inventory_mgmt: [
    { label: 'Stock Ledger', href: '/inventory' },
    { label: 'Warehouses & Bins', href: '/inventory/warehouses' },
    { label: 'Stock Adjustments', href: '/inventory/adjustments' },
    { label: 'Stock Movements', href: '/inventory/movements' },
  ],
  gate_pass: [
    { label: 'Inward Gate Pass', href: '/gate-pass/inward' },
    { label: 'Outward Gate Pass', href: '/gate-pass/outward' },
    { label: 'Returnable Register', href: '/gate-pass/returnable' },
  ],

  // 4. Manufacturing & Production
  bom: [
    { label: 'BOM Master', href: '/bom' },
    { label: 'Formulas & Costing', href: '/bom/costing' },
  ],
  production: [
    { label: 'Production Orders', href: '/production/orders' },
    { label: 'Work Orders', href: '/production/work-orders' },
    { label: 'Material Consumption', href: '/production/consumption' },
  ],

  // 5. Dispatch & Returns
  dispatch: [
    { label: 'Outbound Dispatch', href: '/dispatch' },
    { label: 'Delivery Challans', href: '/dispatch/challans' },
  ],
  returns: [
    { label: 'Customer Returns', href: '/returns' },
    { label: 'Supplier Restock', href: '/returns/restock' },
  ],

  // 6. Accounts & Banking
  accounts_banking: [
    { label: 'Sales Invoices', href: '/accounts/invoices' },
    { label: 'Vendor Bills', href: '/accounts/bills' },
    { label: 'Payments & Receipts', href: '/accounts/payments' },
    { label: 'General Ledger', href: '/accounts/ledger' },
  ],

  // 7. Permission Controls
  permission_controls: [
    { label: 'Team Members', href: '/team' },
    { label: 'Roles & Permissions', href: '/team/roles' },
    { label: 'Security Audit', href: '/team/audit' },
  ],
};

const normalize = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function getPagesForModule(mod, hasSubModuleAccess) {
  const allowedSubs = Array.isArray(mod?.subModules) ? mod.subModules : [];

  const isPagePermitted = (page) => {
    if (typeof hasSubModuleAccess === 'function') {
      if (hasSubModuleAccess(page.href)) return true;
      if (page.code && hasSubModuleAccess(page.code)) return true;
    }
    return allowedSubs.some((sub) => {
      if (sub.route && page.href && sub.route.toLowerCase() === page.href.toLowerCase()) return true;
      if (page.code && sub.code && page.code === sub.code) return true;
      if (page.label && sub.name && normalize(page.label) === normalize(sub.name)) return true;
      if (page.href === '/crm/leads' && (sub.code === 'leads' || sub.code === 'crm_leads')) return true;
      if (page.href === '/crm/customers' && (sub.code === 'customers' || sub.code === 'crm_customers')) return true;
      if (page.href === '/crm/contacts' && (sub.code === 'contacts' || sub.code === 'crm_contacts')) return true;
      if (
        (page.href === '/crm/opportunities' || page.href === '/crm/followups') &&
        (sub.code === 'opportunities' || sub.code === 'crm_followups' || sub.code === 'followups')
      ) return true;
      // Product & Catalogue matching
      if (
        page.href === '/products' &&
        (sub.code === 'product_master' || sub.code === 'product_list' || sub.code === 'products' || normalize(sub.name) === 'productdirectory' || normalize(sub.name) === 'productmaster')
      ) return true;
      if (
        page.href === '/products/categories' &&
        (sub.code === 'categories' || sub.code === 'product_categories' || normalize(sub.name).includes('categor'))
      ) return true;
      if (
        page.href === '/products/pricing' &&
        (sub.code === 'price_management' || sub.code === 'price_list' || sub.code === 'pricing' || normalize(sub.name).includes('pric'))
      ) return true;
      // Sales Operations matching
      if (
        page.href === '/sales/orders' &&
        (sub.code === 'sales_orders' || sub.code === 'orders' || normalize(sub.name).includes('order'))
      ) return true;
      if (
        page.href === '/sales/quotations' &&
        (sub.code === 'sales_quotations' || sub.code === 'quotations' || sub.code === 'quotes' || normalize(sub.name).includes('quot'))
      ) return true;
      if (
        page.href === '/sales/proforma' &&
        (sub.code === 'sales_proforma_invoices' || sub.code === 'proforma_invoice' || sub.code === 'proforma' || normalize(sub.name).includes('proforma'))
      ) return true;
      return false;
    });
  };

  if (SUBMODULE_PAGES[mod.code]) {
    // If active submodules list or permission checker is provided, strictly filter
    if (allowedSubs.length > 0 || typeof hasSubModuleAccess === 'function') {
      return SUBMODULE_PAGES[mod.code].filter(isPagePermitted);
    }
    return SUBMODULE_PAGES[mod.code];
  }

  if (allowedSubs.length > 0) {
    return allowedSubs.map((sub) => ({
      label: sub.name,
      href: sub.route,
    }));
  }

  return [];
}

export default function Sidebar({
  activeTab,
  onSelectTab,
  activeCompany,
  permittedServices = [],
  hasSubModuleAccess,
  isCompanyAdmin = true,
  isCollapsed = false,
  onToggleCollapse,
}) {
  const pathname = usePathname() || '/dashboard';
  const visibleServices = isCompanyAdmin
    ? permittedServices
    : permittedServices.filter((service) => service.code !== 'permission_controls');

  // 1. Initial State Resolution from Active Route
  const initialHierarchy = getHierarchyFromPathname(pathname);

  // Rule 1: Exactly ONE main service can be expanded at a time
  const [expandedService, setExpandedService] = useState(() => {
    if (initialHierarchy.serviceCode) return initialHierarchy.serviceCode;
    // CRM & Sales is default open only when route doesn't identify another service
    return 'crm_sales';
  });

  // Rule 2: Exactly ONE sibling submodule can be expanded within the active service
  const [expandedSubmodule, setExpandedSubmodule] = useState(() => {
    if (initialHierarchy.moduleCode) return initialHierarchy.moduleCode;
    if (!initialHierarchy.serviceCode || initialHierarchy.serviceCode === 'crm_sales') {
      return 'crm';
    }
    return null;
  });

  // 2. Synchronize Accordion with Route Changes
  const lastPathnameRef = useRef(pathname);

  useEffect(() => {
    if (lastPathnameRef.current !== pathname) {
      lastPathnameRef.current = pathname;
      const h = getHierarchyFromPathname(pathname);
      if (h.serviceCode) {
        setExpandedService(h.serviceCode);
        if (h.moduleCode) {
          setExpandedSubmodule(h.moduleCode);
        } else if (h.isDepartmentRoute) {
          // Keep submodules compact when on department management page
          setExpandedSubmodule(null);
        }
      }
    }
  }, [pathname]);

  // 3. Manual Main Service Accordion Click Handler
  const toggleService = (serviceCode) => {
    if (expandedService === serviceCode) {
      // Toggle collapse if already open
      setExpandedService(null);
      setExpandedSubmodule(null);
    } else {
      // Open selected service and close previously open service immediately (Rule 1)
      setExpandedService(serviceCode);

      // Rule 2: Open active submodule if this service contains current route, else open first submodule
      const h = getHierarchyFromPathname(pathname);
      if (h.serviceCode === serviceCode && h.moduleCode) {
        setExpandedSubmodule(h.moduleCode);
      } else {
        const srv = permittedServices.find((s) => s.code === serviceCode);
        const firstModCode = srv?.modules?.[0]?.code || null;
        setExpandedSubmodule(firstModCode);
      }
    }
  };

  // 4. Manual Submodule Accordion Click Handler
  const toggleSubmodule = (modCode) => {
    if (expandedSubmodule === modCode) {
      // Toggle collapse if already open
      setExpandedSubmodule(null);
    } else {
      // Open clicked submodule and close sibling submodules immediately (Rule 2)
      setExpandedSubmodule(modCode);
    }
  };

  // Render Service Icon
  const renderServiceIcon = (code, isActive) => {
    const iconColor = isActive ? '#a78bfa' : '#a1a1aa';
    switch (code) {
      case 'crm_sales': return <IconCRM size={17} style={{ color: iconColor }} />;
      case 'purchase_vendor': return <IconTruck size={17} style={{ color: iconColor }} />;
      case 'inventory_warehouse': return <IconLayers size={17} style={{ color: iconColor }} />;
      case 'manufacturing_production': return <IconCpu size={17} style={{ color: iconColor }} />;
      case 'dispatch_returns': return <IconPackage size={17} style={{ color: iconColor }} />;
      case 'accounts_banking': return <IconCreditCard size={17} style={{ color: iconColor }} />;
      case 'permission_controls': return <IconShield size={17} style={{ color: iconColor }} />;
      default: return <IconLayers size={17} style={{ color: iconColor }} />;
    }
  };

  // Initials generator
  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'CA';
    const clean = name.trim();
    if (!clean) return 'CA';
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const companyInitials = getInitials(activeCompany?.organizationName || 'Company');
  const userInitials = getInitials(activeCompany?.name || 'Administrator');

  const brandColor = activeCompany?.theme_color || activeCompany?.themeColor || '#7f22fe';
  const brandGlow = `${brandColor}59`;
  const brandSubtle = `${brandColor}24`;
  const brandParent = `${brandColor}33`;

  return (
    <aside
      style={{
        width: isCollapsed ? '78px' : '270px',
        flexShrink: 0,
        backgroundColor: '#18181b',
        color: '#e4e4e7',
        minHeight: '100vh',
        height: '100vh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #27272a',
        transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        zIndex: 50,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: isCollapsed ? '1.25rem 0.75rem' : '1.25rem 1.4rem',
          borderBottom: '1px solid #27272a',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          flexShrink: 0,
          backgroundColor: '#18181b',
        }}
      >
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}cc 100%)`,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1rem',
            letterSpacing: '-0.5px',
            boxShadow: `0 4px 14px ${brandGlow}`,
            flexShrink: 0,
          }}
        >
          {companyInitials}
        </div>

        {!isCollapsed && (
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2
              style={{
                fontSize: '0.96rem',
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: '-0.2px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                margin: 0,
              }}
              title={activeCompany?.organizationName || 'Company Portal'}
            >
              {activeCompany?.organizationName || 'AZZUNIQE'}
            </h2>
            <div
              style={{
                fontSize: '0.72rem',
                color: '#a78bfa',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                marginTop: '2px',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#a78bfa',
                }}
              />
              Company Admin
            </div>
          </div>
        )}
      </div>

      {/* Navigation Area */}
      <nav
        className="custom-scrollbar"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: isCollapsed ? '1rem 0.5rem' : '0.85rem 0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
        }}
      >
        {/* Dashboard Link */}
        {(() => {
          const isDashboardActive = pathname === '/' || pathname === '/dashboard';
          return (
            <Link
              href="/dashboard"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.62rem 0.8rem',
                borderRadius: '8px',
                color: isDashboardActive ? '#ffffff' : '#a1a1aa',
                background: isDashboardActive ? brandColor : 'transparent',
                boxShadow: isDashboardActive ? `0 4px 14px ${brandGlow}` : 'none',
                fontWeight: isDashboardActive ? 700 : 500,
                fontSize: '0.85rem',
                width: '100%',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
              }}
              title="Overview Dashboard"
            >
              <span style={{ color: isDashboardActive ? '#ffffff' : '#a78bfa', flexShrink: 0 }}>
                <IconDashboard size={18} />
              </span>
              {!isCollapsed && <span>Dashboard</span>}
            </Link>
          );
        })()}

        {/* Services Section Header */}
        {!isCollapsed && (
          <div
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              color: '#71717a',
              letterSpacing: '0.05em',
              margin: '0.75rem 0 0.25rem 0.5rem',
            }}
          >
            Assigned Services ({visibleServices.length})
          </div>
        )}

        {/* 4-Level Nested Hierarchy Accordion */}
        {visibleServices.map((service) => {
          const serviceSlugKebab = service.code.replace(/_/g, '-');
          const isServiceActive = (
            (service.code === 'crm_sales' && (pathname.startsWith('/crm') || pathname.startsWith('/products') || pathname.startsWith('/sales'))) ||
            (service.code === 'purchase_vendor' && (pathname.startsWith('/vendors') || pathname.startsWith('/procurement') || pathname.startsWith('/grn'))) ||
            (service.code === 'inventory_warehouse' && (pathname.startsWith('/inventory') || pathname.startsWith('/gate-pass'))) ||
            (service.code === 'manufacturing_production' && (pathname.startsWith('/bom') || pathname.startsWith('/production'))) ||
            (service.code === 'dispatch_returns' && (pathname.startsWith('/dispatch') || pathname.startsWith('/returns'))) ||
            (service.code === 'accounts_banking' && pathname.startsWith('/accounts')) ||
            (service.code === 'permission_controls' && pathname.startsWith('/team')) ||
            pathname.startsWith(`/services/${serviceSlugKebab}/departments`) ||
            pathname.startsWith(`/services/${service.code}/departments`)
          );

          // Rule 1: Only ONE service expanded at a time
          const isServiceExpanded = expandedService === service.code;

          return (
            <div key={service.code} style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Level 1: Main Service Row */}
              <button
                type="button"
                onClick={() => toggleService(service.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '8px',
                  background: isServiceActive
                    ? brandSubtle
                    : isServiceExpanded
                    ? '#27272a'
                    : 'transparent',
                  border: isServiceActive
                    ? `1px solid ${brandParent}`
                    : '1px solid transparent',
                  borderLeft: isServiceActive
                    ? `3px solid ${brandColor}`
                    : '1px solid transparent',
                  color: isServiceActive || isServiceExpanded ? '#ffffff' : '#d4d4d8',
                  fontWeight: isServiceActive ? 700 : 500,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                  justifyContent: isCollapsed ? 'center' : 'space-between',
                }}
                title={service.name}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    minWidth: 0,
                    overflow: 'hidden',
                  }}
                >
                  <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    {renderServiceIcon(service.code, isServiceActive)}
                  </span>
                  {!isCollapsed && (
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {service.name}
                    </span>
                  )}
                </div>

                {!isCollapsed && service.modules?.length > 0 && (
                  <span
                    style={{
                      color: isServiceActive ? '#a78bfa' : '#71717a',
                      display: 'flex',
                      alignItems: 'center',
                      transform: isServiceExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      flexShrink: 0,
                      marginLeft: '0.4rem',
                    }}
                  >
                    <IconChevronDown size={14} />
                  </span>
                )}
              </button>

              {/* Sub-Content (Only rendered when service is expanded) */}
              {!isCollapsed && isServiceExpanded && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    paddingLeft: '0.85rem',
                    marginLeft: '1.2rem',
                    borderLeft: '1px solid #27272a',
                    marginTop: '0.2rem',
                    marginBottom: '0.35rem',
                    gap: '0.2rem',
                  }}
                >
                  {/* Level 2: Service Team Link */}
                  {isCompanyAdmin && (() => {
                    const deptRoute = `/services/${serviceSlugKebab}/departments`;
                    const isDeptActive = (
                      pathname.startsWith(`/services/${serviceSlugKebab}/departments`) ||
                      pathname.startsWith(`/services/${service.code}/departments`)
                    );

                    return (
                      <Link
                        href={deptRoute}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.42rem 0.65rem',
                          borderRadius: '6px',
                          color: isDeptActive ? '#c4b5fd' : '#d4d4d8',
                          background: isDeptActive ? brandParent : 'transparent',
                          fontWeight: isDeptActive ? 700 : 500,
                          fontSize: '0.78rem',
                          textDecoration: 'none',
                          transition: 'all 0.15s ease',
                          marginBottom: '0.25rem',
                        }}
                        title={`Manage the ${service.name} team`}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span style={{ fontSize: '0.82rem' }}>🏢</span>
                          <span>Service Team</span>
                        </span>
                        <span
                          style={{
                            fontSize: '0.64rem',
                            fontWeight: 700,
                            color: isDeptActive ? '#ffffff' : '#71717a',
                            background: isDeptActive ? brandParent : 'rgba(255,255,255,0.06)',
                            padding: '1px 5px',
                            borderRadius: '4px',
                          }}
                        >
                          Manage
                        </span>
                      </Link>
                    );
                  })()}

                  {/* Level 3: Submodules */}
                  {service.modules?.map((mod) => {
                    const pages = getPagesForModule(mod, hasSubModuleAccess);
                    const isSubExpanded = expandedSubmodule === mod.code;
                    const isModActive = pages.some((p) => pathname === p.href) || pathname.startsWith(`/${mod.code}`);

                    return (
                      <div key={mod.code} style={{ display: 'flex', flexDirection: 'column' }}>
                        {/* Submodule Header Button (Rule 2: toggles only this submodule, closes siblings) */}
                        <button
                          type="button"
                          onClick={() => toggleSubmodule(mod.code)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.42rem 0.65rem',
                            borderRadius: '6px',
                            color: isModActive || isSubExpanded ? '#ffffff' : '#a1a1aa',
                            background: isModActive
                              ? brandSubtle
                              : isSubExpanded
                              ? '#27272a'
                              : 'transparent',
                            fontWeight: isModActive || isSubExpanded ? 700 : 500,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            border: 'none',
                            textAlign: 'left',
                            width: '100%',
                            transition: 'all 0.15s ease',
                          }}
                          title={mod.name}
                        >
                          <span
                            style={{
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {mod.name}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                            {pages.length > 0 && (
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  color: isModActive ? '#c4b5fd' : '#71717a',
                                  background: 'rgba(255,255,255,0.06)',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                }}
                              >
                                {pages.length}
                              </span>
                            )}
                            {pages.length > 0 && (
                              <span
                                style={{
                                  color: isModActive ? '#a78bfa' : '#71717a',
                                  display: 'flex',
                                  alignItems: 'center',
                                  transform: isSubExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                }}
                              >
                                <IconChevronDown size={12} />
                              </span>
                            )}
                          </div>
                        </button>

                        {/* Level 4: Individual Child Pages (Rule 2 & 3: rendered ONLY when this submodule is expanded) */}
                        {isSubExpanded && pages.length > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              paddingLeft: '0.75rem',
                              marginLeft: '0.55rem',
                              borderLeft: '1px solid #27272a',
                              gap: '0.12rem',
                              marginTop: '0.15rem',
                              marginBottom: '0.3rem',
                            }}
                          >
                            {pages.map((page) => {
                              const isPageActive = pathname === page.href;
                              return (
                                <Link
                                  key={page.href}
                                  href={page.href}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    padding: '0.34rem 0.55rem',
                                    borderRadius: '5px',
                                    fontSize: '0.74rem',
                                    color: isPageActive ? '#ffffff' : '#a1a1aa',
                                    background: isPageActive
                                      ? brandParent
                                      : 'transparent',
                                    fontWeight: isPageActive ? 700 : 500,
                                    textDecoration: 'none',
                                    transition: 'all 0.15s ease',
                                  }}
                                  title={page.label}
                                >
                                  <span
                                    style={{
                                      width: '5px',
                                      height: '5px',
                                      borderRadius: '50%',
                                      backgroundColor: isPageActive
                                        ? brandColor
                                        : 'rgba(255, 255, 255, 0.25)',
                                      boxShadow: isPageActive
                                        ? `0 0 6px ${brandColor}`
                                        : 'none',
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span
                                    style={{
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {page.label}
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Company Settings Section */}
        {isCompanyAdmin && !isCollapsed && (
          <div
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              color: '#71717a',
              letterSpacing: '0.05em',
              margin: '0.85rem 0 0.25rem 0.5rem',
            }}
          >
            Company &amp; Preferences
          </div>
        )}

        {isCompanyAdmin && (() => {
          const isSettingsActive = pathname === '/settings';
          return (
            <Link
              href="/settings"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.62rem 0.8rem',
                borderRadius: '8px',
                color: isSettingsActive ? '#ffffff' : '#a1a1aa',
                background: isSettingsActive ? brandColor : 'transparent',
                boxShadow: isSettingsActive ? `0 4px 14px ${brandGlow}` : 'none',
                fontWeight: isSettingsActive ? 700 : 500,
                fontSize: '0.85rem',
                width: '100%',
                textDecoration: 'none',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                transition: 'all 0.15s ease',
              }}
              title="Company Profile & Settings"
            >
              <span style={{ color: isSettingsActive ? '#ffffff' : '#a78bfa', flexShrink: 0 }}>
                <IconSettings size={18} />
              </span>
              {!isCollapsed && <span>Company Settings</span>}
            </Link>
          );
        })()}
      </nav>

      {/* Footer User Card */}
      <div
        style={{
          padding: isCollapsed ? '0.85rem 0.5rem' : '0.85rem 1.15rem',
          borderTop: '1px solid #27272a',
          backgroundColor: '#121215',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#27272a',
              color: '#a78bfa',
              fontWeight: 800,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: `1px solid ${brandParent}`,
            }}
          >
            {userInitials}
          </div>

          {!isCollapsed && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  margin: 0,
                }}
                title={activeCompany?.name || 'Administrator'}
              >
                {activeCompany?.name || 'Authorized Admin'}
              </div>
              <div
                style={{
                  fontSize: '0.7rem',
                  color: '#a1a1aa',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {activeCompany?.email || 'Authenticated User'}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

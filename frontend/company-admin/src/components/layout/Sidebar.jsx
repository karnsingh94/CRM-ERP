'use client';

import { useState, useEffect } from 'react';
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

// Route mappings for services and modules
const SERVICE_DEFAULT_ROUTES = {
  crm_sales: '/crm/leads',
  purchase_vendor: '/procurement/orders',
  inventory_warehouse: '/inventory',
  manufacturing_production: '/production/orders',
  dispatch_returns: '/dispatch',
  accounts_banking: '/accounts/invoices',
  permission_controls: '/team',
};

const MODULE_DEFAULT_ROUTES = {
  crm: '/crm/leads',
  product: '/products',
  sales: '/sales/orders',
  vendor: '/vendors',
  procurement: '/procurement/orders',
  grn: '/grn',
  inventory_mgmt: '/inventory',
  gate_pass: '/gate-pass/inward',
  bom: '/bom',
  production: '/production/orders',
  dispatch: '/dispatch',
  returns: '/returns',
  accounts_banking: '/accounts/invoices',
  permission_controls: '/team',
};

export default function Sidebar({
  activeTab,
  onSelectTab,
  activeCompany,
  permittedServices = [],
  isCollapsed = false,
  onToggleCollapse,
}) {
  const pathname = usePathname() || '/dashboard';

  // Automatically expand parent accordions when current pathname matches
  const [expandedServices, setExpandedServices] = useState({
    crm_sales: true,
    purchase_vendor: true,
    inventory_warehouse: true,
    manufacturing_production: true,
    dispatch_returns: true,
    accounts_banking: true,
    permission_controls: true,
  });

  useEffect(() => {
    if (pathname.includes('/departments')) {
      const match = pathname.match(/\/services\/([^\/]+)\/departments/);
      if (match) {
        const sc = match[1].replace(/-/g, '_');
        setExpandedServices(prev => ({ ...prev, [sc]: true }));
      }
    }
    if (pathname.startsWith('/crm') || pathname.startsWith('/products') || pathname.startsWith('/sales')) {
      setExpandedServices(prev => ({ ...prev, crm_sales: true }));
    } else if (pathname.startsWith('/vendors') || pathname.startsWith('/procurement') || pathname.startsWith('/grn')) {
      setExpandedServices(prev => ({ ...prev, purchase_vendor: true }));
    } else if (pathname.startsWith('/inventory') || pathname.startsWith('/gate-pass')) {
      setExpandedServices(prev => ({ ...prev, inventory_warehouse: true }));
    } else if (pathname.startsWith('/bom') || pathname.startsWith('/production')) {
      setExpandedServices(prev => ({ ...prev, manufacturing_production: true }));
    } else if (pathname.startsWith('/dispatch') || pathname.startsWith('/returns')) {
      setExpandedServices(prev => ({ ...prev, dispatch_returns: true }));
    } else if (pathname.startsWith('/accounts')) {
      setExpandedServices(prev => ({ ...prev, accounts_banking: true }));
    } else if (pathname.startsWith('/team')) {
      setExpandedServices(prev => ({ ...prev, permission_controls: true }));
    }
  }, [pathname]);

  const toggleServiceExpand = (code, e) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedServices(prev => ({
      ...prev,
      [code]: !prev[code],
    }));
  };

  // Map service icon codes to components
  const renderServiceIcon = (code) => {
    switch (code) {
      case 'crm_sales': return <IconCRM size={17} />;
      case 'purchase_vendor': return <IconTruck size={17} />;
      case 'inventory_warehouse': return <IconLayers size={17} />;
      case 'manufacturing_production': return <IconCpu size={17} />;
      case 'dispatch_returns': return <IconPackage size={17} />;
      case 'accounts_banking': return <IconCreditCard size={17} />;
      case 'permission_controls': return <IconShield size={17} />;
      default: return <IconLayers size={17} />;
    }
  };

  // Dynamic initials helper
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

  return (
    <aside
      style={{
        width: isCollapsed ? '78px' : '270px',
        backgroundColor: '#0b1329',
        color: '#e2e8f0',
        minHeight: '100vh',
        height: '100vh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        zIndex: 50,
        overflow: 'hidden',
      }}
    >
      {/* Sidebar Brand Header */}
      <div
        style={{
          padding: isCollapsed ? '1.25rem 0.75rem' : '1.25rem 1.4rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
        }}
      >
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1rem',
            letterSpacing: '-0.5px',
            boxShadow: '0 4px 10px rgba(37, 99, 235, 0.35)',
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
              }}
              title={activeCompany?.organizationName || 'Company Portal'}
            >
              {activeCompany?.organizationName || 'AZZUNIQE'}
            </h2>
            <div
              style={{
                fontSize: '0.72rem',
                color: '#38bdf8',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                marginTop: '1px',
              }}
            >
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8' }} />
              Company Admin
            </div>
          </div>
        )}
      </div>

      {/* Navigation Links Area */}
      <nav
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: isCollapsed ? '1rem 0.5rem' : '1rem 0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}
      >
        {/* Dashboard Link */}
        {(() => {
          const isDashboardActive = pathname === '/' || pathname === '/dashboard' || activeTab === 'dashboard';
          return (
            <Link
              href="/dashboard"
              onClick={() => onSelectTab('dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.68rem 0.85rem',
                borderRadius: '8px',
                color: isDashboardActive ? '#ffffff' : '#94a3b8',
                background: isDashboardActive ? '#2563eb' : 'transparent',
                fontWeight: isDashboardActive ? 700 : 500,
                fontSize: '0.86rem',
                width: '100%',
                textAlign: 'left',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
              }}
              title="Overview Dashboard"
            >
              <span style={{ color: isDashboardActive ? '#ffffff' : '#38bdf8', flexShrink: 0 }}>
                <IconDashboard size={18} />
              </span>
              {!isCollapsed && <span>Dashboard</span>}
            </Link>
          );
        })()}

        {/* Section Title */}
        {!isCollapsed && (
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              color: '#475569',
              letterSpacing: '0.05em',
              margin: '0.85rem 0 0.35rem 0.65rem',
            }}
          >
            Assigned Services ({permittedServices.length})
          </div>
        )}

        {/* Permitted Services & Feature Modules */}
        {permittedServices.map((service) => {
          const defaultServiceRoute = SERVICE_DEFAULT_ROUTES[service.code] || '/dashboard';
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
            pathname.startsWith(`/services/${service.code}/departments`) ||
            activeTab.startsWith(service.code) ||
            activeTab === `services:${service.code}:departments`
          );
          const isExpanded = expandedServices[service.code];

          return (
            <div key={service.code} style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: '8px',
                  background: isServiceActive ? 'rgba(37, 99, 235, 0.18)' : 'transparent',
                  border: isServiceActive ? '1px solid rgba(37, 99, 235, 0.35)' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <Link
                  href={defaultServiceRoute}
                  onClick={() => {
                    onSelectTab(service.code);
                    if (isCollapsed && onToggleCollapse) onToggleCollapse();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.62rem 0.8rem',
                    flex: 1,
                    minWidth: 0,
                    textDecoration: 'none',
                    color: isServiceActive ? '#ffffff' : '#cbd5e1',
                    fontWeight: isServiceActive ? 700 : 500,
                    fontSize: '0.85rem',
                  }}
                  title={service.name}
                >
                  <span style={{ color: isServiceActive ? '#38bdf8' : '#94a3b8', flexShrink: 0 }}>
                    {renderServiceIcon(service.code)}
                  </span>
                  {!isCollapsed && (
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {service.name}
                    </span>
                  )}
                </Link>

                {!isCollapsed && service.modules?.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => toggleServiceExpand(service.code, e)}
                    style={{
                      padding: '0.62rem 0.6rem',
                      color: '#64748b',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    aria-label={`Toggle ${service.name} submodules`}
                  >
                    {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                  </button>
                )}
              </div>

              {/* Sub-Module Links Accordion */}
              {!isCollapsed && isExpanded && service.modules?.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    paddingLeft: '1.75rem',
                    margin: '0.2rem 0',
                    borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
                    marginLeft: '1.25rem',
                    gap: '0.15rem',
                  }}
                >
                  {/* Service Department Management Tab / Link */}
                  {(() => {
                    const deptRoute = `/services/${serviceSlugKebab}/departments`;
                    const isDeptActive = (
                      pathname.startsWith(`/services/${serviceSlugKebab}/departments`) ||
                      pathname.startsWith(`/services/${service.code}/departments`) ||
                      activeTab === `services:${service.code}:departments`
                    );

                    return (
                      <Link
                        href={deptRoute}
                        onClick={() => onSelectTab(`services:${service.code}:departments`)}
                        style={{
                          padding: '0.45rem 0.65rem',
                          borderRadius: '6px',
                          color: isDeptActive ? '#38bdf8' : '#cbd5e1',
                          background: isDeptActive ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
                          fontWeight: isDeptActive ? 700 : 500,
                          fontSize: '0.78rem',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          textDecoration: 'none',
                          transition: 'all 0.15s ease',
                          marginBottom: '0.15rem',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <span style={{ fontSize: '0.82rem' }}>🏢</span>
                          <span>Departments</span>
                        </span>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            color: isDeptActive ? '#38bdf8' : '#64748b',
                            background: isDeptActive ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.06)',
                            padding: '1px 5px',
                            borderRadius: '4px',
                          }}
                        >
                          Manage
                        </span>
                      </Link>
                    );
                  })()}

                  {service.modules.map((mod) => {
                    const modRoute = MODULE_DEFAULT_ROUTES[mod.code] || defaultServiceRoute;
                    const isModActive = (
                      (modRoute !== '/dashboard' && pathname.startsWith(modRoute)) ||
                      activeTab === `${service.code}:${mod.code}`
                    );

                    return (
                      <Link
                        key={mod.code}
                        href={modRoute}
                        onClick={() => onSelectTab(`${service.code}:${mod.code}`)}
                        style={{
                          padding: '0.45rem 0.65rem',
                          borderRadius: '6px',
                          color: isModActive ? '#38bdf8' : '#94a3b8',
                          background: isModActive ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                          fontWeight: isModActive ? 700 : 500,
                          fontSize: '0.78rem',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          textDecoration: 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {mod.name}
                        </span>
                        {mod.subModules?.length > 0 && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              color: '#64748b',
                              background: 'rgba(255,255,255,0.06)',
                              padding: '1px 5px',
                              borderRadius: '4px',
                            }}
                          >
                            {mod.subModules.length}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Company Settings Section */}
        {!isCollapsed && (
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              color: '#475569',
              letterSpacing: '0.05em',
              margin: '1rem 0 0.35rem 0.65rem',
            }}
          >
            Company &amp; Preferences
          </div>
        )}

        {(() => {
          const isSettingsActive = pathname === '/settings' || activeTab === 'settings';
          return (
            <Link
              href="/settings"
              onClick={() => onSelectTab('settings')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.68rem 0.85rem',
                borderRadius: '8px',
                color: isSettingsActive ? '#ffffff' : '#94a3b8',
                background: isSettingsActive ? '#2563eb' : 'transparent',
                fontWeight: isSettingsActive ? 700 : 500,
                fontSize: '0.86rem',
                width: '100%',
                textAlign: 'left',
                textDecoration: 'none',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                transition: 'all 0.15s ease',
              }}
              title="Company Profile & Settings"
            >
              <span style={{ color: isSettingsActive ? '#ffffff' : '#38bdf8' }}>
                <IconSettings size={18} />
              </span>
              {!isCollapsed && <span>Company Settings</span>}
            </Link>
          );
        })()}
      </nav>

      {/* Sidebar Footer User Card */}
      <div
        style={{
          padding: isCollapsed ? '1rem 0.5rem' : '1rem 1.25rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#070d1e',
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
              backgroundColor: '#1e293b',
              color: '#38bdf8',
              fontWeight: 800,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            {userInitials}
          </div>

          {!isCollapsed && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={activeCompany?.name || 'Administrator'}
              >
                {activeCompany?.name || 'Authorized Admin'}
              </div>
              <div
                style={{
                  fontSize: '0.7rem',
                  color: '#94a3b8',
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

'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import styles from './page.module.css';
import { useCompanyAuth } from '../hooks/useCompanyAuth';
import { useCompanyAccess } from '../hooks/useCompanyAccess';

// Layout & UI components
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';
import CompanyAdminBreadcrumbs from '../components/navigation/Breadcrumbs';
import ToastContainer from '../components/ui/Toast';
import EmptyState from '../components/ui/EmptyState';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';

// Module feature components
import CompanyDashboard from '../components/dashboard/CompanyDashboard';
import CrmModule from '../components/modules/CrmModule';
import ProductsModule from '../components/modules/ProductsModule';
import SalesModule from '../components/modules/SalesModule';
import PurchaseModule from '../components/modules/PurchaseModule';
import GrnModule from '../components/modules/GrnModule';
import InventoryModule from '../components/modules/InventoryModule';
import GatePassModule from '../components/modules/GatePassModule';
import ProductionModule from '../components/modules/ProductionModule';
import DispatchModule from '../components/modules/DispatchModule';
import AccountsModule from '../components/modules/AccountsModule';
import TeamModule from '../components/modules/TeamModule';
import SettingsModule from '../components/modules/SettingsModule';
import ServiceDepartments from '../components/departments/ServiceDepartments';

export function resolveTabFromPathname(pathname) {
  if (!pathname || pathname === '/' || pathname === '/dashboard') return 'dashboard';
  if (pathname === '/settings') return 'settings';

  const serviceDeptMatch = pathname.match(/^\/services\/([^\/]+)(\/departments)?$/);
  if (serviceDeptMatch) {
    return `services:${serviceDeptMatch[1].replace(/-/g, '_')}:departments`;
  }

  if (pathname.startsWith('/crm')) return 'crm_sales:crm';
  if (pathname.startsWith('/products')) return 'crm_sales:product';
  if (pathname.startsWith('/sales')) return 'crm_sales:sales';
  if (pathname.startsWith('/vendors')) return 'purchase_vendor:vendor';
  if (pathname.startsWith('/procurement')) return 'purchase_vendor:procurement';
  if (pathname.startsWith('/grn')) return 'purchase_vendor:grn';
  if (pathname.startsWith('/gate-pass')) return 'inventory_warehouse:gate_pass';
  if (pathname.startsWith('/inventory')) return 'inventory_warehouse:inventory_mgmt';
  if (pathname.startsWith('/bom')) return 'manufacturing_production:bom';
  if (pathname.startsWith('/production')) return 'manufacturing_production:production';
  if (pathname.startsWith('/returns')) return 'dispatch_returns:returns';
  if (pathname.startsWith('/dispatch')) return 'dispatch_returns:dispatch';
  if (pathname.startsWith('/accounts')) return 'accounts_banking:accounts_banking';
  if (pathname.startsWith('/team')) return 'permission_controls:permission_controls';
  return 'dashboard';
}

export default function CompanyAdminPortal({ initialTab }) {
  const pathname = usePathname();
  const router = useRouter();

  const {
    activeCompany,
    allCompanies,
    authorizedCompanies,
    hasMultipleCompanies,
    currentUser,
    isLoading,
    error,
    selectCompany,
    logout,
  } = useCompanyAuth();

  const {
    permittedServices,
    hasServiceAccess,
    hasModuleAccess,
  } = useCompanyAccess(activeCompany);

  const [activeTab, setActiveTab] = useState(() => initialTab || resolveTabFromPathname(pathname));
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState([]);

  // Keep activeTab synchronized when pathname changes (browser back/forward, direct link)
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else if (pathname) {
      setActiveTab(resolveTabFromPathname(pathname));
    }
  }, [pathname, initialTab]);

  // Toast notification helper
  const showToast = (title, message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleLogout = () => {
    logout();
    showToast('Session Ended', 'Logged out of company workspace.', 'info');
  };

  // Render content area based on activeTab & granted access
  const renderContent = () => {
    // 1. Loading State
    if (isLoading) {
      return (
        <div style={{ padding: '2rem 0' }}>
          <LoadingSkeleton rows={5} height="48px" />
        </div>
      );
    }

    // 2. API Error State (Distinguished from empty data)
    if (error) {
      return (
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '3rem 2rem', textAlign: 'center', border: '1px solid #fecaca', margin: '2rem auto', maxWidth: '600px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#991b1b', marginBottom: '0.5rem' }}>
            API Connection Error
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#b91c1c', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {error}. Ensure the backend service is running and accessible.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '0.65rem 1.35rem',
              borderRadius: '8px',
              background: '#2563eb',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.85rem',
            }}
          >
            Retry Connection
          </button>
        </div>
      );
    }

    // 3. No Company Context State
    if (!activeCompany) {
      // 3A. Multiple authorized companies exist, none chosen yet
      if (hasMultipleCompanies && authorizedCompanies.length > 1) {
        return (
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '3rem 2rem', textAlign: 'center', border: '1px solid #e2e8f0', margin: '2rem auto', maxWidth: '600px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏢</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
              Select Authorized Company Panel
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Your authenticated account is associated with multiple company panels. Choose which authorized workspace to enter:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxWidth: '380px', margin: '0 auto' }}>
              {authorizedCompanies.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCompany(c.id)}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.background = '#eff6ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.background = '#f8fafc';
                  }}
                >
                  <div>
                    <div>{c.organizationName}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Admin: {c.name}</div>
                  </div>
                  <span style={{ color: '#2563eb', fontWeight: 800 }}>→</span>
                </button>
              ))}
            </div>
          </div>
        );
      }

      // 3B. Truly No Company Mapped
      return (
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '3rem 2rem', textAlign: 'center', border: '1px solid #e2e8f0', margin: '2rem auto', maxWidth: '600px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏢</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
            No Provisioned Company Panel Mapped
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.6, marginBottom: '1rem' }}>
            Your authenticated user account does not currently have any company tenant assigned or provisioned in MySQL.
          </p>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
            Please contact your Platform Super Admin to provision your company panel and configure your authorized services.
          </p>
        </div>
      );
    }

    // 1. Dashboard View
    if (activeTab === 'dashboard') {
      return (
        <CompanyDashboard
          activeCompany={activeCompany}
          permittedServices={permittedServices}
          onNavigate={(tab) => setActiveTab(tab)}
        />
      );
    }

    // 2. Settings View
    if (activeTab === 'settings') {
      return (
        <SettingsModule
          activeCompany={activeCompany}
          permittedServices={permittedServices}
        />
      );
    }

    // 3. Service Departments View (MANDATORY REQUIREMENT: Initiated from authorized service context)
    if (activeTab.startsWith('services:') && activeTab.endsWith(':departments')) {
      const targetServiceCode = activeTab.split(':')[1];
      const isServicePermitted = hasServiceAccess(targetServiceCode);
      if (!isServicePermitted) {
        return (
          <div style={{ background: '#ffffff', borderRadius: '14px', padding: '3.5rem 2rem', textAlign: 'center', border: '1px solid #fed7aa', margin: '1rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.85rem' }}>🔒</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#9a3412', marginBottom: '0.5rem' }}>
              Service Access Restricted
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#7c2d12', maxWidth: '520px', margin: '0 auto', lineHeight: 1.6 }}>
              Department creation and management is restricted. The requested service is not assigned to <strong>{activeCompany.organizationName}</strong> by Super Admin.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              style={{
                marginTop: '1.5rem',
                padding: '0.65rem 1.35rem',
                borderRadius: '8px',
                background: '#2563eb',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Return to Dashboard
            </button>
          </div>
        );
      }
      return (
        <ServiceDepartments
          activeCompany={activeCompany}
          serviceCode={targetServiceCode}
          showToast={showToast}
          onNavigate={(tab) => setActiveTab(tab)}
        />
      );
    }

    // 4. Service & Module Views with Permission Enforcement
    const baseServiceCode = activeTab.split(':')[0];
    const subModuleCode = activeTab.split(':')[1];

    // Check if the service is permitted for this company
    const isServicePermitted = hasServiceAccess(baseServiceCode);
    if (!isServicePermitted) {
      return (
        <div style={{ background: '#ffffff', borderRadius: '14px', padding: '3.5rem 2rem', textAlign: 'center', border: '1px solid #fed7aa', margin: '1rem 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.85rem' }}>🔒</div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#9a3412', marginBottom: '0.5rem' }}>
            Service Access Restricted
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#7c2d12', maxWidth: '520px', margin: '0 auto', lineHeight: 1.6 }}>
            Access to this service is not permitted for <strong>{activeCompany.organizationName}</strong> under the current subscription plan. Contact Platform Super Admin to request permission activation.
          </p>
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            style={{
              marginTop: '1.5rem',
              padding: '0.65rem 1.35rem',
              borderRadius: '8px',
              background: '#2563eb',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.85rem',
            }}
          >
            Return to Dashboard
          </button>
        </div>
      );
    }

    // Route to permitted module component
    switch (baseServiceCode) {
      case 'crm_sales':
        if (subModuleCode === 'product') {
          return <ProductsModule activeCompany={activeCompany} showToast={showToast} />;
        }
        if (subModuleCode === 'sales') {
          return <SalesModule activeCompany={activeCompany} showToast={showToast} />;
        }
        return <CrmModule activeCompany={activeCompany} showToast={showToast} />;

      case 'purchase_vendor':
        if (subModuleCode === 'grn') {
          return <GrnModule activeCompany={activeCompany} showToast={showToast} />;
        }
        return <PurchaseModule activeCompany={activeCompany} showToast={showToast} />;

      case 'inventory_warehouse':
        if (subModuleCode === 'gate_pass') {
          return <GatePassModule activeCompany={activeCompany} showToast={showToast} />;
        }
        return <InventoryModule activeCompany={activeCompany} showToast={showToast} />;

      case 'manufacturing_production':
        return <ProductionModule activeCompany={activeCompany} showToast={showToast} />;

      case 'dispatch_returns':
        return <DispatchModule activeCompany={activeCompany} showToast={showToast} />;

      case 'accounts_banking':
        return <AccountsModule activeCompany={activeCompany} showToast={showToast} />;

      case 'permission_controls':
        return <TeamModule activeCompany={activeCompany} showToast={showToast} />;

      default:
        return (
          <CompanyDashboard
            activeCompany={activeCompany}
            permittedServices={permittedServices}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        );
    }
  };

  if (isLoading || !currentUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1329', color: '#94a3b8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem' }}>
          <div style={{ width: '18px', height: '18px', border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Verifying workspace session...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.appContainer}>
      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Collapsible Left Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        activeCompany={activeCompany}
        permittedServices={permittedServices}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
      />

      {/* Main Workspace Area */}
      <div className={styles.mainContent}>
        {/* Top Header Navbar */}
        <Topbar
          activeTab={activeTab}
          activeCompany={activeCompany}
          allCompanies={allCompanies}
          hasMultipleCompanies={hasMultipleCompanies}
          currentUser={currentUser}
          onSelectCompany={selectCompany}
          onSelectTab={(tab) => setActiveTab(tab)}
          onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onLogout={handleLogout}
        />

        {/* Content Body */}
        <main className={styles.contentArea}>
          {activeCompany && (
            <div style={{ marginBottom: '1.35rem' }}>
              <CompanyAdminBreadcrumbs activeCompany={activeCompany} />
            </div>
          )}
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

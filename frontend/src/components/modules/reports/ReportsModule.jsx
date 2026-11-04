'use client';

import { useState } from 'react';
import styles from './reports.module.css';
import ExecutiveDashboardTab from './ExecutiveDashboardTab';
import FinancialStatementsTab from './FinancialStatementsTab';
import OperationalReportsTab from './OperationalReportsTab';
import CrossModuleFlowTab from './CrossModuleFlowTab';

const MAIN_TABS = [
  { id: 'executive', label: 'Executive Dashboard', icon: '📊', permissionKey: 'executive' },
  { id: 'financial', label: 'Financial Statements', icon: '💰', permissionKey: 'financial' },
  { id: 'operational', label: 'Operational Reports', icon: '📦', permissionKey: 'operational' },
  { id: 'cross-module', label: 'Cross-Module Flow Traces', icon: '🔗', permissionKey: 'cross_module' },
];

export default function ReportsModule({
  activeCompany,
  currentUser,
  showToast,
  initialSubTab = null,
}) {
  const [activeTab, setActiveTab] = useState(() => {
    if (initialSubTab === 'financial') return 'financial';
    if (initialSubTab === 'operational') return 'operational';
    if (initialSubTab === 'cross-module') return 'cross-module';
    return 'executive';
  });

  const isAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'COMPANY_ADMIN';
  const permissions = currentUser?.permissions || {};

  // Check tab accessibility
  const canViewExecutive = isAdmin || permissions.viewExecutiveDashboard === true || permissions.executive_dashboard === true;
  const canViewFinancial = isAdmin || permissions.viewFinancialReports === true || permissions.accounting === true || permissions.financial_reports === true;
  const canViewOperational = true; // Modular operational reports filter internal sections
  const canViewCrossModule = isAdmin || currentUser?.role === 'DEPARTMENT_HEAD' || permissions.viewExecutiveDashboard === true;

  const accessibleTabs = MAIN_TABS.filter((t) => {
    if (t.id === 'executive') return canViewExecutive;
    if (t.id === 'financial') return canViewFinancial;
    if (t.id === 'operational') return canViewOperational;
    if (t.id === 'cross-module') return canViewCrossModule;
    return true;
  });

  return (
    <div className={styles.portalContainer}>
      {/* Print Banner */}
      <div className={styles.printBanner}>
        <h1>{activeCompany?.organizationName || activeCompany?.name || 'AZZUNIQE CRM & ERP'}</h1>
        <p>Enterprise Business Intelligence & Audit Reports Portal — Date: {new Date().toLocaleDateString('en-IN')}</p>
      </div>

      {/* Main Page Header */}
      <div className={`${styles.headerCard} no-print`}>
        <div>
          <h1 className={styles.headerTitle}>
            <span>📊</span> Reports & Business Intelligence Portal
          </h1>
          <div className={styles.headerSubtitle}>
            Centralized financial statements, operational metrics, and cross-module audit reconciliation
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`${styles.badge} ${styles.badgePrimary}`}>
            {activeCompany?.organizationName || 'Current Organization'}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={`${styles.navTabs} no-print`}>
        {accessibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${styles.navTab} ${activeTab === tab.id ? styles.navTabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {activeTab === 'executive' && (
        <ExecutiveDashboardTab
          activeCompany={activeCompany}
          currentUser={currentUser}
          showToast={showToast}
        />
      )}

      {activeTab === 'financial' && (
        <FinancialStatementsTab
          activeCompany={activeCompany}
          currentUser={currentUser}
          showToast={showToast}
        />
      )}

      {activeTab === 'operational' && (
        <OperationalReportsTab
          activeCompany={activeCompany}
          currentUser={currentUser}
          showToast={showToast}
        />
      )}

      {activeTab === 'cross-module' && (
        <CrossModuleFlowTab
          activeCompany={activeCompany}
          currentUser={currentUser}
          showToast={showToast}
        />
      )}
    </div>
  );
}


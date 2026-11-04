'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getStoredUser } from '@/lib/auth';
import styles from './HrmsModule.module.css';

// 11 Modular Tabs
import EmployeeMasterTab from './hrms/EmployeeMasterTab';
import OnboardingKycTab from './hrms/OnboardingKycTab';
import DocumentVaultTab from './hrms/DocumentVaultTab';
import AttendanceTab from './hrms/AttendanceTab';
import ShiftManagementTab from './hrms/ShiftManagementTab';
import LeaveManagementTab from './hrms/LeaveManagementTab';
import BiometricTab from './hrms/BiometricTab';
import SalaryStructureTab from './hrms/SalaryStructureTab';
import PayrollProcessingTab from './hrms/PayrollProcessingTab';
import StatutoryComplianceTab from './hrms/StatutoryComplianceTab';
import EmployeePayslipsTab from './hrms/EmployeePayslipsTab';

const TABS = [
  { id: 'employees', label: '1. Employee Directory', icon: '👥' },
  { id: 'onboarding', label: '2. Onboarding & KYC', icon: '📝' },
  { id: 'documents', label: '3. Document Vault', icon: '📁' },
  { id: 'attendance', label: '4. Daily Attendance', icon: '⏱️' },
  { id: 'shifts', label: '5. Shift Management', icon: '🔄' },
  { id: 'leaves', label: '6. Leave Management', icon: '🌴' },
  { id: 'biometric', label: '7. Biometric Punch', icon: '📟' },
  { id: 'structure', label: '8. Salary Structure', icon: '💵' },
  { id: 'process', label: '9. Monthly Payroll', icon: '⚙️' },
  { id: 'statutory', label: '10. Statutory Compliance', icon: '⚖️' },
  { id: 'payslips', label: '11. Employee Payslips', icon: '📄' },
];

export default function HrmsModule({
  activeCompany,
  showToast,
  initialSubTab = 'employees',
  hasSubModuleAccess,
  pathname = '',
}) {
  const getSubTabFromUrl = useCallback(() => {
    if (pathname.includes('/hr/onboarding')) return 'onboarding';
    if (pathname.includes('/hr/documents')) return 'documents';
    if (pathname.includes('/hr/attendance')) return 'attendance';
    if (pathname.includes('/hr/shifts')) return 'shifts';
    if (pathname.includes('/hr/leaves')) return 'leaves';
    if (pathname.includes('/hr/biometric')) return 'biometric';
    if (pathname.includes('/payroll/structure')) return 'structure';
    if (pathname.includes('/payroll/process')) return 'process';
    if (pathname.includes('/payroll/statutory')) return 'statutory';
    if (pathname.includes('/payroll/payslips')) return 'payslips';
    if (pathname.includes('/hr/employees')) return 'employees';
    if (pathname.includes('/payroll')) return 'process';
    if (pathname.includes('/hr')) return 'employees';
    return initialSubTab || 'employees';
  }, [pathname, initialSubTab]);

  const [activeTab, setActiveTab] = useState(getSubTabFromUrl());
  const [currentUser, setCurrentUser] = useState(null);

  const companyId = activeCompany?.id || activeCompany?._id;

  useEffect(() => {
    setActiveTab(getSubTabFromUrl());
  }, [getSubTabFromUrl]);

  useEffect(() => {
    const user = getStoredUser();
    if (user) setCurrentUser(user);
  }, []);

  const toast = useCallback(
    (msg, type = 'success') => {
      if (typeof showToast === 'function') {
        showToast(msg, type);
      } else {
        console.log(`[Toast ${type}]: ${msg}`);
      }
    },
    [showToast]
  );

  const userRole = currentUser?.role || 'COMPANY_ADMIN';
  const currentUserId = currentUser?.userId || currentUser?.id;

  return (
    <div className={styles.module}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Phase 9 Enterprise Human Resources & Compensation</span>
          <h2>AZZUNIQE HRMS & Payroll Workspace</h2>
          <p>
            Connected to <strong>{activeCompany?.organizationName || activeCompany?.name || 'Company Workspace'}</strong>
          </p>
        </div>
      </div>

      {/* 11 Section Tabs */}
      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? styles.active : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'employees' && (
          <EmployeeMasterTab companyId={companyId} toast={toast} userRole={userRole} />
        )}
        {activeTab === 'onboarding' && (
          <OnboardingKycTab companyId={companyId} toast={toast} userRole={userRole} />
        )}
        {activeTab === 'documents' && (
          <DocumentVaultTab companyId={companyId} toast={toast} userRole={userRole} />
        )}
        {activeTab === 'attendance' && (
          <AttendanceTab companyId={companyId} toast={toast} userRole={userRole} />
        )}
        {activeTab === 'shifts' && (
          <ShiftManagementTab companyId={companyId} toast={toast} userRole={userRole} />
        )}
        {activeTab === 'leaves' && (
          <LeaveManagementTab companyId={companyId} toast={toast} userRole={userRole} />
        )}
        {activeTab === 'biometric' && (
          <BiometricTab companyId={companyId} toast={toast} userRole={userRole} />
        )}
        {activeTab === 'structure' && (
          <SalaryStructureTab companyId={companyId} toast={toast} userRole={userRole} />
        )}
        {activeTab === 'process' && (
          <PayrollProcessingTab companyId={companyId} toast={toast} userRole={userRole} />
        )}
        {activeTab === 'statutory' && (
          <StatutoryComplianceTab companyId={companyId} toast={toast} userRole={userRole} />
        )}
        {activeTab === 'payslips' && (
          <EmployeePayslipsTab
            companyId={companyId}
            toast={toast}
            userRole={userRole}
            currentUserId={currentUserId}
          />
        )}
      </div>
    </div>
  );
}

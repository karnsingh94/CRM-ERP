'use client';

import { createContext, useContext } from 'react';
import { CompanyAuthProvider, useCompanyAuthContext } from './CompanyAuthContext';

const UnifiedAuthContext = createContext(null);

export function AuthProvider({ children }) {
  return (
    <CompanyAuthProvider>
      <UnifiedAuthBridge>{children}</UnifiedAuthBridge>
    </CompanyAuthProvider>
  );
}

function UnifiedAuthBridge({ children }) {
  const companyAuth = useCompanyAuthContext();

  const value = {
    ...companyAuth,
    user: companyAuth?.currentUser,
    role: companyAuth?.currentUser?.role,
    isSuperAdmin: companyAuth?.currentUser?.role === 'SUPER_ADMIN',
    isCompanyAdmin: companyAuth?.currentUser?.role === 'COMPANY_ADMIN',
    isDepartmentHead: companyAuth?.currentUser?.role === 'DEPARTMENT_HEAD',
    isEmployee: companyAuth?.currentUser?.role === 'EMPLOYEE',
  };

  return (
    <UnifiedAuthContext.Provider value={value}>
      {children}
    </UnifiedAuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(UnifiedAuthContext);
  if (!context) {
    return useCompanyAuthContext();
  }
  return context;
}

export default UnifiedAuthContext;

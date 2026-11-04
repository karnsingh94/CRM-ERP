import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Commercial Banking & Bank Book — AZZUNIQE Company Admin',
  description: 'Bank account management, statement imports, and Bank Book statements',
};

export default function AccountsBankingPage() {
  return <CompanyAdminPortal initialTab="accounts_banking:accounts_banking" initialSubTab="banking" />;
}


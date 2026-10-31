import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Biometric Integration — AZZUNIQE Company Admin',
  description: 'Biometric devices integration and real-time punch ingestion',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="hrms_payroll:hr_attendance" initialSubTab="attendance" />;
}

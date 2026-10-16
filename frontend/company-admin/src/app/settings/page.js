import CompanyAdminPortal from '../page';

export const metadata = {
  title: 'Company Settings — AZZUNIQE Company Admin',
  description: 'Company Profile, Organization Details, and Tenant Preferences',
};

export default function SettingsPage() {
  return <CompanyAdminPortal initialTab="settings" />;
}

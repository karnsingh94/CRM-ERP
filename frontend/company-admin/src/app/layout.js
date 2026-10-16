import './globals.css';

export const metadata = {
  title: 'AZZUNIQE CRM & ERP — Company Admin Portal',
  description: 'Enterprise Multi-Tenant CRM & ERP Workspace for Provisioned Companies',
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

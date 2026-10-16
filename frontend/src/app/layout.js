import './globals.css';

export const metadata = {
  title: 'AZZUNIQE CRM & ERP',
  description: 'Enterprise Multi-Tier Multi-Tenant CRM & ERP Platform',
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

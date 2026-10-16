import "./globals.css";

export const metadata = {
  title: "CRM & ERP - Super Admin Portal",
  description: "Super Admin Management Panel for CRM & ERP System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Breadcrumb from './Breadcrumb';

export default function DashboardLayout({ children, currentTab, onTabChange }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#1e293b',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <Sidebar
        currentTab={currentTab}
        onTabChange={onTabChange}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          transition: 'margin-left 0.2s ease',
        }}
      >
        <Topbar
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          sidebarCollapsed={sidebarCollapsed}
        />
        <main
          style={{
            flex: 1,
            padding: '1.5rem',
            maxWidth: '1600px',
            width: '100%',
            margin: '0 auto',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ marginBottom: '1.25rem' }}>
            <Breadcrumb />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

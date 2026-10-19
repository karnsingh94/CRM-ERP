'use client';

import { useState } from 'react';
import { useCompanyAuthContext } from '@/context/CompanyAuthContext';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';

export default function EmployeeDashboardFeature() {
  const { currentUser, activeCompany } = useCompanyAuthContext();
  const [punchedIn, setPunchedIn] = useState(true);

  const mockAssignments = [
    { id: 'JOB-401', service: 'CRM & Sales', title: 'Follow-up with Enterprise Lead: TechNova', priority: 'High', status: 'In Progress' },
    { id: 'JOB-402', service: 'Inventory', title: 'Warehouse stock count verification: Bin A-12', priority: 'Normal', status: 'Pending' },
    { id: 'JOB-403', service: 'Dispatch', title: 'Prepare packaging labels for shipment #892', priority: 'High', status: 'Completed' },
  ];

  const columns = [
    { header: 'Job ID', key: 'id', width: '110px' },
    { header: 'Module', key: 'service', width: '160px' },
    { header: 'Task Description', key: 'title' },
    {
      header: 'Priority',
      key: 'priority',
      width: '110px',
      render: (row) => (
        <Badge variant={row.priority === 'High' ? 'warning' : 'default'}>
          {row.priority}
        </Badge>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      width: '140px',
      render: (row) => (
        <Badge variant={row.status === 'Completed' ? 'success' : 'primary'}>
          {row.status}
        </Badge>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          borderRadius: '16px',
          padding: '2rem',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <Badge variant="primary">EMPLOYEE WORKSPACE</Badge>
            <span style={{ fontSize: '0.85rem', color: '#c7d2fe' }}>
              {activeCompany?.name || 'Company Workspace'}
            </span>
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0 }}>
            Welcome, {currentUser?.name || 'Employee'}
          </h1>
          <p style={{ fontSize: '0.88rem', color: '#e0e7ff', margin: '0.4rem 0 0 0' }}>
            Department: {currentUser?.departmentName || 'General Staff'} • ID: {currentUser?.id || 'EMP-001'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Button
            variant={punchedIn ? 'danger' : 'primary'}
            onClick={() => setPunchedIn(!punchedIn)}
          >
            {punchedIn ? 'Punch Out' : 'Punch In (Start Shift)'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        <Card title="Shift Status" subtitle="Today's attendance">
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: punchedIn ? '#10b981' : '#64748b' }}>
            {punchedIn ? 'Active (Punched In)' : 'Off Duty'}
          </div>
          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>09:00 AM - 06:00 PM</p>
        </Card>
        <Card title="Assigned Jobs" subtitle="Active tasks">
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary, #7f22fe)' }}>3</div>
          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>1 completed today</p>
        </Card>
        <Card title="Assigned Modules" subtitle="Permitted access">
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#6366f1' }}>
            {activeCompany?.access?.services?.length || 3}
          </div>
          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>Work areas</p>
        </Card>
      </div>

      {/* Assigned Tasks Table */}
      <Card title="My Work Schedule & Tasks" subtitle="Direct job orders assigned to your station">
        <Table columns={columns} data={mockAssignments} />
      </Card>
    </div>
  );
}

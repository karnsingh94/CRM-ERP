'use client';

import { useCompanyAuthContext } from '@/context/CompanyAuthContext';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Table from '@/components/ui/Table';

export default function DepartmentHeadDashboardFeature() {
  const { currentUser, activeCompany } = useCompanyAuthContext();

  const deptName = currentUser?.departmentName || 'Operations';

  const mockTasks = [
    { id: 'TSK-101', title: 'Review incoming purchase requisitions', priority: 'High', status: 'Pending Review', due: 'Today' },
    { id: 'TSK-102', title: 'Approve vendor invoice discrepancy', priority: 'Urgent', status: 'Action Required', due: 'Today' },
    { id: 'TSK-103', title: 'Weekly shift schedule verification', priority: 'Medium', status: 'Completed', due: 'Yesterday' },
  ];

  const columns = [
    { header: 'Task ID', key: 'id', width: '120px' },
    { header: 'Task Title', key: 'title' },
    {
      header: 'Priority',
      key: 'priority',
      width: '120px',
      render: (row) => (
        <Badge variant={row.priority === 'Urgent' ? 'danger' : row.priority === 'High' ? 'warning' : 'info'}>
          {row.priority}
        </Badge>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      width: '160px',
      render: (row) => (
        <Badge variant={row.status === 'Completed' ? 'success' : 'default'}>
          {row.status}
        </Badge>
      ),
    },
    { header: 'Due', key: 'due', width: '100px' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
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
            <Badge variant="primary">DEPARTMENT HEAD</Badge>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              {activeCompany?.name || 'Company Workspace'}
            </span>
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0 }}>
            {deptName} Department Portal
          </h1>
          <p style={{ fontSize: '0.88rem', color: '#cbd5e1', margin: '0.4rem 0 0 0' }}>
            Welcome, {currentUser?.name || 'Department Head'}. Manage departmental workflows, approvals, and team assignments.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
        }}
      >
        <Card title="Department Staff" subtitle="Active members">
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary, #7f22fe)' }}>12</div>
          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>All rostered</p>
        </Card>
        <Card title="Pending Approvals" subtitle="Awaiting review">
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>3</div>
          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>2 requisitions, 1 bill</p>
        </Card>
        <Card title="Workflow Efficiency" subtitle="Current week">
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>98.4%</div>
          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>On schedule</p>
        </Card>
        <Card title="Active Modules" subtitle="Permitted access">
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#6366f1' }}>
            {activeCompany?.access?.services?.length || 4}
          </div>
          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>Assigned services</p>
        </Card>
      </div>

      {/* Department Tasks Table */}
      <Card title="Departmental Action Queue" subtitle="Pending items requiring departmental head attention">
        <Table columns={columns} data={mockTasks} />
      </Card>
    </div>
  );
}

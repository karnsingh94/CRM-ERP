'use client';

import { useState } from 'react';
import { IconUsers, IconCalendar, IconCreditCard, IconSearch, IconPlus, IconShield, IconClock } from '../ui/Icons';
import EmptyState from '../ui/EmptyState';

export default function HrmsModule({ activeCompany, showToast, initialSubTab = 'employees' }) {
  const [activeTab, setActiveTab] = useState(initialSubTab || 'employees');
  const [searchQuery, setSearchQuery] = useState('');

  // Sample operational state for permitted tenants
  const [employees, setEmployees] = useState([
    {
      id: 'emp-1',
      empCode: 'EMP-001',
      name: 'Rajesh Kumar',
      designation: 'Production Engineer',
      department: 'Manufacturing',
      status: 'ACTIVE',
      joinDate: '2025-04-15',
      salary: '₹ 45,000 / mo',
      attendanceToday: 'PRESENT',
    },
    {
      id: 'emp-2',
      empCode: 'EMP-002',
      name: 'Sunita Sharma',
      designation: 'Quality Control Lead',
      department: 'Quality Assurance',
      status: 'ACTIVE',
      joinDate: '2025-06-01',
      salary: '₹ 50,000 / mo',
      attendanceToday: 'PRESENT',
    },
    {
      id: 'emp-3',
      empCode: 'EMP-003',
      name: 'Amit Patel',
      designation: 'Warehouse Supervisor',
      department: 'Logistics',
      status: 'ACTIVE',
      joinDate: '2025-08-10',
      salary: '₹ 38,000 / mo',
      attendanceToday: 'ON_LEAVE',
    },
  ]);

  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.empCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7f22fe', background: '#f3e8ff', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
              Service 8 • Blueprint Certified
            </span>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>HRMS &amp; Payroll Workspace</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>
            Enterprise staff directory, shift rosters, biometric attendance, and statutory payroll compliance for {activeCompany?.organizationName || 'your organization'}
          </p>
        </div>

        <button
          onClick={() => showToast?.('Employee registration drawer opened', 'info')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.15rem',
            background: '#7f22fe',
            color: '#ffffff',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          <IconPlus size={16} /> Add Employee
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        <div style={{ background: '#ffffff', padding: '1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Active Headcount</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: '0.3rem 0' }}>{employees.length}</div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>100% KYC Verified</div>
        </div>
        <div style={{ background: '#ffffff', padding: '1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Today&apos;s Attendance</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#16a34a', margin: '0.3rem 0' }}>
            {employees.filter((e) => e.attendanceToday === 'PRESENT').length} / {employees.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>1 On Approved Leave</div>
        </div>
        <div style={{ background: '#ffffff', padding: '1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Current Payroll Batch</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#7f22fe', margin: '0.3rem 0' }}>₹ 1,33,000</div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>PF / ESI Calculated</div>
        </div>
        <div style={{ background: '#ffffff', padding: '1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Biometric Sync Status</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0284c7', margin: '0.3rem 0' }}>ONLINE</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Last sync: 2 mins ago</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem' }}>
        {[
          { key: 'employees', label: 'Employee Master & KYC', icon: IconUsers },
          { key: 'attendance', label: 'Attendance & Leaves', icon: IconCalendar },
          { key: 'payroll', label: 'Payroll & Statutory', icon: IconCreditCard },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1rem',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '3px solid #7f22fe' : '3px solid transparent',
                color: isActive ? '#7f22fe' : '#64748b',
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {activeTab === 'employees' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Search bar */}
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '320px' }}>
              <IconSearch size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search staff by name, code, dept..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem 0.45rem 2.1rem',
                  fontSize: '0.85rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Showing <strong>{filteredEmployees.length}</strong> staff members
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Emp Code</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Employee Name</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Designation</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Department</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Joining Date</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#7f22fe' }}>{emp.empCode}</td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>{emp.name}</td>
                    <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>{emp.designation}</td>
                    <td style={{ padding: '0.85rem 1rem', color: '#64748b' }}>
                      <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                        {emp.department}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.8rem' }}>{emp.joinDate}</td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                        {emp.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                      <button
                        onClick={() => showToast?.(`Viewing employee profile for ${emp.name}`, 'info')}
                        style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, color: '#7f22fe', background: '#f3e8ff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Daily Attendance Roster</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>Integrated with on-site biometric punch hardware</p>
            </div>
            <button
              onClick={() => showToast?.('Syncing with biometric hardware...', 'info')}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Sync Devices Now
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem' }}>Employee</th>
                <th style={{ padding: '0.75rem 1rem' }}>Punch In</th>
                <th style={{ padding: '0.75rem 1rem' }}>Punch Out</th>
                <th style={{ padding: '0.75rem 1rem' }}>Total Hours</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Shift Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{emp.name} ({emp.empCode})</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{emp.attendanceToday === 'PRESENT' ? '09:02 AM' : '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{emp.attendanceToday === 'PRESENT' ? 'In Progress' : '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{emp.attendanceToday === 'PRESENT' ? '4.5 hrs' : '0 hrs'}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: emp.attendanceToday === 'PRESENT' ? '#ecfdf5' : '#fef2f2',
                      color: emp.attendanceToday === 'PRESENT' ? '#065f46' : '#991b1b',
                      border: `1px solid ${emp.attendanceToday === 'PRESENT' ? '#a7f3d0' : '#fecaca'}`,
                    }}>
                      {emp.attendanceToday}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'payroll' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Monthly Payroll &amp; Statutory Compliance</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>PF, ESIC, Professional Tax, and TDS automated deductions</p>
            </div>
            <button
              onClick={() => showToast?.('Processing monthly payroll batch...', 'success')}
              style={{ padding: '0.5rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', background: '#7f22fe', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Run Current Month Payroll
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem' }}>Employee</th>
                <th style={{ padding: '0.75rem 1rem' }}>Gross Salary</th>
                <th style={{ padding: '0.75rem 1rem' }}>EPF (12%)</th>
                <th style={{ padding: '0.75rem 1rem' }}>ESIC (0.75%)</th>
                <th style={{ padding: '0.75rem 1rem' }}>TDS</th>
                <th style={{ padding: '0.75rem 1rem' }}>Net Payout</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Payslip</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{emp.name}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>{emp.salary}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>₹ 1,800</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>₹ 320</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>₹ 0</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#16a34a' }}>₹ 42,880</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <button
                      onClick={() => showToast?.(`Downloading payslip for ${emp.name}`, 'info')}
                      style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 600, color: '#7f22fe', background: '#f3e8ff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


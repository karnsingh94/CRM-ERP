'use client';

import { useState, useEffect } from 'react';
import {
  IconUsers,
  IconCalendar,
  IconCreditCard,
  IconSearch,
  IconPlus,
  IconShield,
  IconClock,
  IconCheckCircle,
  IconAlertTriangle,
  IconTrash,
  IconEdit,
  IconBuilding,
  IconPackage,
} from '../ui/Icons';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';

export default function HrmsModule({
  activeCompany,
  showToast,
  initialSubTab = 'employees',
  pathname = '',
}) {
  // Determine active screen based on URL pathname or initialSubTab
  const getSubTabFromUrl = () => {
    if (pathname.includes('/hr/onboarding')) return 'onboarding';
    if (pathname.includes('/hr/documents')) return 'documents';
    if (pathname.includes('/hr/attendance')) return 'attendance';
    if (pathname.includes('/hr/shifts')) return 'shifts';
    if (pathname.includes('/hr/leaves')) return 'leaves';
    if (pathname.includes('/hr/biometric')) return 'biometric';
    if (pathname.includes('/payroll/structure')) return 'structure';
    if (pathname.includes('/payroll/process')) return 'process';
    if (pathname.includes('/payroll/statutory')) return 'statutory';
    if (pathname.includes('/payroll/payslips')) return 'payslips';
    if (pathname.includes('/hr/employees')) return 'employees';
    return initialSubTab || 'employees';
  };

  const [activeTab, setActiveTab] = useState(getSubTabFromUrl());
  const [searchQuery, setSearchQuery] = useState('');

  // Sync tab if pathname changes
  useEffect(() => {
    setActiveTab(getSubTabFromUrl());
  }, [pathname, initialSubTab]);

  // ================= STATE FOR HR & EMPLOYEES =================
  const [employees, setEmployees] = useState([
    {
      id: 'emp-1',
      empCode: 'EMP-001',
      name: 'Rajesh Kumar',
      email: 'rajesh.k@company.com',
      phone: '+91 98765 43210',
      designation: 'Production Engineer',
      department: 'Manufacturing',
      status: 'ACTIVE',
      joinDate: '2025-04-15',
      salary: 45000,
      shift: 'Morning (09:00 - 18:00)',
      attendanceToday: 'PRESENT',
    },
    {
      id: 'emp-2',
      empCode: 'EMP-002',
      name: 'Sunita Sharma',
      email: 'sunita.s@company.com',
      phone: '+91 98765 11223',
      designation: 'Quality Control Lead',
      department: 'Quality Assurance',
      status: 'ACTIVE',
      joinDate: '2025-06-01',
      salary: 50000,
      shift: 'Morning (09:00 - 18:00)',
      attendanceToday: 'PRESENT',
    },
    {
      id: 'emp-3',
      empCode: 'EMP-003',
      name: 'Amit Patel',
      email: 'amit.p@company.com',
      phone: '+91 98765 33445',
      designation: 'Warehouse Supervisor',
      department: 'Logistics',
      status: 'ACTIVE',
      joinDate: '2025-08-10',
      salary: 38000,
      shift: 'Evening (14:00 - 22:00)',
      attendanceToday: 'ON_LEAVE',
    },
    {
      id: 'emp-4',
      empCode: 'EMP-004',
      name: 'Pooja Verma',
      email: 'pooja.v@company.com',
      phone: '+91 98765 55667',
      designation: 'Accounts Executive',
      department: 'Finance',
      status: 'ACTIVE',
      joinDate: '2025-09-01',
      salary: 42000,
      shift: 'Morning (09:00 - 18:00)',
      attendanceToday: 'PRESENT',
    },
  ]);

  // Modal: Add Employee
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    empCode: '',
    email: '',
    phone: '',
    department: 'Manufacturing',
    designation: '',
    salary: '',
    joinDate: new Date().toISOString().split('T')[0],
  });

  const handleAddEmployee = (e) => {
    e.preventDefault();
    if (!newEmployee.name.trim() || !newEmployee.empCode.trim()) {
      showToast?.('Validation Error', 'Name and Employee Code are required.', 'error');
      return;
    }
    const emp = {
      id: `emp-${Date.now()}`,
      empCode: newEmployee.empCode.trim(),
      name: newEmployee.name.trim(),
      email: newEmployee.email.trim() || `${newEmployee.empCode.toLowerCase()}@company.com`,
      phone: newEmployee.phone.trim() || '+91 99999 00000',
      designation: newEmployee.designation.trim() || 'Staff Associate',
      department: newEmployee.department,
      status: 'ACTIVE',
      joinDate: newEmployee.joinDate,
      salary: Number(newEmployee.salary) || 35000,
      shift: 'Morning (09:00 - 18:00)',
      attendanceToday: 'PRESENT',
    };
    setEmployees((prev) => [emp, ...prev]);
    setIsAddEmployeeModalOpen(false);
    setNewEmployee({
      name: '',
      empCode: '',
      email: '',
      phone: '',
      department: 'Manufacturing',
      designation: '',
      salary: '',
      joinDate: new Date().toISOString().split('T')[0],
    });
    showToast?.('Employee Registered', `${emp.name} added to staff master.`, 'success');
  };

  // ================= STATE FOR ONBOARDING & KYC =================
  const [candidates, setCandidates] = useState([
    { id: 'c-1', name: 'Vikram Singh', role: 'Machine Operator', stage: 'DOCUMENTATION', kycStatus: 'VERIFIED', offerDate: '2026-10-20' },
    { id: 'c-2', name: 'Neha Gupta', role: 'HR Coordinator', stage: 'KYC_PENDING', kycStatus: 'UNDER_REVIEW', offerDate: '2026-10-25' },
    { id: 'c-3', name: 'Rahul Joshi', role: 'Safety Inspector', stage: 'OFFER_RELEASED', kycStatus: 'PENDING', offerDate: '2026-10-28' },
  ]);

  const handleVerifyKyc = (id, candidateName) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, kycStatus: 'VERIFIED', stage: 'ONBOARDED' } : c))
    );
    showToast?.('KYC Approved', `KYC verification completed for ${candidateName}.`, 'success');
  };

  // ================= STATE FOR DOCUMENT VAULT =================
  const [documents, setDocuments] = useState([
    { id: 'doc-1', empCode: 'EMP-001', name: 'Rajesh Kumar', docType: 'Aadhaar Card', fileRef: 'aadhaar_rajesh.pdf', verified: true, uploadDate: '2025-04-15' },
    { id: 'doc-2', empCode: 'EMP-001', name: 'Rajesh Kumar', docType: 'PAN Card', fileRef: 'pan_rajesh.pdf', verified: true, uploadDate: '2025-04-15' },
    { id: 'doc-3', empCode: 'EMP-002', name: 'Sunita Sharma', docType: 'Degree Certificate', fileRef: 'btech_sunita.pdf', verified: true, uploadDate: '2025-06-01' },
    { id: 'doc-4', empCode: 'EMP-003', name: 'Amit Patel', docType: 'Employment Contract', fileRef: 'contract_amit.pdf', verified: false, uploadDate: '2025-08-10' },
  ]);

  const handleVerifyDoc = (id, docName) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, verified: true } : d))
    );
    showToast?.('Document Verified', `${docName} marked as legally verified.`, 'success');
  };

  // ================= STATE FOR ATTENDANCE & SHIFTS =================
  const [attendanceRecords, setAttendanceRecords] = useState([
    { id: 'att-1', empCode: 'EMP-001', name: 'Rajesh Kumar', inTime: '08:58 AM', outTime: '—', hours: '4.5 hrs', status: 'PRESENT' },
    { id: 'att-2', empCode: 'EMP-002', name: 'Sunita Sharma', inTime: '09:05 AM', outTime: '—', hours: '4.4 hrs', status: 'PRESENT' },
    { id: 'att-3', empCode: 'EMP-003', name: 'Amit Patel', inTime: '—', outTime: '—', hours: '0 hrs', status: 'ON_LEAVE' },
    { id: 'att-4', empCode: 'EMP-004', name: 'Pooja Verma', inTime: '09:12 AM', outTime: '—', hours: '4.3 hrs', status: 'LATE' },
  ]);

  // ================= STATE FOR LEAVES =================
  const [leaveRequests, setLeaveRequests] = useState([
    { id: 'lv-1', empCode: 'EMP-003', name: 'Amit Patel', type: 'Casual Leave', from: '2026-10-31', to: '2026-11-01', days: 2, reason: 'Family function', status: 'PENDING' },
    { id: 'lv-2', empCode: 'EMP-001', name: 'Rajesh Kumar', type: 'Sick Leave', from: '2026-10-15', to: '2026-10-16', days: 1, reason: 'Viral fever', status: 'APPROVED' },
  ]);

  const handleLeaveAction = (id, empName, newStatus) => {
    setLeaveRequests((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l))
    );
    showToast?.(`Leave ${newStatus}`, `Leave application for ${empName} was ${newStatus.toLowerCase()}.`, newStatus === 'APPROVED' ? 'success' : 'info');
  };

  // ================= STATE FOR BIOMETRIC DEVICES =================
  const [devices, setDevices] = useState([
    { id: 'dev-1', name: 'Main Gate Terminal 01', ip: '192.168.1.101', location: 'Security Gate A', status: 'ONLINE', lastSync: '2 mins ago', logsCount: 142 },
    { id: 'dev-2', name: 'Factory Floor Terminal 02', ip: '192.168.1.102', location: 'Assembly Unit', status: 'ONLINE', lastSync: '5 mins ago', logsCount: 88 },
  ]);

  // ================= STATE FOR PAYROLL BATCH =================
  const [payrollMonth, setPayrollMonth] = useState('October 2026');
  const [isPayrollLocked, setIsPayrollLocked] = useState(false);

  const calculateTotalGross = () => employees.reduce((sum, e) => sum + (e.salary || 0), 0);
  const calculateTotalPF = () => employees.reduce((sum, e) => sum + Math.round((e.salary || 0) * 0.12), 0);
  const calculateTotalESI = () => employees.reduce((sum, e) => sum + Math.round((e.salary || 0) * 0.0075), 0);
  const calculateTotalNet = () => calculateTotalGross() - calculateTotalPF() - calculateTotalESI();

  const handleRunPayroll = () => {
    setIsPayrollLocked(true);
    showToast?.('Payroll Processed', `Batch for ${payrollMonth} finalized and payslips ready for distribution.`, 'success');
  };

  // Filtered employees for directory
  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.empCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 1. Header with Title & Operational Metrics */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7f22fe', background: '#f3e8ff', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
              Service 8 • HRMS &amp; Payroll
            </span>
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>HRMS &amp; Payroll Workspace</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>
            Active Staff Master, Biometric Attendance, Shifts, Statutory PF/ESI/TDS and Payroll Batches for {activeCompany?.organizationName || 'your company'}
          </p>
        </div>

        {activeTab === 'employees' && (
          <button
            type="button"
            onClick={() => setIsAddEmployeeModalOpen(true)}
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
              boxShadow: '0 2px 4px rgba(127, 34, 254, 0.2)',
            }}
          >
            <IconPlus size={16} /> Add Employee
          </button>
        )}
      </div>

      {/* 2. Top Summary Operational KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        <div style={{ background: '#ffffff', padding: '1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Active Employees</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: '0.3rem 0' }}>{employees.length} Staff</div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>100% KYC Verified</div>
        </div>
        <div style={{ background: '#ffffff', padding: '1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Present Today</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#16a34a', margin: '0.3rem 0' }}>
            {employees.filter((e) => e.attendanceToday === 'PRESENT').length} / {employees.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>1 On Approved Leave</div>
        </div>
        <div style={{ background: '#ffffff', padding: '1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Monthly Payroll</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#7f22fe', margin: '0.3rem 0' }}>
            ₹ {calculateTotalGross().toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>Batch: {payrollMonth}</div>
        </div>
        <div style={{ background: '#ffffff', padding: '1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Biometric Hardware</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0284c7', margin: '0.3rem 0' }}>2 / 2 CONNECTED</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Auto-syncing every 5 mins</div>
        </div>
      </div>

      {/* 3. Module & Submodule Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {[
          { key: 'employees', label: 'Employee Master', icon: IconUsers },
          { key: 'onboarding', label: 'Onboarding & KYC', icon: IconShield },
          { key: 'documents', label: 'Document Vault', icon: IconPackage },
          { key: 'attendance', label: 'Daily Attendance', icon: IconCalendar },
          { key: 'shifts', label: 'Shift Roster', icon: IconClock },
          { key: 'leaves', label: 'Leave Requests', icon: IconAlertTriangle },
          { key: 'biometric', label: 'Biometric Devices', icon: IconBuilding },
          { key: 'structure', label: 'Salary Structure', icon: IconCreditCard },
          { key: 'process', label: 'Monthly Payroll Run', icon: IconCheckCircle },
          { key: 'statutory', label: 'Statutory (PF/ESI/TDS)', icon: IconShield },
          { key: 'payslips', label: 'Payslips', icon: IconPackage },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 0.95rem',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '3px solid #7f22fe' : '3px solid transparent',
                color: isActive ? '#7f22fe' : '#64748b',
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.84rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 4. TAB PANELS */}

      {/* 4.1 EMPLOYEE MASTER */}
      {activeTab === 'employees' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
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
              Total: <strong>{filteredEmployees.length}</strong> Staff Records
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
                  <th style={{ padding: '0.85rem 1rem' }}>Phone &amp; Email</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Monthly CTC</th>
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
                    <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.8rem' }}>
                      <div>{emp.phone}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{emp.email}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                      ₹ {Number(emp.salary).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                        {emp.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => showToast?.('Employee Profile', `Viewing ${emp.name} details`, 'info')}
                        style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, color: '#7f22fe', background: '#f3e8ff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        View Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4.2 ONBOARDING & KYC */}
      {activeTab === 'onboarding' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Candidate Onboarding &amp; KYC Pipeline</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>Track offer letters, identity document collection and KYC clearance</p>
            </div>
            <button
              type="button"
              onClick={() => showToast?.('New Candidate', 'Candidate invitation sent.', 'info')}
              style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', background: '#7f22fe', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              + Send Onboarding Invite
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem' }}>Candidate</th>
                <th style={{ padding: '0.75rem 1rem' }}>Designation</th>
                <th style={{ padding: '0.75rem 1rem' }}>Offer Released</th>
                <th style={{ padding: '0.75rem 1rem' }}>Pipeline Stage</th>
                <th style={{ padding: '0.75rem 1rem' }}>KYC Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{c.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{c.role}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{c.offerDate}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                      {c.stage}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: c.kycStatus === 'VERIFIED' ? '#ecfdf5' : '#fef3c7',
                      color: c.kycStatus === 'VERIFIED' ? '#065f46' : '#92400e',
                      border: `1px solid ${c.kycStatus === 'VERIFIED' ? '#a7f3d0' : '#fde68a'}`,
                    }}>
                      {c.kycStatus}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    {c.kycStatus !== 'VERIFIED' ? (
                      <button
                        type="button"
                        onClick={() => handleVerifyKyc(c.id, c.name)}
                        style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', background: '#dcfce7', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Approve KYC
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>✓ Verified</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4.3 DOCUMENT VAULT */}
      {activeTab === 'documents' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Staff Document Vault</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>Permanent repository for employee Aadhaar, PAN, certificates and signed agreements</p>
            </div>
            <button
              type="button"
              onClick={() => showToast?.('Upload Vault', 'Document upload dialog opened.', 'info')}
              style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', background: '#7f22fe', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              + Upload Document
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem' }}>Staff Member</th>
                <th style={{ padding: '0.75rem 1rem' }}>Document Type</th>
                <th style={{ padding: '0.75rem 1rem' }}>Filename</th>
                <th style={{ padding: '0.75rem 1rem' }}>Upload Date</th>
                <th style={{ padding: '0.75rem 1rem' }}>Verification</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{d.name} ({d.empCode})</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{d.docType}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#7f22fe', fontWeight: 600 }}>{d.fileRef}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{d.uploadDate}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: d.verified ? '#ecfdf5' : '#fef2f2',
                      color: d.verified ? '#065f46' : '#991b1b',
                      border: `1px solid ${d.verified ? '#a7f3d0' : '#fecaca'}`,
                    }}>
                      {d.verified ? 'VERIFIED' : 'PENDING'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    {!d.verified ? (
                      <button
                        type="button"
                        onClick={() => handleVerifyDoc(d.id, d.docType)}
                        style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', background: '#dcfce7', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Verify
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Archived</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4.4 DAILY ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Daily Attendance Roster &amp; Clock Punches</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>Real-time shift clock-in, clock-out and working hours summary</p>
            </div>
            <button
              type="button"
              onClick={() => showToast?.('Hardware Sync', 'Attendance logs synchronized from biometric gate terminals.', 'success')}
              style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Sync Device Logs
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem' }}>Employee</th>
                <th style={{ padding: '0.75rem 1rem' }}>Punch In</th>
                <th style={{ padding: '0.75rem 1rem' }}>Punch Out</th>
                <th style={{ padding: '0.75rem 1rem' }}>Total Hours</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRecords.map((att) => (
                <tr key={att.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{att.name} ({att.empCode})</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{att.inTime}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{att.outTime}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{att.hours}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: att.status === 'PRESENT' ? '#ecfdf5' : att.status === 'LATE' ? '#fef3c7' : '#fef2f2',
                      color: att.status === 'PRESENT' ? '#065f46' : att.status === 'LATE' ? '#92400e' : '#991b1b',
                      border: `1px solid ${att.status === 'PRESENT' ? '#a7f3d0' : att.status === 'LATE' ? '#fde68a' : '#fecaca'}`,
                    }}>
                      {att.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4.5 SHIFT MANAGEMENT */}
      {activeTab === 'shifts' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Shift Rostering &amp; Schedules</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>Department shift allocations, timings, and grace periods</p>
            </div>
            <button
              type="button"
              onClick={() => showToast?.('Shift Roster', 'Shift patterns updated for next week.', 'info')}
              style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', background: '#7f22fe', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              + Create Shift Pattern
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {[
              { name: 'General / Morning Shift', time: '09:00 AM – 06:00 PM', staff: '3 Staff Assigned', dept: 'Finance & Administration' },
              { name: 'Production Shift A', time: '06:00 AM – 02:00 PM', staff: '8 Staff Assigned', dept: 'Manufacturing & Workshop' },
              { name: 'Production Shift B', time: '02:00 PM – 10:00 PM', staff: '6 Staff Assigned', dept: 'Packaging & Dispatch' },
            ].map((s, idx) => (
              <div key={idx} style={{ padding: '1.15rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>{s.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#7f22fe', fontWeight: 700, margin: '0.25rem 0' }}>{s.time}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.dept}</div>
                <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 700, marginTop: '0.5rem' }}>{s.staff}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4.6 LEAVE MANAGEMENT */}
      {activeTab === 'leaves' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Leave Requests &amp; Entitlements</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>Review and approve staff casual, sick, and earned leave applications</p>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem' }}>Employee</th>
                <th style={{ padding: '0.75rem 1rem' }}>Leave Type</th>
                <th style={{ padding: '0.75rem 1rem' }}>Duration</th>
                <th style={{ padding: '0.75rem 1rem' }}>Reason</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaveRequests.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{l.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{l.type}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{l.from} to {l.to} ({l.days} days)</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{l.reason}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: l.status === 'APPROVED' ? '#ecfdf5' : l.status === 'PENDING' ? '#fef3c7' : '#fef2f2',
                      color: l.status === 'APPROVED' ? '#065f46' : l.status === 'PENDING' ? '#92400e' : '#991b1b',
                      border: `1px solid ${l.status === 'APPROVED' ? '#a7f3d0' : l.status === 'PENDING' ? '#fde68a' : '#fecaca'}`,
                    }}>
                      {l.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    {l.status === 'PENDING' ? (
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => handleLeaveAction(l.id, l.name, 'APPROVED')}
                          style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', background: '#dcfce7', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLeaveAction(l.id, l.name, 'REJECTED')}
                          style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', background: '#fee2e2', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Processed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4.7 BIOMETRIC INTEGRATION */}
      {activeTab === 'biometric' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Biometric Attendance Devices</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>Physical time clock terminals connected via local TCP/IP</p>
            </div>
            <button
              type="button"
              onClick={() => showToast?.('Hardware Ping', 'All 2 biometric machines pinged successfully.', 'success')}
              style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', background: '#0284c7', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Ping All Terminals
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem' }}>Terminal Name</th>
                <th style={{ padding: '0.75rem 1rem' }}>Device IP</th>
                <th style={{ padding: '0.75rem 1rem' }}>Location</th>
                <th style={{ padding: '0.75rem 1rem' }}>Last Sync</th>
                <th style={{ padding: '0.75rem 1rem' }}>Punches Captured</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{d.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#7f22fe', fontWeight: 600 }}>{d.ip}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{d.location}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{d.lastSync}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{d.logsCount} logs</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4.8 SALARY STRUCTURE */}
      {activeTab === 'structure' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>Standard Compensation Components</h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1.25rem 0' }}>Default component ratios configured per Indian labour laws &amp; statutory rules</p>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem' }}>Salary Component</th>
                <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                <th style={{ padding: '0.75rem 1rem' }}>Standard Formula / Ratio</th>
                <th style={{ padding: '0.75rem 1rem' }}>Taxability</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Active</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Basic Salary', type: 'EARNING', formula: '50% of Monthly CTC', tax: 'Fully Taxable' },
                { name: 'House Rent Allowance (HRA)', type: 'EARNING', formula: '40% of Basic Salary', tax: 'Exemption U/S 10(13A)' },
                { name: 'Special Allowance', type: 'EARNING', formula: 'Balancing Component', tax: 'Fully Taxable' },
                { name: 'Employee Provident Fund (EPF)', type: 'DEDUCTION', formula: '12% of Basic (Capped @ 15,000)', tax: 'Tax Exempt 80C' },
                { name: 'Employee State Insurance (ESIC)', type: 'DEDUCTION', formula: '0.75% of Gross (If Gross <= 21,000)', tax: 'Statutory' },
                { name: 'Professional Tax (PT)', type: 'DEDUCTION', formula: '₹ 200 / month', tax: 'Statutory' },
              ].map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{c.name}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: c.type === 'EARNING' ? '#16a34a' : '#dc2626' }}>
                      {c.type}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{c.formula}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{c.tax}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>✓ YES</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4.9 MONTHLY PAYROLL PROCESS */}
      {activeTab === 'process' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Monthly Payroll Calculation Batch</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>Month: <strong>{payrollMonth}</strong> • {employees.length} eligible staff</p>
            </div>
            <button
              type="button"
              onClick={handleRunPayroll}
              style={{
                padding: '0.55rem 1.15rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#ffffff',
                background: isPayrollLocked ? '#16a34a' : '#7f22fe',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              {isPayrollLocked ? '✓ Batch Finalized & Locked' : 'Run & Lock Current Batch'}
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
                <th style={{ padding: '0.75rem 1rem' }}>Net Disbursement</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const epf = Math.round(emp.salary * 0.12);
                const esic = Math.round(emp.salary * 0.0075);
                const net = emp.salary - epf - esic;
                return (
                  <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{emp.name}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>₹ {emp.salary.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>₹ {epf.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>₹ {esic.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>₹ 0</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#16a34a' }}>₹ {net.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: isPayrollLocked ? '#ecfdf5' : '#eff6ff', color: isPayrollLocked ? '#065f46' : '#1d4ed8' }}>
                        {isPayrollLocked ? 'DISBURSED' : 'CALCULATED'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 4.10 STATUTORY COMPLIANCE */}
      {activeTab === 'statutory' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>Statutory Compliance &amp; ECR Filings</h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1.25rem 0' }}>Automated Challan calculations for EPFO, ESIC and Form 24Q TDS filing</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1.15rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ fontWeight: 800, color: '#0f172a' }}>EPFO Monthly ECR</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#7f22fe', margin: '0.25rem 0' }}>₹ {calculateTotalPF().toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Due Date: 15th November 2026</div>
              <button
                type="button"
                onClick={() => showToast?.('EPFO ECR', 'ECR text file downloaded for EPFO portal upload.', 'success')}
                style={{ marginTop: '0.5rem', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, color: '#7f22fe', background: '#f3e8ff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Generate ECR File
              </button>
            </div>

            <div style={{ padding: '1.15rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ fontWeight: 800, color: '#0f172a' }}>ESIC Contribution</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0284c7', margin: '0.25rem 0' }}>₹ {calculateTotalESI().toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Due Date: 15th November 2026</div>
              <button
                type="button"
                onClick={() => showToast?.('ESIC Return', 'ESIC monthly return challan prepared.', 'success')}
                style={{ marginTop: '0.5rem', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Download ESIC Challan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4.11 PAYSLIPS */}
      {activeTab === 'payslips' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Generated Employee Payslips</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>Download or email monthly PDF payslips to staff members</p>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0.75rem 1rem' }}>Employee</th>
                <th style={{ padding: '0.75rem 1rem' }}>Month</th>
                <th style={{ padding: '0.75rem 1rem' }}>Gross Pay</th>
                <th style={{ padding: '0.75rem 1rem' }}>Net Take-Home</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const epf = Math.round(emp.salary * 0.12);
                const esic = Math.round(emp.salary * 0.0075);
                const net = emp.salary - epf - esic;
                return (
                  <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{emp.name} ({emp.empCode})</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{payrollMonth}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>₹ {emp.salary.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#16a34a' }}>₹ {net.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => showToast?.('Payslip Download', `Payslip for ${emp.name} generated.`, 'success')}
                        style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 700, color: '#7f22fe', background: '#f3e8ff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Download PDF
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: ADD EMPLOYEE */}
      {isAddEmployeeModalOpen && (
        <Modal
          isOpen={isAddEmployeeModalOpen}
          onClose={() => setIsAddEmployeeModalOpen(false)}
          title="Register New Employee Master"
        >
          <form onSubmit={handleAddEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                  Employee Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. EMP-005"
                  value={newEmployee.empCode}
                  onChange={(e) => setNewEmployee({ ...newEmployee, empCode: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Verma"
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                  Department
                </label>
                <select
                  value={newEmployee.department}
                  onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                >
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Quality Assurance">Quality Assurance</option>
                  <option value="Logistics">Logistics</option>
                  <option value="Finance">Finance</option>
                  <option value="Sales & Operations">Sales &amp; Operations</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                  Designation
                </label>
                <input
                  type="text"
                  placeholder="e.g. Senior Technician"
                  value={newEmployee.designation}
                  onChange={(e) => setNewEmployee({ ...newEmployee, designation: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                  Monthly CTC (₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 40000"
                  value={newEmployee.salary}
                  onChange={(e) => setNewEmployee({ ...newEmployee, salary: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. +91 98765 00000"
                  value={newEmployee.phone}
                  onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setIsAddEmployeeModalOpen(false)}
                style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none', background: '#7f22fe', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Save Employee
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './reports.module.css';
import { api } from '../../../lib/api';
import ReportFilterBar from './ReportFilterBar';
import ReportDataTable from './ReportDataTable';
import ReportExportActions from './ReportExportActions';

const OPERATIONAL_CATEGORIES = [
  {
    category: 'crm',
    categoryLabel: 'CRM & Sales',
    reports: [
      { id: 'lead-conversion', label: 'Lead Conversion', endpoint: '/sales/lead-conversion', exportType: 'lead-conversion' },
      { id: 'sales-pipeline', label: 'Quotation Conversion / Pipeline', endpoint: '/sales/quotation-conversion', exportType: 'quotation-conversion' },
      { id: 'customer-sales', label: 'Customer Sales Summary', endpoint: '/sales/customer-sales', exportType: 'customer-sales' },
    ],
  },
  {
    category: 'purchase',
    categoryLabel: 'Purchase & Vendor',
    reports: [
      { id: 'po-pending', label: 'Pending Purchase Orders', endpoint: '/purchase/pending-orders', exportType: 'pending-orders' },
      { id: 'vendor-performance', label: 'Vendor Summary & Performance', endpoint: '/purchase/vendor-summary', exportType: 'vendor-summary' },
      { id: 'grn-inspection', label: 'GRN Inspection & Quality', endpoint: '/purchase/grn-inspection', exportType: 'grn-inspection' },
    ],
  },
  {
    category: 'inventory',
    categoryLabel: 'Inventory & Warehouse',
    reports: [
      { id: 'stock-ageing', label: 'Stock Ageing Buckets (FIFO)', endpoint: '/inventory/stock-ageing', exportType: 'stock-ageing' },
      { id: 'stock-valuation', label: 'Current Stock Valuation', endpoint: '/inventory/stock-valuation', exportType: 'stock-valuation' },
      { id: 'reorder-alerts', label: 'Reorder Level Alerts', endpoint: null, exportType: null, isUnavailable: true },
    ],
  },
  {
    category: 'production',
    categoryLabel: 'Production & Manufacturing',
    reports: [
      { id: 'dpr-summary', label: 'Daily Production & Efficiency', endpoint: '/production/efficiency', exportType: 'production-efficiency' },
      { id: 'order-status', label: 'Production / Job Work Orders', endpoint: '/job-work/summary', exportType: 'job-work-summary' },
    ],
  },
  {
    category: 'job-work',
    categoryLabel: 'Job Work & Subcontracting',
    reports: [
      { id: 'job-work-summary', label: 'Job Work Summary', endpoint: '/job-work/summary', exportType: 'job-work-summary' },
    ],
  },
  {
    category: 'dispatch',
    categoryLabel: 'Dispatch & Logistics',
    reports: [
      { id: 'dispatch-summary', label: 'Dispatch & Delivery Summary', endpoint: '/dispatch/summary', exportType: 'dispatch-summary' },
    ],
  },
  {
    category: 'hrms',
    categoryLabel: 'HRMS & Payroll',
    requiresPayroll: true,
    reports: [
      { id: 'attendance-summary', label: 'Monthly Attendance Summary', endpoint: '/hrms/attendance', exportType: 'hrms-attendance' },
      { id: 'payroll-summary', label: 'Department Payroll Register', endpoint: '/hrms/payroll', exportType: 'hrms-payroll' },
    ],
  },
  {
    category: 'solar',
    categoryLabel: 'Solar Power Plant',
    reports: [
      { id: 'solar-generation', label: 'Solar Generation & PR Yield', endpoint: '/solar/generation', exportType: 'solar-generation' },
      { id: 'solar-maintenance', label: 'Solar O&M Spares Cost', endpoint: '/solar/maintenance-cost', exportType: 'solar-maintenance' },
    ],
  },
];

export default function OperationalReportsTab({
  activeCompany,
  showToast,
  currentUser,
}) {
  const companyId = activeCompany?.id;
  const [selectedReportId, setSelectedReportId] = useState('lead-conversion');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({});
  const [data, setData] = useState(null);

  // Find active report configuration
  const allReports = OPERATIONAL_CATEGORIES.flatMap((c) => c.reports);
  const currentReport = allReports.find((r) => r.id === selectedReportId) || allReports[0];

  const fetchReport = useCallback(async (currentFilters = filters, rep = currentReport) => {
    if (!companyId || !rep) return;
    if (rep.isUnavailable || !rep.endpoint) {
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      if (currentFilters.fromDate) queryParams.set('fromDate', currentFilters.fromDate);
      if (currentFilters.toDate) queryParams.set('toDate', currentFilters.toDate);

      const qs = queryParams.toString();
      const endpoint = `/companies/${companyId}/reports${rep.endpoint}${qs ? `?${qs}` : ''}`;
      const res = await api.get(endpoint);
      if (res?.success) {
        setData(res.data);
      } else {
        throw new Error(res?.message || 'Failed to fetch operational report');
      }
    } catch (err) {
      console.error('Operational Report Error:', err);
      setError(err.message || 'Could not load report.');
    } finally {
      setLoading(false);
    }
  }, [companyId, filters, currentReport]);

  useEffect(() => {
    fetchReport(filters, currentReport);
  }, [selectedReportId]);

  const renderReportBody = () => {
    if (currentReport?.isUnavailable) {
      return (
        <div className={styles.tableCard} style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
          <span style={{ fontSize: '2.5rem' }}>📦</span>
          <h3 style={{ margin: '0.75rem 0 0.25rem', color: '#18181b', fontWeight: 800 }}>
            {currentReport.label} Endpoint Not Available
          </h3>
          <p style={{ color: '#71717a', fontSize: '0.88rem', maxWidth: '480px', margin: '0 auto' }}>
            No verified backend route is currently mounted for this report. Contact the system administrator.
          </p>
          <div style={{ marginTop: '1rem' }}>
            <span className={`${styles.badge} ${styles.badgeWarning}`}>NOT IMPLEMENTED</span>
          </div>
        </div>
      );
    }

    // 1. Lead Conversion
    if (selectedReportId === 'lead-conversion') {
      const bySource = data?.bySource || [];
      const columns = [
        { key: 'source', label: 'Lead Source' },
        { key: 'count', label: 'Total Leads', isNumeric: true },
        { key: 'sharePercent', label: 'Share (%)', format: 'percent', isNumeric: true },
      ];

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {data && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>Total Leads Captured</div>
                <div className={styles.kpiValue}>{data.totalLeads ?? 0}</div>
              </div>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>Converted / Won Leads</div>
                <div className={styles.kpiValue} style={{ color: '#15803d' }}>{data.convertedCount ?? 0}</div>
              </div>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>Conversion Rate</div>
                <div className={styles.kpiValue} style={{ color: '#7f22fe' }}>{data.conversionRatePercent ?? 0}%</div>
              </div>
            </div>
          )}
          <ReportDataTable
            title="Lead Conversion by Source"
            columns={columns}
            data={bySource}
            isLoading={loading}
            error={error}
            onRetry={() => fetchReport(filters, currentReport)}
          />
        </div>
      );
    }

    // 2. Sales Pipeline / Quotation Conversion
    if (selectedReportId === 'sales-pipeline') {
      const byStatus = data?.byStatus || [];
      const columns = [
        { key: 'status', label: 'Quotation Status', render: (v) => <span className={`${styles.badge} ${styles.badgeNeutral}`}>{v}</span> },
        { key: 'count', label: 'Quotations', isNumeric: true },
        { key: 'totalValue', label: 'Total Value', format: 'currency', isNumeric: true },
      ];

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {data && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>Total Quotations</div>
                <div className={styles.kpiValue}>{data.totalQuotations ?? 0}</div>
              </div>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>Pipeline Value</div>
                <div className={styles.kpiValue} style={{ color: '#7f22fe' }}>
                  ₹ {(data.totalQuotationValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>Quotation Win Rate</div>
                <div className={styles.kpiValue} style={{ color: '#15803d' }}>{data.conversionRatePercent ?? 0}%</div>
              </div>
            </div>
          )}
          <ReportDataTable
            title="Quotation Pipeline & Status Breakdown"
            columns={columns}
            data={byStatus}
            isLoading={loading}
            error={error}
            onRetry={() => fetchReport(filters, currentReport)}
          />
        </div>
      );
    }

    // 3. Customer Sales Summary
    if (selectedReportId === 'customer-sales') {
      const customers = data?.customers || [];
      const columns = [
        { key: 'customerName', label: 'Customer Organization' },
        { key: 'invoiceCount', label: 'Invoices', isNumeric: true },
        { key: 'invoicedAmount', label: 'Invoiced Amount', format: 'currency', isNumeric: true },
        { key: 'paidAmount', label: 'Paid Amount', format: 'currency', isNumeric: true },
        { key: 'outstandingAmount', label: 'Outstanding Balance', format: 'currency', isNumeric: true },
      ];
      return (
        <ReportDataTable
          title="Customer Sales & Receivable Ledger"
          columns={columns}
          data={customers}
          isLoading={loading}
          error={error}
          onRetry={() => fetchReport(filters, currentReport)}
        />
      );
    }

    // 4. Pending Purchase Orders
    if (selectedReportId === 'po-pending') {
      const orders = data?.orders || [];
      const columns = [
        { key: 'poNumber', label: 'PO Number', width: '130px' },
        { key: 'orderDate', label: 'Order Date', format: 'date', width: '110px' },
        { key: 'vendorName', label: 'Vendor' },
        { key: 'expectedDate', label: 'Expected Date', format: 'date', width: '110px' },
        { key: 'daysDelayed', label: 'Delay', isNumeric: true, render: (v) => (
          v > 0 ? <span style={{ color: '#b91c1c', fontWeight: 700 }}>{v} days late</span> : 'On time'
        )},
        { key: 'totalAmount', label: 'Order Value', format: 'currency', isNumeric: true },
        { key: 'status', label: 'Status', render: (v) => <span className={`${styles.badge} ${styles.badgeWarning}`}>{v}</span> },
      ];
      return (
        <ReportDataTable
          title="Pending Purchase Orders (Awaiting GRN)"
          subtitle={`Total Pending Commitments: ₹ ${(data?.totalPendingAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          columns={columns}
          data={orders}
          isLoading={loading}
          error={error}
          onRetry={() => fetchReport(filters, currentReport)}
        />
      );
    }

    // 5. Vendor Summary
    if (selectedReportId === 'vendor-performance') {
      const vendors = data?.vendors || [];
      const columns = [
        { key: 'vendorName', label: 'Vendor Name' },
        { key: 'totalOrders', label: 'PO Count', isNumeric: true },
        { key: 'poAmount', label: 'PO Value', format: 'currency', isNumeric: true },
        { key: 'billedAmount', label: 'Billed Value', format: 'currency', isNumeric: true },
        { key: 'grnCount', label: 'GRNs Received', isNumeric: true },
      ];
      return (
        <ReportDataTable
          title="Vendor Procurement & Performance Summary"
          columns={columns}
          data={vendors}
          isLoading={loading}
          error={error}
          onRetry={() => fetchReport(filters, currentReport)}
        />
      );
    }

    // 6. GRN Inspection
    if (selectedReportId === 'grn-inspection') {
      const receipts = data?.receipts || [];
      const columns = [
        { key: 'grnNo', label: 'GRN Number' },
        { key: 'poNumber', label: 'PO Ref' },
        { key: 'warehouse', label: 'Warehouse' },
        { key: 'receivedQty', label: 'Received', isNumeric: true },
        { key: 'acceptedQty', label: 'Accepted', isNumeric: true },
        { key: 'rejectedQty', label: 'Rejected', isNumeric: true },
        { key: 'rejectionRatePct', label: 'Rejection (%)', format: 'percent', isNumeric: true },
        { key: 'qcStatus', label: 'QC Status', render: (v) => <span className={`${styles.badge} ${v === 'PASSED' ? styles.badgeSuccess : styles.badgeWarning}`}>{v}</span> },
      ];
      return (
        <ReportDataTable
          title="GRN Quality Inspection & Rejection Log"
          columns={columns}
          data={receipts}
          isLoading={loading}
          error={error}
          onRetry={() => fetchReport(filters, currentReport)}
        />
      );
    }

    // 7. Stock Ageing Buckets
    if (selectedReportId === 'stock-ageing') {
      const items = data?.items || [];
      const columns = [
        { key: 'sku', label: 'SKU', width: '120px' },
        { key: 'name', label: 'Item Name' },
        { key: 'warehouse', label: 'Warehouse' },
        { key: 'totalQty', label: 'Total Units', isNumeric: true },
        { key: 'totalValue', label: 'Valuation', format: 'currency', isNumeric: true },
        { key: 'qty0to30', label: '0-30 Days', isNumeric: true },
        { key: 'qty31to60', label: '31-60 Days', isNumeric: true },
        { key: 'qty61to90', label: '61-90 Days', isNumeric: true },
        { key: 'qty90plus', label: '90+ Days', isNumeric: true, render: (v) => v > 0 ? <strong style={{ color: '#b91c1c' }}>{v}</strong> : v },
      ];

      return (
        <ReportDataTable
          title="FIFO Stock Ageing Buckets"
          subtitle="Inventory ageing based on manufacturing / receipt dates under FIFO principles"
          columns={columns}
          data={items}
          isLoading={loading}
          error={error}
          onRetry={() => fetchReport(filters, currentReport)}
        />
      );
    }

    // 8. Stock Valuation
    if (selectedReportId === 'stock-valuation') {
      const items = data?.items || [];
      const columns = [
        { key: 'sku', label: 'SKU', width: '120px' },
        { key: 'name', label: 'Item Name' },
        { key: 'warehouse', label: 'Warehouse' },
        { key: 'stock', label: 'In Stock', isNumeric: true },
        { key: 'averageCost', label: 'Avg Unit Cost', format: 'currency', isNumeric: true },
        { key: 'totalValuation', label: 'Total Value', format: 'currency', isNumeric: true },
      ];
      return (
        <ReportDataTable
          title="Inventory Stock Valuation Report"
          subtitle={`Total Valuation: ₹ ${(data?.totalValuation || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          columns={columns}
          data={items}
          isLoading={loading}
          error={error}
          onRetry={() => fetchReport(filters, currentReport)}
        />
      );
    }

    // 9. Production Efficiency
    if (selectedReportId === 'dpr-summary') {
      const stats = data || {};
      const rows = [
        { metric: 'Total DPR Reports Logged', value: stats.totalDprReports || 0 },
        { metric: 'Total Planned Units', value: (stats.totalPlanned || 0).toLocaleString('en-IN') },
        { metric: 'Total Actual Produced Units', value: (stats.totalProduced || 0).toLocaleString('en-IN') },
        { metric: 'Total Scrap / Rejected Units', value: (stats.totalRejected || 0).toLocaleString('en-IN') },
        { metric: 'Production Efficiency Rate', value: `${stats.overallEfficiencyPercent || 0}%` },
        { metric: 'Wastage / Rejection Rate', value: `${stats.rejectionRatePercent || 0}%` },
      ];
      const columns = [
        { key: 'metric', label: 'Production Metric' },
        { key: 'value', label: 'Calculated Indicator', render: (v) => <strong>{v}</strong> },
      ];
      return (
        <ReportDataTable
          title="Daily Production Report (DPR) & Efficiency Summary"
          columns={columns}
          data={rows}
          isLoading={loading}
          error={error}
          onRetry={() => fetchReport(filters, currentReport)}
        />
      );
    }

    // 10. Job Work / Production Orders
    if (selectedReportId === 'order-status' || selectedReportId === 'job-work-summary') {
      const orders = data?.orders || [];
      const columns = [
        { key: 'orderNo', label: 'Order Number' },
        { key: 'vendorName', label: 'Vendor / Subcontractor' },
        { key: 'targetQuantity', label: 'Target Qty', isNumeric: true },
        { key: 'receivedQuantity', label: 'Received Qty', isNumeric: true },
        { key: 'rejectedQuantity', label: 'Rejected Qty', isNumeric: true },
        { key: 'completionRatePct', label: 'Completion (%)', format: 'percent', isNumeric: true },
        { key: 'status', label: 'Status', render: (v) => <span className={`${styles.badge} ${styles.badgeNeutral}`}>{v}</span> },
      ];
      return (
        <ReportDataTable
          title="Subcontractor & Job Work Execution Summary"
          columns={columns}
          data={orders}
          isLoading={loading}
          error={error}
          onRetry={() => fetchReport(filters, currentReport)}
        />
      );
    }

    // 11. Dispatch Summary
    if (selectedReportId === 'dispatch-summary') {
      const dispatches = data?.dispatches || [];
      const columns = [
        { key: 'dispatchNo', label: 'Dispatch No', width: '130px' },
        { key: 'dispatchDate', label: 'Date', format: 'date', width: '110px' },
        { key: 'customerName', label: 'Customer' },
        { key: 'totalPackages', label: 'Packages', isNumeric: true },
        { key: 'totalDispatchedAmount', label: 'Dispatched Amount', format: 'currency', isNumeric: true },
        { key: 'status', label: 'Status', render: (v) => <span className={`${styles.badge} ${styles.badgeSuccess}`}>{v}</span> },
        { key: 'deliverySLA', label: 'Delivery SLA', render: (v) => <span className={`${styles.badge} ${styles.badgeWarning}`}>{v || 'NOT IMPLEMENTED'}</span> },
      ];
      return (
        <ReportDataTable
          title="Dispatch & Logistics Fulfillment Summary"
          subtitle={`Total Dispatches: ${data?.totalDispatches || 0} | Total Value: ₹ ${(data?.totalDispatchedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          columns={columns}
          data={dispatches}
          isLoading={loading}
          error={error}
          onRetry={() => fetchReport(filters, currentReport)}
        />
      );
    }

    // 12. HRMS Attendance
    if (selectedReportId === 'attendance-summary') {
      const depts = data?.byDepartment || [];
      const columns = [
        { key: 'departmentName', label: 'Department' },
        { key: 'totalEmployees', label: 'Staff Count', isNumeric: true },
        { key: 'presentDays', label: 'Present Days', isNumeric: true },
        { key: 'absentDays', label: 'Absent Days', isNumeric: true },
        { key: 'leaveDays', label: 'Leave Days', isNumeric: true },
        { key: 'attendanceRatePct', label: 'Attendance (%)', format: 'percent', isNumeric: true },
      ];
      return (
        <ReportDataTable
          title="Monthly Employee Attendance Summary"
          subtitle={`Overall Attendance: ${data?.overallAttendanceRatePct || 0}% across ${data?.totalEmployees || 0} employees`}
          columns={columns}
          data={depts}
          isLoading={loading}
          error={error}
          onRetry={() => fetchReport(filters, currentReport)}
        />
      );
    }

    // 13. HRMS Payroll Register
    if (selectedReportId === 'payroll-summary') {
      const depts = data?.byDepartment || [];
      const columns = [
        { key: 'departmentName', label: 'Department' },
        { key: 'employeeCount', label: 'Headcount', isNumeric: true },
        { key: 'totalGross', label: 'Gross Pay', format: 'currency', isNumeric: true },
        { key: 'totalDeductions', label: 'Deductions (EPF/ESIC/PT)', format: 'currency', isNumeric: true },
        { key: 'totalNet', label: 'Net Payable', format: 'currency', isNumeric: true },
      ];
      return (
        <ReportDataTable
          title="Department Payroll Register"
          subtitle={`Batch: ${data?.latestBatch || 'Current'} | Net Outflow: ₹ ${(data?.totalNet || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          columns={columns}
          data={depts}
          isLoading={loading}
          error={error}
          onRetry={() => fetchReport(filters, currentReport)}
        />
      );
    }

    // 14. Solar Generation & Yield
    if (selectedReportId === 'solar-generation') {
      const plant = data?.plant;
      const logs = data?.logs || [];
      const pr = data?.performanceRatio;

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {data && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>Plant Name & Capacity</div>
                <div className={styles.kpiValue} style={{ fontSize: '1.15rem' }}>
                  {plant?.name || 'Solar Plant'}
                </div>
                <div className={styles.kpiSubtext}>Capacity: {plant?.capacityDcKw || 0} kWp</div>
              </div>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>Total Energy Generated</div>
                <div className={styles.kpiValue} style={{ color: '#0284c7' }}>
                  {(data.totalGenerationKwh || 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })} kWh
                </div>
                <div className={styles.kpiSubtext}>Peak Power: {data.peakPowerKw || 0} kW</div>
              </div>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>Specific Yield</div>
                <div className={styles.kpiValue} style={{ color: '#7f22fe' }}>
                  {data.specificYieldKwhPerKwp || 0} kWh/kWp
                </div>
              </div>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>Performance Ratio (PR)</div>
                <div className={styles.kpiValue} style={{ fontSize: '1.1rem' }}>
                  {pr?.status === 'CALCULATED' ? (
                    <span style={{ color: '#15803d' }}>{pr.ratioPercent}%</span>
                  ) : (
                    <span className={`${styles.badge} ${styles.badgeNeutral}`}>{pr?.status || 'SENSOR_UNAVAILABLE'}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          <ReportDataTable
            title="Solar Power Plant Telemetry Log"
            columns={[
              { key: 'timestamp', label: 'Timestamp', format: 'date' },
              { key: 'dailyEnergyKwh', label: 'Generation (kWh)', isNumeric: true },
              { key: 'currentPowerKw', label: 'Active Power (kW)', isNumeric: true },
            ]}
            data={logs}
            isLoading={loading}
            error={error}
            onRetry={() => fetchReport(filters, currentReport)}
          />
        </div>
      );
    }

    // 15. Solar Maintenance Cost
    if (selectedReportId === 'solar-maintenance') {
      const tickets = data?.tickets || [];
      const columns = [
        { key: 'ticketNo', label: 'Ticket Ref' },
        { key: 'plantName', label: 'Plant' },
        { key: 'category', label: 'Category' },
        { key: 'priority', label: 'Priority' },
        { key: 'technicianName', label: 'Technician' },
        { key: 'status', label: 'Status', render: (v) => <span className={`${styles.badge} ${styles.badgeNeutral}`}>{v}</span> },
        { key: 'totalSparesCost', label: 'Spares Cost', format: 'currency', isNumeric: true },
      ];
      return (
        <ReportDataTable
          title="Solar Plant O&M Maintenance & Spares Consumption"
          subtitle={`Total Tickets: ${data?.totalTickets || 0} | Total Spares Cost: ₹ ${(data?.totalSparesCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          columns={columns}
          data={tickets}
          isLoading={loading}
          error={error}
          onRetry={() => fetchReport(filters, currentReport)}
        />
      );
    }

    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Selector & Group Header */}
      <div className={`${styles.headerCard} no-print`} style={{ padding: '0.85rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#71717a', textTransform: 'uppercase' }}>
            Operational Module:
          </span>
          <select
            className={styles.filterInput}
            style={{ fontWeight: 600, minWidth: '280px' }}
            value={selectedReportId}
            onChange={(e) => setSelectedReportId(e.target.value)}
          >
            {OPERATIONAL_CATEGORIES.map((cat) => (
              <optgroup key={cat.category} label={cat.categoryLabel}>
                {cat.reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label} {r.isUnavailable ? '(Not Available)' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <ReportExportActions
          companyId={companyId}
          reportType={currentReport?.exportType}
          filters={filters}
          canExport={Boolean(currentReport?.exportType)}
          reportTitle={currentReport?.label}
          showToast={showToast}
        />
      </div>

      {/* Filter Bar */}
      {!currentReport?.isUnavailable && (
        <ReportFilterBar
          filters={filters}
          isLoading={loading}
          onApplyFilters={(newF) => {
            setFilters(newF);
            fetchReport(newF, currentReport);
          }}
          onResetFilters={() => {
            setFilters({});
            fetchReport({}, currentReport);
          }}
        />
      )}

      {renderReportBody()}
    </div>
  );
}


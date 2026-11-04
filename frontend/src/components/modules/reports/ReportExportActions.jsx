'use client';

import { useState } from 'react';
import styles from './reports.module.css';
import { authenticatedFetch, API_BASE } from '../../../lib/api';

export default function ReportExportActions({
  companyId,
  reportType,
  filters = {},
  reportTitle = 'Report',
  canExport = true,
  showToast = null,
}) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCsv = async () => {
    if (!companyId || !reportType) return;
    setIsExporting(true);

    try {
      const queryParams = new URLSearchParams();
      if (filters.fromDate) queryParams.set('fromDate', filters.fromDate);
      if (filters.toDate) queryParams.set('toDate', filters.toDate);
      if (filters.accountId) queryParams.set('accountId', filters.accountId);
      if (filters.plantId) queryParams.set('plantId', filters.plantId);
      if (filters.status) queryParams.set('status', filters.status);

      const queryString = queryParams.toString();
      const endpoint = `${API_BASE}/companies/${companyId}/reports/export/${reportType}${queryString ? `?${queryString}` : ''}`;

      const response = await authenticatedFetch(endpoint, {
        method: 'GET',
      });

      if (!response.ok) {
        let errorMsg = `Export failed with HTTP ${response.status}`;
        try {
          const errData = await response.json();
          errorMsg = errData.message || errorMsg;
        } catch {
          // ignore
        }

        if (response.status === 403) {
          errorMsg = 'Permission denied: You do not have privileges to export this report.';
        } else if (response.status === 404) {
          errorMsg = 'Report not found or not supported for export.';
        }

        if (showToast) {
          showToast({ type: 'error', message: errorMsg });
        } else {
          alert(errorMsg);
        }
        return;
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;

      // Extract filename from header or construct fallback
      const safeDate = new Date().toISOString().slice(0, 10);
      a.download = `${reportType}_report_${safeDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      if (showToast) {
        showToast({ type: 'success', message: `Exported ${reportTitle} successfully!` });
      }
    } catch (err) {
      console.error('CSV Export Error:', err);
      const msg = err.message || 'Failed to download report.';
      if (showToast) {
        showToast({ type: 'error', message: msg });
      } else {
        alert(msg);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} className="no-print">
      {canExport && (
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={handleExportCsv}
          disabled={isExporting}
          title="Download as RFC-4180 CSV"
        >
          {isExporting ? (
            <>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #71717a', borderTopColor: '#18181b', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Exporting...
            </>
          ) : (
            <>📥 Export CSV</>
          )}
        </button>
      )}

      <button
        type="button"
        className={styles.btnSecondary}
        onClick={handlePrint}
        title="Print or Save as PDF"
      >
        🖨️ Print
      </button>
    </div>
  );
}


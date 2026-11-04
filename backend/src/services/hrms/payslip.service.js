import prisma from '../../config/prisma.js';
import { auditService } from '../audit.service.js';

function payslipError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export const payslipService = {
  /**
   * Secure public or direct download by token
   */
  async getPayslipByToken(downloadToken) {
    if (!downloadToken) throw payslipError('Download token is required.', 400);

    const payslip = await prisma.employeePayslip.findUnique({
      where: { downloadToken },
      include: {
        profile: {
          select: {
            id: true,
            employeeCode: true,
            displayName: true,
            panMasked: true,
            bankName: true,
            bankAccountMasked: true,
            bankIfsc: true,
            uanNumber: true,
            esicNumber: true,
            department: { select: { name: true } },
            designation: { select: { title: true } },
          },
        },
      },
    });

    if (!payslip || !payslip.isPublished) {
      throw payslipError('Payslip not found or download link is invalid.', 404);
    }

    return payslip;
  },

  /**
   * List employee's published payslips
   */
  async getEmployeePayslips(companyId, employeeProfileId) {
    return prisma.employeePayslip.findMany({
      where: {
        companyId,
        employeeProfileId,
        isPublished: true,
      },
      select: {
        id: true,
        payslipNumber: true,
        month: true,
        year: true,
        grossAmount: true,
        deductionsAmount: true,
        netAmount: true,
        downloadToken: true,
        publishedAt: true,
        createdAt: true,
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  },

  /**
   * Generate clean printable HTML representation of a payslip
   */
  async getPayslipHtml(companyId, payslipId, actor = {}) {
    const payslip = await prisma.employeePayslip.findFirst({
      where: { id: payslipId, companyId },
      include: {
        profile: {
          include: { department: true, designation: true },
        },
        clientAdmin: {
          select: { name: true, organizationName: true, email: true },
        },
      },
    });

    if (!payslip) throw payslipError('Payslip not found.', 404);

    const snapshot = typeof payslip.snapshotJson === 'string'
      ? JSON.parse(payslip.snapshotJson)
      : payslip.snapshotJson || {};

    const companyName = payslip.clientAdmin?.organizationName || payslip.clientAdmin?.name || 'AZZUNIQE ENTERPRISE';
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const periodStr = `${monthNames[payslip.month]} ${payslip.year}`;

    const earnings = Array.isArray(snapshot.earningsBreakdown) ? snapshot.earningsBreakdown : [];
    const deductions = Array.isArray(snapshot.deductionsBreakdown) ? snapshot.deductionsBreakdown : [];

    const earningsRows = earnings
      .map(
        (e) => `<tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${e.name}</td><td style="padding: 8px; text-align: right; border-bottom: 1px solid #e2e8f0;">₹${Number(e.amount).toFixed(2)}</td></tr>`
      )
      .join('');

    const deductionsRows = deductions
      .map(
        (d) => `<tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${d.name}</td><td style="padding: 8px; text-align: right; border-bottom: 1px solid #e2e8f0;">₹${Number(d.amount).toFixed(2)}</td></tr>`
      )
      .join('');

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Payslip - ${payslip.payslipNumber}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; color: #1e293b; background: #fff; }
        .container { max-width: 800px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px; padding: 24px; }
        .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 24px; color: #0f172a; }
        .header p { margin: 4px 0 0; color: #64748b; font-size: 14px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; font-size: 13px; }
        .table-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #f8fafc; padding: 8px; text-align: left; border-bottom: 1px solid #cbd5e1; font-weight: 600; }
        .net-salary { background: #f1f5f9; padding: 16px; border-radius: 6px; text-align: center; margin-top: 16px; }
        .net-salary h2 { margin: 0; color: #0f172a; font-size: 20px; }
        .disclaimer { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${companyName}</h1>
          <p><strong>Payslip for the month of ${periodStr}</strong></p>
          <p>Payslip No: ${payslip.payslipNumber}</p>
        </div>

        <div class="grid">
          <div>
            <p><strong>Employee Code:</strong> ${payslip.profile.employeeCode}</p>
            <p><strong>Employee Name:</strong> ${payslip.profile.displayName}</p>
            <p><strong>Department:</strong> ${payslip.profile.department?.name || 'General'}</p>
            <p><strong>Designation:</strong> ${payslip.profile.designation?.title || 'Staff'}</p>
          </div>
          <div>
            <p><strong>Bank Account:</strong> ${payslip.profile.bankAccountMasked || 'NA'}</p>
            <p><strong>Bank IFSC:</strong> ${payslip.profile.bankIfsc || 'NA'}</p>
            <p><strong>PAN:</strong> ${payslip.profile.panMasked || 'NA'}</p>
            <p><strong>UAN / ESIC:</strong> ${payslip.profile.uanNumber || 'NA'} / ${payslip.profile.esicNumber || 'NA'}</p>
          </div>
        </div>

        <div class="table-section">
          <div>
            <table>
              <thead>
                <tr><th>Earnings</th><th style="text-align: right;">Amount (₹)</th></tr>
              </thead>
              <tbody>
                ${earningsRows}
                <tr style="font-weight: bold; background: #f8fafc;">
                  <td style="padding: 8px;">Total Gross</td>
                  <td style="padding: 8px; text-align: right;">₹${Number(payslip.grossAmount).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <table>
              <thead>
                <tr><th>Deductions</th><th style="text-align: right;">Amount (₹)</th></tr>
              </thead>
              <tbody>
                ${deductionsRows}
                <tr style="font-weight: bold; background: #f8fafc;">
                  <td style="padding: 8px;">Total Deductions</td>
                  <td style="padding: 8px; text-align: right;">₹${Number(payslip.deductionsAmount).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="net-salary">
          <h2>Net Salary Payable: ₹${Number(payslip.netAmount).toFixed(2)}</h2>
          <p style="margin: 4px 0 0; color: #475569; font-size: 13px;">(Days Worked: ${snapshot.paidDays || '30'} | LOP Days: ${snapshot.lopDays || '0'})</p>
        </div>

        <div class="disclaimer">
          This is a computer-generated payslip and does not require a physical signature. Confidential document intended solely for the recipient employee.
        </div>
      </div>
    </body>
    </html>
    `;

    await auditService.logAction({
      companyId,
      actor,
      action: 'VIEW_PAYSLIP_HTML',
      entityType: 'EMPLOYEE_PAYSLIP',
      entityId: payslip.id,
      details: { payslipNumber: payslip.payslipNumber },
      reason: 'Viewed payslip printable document',
    });

    return html;
  },
};

export default payslipService;


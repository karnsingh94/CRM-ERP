import { prisma } from '../../config/prisma.js';
import { auditService } from '../audit.service.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

function stmtError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Robust CSV line parser handling quotes, commas, and trim.
 */
function parseCsvLines(csvContent) {
  if (!csvContent || typeof csvContent !== 'string') return [];
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const parseLine = (text) => {
    const row = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    row.push(cur.trim());
    return row;
  };

  const header = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const raw = parseLine(lines[i]);
    if (raw.length === 0 || raw.every((cell) => cell === '')) continue;
    const obj = {};
    for (let h = 0; h < header.length; h++) {
      obj[header[h]] = raw[h] || '';
    }
    obj._raw = raw;
    obj._line = i + 1;
    rows.push(obj);
  }

  return { header, rows };
}

/**
 * Standardize numeric amount string (removes currency symbols, commas).
 */
function cleanAmount(val) {
  if (val === null || val === undefined || val === '') return new Decimal(0);
  const clean = String(val).replace(/[^0-9.-]/g, '');
  if (!clean || isNaN(Number(clean))) return new Decimal(0);
  return new Decimal(clean);
}

/**
 * Parse date string into Date object.
 */
function parseDate(val) {
  if (!val) return null;
  // Support DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
  const s = String(val).trim();
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(s)) {
    const parts = s.split(/[/-]/);
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export const bankStatementService = {
  /**
   * Preview a bank statement CSV or array before importing.
   */
  async previewStatement(companyId, bankAccountId, input, options = {}) {
    if (!companyId || !bankAccountId) throw stmtError('companyId and bankAccountId are required.');

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId },
    });
    if (!bankAccount) throw stmtError('Bank account not found.', 404);

    let rowsToProcess = [];

    if (typeof input === 'string') {
      const { rows } = parseCsvLines(input);
      rowsToProcess = rows;
    } else if (Array.isArray(input)) {
      rowsToProcess = input.map((r, idx) => ({ ...r, _line: idx + 1 }));
    } else if (input && Array.isArray(input.rows)) {
      rowsToProcess = input.rows.map((r, idx) => ({ ...r, _line: idx + 1 }));
    } else {
      throw stmtError('Invalid statement input. Expecting CSV text or an array of rows.');
    }

    const { columnMapping = {} } = options;

    const validatedRows = [];
    const rejectedRows = [];
    const seenExternalRefs = new Set();

    // Fetch existing externalRefs for this bank account to detect duplicates
    const existingTxns = await prisma.bankTransaction.findMany({
      where: { companyId, bankAccountId },
      select: { externalRef: true, referenceNo: true, transactionDate: true, debitAmount: true, creditAmount: true },
    });
    const existingRefMap = new Set(existingTxns.map((t) => t.externalRef).filter(Boolean));

    for (const raw of rowsToProcess) {
      const lineNum = raw._line || validatedRows.length + rejectedRows.length + 1;

      // Map fields with fallback
      const rawDate = raw[columnMapping.date || 'date'] || raw.transactiondate || raw.txn_date || raw.valuedate;
      const rawValueDate = raw[columnMapping.valueDate || 'valuedate'] || raw.value_date || rawDate;
      const rawDesc = raw[columnMapping.description || 'description'] || raw.narration || raw.particulars || raw.desc || '';
      const rawRef = raw[columnMapping.referenceNo || 'referenceno'] || raw.refno || raw.ref_no || raw.chequeno || raw.chqrefno || raw.ref || '';
      const rawExtRef = raw[columnMapping.externalRef || 'externalref'] || raw.txnid || raw.txn_id || raw.utr || raw.external_ref || (rawRef ? `REF-${rawRef}` : null);
      
      const rawDebit = raw[columnMapping.debitAmount || 'debitamount'] || raw.debit || raw.withdrawal || raw.dr || 0;
      const rawCredit = raw[columnMapping.creditAmount || 'creditamount'] || raw.credit || raw.deposit || raw.cr || 0;
      const rawBal = raw[columnMapping.runningBalance || 'runningbalance'] || raw.balance || raw.closing_balance || null;

      const txDate = parseDate(rawDate);
      if (!txDate) {
        rejectedRows.push({ rowNumber: lineNum, reason: `Invalid date format: "${rawDate}"`, data: raw });
        continue;
      }

      let debitAmount = cleanAmount(rawDebit);
      let creditAmount = cleanAmount(rawCredit);

      // Support signed amount column (negative = debit, positive = credit)
      if (raw.amount !== undefined && debitAmount.isZero() && creditAmount.isZero()) {
        const amt = cleanAmount(raw.amount);
        if (amt.isNegative()) debitAmount = amt.abs();
        else creditAmount = amt;
      }

      // Check non-negative
      if (debitAmount.isNegative() || creditAmount.isNegative()) {
        rejectedRows.push({ rowNumber: lineNum, reason: 'Debit or credit amount cannot be negative.', data: raw });
        continue;
      }

      // Check polarity (cannot both be positive, cannot both be zero)
      if (debitAmount.gt(0) && creditAmount.gt(0)) {
        rejectedRows.push({ rowNumber: lineNum, reason: 'Row cannot have both debit and credit amounts greater than zero.', data: raw });
        continue;
      }
      if (debitAmount.isZero() && creditAmount.isZero()) {
        rejectedRows.push({ rowNumber: lineNum, reason: 'Transaction amount must be greater than zero.', data: raw });
        continue;
      }

      const runningBal = rawBal !== null && rawBal !== undefined && rawBal !== '' ? cleanAmount(rawBal) : null;

      // Check duplicates
      const extRefKey = rawExtRef
        ? String(rawExtRef).trim()
        : `${txDate.toISOString().slice(0, 10)}_${debitAmount}_${creditAmount}_${rawRef || rawDesc.slice(0, 30)}`;
      let isDuplicate = false;
      let dupReason = null;

      if (seenExternalRefs.has(extRefKey)) {
        isDuplicate = true;
        dupReason = `Duplicate external reference in statement file: "${extRefKey}"`;
      } else if (existingRefMap.has(extRefKey)) {
        isDuplicate = true;
        dupReason = `Transaction with external reference "${extRefKey}" already imported.`;
      }

      if (isDuplicate) {
        rejectedRows.push({ rowNumber: lineNum, reason: dupReason, data: raw, isDuplicate: true });
        continue;
      }

      if (extRefKey) seenExternalRefs.add(extRefKey);

      validatedRows.push({
        rowNumber: lineNum,
        transactionDate: txDate,
        valueDate: parseDate(rawValueDate) || txDate,
        description: String(rawDesc).trim(),
        referenceNo: rawRef ? String(rawRef).trim() : null,
        externalRef: extRefKey,
        debitAmount,
        creditAmount,
        runningBalance: runningBal,
      });
    }

    return {
      bankAccountId,
      bankName: bankAccount.bankName,
      maskedAccountNumber: bankAccount.maskedAccountNumber,
      totalRows: rowsToProcess.length,
      validCount: validatedRows.length,
      rejectedCount: rejectedRows.length,
      previewRows: validatedRows.slice(0, 10),
      rejectedRows,
    };
  },

  /**
   * Import bank statement transactions into the database.
   */
  async importStatement(companyId, bankAccountId, input, options = {}, actor = {}) {
    const preview = await this.previewStatement(companyId, bankAccountId, input, options);

    if (preview.validCount === 0) {
      throw stmtError(
        `Cannot import statement: No valid rows found. Total rows: ${preview.totalRows}, Rejected: ${preview.rejectedCount}.`
      );
    }

    const { skipRejected = false } = options;
    if (!skipRejected && preview.rejectedCount > 0) {
      throw stmtError(
        `Import rejected: Statement contains ${preview.rejectedCount} invalid/duplicate row(s). Set skipRejected=true to import valid rows only. First error: ${preview.rejectedRows[0]?.reason}`
      );
    }

    const statementBatchId = `STMT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    return prisma.$transaction(async (tx) => {
      const createData = preview.previewRows.concat(
        // we need all validated rows, let's regenerate or return all from preview
      );

      // Re-run the preview's validated rows full list
      const fullPreview = await this._getValidatedRows(companyId, bankAccountId, input, options);

      const createdTxns = [];
      let lastRunningBalance = null;

      for (const row of fullPreview.validatedRows) {
        const created = await tx.bankTransaction.create({
          data: {
            companyId,
            bankAccountId,
            statementBatchId,
            transactionDate: row.transactionDate,
            valueDate: row.valueDate,
            description: row.description,
            referenceNo: row.referenceNo,
            externalRef: row.externalRef,
            debitAmount: row.debitAmount,
            creditAmount: row.creditAmount,
            runningBalance: row.runningBalance,
            importSource: 'STATEMENT_IMPORT',
            reconciliationStatus: 'UNRECONCILED',
          },
        });
        createdTxns.push(created);
        if (row.runningBalance !== null) lastRunningBalance = row.runningBalance;
      }

      // Update bank account currentBalance if lastRunningBalance is available
      if (lastRunningBalance !== null) {
        await tx.bankAccount.update({
          where: { id: bankAccountId },
          data: { currentBalance: lastRunningBalance },
        });
      }

      try {
        await auditService.log({
          action: 'BANK_STATEMENT_IMPORTED',
          entityId: bankAccountId,
          entityType: 'BANK_ACCOUNT',
          companyId,
          userId: actor.id || actor.userId || null,
          details: {
            statementBatchId,
            importedCount: createdTxns.length,
            rejectedCount: fullPreview.rejectedRows.length,
          },
        });
      } catch (err) {}

      return {
        statementBatchId,
        bankAccountId,
        importedCount: createdTxns.length,
        skippedCount: fullPreview.rejectedRows.length,
        transactions: createdTxns,
        rejectedRows: fullPreview.rejectedRows,
      };
    });
  },

  async _getValidatedRows(companyId, bankAccountId, input, options) {
    let rowsToProcess = [];
    if (typeof input === 'string') {
      const { rows } = parseCsvLines(input);
      rowsToProcess = rows;
    } else if (Array.isArray(input)) {
      rowsToProcess = input.map((r, idx) => ({ ...r, _line: idx + 1 }));
    } else if (input && Array.isArray(input.rows)) {
      rowsToProcess = input.rows.map((r, idx) => ({ ...r, _line: idx + 1 }));
    }

    const { columnMapping = {} } = options;
    const validatedRows = [];
    const rejectedRows = [];
    const seenExternalRefs = new Set();

    const existingTxns = await prisma.bankTransaction.findMany({
      where: { companyId, bankAccountId },
      select: { externalRef: true },
    });
    const existingRefMap = new Set(existingTxns.map((t) => t.externalRef).filter(Boolean));

    for (const raw of rowsToProcess) {
      const lineNum = raw._line || validatedRows.length + rejectedRows.length + 1;
      const rawDate = raw[columnMapping.date || 'date'] || raw.transactiondate || raw.txn_date || raw.valuedate;
      const rawValueDate = raw[columnMapping.valueDate || 'valuedate'] || raw.value_date || rawDate;
      const rawDesc = raw[columnMapping.description || 'description'] || raw.narration || raw.particulars || raw.desc || '';
      const rawRef = raw[columnMapping.referenceNo || 'referenceno'] || raw.refno || raw.ref_no || raw.chequeno || raw.chqrefno || raw.ref || '';
      const rawExtRef = raw[columnMapping.externalRef || 'externalref'] || raw.txnid || raw.txn_id || raw.utr || raw.external_ref || (rawRef ? `REF-${rawRef}` : null);
      
      const rawDebit = raw[columnMapping.debitAmount || 'debitamount'] || raw.debit || raw.withdrawal || raw.dr || 0;
      const rawCredit = raw[columnMapping.creditAmount || 'creditamount'] || raw.credit || raw.deposit || raw.cr || 0;
      const rawBal = raw[columnMapping.runningBalance || 'runningbalance'] || raw.balance || raw.closing_balance || null;

      const txDate = parseDate(rawDate);
      if (!txDate) {
        rejectedRows.push({ rowNumber: lineNum, reason: `Invalid date format: "${rawDate}"`, data: raw });
        continue;
      }

      let debitAmount = cleanAmount(rawDebit);
      let creditAmount = cleanAmount(rawCredit);

      if (raw.amount !== undefined && debitAmount.isZero() && creditAmount.isZero()) {
        const amt = cleanAmount(raw.amount);
        if (amt.isNegative()) debitAmount = amt.abs();
        else creditAmount = amt;
      }

      if (debitAmount.isNegative() || creditAmount.isNegative()) {
        rejectedRows.push({ rowNumber: lineNum, reason: 'Debit or credit amount cannot be negative.', data: raw });
        continue;
      }
      if (debitAmount.gt(0) && creditAmount.gt(0)) {
        rejectedRows.push({ rowNumber: lineNum, reason: 'Row cannot have both debit and credit amounts greater than zero.', data: raw });
        continue;
      }
      if (debitAmount.isZero() && creditAmount.isZero()) {
        rejectedRows.push({ rowNumber: lineNum, reason: 'Transaction amount must be greater than zero.', data: raw });
        continue;
      }

      const runningBal = rawBal !== null && rawBal !== undefined && rawBal !== '' ? cleanAmount(rawBal) : null;
      const extRefKey = rawExtRef
        ? String(rawExtRef).trim()
        : `${txDate.toISOString().slice(0, 10)}_${debitAmount}_${creditAmount}_${rawRef || rawDesc.slice(0, 30)}`;

      if (seenExternalRefs.has(extRefKey) || existingRefMap.has(extRefKey)) {
        rejectedRows.push({
          rowNumber: lineNum,
          reason: `Duplicate external reference: "${extRefKey}"`,
          data: raw,
          isDuplicate: true,
        });
        continue;
      }
      seenExternalRefs.add(extRefKey);

      validatedRows.push({
        rowNumber: lineNum,
        transactionDate: txDate,
        valueDate: parseDate(rawValueDate) || txDate,
        description: String(rawDesc).trim(),
        referenceNo: rawRef ? String(rawRef).trim() : null,
        externalRef: extRefKey,
        debitAmount,
        creditAmount,
        runningBalance: runningBal,
      });
    }

    return { validatedRows, rejectedRows };
  },

  /**
   * List imported statement transactions for a bank account.
   */
  async listTransactions(companyId, bankAccountId, query = {}) {
    if (!companyId || !bankAccountId) throw stmtError('companyId and bankAccountId are required.');

    const { reconciliationStatus, batchId, fromDate, toDate, limit = 100, offset = 0 } = query;
    const where = { companyId, bankAccountId };

    if (reconciliationStatus) where.reconciliationStatus = reconciliationStatus.toUpperCase();
    if (batchId) where.statementBatchId = batchId;
    if (fromDate || toDate) {
      where.transactionDate = {};
      if (fromDate) where.transactionDate.gte = new Date(fromDate);
      if (toDate) where.transactionDate.lte = new Date(toDate);
    }

    const [total, items] = await Promise.all([
      prisma.bankTransaction.count({ where }),
      prisma.bankTransaction.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          reconciliationItems: {
            include: { voucher: { select: { id: true, voucherNo: true, voucherType: true } } },
          },
        },
      }),
    ]);

    return { total, items };
  },
};

export default bankStatementService;

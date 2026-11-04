import { prisma } from '../../config/prisma.js';
import { auditService } from '../audit.service.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

function tallyError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatTallyDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

const TALLY_PARENT_GROUP_SUGGESTIONS = {
  ASSET: 'Current Assets',
  LIABILITY: 'Current Liabilities',
  INCOME: 'Direct Incomes',
  EXPENSE: 'Direct Expenses',
  EQUITY: 'Capital Account',
  SUNDRY_DEBTORS: 'Sundry Debtors',
  SUNDRY_CREDITORS: 'Sundry Creditors',
  BANK: 'Bank Accounts',
  CASH: 'Cash-in-hand',
  OUTPUT_CGST: 'Duties & Taxes',
  OUTPUT_SGST: 'Duties & Taxes',
  OUTPUT_IGST: 'Duties & Taxes',
  INPUT_CGST: 'Duties & Taxes',
  INPUT_SGST: 'Duties & Taxes',
  INPUT_IGST: 'Duties & Taxes',
  SALES_REVENUE: 'Sales Accounts',
  PURCHASE_EXPENSE: 'Purchase Accounts',
};

const VOUCHER_TYPE_TO_TALLY = {
  JOURNAL: 'Journal',
  PAYMENT: 'Payment',
  RECEIPT: 'Receipt',
  CONTRA: 'Contra',
  SALES_INVOICE: 'Sales',
  PURCHASE_BILL: 'Purchase',
  CREDIT_NOTE: 'Credit Note',
  DEBIT_NOTE: 'Debit Note',
};

export const tallyService = {
  // =========================================================================
  // 1. LEDGER MAPPINGS
  // =========================================================================

  /**
   * Create a mapping between a local AccountMaster and a Tally Ledger.
   */
  async createLedgerMapping(companyId, data, actor = {}) {
    if (!companyId) throw tallyError('companyId is required.');

    const { accountId, tallyLedgerName, tallyParentGroup = null } = data;
    if (!accountId) throw tallyError('accountId is required.');
    if (!tallyLedgerName || !tallyLedgerName.trim()) throw tallyError('tallyLedgerName is required.');

    const cleanTallyName = tallyLedgerName.trim();

    const account = await prisma.accountMaster.findFirst({
      where: { id: accountId, companyId },
      include: { group: true },
    });
    if (!account) throw tallyError('Local account not found or does not belong to this company.', 404);

    // Check duplicate account mapping
    const existingAcctMapping = await prisma.tallyLedgerMapping.findFirst({
      where: { companyId, accountId },
    });
    if (existingAcctMapping) {
      throw tallyError(`Account "${account.accountName}" is already mapped to Tally ledger "${existingAcctMapping.tallyLedgerName}".`);
    }

    // Check duplicate Tally ledger name
    const existingNameMapping = await prisma.tallyLedgerMapping.findFirst({
      where: { companyId, tallyLedgerName: cleanTallyName },
    });
    if (existingNameMapping) {
      throw tallyError(`Tally ledger name "${cleanTallyName}" is already mapped to another account.`);
    }

    const resolvedParent =
      tallyParentGroup ||
      TALLY_PARENT_GROUP_SUGGESTIONS[account.controlType] ||
      TALLY_PARENT_GROUP_SUGGESTIONS[account.group?.category] ||
      'Primary';

    const mapping = await prisma.tallyLedgerMapping.create({
      data: {
        companyId,
        accountId,
        tallyLedgerName: cleanTallyName,
        tallyParentGroup: resolvedParent,
        status: 'ACTIVE',
      },
      include: {
        account: {
          select: { id: true, accountCode: true, accountName: true, controlType: true },
        },
      },
    });

    try {
      await auditService.log({
        action: 'TALLY_LEDGER_MAPPED',
        entityId: mapping.id,
        entityType: 'TALLY_LEDGER_MAPPING',
        companyId,
        userId: actor.id || actor.userId || null,
        details: { accountId, tallyLedgerName: cleanTallyName, tallyParentGroup: resolvedParent },
      });
    } catch (err) {}

    return mapping;
  },

  /**
   * Update an existing ledger mapping.
   */
  async updateLedgerMapping(companyId, mappingId, data, actor = {}) {
    if (!companyId || !mappingId) throw tallyError('companyId and mappingId are required.');

    const mapping = await prisma.tallyLedgerMapping.findFirst({
      where: { id: mappingId, companyId },
    });
    if (!mapping) throw tallyError('Tally ledger mapping not found.', 404);

    const updateData = {};
    if (data.tallyLedgerName) {
      const cleanName = data.tallyLedgerName.trim();
      if (cleanName !== mapping.tallyLedgerName) {
        const dup = await prisma.tallyLedgerMapping.findFirst({
          where: { companyId, tallyLedgerName: cleanName, id: { not: mappingId } },
        });
        if (dup) throw tallyError(`Tally ledger name "${cleanName}" is already in use.`);
        updateData.tallyLedgerName = cleanName;
      }
    }

    if (data.tallyParentGroup !== undefined) updateData.tallyParentGroup = data.tallyParentGroup.trim();
    if (data.status !== undefined) updateData.status = data.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const updated = await prisma.tallyLedgerMapping.update({
      where: { id: mappingId },
      data: updateData,
      include: {
        account: {
          select: { id: true, accountCode: true, accountName: true, controlType: true },
        },
      },
    });

    try {
      await auditService.log({
        action: 'TALLY_LEDGER_MAPPING_UPDATED',
        entityId: mappingId,
        entityType: 'TALLY_LEDGER_MAPPING',
        companyId,
        userId: actor.id || actor.userId || null,
        details: updateData,
      });
    } catch (err) {}

    return updated;
  },

  /**
   * List or search Tally ledger mappings.
   */
  async listLedgerMappings(companyId, query = {}) {
    if (!companyId) throw tallyError('companyId is required.');

    const { status, search, limit = 100, offset = 0 } = query;
    const where = { companyId };
    if (status) where.status = status.toUpperCase();
    if (search) {
      where.OR = [
        { tallyLedgerName: { contains: search } },
        { tallyParentGroup: { contains: search } },
        { account: { accountName: { contains: search } } },
        { account: { accountCode: { contains: search } } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.tallyLedgerMapping.count({ where }),
      prisma.tallyLedgerMapping.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        orderBy: { createdAt: 'desc' },
        include: {
          account: {
            select: { id: true, accountCode: true, accountName: true, controlType: true },
          },
        },
      }),
    ]);

    return { total, items };
  },

  /**
   * Preview mapping status of all local accounts.
   */
  async previewLedgerMappings(companyId) {
    if (!companyId) throw tallyError('companyId is required.');

    const [accounts, mappings] = await Promise.all([
      prisma.accountMaster.findMany({
        where: { companyId, status: 'ACTIVE' },
        include: { group: true },
        orderBy: [{ accountCode: 'asc' }],
      }),
      prisma.tallyLedgerMapping.findMany({
        where: { companyId },
      }),
    ]);

    const mappingMap = new Map(mappings.map((m) => [m.accountId, m]));

    const result = accounts.map((acc) => {
      const mapping = mappingMap.get(acc.id);
      const suggestedParent =
        TALLY_PARENT_GROUP_SUGGESTIONS[acc.controlType] ||
        TALLY_PARENT_GROUP_SUGGESTIONS[acc.group?.category] ||
        acc.group?.groupName ||
        'Primary';

      return {
        accountId: acc.id,
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        category: acc.group?.category,
        controlType: acc.controlType,
        isMapped: Boolean(mapping),
        tallyLedgerName: mapping ? mapping.tallyLedgerName : acc.accountName,
        tallyParentGroup: mapping ? mapping.tallyParentGroup : suggestedParent,
        mappingId: mapping?.id || null,
      };
    });

    const mappedCount = result.filter((r) => r.isMapped).length;
    return {
      totalAccounts: accounts.length,
      mappedCount,
      unmappedCount: accounts.length - mappedCount,
      accounts: result,
    };
  },

  // =========================================================================
  // 2. VOUCHER EXPORT ENGINE
  // =========================================================================

  /**
   * Preview vouchers eligible for Tally export before generating XML.
   */
  async previewVoucherExport(companyId, options = {}) {
    if (!companyId) throw tallyError('companyId is required.');

    const { fromDate, toDate, voucherType, voucherIds, reExport = false } = options;

    const where = {
      companyId,
      status: 'POSTED',
    };

    if (voucherType) where.voucherType = voucherType.toUpperCase();
    if (voucherIds && Array.isArray(voucherIds) && voucherIds.length > 0) {
      where.id = { in: voucherIds };
    }
    if (fromDate || toDate) {
      where.voucherDate = {};
      if (fromDate) where.voucherDate.gte = new Date(fromDate);
      if (toDate) where.voucherDate.lte = new Date(toDate);
    }

    const vouchers = await prisma.journalVoucher.findMany({
      where,
      orderBy: { voucherDate: 'asc' },
      include: {
        items: {
          include: { account: true },
        },
      },
    });

    // Check existing mappings
    const vchIds = vouchers.map((v) => v.id);
    const existingMappings = await prisma.tallyVoucherMapping.findMany({
      where: { companyId, voucherId: { in: vchIds } },
    });
    const exportedVchMap = new Map(existingMappings.map((m) => [m.voucherId, m]));

    // Check ledger mappings
    const ledgerMappings = await prisma.tallyLedgerMapping.findMany({
      where: { companyId },
    });
    const ledgerMap = new Map(ledgerMappings.map((m) => [m.accountId, m.tallyLedgerName]));

    const missingLedgerNames = new Set();
    const readyVouchers = [];
    const skippedAlreadyExported = [];

    for (const vch of vouchers) {
      const isAlreadyExported = exportedVchMap.has(vch.id) && exportedVchMap.get(vch.id).exportStatus === 'EXPORTED';
      if (isAlreadyExported && !reExport) {
        skippedAlreadyExported.push({
          voucherId: vch.id,
          voucherNo: vch.voucherNo,
          guid: exportedVchMap.get(vch.id).tallyGuid,
        });
        continue;
      }

      for (const item of vch.items) {
        if (!ledgerMap.has(item.accountId)) {
          missingLedgerNames.add(item.account.accountName);
        }
      }

      readyVouchers.push({
        voucherId: vch.id,
        voucherNo: vch.voucherNo,
        voucherType: vch.voucherType,
        voucherDate: vch.voucherDate,
        amount: vch.totalDebit,
        narration: vch.narration,
        isReExport: isAlreadyExported,
      });
    }

    return {
      totalFound: vouchers.length,
      eligibleCount: readyVouchers.length,
      skippedCount: skippedAlreadyExported.length,
      missingLedgersCount: missingLedgerNames.size,
      missingLedgers: Array.from(missingLedgerNames),
      eligibleVouchers: readyVouchers,
      skippedAlreadyExported,
    };
  },

  /**
   * Export POSTED Journal Vouchers to standard Tally-compatible XML.
   */
  async exportVouchers(companyId, options = {}, actor = {}) {
    if (!companyId) throw tallyError('companyId is required.');

    const preview = await this.previewVoucherExport(companyId, options);

    if (preview.eligibleCount === 0) {
      if (preview.skippedCount > 0) {
        throw tallyError(
          `All ${preview.skippedCount} matching voucher(s) have already been exported. Set reExport=true to re-export.`
        );
      }
      throw tallyError('No eligible POSTED vouchers found for export.');
    }

    const { reExport = false } = options;
    const eligibleIds = preview.eligibleVouchers.map((v) => v.voucherId);

    const [vouchers, ledgerMappings, company] = await Promise.all([
      prisma.journalVoucher.findMany({
        where: { id: { in: eligibleIds }, companyId },
        orderBy: { voucherDate: 'asc' },
        include: {
          items: {
            include: { account: true, customer: true, vendor: true },
          },
        },
      }),
      prisma.tallyLedgerMapping.findMany({
        where: { companyId },
      }),
      prisma.clientAdmin.findUnique({
        where: { id: companyId },
        select: { organizationName: true, name: true },
      }),
    ]);

    const ledgerMap = new Map(ledgerMappings.map((m) => [m.accountId, m.tallyLedgerName]));
    const companyName = company?.organizationName || company?.name || 'AZZUNIQE ERP';

    // Generate XML body
    const voucherXmlBlocks = [];
    const mappingRecordsToUpsert = [];

    for (const vch of vouchers) {
      const tallyVchType = VOUCHER_TYPE_TO_TALLY[vch.voucherType] || 'Journal';
      const tallyDate = formatTallyDate(vch.voucherDate);
      const stableGuid = `AZZUNIQE-VCH-${vch.id}`;

      let entriesXml = '';

      for (const item of vch.items) {
        const mappedName = ledgerMap.get(item.accountId) || item.account.accountName;
        const isDebit = item.debitAmount.gt(0);
        const itemAmt = isDebit ? new Decimal(item.debitAmount) : new Decimal(item.creditAmount);

        // In standard Tally XML, Dr has ISDEEMEDPOSITIVE=Yes and negative amount; Cr has ISDEEMEDPOSITIVE=No and positive amount
        const deemedPos = isDebit ? 'Yes' : 'No';
        const formattedAmt = isDebit ? `-${itemAmt.toFixed(2)}` : itemAmt.toFixed(2);

        entriesXml += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(mappedName)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${deemedPos}</ISDEEMEDPOSITIVE>
              <LEDGERFROMITEM>No</LEDGERFROMITEM>
              <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
              <ISPARTYLEDGER>No</ISPARTYLEDGER>
              <ISLASTDEEMEDPOSITIVE>${deemedPos}</ISLASTDEEMEDPOSITIVE>
              <AMOUNT>${formattedAmt}</AMOUNT>
              ${item.narration ? `<NARRATION>${escapeXml(item.narration)}</NARRATION>` : ''}
            </ALLLEDGERENTRIES.LIST>`;
      }

      const vchBlock = `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${tallyVchType}" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>${tallyDate}</DATE>
            <GUID>${stableGuid}</GUID>
            <VOUCHERTYPENAME>${tallyVchType}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escapeXml(vch.voucherNo)}</VOUCHERNUMBER>
            <REFERENCE>${escapeXml(vch.referenceNo || vch.voucherNo)}</REFERENCE>
            <NARRATION>${escapeXml(vch.narration || '')}</NARRATION>
            <ISINVOICE>No</ISINVOICE>${entriesXml}
          </VOUCHER>
        </TALLYMESSAGE>`;

      voucherXmlBlocks.push(vchBlock);

      mappingRecordsToUpsert.push({
        voucherId: vch.id,
        tallyGuid: stableGuid,
      });
    }

    const fullXml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>${voucherXmlBlocks.join('')}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    const batchNo = `TALLY-SYNC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    return prisma.$transaction(async (tx) => {
      const batch = await tx.tallySyncBatch.create({
        data: {
          companyId,
          batchNo,
          batchType: 'VOUCHER_EXPORT',
          totalCount: vouchers.length,
          successCount: vouchers.length,
          failedCount: 0,
          status: 'COMPLETED',
          completedAt: new Date(),
          createdById: actor.id || actor.userId || null,
        },
      });

      for (const mapItem of mappingRecordsToUpsert) {
        await tx.tallyVoucherMapping.upsert({
          where: { companyId_voucherId: { companyId, voucherId: mapItem.voucherId } },
          create: {
            companyId,
            syncBatchId: batch.id,
            voucherId: mapItem.voucherId,
            tallyGuid: mapItem.tallyGuid,
            exportStatus: 'EXPORTED',
            syncedAt: new Date(),
          },
          update: {
            syncBatchId: batch.id,
            tallyGuid: mapItem.tallyGuid,
            exportStatus: 'EXPORTED',
            errorMessage: null,
            syncedAt: new Date(),
          },
        });
      }

      try {
        await auditService.log({
          action: 'TALLY_VOUCHERS_EXPORTED',
          entityId: batch.id,
          entityType: 'TALLY_SYNC_BATCH',
          companyId,
          userId: actor.id || actor.userId || null,
          details: { batchNo, voucherCount: vouchers.length },
        });
      } catch (err) {}

      return {
        batchNo: batch.batchNo,
        batchId: batch.id,
        voucherCount: vouchers.length,
        exportStatus: 'COMPLETED',
        xml: fullXml,
      };
    });
  },

  /**
   * List export batches.
   */
  async getExportBatches(companyId, query = {}) {
    if (!companyId) throw tallyError('companyId is required.');

    const { status, limit = 50, offset = 0 } = query;
    const where = { companyId };
    if (status) where.status = status.toUpperCase();

    const [total, items] = await Promise.all([
      prisma.tallySyncBatch.count({ where }),
      prisma.tallySyncBatch.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { vouchers: true } },
        },
      }),
    ]);

    return { total, items };
  },

  /**
   * List failed Tally export records.
   */
  async getFailedExports(companyId, query = {}) {
    if (!companyId) throw tallyError('companyId is required.');

    const { limit = 50, offset = 0 } = query;
    const where = { companyId, exportStatus: 'FAILED' };

    const [total, items] = await Promise.all([
      prisma.tallyVoucherMapping.count({ where }),
      prisma.tallyVoucherMapping.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        orderBy: { syncedAt: 'desc' },
        include: {
          voucher: {
            select: { id: true, voucherNo: true, voucherType: true, voucherDate: true, totalDebit: true },
          },
        },
      }),
    ]);

    return { total, items };
  },
};

export default tallyService;

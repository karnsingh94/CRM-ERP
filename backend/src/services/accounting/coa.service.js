import { prisma } from '../../config/prisma.js';
import { auditService } from '../audit.service.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

function coaError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export const coaService = {
  // =========================================================================
  // 1. ACCOUNT GROUPS (CHART OF ACCOUNTS HIERARCHY)
  // =========================================================================

  async createGroup(companyId, data, actor = {}) {
    const { groupName, groupCode, category, parentId, isSystem = false } = data;

    if (!groupName || !groupCode || !category) {
      throw coaError('groupName, groupCode, and category are required.');
    }

    const validCategories = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
    if (!validCategories.includes(category.toUpperCase())) {
      throw coaError(`Invalid category. Allowed: ${validCategories.join(', ')}`);
    }

    // Check duplicate groupCode in this company
    const existing = await prisma.accountGroup.findFirst({
      where: { companyId, groupCode: groupCode.trim() },
    });
    if (existing) {
      throw coaError(`Account Group with code '${groupCode}' already exists for this company.`);
    }

    if (parentId) {
      const parent = await prisma.accountGroup.findFirst({
        where: { id: parentId, companyId },
      });
      if (!parent) {
        throw coaError(`Parent account group not found.`);
      }
      if (parent.category !== category.toUpperCase()) {
        throw coaError(`Child group category (${category}) must match parent group category (${parent.category}).`);
      }
    }

    const group = await prisma.accountGroup.create({
      data: {
        companyId,
        groupName: groupName.trim(),
        groupCode: groupCode.trim().toUpperCase(),
        category: category.toUpperCase(),
        parentId: parentId || null,
        isSystem: Boolean(isSystem),
        status: 'ACTIVE',
      },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'Accountant',
      action: 'ACCOUNT_GROUP_CREATE',
      serviceCode: 'accounts_banking',
      moduleCode: 'chart_of_accounts',
      details: `Created Account Group ${group.groupName} (${group.groupCode}) under category ${group.category}.`,
    });

    return group;
  },

  async updateGroup(companyId, groupId, data, actor = {}) {
    const existing = await prisma.accountGroup.findFirst({
      where: { id: groupId, companyId },
    });
    if (!existing) {
      throw coaError(`Account group not found with id ${groupId}.`, 404);
    }

    const { groupName, groupCode, parentId, status } = data;

    // System group protection: cannot rename or change system status
    if (existing.isSystem && data.category && data.category !== existing.category) {
      throw coaError('Cannot change category of a system account group.');
    }

    if (groupCode && groupCode !== existing.groupCode) {
      const duplicate = await prisma.accountGroup.findFirst({
        where: { companyId, groupCode: groupCode.trim().toUpperCase(), id: { not: groupId } },
      });
      if (duplicate) {
        throw coaError(`Group code '${groupCode}' is already in use.`);
      }
    }

    // Circular reference check
    if (parentId) {
      if (parentId === groupId) {
        throw coaError('A group cannot be its own parent.');
      }
      // Check if parentId is a descendant of groupId
      let currentParentId = parentId;
      while (currentParentId) {
        if (currentParentId === groupId) {
          throw coaError('Circular parent-child reference detected in account groups.');
        }
        const p = await prisma.accountGroup.findFirst({
          where: { id: currentParentId, companyId },
          select: { parentId: true },
        });
        currentParentId = p ? p.parentId : null;
      }
    }

    const updated = await prisma.accountGroup.update({
      where: { id: groupId },
      data: {
        groupName: groupName !== undefined ? groupName.trim() : existing.groupName,
        groupCode: groupCode !== undefined ? groupCode.trim().toUpperCase() : existing.groupCode,
        parentId: parentId !== undefined ? parentId : existing.parentId,
        status: status !== undefined ? status : existing.status,
      },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'Accountant',
      action: 'ACCOUNT_GROUP_UPDATE',
      serviceCode: 'accounts_banking',
      moduleCode: 'chart_of_accounts',
      details: `Updated Account Group ${updated.groupName} (${updated.groupCode}).`,
    });

    return updated;
  },

  async listGroups(companyId, filters = {}) {
    const { category, search, status } = filters;
    const where = { companyId };

    if (category) where.category = category.toUpperCase();
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { groupName: { contains: search } },
        { groupCode: { contains: search } },
      ];
    }

    const groups = await prisma.accountGroup.findMany({
      where,
      orderBy: [{ category: 'asc' }, { groupName: 'asc' }],
      include: {
        parent: true,
        children: true,
        _count: {
          select: { accounts: true },
        },
      },
    });

    return groups;
  },

  async getGroupById(companyId, groupId) {
    const group = await prisma.accountGroup.findFirst({
      where: { id: groupId, companyId },
      include: {
        parent: true,
        children: true,
        accounts: true,
      },
    });
    if (!group) {
      throw coaError(`Account group not found with id ${groupId}.`, 404);
    }
    return group;
  },

  // =========================================================================
  // 2. ACCOUNT MASTERS (GENERAL LEDGER HEADS)
  // =========================================================================

  async createAccount(companyId, data, actor = {}) {
    const {
      groupId,
      accountCode,
      accountName,
      normalBalance,
      openingDebit = 0,
      openingCredit = 0,
      isControlAccount = false,
      controlType = null,
      isSystem = false,
      notes,
    } = data;

    if (!groupId || !accountCode || !accountName || !normalBalance) {
      throw coaError('groupId, accountCode, accountName, and normalBalance are required.');
    }

    const validBalances = ['DEBIT', 'CREDIT'];
    if (!validBalances.includes(normalBalance.toUpperCase())) {
      throw coaError(`normalBalance must be either DEBIT or CREDIT.`);
    }

    // Verify group belongs to company
    const group = await prisma.accountGroup.findFirst({
      where: { id: groupId, companyId },
    });
    if (!group) {
      throw coaError(`Account Group not found with id ${groupId}.`, 404);
    }

    // Check duplicate account code
    const existing = await prisma.accountMaster.findFirst({
      where: { companyId, accountCode: accountCode.trim().toUpperCase() },
    });
    if (existing) {
      throw coaError(`Account with code '${accountCode}' already exists for this company.`);
    }

    const opDebit = new Decimal(openingDebit || 0);
    const opCredit = new Decimal(openingCredit || 0);

    // Initial currentBalance calculation based on normal balance
    let currentBalance = new Decimal(0);
    if (normalBalance.toUpperCase() === 'DEBIT') {
      currentBalance = opDebit.sub(opCredit);
    } else {
      currentBalance = opCredit.sub(opDebit);
    }

    const account = await prisma.accountMaster.create({
      data: {
        companyId,
        groupId,
        accountCode: accountCode.trim().toUpperCase(),
        accountName: accountName.trim(),
        normalBalance: normalBalance.toUpperCase(),
        openingDebit: opDebit,
        openingCredit: opCredit,
        currentBalance,
        isControlAccount: Boolean(isControlAccount || controlType),
        controlType: controlType ? controlType.trim().toUpperCase() : null,
        isSystem: Boolean(isSystem),
        status: 'ACTIVE',
        notes: notes || null,
      },
      include: {
        group: true,
      },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'Accountant',
      action: 'ACCOUNT_MASTER_CREATE',
      serviceCode: 'accounts_banking',
      moduleCode: 'chart_of_accounts',
      details: `Created Ledger Account ${account.accountName} (${account.accountCode}) under group ${group.groupName}.`,
    });

    return account;
  },

  async updateAccount(companyId, accountId, data, actor = {}) {
    const existing = await prisma.accountMaster.findFirst({
      where: { id: accountId, companyId },
      include: { group: true },
    });
    if (!existing) {
      throw coaError(`Account not found with id ${accountId}.`, 404);
    }

    const {
      accountName,
      accountCode,
      groupId,
      normalBalance,
      controlType,
      status,
      notes,
    } = data;

    if (existing.isSystem && controlType !== undefined && controlType !== existing.controlType) {
      throw coaError('Cannot modify controlType of a system-defined control account.');
    }

    if (accountCode && accountCode !== existing.accountCode) {
      const duplicate = await prisma.accountMaster.findFirst({
        where: { companyId, accountCode: accountCode.trim().toUpperCase(), id: { not: accountId } },
      });
      if (duplicate) {
        throw coaError(`Account code '${accountCode}' is already in use.`);
      }
    }

    if (groupId && groupId !== existing.groupId) {
      const group = await prisma.accountGroup.findFirst({
        where: { id: groupId, companyId },
      });
      if (!group) throw coaError(`Target group not found with id ${groupId}.`, 404);
    }

    const updated = await prisma.accountMaster.update({
      where: { id: accountId },
      data: {
        accountName: accountName !== undefined ? accountName.trim() : existing.accountName,
        accountCode: accountCode !== undefined ? accountCode.trim().toUpperCase() : existing.accountCode,
        groupId: groupId !== undefined ? groupId : existing.groupId,
        normalBalance: normalBalance !== undefined ? normalBalance.toUpperCase() : existing.normalBalance,
        controlType: controlType !== undefined ? (controlType ? controlType.toUpperCase() : null) : existing.controlType,
        isControlAccount: controlType ? true : existing.isControlAccount,
        status: status !== undefined ? status : existing.status,
        notes: notes !== undefined ? notes : existing.notes,
      },
      include: { group: true },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'Accountant',
      action: 'ACCOUNT_MASTER_UPDATE',
      serviceCode: 'accounts_banking',
      moduleCode: 'chart_of_accounts',
      details: `Updated Ledger Account ${updated.accountName} (${updated.accountCode}).`,
    });

    return updated;
  },

  async getAccountById(companyId, accountId) {
    const account = await prisma.accountMaster.findFirst({
      where: { id: accountId, companyId },
      include: {
        group: true,
        bankAccounts: true,
        _count: {
          select: { voucherItems: true },
        },
      },
    });
    if (!account) {
      throw coaError(`Account not found with id ${accountId}.`, 404);
    }
    return account;
  },

  async listAccounts(companyId, filters = {}) {
    const { groupId, category, controlType, status, search } = filters;
    const where = { companyId };

    if (groupId) where.groupId = groupId;
    if (controlType) where.controlType = controlType.toUpperCase();
    if (status) where.status = status;
    if (category) {
      where.group = { category: category.toUpperCase() };
    }
    if (search) {
      where.OR = [
        { accountName: { contains: search } },
        { accountCode: { contains: search } },
      ];
    }

    return prisma.accountMaster.findMany({
      where,
      orderBy: [{ accountCode: 'asc' }],
      include: {
        group: true,
      },
    });
  },

  async toggleAccountStatus(companyId, accountId, actor = {}) {
    const account = await this.getAccountById(companyId, accountId);
    if (account.isSystem) {
      throw coaError('Cannot deactivate a protected system account.');
    }
    const newStatus = account.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = await prisma.accountMaster.update({
      where: { id: accountId },
      data: { status: newStatus },
      include: { group: true },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'Accountant',
      action: 'ACCOUNT_STATUS_TOGGLE',
      serviceCode: 'accounts_banking',
      moduleCode: 'chart_of_accounts',
      details: `Changed status of account ${updated.accountName} to ${newStatus}.`,
    });

    return updated;
  },

  async deleteAccount(companyId, accountId, actor = {}) {
    const account = await this.getAccountById(companyId, accountId);

    if (account.isSystem) {
      throw coaError('Cannot delete a protected system account.');
    }

    // Accounting Safety Rule: Prevent deleting accounts referenced by posted vouchers
    const voucherLinesCount = await prisma.journalVoucherItem.count({
      where: { accountId, companyId },
    });
    if (voucherLinesCount > 0) {
      throw coaError(`Cannot delete account ${account.accountName}: it is referenced by ${voucherLinesCount} voucher lines.`);
    }

    const bankAccountCount = await prisma.bankAccount.count({
      where: { accountId, companyId },
    });
    if (bankAccountCount > 0) {
      throw coaError(`Cannot delete account ${account.accountName}: it is linked to a BankAccount record.`);
    }

    await prisma.accountMaster.delete({
      where: { id: accountId },
    });

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'Accountant',
      action: 'ACCOUNT_MASTER_DELETE',
      serviceCode: 'accounts_banking',
      moduleCode: 'chart_of_accounts',
      details: `Deleted Ledger Account ${account.accountName} (${account.accountCode}).`,
    });

    return { success: true, message: `Account ${account.accountName} deleted successfully.` };
  },
};

export default coaService;


import prisma from '../../config/prisma.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

const STANDARD_ACCOUNTS_MAP = {
  SUNDRY_DEBTORS: {
    accountCode: '1110-DEBTORS',
    accountName: 'Sundry Debtors (Trade Receivables)',
    category: 'ASSET',
    groupName: 'Current Assets',
    normalBalance: 'DEBIT',
    isControlAccount: true,
    controlType: 'SUNDRY_DEBTORS',
  },
  SUNDRY_CREDITORS: {
    accountCode: '2110-CREDITORS',
    accountName: 'Sundry Creditors (Trade Payables)',
    category: 'LIABILITY',
    groupName: 'Current Liabilities',
    normalBalance: 'CREDIT',
    isControlAccount: true,
    controlType: 'SUNDRY_CREDITORS',
  },
  SALES_REVENUE: {
    accountCode: '4110-SALES',
    accountName: 'Sales Revenue',
    category: 'INCOME',
    groupName: 'Direct Income',
    normalBalance: 'CREDIT',
    isControlAccount: false,
    controlType: 'SALES_REVENUE',
  },
  PURCHASE_EXPENSE: {
    accountCode: '5110-PURCHASES',
    accountName: 'Raw Material Purchases',
    category: 'EXPENSE',
    groupName: 'Direct Expenses',
    normalBalance: 'DEBIT',
    isControlAccount: false,
    controlType: 'PURCHASE_EXPENSE',
  },
  OUTPUT_CGST: {
    accountCode: '2210-OUT-CGST',
    accountName: 'Output CGST Payable',
    category: 'LIABILITY',
    groupName: 'Duties & Taxes',
    normalBalance: 'CREDIT',
    isControlAccount: false,
    controlType: 'OUTPUT_CGST',
  },
  OUTPUT_SGST: {
    accountCode: '2220-OUT-SGST',
    accountName: 'Output SGST Payable',
    category: 'LIABILITY',
    groupName: 'Duties & Taxes',
    normalBalance: 'CREDIT',
    isControlAccount: false,
    controlType: 'OUTPUT_SGST',
  },
  OUTPUT_IGST: {
    accountCode: '2230-OUT-IGST',
    accountName: 'Output IGST Payable',
    category: 'LIABILITY',
    groupName: 'Duties & Taxes',
    normalBalance: 'CREDIT',
    isControlAccount: false,
    controlType: 'OUTPUT_IGST',
  },
  INPUT_CGST: {
    accountCode: '1210-INP-CGST',
    accountName: 'Input CGST Credit',
    category: 'ASSET',
    groupName: 'Duties & Taxes (Input)',
    normalBalance: 'DEBIT',
    isControlAccount: false,
    controlType: 'INPUT_CGST',
  },
  INPUT_SGST: {
    accountCode: '1220-INP-SGST',
    accountName: 'Input SGST Credit',
    category: 'ASSET',
    groupName: 'Duties & Taxes (Input)',
    normalBalance: 'DEBIT',
    isControlAccount: false,
    controlType: 'INPUT_SGST',
  },
  INPUT_IGST: {
    accountCode: '1230-INP-IGST',
    accountName: 'Input IGST Credit',
    category: 'ASSET',
    groupName: 'Duties & Taxes (Input)',
    normalBalance: 'DEBIT',
    isControlAccount: false,
    controlType: 'INPUT_IGST',
  },
  CUSTOMER_ADVANCES: {
    accountCode: '2120-CUST-ADV',
    accountName: 'Customer Advances (Liability)',
    category: 'LIABILITY',
    groupName: 'Current Liabilities',
    normalBalance: 'CREDIT',
    isControlAccount: false,
    controlType: 'CUSTOMER_ADVANCES',
  },
  BANK: {
    accountCode: '1120-MAIN-BANK',
    accountName: 'Main Operating Bank Account',
    category: 'ASSET',
    groupName: 'Bank Accounts',
    normalBalance: 'DEBIT',
    isControlAccount: false,
    controlType: 'BANK',
  },
  CASH: {
    accountCode: '1130-PETTY-CASH',
    accountName: 'Petty Cash Account',
    category: 'ASSET',
    groupName: 'Cash-in-hand',
    normalBalance: 'DEBIT',
    isControlAccount: false,
    controlType: 'CASH',
  },
  BANK_CHARGES: {
    accountCode: '5210-BANK-CHG',
    accountName: 'Bank Charges & Commission',
    category: 'EXPENSE',
    groupName: 'Indirect Expenses',
    normalBalance: 'DEBIT',
    isControlAccount: false,
    controlType: 'BANK_CHARGES',
  },
  INTEREST_INCOME: {
    accountCode: '4210-INT-INC',
    accountName: 'Bank Interest Received',
    category: 'INCOME',
    groupName: 'Indirect Income',
    normalBalance: 'CREDIT',
    isControlAccount: false,
    controlType: 'INTEREST_INCOME',
  },
  INTEREST_EXPENSE: {
    accountCode: '5220-INT-EXP',
    accountName: 'Bank Interest Charged',
    category: 'EXPENSE',
    groupName: 'Indirect Expenses',
    normalBalance: 'DEBIT',
    isControlAccount: false,
    controlType: 'INTEREST_EXPENSE',
  },
  SALARY_EXPENSE: {
    accountCode: '5310-SALARY-EXP',
    accountName: 'Salaries & Wages Expense',
    category: 'EXPENSE',
    groupName: 'Indirect Expenses',
    normalBalance: 'DEBIT',
    isControlAccount: false,
    controlType: 'SALARY_EXPENSE',
  },
  EMPLOYER_PF_EXPENSE: {
    accountCode: '5320-EMP-PF-EXP',
    accountName: 'Employer PF Contribution Expense',
    category: 'EXPENSE',
    groupName: 'Indirect Expenses',
    normalBalance: 'DEBIT',
    isControlAccount: false,
    controlType: 'EMPLOYER_PF_EXPENSE',
  },
  EMPLOYER_ESIC_EXPENSE: {
    accountCode: '5330-EMP-ESI-EXP',
    accountName: 'Employer ESIC Contribution Expense',
    category: 'EXPENSE',
    groupName: 'Indirect Expenses',
    normalBalance: 'DEBIT',
    isControlAccount: false,
    controlType: 'EMPLOYER_ESIC_EXPENSE',
  },
  EMPLOYEE_PF_PAYABLE: {
    accountCode: '2310-PF-PAYABLE',
    accountName: 'Provident Fund (PF) Payable',
    category: 'LIABILITY',
    groupName: 'Current Liabilities',
    normalBalance: 'CREDIT',
    isControlAccount: false,
    controlType: 'EMPLOYEE_PF_PAYABLE',
  },
  EMPLOYEE_ESIC_PAYABLE: {
    accountCode: '2320-ESI-PAYABLE',
    accountName: 'ESIC Payable',
    category: 'LIABILITY',
    groupName: 'Current Liabilities',
    normalBalance: 'CREDIT',
    isControlAccount: false,
    controlType: 'EMPLOYEE_ESIC_PAYABLE',
  },
  PROFESSIONAL_TAX_PAYABLE: {
    accountCode: '2330-PT-PAYABLE',
    accountName: 'Professional Tax (PT) Payable',
    category: 'LIABILITY',
    groupName: 'Current Liabilities',
    normalBalance: 'CREDIT',
    isControlAccount: false,
    controlType: 'PROFESSIONAL_TAX_PAYABLE',
  },
  TDS_PAYABLE: {
    accountCode: '2340-TDS-PAYABLE',
    accountName: 'TDS Payable (Salaries)',
    category: 'LIABILITY',
    groupName: 'Current Liabilities',
    normalBalance: 'CREDIT',
    isControlAccount: false,
    controlType: 'TDS_PAYABLE',
  },
  NET_SALARY_PAYABLE: {
    accountCode: '2350-SALARY-PAYABLE',
    accountName: 'Salaries & Wages Payable',
    category: 'LIABILITY',
    groupName: 'Current Liabilities',
    normalBalance: 'CREDIT',
    isControlAccount: false,
    controlType: 'NET_SALARY_PAYABLE',
  },
};

export const standardAccountsService = {
  /**
   * Find or dynamically provision a standard system account for a given company.
   * If an active account already exists with this controlType, it is returned immediately.
   */
  async ensureStandardAccount(companyId, controlTypeKey) {
    const key = controlTypeKey.toUpperCase();
    const config = STANDARD_ACCOUNTS_MAP[key];
    if (!config) {
      throw new Error(`Unknown standard account controlType: ${controlTypeKey}`);
    }

    // 1. Look up existing active account by controlType
    const existing = await prisma.accountMaster.findFirst({
      where: {
        companyId,
        controlType: config.controlType,
        status: 'ACTIVE',
      },
    });
    if (existing) return existing;

    // 2. Look up by accountCode
    const existingByCode = await prisma.accountMaster.findFirst({
      where: {
        companyId,
        accountCode: config.accountCode,
      },
    });
    if (existingByCode) {
      if (existingByCode.controlType !== config.controlType) {
        return prisma.accountMaster.update({
          where: { id: existingByCode.id },
          data: {
            controlType: config.controlType,
            isControlAccount: config.isControlAccount,
            status: 'ACTIVE',
          },
        });
      }
      return existingByCode;
    }

    // 3. Ensure Group exists
    let group = await prisma.accountGroup.findFirst({
      where: {
        companyId,
        groupName: config.groupName,
      },
    });

    if (!group) {
      const groupCode = config.groupName.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
      group = await prisma.accountGroup.create({
        data: {
          companyId,
          groupCode: `${groupCode}-${Date.now().toString().slice(-4)}`,
          groupName: config.groupName,
          category: config.category,
          isSystem: true,
        },
      });
    }

    // 4. Create AccountMaster
    return prisma.accountMaster.create({
      data: {
        companyId,
        groupId: group.id,
        accountCode: config.accountCode,
        accountName: config.accountName,
        normalBalance: config.normalBalance,
        openingDebit: new Decimal(0),
        openingCredit: new Decimal(0),
        currentBalance: new Decimal(0),
        isControlAccount: config.isControlAccount,
        controlType: config.controlType,
        isSystem: true,
        status: 'ACTIVE',
      },
    });
  },
};

export default standardAccountsService;

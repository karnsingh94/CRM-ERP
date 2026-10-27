import prisma from '../config/prisma.js';
import customerService from './crm/customer.service.js';
import contactService from './crm/contact.service.js';
import opportunityService from './crm/opportunity.service.js';
import productService from './crm/product.service.js';
import quotationService from './sales/quotation.service.js';
import salesOrderService from './sales/sales-order.service.js';
import proformaService from './sales/proforma.service.js';

function coreError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export const crmCoreService = {
  // Customers delegation
  listCustomers: (companyId, options) => customerService.listCustomers(companyId, options),
  createCustomer: (companyId, data) => customerService.createCustomer(companyId, data),
  updateCustomer: (companyId, customerId, data) => customerService.updateCustomer(companyId, customerId, data),
  removeCustomer: (companyId, customerId) => customerService.removeCustomer(companyId, customerId),

  // Contacts delegation
  listContacts: (companyId, options) => contactService.listContacts(companyId, options),
  createContact: (companyId, data) => contactService.createContact(companyId, data),
  updateContact: (companyId, contactId, data) => contactService.updateContact(companyId, contactId, data),
  removeContact: (companyId, contactId) => contactService.removeContact(companyId, contactId),

  // Opportunities delegation
  listOpportunities: (companyId, options) => opportunityService.listOpportunities(companyId, options),
  createOpportunity: (companyId, data) => opportunityService.createOpportunity(companyId, data),
  updateOpportunity: (companyId, opportunityId, data) => opportunityService.updateOpportunity(companyId, opportunityId, data),
  removeOpportunity: (companyId, opportunityId) => opportunityService.removeOpportunity(companyId, opportunityId),

  // Products delegation
  listProducts: (companyId, options) => productService.listProducts(companyId, options),
  createProduct: (companyId, data) => productService.createProduct(companyId, data),
  removeProduct: (companyId, productId) => productService.removeProduct(companyId, productId),

  // Sales Orders delegation
  listSalesOrders: (companyId, options) => salesOrderService.listSalesOrders(companyId, options),
  createSalesOrder: (companyId, data) => salesOrderService.createSalesOrder(companyId, data),
  updateSalesOrderStatus: (companyId, orderId, status, paymentStatus) => salesOrderService.updateSalesOrderStatus(companyId, orderId, status, paymentStatus),
  removeSalesOrder: (companyId, orderId) => salesOrderService.removeSalesOrder(companyId, orderId),

  // Sales Quotations delegation
  listQuotations: (companyId, options) => quotationService.listQuotations(companyId, options),
  createQuotation: (companyId, data) => quotationService.createQuotation(companyId, data),
  updateQuotationStatus: (companyId, quoteId, status) => quotationService.updateQuotationStatus(companyId, quoteId, status),
  convertQuotationToOrder: (companyId, quoteId) => quotationService.convertQuotationToOrder(companyId, quoteId),
  removeQuotation: (companyId, quoteId) => quotationService.removeQuotation(companyId, quoteId),

  // Sales Proforma delegation
  listProformas: (companyId, options) => proformaService.listProformas(companyId, options),
  createProforma: (companyId, data) => proformaService.createProforma(companyId, data),
  updateProformaStatus: (companyId, proformaId, status) => proformaService.updateProformaStatus(companyId, proformaId, status),
  removeProforma: (companyId, proformaId) => proformaService.removeProforma(companyId, proformaId),

  // Preserved ERP Modules (Vendors & Inventory for future activation)
  async listVendors(companyId) {
    return prisma.vendor.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createVendor(companyId, data) {
    if (!data.name?.trim()) {
      throw coreError('Vendor/Supplier name is required.');
    }
    return prisma.vendor.create({
      data: {
        companyId,
        name: data.name.trim(),
        contact: data.contact?.trim() || null,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        category: data.category?.trim() || 'Raw Materials',
        rating: data.rating?.trim() || '5.0 ★',
      },
    });
  },

  async removeVendor(companyId, vendorId) {
    const existing = await prisma.vendor.findFirst({
      where: { id: vendorId, companyId },
    });
    if (!existing) throw coreError('Vendor not found.', 404);
    await prisma.vendor.delete({ where: { id: vendorId } });
    return true;
  },

  async listInventoryStocks(companyId) {
    return prisma.inventoryStock.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createInventoryStock(companyId, data) {
    if (!data.sku?.trim() || !data.name?.trim()) {
      throw coreError('SKU and item name are required.');
    }
    const sku = data.sku.trim().toUpperCase();
    const warehouse = data.warehouse?.trim() || 'Main Warehouse';

    const existing = await prisma.inventoryStock.findFirst({
      where: { companyId, sku, warehouse },
    });
    if (existing) {
      throw coreError(`Item ${sku} already registered in ${warehouse}.`);
    }

    return prisma.inventoryStock.create({
      data: {
        companyId,
        sku,
        name: data.name.trim(),
        warehouse,
        stock: parseInt(data.stock) || 0,
        reorderLevel: parseInt(data.reorderLevel) || 10,
        uom: data.uom?.trim() || 'PCS',
      },
    });
  },

  async adjustInventoryStock(companyId, stockId, qtyDiff) {
    const existing = await prisma.inventoryStock.findFirst({
      where: { id: stockId, companyId },
    });
    if (!existing) throw coreError('Stock item not found.', 404);

    const diff = parseInt(qtyDiff) || 0;
    const newStock = Math.max(0, existing.stock + diff);

    return prisma.inventoryStock.update({
      where: { id: stockId },
      data: { stock: newStock },
    });
  },
};

export default crmCoreService;

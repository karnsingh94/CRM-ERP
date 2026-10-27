import crmCoreService from '../services/crm-core.service.js';
import customerController from './crm/customer.controller.js';
import contactController from './crm/contact.controller.js';
import opportunityController from './crm/opportunity.controller.js';
import productController from './crm/product.controller.js';
import quotationController from './sales/quotation.controller.js';
import salesOrderController from './sales/sales-order.controller.js';
import proformaController from './sales/proforma.controller.js';

function respondError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const crmCoreController = {
  // CRM Customer delegation
  listCustomers: customerController.list,
  createCustomer: customerController.create,
  updateCustomer: customerController.update,
  removeCustomer: customerController.remove,

  // CRM Contact delegation
  listContacts: contactController.list,
  createContact: contactController.create,
  updateContact: contactController.update,
  removeContact: contactController.remove,

  // CRM Opportunity delegation
  listOpportunities: opportunityController.list,
  createOpportunity: opportunityController.create,
  updateOpportunity: opportunityController.update,
  removeOpportunity: opportunityController.remove,

  // Product delegation
  listProducts: productController.list,
  createProduct: productController.create,
  removeProduct: productController.remove,

  // Sales Order delegation
  listSalesOrders: salesOrderController.list,
  createSalesOrder: salesOrderController.create,
  updateSalesOrderStatus: salesOrderController.updateStatus,
  removeSalesOrder: salesOrderController.remove,

  // Sales Quotation delegation
  listQuotations: quotationController.list,
  createQuotation: quotationController.create,
  updateQuotationStatus: quotationController.updateStatus,
  convertQuotationToOrder: quotationController.convertToOrder,
  removeQuotation: quotationController.remove,

  // Sales Proforma delegation
  listProformas: proformaController.list,
  createProforma: proformaController.create,
  updateProformaStatus: proformaController.updateStatus,
  removeProforma: proformaController.remove,

  // Non-CRM ERP modules (Preserved intact for future activation)
  async listVendors(req, res, next) {
    try {
      const data = await crmCoreService.listVendors(String(req.params.companyId));
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
  async createVendor(req, res, next) {
    try {
      const data = await crmCoreService.createVendor(String(req.params.companyId), req.body || {});
      res.status(201).json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
  async removeVendor(req, res, next) {
    try {
      await crmCoreService.removeVendor(String(req.params.companyId), req.params.vendorId);
      res.json({ success: true, message: 'Vendor deleted.' });
    } catch (err) { respondError(err, res, next); }
  },
  async listInventoryStocks(req, res, next) {
    try {
      const data = await crmCoreService.listInventoryStocks(String(req.params.companyId));
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
  async createInventoryStock(req, res, next) {
    try {
      const data = await crmCoreService.createInventoryStock(String(req.params.companyId), req.body || {});
      res.status(201).json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
  async adjustInventoryStock(req, res, next) {
    try {
      const data = await crmCoreService.adjustInventoryStock(
        String(req.params.companyId),
        String(req.params.stockId),
        req.body?.qtyDiff
      );
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
};

export default crmCoreController;

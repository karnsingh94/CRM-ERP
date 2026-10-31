import crmCoreService from '../services/crm-core.service.js';
import customerController from './crm/customer.controller.js';
import contactController from './crm/contact.controller.js';
import opportunityController from './crm/opportunity.controller.js';
import productController from './crm/product.controller.js';
import categoryController from './crm/category.controller.js';
import pricingController from './crm/pricing.controller.js';
import quotationController from './sales/quotation.controller.js';
import salesOrderController from './sales/sales-order.controller.js';
import proformaController from './sales/proforma.controller.js';
import communicationController from './crm/communication.controller.js';
import advanceController from './sales/advance.controller.js';
import reassignmentController from './crm/reassignment.controller.js';

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
  getCustomerTimeline: customerController.getTimeline,

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
  getProduct: productController.get,
  getProductImage: productController.getImage,
  createProduct: productController.create,
  updateProduct: productController.update,
  removeProduct: productController.remove,

  // Category delegation
  listProductCategories: categoryController.list,
  createProductCategory: categoryController.create,
  updateProductCategory: categoryController.update,
  removeProductCategory: categoryController.remove,

  // Pricing delegation
  listProductPricings: pricingController.list,
  createProductPricing: pricingController.create,
  updateProductPricing: pricingController.update,
  removeProductPricing: pricingController.remove,

  // Sales Order delegation
  listSalesOrders: salesOrderController.list,
  createSalesOrder: salesOrderController.create,
  updateSalesOrderStatus: salesOrderController.updateStatus,
  releaseSalesOrder: salesOrderController.release,
  removeSalesOrder: salesOrderController.remove,

  // Sales Quotation delegation
  listQuotations: quotationController.list,
  createQuotation: quotationController.create,
  updateQuotationStatus: quotationController.updateStatus,
  convertQuotationToOrder: quotationController.convertToOrder,
  submitQuotationApproval: quotationController.submitForApproval,
  reviseQuotation: quotationController.revise,
  removeQuotation: quotationController.remove,

  // Sales Proforma delegation
  listProformas: proformaController.list,
  createProforma: proformaController.create,
  updateProformaStatus: proformaController.updateStatus,
  submitProformaApproval: proformaController.submitForApproval,
  reviseProforma: proformaController.revise,
  removeProforma: proformaController.remove,

  // Customer Advance delegation
  listCustomerAdvances: advanceController.list,
  recordCustomerAdvance: advanceController.record,
  verifyCustomerAdvance: advanceController.verify,

  // Communications & Reorder Reminders
  listCommunications: communicationController.list,
  createCommunication: communicationController.create,
  processReorderReminders: communicationController.processReorderReminders,

  // Sales Representative Reassignment
  reassignSalesRepresentative: reassignmentController.reassign,

  // Vendor delegation
  async listVendors(req, res, next) {
    try {
      const data = await crmCoreService.listVendors(String(req.params.companyId), req.query);
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
      res.json({ success: true, message: 'Vendor removed.' });
    } catch (err) { respondError(err, res, next); }
  },

  // Inventory Stocks delegation
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
        req.params.stockId,
        req.body?.qtyDiff
      );
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
};

export default crmCoreController;

import crmCoreService from '../services/crm-core.service.js';

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
  // Customers
  async listCustomers(req, res, next) {
    try {
      const data = await crmCoreService.listCustomers(String(req.params.companyId));
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
  async createCustomer(req, res, next) {
    try {
      const data = await crmCoreService.createCustomer(String(req.params.companyId), req.body || {});
      res.status(201).json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
  async removeCustomer(req, res, next) {
    try {
      await crmCoreService.removeCustomer(String(req.params.companyId), req.params.customerId);
      res.json({ success: true, message: 'Customer deleted.' });
    } catch (err) { respondError(err, res, next); }
  },

  // Contacts
  async listContacts(req, res, next) {
    try {
      const data = await crmCoreService.listContacts(String(req.params.companyId));
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
  async createContact(req, res, next) {
    try {
      const data = await crmCoreService.createContact(String(req.params.companyId), req.body || {});
      res.status(201).json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
  async removeContact(req, res, next) {
    try {
      await crmCoreService.removeContact(String(req.params.companyId), req.params.contactId);
      res.json({ success: true, message: 'Contact deleted.' });
    } catch (err) { respondError(err, res, next); }
  },

  // Opportunities
  async listOpportunities(req, res, next) {
    try {
      const data = await crmCoreService.listOpportunities(String(req.params.companyId));
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
  async createOpportunity(req, res, next) {
    try {
      const data = await crmCoreService.createOpportunity(String(req.params.companyId), req.body || {});
      res.status(201).json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
  async updateOpportunity(req, res, next) {
    try {
      const data = await crmCoreService.updateOpportunity(String(req.params.companyId), req.params.opportunityId, req.body || {});
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
  async removeOpportunity(req, res, next) {
    try {
      await crmCoreService.removeOpportunity(String(req.params.companyId), req.params.opportunityId);
      res.json({ success: true, message: 'Opportunity deleted.' });
    } catch (err) { respondError(err, res, next); }
  },

  // Products
  async listProducts(req, res, next) {
    try {
      const data = await crmCoreService.listProducts(String(req.params.companyId));
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
  async createProduct(req, res, next) {
    try {
      const data = await crmCoreService.createProduct(String(req.params.companyId), req.body || {});
      res.status(201).json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
  async removeProduct(req, res, next) {
    try {
      await crmCoreService.removeProduct(String(req.params.companyId), req.params.productId);
      res.json({ success: true, message: 'Product deleted.' });
    } catch (err) { respondError(err, res, next); }
  },

  // Sales Orders
  async listSalesOrders(req, res, next) {
    try {
      const data = await crmCoreService.listSalesOrders(String(req.params.companyId));
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
  async createSalesOrder(req, res, next) {
    try {
      const data = await crmCoreService.createSalesOrder(String(req.params.companyId), req.body || {});
      res.status(201).json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
  async updateSalesOrderStatus(req, res, next) {
    try {
      const data = await crmCoreService.updateSalesOrderStatus(String(req.params.companyId), req.params.orderId, req.body?.status);
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
  async removeSalesOrder(req, res, next) {
    try {
      await crmCoreService.removeSalesOrder(String(req.params.companyId), req.params.orderId);
      res.json({ success: true, message: 'Sales order deleted.' });
    } catch (err) { respondError(err, res, next); }
  },

  // Quotations
  async listQuotations(req, res, next) {
    try {
      const data = await crmCoreService.listQuotations(String(req.params.companyId));
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
  async createQuotation(req, res, next) {
    try {
      const data = await crmCoreService.createQuotation(String(req.params.companyId), req.body || {});
      res.status(201).json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
  async removeQuotation(req, res, next) {
    try {
      await crmCoreService.removeQuotation(String(req.params.companyId), req.params.quoteId);
      res.json({ success: true, message: 'Quotation deleted.' });
    } catch (err) { respondError(err, res, next); }
  },

  // Proforma
  async listProformas(req, res, next) {
    try {
      const data = await crmCoreService.listProformas(String(req.params.companyId));
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
  async createProforma(req, res, next) {
    try {
      const data = await crmCoreService.createProforma(String(req.params.companyId), req.body || {});
      res.status(201).json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
  async removeProforma(req, res, next) {
    try {
      await crmCoreService.removeProforma(String(req.params.companyId), req.params.proformaId);
      res.json({ success: true, message: 'Proforma deleted.' });
    } catch (err) { respondError(err, res, next); }
  },

  // Vendors
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

  // Inventory Stocks
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
      const data = await crmCoreService.adjustInventoryStock(String(req.params.companyId), req.params.stockId, req.body?.qtyDiff);
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
};

export default crmCoreController;

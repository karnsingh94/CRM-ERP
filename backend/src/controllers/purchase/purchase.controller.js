import purchaseService from '../../services/purchase/purchase.service.js';

function handle(error, res, next) {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  return next(error);
}

export const purchaseController = {
  async dashboard(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.dashboard(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async listVendors(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.listVendors(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async createVendor(req, res, next) {
    try { res.status(201).json({ success: true, data: await purchaseService.createVendor(String(req.params.companyId), req.body || {}) }); }
    catch (error) { handle(error, res, next); }
  },
  async listRequests(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.listRequests(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async listInventoryShortages(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.listInventoryShortages(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async createRequestFromInventoryShortage(req, res, next) {
    try { res.status(201).json({ success: true, data: await purchaseService.createRequestFromInventoryShortage(String(req.params.companyId), String(req.params.procurementId), req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async createRequest(req, res, next) {
    try { res.status(201).json({ success: true, data: await purchaseService.createRequest(String(req.params.companyId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async listQuotations(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.listQuotations(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async createQuotation(req, res, next) {
    try { res.status(201).json({ success: true, data: await purchaseService.createQuotation(String(req.params.companyId), req.body || {}) }); }
    catch (error) { handle(error, res, next); }
  },
  async selectQuotation(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.selectQuotation(String(req.params.companyId), String(req.params.quotationId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async listOrders(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.listOrders(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async createOrder(req, res, next) {
    try { res.status(201).json({ success: true, data: await purchaseService.createOrder(String(req.params.companyId), String(req.params.quotationId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async listWarehouses(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.listWarehouses(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async listReceipts(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.listReceipts(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async createReceipt(req, res, next) {
    try { res.status(201).json({ success: true, data: await purchaseService.createReceipt(String(req.params.companyId), String(req.params.orderId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async listReturns(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.listReturns(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async dispatchReturn(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.dispatchReturn(String(req.params.companyId), String(req.params.returnId), req.body || {}) }); }
    catch (error) { handle(error, res, next); }
  },
  async listBills(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.listBills(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async createBill(req, res, next) {
    try { res.status(201).json({ success: true, data: await purchaseService.createBill(String(req.params.companyId), String(req.params.orderId), req.body || {}) }); }
    catch (error) { handle(error, res, next); }
  },
  async markBillPaid(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.markBillPaid(String(req.params.companyId), String(req.params.billId), req.body || {}) }); }
    catch (error) { handle(error, res, next); }
  },
};

export default purchaseController;

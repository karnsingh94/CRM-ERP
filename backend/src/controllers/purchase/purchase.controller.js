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

  // 1. Vendors
  async listVendors(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.listVendors(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async getVendor(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.getVendor(String(req.params.companyId), String(req.params.vendorId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async createVendor(req, res, next) {
    try { res.status(201).json({ success: true, data: await purchaseService.createVendor(String(req.params.companyId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async approveVendor(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.approveVendor(String(req.params.companyId), String(req.params.vendorId), req.user) }); }
    catch (error) { handle(error, res, next); }
  },

  // 2. Purchase Requests
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
  async approveRequest(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.approveRequest(String(req.params.companyId), String(req.params.requestId), req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async rejectRequest(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.rejectRequest(String(req.params.companyId), String(req.params.requestId), req.body?.reason, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async reviseRequest(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.reviseRequest(String(req.params.companyId), String(req.params.requestId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },

  // 3. RFQ & Quotations
  async listQuotations(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.listQuotations(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async createQuotation(req, res, next) {
    try { res.status(201).json({ success: true, data: await purchaseService.createQuotation(String(req.params.companyId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async compareQuotations(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.compareQuotations(String(req.params.companyId), String(req.params.requestId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async requestQuoteException(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.requestQuoteException(String(req.params.companyId), String(req.params.requestId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async selectQuotation(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.selectQuotation(String(req.params.companyId), String(req.params.quotationId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },

  // 4. Purchase Orders
  async listOrders(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.listOrders(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async getOrder(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.getOrder(String(req.params.companyId), String(req.params.orderId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async createOrder(req, res, next) {
    try { res.status(201).json({ success: true, data: await purchaseService.createOrder(String(req.params.companyId), String(req.params.quotationId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async submitOrderApproval(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.submitOrderApproval(String(req.params.companyId), String(req.params.orderId), req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async approveOrder(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.approveOrder(String(req.params.companyId), String(req.params.orderId), req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async reviseOrder(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.reviseOrder(String(req.params.companyId), String(req.params.orderId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },

  // 5. Artwork Proofs (Dual Approval)
  async listArtworkProofs(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.listArtworkProofs(String(req.params.companyId), req.query?.orderId) }); }
    catch (error) { handle(error, res, next); }
  },
  async createArtworkProof(req, res, next) {
    try { res.status(201).json({ success: true, data: await purchaseService.createArtworkProof(String(req.params.companyId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async reviewArtworkDesign(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.reviewArtworkDesign(String(req.params.companyId), String(req.params.proofId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async reviewArtworkCommercial(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.reviewArtworkCommercial(String(req.params.companyId), String(req.params.proofId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },

  // 6. Goods Receipts (GRN)
  async listReceipts(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.listReceipts(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async createReceipt(req, res, next) {
    try { res.status(201).json({ success: true, data: await purchaseService.createReceipt(String(req.params.companyId), String(req.params.orderId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },

  // 7. Deviations
  async listDeviations(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.listDeviations(String(req.params.companyId), req.query || {}) }); }
    catch (error) { handle(error, res, next); }
  },
  async resolveDeviation(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.resolveDeviation(String(req.params.companyId), String(req.params.deviationId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },

  // 8. Purchase Returns
  async listReturns(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.listReturns(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async dispatchReturn(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.dispatchReturn(String(req.params.companyId), String(req.params.returnId), req.body || {}) }); }
    catch (error) { handle(error, res, next); }
  },

  // 9. Bills & Payment Hold
  async listBills(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.listBills(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async createBill(req, res, next) {
    try { res.status(201).json({ success: true, data: await purchaseService.createBill(String(req.params.companyId), String(req.params.orderId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async releasePaymentHold(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.releasePaymentHold(String(req.params.companyId), String(req.params.billId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async markBillPaid(req, res, next) {
    try { res.json({ success: true, data: await purchaseService.markBillPaid(String(req.params.companyId), String(req.params.billId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
};

export default purchaseController;

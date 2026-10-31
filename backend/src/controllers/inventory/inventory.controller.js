import inventoryService from '../../services/inventory/inventory.service.js';

function handle(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  return next(error);
}

export const inventoryController = {
  // 1. Dashboard
  async dashboard(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.dashboard(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },

  // 2. Stocks & Buckets
  async listStocks(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.listStocks(String(req.params.companyId), req.query) }); }
    catch (error) { handle(error, res, next); }
  },
  async listProducts(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.listProducts(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async createStock(req, res, next) {
    try { res.status(201).json({ success: true, data: await inventoryService.createStock(String(req.params.companyId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async transferBucket(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.transferBucket(String(req.params.companyId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async adjustStock(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.adjustStock(String(req.params.companyId), String(req.params.stockId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async updateStockLocation(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.updateStockLocation(String(req.params.companyId), String(req.params.stockId), req.body || {}) }); }
    catch (error) { handle(error, res, next); }
  },

  // 3. Batches & FIFO Allocation
  async listBatches(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.listBatches(String(req.params.companyId), req.query) }); }
    catch (error) { handle(error, res, next); }
  },
  async createBatch(req, res, next) {
    try { res.status(201).json({ success: true, data: await inventoryService.createBatch(String(req.params.companyId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async getBatch(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.getBatch(String(req.params.companyId), String(req.params.batchId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async allocateFIFO(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.allocateFIFO(String(req.params.companyId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },

  // 4. Stock Reservations
  async listReservations(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.listReservations(String(req.params.companyId), req.query) }); }
    catch (error) { handle(error, res, next); }
  },
  async createReservation(req, res, next) {
    try { res.status(201).json({ success: true, data: await inventoryService.createReservation(String(req.params.companyId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async releaseReservation(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.releaseReservation(String(req.params.companyId), String(req.params.reservationId), req.user, req.body?.reason) }); }
    catch (error) { handle(error, res, next); }
  },
  async cancelReservation(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.cancelReservation(String(req.params.companyId), String(req.params.reservationId), req.user, req.body?.reason) }); }
    catch (error) { handle(error, res, next); }
  },

  // 5. Sampling Management
  async listSamplings(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.listSamplings(String(req.params.companyId), req.query) }); }
    catch (error) { handle(error, res, next); }
  },
  async createSampling(req, res, next) {
    try { res.status(201).json({ success: true, data: await inventoryService.createSampling(String(req.params.companyId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async approveWaivedSampling(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.approveWaivedSampling(String(req.params.companyId), String(req.params.samplingId), req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async returnSampling(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.returnSampling(String(req.params.companyId), String(req.params.samplingId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },

  // 6. Gate Pass
  async listGatePasses(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.listGatePasses(String(req.params.companyId), req.query) }); }
    catch (error) { handle(error, res, next); }
  },
  async createGatePass(req, res, next) {
    try { res.status(201).json({ success: true, data: await inventoryService.createGatePass(String(req.params.companyId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async dispatchGatePass(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.dispatchGatePass(String(req.params.companyId), String(req.params.gatePassId), req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async returnGatePass(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.returnGatePass(String(req.params.companyId), String(req.params.gatePassId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },

  // 7. Physical Stock Verification
  async listVerificationSessions(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.listVerificationSessions(String(req.params.companyId), req.query) }); }
    catch (error) { handle(error, res, next); }
  },
  async createVerificationSession(req, res, next) {
    try { res.status(201).json({ success: true, data: await inventoryService.createVerificationSession(String(req.params.companyId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async getVerificationSession(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.getVerificationSession(String(req.params.companyId), String(req.params.sessionId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async submitPhysicalCounts(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.submitPhysicalCounts(String(req.params.companyId), String(req.params.sessionId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async approveVerificationSession(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.approveVerificationSession(String(req.params.companyId), String(req.params.sessionId), req.user) }); }
    catch (error) { handle(error, res, next); }
  },

  // 8. Stock Adjustments & Approvals
  async listAdjustments(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.listAdjustments(String(req.params.companyId), req.query) }); }
    catch (error) { handle(error, res, next); }
  },
  async createAdjustment(req, res, next) {
    try { res.status(201).json({ success: true, data: await inventoryService.createAdjustment(String(req.params.companyId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async approveAdjustment(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.approveAdjustment(String(req.params.companyId), String(req.params.adjustmentId), req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async rejectAdjustment(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.rejectAdjustment(String(req.params.companyId), String(req.params.adjustmentId), req.user, req.body?.reason) }); }
    catch (error) { handle(error, res, next); }
  },

  // 9. Movements Ledger
  async listMovements(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.listMovements(String(req.params.companyId), req.query) }); }
    catch (error) { handle(error, res, next); }
  },

  // 10. Warehouses & Transfers (Preserved)
  async listWarehouses(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.listWarehouses(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async createWarehouse(req, res, next) {
    try { res.status(201).json({ success: true, data: await inventoryService.createWarehouse(String(req.params.companyId), req.body || {}) }); }
    catch (error) { handle(error, res, next); }
  },
  async createBin(req, res, next) {
    try { res.status(201).json({ success: true, data: await inventoryService.createBin(String(req.params.companyId), String(req.params.warehouseId), req.body || {}) }); }
    catch (error) { handle(error, res, next); }
  },
  async listTransfers(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.listTransfers(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async createTransfer(req, res, next) {
    try { res.status(201).json({ success: true, data: await inventoryService.createTransfer(String(req.params.companyId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async receiveTransfer(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.receiveTransfer(String(req.params.companyId), String(req.params.transferId), req.user) }); }
    catch (error) { handle(error, res, next); }
  },

  // 11. Preserved Manufacturing & Procurement Links
  async listSalesOrders(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.listSalesOrders(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async processSalesOrder(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.processSalesOrder(String(req.params.companyId), String(req.params.salesOrderId), req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async listMaterialRequests(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.listMaterialRequests(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async submitMaterialList(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.submitMaterialList(String(req.params.companyId), String(req.params.requestId), req.body || {}) }); }
    catch (error) { handle(error, res, next); }
  },
  async issueMaterials(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.issueMaterials(String(req.params.companyId), String(req.params.requestId), req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async listProcurements(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.listProcurements(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
  async receivePurchase(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.receivePurchase(String(req.params.companyId), String(req.params.procurementId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async receiveProduction(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.receiveProduction(String(req.params.companyId), String(req.params.requestId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
};

export default inventoryController;

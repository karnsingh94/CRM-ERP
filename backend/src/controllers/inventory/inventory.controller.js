import inventoryService from '../../services/inventory/inventory.service.js';

function handle(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  return next(error);
}

export const inventoryController = {
  async dashboard(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.dashboard(String(req.params.companyId)) }); }
    catch (error) { handle(error, res, next); }
  },
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
  async adjustStock(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.adjustStock(String(req.params.companyId), String(req.params.stockId), req.body || {}, req.user) }); }
    catch (error) { handle(error, res, next); }
  },
  async updateStockLocation(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.updateStockLocation(String(req.params.companyId), String(req.params.stockId), req.body || {}) }); }
    catch (error) { handle(error, res, next); }
  },
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
  async listMovements(req, res, next) {
    try { res.json({ success: true, data: await inventoryService.listMovements(String(req.params.companyId), req.query) }); }
    catch (error) { handle(error, res, next); }
  },
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

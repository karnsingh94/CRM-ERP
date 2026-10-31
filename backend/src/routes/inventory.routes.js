import { Router } from 'express';
import inventoryController from '../controllers/inventory/inventory.controller.js';
import { requireCompanyUser, validateCompanyAccess, validateSubModuleAccess } from '../middlewares/auth.middleware.js';

const router = Router();

router.use('/companies/:companyId/inventory', requireCompanyUser, validateCompanyAccess);

const stockAccess = validateSubModuleAccess('stock_current');
const warehouseAccess = validateSubModuleAccess('bin_locations');

// 1. Dashboard
router.get('/companies/:companyId/inventory/dashboard', stockAccess, inventoryController.dashboard);

// 2. Stocks & Buckets
router.get('/companies/:companyId/inventory/stocks', stockAccess, inventoryController.listStocks);
router.get('/companies/:companyId/inventory/products', stockAccess, inventoryController.listProducts);
router.post('/companies/:companyId/inventory/stocks', stockAccess, inventoryController.createStock);
router.post('/companies/:companyId/inventory/stocks/transfer-bucket', stockAccess, inventoryController.transferBucket);
router.patch('/companies/:companyId/inventory/stocks/:stockId/adjust', stockAccess, inventoryController.adjustStock);
router.patch('/companies/:companyId/inventory/stocks/:stockId/location', warehouseAccess, inventoryController.updateStockLocation);

// 3. Batches & FIFO Allocation
router.get('/companies/:companyId/inventory/batches', stockAccess, inventoryController.listBatches);
router.post('/companies/:companyId/inventory/batches', stockAccess, inventoryController.createBatch);
router.get('/companies/:companyId/inventory/batches/:batchId', stockAccess, inventoryController.getBatch);
router.post('/companies/:companyId/inventory/batches/allocate-fifo', stockAccess, inventoryController.allocateFIFO);

// 4. Stock Reservations
router.get('/companies/:companyId/inventory/reservations', stockAccess, inventoryController.listReservations);
router.post('/companies/:companyId/inventory/reservations', stockAccess, inventoryController.createReservation);
router.post('/companies/:companyId/inventory/reservations/:reservationId/release', stockAccess, inventoryController.releaseReservation);
router.post('/companies/:companyId/inventory/reservations/:reservationId/cancel', stockAccess, inventoryController.cancelReservation);

// 5. Sampling Management
router.get('/companies/:companyId/inventory/samplings', stockAccess, inventoryController.listSamplings);
router.post('/companies/:companyId/inventory/samplings', stockAccess, inventoryController.createSampling);
router.post('/companies/:companyId/inventory/samplings/:samplingId/approve-waived', stockAccess, inventoryController.approveWaivedSampling);
router.post('/companies/:companyId/inventory/samplings/:samplingId/return', stockAccess, inventoryController.returnSampling);

// 6. Gate Pass
router.get('/companies/:companyId/inventory/gate-passes', stockAccess, inventoryController.listGatePasses);
router.post('/companies/:companyId/inventory/gate-passes', stockAccess, inventoryController.createGatePass);
router.post('/companies/:companyId/inventory/gate-passes/:gatePassId/dispatch', stockAccess, inventoryController.dispatchGatePass);
router.post('/companies/:companyId/inventory/gate-passes/:gatePassId/return', stockAccess, inventoryController.returnGatePass);

// 7. Physical Stock Verification
router.get('/companies/:companyId/inventory/verifications', stockAccess, inventoryController.listVerificationSessions);
router.post('/companies/:companyId/inventory/verifications', stockAccess, inventoryController.createVerificationSession);
router.get('/companies/:companyId/inventory/verifications/:sessionId', stockAccess, inventoryController.getVerificationSession);
router.post('/companies/:companyId/inventory/verifications/:sessionId/submit-counts', stockAccess, inventoryController.submitPhysicalCounts);
router.post('/companies/:companyId/inventory/verifications/:sessionId/approve', stockAccess, inventoryController.approveVerificationSession);

// 8. Stock Adjustments & Approvals
router.get('/companies/:companyId/inventory/adjustments', stockAccess, inventoryController.listAdjustments);
router.post('/companies/:companyId/inventory/adjustments', stockAccess, inventoryController.createAdjustment);
router.post('/companies/:companyId/inventory/adjustments/:adjustmentId/approve', stockAccess, inventoryController.approveAdjustment);
router.post('/companies/:companyId/inventory/adjustments/:adjustmentId/reject', stockAccess, inventoryController.rejectAdjustment);

// 9. Movements Ledger
router.get('/companies/:companyId/inventory/movements', stockAccess, inventoryController.listMovements);

// 10. Warehouses & Transfers (Preserved)
router.get('/companies/:companyId/inventory/warehouses', warehouseAccess, inventoryController.listWarehouses);
router.post('/companies/:companyId/inventory/warehouses', warehouseAccess, inventoryController.createWarehouse);
router.post('/companies/:companyId/inventory/warehouses/:warehouseId/bins', warehouseAccess, inventoryController.createBin);
router.get('/companies/:companyId/inventory/transfers', stockAccess, inventoryController.listTransfers);
router.post('/companies/:companyId/inventory/transfers', stockAccess, inventoryController.createTransfer);
router.post('/companies/:companyId/inventory/transfers/:transferId/receive', stockAccess, inventoryController.receiveTransfer);

// 11. Preserved Manufacturing & Procurement Links
router.get('/companies/:companyId/inventory/sales-orders', stockAccess, inventoryController.listSalesOrders);
router.post('/companies/:companyId/inventory/sales-orders/:salesOrderId/process', stockAccess, inventoryController.processSalesOrder);
router.get('/companies/:companyId/inventory/material-requests', stockAccess, inventoryController.listMaterialRequests);
router.put('/companies/:companyId/inventory/material-requests/:requestId/materials', stockAccess, inventoryController.submitMaterialList);
router.post('/companies/:companyId/inventory/material-requests/:requestId/issue', stockAccess, inventoryController.issueMaterials);
router.post('/companies/:companyId/inventory/material-requests/:requestId/production-receipt', stockAccess, inventoryController.receiveProduction);
router.get('/companies/:companyId/inventory/procurements', stockAccess, inventoryController.listProcurements);
router.post('/companies/:companyId/inventory/procurements/:procurementId/receive', stockAccess, inventoryController.receivePurchase);

export default router;

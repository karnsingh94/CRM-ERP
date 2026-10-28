import { Router } from 'express';
import inventoryController from '../controllers/inventory/inventory.controller.js';
import { requireCompanyUser, validateCompanyAccess, validateSubModuleAccess } from '../middlewares/auth.middleware.js';

const router = Router();

router.use('/companies/:companyId/inventory', requireCompanyUser, validateCompanyAccess);

const stockAccess = validateSubModuleAccess('stock_current');
const warehouseAccess = validateSubModuleAccess('bin_locations');

router.get('/companies/:companyId/inventory/dashboard', stockAccess, inventoryController.dashboard);
router.get('/companies/:companyId/inventory/stocks', stockAccess, inventoryController.listStocks);
router.get('/companies/:companyId/inventory/products', stockAccess, inventoryController.listProducts);
router.post('/companies/:companyId/inventory/stocks', stockAccess, inventoryController.createStock);
router.patch('/companies/:companyId/inventory/stocks/:stockId/adjust', stockAccess, inventoryController.adjustStock);
router.patch('/companies/:companyId/inventory/stocks/:stockId/location', warehouseAccess, inventoryController.updateStockLocation);
router.get('/companies/:companyId/inventory/movements', stockAccess, inventoryController.listMovements);

router.get('/companies/:companyId/inventory/warehouses', warehouseAccess, inventoryController.listWarehouses);
router.post('/companies/:companyId/inventory/warehouses', warehouseAccess, inventoryController.createWarehouse);
router.post('/companies/:companyId/inventory/warehouses/:warehouseId/bins', warehouseAccess, inventoryController.createBin);

router.get('/companies/:companyId/inventory/transfers', stockAccess, inventoryController.listTransfers);
router.post('/companies/:companyId/inventory/transfers', stockAccess, inventoryController.createTransfer);
router.post('/companies/:companyId/inventory/transfers/:transferId/receive', stockAccess, inventoryController.receiveTransfer);

router.get('/companies/:companyId/inventory/sales-orders', stockAccess, inventoryController.listSalesOrders);
router.post('/companies/:companyId/inventory/sales-orders/:salesOrderId/process', stockAccess, inventoryController.processSalesOrder);

router.get('/companies/:companyId/inventory/material-requests', stockAccess, inventoryController.listMaterialRequests);
router.put('/companies/:companyId/inventory/material-requests/:requestId/materials', stockAccess, inventoryController.submitMaterialList);
router.post('/companies/:companyId/inventory/material-requests/:requestId/issue', stockAccess, inventoryController.issueMaterials);
router.post('/companies/:companyId/inventory/material-requests/:requestId/production-receipt', stockAccess, inventoryController.receiveProduction);

router.get('/companies/:companyId/inventory/procurements', stockAccess, inventoryController.listProcurements);
router.post('/companies/:companyId/inventory/procurements/:procurementId/receive', stockAccess, inventoryController.receivePurchase);

export default router;

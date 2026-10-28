import { Router } from 'express';
import purchaseController from '../controllers/purchase/purchase.controller.js';
import { requireCompanyUser, validateCompanyAccess, validateSubModuleAccess } from '../middlewares/auth.middleware.js';

const router = Router();

router.use('/companies/:companyId/purchase', requireCompanyUser, validateCompanyAccess);

const vendorAccess = validateSubModuleAccess('vendor_master');
const requestAccess = validateSubModuleAccess('procurement_requests');
const quotationAccess = validateSubModuleAccess('supplier_quotations');
const orderAccess = validateSubModuleAccess('purchase_orders');
const receiptAccess = validateSubModuleAccess('grn_receipts');
const returnAccess = validateSubModuleAccess('grn_deviation');

router.get('/companies/:companyId/purchase/dashboard', orderAccess, purchaseController.dashboard);

router.get('/companies/:companyId/purchase/vendors', vendorAccess, purchaseController.listVendors);
router.post('/companies/:companyId/purchase/vendors', vendorAccess, purchaseController.createVendor);

router.get('/companies/:companyId/purchase/requests', requestAccess, purchaseController.listRequests);
router.post('/companies/:companyId/purchase/requests', requestAccess, purchaseController.createRequest);
router.get('/companies/:companyId/purchase/inventory-shortages', requestAccess, purchaseController.listInventoryShortages);
router.post('/companies/:companyId/purchase/inventory-shortages/:procurementId/request', requestAccess, purchaseController.createRequestFromInventoryShortage);

router.get('/companies/:companyId/purchase/quotations', quotationAccess, purchaseController.listQuotations);
router.post('/companies/:companyId/purchase/quotations', quotationAccess, purchaseController.createQuotation);
router.post('/companies/:companyId/purchase/quotations/:quotationId/select', quotationAccess, purchaseController.selectQuotation);

router.get('/companies/:companyId/purchase/orders', orderAccess, purchaseController.listOrders);
router.post('/companies/:companyId/purchase/quotations/:quotationId/order', orderAccess, purchaseController.createOrder);

router.get('/companies/:companyId/purchase/warehouses', receiptAccess, purchaseController.listWarehouses);
router.get('/companies/:companyId/purchase/receipts', receiptAccess, purchaseController.listReceipts);
router.post('/companies/:companyId/purchase/orders/:orderId/receipts', receiptAccess, purchaseController.createReceipt);

router.get('/companies/:companyId/purchase/returns', returnAccess, purchaseController.listReturns);
router.post('/companies/:companyId/purchase/returns/:returnId/dispatch', returnAccess, purchaseController.dispatchReturn);

router.get('/companies/:companyId/purchase/bills', orderAccess, purchaseController.listBills);
router.post('/companies/:companyId/purchase/orders/:orderId/bills', orderAccess, purchaseController.createBill);
router.post('/companies/:companyId/purchase/bills/:billId/pay', orderAccess, purchaseController.markBillPaid);

export default router;

import { Router } from 'express';
import jobWorkController from '../controllers/contract-manufacturing/jobWork.controller.js';
import { requireCompanyUser, validateCompanyAccess, validateSubModuleAccess } from '../middlewares/auth.middleware.js';

const router = Router();

// Base middleware for all contract manufacturing / job work endpoints
router.use('/companies/:companyId/job-work', requireCompanyUser, validateCompanyAccess);

const jwAccess = validateSubModuleAccess('production_work_orders');

// 1. Dashboard
router.get('/companies/:companyId/job-work/dashboard', jwAccess, jobWorkController.getDashboard);

// 2. Contract Manufacturers Directory
router.get('/companies/:companyId/job-work/manufacturers', jwAccess, jobWorkController.listManufacturers);
router.get('/companies/:companyId/job-work/manufacturers/:vendorId/history', jwAccess, jobWorkController.getManufacturerHistory);

// 3. Job Work Orders CRUD & Approval
router.post('/companies/:companyId/job-work/orders', jwAccess, jobWorkController.createOrder);
router.get('/companies/:companyId/job-work/orders', jwAccess, jobWorkController.listOrders);
router.get('/companies/:companyId/job-work/orders/:orderId', jwAccess, jobWorkController.getOrderById);
router.put('/companies/:companyId/job-work/orders/:orderId', jwAccess, jobWorkController.updateOrder);
router.post('/companies/:companyId/job-work/orders/:orderId/submit-approval', jwAccess, jobWorkController.submitOrderApproval);
router.post('/companies/:companyId/job-work/orders/:orderId/approve', jwAccess, jobWorkController.approveOrder);

// 4. Material Requirements & FIFO Dispatch (Challan)
router.get('/companies/:companyId/job-work/orders/:orderId/material-requirements', jwAccess, jobWorkController.getMaterialRequirements);
router.post('/companies/:companyId/job-work/orders/:orderId/dispatch', jwAccess, jobWorkController.dispatchMaterials);

// 5. Challans & Vendor Acknowledgement
router.get('/companies/:companyId/job-work/challans', jwAccess, jobWorkController.listChallans);
router.get('/companies/:companyId/job-work/challans/:challanId', jwAccess, jobWorkController.getChallanById);
router.post('/companies/:companyId/job-work/challans/:challanId/acknowledge', jwAccess, jobWorkController.acknowledgeChallan);

// 6. External Material Returns
router.post('/companies/:companyId/job-work/orders/:orderId/material-returns', jwAccess, jobWorkController.returnMaterials);
router.get('/companies/:companyId/job-work/orders/:orderId/material-returns', jwAccess, jobWorkController.listMaterialReturns);

// 7. External Production Milestones
router.post('/companies/:companyId/job-work/orders/:orderId/milestones', jwAccess, jobWorkController.addMilestone);
router.get('/companies/:companyId/job-work/orders/:orderId/milestones', jwAccess, jobWorkController.listMilestones);

// 8. Finished Goods Receipts & QC
router.post('/companies/:companyId/job-work/orders/:orderId/receipts', jwAccess, jobWorkController.createReceipt);
router.get('/companies/:companyId/job-work/receipts', jwAccess, jobWorkController.listReceipts);
router.get('/companies/:companyId/job-work/receipts/:receiptId', jwAccess, jobWorkController.getReceiptById);
router.post('/companies/:companyId/job-work/receipts/:receiptId/qc', jwAccess, jobWorkController.inspectReceiptQc);

// 9. External Rework
router.post('/companies/:companyId/job-work/receipts/:receiptId/rework', jwAccess, jobWorkController.createReworkRequest);
router.post('/companies/:companyId/job-work/receipts/:receiptId/rework-receipt', jwAccess, jobWorkController.receiveReworkedGoods);

// 10. Material Reconciliation & Costing Settlement
router.get('/companies/:companyId/job-work/orders/:orderId/reconciliation-preview', jwAccess, jobWorkController.getReconciliationPreview);
router.post('/companies/:companyId/job-work/orders/:orderId/reconciliations', jwAccess, jobWorkController.finalizeReconciliation);
router.get('/companies/:companyId/job-work/reconciliations', jwAccess, jobWorkController.listReconciliations);
router.get('/companies/:companyId/job-work/reconciliations/:reconciliationId', jwAccess, jobWorkController.getReconciliationById);
router.post('/companies/:companyId/job-work/reconciliations/:reconciliationId/settle', jwAccess, jobWorkController.settleJobWork);
router.post('/companies/:companyId/job-work/reconciliations/:reconciliationId/toggle-payment-hold', jwAccess, jobWorkController.togglePaymentHold);

export default router;


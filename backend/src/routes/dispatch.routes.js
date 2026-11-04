import { Router } from 'express';
import dispatchController from '../controllers/dispatch/dispatch.controller.js';
import dispatchTrackingController from '../controllers/dispatch/dispatchTracking.controller.js';
import returnsController from '../controllers/dispatch/returns.controller.js';
import creditNoteController from '../controllers/dispatch/creditNote.controller.js';
import { requireCompanyUser, validateCompanyAccess, validateSubModuleAccess } from '../middlewares/auth.middleware.js';

const router = Router();

// Base middlewares for company validation
router.use('/companies/:companyId/dispatch', requireCompanyUser, validateCompanyAccess);
router.use('/companies/:companyId/returns', requireCompanyUser, validateCompanyAccess);
router.use('/companies/:companyId/credit-notes', requireCompanyUser, validateCompanyAccess);

const dispatchAccess = validateSubModuleAccess('dispatch_planning');
const returnsAccess = validateSubModuleAccess('customer_returns');
const creditNoteAccess = validateSubModuleAccess('credit_debit_notes');

// ============================================================================
// 1. DISPATCH PLANNING & EXECUTION ROUTES (/companies/:companyId/dispatch)
// ============================================================================
router.get('/companies/:companyId/dispatch/dashboard', dispatchAccess, dispatchController.getDashboard);
router.get('/companies/:companyId/dispatch/eligible-orders', dispatchAccess, dispatchController.listEligibleOrders);
router.post('/companies/:companyId/dispatch/orders', dispatchAccess, dispatchController.createDispatchOrder);
router.get('/companies/:companyId/dispatch/orders', dispatchAccess, dispatchController.listDispatchOrders);
router.get('/companies/:companyId/dispatch/orders/:orderId', dispatchAccess, dispatchController.getDispatchOrderById);
router.put('/companies/:companyId/dispatch/orders/:orderId', dispatchAccess, dispatchController.updateDispatchOrder);
router.post('/companies/:companyId/dispatch/orders/:orderId/allocate', dispatchAccess, dispatchController.allocateFIFO);
router.post('/companies/:companyId/dispatch/orders/:orderId/packages', dispatchAccess, dispatchController.createPackage);
router.get('/companies/:companyId/dispatch/orders/:orderId/packing-list', dispatchAccess, dispatchController.getPackingList);
router.get('/companies/:companyId/dispatch/orders/:orderId/delivery-challan', dispatchAccess, dispatchController.getDeliveryChallan);
router.post('/companies/:companyId/dispatch/orders/:orderId/gate-pass', dispatchAccess, dispatchController.generateGatePass);
router.post('/companies/:companyId/dispatch/orders/:orderId/dispatch', dispatchAccess, dispatchController.executeDispatch);
router.post('/companies/:companyId/dispatch/orders/:orderId/cancel', dispatchAccess, dispatchController.cancelDispatchOrder);

// Tracking & POD
router.post('/companies/:companyId/dispatch/orders/:orderId/tracking', dispatchAccess, dispatchTrackingController.addTrackingEvent);
router.get('/companies/:companyId/dispatch/orders/:orderId/tracking', dispatchAccess, dispatchTrackingController.getTrackingHistory);
router.post('/companies/:companyId/dispatch/orders/:orderId/pod', dispatchAccess, dispatchTrackingController.recordPOD);
router.post('/companies/:companyId/dispatch/orders/:orderId/failed', dispatchAccess, dispatchTrackingController.recordFailedDelivery);

// ============================================================================
// 2. CUSTOMER RETURNS / RMA ROUTES (/companies/:companyId/returns)
// ============================================================================
router.get('/companies/:companyId/returns/dashboard', returnsAccess, returnsController.getDashboard);
router.get('/companies/:companyId/returns/eligible-dispatches', returnsAccess, returnsController.listEligibleDispatches);
router.post('/companies/:companyId/returns', returnsAccess, returnsController.createReturnRequest);
router.get('/companies/:companyId/returns', returnsAccess, returnsController.listReturns);
router.get('/companies/:companyId/returns/:returnId', returnsAccess, returnsController.getReturnById);
router.post('/companies/:companyId/returns/:returnId/submit-approval', returnsAccess, returnsController.submitForApproval);
router.post('/companies/:companyId/returns/:returnId/approve', returnsAccess, returnsController.approveReturn);
router.post('/companies/:companyId/returns/:returnId/reject', returnsAccess, returnsController.rejectReturn);
router.post('/companies/:companyId/returns/:returnId/receive', returnsAccess, returnsController.receiveReturnedGoods);
router.post('/companies/:companyId/returns/:returnId/inspect', returnsAccess, returnsController.inspectReturnedGoods);

// ============================================================================
// 3. CUSTOMER CREDIT NOTES ROUTES (/companies/:companyId/credit-notes)
// ============================================================================
router.get('/companies/:companyId/credit-notes/dashboard', creditNoteAccess, creditNoteController.getDashboard);
router.post('/companies/:companyId/credit-notes', creditNoteAccess, creditNoteController.createCreditNote);
router.get('/companies/:companyId/credit-notes', creditNoteAccess, creditNoteController.listCreditNotes);
router.get('/companies/:companyId/credit-notes/:creditNoteId', creditNoteAccess, creditNoteController.getCreditNoteById);
router.post('/companies/:companyId/credit-notes/:creditNoteId/approve', creditNoteAccess, creditNoteController.approveCreditNote);
router.post('/companies/:companyId/credit-notes/:creditNoteId/apply', creditNoteAccess, creditNoteController.applyCreditNote);

export default router;


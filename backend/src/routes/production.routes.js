import { Router } from 'express';
import productionController from '../controllers/production/production.controller.js';
import { requireCompanyUser, validateCompanyAccess, validateSubModuleAccess } from '../middlewares/auth.middleware.js';

const router = Router();

router.use('/companies/:companyId/production', requireCompanyUser, validateCompanyAccess);

const bomAccess = validateSubModuleAccess('bom_master');
const formulaAccess = validateSubModuleAccess('formulation_recipes');
const orderAccess = validateSubModuleAccess('production_work_orders');
const batchAccess = validateSubModuleAccess('production_batching');
const yieldAccess = validateSubModuleAccess('yield_tracking');

// 1. Bill of Materials (BOM) & Formulas
router.post('/companies/:companyId/production/boms', bomAccess, productionController.createBom);
router.get('/companies/:companyId/production/boms', bomAccess, productionController.listBoms);
router.get('/companies/:companyId/production/boms/:bomId', bomAccess, productionController.getBomById);
router.put('/companies/:companyId/production/boms/:bomId', bomAccess, productionController.updateBom);
router.post('/companies/:companyId/production/boms/:bomId/submit-approval', bomAccess, productionController.submitBomApproval);
router.post('/companies/:companyId/production/boms/:bomId/approve', bomAccess, productionController.approveBom);
router.post('/companies/:companyId/production/boms/:bomId/branch-revision', bomAccess, productionController.branchBomRevision);
router.get('/companies/:companyId/production/boms/:bomId/costing', formulaAccess, productionController.simulateBomCosting);

// 2. Production Planning
router.post('/companies/:companyId/production/plans', orderAccess, productionController.createPlan);
router.get('/companies/:companyId/production/plans', orderAccess, productionController.listPlans);
router.get('/companies/:companyId/production/plans/:planId', orderAccess, productionController.getPlanById);

// 3. Production Orders & Material Requirements
router.post('/companies/:companyId/production/orders', orderAccess, productionController.createOrder);
router.get('/companies/:companyId/production/orders', orderAccess, productionController.listOrders);
router.get('/companies/:companyId/production/orders/:orderId', orderAccess, productionController.getOrderById);
router.patch('/companies/:companyId/production/orders/:orderId/status', orderAccess, productionController.updateOrderStatus);
router.get('/companies/:companyId/production/orders/:orderId/material-check', orderAccess, productionController.checkMaterialAvailability);

// 4. Shop Floor Material Issue & Return
router.post('/companies/:companyId/production/orders/:orderId/issue-materials', batchAccess, productionController.issueMaterials);
router.post('/companies/:companyId/production/material-return', batchAccess, productionController.returnUnusedMaterial);

// 5. Manufacturing Batches, Genealogy & Sequential Gates
router.post('/companies/:companyId/production/orders/:orderId/batches', batchAccess, productionController.createBatch);
router.post('/companies/:companyId/production/batches/:batchId/steps/:stepNumber/complete', batchAccess, productionController.completeProcessStep);
router.get('/companies/:companyId/production/batches/:batchId/genealogy', batchAccess, productionController.getBatchGenealogy);
router.get('/companies/:companyId/production/trace-rm/:rmBatchId', batchAccess, productionController.traceRawMaterialForward);

// 6. Daily Production Reports (DPR)
router.post('/companies/:companyId/production/dpr', yieldAccess, productionController.createDpr);
router.get('/companies/:companyId/production/dpr', yieldAccess, productionController.listDprs);

// 7. Manufacturing QC & Finished Goods Receipt
router.post('/companies/:companyId/production/qc-inspections', batchAccess, productionController.createQcInspection);
router.get('/companies/:companyId/production/qc-inspections', batchAccess, productionController.listQcInspections);
router.post('/companies/:companyId/production/batches/:batchId/receive-fg', batchAccess, productionController.receiveFinishedGoods);

// 8. Internal Reprocessing
router.post('/companies/:companyId/production/reprocessings', batchAccess, productionController.createReprocessing);
router.get('/companies/:companyId/production/reprocessings', batchAccess, productionController.listReprocessings);
router.post('/companies/:companyId/production/reprocessings/:reprocessId/qc', batchAccess, productionController.completeReprocessingQc);

export default router;


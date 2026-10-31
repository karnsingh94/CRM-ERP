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

// Dashboard
router.get('/companies/:companyId/purchase/dashboard', orderAccess, purchaseController.dashboard);

// 1. Vendors
router.get('/companies/:companyId/purchase/vendors', vendorAccess, purchaseController.listVendors);
router.post('/companies/:companyId/purchase/vendors', vendorAccess, purchaseController.createVendor);
router.get('/companies/:companyId/purchase/vendors/:vendorId', vendorAccess, purchaseController.getVendor);
router.post('/companies/:companyId/purchase/vendors/:vendorId/approve', vendorAccess, purchaseController.approveVendor);

// 2. Purchase Requests
router.get('/companies/:companyId/purchase/requests', requestAccess, purchaseController.listRequests);
router.post('/companies/:companyId/purchase/requests', requestAccess, purchaseController.createRequest);
router.post('/companies/:companyId/purchase/requests/:requestId/approve', requestAccess, purchaseController.approveRequest);
router.post('/companies/:companyId/purchase/requests/:requestId/reject', requestAccess, purchaseController.rejectRequest);
router.post('/companies/:companyId/purchase/requests/:requestId/revise', requestAccess, purchaseController.reviseRequest);
router.get('/companies/:companyId/purchase/requests/:requestId/comparison', quotationAccess, purchaseController.compareQuotations);
router.post('/companies/:companyId/purchase/requests/:requestId/quote-exception', quotationAccess, purchaseController.requestQuoteException);
router.get('/companies/:companyId/purchase/inventory-shortages', requestAccess, purchaseController.listInventoryShortages);
router.post('/companies/:companyId/purchase/inventory-shortages/:procurementId/request', requestAccess, purchaseController.createRequestFromInventoryShortage);

// 3. RFQ & Quotations
router.get('/companies/:companyId/purchase/quotations', quotationAccess, purchaseController.listQuotations);
router.post('/companies/:companyId/purchase/quotations', quotationAccess, purchaseController.createQuotation);
router.post('/companies/:companyId/purchase/quotations/:quotationId/select', quotationAccess, purchaseController.selectQuotation);

// 4. Purchase Orders
router.get('/companies/:companyId/purchase/orders', orderAccess, purchaseController.listOrders);
router.get('/companies/:companyId/purchase/orders/:orderId', orderAccess, purchaseController.getOrder);
router.post('/companies/:companyId/purchase/quotations/:quotationId/order', orderAccess, purchaseController.createOrder);
router.post('/companies/:companyId/purchase/orders/:orderId/submit-approval', orderAccess, purchaseController.submitOrderApproval);
router.post('/companies/:companyId/purchase/orders/:orderId/approve', orderAccess, purchaseController.approveOrder);
router.post('/companies/:companyId/purchase/orders/:orderId/revise', orderAccess, purchaseController.reviseOrder);

// 5. Artwork Proofs (Dual Approval)
router.get('/companies/:companyId/purchase/artwork-proofs', orderAccess, purchaseController.listArtworkProofs);
router.post('/companies/:companyId/purchase/artwork-proofs', orderAccess, purchaseController.createArtworkProof);
router.post('/companies/:companyId/purchase/artwork-proofs/:proofId/design-review', orderAccess, purchaseController.reviewArtworkDesign);
router.post('/companies/:companyId/purchase/artwork-proofs/:proofId/commercial-review', orderAccess, purchaseController.reviewArtworkCommercial);

// 6. Goods Receipts (GRN)
router.get('/companies/:companyId/purchase/receipts', receiptAccess, purchaseController.listReceipts);
router.post('/companies/:companyId/purchase/orders/:orderId/receipts', receiptAccess, purchaseController.createReceipt);

// 7. Quality Deviations
router.get('/companies/:companyId/purchase/deviations', returnAccess, purchaseController.listDeviations);
router.post('/companies/:companyId/purchase/deviations/:deviationId/resolve', returnAccess, purchaseController.resolveDeviation);

// 8. Returns
router.get('/companies/:companyId/purchase/returns', returnAccess, purchaseController.listReturns);
router.post('/companies/:companyId/purchase/returns/:returnId/dispatch', returnAccess, purchaseController.dispatchReturn);

// 9. Bills & Payment Hold
router.get('/companies/:companyId/purchase/bills', orderAccess, purchaseController.listBills);
router.post('/companies/:companyId/purchase/orders/:orderId/bills', orderAccess, purchaseController.createBill);
router.post('/companies/:companyId/purchase/bills/:billId/release-hold', orderAccess, purchaseController.releasePaymentHold);
router.post('/companies/:companyId/purchase/bills/:billId/pay', orderAccess, purchaseController.markBillPaid);

export default router;

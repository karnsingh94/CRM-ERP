import { Router } from 'express';
import departmentController from '../controllers/department.controller.js';
import crmLeadController from '../controllers/crm-lead.controller.js';
import companyController from '../controllers/company.controller.js';
import workItemController from '../controllers/work-item.controller.js';
import {
  requireCompanyAdmin,
  requireCompanyUser,
  requireServiceTeamPermission,
  requireTeamStructureManager,
  validateCompanyAccess,
  validateSubModuleAccess,
} from '../middlewares/auth.middleware.js';

const router = Router();

import crmCoreController from '../controllers/crm-core.controller.js';
import { handleProductImageUpload } from '../utils/product-image.js';

// Apply tenant validation to all company-scoped routes
router.use('/companies/:companyId', requireCompanyUser, validateCompanyAccess);

// ==================== CRM LEADS ====================
router.get('/companies/:companyId/crm/leads', validateSubModuleAccess('crm_leads'), crmLeadController.list);
router.post('/companies/:companyId/crm/leads', validateSubModuleAccess('crm_leads'), crmLeadController.create);
router.post('/companies/:companyId/crm/leads/check-duplicates', validateSubModuleAccess('crm_leads'), crmLeadController.checkDuplicates);
router.post('/companies/:companyId/crm/leads/:leadId/convert', validateSubModuleAccess('crm_leads'), crmLeadController.convert);
router.patch('/companies/:companyId/crm/leads/:leadId', validateSubModuleAccess('crm_leads'), crmLeadController.update);
router.delete('/companies/:companyId/crm/leads/:leadId', validateSubModuleAccess('crm_leads'), crmLeadController.remove);

// ==================== CRM CUSTOMERS ====================
router.get('/companies/:companyId/crm/customers', validateSubModuleAccess('crm_customers'), crmCoreController.listCustomers);
router.get('/companies/:companyId/crm/customers/:customerId/timeline', validateSubModuleAccess('crm_customers'), crmCoreController.getCustomerTimeline);
router.post('/companies/:companyId/crm/customers', validateSubModuleAccess('crm_customers'), crmCoreController.createCustomer);
router.patch('/companies/:companyId/crm/customers/:customerId', validateSubModuleAccess('crm_customers'), crmCoreController.updateCustomer);
router.delete('/companies/:companyId/crm/customers/:customerId', validateSubModuleAccess('crm_customers'), crmCoreController.removeCustomer);

// ==================== CRM COMMUNICATIONS & REASSIGNMENT ====================
router.get('/companies/:companyId/crm/communications', validateSubModuleAccess('crm_leads'), crmCoreController.listCommunications);
router.post('/companies/:companyId/crm/communications', validateSubModuleAccess('crm_leads'), crmCoreController.createCommunication);
router.post('/companies/:companyId/crm/reorder-reminders/process', crmCoreController.processReorderReminders);
router.post('/companies/:companyId/crm/reassign-portfolio', crmCoreController.reassignSalesRepresentative);

// ==================== CRM CONTACTS ====================
router.get('/companies/:companyId/crm/contacts', validateSubModuleAccess('crm_contacts'), crmCoreController.listContacts);
router.post('/companies/:companyId/crm/contacts', validateSubModuleAccess('crm_contacts'), crmCoreController.createContact);
router.patch('/companies/:companyId/crm/contacts/:contactId', validateSubModuleAccess('crm_contacts'), crmCoreController.updateContact);
router.delete('/companies/:companyId/crm/contacts/:contactId', validateSubModuleAccess('crm_contacts'), crmCoreController.removeContact);

// ==================== CRM OPPORTUNITIES ====================
router.get('/companies/:companyId/crm/opportunities', validateSubModuleAccess('crm_followups'), crmCoreController.listOpportunities);
router.post('/companies/:companyId/crm/opportunities', validateSubModuleAccess('crm_followups'), crmCoreController.createOpportunity);
router.patch('/companies/:companyId/crm/opportunities/:opportunityId', validateSubModuleAccess('crm_followups'), crmCoreController.updateOpportunity);
router.delete('/companies/:companyId/crm/opportunities/:opportunityId', validateSubModuleAccess('crm_followups'), crmCoreController.removeOpportunity);

// ==================== PRODUCT CATEGORIES ====================
router.get('/companies/:companyId/products/categories', validateSubModuleAccess('product_master'), crmCoreController.listProductCategories);
router.post('/companies/:companyId/products/categories', validateSubModuleAccess('product_master'), crmCoreController.createProductCategory);
router.patch('/companies/:companyId/products/categories/:categoryId', validateSubModuleAccess('product_master'), crmCoreController.updateProductCategory);
router.delete('/companies/:companyId/products/categories/:categoryId', validateSubModuleAccess('product_master'), crmCoreController.removeProductCategory);

// ==================== PRODUCT PRICING ====================
router.get('/companies/:companyId/products/pricing', validateSubModuleAccess('price_management'), crmCoreController.listProductPricings);
router.post('/companies/:companyId/products/pricing', validateSubModuleAccess('price_management'), crmCoreController.createProductPricing);
router.patch('/companies/:companyId/products/pricing/:pricingId', validateSubModuleAccess('price_management'), crmCoreController.updateProductPricing);
router.delete('/companies/:companyId/products/pricing/:pricingId', validateSubModuleAccess('price_management'), crmCoreController.removeProductPricing);

// ==================== PRODUCTS ====================
router.get('/companies/:companyId/products', validateSubModuleAccess('product_master'), crmCoreController.listProducts);
router.post('/companies/:companyId/products', validateSubModuleAccess('product_master'), handleProductImageUpload, crmCoreController.createProduct);
router.get('/companies/:companyId/products/:productId', validateSubModuleAccess('product_master'), crmCoreController.getProduct);
router.get('/companies/:companyId/products/:productId/image', crmCoreController.getProductImage);
router.patch('/companies/:companyId/products/:productId', validateSubModuleAccess('product_master'), handleProductImageUpload, crmCoreController.updateProduct);
router.delete('/companies/:companyId/products/:productId', validateSubModuleAccess('product_master'), crmCoreController.removeProduct);

// ==================== SALES ORDERS ====================
router.get('/companies/:companyId/sales/orders', validateSubModuleAccess('sales_orders'), crmCoreController.listSalesOrders);
router.post('/companies/:companyId/sales/orders', validateSubModuleAccess('sales_orders'), crmCoreController.createSalesOrder);
router.patch('/companies/:companyId/sales/orders/:orderId/status', validateSubModuleAccess('sales_orders'), crmCoreController.updateSalesOrderStatus);
router.post('/companies/:companyId/sales/orders/:orderId/release', validateSubModuleAccess('sales_orders'), crmCoreController.releaseSalesOrder);
router.delete('/companies/:companyId/sales/orders/:orderId', validateSubModuleAccess('sales_orders'), crmCoreController.removeSalesOrder);

// ==================== SALES QUOTATIONS ====================
router.get('/companies/:companyId/sales/quotations', validateSubModuleAccess('sales_quotations'), crmCoreController.listQuotations);
router.post('/companies/:companyId/sales/quotations', validateSubModuleAccess('sales_quotations'), crmCoreController.createQuotation);
router.patch('/companies/:companyId/sales/quotations/:quoteId/status', validateSubModuleAccess('sales_quotations'), crmCoreController.updateQuotationStatus);
router.post('/companies/:companyId/sales/quotations/:quoteId/convert-to-order', validateSubModuleAccess('sales_quotations'), crmCoreController.convertQuotationToOrder);
router.post('/companies/:companyId/sales/quotations/:quoteId/submit-approval', validateSubModuleAccess('sales_quotations'), crmCoreController.submitQuotationApproval);
router.post('/companies/:companyId/sales/quotations/:quoteId/revise', validateSubModuleAccess('sales_quotations'), crmCoreController.reviseQuotation);
router.delete('/companies/:companyId/sales/quotations/:quoteId', validateSubModuleAccess('sales_quotations'), crmCoreController.removeQuotation);

// ==================== SALES PROFORMA ====================
router.get('/companies/:companyId/sales/proforma', validateSubModuleAccess('sales_proforma_invoices'), crmCoreController.listProformas);
router.post('/companies/:companyId/sales/proforma', validateSubModuleAccess('sales_proforma_invoices'), crmCoreController.createProforma);
router.patch('/companies/:companyId/sales/proforma/:proformaId/status', validateSubModuleAccess('sales_proforma_invoices'), crmCoreController.updateProformaStatus);
router.post('/companies/:companyId/sales/proforma/:proformaId/submit-approval', validateSubModuleAccess('sales_proforma_invoices'), crmCoreController.submitProformaApproval);
router.post('/companies/:companyId/sales/proforma/:proformaId/revise', validateSubModuleAccess('sales_proforma_invoices'), crmCoreController.reviseProforma);
router.delete('/companies/:companyId/sales/proforma/:proformaId', validateSubModuleAccess('sales_proforma_invoices'), crmCoreController.removeProforma);

// ==================== CUSTOMER ADVANCES ====================
router.get('/companies/:companyId/sales/advances', validateSubModuleAccess('sales_orders'), crmCoreController.listCustomerAdvances);
router.post('/companies/:companyId/sales/advances', validateSubModuleAccess('sales_orders'), crmCoreController.recordCustomerAdvance);
router.post('/companies/:companyId/sales/advances/:advanceId/verify', validateSubModuleAccess('sales_orders'), crmCoreController.verifyCustomerAdvance);

// ==================== VENDORS ====================
router.get('/companies/:companyId/purchase/vendors', validateSubModuleAccess('vendor_directory'), crmCoreController.listVendors);
router.post('/companies/:companyId/purchase/vendors', validateSubModuleAccess('vendor_directory'), crmCoreController.createVendor);
router.delete('/companies/:companyId/purchase/vendors/:vendorId', validateSubModuleAccess('vendor_directory'), crmCoreController.removeVendor);

// ==================== INVENTORY STOCKS ====================
router.get('/companies/:companyId/inventory/stocks', validateSubModuleAccess('stock_levels'), crmCoreController.listInventoryStocks);
router.post('/companies/:companyId/inventory/stocks', validateSubModuleAccess('stock_levels'), crmCoreController.createInventoryStock);
router.patch('/companies/:companyId/inventory/stocks/:stockId/adjust', validateSubModuleAccess('stock_levels'), crmCoreController.adjustInventoryStock);

// ==================== ASSIGNED SERVICES ====================
router.get('/companies/:companyId/assigned-services', requireCompanyAdmin, companyController.getCompanyAssignedServices);

// ==================== EMPLOYEES ====================
router.get('/companies/:companyId/employees', requireServiceTeamPermission('manageMembers'), departmentController.getCompanyEmployees);
router.post('/companies/:companyId/employees', requireServiceTeamPermission('manageMembers'), departmentController.createCompanyEmployee);
router.put('/companies/:companyId/employees/:employeeId/team', requireServiceTeamPermission('manageMembers'), departmentController.assignCompanyEmployee);
router.put('/companies/:companyId/employees/:employeeId/permissions', requireServiceTeamPermission('manageMembers'), departmentController.updateEmployeePermissions);
router.patch('/companies/:companyId/employees/:employeeId/status', requireServiceTeamPermission('manageMembers'), departmentController.toggleCompanyEmployeeStatus);

// ==================== SERVICE TEAMS & DEPARTMENT HEADS ====================
router.get(
  '/companies/:companyId/services/:serviceCode/teams',
  requireServiceTeamPermission(['manageMembers', 'manageTeams', 'assignWork', 'updateWork']),
  departmentController.getServiceTeams
);
router.post(
  '/companies/:companyId/services/:serviceCode/teams',
  requireTeamStructureManager,
  departmentController.createServiceTeam
);
router.put(
  '/companies/:companyId/services/:serviceCode/teams/:teamId',
  requireTeamStructureManager,
  departmentController.updateServiceTeam
);
router.patch(
  '/companies/:companyId/services/:serviceCode/teams/:teamId/status',
  requireTeamStructureManager,
  departmentController.toggleServiceTeamStatus
);
router.get(
  '/companies/:companyId/services/:serviceCode/team',
  requireServiceTeamPermission(['manageMembers', 'manageTeams', 'assignWork', 'updateWork']),
  departmentController.getServiceTeam
);
router.delete(
  '/companies/:companyId/services/:serviceCode/teams/:teamId/employees/:employeeId',
  requireServiceTeamPermission('manageMembers'),
  departmentController.removeServiceTeamEmployee
);
router.put(
  '/companies/:companyId/services/:serviceCode/team/head',
  requireTeamStructureManager,
  departmentController.setServiceTeamHead
);
router.put(
  '/companies/:companyId/services/:serviceCode/team/permissions',
  requireTeamStructureManager,
  departmentController.setServiceTeamPermissions
);

// Department Heads
router.post(
  '/companies/:companyId/services/:serviceCode/department-heads',
  requireCompanyAdmin,
  departmentController.createDepartmentHead
);
router.put(
  '/companies/:companyId/services/:serviceCode/department-heads/:employeeId',
  requireCompanyAdmin,
  departmentController.updateDepartmentHead
);
router.patch(
  '/companies/:companyId/services/:serviceCode/department-heads/:employeeId/status',
  requireCompanyAdmin,
  departmentController.toggleDepartmentHeadStatus
);
router.put(
  '/companies/:companyId/services/:serviceCode/department-heads/:employeeId/permissions',
  requireCompanyAdmin,
  departmentController.updateDepartmentHeadPermissions
);
router.delete(
  '/companies/:companyId/services/:serviceCode/department-heads/:employeeId',
  requireCompanyAdmin,
  departmentController.removeDepartmentHead
);

// ==================== SERVICE WORK ITEMS ====================
router.get('/companies/:companyId/services/:serviceCode/work-items', workItemController.list);
router.post(
  '/companies/:companyId/services/:serviceCode/work-items',
  requireServiceTeamPermission('assignWork'),
  workItemController.create
);
router.patch('/companies/:companyId/work-items/:workItemId', workItemController.update);

export default router;

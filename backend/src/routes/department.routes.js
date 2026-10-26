import { Router } from 'express';
import departmentController from '../controllers/department.controller.js';
import crmLeadController from '../controllers/crm-lead.controller.js';
import companyController from '../controllers/company.controller.js';
import workItemController from '../controllers/work-item.controller.js';
import {
  requireCompanyAdmin,
  requireCompanyUser,
  requireServiceTeamPermission,
  validateCompanyAccess,
  validateSubModuleAccess,
} from '../middlewares/auth.middleware.js';

const router = Router();

import crmCoreController from '../controllers/crm-core.controller.js';

// Apply tenant validation to all company-scoped routes
router.use('/companies/:companyId', requireCompanyUser, validateCompanyAccess);

// ==================== CRM LEADS ====================
router.get('/companies/:companyId/crm/leads', validateSubModuleAccess('crm_leads'), crmLeadController.list);
router.post('/companies/:companyId/crm/leads', validateSubModuleAccess('crm_leads'), crmLeadController.create);
router.patch('/companies/:companyId/crm/leads/:leadId', validateSubModuleAccess('crm_leads'), crmLeadController.update);
router.delete('/companies/:companyId/crm/leads/:leadId', validateSubModuleAccess('crm_leads'), crmLeadController.remove);

// ==================== CRM CUSTOMERS ====================
router.get('/companies/:companyId/crm/customers', validateSubModuleAccess('crm_customers'), crmCoreController.listCustomers);
router.post('/companies/:companyId/crm/customers', validateSubModuleAccess('crm_customers'), crmCoreController.createCustomer);
router.delete('/companies/:companyId/crm/customers/:customerId', validateSubModuleAccess('crm_customers'), crmCoreController.removeCustomer);

// ==================== CRM CONTACTS ====================
router.get('/companies/:companyId/crm/contacts', validateSubModuleAccess('crm_contacts'), crmCoreController.listContacts);
router.post('/companies/:companyId/crm/contacts', validateSubModuleAccess('crm_contacts'), crmCoreController.createContact);
router.delete('/companies/:companyId/crm/contacts/:contactId', validateSubModuleAccess('crm_contacts'), crmCoreController.removeContact);

// ==================== CRM OPPORTUNITIES ====================
router.get('/companies/:companyId/crm/opportunities', validateSubModuleAccess('crm_followups'), crmCoreController.listOpportunities);
router.post('/companies/:companyId/crm/opportunities', validateSubModuleAccess('crm_followups'), crmCoreController.createOpportunity);
router.patch('/companies/:companyId/crm/opportunities/:opportunityId', validateSubModuleAccess('crm_followups'), crmCoreController.updateOpportunity);
router.delete('/companies/:companyId/crm/opportunities/:opportunityId', validateSubModuleAccess('crm_followups'), crmCoreController.removeOpportunity);

// ==================== PRODUCTS ====================
router.get('/companies/:companyId/products', validateSubModuleAccess('product_master'), crmCoreController.listProducts);
router.post('/companies/:companyId/products', validateSubModuleAccess('product_master'), crmCoreController.createProduct);
router.delete('/companies/:companyId/products/:productId', validateSubModuleAccess('product_master'), crmCoreController.removeProduct);

// ==================== SALES ORDERS ====================
router.get('/companies/:companyId/sales/orders', validateSubModuleAccess('sales_orders'), crmCoreController.listSalesOrders);
router.post('/companies/:companyId/sales/orders', validateSubModuleAccess('sales_orders'), crmCoreController.createSalesOrder);
router.patch('/companies/:companyId/sales/orders/:orderId/status', validateSubModuleAccess('sales_orders'), crmCoreController.updateSalesOrderStatus);
router.delete('/companies/:companyId/sales/orders/:orderId', validateSubModuleAccess('sales_orders'), crmCoreController.removeSalesOrder);

// ==================== SALES QUOTATIONS ====================
router.get('/companies/:companyId/sales/quotations', validateSubModuleAccess('sales_quotations'), crmCoreController.listQuotations);
router.post('/companies/:companyId/sales/quotations', validateSubModuleAccess('sales_quotations'), crmCoreController.createQuotation);
router.patch('/companies/:companyId/sales/quotations/:quoteId/status', validateSubModuleAccess('sales_quotations'), crmCoreController.updateQuotationStatus);
router.post('/companies/:companyId/sales/quotations/:quoteId/convert-to-order', validateSubModuleAccess('sales_quotations'), crmCoreController.convertQuotationToOrder);
router.delete('/companies/:companyId/sales/quotations/:quoteId', validateSubModuleAccess('sales_quotations'), crmCoreController.removeQuotation);

// ==================== SALES PROFORMA ====================
router.get('/companies/:companyId/sales/proforma', validateSubModuleAccess('sales_proforma_invoices'), crmCoreController.listProformas);
router.post('/companies/:companyId/sales/proforma', validateSubModuleAccess('sales_proforma_invoices'), crmCoreController.createProforma);
router.patch('/companies/:companyId/sales/proforma/:proformaId/status', validateSubModuleAccess('sales_proforma_invoices'), crmCoreController.updateProformaStatus);
router.delete('/companies/:companyId/sales/proforma/:proformaId', validateSubModuleAccess('sales_proforma_invoices'), crmCoreController.removeProforma);

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
  requireServiceTeamPermission(['manageTeams', 'manageMembers']),
  departmentController.createServiceTeam
);
router.put(
  '/companies/:companyId/services/:serviceCode/teams/:teamId',
  requireServiceTeamPermission(['manageTeams', 'manageMembers']),
  departmentController.updateServiceTeam
);
router.patch(
  '/companies/:companyId/services/:serviceCode/teams/:teamId/status',
  requireServiceTeamPermission(['manageTeams', 'manageMembers']),
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
  requireServiceTeamPermission(['manageTeams', 'manageMembers']),
  departmentController.setServiceTeamHead
);
router.put(
  '/companies/:companyId/services/:serviceCode/team/permissions',
  requireServiceTeamPermission(['manageTeams', 'manageMembers']),
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

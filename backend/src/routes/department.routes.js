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
router.get('/companies/:companyId/products', validateSubModuleAccess('product_list'), crmCoreController.listProducts);
router.post('/companies/:companyId/products', validateSubModuleAccess('product_list'), crmCoreController.createProduct);
router.delete('/companies/:companyId/products/:productId', validateSubModuleAccess('product_list'), crmCoreController.removeProduct);

// ==================== SALES ORDERS ====================
router.get('/companies/:companyId/sales/orders', validateSubModuleAccess('sales_orders'), crmCoreController.listSalesOrders);
router.post('/companies/:companyId/sales/orders', validateSubModuleAccess('sales_orders'), crmCoreController.createSalesOrder);
router.patch('/companies/:companyId/sales/orders/:orderId/status', validateSubModuleAccess('sales_orders'), crmCoreController.updateSalesOrderStatus);
router.delete('/companies/:companyId/sales/orders/:orderId', validateSubModuleAccess('sales_orders'), crmCoreController.removeSalesOrder);

// ==================== SALES QUOTATIONS ====================
router.get('/companies/:companyId/sales/quotations', validateSubModuleAccess('quotations'), crmCoreController.listQuotations);
router.post('/companies/:companyId/sales/quotations', validateSubModuleAccess('quotations'), crmCoreController.createQuotation);
router.delete('/companies/:companyId/sales/quotations/:quoteId', validateSubModuleAccess('quotations'), crmCoreController.removeQuotation);

// ==================== SALES PROFORMA ====================
router.get('/companies/:companyId/sales/proforma', validateSubModuleAccess('proforma_invoices'), crmCoreController.listProformas);
router.post('/companies/:companyId/sales/proforma', validateSubModuleAccess('proforma_invoices'), crmCoreController.createProforma);
router.delete('/companies/:companyId/sales/proforma/:proformaId', validateSubModuleAccess('proforma_invoices'), crmCoreController.removeProforma);

// ==================== VENDORS ====================
router.get('/companies/:companyId/purchase/vendors', validateSubModuleAccess('vendor_list'), crmCoreController.listVendors);
router.post('/companies/:companyId/purchase/vendors', validateSubModuleAccess('vendor_list'), crmCoreController.createVendor);
router.delete('/companies/:companyId/purchase/vendors/:vendorId', validateSubModuleAccess('vendor_list'), crmCoreController.removeVendor);

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

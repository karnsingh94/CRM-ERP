import { Router } from 'express';
import departmentController from '../controllers/department.controller.js';
import companyController from '../controllers/company.controller.js';
import workItemController from '../controllers/work-item.controller.js';
import {
  requireCompanyAdmin,
  requireCompanyUser,
  requireServiceTeamPermission,
  validateCompanyAccess,
} from '../middlewares/auth.middleware.js';

const router = Router();

// Apply tenant validation to all company-scoped routes
router.use('/companies/:companyId', requireCompanyUser, validateCompanyAccess);

// ==================== ASSIGNED SERVICES ====================
router.get('/companies/:companyId/assigned-services', requireCompanyAdmin, companyController.getCompanyAssignedServices);

// ==================== EMPLOYEES ====================
router.get('/companies/:companyId/employees', requireServiceTeamPermission('manageMembers'), departmentController.getCompanyEmployees);
router.post('/companies/:companyId/employees', requireServiceTeamPermission('manageMembers'), departmentController.createCompanyEmployee);
router.put('/companies/:companyId/employees/:employeeId/team', requireServiceTeamPermission('manageMembers'), departmentController.assignCompanyEmployee);

// ==================== SERVICE TEAMS ====================
router.get(
  '/companies/:companyId/services/:serviceCode/teams',
  requireServiceTeamPermission(['manageMembers', 'assignWork', 'updateWork']),
  departmentController.getServiceTeams
);
router.post(
  '/companies/:companyId/services/:serviceCode/teams',
  requireCompanyAdmin,
  departmentController.createServiceTeam
);
router.get(
  '/companies/:companyId/services/:serviceCode/team',
  requireServiceTeamPermission(['manageMembers', 'assignWork', 'updateWork']),
  departmentController.getServiceTeam
);
router.delete(
  '/companies/:companyId/services/:serviceCode/teams/:teamId/employees/:employeeId',
  requireServiceTeamPermission('manageMembers'),
  departmentController.removeServiceTeamEmployee
);
router.put('/companies/:companyId/services/:serviceCode/team/head', requireCompanyAdmin, departmentController.setServiceTeamHead);
router.put('/companies/:companyId/services/:serviceCode/team/permissions', requireCompanyAdmin, departmentController.setServiceTeamPermissions);

// ==================== SERVICE WORK ITEMS ====================
router.get('/companies/:companyId/services/:serviceCode/work-items', workItemController.list);
router.post(
  '/companies/:companyId/services/:serviceCode/work-items',
  requireServiceTeamPermission('assignWork'),
  workItemController.create
);
router.patch('/companies/:companyId/work-items/:workItemId', workItemController.update);

export default router;

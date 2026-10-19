import { Router } from 'express';
import departmentController from '../controllers/department.controller.js';
import companyController from '../controllers/company.controller.js';
import { requireCompanyAdmin, validateCompanyAccess } from '../middlewares/auth.middleware.js';

const router = Router();

// Apply tenant validation to all company-scoped routes
router.use('/companies/:companyId', requireCompanyAdmin, validateCompanyAccess);

// ==================== ASSIGNED SERVICES ====================
router.get('/companies/:companyId/assigned-services', companyController.getCompanyAssignedServices);

// ==================== EMPLOYEES ====================
router.get('/companies/:companyId/employees', departmentController.getCompanyEmployees);
router.post('/companies/:companyId/employees', departmentController.createCompanyEmployee);
router.put('/companies/:companyId/employees/:employeeId/team', departmentController.assignCompanyEmployee);

// ==================== SERVICE TEAMS ====================
router.get('/companies/:companyId/services/:serviceCode/team', departmentController.getServiceTeam);
router.put('/companies/:companyId/services/:serviceCode/team/head', departmentController.setServiceTeamHead);

export default router;

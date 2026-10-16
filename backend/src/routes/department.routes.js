import { Router } from 'express';
import departmentController from '../controllers/department.controller.js';
import companyController from '../controllers/company.controller.js';
import { validateCompanyAccess } from '../middlewares/auth.middleware.js';

const router = Router();

// Apply tenant validation to all company-scoped routes
router.use('/companies/:companyId', validateCompanyAccess);

// ==================== ASSIGNED SERVICES ====================
router.get('/companies/:companyId/assigned-services', companyController.getCompanyAssignedServices);

// ==================== EMPLOYEES ====================
router.get('/companies/:companyId/employees', departmentController.getCompanyEmployees);
router.post('/companies/:companyId/employees', departmentController.createCompanyEmployee);

// ==================== DEPARTMENTS ====================
router.get('/companies/:companyId/departments', departmentController.getAllDepartmentsForCompany);
router.get('/companies/:companyId/services/:serviceCode/departments', departmentController.getDepartmentsByService);
router.post('/companies/:companyId/services/:serviceCode/departments', departmentController.createDepartment);
router.put('/companies/:companyId/departments/:departmentId', departmentController.updateDepartment);
router.delete('/companies/:companyId/departments/:departmentId', departmentController.deleteDepartment);
router.post('/companies/:companyId/departments/:departmentId/employees', departmentController.assignDepartmentEmployees);

export default router;

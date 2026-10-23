import { Router } from 'express';
import companyController from '../controllers/company.controller.js';
import { requireSuperAdmin, validateSubModuleAccess } from '../middlewares/auth.middleware.js';

const router = Router();

// ==================== CLIENTS / TENANTS ====================
router.get('/clients', companyController.getClients);
router.post('/clients', requireSuperAdmin, companyController.createClient);
router.get('/clients/:id', companyController.getClientById);
router.put('/clients/:id', requireSuperAdmin, companyController.updateClient);
router.patch('/clients/:id/status', companyController.toggleClientStatus);
router.delete('/clients/:id', companyController.deleteClient);
router.post('/clients/:id/switch', companyController.switchToClientPanel);

// ==================== PERMISSIONS & ACCESS ====================
router.get('/clients/:id/access', companyController.getClientAccess);
router.put('/clients/:id/access', requireSuperAdmin, companyController.saveClientAccess);

// ==================== SUBMODULE / FEATURE APIS ====================
router.get('/companies/:companyId/crm/customers', validateSubModuleAccess('crm_customers'), (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, name: 'Apex Technologies', contactPerson: 'Rajesh Sharma', status: 'ACTIVE' },
    ],
  });
});

export default router;

import { Router } from 'express';
import companyController from '../controllers/company.controller.js';

const router = Router();

// ==================== CLIENTS / TENANTS ====================
router.get('/clients', companyController.getClients);
router.post('/clients', companyController.createClient);
router.get('/clients/:id', companyController.getClientById);
router.put('/clients/:id', companyController.updateClient);
router.patch('/clients/:id/status', companyController.toggleClientStatus);
router.delete('/clients/:id', companyController.deleteClient);

// ==================== PERMISSIONS & ACCESS ====================
router.get('/clients/:id/access', companyController.getClientAccess);
router.put('/clients/:id/access', companyController.saveClientAccess);

export default router;

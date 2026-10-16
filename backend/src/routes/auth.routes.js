import { Router } from 'express';
import authController from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Super Admin platform login
router.post('/auth/super-admin/login', authController.loginSuperAdmin);

// Common company user login (Company Admin, Department Head, Employee)
router.post('/auth/login', authController.loginCompanyUser);

// Profile inspection (matches /auth/me and /auth/profile)
router.get('/auth/me', authenticate, authController.getMe);
router.get('/auth/profile', authenticate, authController.getMe);

// Session termination
router.post('/auth/logout', authController.logout);

// Password recovery & reset flows
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/verify-reset-token', authController.verifyResetToken);
router.get('/auth/verify-reset-token', authController.verifyResetToken);
router.post('/auth/reset-password', authController.resetPassword);

export default router;


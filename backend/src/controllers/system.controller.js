import prisma from '../config/prisma.js';
import systemService from '../services/system.service.js';

export const systemController = {
  /**
   * Health Check
   */
  getHealth(req, res) {
    res.json({
      status: 'OK',
      message: 'Azzuniqe CRM & ERP Super Admin API is operational',
      timestamp: new Date().toISOString(),
      authIntegration: 'PENDING_SEPARATE_MODULE',
    });
  },

  /**
   * Database status check
   */
  async getDbStatus(req, res) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        database: 'MySQL',
        connected: true,
        message: 'MySQL Prisma database connected successfully!',
      });
    } catch (error) {
      res.status(500).json({
        database: 'MySQL',
        connected: false,
        error: error.message,
        message: 'MySQL connection failed',
      });
    }
  },

  /**
   * Dashboard summary statistics
   */
  async getStats(req, res, next) {
    try {
      const stats = await systemService.getStats();
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Complete active catalog tree for permission configuration
   */
  async getFullCatalog(req, res, next) {
    try {
      const catalog = await systemService.getFullCatalog();
      res.json({ success: true, data: catalog });
    } catch (err) {
      next(err);
    }
  },
};

export default systemController;

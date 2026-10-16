import prisma from '../config/prisma.js';
import { formatService } from '../utils/formatters.js';

/**
 * Service for platform dashboard statistics and global system catalog
 */
export const systemService = {
  /**
   * Platform summary stats
   */
  async getStats() {
    const [
      totalServices,
      activeServices,
      totalModules,
      totalSubModules,
      totalClients,
      activeClients,
      totalAuditLogs,
    ] = await Promise.all([
      prisma.service.count(),
      prisma.service.count({ where: { status: 'ACTIVE' } }),
      prisma.module.count(),
      prisma.subModule.count(),
      prisma.clientAdmin.count({ where: { deletedAt: null } }),
      prisma.clientAdmin.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      prisma.auditLog.count(),
    ]);

    return {
      totalServices,
      activeServices,
      totalModules,
      totalSubModules,
      totalClients,
      activeClients,
      totalAuditLogs,
    };
  },

  /**
   * Full active catalog tree for client permission selector
   */
  async getFullCatalog() {
    const services = await prisma.service.findMany({
      where: { status: 'ACTIVE' },
      include: {
        modules: {
          where: { status: 'ACTIVE' },
          include: {
            subModules: {
              where: { status: 'ACTIVE' },
              orderBy: { orderNo: 'asc' },
            },
          },
          orderBy: { orderNo: 'asc' },
        },
      },
      orderBy: { orderNo: 'asc' },
    });

    return services.map(formatService);
  },
};

export default systemService;

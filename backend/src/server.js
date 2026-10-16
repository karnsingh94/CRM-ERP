import app from './app.js';
import env from './config/env.js';
import prisma from './config/prisma.js';
import logger from './utils/logger.js';

let server = null;

/**
 * Start the HTTP Server with validated configuration
 */
export function startServer() {
  server = app.listen(env.port, () => {
    logger.info(`🚀 Backend server is running on http://localhost:${env.port}`);
    logger.info(`ℹ️  Note: Authentication system is pending separate module integration`);
    logger.info(`⚙️  Environment: ${env.nodeEnv}`);
  });

  server.on('error', (err) => {
    logger.error('Server startup error:', err);
    process.exit(1);
  });

  return server;
}

/**
 * Graceful shutdown handler
 */
export async function gracefulShutdown(signal) {
  logger.info(`[${signal}] Initiating graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await prisma.$disconnect();
        logger.info('Database connections closed safely.');
      } catch (err) {
        logger.error('Error disconnecting Prisma:', err);
      }
      process.exit(0);
    });

    // Force close after 10 seconds if graceful close hangs
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout.');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
}

// Register process listeners
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Uncaught exceptions & unhandled rejections
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

// Auto-start server when executed directly
startServer();

export { app, server };
export default app;

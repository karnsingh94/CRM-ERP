import integrationJobService from '../services/integrationJob.service.js';
import logger from '../utils/logger.js';

let workerInterval = null;
let isProcessing = false;

/**
 * Start the background integration job worker
 */
export function startIntegrationWorker(intervalMs = 5000) {
  if (workerInterval) {
    return;
  }

  logger.info(`Starting Integration Job Background Worker (Polling every ${intervalMs}ms)...`);

  workerInterval = setInterval(async () => {
    if (isProcessing) return; // Prevent concurrent re-entry
    isProcessing = true;

    try {
      // 1. Recover any stuck jobs
      await integrationJobService.recoverStuckJobs();

      // 2. Process pending & due retry jobs
      await integrationJobService.processPendingJobs(10);
    } catch (err) {
      logger.error('Error in Integration Job Background Worker:', err.message);
    } finally {
      isProcessing = false;
    }
  }, intervalMs);
}

/**
 * Stop the background integration job worker
 */
export function stopIntegrationWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    logger.info('Integration Job Background Worker stopped.');
  }
}

export default {
  startIntegrationWorker,
  stopIntegrationWorker,
};


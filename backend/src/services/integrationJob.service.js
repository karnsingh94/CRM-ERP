import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';

export const integrationJobService = {
  /**
   * Enqueue a new integration job with strict idempotency protection
   */
  async enqueueJob({
    companyId,
    jobType,
    sourceSystem,
    destinationSystem,
    idempotencyKey,
    payload = null,
    maxAttempts = 5,
  }) {
    if (!companyId || !jobType || !idempotencyKey) {
      throw new Error('companyId, jobType, and idempotencyKey are required.');
    }

    // Check if a job with this idempotency key already exists
    const existing = await prisma.integrationJob.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      return {
        job: existing,
        isDuplicate: true,
      };
    }

    const job = await prisma.integrationJob.create({
      data: {
        companyId,
        jobType,
        sourceSystem: sourceSystem || 'INTERNAL',
        destinationSystem: destinationSystem || 'EXTERNAL',
        idempotencyKey,
        payload,
        status: 'PENDING',
        attempts: 0,
        maxAttempts: Number(maxAttempts) || 5,
      },
    });

    return {
      job,
      isDuplicate: false,
    };
  },

  /**
   * Process a single job with simulated/real adapters
   */
  async processJob(jobId, customExecutor = null) {
    const job = await prisma.integrationJob.findUnique({
      where: { id: jobId },
    });

    if (!job || ['COMPLETED', 'CANCELLED'].includes(job.status)) {
      return job;
    }

    // Mark as PROCESSING
    await prisma.integrationJob.update({
      where: { id: job.id },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
        attempts: job.attempts + 1,
      },
    });

    try {
      let result = null;
      if (typeof customExecutor === 'function') {
        result = await customExecutor(job);
      } else {
        // Default adapter simulator for Phase 1
        result = {
          processedAt: new Date().toISOString(),
          ack: true,
          details: `Successfully dispatched ${job.jobType} to ${job.destinationSystem}`,
        };
      }

      // Mark COMPLETED
      const completedJob = await prisma.integrationJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result,
          lastError: null,
        },
      });

      return completedJob;
    } catch (err) {
      const nextAttempt = job.attempts + 1;
      const isExhausted = nextAttempt >= job.maxAttempts;

      // Exponential backoff: 5s, 10s, 20s, 40s... max 300s
      const backoffSeconds = Math.min(300, Math.pow(2, nextAttempt) * 5);
      const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000);

      const failedJob = await prisma.integrationJob.update({
        where: { id: job.id },
        data: {
          status: isExhausted ? 'FAILED' : 'RETRY_SCHEDULED',
          lastError: err.message || 'Unknown integration error',
          nextRetryAt: isExhausted ? null : nextRetryAt,
        },
      });

      return failedJob;
    }
  },

  /**
   * Process all pending or due-for-retry jobs
   */
  async processPendingJobs(limit = 10, customExecutor = null) {
    const now = new Date();
    const candidateJobs = await prisma.integrationJob.findMany({
      where: {
        OR: [
          { status: 'PENDING' },
          {
            status: 'RETRY_SCHEDULED',
            nextRetryAt: { lte: now },
          },
        ],
      },
      take: Number(limit),
      orderBy: { createdAt: 'asc' },
    });

    const results = [];
    for (const job of candidateJobs) {
      const res = await this.processJob(job.id, customExecutor);
      results.push(res);
    }

    return results;
  },

  /**
   * Recover stuck jobs in PROCESSING status for more than 5 minutes
   */
  async recoverStuckJobs(stuckThresholdMs = 5 * 60 * 1000) {
    const stuckBefore = new Date(Date.now() - stuckThresholdMs);
    const stuckJobs = await prisma.integrationJob.findMany({
      where: {
        status: 'PROCESSING',
        startedAt: { lte: stuckBefore },
      },
    });

    if (stuckJobs.length === 0) return 0;

    const recovered = await prisma.integrationJob.updateMany({
      where: {
        id: { in: stuckJobs.map(j => j.id) },
      },
      data: {
        status: 'RETRY_SCHEDULED',
        lastError: 'Job was stuck in PROCESSING state and was automatically recovered by the background worker.',
        nextRetryAt: new Date(),
      },
    });

    logger.warn(`Recovered ${recovered.count} stuck integration jobs.`);
    return recovered.count;
  },

  /**
   * List jobs for a company tenant
   */
  async listJobs(companyId, options = {}) {
    const { status, jobType, limit = 50, offset = 0 } = options;
    const where = { companyId };
    if (status && status !== 'ALL') where.status = status;
    if (jobType && jobType !== 'ALL') where.jobType = jobType;

    const [items, total] = await Promise.all([
      prisma.integrationJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.integrationJob.count({ where }),
    ]);

    return { items, total };
  },

  /**
   * Manually retry a failed or cancelled job
   */
  async retryJob(companyId, jobId) {
    const job = await prisma.integrationJob.findFirst({
      where: { id: jobId, companyId },
    });

    if (!job) {
      throw new Error('Integration job not found.');
    }

    const resetJob = await prisma.integrationJob.update({
      where: { id: job.id },
      data: {
        status: 'PENDING',
        attempts: 0,
        nextRetryAt: new Date(),
        lastError: null,
      },
    });

    return resetJob;
  },
};

export default integrationJobService;


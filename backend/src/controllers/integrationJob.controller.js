import integrationJobService from '../services/integrationJob.service.js';

export const integrationJobController = {
  async listJobs(req, res, next) {
    try {
      const companyId = req.params.companyId;
      const result = await integrationJobService.listJobs(companyId, req.query);
      res.json({ success: true, data: result.items, total: result.total });
    } catch (err) {
      next(err);
    }
  },

  async enqueue(req, res, next) {
    try {
      const companyId = req.params.companyId;
      const result = await integrationJobService.enqueueJob({
        companyId,
        ...req.body,
      });

      res.status(result.isDuplicate ? 200 : 201).json({
        success: true,
        data: result.job,
        isDuplicate: result.isDuplicate,
        message: result.isDuplicate ? 'Duplicate job idempotency key ignored.' : 'Job queued successfully.',
      });
    } catch (err) {
      next(err);
    }
  },

  async retry(req, res, next) {
    try {
      const { companyId, jobId } = req.params;
      const job = await integrationJobService.retryJob(companyId, jobId);
      res.json({ success: true, data: job, message: 'Job retry scheduled.' });
    } catch (err) {
      res.status(404).json({ success: false, message: err.message });
    }
  },

  async triggerWorkerRun(req, res, next) {
    try {
      const processed = await integrationJobService.processPendingJobs(10);
      res.json({ success: true, processedCount: processed.length, data: processed });
    } catch (err) {
      next(err);
    }
  },
};

export default integrationJobController;


import tallyService from '../../services/accounting/tally.service.js';

export const tallyController = {
  // Ledger Mapping APIs
  async createLedgerMapping(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await tallyService.createLedgerMapping(companyId, req.body, req.user);
      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async updateLedgerMapping(req, res, next) {
    try {
      const { companyId, mappingId } = req.params;
      const result = await tallyService.updateLedgerMapping(companyId, mappingId, req.body, req.user);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async listLedgerMappings(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await tallyService.listLedgerMappings(companyId, req.query);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async previewLedgerMappings(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await tallyService.previewLedgerMappings(companyId);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  // Voucher Export APIs
  async previewVoucherExport(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await tallyService.previewVoucherExport(companyId, req.body);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async exportVouchers(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await tallyService.exportVouchers(companyId, req.body, req.user);
      if (req.query.download === 'xml' || req.body.download === 'xml') {
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename="${result.batchNo}.xml"`);
        return res.send(result.xml);
      }
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getExportBatches(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await tallyService.getExportBatches(companyId, req.query);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async getFailedExports(req, res, next) {
    try {
      const { companyId } = req.params;
      const result = await tallyService.getFailedExports(companyId, req.query);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
};

export default tallyController;


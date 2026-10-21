import workItemService from '../services/work-item.service.js';

const workItemController = {
  async list(req, res, next) {
    try {
      const items = await workItemService.list(
        req.params.companyId,
        req.params.serviceCode,
        req.user,
        req.query.teamId
      );
      res.json({ success: true, data: items });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code,
        });
      }
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      const item = await workItemService.create(
        req.params.companyId,
        req.params.serviceCode,
        req.body,
        req.user,
        req.meta || {}
      );
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code,
        });
      }
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const item = await workItemService.update(
        req.params.companyId,
        req.params.workItemId,
        req.body,
        req.user,
        req.meta || {}
      );
      res.json({ success: true, data: item });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code,
        });
      }
      next(error);
    }
  },
};

export default workItemController;

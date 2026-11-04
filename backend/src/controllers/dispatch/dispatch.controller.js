import dispatchService from '../../services/dispatch/dispatch.service.js';

function handleError(error, res, next) {
  if (error.status) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const dispatchController = {
  async getDashboard(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await dispatchService.getDashboard(companyId);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async listEligibleOrders(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await dispatchService.listEligibleSalesOrders(companyId, req.query);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async createDispatchOrder(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await dispatchService.createDispatchOrder(companyId, req.body, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async listDispatchOrders(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const data = await dispatchService.listDispatchOrders(companyId, req.query);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async getDispatchOrderById(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await dispatchService.getDispatchOrderById(companyId, orderId);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async updateDispatchOrder(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await dispatchService.updateDispatchOrder(companyId, orderId, req.body, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async allocateFIFO(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await dispatchService.allocateFIFO(companyId, orderId, req.body, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async createPackage(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await dispatchService.createPackage(companyId, orderId, req.body, req.user);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async getPackingList(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await dispatchService.getPackingList(companyId, orderId);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async getDeliveryChallan(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await dispatchService.getDeliveryChallan(companyId, orderId);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async generateGatePass(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await dispatchService.generateGatePass(companyId, orderId, req.body, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async executeDispatch(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await dispatchService.executeDispatch(companyId, orderId, req.body, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async cancelDispatchOrder(req, res, next) {
    try {
      const companyId = String(req.params.companyId);
      const orderId = String(req.params.orderId);
      const data = await dispatchService.cancelDispatchOrder(companyId, orderId, req.body, req.user);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  },
};

export default dispatchController;


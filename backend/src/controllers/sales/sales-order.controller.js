import salesOrderService from '../../services/sales/sales-order.service.js';

function respondError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
}

export const salesOrderController = {
  async list(req, res, next) {
    try {
      const data = await salesOrderService.listSalesOrders(String(req.params.companyId), req.query);
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async create(req, res, next) {
    try {
      const data = await salesOrderService.createSalesOrder(String(req.params.companyId), req.body || {});
      res.status(201).json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async updateStatus(req, res, next) {
    try {
      const data = await salesOrderService.updateSalesOrderStatus(
        String(req.params.companyId),
        String(req.params.orderId),
        req.body?.status,
        req.body?.paymentStatus
      );
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },

  async remove(req, res, next) {
    try {
      await salesOrderService.removeSalesOrder(String(req.params.companyId), req.params.orderId);
      res.json({ success: true, message: 'Sales order deleted.' });
    } catch (err) { respondError(err, res, next); }
  },

  async release(req, res, next) {
    try {
      const data = await salesOrderService.releaseSalesOrder(
        String(req.params.companyId),
        String(req.params.orderId),
        req.user || {}
      );
      res.json({ success: true, data });
    } catch (err) { respondError(err, res, next); }
  },
};

export default salesOrderController;

import notificationService from '../services/notification.service.js';

export const notificationController = {
  async list(req, res, next) {
    try {
      const companyId = req.params.companyId;
      const userId = req.user.userId || req.user.id;
      const unreadOnly = req.query.unreadOnly === 'true';
      const limit = req.query.limit || 50;

      const result = await notificationService.listUserNotifications(companyId, userId, { unreadOnly, limit });
      res.json({ success: true, data: result.items, unreadCount: result.unreadCount });
    } catch (err) {
      next(err);
    }
  },

  async markRead(req, res, next) {
    try {
      const { companyId, notificationId } = req.params;
      const userId = req.user.userId || req.user.id;
      const updated = await notificationService.markAsRead(companyId, notificationId, userId);
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(404).json({ success: false, message: err.message });
    }
  },

  async markAllRead(req, res, next) {
    try {
      const companyId = req.params.companyId;
      const userId = req.user.userId || req.user.id;
      const count = await notificationService.markAllAsRead(companyId, userId);
      res.json({ success: true, count });
    } catch (err) {
      next(err);
    }
  },
};

export default notificationController;


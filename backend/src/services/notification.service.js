import prisma from '../config/prisma.js';

export const notificationService = {
  /**
   * Create an in-app notification
   */
  async createNotification({ companyId, recipientId, title, message, category = 'SYSTEM', entityType = null, entityId = null }) {
    if (!companyId || !recipientId || !title || !message) {
      return null;
    }

    try {
      // If recipient is 'MANAGERS', broadcast to all company admins / managers of that company
      if (recipientId === 'MANAGERS') {
        const managers = await prisma.companyEmployee.findMany({
          where: {
            companyId,
            accessRole: { in: ['DEPARTMENT_HEAD', 'SERVICE_HEAD'] },
            status: 'ACTIVE',
          },
          select: { id: true },
        });

        // Also add the main clientAdmin user id
        const recipientIds = managers.map(m => m.id);
        const clientAdmin = await prisma.clientAdmin.findUnique({
          where: { id: companyId },
          select: { id: true },
        });
        if (clientAdmin) recipientIds.push(clientAdmin.id);

        const notifications = await Promise.all(
          recipientIds.map(rid =>
            prisma.notification.create({
              data: {
                companyId,
                recipientId: String(rid),
                title,
                message,
                category,
                entityType: entityType ? String(entityType) : null,
                entityId: entityId ? String(entityId) : null,
              },
            })
          )
        );
        return notifications;
      }

      const notification = await prisma.notification.create({
        data: {
          companyId,
          recipientId: String(recipientId),
          title,
          message,
          category,
          entityType: entityType ? String(entityType) : null,
          entityId: entityId ? String(entityId) : null,
        },
      });

      return notification;
    } catch (err) {
      console.error('Failed to create notification:', err.message);
      return null;
    }
  },

  /**
   * List notifications for a user within tenant scope
   */
  async listUserNotifications(companyId, userId, options = {}) {
    const { unreadOnly = false, limit = 50 } = options;
    const where = {
      companyId,
      recipientId: String(userId),
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
      }),
      prisma.notification.count({
        where: {
          companyId,
          recipientId: String(userId),
          isRead: false,
        },
      }),
    ]);

    return { items, unreadCount };
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(companyId, notificationId, userId) {
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        companyId,
        recipientId: String(userId),
      },
    });

    if (!notification) {
      throw new Error('Notification not found or access denied.');
    }

    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return updated;
  },

  /**
   * Mark all unread notifications for a user as read
   */
  async markAllAsRead(companyId, userId) {
    const updated = await prisma.notification.updateMany({
      where: {
        companyId,
        recipientId: String(userId),
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return updated.count;
  },

  /**
   * Convenience alias for listUserNotifications
   */
  async getUserNotifications(companyId, userId, options) {
    return this.listUserNotifications(companyId, userId, options);
  },
};

export default notificationService;

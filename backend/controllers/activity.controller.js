/**
 * Activity & Notification Controllers
 */

const prisma = require('../prismaClient');

// ============================================
// ACTIVITY LOG CONTROLLER
// ============================================

/**
 * Get activity logs
 * GET /api/activities
 */
const getActivities = async (req, res) => {
  try {
    const { rfpId, limit = 50 } = req.query;

    const where = rfpId ? { rfpId } : {};

    const activities = await prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true }
        },
        rfp: {
          select: { rfpNumber: true, clientName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    res.status(200).json({ activities });

  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
};

// ============================================
// NOTIFICATION CONTROLLER
// ============================================

/**
 * Get user notifications
 * GET /api/notifications
 */
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      include: {
        rfp: {
          select: { rfpNumber: true, clientName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false }
    });

    res.status(200).json({
      notifications,
      unreadCount
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

/**
 * Mark notification as read
 * PATCH /api/notifications/:id/read
 */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    res.status(200).json({
      message: 'Notification marked as read',
      notification
    });

  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
};

/**
 * Mark all notifications as read
 * POST /api/notifications/read-all
 */
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });

    res.status(200).json({
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
};

module.exports = {
  getActivities,
  getNotifications,
  markAsRead,
  markAllAsRead
};

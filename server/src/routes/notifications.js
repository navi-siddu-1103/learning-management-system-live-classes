import { Router } from 'express';
import mongoose from 'mongoose';
import { Notification } from '../models.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// All notification endpoints require authentication.
router.use(requireAuth);

// GET /api/notifications
// Get notifications belonging to the logged-in user.
router.get('/', async (req, res) => {
  try {
    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
    );

    const filter = { recipient: req.user._id };

    if (req.query.unread === 'true') {
      filter.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Notification.countDocuments(filter),

      Notification.countDocuments({
        recipient: req.user._id,
        isRead: false,
      }),
    ]);

    res.json({
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Load notifications error:', error);

    res.status(500).json({
      message: 'Unable to load notifications',
    });
  }
});

// PATCH /api/notifications/:id/read
// Mark one notification as read.
router.patch('/:id/read', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid notification ID',
      });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user._id,
      },
      { $set: { isRead: true } },
      { new: true }
    ).lean();

    if (!notification) {
      return res.status(404).json({
        message: 'Notification not found',
      });
    }

    res.json({
      message: 'Notification marked as read',
      notification,
    });
  } catch (error) {
    console.error('Mark notification read error:', error);

    res.status(500).json({
      message: 'Unable to update notification',
    });
  }
});

// PATCH /api/notifications/read-all
// Mark all notifications belonging to the current user as read.
router.patch('/read-all', async (req, res) => {
  try {
    const result = await Notification.updateMany(
      {
        recipient: req.user._id,
        isRead: false,
      },
      { $set: { isRead: true } }
    );

    res.json({
      message: 'All notifications marked as read',
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);

    res.status(500).json({
      message: 'Unable to update notifications',
    });
  }
});

// DELETE /api/notifications/:id
// Delete a notification belonging to the current user.
router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid notification ID',
      });
    }

    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        message: 'Notification not found',
      });
    }

    res.json({
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    console.error('Delete notification error:', error);

    res.status(500).json({
      message: 'Unable to delete notification',
    });
  }
});

export default router;
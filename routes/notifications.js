const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const Notification = require('../models/Notification');

const router = express.Router();

// GET /api/notifications — get notifications for current user
router.get('/', verifyToken, async (req, res) => {
  try {
    const { id, role } = req.user;

    const notifications = await Notification.find({
      $or: [
        { targetIds: id },
        { targetRole: role },
        { targetRole: 'all' },
      ]
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const result = notifications.map(n => ({
      id: n._id.toString(),
      message: n.message,
      type: n.type,
      targetRole: n.targetRole,
      targetIds: n.targetIds,
      createdAt: n.createdAt,
      read: n.read,
    }));

    res.json(result);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ message: 'Failed to fetch notifications.' });
  }
});

// POST /api/notifications — send notification (admin only)
router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { message, targetRole, targetIds, type } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'Notification message is required.' });
    }

    const notif = await Notification.create({
      message,
      type: type || 'info',
      targetRole: targetRole || 'all',
      targetIds: targetIds || [],
    });

    const notifData = {
      id: notif._id.toString(),
      message: notif.message,
      type: notif.type,
      targetRole: notif.targetRole,
      targetIds: notif.targetIds,
      createdAt: notif.createdAt.toISOString(),
      read: false,
    };

    // Emit via socket if io is available
    if (req.app.get('io')) {
      const io = req.app.get('io');
      if (targetIds && targetIds.length > 0) {
        targetIds.forEach(uid => {
          io.to(`user:${uid}`).emit('notification', notifData);
        });
      } else {
        io.emit('notification', notifData);
      }
    }

    res.status(201).json({ message: 'Notification sent.', notification: notifData });
  } catch (err) {
    console.error('Error sending notification:', err);
    res.status(500).json({ message: 'Failed to send notification.' });
  }
});

// GET /api/notifications/all — get all notifications (admin only)
router.get('/all', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const result = notifications.map(n => ({
      id: n._id.toString(),
      message: n.message,
      type: n.type,
      targetRole: n.targetRole,
      targetIds: n.targetIds,
      createdAt: n.createdAt,
      read: n.read,
    }));

    res.json(result);
  } catch (err) {
    console.error('Error fetching all notifications:', err);
    res.status(500).json({ message: 'Failed to fetch notifications.' });
  }
});

module.exports = router;

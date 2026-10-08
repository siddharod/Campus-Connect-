const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../database');

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const userId = req.query.user_id;
    let query = `SELECT * FROM notifications WHERE 1=1`;
    const params = [];

    if (userId) {
      query += ` AND (user_id = ? OR user_id IS NULL)`;
      params.push(userId);
    }

    query += ` ORDER BY id DESC LIMIT 15`;
    const rows = await dbAll(query, params);

    const unreadCount = rows.filter(r => r.is_read === 0).length;

    res.json({
      success: true,
      unreadCount,
      data: rows
    });
  } catch (err) {
    console.error('Fetch notifications error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve notifications.' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
  try {
    await dbRun(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ success: false, message: 'Failed to update notification.' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', async (req, res) => {
  try {
    const userId = req.body.user_id;
    if (userId) {
      await dbRun(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [userId]);
    } else {
      await dbRun(`UPDATE notifications SET is_read = 1`);
    }
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ success: false, message: 'Failed to update notifications.' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../database');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/notices
// Query params: category, search
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = `SELECT * FROM notices WHERE 1=1`;
    const params = [];

    if (category && category !== 'All') {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (search && search.trim() !== '') {
      const term = `%${search.trim().toLowerCase()}%`;
      query += ` AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ?)`;
      params.push(term, term);
    }

    query += ` ORDER BY 
      CASE priority
        WHEN 'Urgent' THEN 1
        WHEN 'High' THEN 2
        WHEN 'Medium' THEN 3
        ELSE 4
      END, date DESC, id DESC`;

    const records = await dbAll(query, params);
    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    console.error('Fetch notices error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve notices.' });
  }
});

// GET /api/notices/:id
router.get('/:id', async (req, res) => {
  try {
    const notice = await dbGet(`SELECT * FROM notices WHERE id = ?`, [req.params.id]);
    if (!notice) {
      return res.status(404).json({ success: false, message: 'Notice not found.' });
    }
    res.json({ success: true, data: notice });
  } catch (err) {
    console.error('Get notice error:', err);
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

// POST /api/notices (Teacher only)
router.post('/', verifyToken, requireRole('Teacher'), async (req, res) => {
  try {
    const { title, description, category, priority, date } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({ success: false, message: 'Title, description, and category are required.' });
    }

    const today = date || new Date().toISOString().split('T')[0];
    const cleanPriority = priority || 'Medium';
    const cleanAuthor = req.user.name || 'Academic Administration';

    const result = await dbRun(
      `INSERT INTO notices (title, description, category, priority, author_id, author_name, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title.trim(), description.trim(), category, cleanPriority, req.user.id || null, cleanAuthor, today]
    );

    const newNotice = await dbGet(`SELECT * FROM notices WHERE id = ?`, [result.lastID]);

    // Broadcast notification to all student accounts
    const studentUsers = await dbAll(`SELECT id FROM users WHERE role = 'Student'`);
    for (const su of studentUsers) {
      await dbRun(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
        [
          su.id,
          `New Notice: ${title.trim()}`,
          description.trim().substring(0, 80) + '...',
          cleanPriority === 'Urgent' ? 'warning' : 'info'
        ]
      );
    }

    res.status(201).json({ success: true, message: 'Notice published successfully.', data: newNotice });
  } catch (err) {
    console.error('Create notice error:', err);
    res.status(500).json({ success: false, message: 'Failed to publish notice.' });
  }
});

// PUT /api/notices/:id (Teacher only)
router.put('/:id', verifyToken, requireRole('Teacher'), async (req, res) => {
  try {
    const { title, description, category, priority } = req.body;
    const noticeId = req.params.id;

    const existing = await dbGet(`SELECT * FROM notices WHERE id = ?`, [noticeId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Notice not found.' });
    }

    await dbRun(
      `UPDATE notices
       SET title = COALESCE(?, title),
           description = COALESCE(?, description),
           category = COALESCE(?, category),
           priority = COALESCE(?, priority)
       WHERE id = ?`,
      [title ? title.trim() : null, description ? description.trim() : null, category, priority, noticeId]
    );

    const updated = await dbGet(`SELECT * FROM notices WHERE id = ?`, [noticeId]);
    res.json({ success: true, message: 'Notice updated successfully.', data: updated });
  } catch (err) {
    console.error('Update notice error:', err);
    res.status(500).json({ success: false, message: 'Failed to update notice.' });
  }
});

// DELETE /api/notices/:id (Teacher only)
router.delete('/:id', verifyToken, requireRole('Teacher'), async (req, res) => {
  try {
    await dbRun(`DELETE FROM notices WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Notice deleted successfully.' });
  } catch (err) {
    console.error('Delete notice error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete notice.' });
  }
});

module.exports = router;

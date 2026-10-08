const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../database');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/subjects
router.get('/', async (req, res) => {
  try {
    const { course, year } = req.query;
    let query = `SELECT * FROM subjects WHERE 1=1`;
    const params = [];

    if (course && course !== 'All') {
      query += ` AND course = ?`;
      params.push(course);
    }
    if (year && year !== 'All') {
      query += ` AND year = ?`;
      params.push(year);
    }

    query += ` ORDER BY code ASC`;
    const rows = await dbAll(query, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('Fetch subjects error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve subjects.' });
  }
});

// POST /api/subjects (Teacher only)
router.post('/', verifyToken, requireRole('Teacher'), async (req, res) => {
  try {
    const { name, code, course, year, credits, teacher_name } = req.body;

    if (!name || !code || !course || !year) {
      return res.status(400).json({ success: false, message: 'Name, code, course, and year are required.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const existing = await dbGet(`SELECT id FROM subjects WHERE UPPER(code) = ?`, [cleanCode]);
    if (existing) {
      return res.status(409).json({ success: false, message: `Subject code "${cleanCode}" already exists.` });
    }

    const result = await dbRun(
      `INSERT INTO subjects (name, code, course, year, credits, teacher_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), cleanCode, course.trim(), year.trim(), credits || 3, teacher_name ? teacher_name.trim() : (req.user ? req.user.name : 'Faculty')]
    );

    const newRow = await dbGet(`SELECT * FROM subjects WHERE id = ?`, [result.lastID]);
    res.status(201).json({ success: true, message: 'Subject added successfully.', data: newRow });
  } catch (err) {
    console.error('Add subject error:', err);
    res.status(500).json({ success: false, message: 'Failed to add subject.' });
  }
});

// PUT /api/subjects/:id (Teacher only)
router.put('/:id', verifyToken, requireRole('Teacher'), async (req, res) => {
  try {
    const { name, code, course, year, credits, teacher_name } = req.body;
    const subId = req.params.id;

    await dbRun(
      `UPDATE subjects
       SET name = COALESCE(?, name),
           code = COALESCE(?, code),
           course = COALESCE(?, course),
           year = COALESCE(?, year),
           credits = COALESCE(?, credits),
           teacher_name = COALESCE(?, teacher_name)
       WHERE id = ?`,
      [name, code ? code.toUpperCase() : null, course, year, credits, teacher_name, subId]
    );

    const updated = await dbGet(`SELECT * FROM subjects WHERE id = ?`, [subId]);
    res.json({ success: true, message: 'Subject updated successfully.', data: updated });
  } catch (err) {
    console.error('Update subject error:', err);
    res.status(500).json({ success: false, message: 'Failed to update subject.' });
  }
});

// DELETE /api/subjects/:id (Teacher only)
router.delete('/:id', verifyToken, requireRole('Teacher'), async (req, res) => {
  try {
    await dbRun(`DELETE FROM subjects WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Subject deleted successfully.' });
  } catch (err) {
    console.error('Delete subject error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete subject.' });
  }
});

module.exports = router;

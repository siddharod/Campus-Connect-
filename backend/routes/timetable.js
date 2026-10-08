const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../database');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/timetable
// Query params: course, year, division, day, teacher_name
router.get('/', async (req, res) => {
  try {
    const { course, year, division, day, teacher_name } = req.query;
    let query = `SELECT * FROM timetable WHERE 1=1`;
    const params = [];

    if (course && course !== 'All') {
      query += ` AND course = ?`;
      params.push(course);
    }
    if (year && year !== 'All') {
      query += ` AND year = ?`;
      params.push(year);
    }
    if (division && division !== 'All') {
      query += ` AND UPPER(division) = ?`;
      params.push(division.trim().toUpperCase());
    }
    if (day && day !== 'All') {
      query += ` AND day = ?`;
      params.push(day);
    }
    if (teacher_name) {
      query += ` AND LOWER(teacher_name) LIKE ?`;
      params.push(`%${teacher_name.toLowerCase()}%`);
    }

    query += ` ORDER BY 
      CASE day 
        WHEN 'Monday' THEN 1 
        WHEN 'Tuesday' THEN 2 
        WHEN 'Wednesday' THEN 3 
        WHEN 'Thursday' THEN 4 
        WHEN 'Friday' THEN 5 
        WHEN 'Saturday' THEN 6 
        ELSE 7 
      END, time_slot ASC`;

    const records = await dbAll(query, params);
    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    console.error('Fetch timetable error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve timetable schedule.' });
  }
});

// POST /api/timetable (Teacher only)
router.post('/', verifyToken, requireRole('Teacher'), async (req, res) => {
  try {
    const { day, time_slot, subject_id, subject_name, course, year, division, room, teacher_name } = req.body;

    if (!day || !time_slot || !subject_name || !course || !year || !room) {
      return res.status(400).json({
        success: false,
        message: 'Day, time slot, subject name, course, year, and room are required.'
      });
    }

    const result = await dbRun(
      `INSERT INTO timetable (day, time_slot, subject_id, subject_name, course, year, division, room, teacher_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [day, time_slot, subject_id || null, subject_name, course, year, division || 'A', room, teacher_name || (req.user ? req.user.name : 'Faculty')]
    );

    const newSlot = await dbGet(`SELECT * FROM timetable WHERE id = ?`, [result.lastID]);
    res.status(201).json({ success: true, message: 'Class slot added to schedule.', data: newSlot });
  } catch (err) {
    console.error('Add timetable slot error:', err);
    res.status(500).json({ success: false, message: 'Failed to add class schedule.' });
  }
});

// DELETE /api/timetable/:id (Teacher only)
router.delete('/:id', verifyToken, requireRole('Teacher'), async (req, res) => {
  try {
    await dbRun(`DELETE FROM timetable WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Class slot removed from schedule.' });
  } catch (err) {
    console.error('Delete timetable slot error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete schedule entry.' });
  }
});

module.exports = router;

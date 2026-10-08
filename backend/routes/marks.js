const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../database');
const { verifyToken, requireRole } = require('../middleware/auth');

// Helper to calculate grades from actual marks
function calculateGrade(total) {
  if (total >= 90) return 'A+';
  if (total >= 80) return 'A';
  if (total >= 70) return 'B+';
  if (total >= 60) return 'B';
  if (total >= 50) return 'C';
  if (total >= 40) return 'D';
  return 'F';
}

// GET /api/marks - Fetch marks
// Query params: student_id, subject_id, course, year
router.get('/', async (req, res) => {
  try {
    const { student_id, subject_id, course, year } = req.query;

    let query = `
      SELECT m.id, m.student_id, m.subject_id, m.internal_marks, m.external_marks,
             m.total_marks, m.grade, m.exam_term, m.created_at,
             s.name AS student_name, s.roll_no, s.course, s.year, s.division,
             sub.name AS subject_name, sub.code AS subject_code, sub.credits
      FROM marks m
      JOIN students s ON m.student_id = s.id
      JOIN subjects sub ON m.subject_id = sub.id
      WHERE 1=1
    `;
    const params = [];

    if (student_id) {
      query += ` AND m.student_id = ?`;
      params.push(student_id);
    }
    if (subject_id) {
      query += ` AND m.subject_id = ?`;
      params.push(subject_id);
    }
    if (course && course !== 'All') {
      query += ` AND s.course = ?`;
      params.push(course);
    }
    if (year && year !== 'All') {
      query += ` AND s.year = ?`;
      params.push(year);
    }

    query += ` ORDER BY sub.code ASC, s.roll_no ASC`;

    const records = await dbAll(query, params);
    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    console.error('Fetch marks error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve marks.' });
  }
});

// GET /api/marks/student/:student_id or /api/marks/summary/:student_id or /api/marks/summary?student_id=...
router.get(['/student/:student_id', '/summary/:student_id', '/summary'], async (req, res) => {
  try {
    const studentId = req.params.student_id || req.query.student_id;
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student ID is required.' });
    }
    const student = await dbGet(`SELECT * FROM students WHERE id = ?`, [studentId]);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const marksRecords = await dbAll(
      `SELECT m.*, sub.name AS subject_name, sub.code AS subject_code, sub.credits
       FROM marks m
       JOIN subjects sub ON m.subject_id = sub.id
       WHERE m.student_id = ?
       ORDER BY sub.code ASC`,
      [studentId]
    );

    const count = marksRecords.length;

    // REAL CGPA calculation from actual marks only
    if (count === 0) {
      return res.json({
        success: true,
        data: {
          student,
          marks: [],
          cgpa: null,
          cgpaDisplay: '--',
          averageScore: null,
          averageScoreDisplay: '--',
          totalSubjects: 0,
          hasMarks: false
        }
      });
    }

    let totalScore = 0;
    marksRecords.forEach(m => {
      totalScore += (m.total_marks || 0);
    });

    const avg = totalScore / count;
    // 10-point scale CGPA: percentage / 10
    const calculatedCgpa = (avg / 10).toFixed(2);

    res.json({
      success: true,
      data: {
        student,
        marks: marksRecords,
        cgpa: parseFloat(calculatedCgpa),
        cgpaDisplay: calculatedCgpa,
        averageScore: parseFloat(avg.toFixed(1)),
        averageScoreDisplay: `${avg.toFixed(1)}%`,
        totalSubjects: count,
        hasMarks: true
      }
    });
  } catch (err) {
    console.error('Student marks summary error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate report card.' });
  }
});

// POST /api/marks - Add or update student marks (Teacher only)
router.post('/', verifyToken, requireRole('Teacher'), async (req, res) => {
  try {
    const { student_id, subject_id, internal_marks, external_marks, exam_term } = req.body;

    if (!student_id || !subject_id) {
      return res.status(400).json({ success: false, message: 'Student and subject are required.' });
    }

    const internal = parseFloat(internal_marks) || 0;
    const external = parseFloat(external_marks) || 0;
    const total = internal + external;
    const grade = calculateGrade(total);
    const term = exam_term ? exam_term.trim() : 'Semester IV (Regular)';

    const sql = `
      INSERT INTO marks (student_id, subject_id, internal_marks, external_marks, total_marks, grade, exam_term)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(student_id, subject_id, exam_term)
      DO UPDATE SET internal_marks = excluded.internal_marks,
                    external_marks = excluded.external_marks,
                    total_marks = excluded.total_marks,
                    grade = excluded.grade
    `;

    await dbRun(sql, [student_id, subject_id, internal, external, total, grade, term]);

    // Send notification to student's user account if linked
    const student = await dbGet(`SELECT user_id, name FROM students WHERE id = ?`, [student_id]);
    if (student && student.user_id) {
      await dbRun(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
        [student.user_id, 'Marks Uploaded', `Your marks for ${term} have been updated.`, 'info']
      );
    }

    res.status(201).json({
      success: true,
      message: 'Marks recorded successfully.',
      data: { student_id, subject_id, internal, external, total, grade, term }
    });
  } catch (err) {
    console.error('Record marks error:', err);
    res.status(500).json({ success: false, message: 'Failed to record marks.' });
  }
});

// PUT /api/marks/:id - Edit marks (Teacher only)
router.put('/:id', verifyToken, requireRole('Teacher'), async (req, res) => {
  try {
    const { internal_marks, external_marks, exam_term } = req.body;
    const markId = req.params.id;

    const existing = await dbGet(`SELECT * FROM marks WHERE id = ?`, [markId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Mark record not found.' });
    }

    const internal = internal_marks !== undefined ? parseFloat(internal_marks) : existing.internal_marks;
    const external = external_marks !== undefined ? parseFloat(external_marks) : existing.external_marks;
    const total = internal + external;
    const grade = calculateGrade(total);
    const term = exam_term ? exam_term.trim() : existing.exam_term;

    await dbRun(
      `UPDATE marks SET internal_marks=?, external_marks=?, total_marks=?, grade=?, exam_term=? WHERE id=?`,
      [internal, external, total, grade, term, markId]
    );

    const updated = await dbGet(`SELECT * FROM marks WHERE id = ?`, [markId]);
    res.json({ success: true, message: 'Marks updated successfully.', data: updated });
  } catch (err) {
    console.error('Update marks error:', err);
    res.status(500).json({ success: false, message: 'Failed to update marks.' });
  }
});

// DELETE /api/marks/:id (Teacher only)
router.delete('/:id', verifyToken, requireRole('Teacher'), async (req, res) => {
  try {
    await dbRun(`DELETE FROM marks WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Mark entry deleted successfully.' });
  } catch (err) {
    console.error('Delete marks error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete mark record.' });
  }
});

module.exports = router;

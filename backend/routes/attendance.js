const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../database');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/attendance - Fetch attendance records with rich filters
// Query params: student_id, subject_id, course, year, division, date
router.get('/', async (req, res) => {
  try {
    const { student_id, subject_id, date, course, year, division } = req.query;

    let query = `
      SELECT a.id, a.student_id, a.subject_id, a.date, a.status, a.created_at,
             s.name AS student_name, s.roll_no, s.course, s.year, s.division,
             sub.name AS subject_name, sub.code AS subject_code
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN subjects sub ON a.subject_id = sub.id
      WHERE 1=1
    `;
    const params = [];

    if (student_id) {
      query += ` AND a.student_id = ?`;
      params.push(student_id);
    }
    if (subject_id) {
      query += ` AND a.subject_id = ?`;
      params.push(subject_id);
    }
    if (date) {
      query += ` AND a.date = ?`;
      params.push(date);
    }
    if (course && course !== 'All') {
      query += ` AND s.course = ?`;
      params.push(course);
    }
    if (year && year !== 'All') {
      query += ` AND s.year = ?`;
      params.push(year);
    }
    if (division && division !== 'All') {
      query += ` AND UPPER(s.division) = ?`;
      params.push(division.trim().toUpperCase());
    }

    query += ` ORDER BY a.date DESC, s.roll_no ASC`;

    const records = await dbAll(query, params);
    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    console.error('Fetch attendance error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve attendance records.' });
  }
});

// GET /api/attendance/summary/:student_id or /api/attendance/summary?student_id=...
router.get(['/summary/:student_id', '/summary'], async (req, res) => {
  try {
    const studentId = req.params.student_id || req.query.student_id;
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student ID is required.' });
    }

    // Check if student exists
    const student = await dbGet(`SELECT * FROM students WHERE id = ?`, [studentId]);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    // Overall attendance stats
    const totalRow = await dbGet(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
              SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) AS absent
       FROM attendance WHERE student_id = ?`,
      [studentId]
    );

    const total = totalRow.total || 0;
    const present = totalRow.present || 0;
    const absent = totalRow.absent || 0;
    // CRITICAL: If total lectures = 0, percentage must strictly be 0% (NO fake 85%)
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    let overallStatus = 'No attendance records yet';
    let statusClass = 'neutral';
    if (total > 0) {
      if (percentage >= 75) {
        overallStatus = 'Good Standing';
        statusClass = 'success';
      } else if (percentage >= 65) {
        overallStatus = 'Needs Improvement';
        statusClass = 'warning';
      } else {
        overallStatus = 'Low Attendance';
        statusClass = 'danger';
      }
    }

    // Subject breakdown for subjects of this student's course & year
    const subjectStats = await dbAll(
      `SELECT sub.id AS subject_id, sub.name AS subject_name, sub.code AS subject_code,
              COUNT(a.id) AS total_lectures,
              SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present_lectures,
              SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) AS absent_lectures
       FROM subjects sub
       LEFT JOIN attendance a ON sub.id = a.subject_id AND a.student_id = ?
       WHERE sub.course = ? OR ? = ''
       GROUP BY sub.id
       ORDER BY sub.code ASC`,
      [studentId, student.course, student.course]
    );

    const subjects = subjectStats.map(s => {
      const tot = s.total_lectures || 0;
      const pres = s.present_lectures || 0;
      const abs = s.absent_lectures || 0;
      const pct = tot > 0 ? Math.round((pres / tot) * 100) : 0;

      let subStatus = 'No records';
      let subClass = 'neutral';
      if (tot > 0) {
        if (pct >= 75) {
          subStatus = 'Good Standing';
          subClass = 'success';
        } else if (pct >= 65) {
          subStatus = 'Needs Improvement';
          subClass = 'warning';
        } else {
          subStatus = 'Low Attendance';
          subClass = 'danger';
        }
      }

      return {
        subject_id: s.subject_id,
        subject_name: s.subject_name,
        subject_code: s.subject_code,
        total_lectures: tot,
        present_lectures: pres,
        absent_lectures: abs,
        percentage: pct,
        status: subStatus,
        statusClass: subClass
      };
    });

    const payload = {
      student_id: parseInt(studentId, 10),
      student_name: student.name,
      total_lectures: total,
      present_lectures: present,
      absent_lectures: absent,
      percentage,
      overall_percentage: percentage,
      hasRecords: total > 0,
      overallStatus,
      status: overallStatus,
      statusClass,
      subjects
    };

    res.json({
      success: true,
      data: payload,
      ...payload
    });
  } catch (err) {
    console.error('Attendance summary error:', err);
    res.status(500).json({ success: false, message: 'Failed to calculate attendance statistics.' });
  }
});

// POST /api/attendance - Batch save or mark attendance (Teacher only)
router.post('/', verifyToken, requireRole('Teacher'), async (req, res) => {
  try {
    const { subject_id, date, records } = req.body;

    if (!subject_id || !date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide subject ID, date, and student attendance records.'
      });
    }

    // Verify subject
    const subject = await dbGet(`SELECT name, code FROM subjects WHERE id = ?`, [subject_id]);
    const subjectName = subject ? subject.name : 'Lecture';

    const insertSql = `
      INSERT INTO attendance (student_id, subject_id, date, status)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(student_id, subject_id, date) 
      DO UPDATE SET status = excluded.status, created_at = CURRENT_TIMESTAMP
    `;

    let saved = 0;
    for (const r of records) {
      if (r.student_id && r.status) {
        const recordDate = r.date || date;
        await dbRun(insertSql, [r.student_id, subject_id, recordDate, r.status]);
        saved++;

        // Notify student of recorded attendance
        const st = await dbGet(`SELECT user_id FROM students WHERE id = ?`, [r.student_id]);
        if (st && st.user_id) {
          await dbRun(
            `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
            [
              st.user_id,
              'Attendance Updated',
              `Attendance marked as ${r.status} for ${subjectName} on ${recordDate}.`,
              r.status === 'Present' ? 'success' : 'warning'
            ]
          );
        }
      }
    }

    res.json({
      success: true,
      count: saved,
      message: `Attendance for ${saved} student(s) recorded successfully.`
    });
  } catch (err) {
    console.error('Save attendance error:', err);
    res.status(500).json({ success: false, message: 'Failed to record attendance.' });
  }
});

module.exports = router;

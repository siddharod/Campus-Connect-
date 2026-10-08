const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../database');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/students/stats - Summary statistics for dashboards (all dynamic from DB)
router.get('/stats', async (req, res) => {
  try {
    const totalRow = await dbGet(`SELECT COUNT(*) AS total FROM students`);
    const coursesRow = await dbGet(`SELECT COUNT(DISTINCT course) AS totalCourses FROM students`);
    const breakdownRows = await dbAll(`SELECT course, COUNT(*) AS count FROM students GROUP BY course ORDER BY count DESC`);

    // Real average attendance across all students with attendance logs
    const attRow = await dbGet(`
      SELECT COUNT(*) AS total_logs,
             SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS total_present
      FROM attendance
    `);
    const totalLogs = attRow.total_logs || 0;
    const totalPresent = attRow.total_present || 0;
    const avgAttendance = totalLogs > 0 ? Math.round((totalPresent / totalLogs) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalStudents: totalRow.total || 0,
        activeStudents: totalRow.total || 0,
        totalCourses: coursesRow.totalCourses || 0,
        averageAttendance: avgAttendance,
        academicYear: '2026–27',
        courseBreakdown: breakdownRows || []
      }
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, message: 'Error fetching statistics.' });
  }
});

// GET /api/students - Get all students with real attendance percentages calculated
router.get('/', async (req, res) => {
  try {
    const { search, course, year, division, sort } = req.query;

    let query = `
      SELECT s.*,
             COUNT(a.id) AS total_lectures,
             SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present_lectures,
             SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) AS absent_lectures
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim() !== '') {
      const term = `%${search.trim().toLowerCase()}%`;
      query += ` AND (LOWER(s.name) LIKE ? OR LOWER(s.roll_no) LIKE ? OR LOWER(s.email) LIKE ?)`;
      params.push(term, term, term);
    }
    if (course && course.trim() !== '' && course !== 'All') {
      query += ` AND s.course = ?`;
      params.push(course.trim());
    }
    if (year && year.trim() !== '' && year !== 'All') {
      query += ` AND s.year = ?`;
      params.push(year.trim());
    }
    if (division && division.trim() !== '' && division !== 'All') {
      query += ` AND UPPER(s.division) = ?`;
      params.push(division.trim().toUpperCase());
    }

    query += ` GROUP BY s.id`;

    const sortMap = {
      'name_asc': 's.name ASC',
      'name_desc': 's.name DESC',
      'roll_no': 's.roll_no ASC',
      'course': 's.course ASC',
      'newest': 's.id DESC',
      'oldest': 's.id ASC'
    };
    query += ` ORDER BY ${sortMap[sort] || 's.id DESC'}`;

    const rawRows = await dbAll(query, params);

    // Compute real attendance percentage per student
    const rows = rawRows.map(row => {
      const tot = row.total_lectures || 0;
      const pres = row.present_lectures || 0;
      const pct = tot > 0 ? Math.round((pres / tot) * 100) : 0;
      return {
        ...row,
        total_lectures: tot,
        present_lectures: pres,
        absent_lectures: row.absent_lectures || 0,
        attendance_percentage: pct,
        has_attendance: tot > 0
      };
    });

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve students.' });
  }
});

// GET /api/students/:id - Get single student by ID
router.get('/:id', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    if (isNaN(studentId)) {
      return res.status(400).json({ success: false, message: 'Invalid student ID format.' });
    }

    const row = await dbGet(`
      SELECT s.*,
             COUNT(a.id) AS total_lectures,
             SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present_lectures
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id
      WHERE s.id = ?
      GROUP BY s.id
    `, [studentId]);

    if (!row) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const tot = row.total_lectures || 0;
    const pres = row.present_lectures || 0;
    const pct = tot > 0 ? Math.round((pres / tot) * 100) : 0;

    res.json({
      success: true,
      data: {
        ...row,
        total_lectures: tot,
        present_lectures: pres,
        attendance_percentage: pct,
        has_attendance: tot > 0
      }
    });
  } catch (err) {
    console.error('Error fetching student by ID:', err);
    res.status(500).json({ success: false, message: 'Database error occurred.' });
  }
});

// POST /api/students - Create new student (Teacher only)
router.post('/', verifyToken, requireRole('Teacher'), async (req, res) => {
  try {
    const { name, roll_no, email, phone, course, year, division, date_of_birth } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Full name is required.' });
    if (!roll_no || !roll_no.trim()) return res.status(400).json({ success: false, message: 'Roll number is required.' });
    if (!email || !email.trim()) return res.status(400).json({ success: false, message: 'Email address is required.' });
    if (!course || !course.trim()) return res.status(400).json({ success: false, message: 'Course selection is required.' });
    if (!year || !year.trim()) return res.status(400).json({ success: false, message: 'Academic year is required.' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    const cleanRollNo = roll_no.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanPhone = phone ? phone.trim() : '';
    const cleanCourse = course.trim();
    const cleanYear = year.trim();
    const cleanDivision = division ? division.trim().toUpperCase() : 'A';
    const cleanDob = date_of_birth ? date_of_birth.trim() : '';

    const existing = await dbGet(`SELECT id FROM students WHERE UPPER(roll_no) = ?`, [cleanRollNo]);
    if (existing) {
      return res.status(409).json({ success: false, message: `Roll Number "${cleanRollNo}" already exists.` });
    }

    const result = await dbRun(
      `INSERT INTO students (name, roll_no, email, phone, course, year, division, date_of_birth)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cleanName, cleanRollNo, cleanEmail, cleanPhone, cleanCourse, cleanYear, cleanDivision, cleanDob]
    );

    const newRow = await dbGet(`SELECT * FROM students WHERE id = ?`, [result.lastID]);
    res.status(201).json({ success: true, message: 'Student added successfully.', data: newRow });
  } catch (err) {
    console.error('Error creating student:', err);
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ success: false, message: 'Roll number or email already exists.' });
    }
    res.status(500).json({ success: false, message: 'Failed to add student to database.' });
  }
});

// PUT /api/students/:id - Update student record (Teacher only)
router.put('/:id', verifyToken, requireRole('Teacher'), async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    if (isNaN(studentId)) {
      return res.status(400).json({ success: false, message: 'Invalid student ID format.' });
    }

    const student = await dbGet(`SELECT * FROM students WHERE id = ?`, [studentId]);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const { name, roll_no, email, phone, course, year, division, date_of_birth } = req.body;

    const cleanName = name ? name.trim() : student.name;
    const cleanRollNo = roll_no ? roll_no.trim().toUpperCase() : student.roll_no;
    const cleanEmail = email ? email.trim().toLowerCase() : student.email;
    const cleanPhone = phone !== undefined ? phone.trim() : student.phone;
    const cleanCourse = course ? course.trim() : student.course;
    const cleanYear = year ? year.trim() : student.year;
    const cleanDivision = division ? division.trim().toUpperCase() : student.division;
    const cleanDob = date_of_birth !== undefined ? date_of_birth.trim() : student.date_of_birth;

    // Check roll number conflict with other students
    if (cleanRollNo !== student.roll_no) {
      const conflict = await dbGet(`SELECT id FROM students WHERE UPPER(roll_no) = ? AND id != ?`, [cleanRollNo, studentId]);
      if (conflict) {
        return res.status(409).json({ success: false, message: `Roll Number "${cleanRollNo}" is already in use by another student.` });
      }
    }

    await dbRun(
      `UPDATE students SET name=?, roll_no=?, email=?, phone=?, course=?, year=?, division=?, date_of_birth=? WHERE id=?`,
      [cleanName, cleanRollNo, cleanEmail, cleanPhone, cleanCourse, cleanYear, cleanDivision, cleanDob, studentId]
    );

    const updatedRow = await dbGet(`SELECT * FROM students WHERE id = ?`, [studentId]);
    res.json({ success: true, message: 'Student record updated successfully.', data: updatedRow });
  } catch (err) {
    console.error('Error updating student:', err);
    res.status(500).json({ success: false, message: 'Failed to update student record.' });
  }
});

// DELETE /api/students/:id - Delete student (Teacher only)
router.delete('/:id', verifyToken, requireRole('Teacher'), async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    if (isNaN(studentId)) {
      return res.status(400).json({ success: false, message: 'Invalid student ID format.' });
    }

    const student = await dbGet(`SELECT * FROM students WHERE id = ?`, [studentId]);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    await dbRun(`DELETE FROM students WHERE id = ?`, [studentId]);
    res.json({ success: true, message: `Student "${student.name}" deleted successfully.` });
  } catch (err) {
    console.error('Error deleting student:', err);
    res.status(500).json({ success: false, message: 'Failed to delete student record.' });
  }
});

module.exports = router;

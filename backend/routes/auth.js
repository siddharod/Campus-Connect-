const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { dbGet, dbRun } = require('../database');
const { generateToken, verifyToken } = require('../middleware/auth');

// POST /api/auth/register or /api/register
router.post(['/register', '/auth/register'], async (req, res) => {
  try {
    const {
      role,
      name,
      full_name,
      email,
      password,
      confirmPassword,
      phone,
      // Student specific
      roll_no,
      roll_number,
      course,
      year,
      division,
      // Teacher specific
      employee_id,
      department
    } = req.body;

    const actualName = (name || full_name || '').trim();
    const actualRoll = (roll_no || roll_number || '').trim();

    // Common Validation
    if (!role || !actualName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = email.trim().toLowerCase();
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    // Check if email already exists
    const existingUser = await dbGet(`SELECT id FROM users WHERE LOWER(email) = ?`, [cleanEmail]);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists. Please log in.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const cleanName = actualName;
    const cleanPhone = phone ? phone.trim() : '';

    if (role === 'Student') {
      if (!actualRoll) {
        return res.status(400).json({ success: false, message: 'Roll number is required for students.' });
      }
      if (!course) {
        return res.status(400).json({ success: false, message: 'Course selection is required.' });
      }
      if (!year) {
        return res.status(400).json({ success: false, message: 'Academic year is required.' });
      }

      const cleanRollNo = actualRoll.toUpperCase();
      const existingRoll = await dbGet(`SELECT id FROM students WHERE UPPER(roll_no) = ?`, [cleanRollNo]);
      if (existingRoll) {
        return res.status(409).json({
          success: false,
          message: `Student Roll Number "${cleanRollNo}" is already registered.`
        });
      }

      // Create user record
      const userRes = await dbRun(
        `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
        [cleanName, cleanEmail, hashedPassword, 'Student']
      );
      const newUserId = userRes.lastID;

      // Create student record
      const studentRes = await dbRun(
        `INSERT INTO students (user_id, name, roll_no, email, phone, course, year, division, admission_year)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newUserId, cleanName, cleanRollNo, cleanEmail, cleanPhone, course, year, division || 'A', '2026']
      );

      // New student starts completely clean with 0 notifications, 0 attendance, 0 marks
      return res.status(201).json({
        success: true,
        message: 'Student account created successfully! Please log in.',
        userId: newUserId,
        studentId: studentRes.lastID
      });
    } else if (role === 'Teacher') {
      if (!employee_id || !employee_id.trim()) {
        return res.status(400).json({ success: false, message: 'Employee ID is required for teachers.' });
      }
      if (!department || !department.trim()) {
        return res.status(400).json({ success: false, message: 'Department is required.' });
      }

      const cleanEmpId = employee_id.trim().toUpperCase();
      const existingEmp = await dbGet(`SELECT id FROM teachers WHERE UPPER(employee_id) = ?`, [cleanEmpId]);
      if (existingEmp) {
        return res.status(409).json({
          success: false,
          message: `Employee ID "${cleanEmpId}" is already registered.`
        });
      }

      // Create user record
      const userRes = await dbRun(
        `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
        [cleanName, cleanEmail, hashedPassword, 'Teacher']
      );
      const newUserId = userRes.lastID;

      // Create teacher record
      const teacherRes = await dbRun(
        `INSERT INTO teachers (user_id, name, employee_id, email, phone, department, designation)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newUserId, cleanName, cleanEmpId, cleanEmail, cleanPhone, department.trim(), 'Assistant Professor']
      );

      return res.status(201).json({
        success: true,
        message: 'Teacher account created successfully! Please log in.',
        userId: newUserId,
        teacherId: teacherRes.lastID
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid role selected.'
      });
    }
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during registration. Please try again.'
    });
  }
});

// POST /api/auth/login or /api/login
router.post(['/login', '/auth/login'], async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, and select your role.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanRole = role.trim();

    const user = await dbGet(`SELECT * FROM users WHERE LOWER(email) = ?`, [cleanEmail]);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    if (user.role.toLowerCase() !== cleanRole.toLowerCase()) {
      return res.status(401).json({
        success: false,
        message: `Account found, but registered as a ${user.role}, not ${cleanRole}.`
      });
    }

    // Verify bcrypt password (with auto-upgrade for legacy plain text)
    let isMatch = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      if (password === user.password) {
        isMatch = true;
        const newHash = await bcrypt.hash(password, 10);
        await dbRun(`UPDATE users SET password = ? WHERE id = ?`, [newHash, user.id]);
      }
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Retrieve specific profile
    let profile = null;
    if (user.role === 'Student') {
      profile = await dbGet(`SELECT * FROM students WHERE user_id = ? OR LOWER(email) = ?`, [user.id, cleanEmail]);
    } else if (user.role === 'Teacher') {
      profile = await dbGet(`SELECT * FROM teachers WHERE user_id = ? OR LOWER(email) = ?`, [user.id, cleanEmail]);
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profile: profile || {}
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login.'
    });
  }
});

// POST /api/auth/logout
router.post(['/logout', '/auth/logout'], (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});

// POST /api/auth/forgot-password
router.post(['/forgot-password', '/auth/forgot-password'], async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await dbGet(`SELECT id, name FROM users WHERE LOWER(email) = ?`, [cleanEmail]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account registered with that email address.'
      });
    }

    // Generate development reset token
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    await dbRun(
      `INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)`,
      [cleanEmail, token, expiresAt]
    );

    return res.json({
      success: true,
      message: 'Password reset token generated.',
      token,
      resetLink: `/reset-password.html?token=${token}&email=${encodeURIComponent(cleanEmail)}`,
      user: { name: user.name, email: cleanEmail }
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: 'Server error generating reset token.' });
  }
});

// POST /api/auth/reset-password
router.post(['/reset-password', '/auth/reset-password'], async (req, res) => {
  try {
    const { email, token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    // Verify token
    const record = await dbGet(
      `SELECT * FROM password_resets WHERE token = ? ORDER BY id DESC LIMIT 1`,
      [token.trim()]
    );

    if (!record) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'Reset token has expired. Please request a new one.' });
    }

    const targetEmail = record.email.toLowerCase();
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await dbRun(`UPDATE users SET password = ? WHERE LOWER(email) = ?`, [hashedPassword, targetEmail]);

    // Clean up used token
    await dbRun(`DELETE FROM password_resets WHERE token = ?`, [token.trim()]);

    return res.json({
      success: true,
      message: 'Password has been reset successfully! You can now log in.'
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: 'Server error resetting password.' });
  }
});

module.exports = router;

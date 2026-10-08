const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { dbGet, dbRun } = require('../database');
const { verifyToken } = require('../middleware/auth');

// GET /api/users/me
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await dbGet(`SELECT id, name, email, role, COALESCE(created_at, datetime('now')) AS created_at FROM users WHERE id = ?`, [req.user.id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    let profile = null;
    if (user.role === 'Student') {
      profile = await dbGet(`SELECT * FROM students WHERE user_id = ? OR LOWER(email) = ?`, [user.id, user.email.toLowerCase()]);
    } else if (user.role === 'Teacher') {
      profile = await dbGet(`SELECT * FROM teachers WHERE user_id = ? OR LOWER(email) = ?`, [user.id, user.email.toLowerCase()]);
    }

    res.json({
      success: true,
      user,
      profile: profile || {}
    });
  } catch (err) {
    console.error('Fetch profile error:', err);
    res.status(500).json({ success: false, message: 'Error retrieving profile.' });
  }
});

// PUT /api/users/me - Update profile
router.put('/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, course, year, division, date_of_birth, department, designation, avatar } = req.body;

    if (name && name.trim()) {
      await dbRun(`UPDATE users SET name = ? WHERE id = ?`, [name.trim(), userId]);
    }

    const user = await dbGet(`SELECT role, email FROM users WHERE id = ?`, [userId]);

    if (user.role === 'Student') {
      await dbRun(
        `UPDATE students 
         SET name = COALESCE(?, name),
             phone = COALESCE(?, phone),
             course = COALESCE(?, course),
             year = COALESCE(?, year),
             division = COALESCE(?, division),
             date_of_birth = COALESCE(?, date_of_birth),
             avatar = COALESCE(?, avatar)
         WHERE user_id = ? OR LOWER(email) = ?`,
        [name ? name.trim() : null, phone, course, year, division, date_of_birth, avatar, userId, user.email.toLowerCase()]
      );
    } else if (user.role === 'Teacher') {
      await dbRun(
        `UPDATE teachers
         SET name = COALESCE(?, name),
             phone = COALESCE(?, phone),
             department = COALESCE(?, department),
             designation = COALESCE(?, designation),
             avatar = COALESCE(?, avatar)
         WHERE user_id = ? OR LOWER(email) = ?`,
        [name ? name.trim() : null, phone, department, designation, avatar, userId, user.email.toLowerCase()]
      );
    }

    const updatedUser = await dbGet(`SELECT id, name, email, role FROM users WHERE id = ?`, [userId]);
    let updatedProfile = null;
    if (user.role === 'Student') {
      updatedProfile = await dbGet(`SELECT * FROM students WHERE user_id = ? OR LOWER(email) = ?`, [userId, user.email.toLowerCase()]);
    } else {
      updatedProfile = await dbGet(`SELECT * FROM teachers WHERE user_id = ? OR LOWER(email) = ?`, [userId, user.email.toLowerCase()]);
    }

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: updatedUser,
      profile: updatedProfile
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

// PUT /api/users/change-password
router.put('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New passwords do not match.' });
    }

    const user = await dbGet(`SELECT password FROM users WHERE id = ?`, [req.user.id]);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect current password.' });
    }

    const newHashed = await bcrypt.hash(newPassword, 10);
    await dbRun(`UPDATE users SET password = ? WHERE id = ?`, [newHashed, req.user.id]);

    res.json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Server error while changing password.' });
  }
});

// DELETE /api/users/me - Delete account (Danger Zone)
router.delete('/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    await dbRun(`DELETE FROM students WHERE user_id = ?`, [userId]);
    await dbRun(`DELETE FROM teachers WHERE user_id = ?`, [userId]);
    await dbRun(`DELETE FROM users WHERE id = ?`, [userId]);

    res.json({
      success: true,
      message: 'Your account has been deleted successfully.'
    });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete account.' });
  }
});

module.exports = router;

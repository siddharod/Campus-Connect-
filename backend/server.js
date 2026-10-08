const express = require('express');
const cors = require('cors');
const path = require('path');

// Initialize database & seed data
require('./database');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const studentRoutes = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');
const marksRoutes = require('./routes/marks');
const subjectRoutes = require('./routes/subjects');
const timetableRoutes = require('./routes/timetable');
const noticeRoutes = require('./routes/notices');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// API Routes
app.use('/api', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/marks', marksRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    version: '2.0.0',
    message: 'CampusConnect College Management System is operational.',
    timestamp: new Date().toISOString()
  });
});

// Clean friendly page routes fallback
app.get('/', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(frontendPath, 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(frontendPath, 'register.html')));
app.get('/forgot-password', (req, res) => res.sendFile(path.join(frontendPath, 'forgot-password.html')));
app.get('/reset-password', (req, res) => res.sendFile(path.join(frontendPath, 'reset-password.html')));

// 404 handler for unmatched API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API route not found'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=================================================================`);
  console.log(` CampusConnect v2.0 – College Student Management Platform        `);
  console.log(`=================================================================`);
  console.log(` Server URL:            http://localhost:${PORT}`);
  console.log(` Public Landing:        http://localhost:${PORT}/index.html`);
  console.log(` Registration:          http://localhost:${PORT}/register.html`);
  console.log(` Login Portal:          http://localhost:${PORT}/login.html`);
  console.log(` Teacher Demo Login:    teacher@campusconnect.com / teacher123`);
  console.log(` Student Demo Login:    student@campusconnect.com / student123`);
  console.log(`=================================================================`);
});

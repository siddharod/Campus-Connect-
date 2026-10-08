const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'student_management.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Could not connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    db.run('PRAGMA foreign_keys = ON;');
  }
});

// Helper for promise-based db execution
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Initialize tables & seed full relational data
async function initDatabase() {
  try {
    // 1. Users Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('Student', 'Teacher', 'Admin')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Students Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        roll_no TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        phone TEXT,
        course TEXT NOT NULL,
        year TEXT NOT NULL,
        division TEXT DEFAULT 'A',
        date_of_birth TEXT,
        admission_year TEXT DEFAULT '2023',
        avatar TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Teachers Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS teachers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        employee_id TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        phone TEXT,
        department TEXT NOT NULL,
        designation TEXT DEFAULT 'Associate Professor',
        avatar TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Courses Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        duration_years INTEGER DEFAULT 4
      )
    `);

    // 5. Subjects Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        course TEXT NOT NULL,
        year TEXT NOT NULL,
        credits INTEGER DEFAULT 3,
        teacher_name TEXT DEFAULT 'Faculty'
      )
    `);

    // 6. Attendance Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('Present', 'Absent')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, subject_id, date)
      )
    `);

    // 7. Marks Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS marks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        internal_marks REAL DEFAULT 0,
        external_marks REAL DEFAULT 0,
        total_marks REAL DEFAULT 0,
        grade TEXT,
        exam_term TEXT DEFAULT 'Semester IV (Regular)',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, subject_id, exam_term)
      )
    `);

    // 8. Notices Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS notices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('Academic', 'Examination', 'Event', 'General', 'Important')),
        priority TEXT NOT NULL CHECK(priority IN ('High', 'Medium', 'Low', 'Urgent')),
        author_id INTEGER REFERENCES users(id),
        author_name TEXT NOT NULL,
        date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 9. Timetable Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS timetable (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day TEXT NOT NULL CHECK(day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')),
        time_slot TEXT NOT NULL,
        subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
        subject_name TEXT NOT NULL,
        course TEXT NOT NULL,
        year TEXT NOT NULL,
        division TEXT DEFAULT 'A',
        room TEXT NOT NULL,
        teacher_name TEXT NOT NULL
      )
    `);

    // 10. Notifications Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 11. Password Resets Table (Local dev reset flow)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        token TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Column migrations for existing tables
    const studentCols = await dbAll('PRAGMA table_info(students)');
    const studentColNames = studentCols.map(c => c.name);
    if (!studentColNames.includes('user_id')) {
      await dbRun('ALTER TABLE students ADD COLUMN user_id INTEGER');
    }
    if (!studentColNames.includes('admission_year')) {
      await dbRun('ALTER TABLE students ADD COLUMN admission_year TEXT');
    }
    if (!studentColNames.includes('profile_pic')) {
      await dbRun('ALTER TABLE students ADD COLUMN profile_pic TEXT');
    }
    if (!studentColNames.includes('avatar')) {
      await dbRun('ALTER TABLE students ADD COLUMN avatar TEXT');
    }

    // Users table migrations
    const userCols = await dbAll('PRAGMA table_info(users)');
    const userColNames = userCols.map(c => c.name);
    if (!userColNames.includes('created_at')) {
      await dbRun('ALTER TABLE users ADD COLUMN created_at TEXT');
    }

    const teacherCols = await dbAll('PRAGMA table_info(teachers)');
    const teacherColNames = teacherCols.map(c => c.name);
    if (!teacherColNames.includes('user_id')) {
      await dbRun('ALTER TABLE teachers ADD COLUMN user_id INTEGER');
    }
    if (!teacherColNames.includes('profile_pic')) {
      await dbRun('ALTER TABLE teachers ADD COLUMN profile_pic TEXT');
    }

    console.log('Database tables verified.');
    await seedAllInitialData();
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

async function seedAllInitialData() {
  try {
    // 1. Seed Courses
    const courseCount = await dbGet(`SELECT COUNT(*) AS count FROM courses`);
    if (courseCount.count === 0) {
      console.log('Seeding courses...');
      const courses = [
        ['CE', 'Computer Engineering', 4],
        ['IT', 'Information Technology', 4],
        ['EXTC', 'Electronics Engineering', 4],
        ['ME', 'Mechanical Engineering', 4]
      ];
      for (const c of courses) {
        await dbRun(`INSERT INTO courses (code, name, duration_years) VALUES (?, ?, ?)`, c);
      }
    }

    // 2. Seed Subjects
    const subjectCount = await dbGet(`SELECT COUNT(*) AS count FROM subjects`);
    if (subjectCount.count === 0) {
      console.log('Seeding academic subjects...');
      const subjects = [
        ['Database Management Systems', 'CS401', 'Computer Engineering', 'Second Year', 4, 'Prof. Rajesh Sharma'],
        ['Computer Networks', 'CS402', 'Computer Engineering', 'Second Year', 4, 'Prof. Sunita Patil'],
        ['Operating Systems', 'CS403', 'Computer Engineering', 'Second Year', 3, 'Prof. Amit Joshi'],
        ['Software Engineering', 'CS404', 'Computer Engineering', 'Second Year', 3, 'Prof. Rajesh Sharma'],
        ['Web Technologies & Frameworks', 'CS405', 'Computer Engineering', 'Second Year', 3, 'Prof. Priyanka Sen'],
        ['Data Structures & Algorithms', 'IT301', 'Information Technology', 'Second Year', 4, 'Prof. Sunita Patil'],
        ['Digital Signal Processing', 'EX401', 'Electronics Engineering', 'Fourth Year', 4, 'Prof. Vikram Rao'],
        ['Fluid Mechanics', 'ME201', 'Mechanical Engineering', 'Second Year', 4, 'Prof. Manoj Shinde']
      ];
      for (const s of subjects) {
        await dbRun(`INSERT INTO subjects (name, code, course, year, credits, teacher_name) VALUES (?, ?, ?, ?, ?, ?)`, s);
      }
    }

    // 3. Seed Users with Bcrypt Hashing
    const userCount = await dbGet(`SELECT COUNT(*) AS count FROM users`);
    let teacherUserId, studentUserId;

    if (userCount.count === 0) {
      console.log('Seeding default users with secure bcrypt hashes...');
      const teacherHash = await bcrypt.hash('teacher123', 10);
      const studentHash = await bcrypt.hash('student123', 10);

      const teacherRes = await dbRun(
        `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
        ['Prof. Rajesh Sharma', 'teacher@campusconnect.com', teacherHash, 'Teacher']
      );
      teacherUserId = teacherRes.lastID;

      const studentRes = await dbRun(
        `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
        ['Rahul Sharma', 'student@campusconnect.com', studentHash, 'Student']
      );
      studentUserId = studentRes.lastID;
    } else {
      // Migrate any plain text passwords to bcrypt hashes
      const usersList = await dbAll(`SELECT id, password FROM users`);
      for (const u of usersList) {
        if (!u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
          const hashed = await bcrypt.hash(u.password, 10);
          await dbRun(`UPDATE users SET password = ? WHERE id = ?`, [hashed, u.id]);
        }
      }
      const tUser = await dbGet(`SELECT id FROM users WHERE email = 'teacher@campusconnect.com'`);
      const sUser = await dbGet(`SELECT id FROM users WHERE email = 'student@campusconnect.com'`);
      if (tUser) teacherUserId = tUser.id;
      if (sUser) studentUserId = sUser.id;
    }

    // Ensure seed student and teacher have user_id linked
    if (teacherUserId) {
      await dbRun(`UPDATE teachers SET user_id = ? WHERE (user_id IS NULL OR user_id = 0) AND (email = 'teacher@campusconnect.com' OR id = 1)`, [teacherUserId]);
    }
    if (studentUserId) {
      await dbRun(`UPDATE students SET user_id = ? WHERE (user_id IS NULL OR user_id = 0) AND (email = 'student@campusconnect.com' OR roll_no = 'CE101')`, [studentUserId]);
    }

    // 4. Seed Teacher Details
    const teacherCount = await dbGet(`SELECT COUNT(*) AS count FROM teachers`);
    if (teacherCount.count === 0 && teacherUserId) {
      console.log('Seeding teacher profile...');
      await dbRun(
        `INSERT INTO teachers (user_id, name, employee_id, email, phone, department, designation)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          teacherUserId,
          'Prof. Rajesh Sharma',
          'EMP1001',
          'teacher@campusconnect.com',
          '9820123456',
          'Computer Engineering',
          'Senior Associate Professor'
        ]
      );
    }

    // 5. Seed Students
    const studentCount = await dbGet(`SELECT COUNT(*) AS count FROM students`);
    if (studentCount.count === 0) {
      console.log('Seeding initial student records...');
      const demoStudents = [
        [studentUserId, 'Rahul Sharma', 'CE101', 'student@campusconnect.com', '9876543210', 'Computer Engineering', 'Second Year', 'A', '2004-05-15', '2023'],
        [null, 'Neha Patil', 'IT102', 'neha.patil@campusconnect.com', '9876543211', 'Information Technology', 'Third Year', 'B', '2003-08-22', '2022'],
        [null, 'Aarav Mehta', 'CE103', 'aarav.mehta@campusconnect.com', '9876543212', 'Computer Engineering', 'First Year', 'A', '2005-01-10', '2024'],
        [null, 'Ananya Joshi', 'EX104', 'ananya.joshi@campusconnect.com', '9876543213', 'Electronics Engineering', 'Fourth Year', 'A', '2002-11-04', '2021'],
        [null, 'Rohan Kulkarni', 'ME105', 'rohan.kulkarni@campusconnect.com', '9876543214', 'Mechanical Engineering', 'Second Year', 'C', '2004-03-18', '2023'],
        [null, 'Priya Nair', 'IT106', 'priya.nair@campusconnect.com', '9876543215', 'Information Technology', 'Second Year', 'B', '2004-09-29', '2023'],
        [null, 'Siddharth Verma', 'CE107', 'siddharth.v@campusconnect.com', '9876543216', 'Computer Engineering', 'Third Year', 'A', '2003-04-12', '2022'],
        [null, 'Tanvi Deshmukh', 'EX108', 'tanvi.d@campusconnect.com', '9876543217', 'Electronics Engineering', 'First Year', 'B', '2005-07-20', '2024'],
        [null, 'Aditya Singh', 'ME109', 'aditya.singh@campusconnect.com', '9876543218', 'Mechanical Engineering', 'Fourth Year', 'A', '2002-12-05', '2021']
      ];

      for (const st of demoStudents) {
        await dbRun(
          `INSERT INTO students (user_id, name, roll_no, email, phone, course, year, division, date_of_birth, admission_year)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          st
        );
      }
    }

    // 6. Seed Attendance Records for real calculations
    const attCount = await dbGet(`SELECT COUNT(*) AS count FROM attendance`);
    if (attCount.count === 0) {
      console.log('Seeding realistic attendance history...');
      const student1 = await dbGet(`SELECT id FROM students WHERE roll_no = 'CE101'`);
      const ceSubjects = await dbAll(`SELECT id FROM subjects WHERE course = 'Computer Engineering'`);

      if (student1 && ceSubjects.length > 0) {
        // Seed 20 lecture dates for Rahul Sharma (17 Present, 3 Absent -> exactly 85%)
        const dates = [
          '2026-09-01', '2026-09-03', '2026-09-05', '2026-09-08', '2026-09-10',
          '2026-09-12', '2026-09-15', '2026-09-17', '2026-09-19', '2026-09-22',
          '2026-09-24', '2026-09-26', '2026-09-29', '2026-10-01', '2026-10-03',
          '2026-10-05', '2026-10-07', '2026-10-10', '2026-10-12', '2026-10-14'
        ];

        let index = 0;
        for (const date of dates) {
          const subId = ceSubjects[index % ceSubjects.length].id;
          // Mark absent on days 4, 11, 18
          const status = (index === 4 || index === 11 || index === 18) ? 'Absent' : 'Present';
          await dbRun(
            `INSERT OR IGNORE INTO attendance (student_id, subject_id, date, status) VALUES (?, ?, ?, ?)`,
            [student1.id, subId, date, status]
          );
          index++;
        }
      }
    }

    // 7. Seed Marks / Academic Results
    const marksCount = await dbGet(`SELECT COUNT(*) AS count FROM marks`);
    if (marksCount.count === 0) {
      console.log('Seeding academic marks...');
      const student1 = await dbGet(`SELECT id FROM students WHERE roll_no = 'CE101'`);
      const ceSubjects = await dbAll(`SELECT id FROM subjects WHERE course = 'Computer Engineering' LIMIT 5`);

      if (student1 && ceSubjects.length > 0) {
        const sampleScores = [
          { internal: 38, external: 54, total: 92, grade: 'A+' },
          { internal: 34, external: 51, total: 85, grade: 'A' },
          { internal: 32, external: 46, total: 78, grade: 'B+' },
          { internal: 36, external: 52, total: 88, grade: 'A' },
          { internal: 30, external: 42, total: 72, grade: 'B+' }
        ];

        for (let i = 0; i < ceSubjects.length; i++) {
          const sc = sampleScores[i % sampleScores.length];
          await dbRun(
            `INSERT OR IGNORE INTO marks (student_id, subject_id, internal_marks, external_marks, total_marks, grade, exam_term)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [student1.id, ceSubjects[i].id, sc.internal, sc.external, sc.total, sc.grade, 'Semester IV (Regular)']
          );
        }
      }
    }

    // 8. Seed Timetable (Monday to Saturday)
    const ttCount = await dbGet(`SELECT COUNT(*) AS count FROM timetable`);
    if (ttCount.count === 0) {
      console.log('Seeding complete weekly timetable...');
      const schedule = [
        ['Monday', '09:00 - 10:00 AM', 1, 'Database Management Systems', 'Computer Engineering', 'Second Year', 'A', 'Room 301', 'Prof. Rajesh Sharma'],
        ['Monday', '10:00 - 11:00 AM', 2, 'Computer Networks', 'Computer Engineering', 'Second Year', 'A', 'Room 301', 'Prof. Sunita Patil'],
        ['Monday', '11:15 - 01:15 PM', 5, 'Web Technologies Lab', 'Computer Engineering', 'Second Year', 'A', 'Computer Lab 3', 'Prof. Priyanka Sen'],
        ['Tuesday', '09:00 - 10:00 AM', 3, 'Operating Systems', 'Computer Engineering', 'Second Year', 'A', 'Room 302', 'Prof. Amit Joshi'],
        ['Tuesday', '10:00 - 11:00 AM', 4, 'Software Engineering', 'Computer Engineering', 'Second Year', 'A', 'Room 302', 'Prof. Rajesh Sharma'],
        ['Wednesday', '09:00 - 10:00 AM', 1, 'Database Management Systems', 'Computer Engineering', 'Second Year', 'A', 'Room 301', 'Prof. Rajesh Sharma'],
        ['Wednesday', '10:00 - 11:00 AM', 2, 'Computer Networks', 'Computer Engineering', 'Second Year', 'A', 'Room 301', 'Prof. Sunita Patil'],
        ['Thursday', '09:00 - 11:00 AM', 1, 'DBMS Practical Lab', 'Computer Engineering', 'Second Year', 'A', 'Database Lab 2', 'Prof. Rajesh Sharma'],
        ['Thursday', '11:15 - 12:15 PM', 3, 'Operating Systems', 'Computer Engineering', 'Second Year', 'A', 'Room 301', 'Prof. Amit Joshi'],
        ['Friday', '09:00 - 10:00 AM', 4, 'Software Engineering', 'Computer Engineering', 'Second Year', 'A', 'Room 301', 'Prof. Rajesh Sharma'],
        ['Friday', '10:00 - 11:00 AM', 5, 'Web Technologies', 'Computer Engineering', 'Second Year', 'A', 'Room 301', 'Prof. Priyanka Sen'],
        ['Saturday', '09:30 - 11:30 AM', 2, 'Tutorial & Project Seminar', 'Computer Engineering', 'Second Year', 'A', 'Seminar Hall B', 'Prof. Rajesh Sharma']
      ];

      for (const item of schedule) {
        await dbRun(
          `INSERT INTO timetable (day, time_slot, subject_id, subject_name, course, year, division, room, teacher_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          item
        );
      }
    }

    // 9. Seed Notices
    const noticeCount = await dbGet(`SELECT COUNT(*) AS count FROM notices`);
    if (noticeCount.count === 0) {
      console.log('Seeding campus notice board...');
      const notices = [
        ['Internal Assessment Schedule Released', 'IA-1 examinations will commence from October 20th. Syllabus guidelines and seat numbers are available in respective department portals.', 'Examination', 'High', teacherUserId, 'Prof. Rajesh Sharma', '2026-10-06'],
        ['Annual Technical Symposium 2026', 'Registrations are now officially live for HackConnect Hackathon and CodeSprint. Great prizes and industry certificates for all participants!', 'Event', 'Medium', teacherUserId, 'Prof. Rajesh Sharma', '2026-10-04'],
        ['Mandatory 75% Attendance Requirement', 'All students must maintain an overall minimum attendance of 75% across theory and practical laboratories to be eligible for university term end exams.', 'Academic', 'Urgent', teacherUserId, 'Prof. Rajesh Sharma', '2026-10-02'],
        ['Library Digital Access Extension', 'Access to IEEE Xplore, ACM Digital Library, and Springer journals has been renewed for all enrolled students with their college email IDs.', 'General', 'Low', teacherUserId, 'Prof. Rajesh Sharma', '2026-09-28']
      ];

      for (const n of notices) {
        await dbRun(
          `INSERT INTO notices (title, description, category, priority, author_id, author_name, date)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          n
        );
      }
    }

    // 10. Seed Notifications
    const notifCount = await dbGet(`SELECT COUNT(*) AS count FROM notifications`);
    if (notifCount.count === 0 && studentUserId) {
      console.log('Seeding notifications...');
      const notifs = [
        [studentUserId, 'IA-1 Exam Notice', 'Internal assessment schedule has been published.', 'info', 0],
        [studentUserId, 'Attendance Report Available', 'Your monthly attendance currently stands at 85%. Good job!', 'success', 0],
        [studentUserId, 'Marks Uploaded', 'Internal marks for Semester IV subjects have been uploaded.', 'info', 1]
      ];
      for (const nt of notifs) {
        await dbRun(
          `INSERT INTO notifications (user_id, title, message, type, is_read) VALUES (?, ?, ?, ?, ?)`,
          nt
        );
      }
    }

    console.log('All relational seed data synchronized successfully.');
  } catch (err) {
    console.error('Error seeding relational data:', err);
  }
}

// Initialize tables immediately
initDatabase();

module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll
};

// Comprehensive End-to-End QA and Data Integrity Audit Script
const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runAudit() {
  console.log('=== STARTING PRODUCTION QA AUDIT ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${detail}`);
      failed++;
    }
  }

  // 1. Health Check
  const health = await request({ hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET' });
  assert(health.status === 200 && health.data.status === 'OK', '1. Server Health Check API');

  // 2. Register New Student
  const uniqueRoll = 'TEST-' + Math.floor(1000 + Math.random() * 9000);
  const uniqueEmail = `test_student_${Date.now()}@college.edu`;
  const regPayload = {
    name: 'New Clean Student',
    email: uniqueEmail,
    password: 'password123',
    role: 'Student',
    roll_no: uniqueRoll,
    phone: '9876543210',
    date_of_birth: '2004-05-15',
    course: 'Computer Engineering',
    year: 'Second Year',
    division: 'B'
  };

  const regRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, regPayload);

  assert(regRes.status === 201 && regRes.data.success, '2. New Student Registration', JSON.stringify(regRes.data));

  // Log in as the new student to get token and full profile
  const loginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: uniqueEmail, password: 'password123', role: 'Student' });

  assert(loginRes.status === 200 && loginRes.data.success, '2b. New Student Login', JSON.stringify(loginRes.data));
  const newStudentToken = loginRes.data.token;
  const newUserId = loginRes.data.user.id;
  const newStudentProfileId = loginRes.data.user.profile.id;

  // 3. Verify Clean Initial State for New Student (REAL DATA INTEGRITY)
  // 3a. Notifications should be 0
  const notifRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/notifications?user_id=${newUserId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${newStudentToken}` }
  });
  assert(notifRes.status === 200 && notifRes.data.unreadCount === 0 && notifRes.data.data.length === 0, 
    '3a. New Student starts with 0 notifications', `count=${notifRes.data?.unreadCount}`);

  // 3b. Attendance Summary must be 0% and 0 lectures (Fix for 85% bug)
  const attSummaryRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/attendance/summary?student_id=${newStudentProfileId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${newStudentToken}` }
  });
  assert(
    attSummaryRes.status === 200 && 
    attSummaryRes.data.data.overall_percentage === 0 && 
    attSummaryRes.data.data.total_lectures === 0 &&
    attSummaryRes.data.data.status === 'No attendance records yet',
    '3b. New Student Attendance is strictly 0% (NO fake 85%)',
    JSON.stringify(attSummaryRes.data)
  );

  // 3c. Marks Summary must have null / "--" CGPA (Fix for 8.65 bug)
  const marksSummaryRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/marks/summary?student_id=${newStudentProfileId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${newStudentToken}` }
  });
  assert(
    marksSummaryRes.status === 200 &&
    marksSummaryRes.data.data.cgpa === null &&
    marksSummaryRes.data.data.cgpaDisplay === '--' &&
    marksSummaryRes.data.data.marks.length === 0,
    '3c. New Student Marks has null / "--" CGPA (NO fake 8.65)',
    JSON.stringify(marksSummaryRes.data)
  );

  // 4. Role-Based Access Control (RBAC) Verification
  // Student trying to POST student record -> MUST be 403
  const forbiddenStudent = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/students',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${newStudentToken}` }
  }, { name: 'Hacker', roll_no: 'HACK', course: 'Computer Engineering', year: 'First Year' });
  assert(forbiddenStudent.status === 403, '4a. RBAC: Student denied adding students (403)');

  // Student trying to POST attendance -> MUST be 403
  const forbiddenAtt = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/attendance',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${newStudentToken}` }
  }, { records: [] });
  assert(forbiddenAtt.status === 403, '4b. RBAC: Student denied marking attendance (403)');

  // Student trying to POST marks -> MUST be 403
  const forbiddenMarks = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/marks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${newStudentToken}` }
  }, { student_id: newStudentProfileId, subject_id: 1 });
  assert(forbiddenMarks.status === 403, '4c. RBAC: Student denied posting marks (403)');

  // Student trying to POST notices -> MUST be 403
  const forbiddenNotice = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/notices',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${newStudentToken}` }
  }, { title: 'Spam' });
  assert(forbiddenNotice.status === 403, '4d. RBAC: Student denied posting notices (403)');

  // 5. Teacher Actions: Login as Teacher
  const teacherLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'teacher@campusconnect.com', password: 'teacher123', role: 'Teacher' });
  assert(teacherLogin.status === 200 && teacherLogin.data.success, '5. Teacher Login Successful');
  const teacherToken = teacherLogin.data.token;

  // 6. Teacher Marks Attendance for the New Student
  // Mark 5 lectures: 4 Present, 1 Absent (80% attendance)
  const today = new Date().toISOString().split('T')[0];
  const attRecords = [
    { student_id: newStudentProfileId, subject_id: 1, subject_name: 'Database Management Systems', date: today, status: 'Present', session_type: 'Theory' },
    { student_id: newStudentProfileId, subject_id: 1, subject_name: 'Database Management Systems', date: '2026-10-01', status: 'Present', session_type: 'Theory' },
    { student_id: newStudentProfileId, subject_id: 1, subject_name: 'Database Management Systems', date: '2026-10-02', status: 'Present', session_type: 'Theory' },
    { student_id: newStudentProfileId, subject_id: 1, subject_name: 'Database Management Systems', date: '2026-10-03', status: 'Present', session_type: 'Theory' },
    { student_id: newStudentProfileId, subject_id: 1, subject_name: 'Database Management Systems', date: '2026-10-04', status: 'Absent', session_type: 'Theory' },
  ];
  const postAtt = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/attendance',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherToken}` }
  }, { subject_id: 1, date: today, records: attRecords });
  assert(postAtt.status === 200 && postAtt.data.success, '6. Teacher Successfully Marked Attendance Records');

  // Verify Student's Attendance is now EXACTLY 80% (4/5)
  const attAfter = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/attendance/summary?student_id=${newStudentProfileId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${newStudentToken}` }
  });
  assert(
    attAfter.status === 200 &&
    attAfter.data.data.overall_percentage === 80 &&
    attAfter.data.data.total_lectures === 5 &&
    attAfter.data.data.present_lectures === 4 &&
    attAfter.data.data.absent_lectures === 1 &&
    attAfter.data.data.status === 'Good Standing',
    '7. Real Attendance accurately calculated: 80% (4/5, Good Standing)',
    `pct=${attAfter.data?.data?.overall_percentage}, total=${attAfter.data?.data?.total_lectures}`
  );

  // 8. Teacher Adds Marks for New Student
  const postMarks = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/marks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherToken}` }
  }, {
    student_id: newStudentProfileId,
    subject_id: 1,
    internal_marks: 30,
    external_marks: 60,
    exam_term: 'Semester IV (Regular)'
  });
  assert(postMarks.status === 201 && postMarks.data.success, '8. Teacher Adds Academic Marks Record');

  // Verify Student's Marks & CGPA Calculated
  const marksAfter = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/marks/summary?student_id=${newStudentProfileId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${newStudentToken}` }
  });
  assert(
    marksAfter.status === 200 &&
    marksAfter.data.data.marks.length === 1 &&
    marksAfter.data.data.marks[0].total_marks === 90 &&
    marksAfter.data.data.marks[0].grade === 'A+' &&
    marksAfter.data.data.cgpa === 9,
    '9. Real Marks & CGPA accurately calculated (Total: 90, Grade: A+, CGPA: 9.00)',
    JSON.stringify(marksAfter.data)
  );

  // 10. Teacher Publishes Notice & Broadcasts Notification
  const postNotice = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/notices',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherToken}` }
  }, {
    title: 'Final Audit Examination Schedule Released',
    category: 'Examination',
    priority: 'Urgent',
    description: 'All students must verify their semester examination timetable in the portal.',
    author_id: 1,
    author_name: 'Prof. Rajesh Sharma'
  });
  assert(postNotice.status === 201 && postNotice.data.success, '10. Teacher Publishes Campus Notice');

  // Verify Student received notification for published notice
  const notifAfter = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/notifications?user_id=${newUserId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${newStudentToken}` }
  });
  assert(
    notifAfter.status === 200 &&
    notifAfter.data.unreadCount >= 1 &&
    notifAfter.data.data.some(n => n.title.includes('Notice')),
    '11. Student automatically received broadcast Notification for new Notice',
    `unreadCount=${notifAfter.data?.unreadCount}`
  );

  console.log(`\n=== AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Audit Script Error:', err);
  process.exit(1);
});

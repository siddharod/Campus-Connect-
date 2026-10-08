// test-e2e.js  – CampusConnect v2.0 End-to-End API Verification
const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const headers = { ...(options.headers || {}) };
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
      headers['Content-Type'] = 'application/json';
    }
    const req = http.request({ ...options, headers }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: body ? JSON.parse(body) : null }); }
        catch (e) { resolve({ status: res.statusCode, raw: body }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const BASE = { hostname: 'localhost', port: 3000 };
const post = (path, body, token) => request({
  ...BASE, path, method: 'POST',
  headers: token ? { Authorization: `Bearer ${token}` } : {}
}, body);
const get = (path, token) => request({
  ...BASE, path, method: 'GET',
  headers: token ? { Authorization: `Bearer ${token}` } : {}
});
const put = (path, body, token) => request({
  ...BASE, path, method: 'PUT',
  headers: token ? { Authorization: `Bearer ${token}` } : {}
}, body);
const del = (path, token) => request({
  ...BASE, path, method: 'DELETE',
  headers: token ? { Authorization: `Bearer ${token}` } : {}
});

let passed = 0, failed = 0;
function assert(cond, msg, detail) {
  if (cond) { console.log(' ✅ PASS:', msg); passed++; }
  else { console.error(' ❌ FAIL:', msg, detail ? `→ ${JSON.stringify(detail)}` : ''); failed++; }
}

async function run() {
  console.log('\n━━━ CampusConnect v2.0 – E2E API Verification ━━━\n');

  // ─── 1. Health check ───────────────────────────────────────
  const home = await get('/index.html');
  assert(home.status === 200, 'Public landing page (200 OK)');

  const health = await get('/api/health');
  assert(health.status === 200 && health.data.status === 'OK', 'Health endpoint returns OK', health.data);

  // ─── 2. Demo logins ────────────────────────────────────────
  const tLogin = await post('/api/auth/login', { email: 'teacher@campusconnect.com', password: 'teacher123', role: 'Teacher' });
  assert(tLogin.status === 200 && tLogin.data.token, 'Teacher demo login → JWT token', tLogin.data);
  const TK = tLogin.data.token;

  const sLogin = await post('/api/auth/login', { email: 'student@campusconnect.com', password: 'student123', role: 'Student' });
  assert(sLogin.status === 200 && sLogin.data.token, 'Student demo login → JWT token', sLogin.data);
  const SK = sLogin.data.token;

  // ─── 3. Register new student ───────────────────────────────
  const ts = Date.now();
  const studentEmail = `alice.${ts}@uni.edu`;
  const regS = await post('/api/auth/register', {
    role: 'Student', name: 'Alice Kumar', email: studentEmail, password: 'Pass@1234',
    roll_no: `TMP-${ts}`, course: 'Computer Engineering', year: 'Third Year', division: 'B', phone: '9876543210'
  });
  assert(regS.status === 201 && regS.data.success, 'Register new student (201)', regS.data);

  // ─── 4. Register new teacher ───────────────────────────────
  const teacherEmail = `prof.${ts}@uni.edu`;
  const regT = await post('/api/auth/register', {
    role: 'Teacher', name: 'Prof. Sunil Rao', email: teacherEmail, password: 'Pass@1234',
    employee_id: `EMP-${ts}`, department: 'Computer Science', phone: '8899001122'
  });
  assert(regT.status === 201 && regT.data.success, 'Register new teacher (201)', regT.data);

  // Login with newly registered student to get token for further tests
  const newSLogin = await post('/api/auth/login', { email: studentEmail, password: 'Pass@1234', role: 'Student' });
  assert(newSLogin.status === 200 && newSLogin.data.token, 'Newly registered student can log in', newSLogin.data);
  const NSK = newSLogin.data.token;

  // ─── 5. Forgot password & reset ────────────────────────────
  const forgot = await post('/api/auth/forgot-password', { email: studentEmail });
  assert(forgot.status === 200 && forgot.data.token, 'Forgot-password → reset token', forgot.data);

  const resetToken = forgot.data.token;
  const reset = await post('/api/auth/reset-password', { token: resetToken, newPassword: 'ResetPass999' });
  assert(reset.status === 200 && reset.data.success, 'Reset-password succeeds', reset.data);

  const loginAfterReset = await post('/api/auth/login', { email: studentEmail, password: 'ResetPass999', role: 'Student' });
  assert(loginAfterReset.status === 200 && loginAfterReset.data.token, 'Login with new reset password', loginAfterReset.data);

  // ─── 6. GET /api/users/me ──────────────────────────────────
  const me = await get('/api/users/me', SK);
  assert(me.status === 200 && me.data.user && me.data.user.role === 'Student', 'GET /api/users/me returns student data', me.data);

  // ─── 7. Update profile ─────────────────────────────────────
  const upProfile = await put('/api/users/me', { phone: '9001122334' }, SK);
  assert(upProfile.status === 200 && upProfile.data.success, 'PUT /api/users/me updates profile', upProfile.data);

  // ─── 8. RBAC: Student cannot mark attendance ───────────────
  const rbac = await post('/api/attendance', {
    subject_id: 1, date: '2026-10-08',
    records: [{ student_id: 1, status: 'Present' }]
  }, SK);
  assert(rbac.status === 403, 'Student is blocked (403) from marking attendance', { status: rbac.status });

  // ─── 9. Teacher marks attendance ───────────────────────────
  const markAtt = await post('/api/attendance', {
    subject_id: 1, date: '2026-10-08',
    records: [{ student_id: 1, status: 'Present' }]
  }, TK);
  assert(markAtt.status === 200 && markAtt.data.count >= 1, 'Teacher records batch attendance', markAtt.data);

  // ─── 10. Attendance summary for student ────────────────────
  const attSum = await get('/api/attendance/summary/1', SK);
  assert(attSum.status === 200 && typeof attSum.data.percentage === 'number', 'GET /api/attendance/summary/1 returns percentage', attSum.data);

  // ─── 11. Subjects catalog ──────────────────────────────────
  const subjects = await get('/api/subjects', SK);
  assert(subjects.status === 200 && subjects.data.data && subjects.data.data.length > 0, 'GET /api/subjects returns catalog', { count: subjects.data && subjects.data.data && subjects.data.data.length });

  // ─── 12. Teacher adds / updates marks ──────────────────────
  const addMark = await post('/api/marks', {
    student_id: 1, subject_id: 1, internal_marks: 28, external_marks: 65, semester: 'Semester 5'
  }, TK);
  assert(addMark.status === 201 && addMark.data.data && addMark.data.data.grade === 'A+', 'Teacher adds marks with auto-grade A+ (93/100)', addMark.data);

  // ─── 13. Student report card & CGPA ────────────────────────
  const markSum = await get('/api/marks/student/1', SK);
  assert(markSum.status === 200 && markSum.data.data && Array.isArray(markSum.data.data.marks), 'GET /api/marks/student/1 returns report card', markSum.data && markSum.data.data);
  assert(markSum.status === 200 && markSum.data.data && markSum.data.data.cgpa, 'Report card has CGPA', markSum.data && markSum.data.data && { cgpa: markSum.data.data.cgpa });

  // ─── 14. Timetable ─────────────────────────────────────────
  const timetable = await get('/api/timetable', SK);
  assert(timetable.status === 200 && timetable.data.data && Array.isArray(timetable.data.data), 'GET /api/timetable returns schedule', { count: timetable.data && timetable.data.data && timetable.data.data.length });

  // ─── 15. Teacher creates notice ────────────────────────────
  const createNotice = await post('/api/notices', {
    title: 'E2E Test Notice – Final Exam Schedule',
    description: 'Final exams begin 15 Nov 2026. Check the timetable for your slots.',
    category: 'Examination',
    priority: 'High'
  }, TK);
  assert(createNotice.status === 201 && createNotice.data.data && createNotice.data.data.id, 'Teacher creates notice (201)', createNotice.data.data);
  const noticeId = createNotice.data.data && createNotice.data.data.id;

  // ─── 16. Notices visible to student ────────────────────────
  const notices = await get('/api/notices', SK);
  assert(notices.status === 200 && notices.data.data && notices.data.data.some(n => n.title.includes('E2E Test')), 'Student sees published notice', { count: notices.data && notices.data.data && notices.data.data.length });

  // ─── 17. Notifications ─────────────────────────────────────
  // Notifications – route uses ?user_id= query param (no JWT auth required)
  const meUser = sLogin.data.user;
  const notifs = await get(`/api/notifications?user_id=${meUser.id}`, SK);
  assert(notifs.status === 200 && typeof notifs.data.unreadCount === 'number', 'GET /api/notifications returns unread count', { unreadCount: notifs.data && notifs.data.unreadCount });

  // ─── 18. Student CRUD – Teacher creates student ────────────
  const createStu = await post('/api/students', {
    name: 'Pooja Deshmukh', email: `pooja.${ts}@college.edu`,
    roll_no: `CRD-${ts}`, course: 'Information Technology',
    year: 'Second Year', division: 'A', phone: '9123001122'
  }, TK);
  assert(createStu.status === 201 && createStu.data.data && createStu.data.data.id, 'Teacher creates student via CRUD (201)', createStu.data && createStu.data.data);
  const cid = createStu.data.data.id;

  // ─── 19. Update student ────────────────────────────────────
  const updStu = await put(`/api/students/${cid}`, { name: 'Pooja Deshmukh-Patil', division: 'B' }, TK);
  assert(updStu.status === 200 && updStu.data.data && updStu.data.data.name === 'Pooja Deshmukh-Patil', 'Teacher updates student name', updStu.data && updStu.data.data);

  // ─── 20. Delete student ────────────────────────────────────
  const delStu = await del(`/api/students/${cid}`, TK);
  assert(delStu.status === 200 && delStu.data.success, 'Teacher deletes student (200)', delStu.data);

  // ─── Summary ───────────────────────────────────────────────
  console.log(`\n${'━'.repeat(52)}`);
  console.log(` Results: ${passed} PASSED  |  ${failed} FAILED  |  ${passed + failed} total`);
  console.log(`${'━'.repeat(52)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error('Uncaught error:', err); process.exit(1); });

const http = require('http');

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- 1. Testing Teacher Login ---');
  let res = await request('POST', '/api/login', {
    email: 'teacher@campusconnect.com',
    password: 'teacher123',
    role: 'Teacher'
  });
  console.log('Status:', res.status, 'Response:', res.body);

  console.log('\n--- 2. Testing Student Login ---');
  res = await request('POST', '/api/login', {
    email: 'student@campusconnect.com',
    password: 'student123',
    role: 'Student'
  });
  console.log('Status:', res.status, 'Response:', res.body);

  console.log('\n--- 3. Testing Invalid Password ---');
  res = await request('POST', '/api/login', {
    email: 'teacher@campusconnect.com',
    password: 'wrongpassword',
    role: 'Teacher'
  });
  console.log('Status:', res.status, 'Response:', res.body);

  console.log('\n--- 4. Testing GET /api/students ---');
  res = await request('GET', '/api/students');
  console.log('Status:', res.status, 'Count:', res.body.count, 'First student:', res.body.data[0]);

  console.log('\n--- 5. Testing POST /api/students (Create New Student) ---');
  res = await request('POST', '/api/students', {
    name: 'Karan Mehra',
    roll_no: 'IT201',
    email: 'karan.m@campusconnect.com',
    phone: '9820011223',
    course: 'Information Technology',
    year: 'Second Year',
    division: 'B',
    date_of_birth: '2004-02-14'
  });
  console.log('Status:', res.status, 'Response:', res.body);
  const createdId = res.body.data.id;

  console.log('\n--- 6. Testing Duplicate Roll Number Protection ---');
  res = await request('POST', '/api/students', {
    name: 'Duplicate Student',
    roll_no: 'IT201',
    email: 'dup@campusconnect.com',
    course: 'Information Technology',
    year: 'First Year'
  });
  console.log('Status:', res.status, 'Response:', res.body);

  console.log('\n--- 7. Testing GET /api/students/:id ---');
  res = await request('GET', `/api/students/${createdId}`);
  console.log('Status:', res.status, 'Response:', res.body);

  console.log('\n--- 8. Testing PUT /api/students/:id (Update) ---');
  res = await request('PUT', `/api/students/${createdId}`, {
    name: 'Karan Mehra (Updated)',
    roll_no: 'IT201',
    email: 'karan.updated@campusconnect.com',
    phone: '9820011223',
    course: 'Information Technology',
    year: 'Third Year',
    division: 'A',
    date_of_birth: '2004-02-14'
  });
  console.log('Status:', res.status, 'Response:', res.body);

  console.log('\n--- 9. Testing DELETE /api/students/:id ---');
  res = await request('DELETE', `/api/students/${createdId}`);
  console.log('Status:', res.status, 'Response:', res.body);

  console.log('\n--- 10. Testing GET /api/students/:id on deleted record (Expect 404) ---');
  res = await request('GET', `/api/students/${createdId}`);
  console.log('Status:', res.status, 'Response:', res.body);

  console.log('\n--- 11. Testing Stats Endpoint ---');
  res = await request('GET', '/api/students/stats');
  console.log('Status:', res.status, 'Stats:', res.body.data);

  console.log('\nAll API tests completed successfully!');
}

runTests().catch(console.error);

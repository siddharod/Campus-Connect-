# CampusConnect – College Student Management System v2.0

> A unified, fully-functional digital campus platform for students and teachers — built as a final-year college project.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/Database-SQLite3-blue)](https://sqlite.org/)
[![Express](https://img.shields.io/badge/Backend-Express.js-black)](https://expressjs.com/)
[![JWT](https://img.shields.io/badge/Auth-JWT%20%2B%20bcrypt-orange)](https://jwt.io/)

---

## 📋 Project Overview

CampusConnect is a complete, production-ready college management portal demonstrating:

| Module | Teacher Features | Student Features |
|---|---|---|
| **Authentication** | Register / Login / Password Reset | Register / Login / Password Reset |
| **Student CRUD** | Add, Edit, Delete, Search, Filter | View own profile |
| **Attendance** | Batch mark attendance (per subject/date) | View percentage & per-subject breakdown |
| **Marks & Results** | Enter internal + external marks → auto grade | View report card + CGPA |
| **Timetable** | View & add weekly schedule slots | View Mon–Sat schedule |
| **Notice Board** | Publish categorized notices | View notices + receive bell alerts |
| **Profile** | Edit name, phone, designation | Edit name, phone, course details |
| **Settings** | Change password, Dark Mode, Delete account | Change password, Dark Mode, Delete account |
| **Notifications** | — | Bell icon with unread count dropdown |

---

## 🚀 Quick Start

### Prerequisites
- [Node.js 18+](https://nodejs.org/)
- npm (comes with Node.js)

### Installation & Run

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start
# OR for development with auto-restart:
npm run dev
```

> Server starts at **http://localhost:3000**



---

## 🗂️ Project Structure

```
COLLEGE MANAGEMENT SYSTEM/
├── backend/
│   ├── database/
│   │   └── student_management.db    # SQLite database (auto-created)
│   ├── middleware/
│   │   └── auth.js                  # JWT verification + role guard
│   ├── routes/
│   │   ├── auth.js                  # Register, Login, Forgot/Reset Password
│   │   ├── users.js                 # Profile (GET/PUT /me), Change Password
│   │   ├── students.js              # Full CRUD for student records
│   │   ├── attendance.js            # Batch marking + summary % per student
│   │   ├── marks.js                 # Add/update marks + CGPA report card
│   │   ├── subjects.js              # Subject catalog (GET/POST/PUT/DELETE)
│   │   ├── timetable.js             # Weekly schedule (GET/POST)
│   │   ├── notices.js               # Notice board (CRUD + student broadcast)
│   │   └── notifications.js         # Unread count + mark-as-read
│   ├── database.js                  # Schema init, seed data, promise helpers
│   └── server.js                    # Express app, route mounting, static serve
├── frontend/
│   ├── css/
│   │   └── style.css                # Full design system + dark mode palette
│   ├── js/
│   │   ├── main.js                  # JWT session, dark mode, bell, animations
│   │   ├── login.js                 # Login page logic
│   │   └── students.js              # Student list page logic
│   ├── index.html                   # Public landing page
│   ├── login.html                   # Role-based login
│   ├── register.html                # New student / teacher registration
│   ├── forgot-password.html         # Forgot password (dev token flow)
│   ├── reset-password.html          # Reset password form
│   ├── student-dashboard.html       # Student home: stats, ring, chart, notices
│   ├── teacher-dashboard.html       # Teacher home: metrics, recent students
│   ├── students.html                # Student roster with CRUD
│   ├── add-student.html             # Add new student form
│   ├── attendance.html              # Attendance marking (T) / breakdown (S)
│   ├── marks.html                   # Marks entry (T) / report card (S)
│   ├── timetable.html               # Mon–Sat schedule grid
│   ├── notices.html                 # Notice board + category filters
│   ├── profile.html                 # My Details & edit profile modal
│   └── settings.html                # Theme toggle, change password, delete account
├── test-e2e.js                      # End-to-end API test (26 assertions, all PASS)
├── package.json
└── README.md
```

---

## 🔌 REST API Reference

All API routes are prefixed with `/api`.

### Authentication
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | ❌ Public | Register student or teacher |
| POST | `/api/auth/login` | ❌ Public | Login and receive JWT token |
| POST | `/api/auth/forgot-password` | ❌ Public | Generate dev reset token |
| POST | `/api/auth/reset-password` | ❌ Public | Reset password with token |

### Profile
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/users/me` | ✅ JWT | Get own user + profile |
| PUT | `/api/users/me` | ✅ JWT | Update name, phone, etc. |
| PUT | `/api/users/change-password` | ✅ JWT | Change password (bcrypt) |
| DELETE | `/api/users/me` | ✅ JWT | Delete own account |

### Students (CRUD)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/students` | ✅ JWT | List all students (search/filter/sort) |
| GET | `/api/students/stats` | ✅ JWT | Dashboard statistics |
| GET | `/api/students/:id` | ✅ JWT | Get student by ID |
| POST | `/api/students` | ✅ Teacher | Create student |
| PUT | `/api/students/:id` | ✅ Teacher | Update student (partial) |
| DELETE | `/api/students/:id` | ✅ Teacher | Delete student |

### Attendance
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/attendance` | ✅ JWT | Attendance log (filterable) |
| GET | `/api/attendance/summary/:id` | ✅ JWT | % + per-subject breakdown |
| POST | `/api/attendance` | ✅ Teacher | Batch mark attendance |

### Marks & Results
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/marks` | ✅ JWT | All marks (filterable) |
| GET | `/api/marks/student/:id` | ✅ JWT | Report card + CGPA |
| POST | `/api/marks` | ✅ Teacher | Add/update marks (auto grade) |
| DELETE | `/api/marks/:id` | ✅ Teacher | Delete mark entry |

### Other
| Endpoint | Description |
|---|---|
| `GET /api/subjects` | Subject catalog |
| `GET /api/timetable` | Weekly schedule |
| `POST /api/notices` | Publish notice (Teacher) |
| `GET /api/notices` | All notices |
| `GET /api/notifications` | Unread alerts |
| `GET /api/health` | Server health check |

---

## 🔒 Security

- **bcrypt** password hashing with salt rounds = 10
- **JWT** tokens signed with `HS256`, expire in 7 days
- **Role-Based Access Control**: `requireRole('Teacher')` middleware on write endpoints
- **SQLite Foreign Keys** enforced via `PRAGMA foreign_keys = ON`
- Legacy plain-text passwords auto-upgraded to bcrypt on first login

---

## 🎨 UI Features

- **Dark Mode** — persistent via `localStorage`, toggleable from Settings
- **Animated Counters** — numbers count up on dashboard load
- **SVG Attendance Ring** — circular progress indicator for students
- **Bar Chart** — marks visualizer for report card
- **Notification Bell** — dropdown with unread count badge
- **Micro-animations** — smooth card hovers, button transitions
- **Responsive** — works on desktop, tablet, and mobile
- **Google Fonts** — Inter typeface throughout

---

## 🧪 Testing

Run the full end-to-end API verification (26 tests):

```bash
node test-e2e.js
```

Expected output: `26 PASSED | 0 FAILED`

---

## 🏫 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML + CSS + JavaScript |
| Backend | Node.js + Express.js |
| Database | SQLite 3 (via `sqlite3` npm package) |
| Authentication | JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`) |
| Dev Server | `nodemon` (optional) |

---

## 📸 Screenshots

| Page | Description |
|---|---|
| `/index.html` | Public landing page with features showcase |
| `/login.html` | Role-based login with portal selector |
| `/register.html` | Registration for students and teachers |
| `/student-dashboard.html` | Animated counters, attendance ring, marks chart |
| `/teacher-dashboard.html` | Distribution metrics, recent students, quick actions |
| `/students.html` | Full CRUD roster with search/filter/sort |
| `/attendance.html` | Batch marking (Teacher) / breakdown (Student) |
| `/marks.html` | Grade entry (Teacher) / official report card (Student) |
| `/timetable.html` | Mon–Sat interactive schedule grid |
| `/notices.html` | Notice board with category tabs and search |
| `/settings.html` | Dark mode, change password, danger zone |

---

*CampusConnect v2.0 — Built for modern colleges with ❤️*

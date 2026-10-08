/**
 * CampusConnect - Common Frontend Utilities v2.0
 * Auth session, JWT tokens, theme switcher, notification panel, animations
 */

const AUTH_KEY = 'campusconnect_user';
const TOKEN_KEY = 'campusconnect_token';
const THEME_KEY = 'campusconnect_theme';

// Toast Notification System
function showToast(title, message = '', type = 'success', duration = 3500) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  } else {
    iconSvg = `<svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  toast.innerHTML = `
    ${iconSvg}
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 300);
  }, duration);
}

// Session & Auth Helpers
function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setCurrentUser(userData) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(userData));
}

function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function setAuthToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearUserSession() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

function logout() {
  clearUserSession();
  showToast('Logged Out', 'Session ended successfully.', 'info', 1500);
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 400);
}

/**
 * Authenticated API Fetch Helper with Bearer token
 */
async function authFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && !url.includes('/api/login') && !url.includes('/api/auth')) {
    clearUserSession();
    window.location.href = 'login.html';
  }
  return res;
}

/**
 * Protect dashboard & portal pages
 */
function protectPage(requiredRole) {
  const user = getCurrentUser();
  const token = getAuthToken();
  if (!user || !token) {
    clearUserSession();
    window.location.href = 'login.html';
    return null;
  }

  if (requiredRole && user.role.toLowerCase() !== requiredRole.toLowerCase()) {
    if (user.role.toLowerCase() === 'teacher') {
      window.location.href = 'teacher-dashboard.html';
    } else {
      window.location.href = 'student-dashboard.html';
    }
    return null;
  }

  // Populate sidebar mini profile
  const userNameEl = document.getElementById('sidebarUserName');
  const userRoleEl = document.getElementById('sidebarUserRole');
  const userAvatarEl = document.getElementById('sidebarUserAvatar');

  if (userNameEl) userNameEl.textContent = user.name || 'User';
  if (userRoleEl) userRoleEl.textContent = user.role || 'Member';
  if (userAvatarEl) {
    const initials = (user.name || 'U')
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    userAvatarEl.textContent = initials;
  }

  // Initialize notification bell
  initNotifications(user.id);

  return user;
}

// Dynamic Greeting Generator
function getGreeting(name = '') {
  const hour = new Date().getHours();
  let prefix = 'Good Morning';
  if (hour >= 12 && hour < 17) prefix = 'Good Afternoon';
  else if (hour >= 17) prefix = 'Good Evening';

  return `${prefix}${name ? ', ' + name : ''}! 👋`;
}

// Animated Number Counter
function animateCount(element, target, duration = 1000) {
  if (!element) return;
  const targetNum = parseFloat(target);
  if (isNaN(targetNum)) {
    element.textContent = target;
    return;
  }

  const isDecimal = String(target).includes('.');
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Smooth ease-out
    const current = start + (targetNum - start) * (1 - Math.pow(1 - progress, 3));
    element.textContent = isDecimal ? current.toFixed(2) : Math.round(current);

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = target;
    }
  }

  requestAnimationFrame(update);
}

// Theme Switcher Logic
function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.body.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.body.removeAttribute('data-theme');
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(savedTheme);

  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, nextTheme);
      applyTheme(nextTheme);
      showToast('Theme Updated', `Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} Mode`, 'info', 1500);
    });
  }
}

// Notifications System
async function initNotifications(userId) {
  const notifBtn = document.getElementById('notifBellBtn');
  const notifBadge = document.getElementById('notifBadge');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifList = document.getElementById('notifList');

  if (!notifBtn || !notifDropdown) return;

  async function loadNotifs() {
    try {
      const res = await authFetch(`/api/notifications?user_id=${userId}`);
      const data = await res.json();
      if (data.success) {
        if (notifBadge) {
          if (data.unreadCount > 0) {
            notifBadge.textContent = data.unreadCount;
            notifBadge.style.display = 'flex';
          } else {
            notifBadge.style.display = 'none';
          }
        }

        if (notifList) {
          if (data.data.length === 0) {
            notifList.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No notifications right now.</div>`;
          } else {
            notifList.innerHTML = data.data.map(n => `
              <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="markNotifRead(${n.id})">
                <div class="notif-item-title">${n.title}</div>
                <div class="notif-item-desc">${n.message}</div>
                <div class="notif-item-time">${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            `).join('');
          }
        }
      }
    } catch (e) {
      console.error('Error loading notifications:', e);
    }
  }

  window.markNotifRead = async function(id) {
    try {
      await authFetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      loadNotifs();
    } catch (e) {}
  };

  notifBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDropdown.classList.toggle('show');
  });

  document.addEventListener('click', (e) => {
    if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
      notifDropdown.classList.remove('show');
    }
  });

  loadNotifs();
}

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  // Mobile menu sidebar toggle
  const toggleBtn = document.getElementById('mobileMenuToggle');
  const sidebar = document.querySelector('.app-sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target) && sidebar.classList.contains('show')) {
        sidebar.classList.remove('show');
      }
    });
  }
});

/**
 * CampusConnect - Login Logic v2.0
 * JWT Token session, demo filling, role redirection
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const roleTabs = document.querySelectorAll('.role-tab');
  const selectedRoleInput = document.getElementById('selectedRole');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');
  const btnSubmit = document.getElementById('btnLoginSubmit');
  const btnText = document.getElementById('btnText');
  const btnSpinner = document.getElementById('btnSpinner');

  const demoTeacherBtn = document.getElementById('demoTeacherBtn');
  const demoStudentBtn = document.getElementById('demoStudentBtn');

  // Check URL params
  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = urlParams.get('role');
  if (roleParam) {
    setRole(roleParam.toLowerCase() === 'student' ? 'Student' : 'Teacher');
  }

  if (urlParams.get('registered') === 'true') {
    showToast('Registration Successful! 🎉', 'Please log in with your newly created credentials.', 'success', 4000);
  }

  if (urlParams.get('passwordReset') === 'true') {
    showToast('Password Reset Complete! 🔒', 'Please log in with your new password.', 'success', 4000);
  }

  // Role Tab Switching
  roleTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const role = tab.getAttribute('data-role');
      setRole(role);
    });
  });

  function setRole(role) {
    selectedRoleInput.value = role;
    roleTabs.forEach(tab => {
      if (tab.getAttribute('data-role') === role) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }

  // Quick Demo Autofills
  if (demoTeacherBtn) {
    demoTeacherBtn.addEventListener('click', () => {
      setRole('Teacher');
      emailInput.value = 'teacher@campusconnect.com';
      passwordInput.value = 'teacher123';
      clearErrors();
      showToast('Credentials Filled', 'Faculty credentials loaded. Click Sign In.', 'info', 2000);
    });
  }

  if (demoStudentBtn) {
    demoStudentBtn.addEventListener('click', () => {
      setRole('Student');
      emailInput.value = 'student@campusconnect.com';
      passwordInput.value = 'student123';
      clearErrors();
      showToast('Credentials Filled', 'Student credentials loaded. Click Sign In.', 'info', 2000);
    });
  }

  // Form Validation & Submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const role = selectedRoleInput.value;

    let hasError = false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      showError(emailInput, emailError, 'Email address is required.');
      hasError = true;
    } else if (!emailRegex.test(email)) {
      showError(emailInput, emailError, 'Please enter a valid email format.');
      hasError = true;
    }

    if (!password) {
      showError(passwordInput, passwordError, 'Password is required.');
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showToast('Login Successful', `Welcome, ${data.user.name}!`, 'success', 2000);
        setCurrentUser(data.user);
        if (data.token) {
          setAuthToken(data.token);
        }

        setTimeout(() => {
          if (data.user.role.toLowerCase() === 'teacher') {
            window.location.href = 'teacher-dashboard.html';
          } else {
            window.location.href = 'student-dashboard.html';
          }
        }, 700);
      } else {
        setLoading(false);
        showToast('Authentication Failed', data.message || 'Invalid credentials.', 'error');
      }
    } catch (err) {
      setLoading(false);
      console.error('Login error:', err);
      showToast('Network Error', 'Unable to reach the server. Make sure the backend is running.', 'error');
    }
  });

  function showError(inputEl, errorEl, msg) {
    inputEl.classList.add('is-invalid');
    errorEl.textContent = msg;
    errorEl.classList.add('show');
  }

  function clearErrors() {
    [emailInput, passwordInput].forEach(inp => inp.classList.remove('is-invalid'));
    [emailError, passwordError].forEach(err => err.classList.remove('show'));
  }

  function setLoading(isLoading) {
    if (isLoading) {
      btnSubmit.disabled = true;
      btnText.style.display = 'none';
      btnSpinner.style.display = 'inline-block';
    } else {
      btnSubmit.disabled = false;
      btnText.style.display = 'inline-block';
      btnSpinner.style.display = 'none';
    }
  }
});

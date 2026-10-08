/**
 * CampusConnect - Student Management Logic v2.0
 * Live search, multi-field filters, sorting, modals, full CRUD
 */

document.addEventListener('DOMContentLoaded', () => {
  protectPage('Teacher');

  // DOM Elements
  const searchInput = document.getElementById('searchInput');
  const courseFilter = document.getElementById('courseFilter');
  const yearFilter = document.getElementById('yearFilter');
  const divisionFilter = document.getElementById('divisionFilter');
  const sortOrderFilter = document.getElementById('sortOrderFilter');
  const btnResetFilters = document.getElementById('btnResetFilters');
  const recordsCountBadge = document.getElementById('recordsCountBadge');

  const studentsTable = document.getElementById('studentsTable');
  const studentsTableBody = document.getElementById('studentsTableBody');
  const tableLoadingState = document.getElementById('tableLoadingState');
  const tableEmptyState = document.getElementById('tableEmptyState');

  // Add / Edit Modal Elements
  const btnOpenAddModal = document.getElementById('btnOpenAddModal');
  const btnEmptyAddStudent = document.getElementById('btnEmptyAddStudent');
  const studentFormModal = document.getElementById('studentFormModal');
  const formModalTitle = document.getElementById('formModalTitle');
  const studentModalForm = document.getElementById('studentModalForm');
  const closeFormModal = document.getElementById('closeFormModal');
  const btnCancelForm = document.getElementById('btnCancelForm');
  const btnSubmitForm = document.getElementById('btnSubmitForm');
  const btnSubmitFormText = document.getElementById('btnSubmitFormText');
  const btnSubmitFormSpinner = document.getElementById('btnSubmitFormSpinner');

  // Form Fields
  const formId = document.getElementById('studentFormId');
  const formName = document.getElementById('formName');
  const formRollNo = document.getElementById('formRollNo');
  const formEmail = document.getElementById('formEmail');
  const formPhone = document.getElementById('formPhone');
  const formDob = document.getElementById('formDob');
  const formCourse = document.getElementById('formCourse');
  const formYear = document.getElementById('formYear');
  const formDivision = document.getElementById('formDivision');

  // View Modal Elements
  const viewModal = document.getElementById('viewModal');
  const closeViewModal = document.getElementById('closeViewModal');
  const btnCloseView = document.getElementById('btnCloseView');
  const btnEditFromView = document.getElementById('btnEditFromView');
  const viewAvatar = document.getElementById('viewAvatar');
  const viewName = document.getElementById('viewName');
  const viewCourseBadge = document.getElementById('viewCourseBadge');
  const viewYearBadge = document.getElementById('viewYearBadge');
  const viewId = document.getElementById('viewId');
  const viewRoll = document.getElementById('viewRoll');
  const viewEmail = document.getElementById('viewEmail');
  const viewPhone = document.getElementById('viewPhone');
  const viewCourse = document.getElementById('viewCourse');
  const viewYear = document.getElementById('viewYear');
  const viewDivision = document.getElementById('viewDivision');
  const viewDob = document.getElementById('viewDob');

  // Delete Modal Elements
  const deleteConfirmModal = document.getElementById('deleteConfirmModal');
  const closeDeleteModal = document.getElementById('closeDeleteModal');
  const btnCancelDelete = document.getElementById('btnCancelDelete');
  const btnConfirmDelete = document.getElementById('btnConfirmDelete');
  const deleteTargetInfo = document.getElementById('deleteTargetInfo');
  const btnDeleteText = document.getElementById('btnDeleteText');
  const btnDeleteSpinner = document.getElementById('btnDeleteSpinner');

  let currentStudentsList = [];
  let studentToDeleteId = null;
  let currentlyViewedStudent = null;

  fetchStudents();

  // Listeners
  let searchTimeout = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(fetchStudents, 250);
  });

  courseFilter.addEventListener('change', fetchStudents);
  yearFilter.addEventListener('change', fetchStudents);
  if (divisionFilter) divisionFilter.addEventListener('change', fetchStudents);
  if (sortOrderFilter) sortOrderFilter.addEventListener('change', fetchStudents);

  btnResetFilters.addEventListener('click', () => {
    searchInput.value = '';
    courseFilter.value = 'All';
    yearFilter.value = 'All';
    if (divisionFilter) divisionFilter.value = 'All';
    if (sortOrderFilter) sortOrderFilter.value = 'id_desc';
    fetchStudents();
  });

  if (btnOpenAddModal) btnOpenAddModal.addEventListener('click', openAddModal);
  if (btnEmptyAddStudent) btnEmptyAddStudent.addEventListener('click', openAddModal);

  [closeFormModal, btnCancelForm].forEach(btn => {
    if (btn) btn.addEventListener('click', () => studentFormModal.classList.remove('show'));
  });

  [closeViewModal, btnCloseView].forEach(btn => {
    if (btn) btn.addEventListener('click', () => viewModal.classList.remove('show'));
  });

  [closeDeleteModal, btnCancelDelete].forEach(btn => {
    if (btn) btn.addEventListener('click', () => deleteConfirmModal.classList.remove('show'));
  });

  if (btnEditFromView) {
    btnEditFromView.addEventListener('click', () => {
      viewModal.classList.remove('show');
      if (currentlyViewedStudent) openEditModal(currentlyViewedStudent);
    });
  }

  [studentFormModal, viewModal, deleteConfirmModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('show');
      });
    }
  });

  async function fetchStudents() {
    setLoadingState(true);

    const term = searchInput.value.trim();
    const course = courseFilter.value;
    const year = yearFilter.value;

    const params = new URLSearchParams();
    if (term) params.append('search', term);
    if (course && course !== 'All') params.append('course', course);
    if (year && year !== 'All') params.append('year', year);

    try {
      const res = await authFetch(`/api/students?${params.toString()}`);
      const data = await res.json();
      setLoadingState(false);

      if (data.success) {
        let list = data.data || [];

        // Apply division filter
        if (divisionFilter && divisionFilter.value !== 'All') {
          list = list.filter(s => (s.division || 'A') === divisionFilter.value);
        }

        // Apply sorting
        if (sortOrderFilter) {
          const sortVal = sortOrderFilter.value;
          if (sortVal === 'name_asc') {
            list.sort((a, b) => a.name.localeCompare(b.name));
          } else if (sortVal === 'roll_asc') {
            list.sort((a, b) => a.roll_no.localeCompare(b.roll_no));
          } else {
            list.sort((a, b) => b.id - a.id);
          }
        }

        currentStudentsList = list;
        renderStudentsTable(currentStudentsList);
      } else {
        showToast('Error', data.message || 'Failed to fetch student records.', 'error');
      }
    } catch (err) {
      setLoadingState(false);
      console.error(err);
      showToast('Connection Error', 'Could not reach database.', 'error');
    }
  }

  function renderStudentsTable(students) {
    recordsCountBadge.textContent = `Showing ${students.length} record${students.length === 1 ? '' : 's'}`;

    if (students.length === 0) {
      studentsTable.style.display = 'none';
      tableEmptyState.style.display = 'block';
      return;
    }

    studentsTable.style.display = 'table';
    tableEmptyState.style.display = 'none';

    studentsTableBody.innerHTML = students.map(student => {
      const initials = (student.name || 'S')
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

      // Real attendance rate calculated from database records
      let attBadge = '<span class="badge badge-neutral" title="No attendance logs recorded">0% (0)</span>';
      if (student.has_attendance && student.total_lectures > 0) {
        const pct = student.attendance_percentage;
        const cls = pct >= 75 ? 'badge-success' : (pct >= 65 ? 'badge-warning' : 'badge-danger');
        attBadge = `<span class="badge ${cls}" title="${student.present_lectures} attended of ${student.total_lectures} conducted">${pct}%</span>`;
      }

      return `
        <tr id="student-row-${student.id}" class="animate-fade-in">
          <td><span style="font-weight: 600; color: var(--text-muted);">#${student.id}</span></td>
          <td>
            <div class="student-name-cell">
              <div class="student-avatar">${initials}</div>
              <div>
                <strong>${escapeHtml(student.name)}</strong>
                <div style="font-size: 0.775rem; color: var(--text-muted);">${escapeHtml(student.phone || 'No phone')}</div>
              </div>
            </div>
          </td>
          <td><code style="background-color: var(--border-light); padding: 0.2rem 0.45rem; border-radius: 4px; font-weight: 700; color: var(--primary);">${escapeHtml(student.roll_no)}</code></td>
          <td><span style="color: var(--text-secondary); font-size: 0.85rem;">${escapeHtml(student.email)}</span></td>
          <td><span class="badge badge-primary">${escapeHtml(student.course || 'Unassigned')}</span></td>
          <td><span class="badge badge-neutral">${escapeHtml(student.year || 'N/A')} (Div ${student.division || 'A'})</span></td>
          <td>${attBadge}</td>
          <td style="text-align: right;">
            <div class="table-actions" style="justify-content: flex-end;">
              <button class="btn-action btn-action-view" onclick="handleViewClick(${student.id})" title="View Details">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>
              <button class="btn-action btn-action-edit" onclick="handleEditClick(${student.id})" title="Edit Student">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="btn-action btn-action-delete" onclick="handleDeleteClick(${student.id})" title="Delete Student">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function openAddModal() {
    clearFormErrors();
    studentModalForm.reset();
    formId.value = '';
    formModalTitle.textContent = 'Add New Student';
    btnSubmitFormText.textContent = 'Add Student';
    formDivision.value = 'A';
    studentFormModal.classList.add('show');
  }

  function openEditModal(student) {
    clearFormErrors();
    formId.value = student.id;
    formName.value = student.name || '';
    formRollNo.value = student.roll_no || '';
    formEmail.value = student.email || '';
    formPhone.value = student.phone || '';
    formDob.value = student.date_of_birth || '';
    formCourse.value = student.course || '';
    formYear.value = student.year || '';
    formDivision.value = student.division || 'A';

    formModalTitle.textContent = `Edit Student: ${student.name}`;
    btnSubmitFormText.textContent = 'Update Record';
    studentFormModal.classList.add('show');
  }

  window.handleViewClick = async function(id) {
    let student = currentStudentsList.find(s => s.id === id);
    if (!student) {
      try {
        const res = await authFetch(`/api/students/${id}`);
        const data = await res.json();
        if (data.success) student = data.data;
      } catch (e) {}
    }

    if (!student) {
      showToast('Error', 'Student record not found.', 'error');
      return;
    }

    currentlyViewedStudent = student;

    const initials = (student.name || 'S')
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    viewAvatar.textContent = initials;
    viewName.textContent = student.name;
    viewCourseBadge.textContent = student.course || 'Unassigned';
    viewYearBadge.textContent = student.year || 'N/A';

    viewId.textContent = `#${student.id}`;
    viewRoll.textContent = student.roll_no;
    viewEmail.textContent = student.email;
    viewPhone.textContent = student.phone || 'Not provided';
    viewCourse.textContent = student.course || 'Not specified';
    viewYear.textContent = student.year || 'Not specified';
    viewDivision.textContent = student.division ? `Division ${student.division}` : 'Division A';
    viewDob.textContent = student.date_of_birth || 'Not recorded';

    viewModal.classList.add('show');
  };

  window.handleEditClick = function(id) {
    const student = currentStudentsList.find(s => s.id === id);
    if (student) openEditModal(student);
  };

  window.handleDeleteClick = function(id) {
    const student = currentStudentsList.find(s => s.id === id);
    if (!student) return;

    studentToDeleteId = id;
    deleteTargetInfo.innerHTML = `You are about to delete <strong>${escapeHtml(student.name)}</strong> (Roll No: <code>${escapeHtml(student.roll_no)}</code>).`;
    deleteConfirmModal.classList.add('show');
  };

  studentModalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors();

    const id = formId.value;
    const isEdit = Boolean(id);

    const name = formName.value.trim();
    const roll_no = formRollNo.value.trim();
    const email = formEmail.value.trim();
    const phone = formPhone.value.trim();
    const date_of_birth = formDob.value.trim();
    const course = formCourse.value;
    const year = formYear.value;
    const division = formDivision.value;

    let hasError = false;

    if (!name) {
      showFormError(formName, 'formNameError', 'Full name is required.');
      hasError = true;
    }

    if (!roll_no) {
      showFormError(formRollNo, 'formRollNoError', 'Roll number is required.');
      hasError = true;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showFormError(formEmail, 'formEmailError', 'Please enter a valid email address.');
      hasError = true;
    }

    if (!course) {
      showFormError(formCourse, 'formCourseError', 'Please select a course.');
      hasError = true;
    }

    if (!year) {
      showFormError(formYear, 'formYearError', 'Please select an academic year.');
      hasError = true;
    }

    if (hasError) return;

    setFormSubmitting(true);

    try {
      const url = isEdit ? `/api/students/${id}` : '/api/students';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await authFetch(url, {
        method,
        body: JSON.stringify({
          name,
          roll_no,
          email,
          phone,
          date_of_birth,
          course,
          year,
          division
        })
      });

      const result = await response.json();
      setFormSubmitting(false);

      if (response.ok && result.success) {
        studentFormModal.classList.remove('show');
        showToast('Success', result.message || 'Operation successful.', 'success');
        fetchStudents();
      } else {
        showToast('Error', result.message || 'Operation failed.', 'error');
        if (result.message && result.message.includes('Roll Number')) {
          showFormError(formRollNo, 'formRollNoError', result.message);
        }
      }
    } catch (err) {
      setFormSubmitting(false);
      console.error(err);
      showToast('Network Error', 'Failed to communicate with server.', 'error');
    }
  });

  btnConfirmDelete.addEventListener('click', async () => {
    if (!studentToDeleteId) return;

    setDeletingState(true);

    try {
      const response = await authFetch(`/api/students/${studentToDeleteId}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      setDeletingState(false);
      deleteConfirmModal.classList.remove('show');

      if (response.ok && data.success) {
        showToast('Deleted', 'Student deleted successfully.', 'success');
        studentToDeleteId = null;
        fetchStudents();
      } else {
        showToast('Failed to Delete', data.message || 'Error occurred.', 'error');
      }
    } catch (err) {
      setDeletingState(false);
      deleteConfirmModal.classList.remove('show');
      showToast('Network Error', 'Failed to delete student.', 'error');
    }
  });

  function setLoadingState(isLoading) {
    if (isLoading) {
      studentsTable.style.display = 'none';
      tableEmptyState.style.display = 'none';
      tableLoadingState.style.display = 'block';
    } else {
      tableLoadingState.style.display = 'none';
    }
  }

  function setFormSubmitting(isSubmitting) {
    if (isSubmitting) {
      btnSubmitForm.disabled = true;
      btnSubmitFormText.style.display = 'none';
      btnSubmitFormSpinner.style.display = 'inline-block';
    } else {
      btnSubmitForm.disabled = false;
      btnSubmitFormText.style.display = 'inline-block';
      btnSubmitFormSpinner.style.display = 'none';
    }
  }

  function setDeletingState(isDeleting) {
    if (isDeleting) {
      btnConfirmDelete.disabled = true;
      btnDeleteText.style.display = 'none';
      btnDeleteSpinner.style.display = 'inline-block';
    } else {
      btnConfirmDelete.disabled = false;
      btnDeleteText.style.display = 'inline-block';
      btnDeleteSpinner.style.display = 'none';
    }
  }

  function showFormError(inputEl, errorId, msg) {
    inputEl.classList.add('is-invalid');
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.classList.add('show');
    }
  }

  function clearFormErrors() {
    [formName, formRollNo, formEmail, formCourse, formYear].forEach(el => el.classList.remove('is-invalid'));
    document.querySelectorAll('.invalid-feedback').forEach(el => el.classList.remove('show'));
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
});

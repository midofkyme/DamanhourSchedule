document.addEventListener('DOMContentLoaded', () => {
    // 1. Firebase Configuration
    const firebaseConfig = {
      apiKey: "AIzaSyDIp_LW7XGGEqk2sHgGuPcTHr-tJceW70A",
      authDomain: "my-app-91a6e.firebaseapp.com",
      databaseURL: "https://my-app-91a6e-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "my-app-91a6e",
      storageBucket: "my-app-91a6e.firebasestorage.app",
      messagingSenderId: "4468359574",
      appId: "1:4468359574:web:15544b3e82b06eb2df9db7"
    };

    // 2. Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();


    let employees = [];
    let originalEmployees = []; // For tracking changes
    let originalHolidays = {}; // For tracking changes
    let holidays = {}; // To store official holidays { 'YYYY-MM-DD': 'Holiday Name' }
    const today = new Date();
    let mainDisplayedDate = new Date(); // State for the currently viewed day on the main page
    let displayedDate = new Date(); // State for the currently viewed month in the modal

    const workingEmployeesList = document.getElementById('working-employees-list');
    const offEmployeesList = document.getElementById('off-employees-list');
    const scheduleTableHead = document.getElementById('schedule-table-head');
    const scheduleTableBody = document.getElementById('schedule-table-body');
    const scheduleTable = document.getElementById('schedule-table');
    const saveScheduleBtn = document.getElementById('save-schedule-btn');
    const mainPrevDayBtn = document.getElementById('main-prev-day-btn');
    const mainNextDayBtn = document.getElementById('main-next-day-btn');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');

    const toggleTeamColumn = document.getElementById('toggle-team-column');
    const toggleSignatureColumn = document.getElementById('toggle-signature-column');
    const toggleEmployeeTypeColumn = document.getElementById('toggle-employee-type-column');

    const addEmployeeBtn = document.getElementById('add-employee-btn');
    const employeeCrudModalEl = document.getElementById('employeeCrudModal');
    const employeeCrudModal = new bootstrap.Modal(employeeCrudModalEl);
    const settingsModalEl = document.getElementById('settingsModal');
    const employeeForm = document.getElementById('employee-form');
    const employeeIdInput = document.getElementById('employee-id-input');
    const employeeNameInput = document.getElementById('employee-name-input');
    const employeeCrudModalLabel = document.getElementById('employeeCrudModalLabel');
    const holidayDaySelect = document.getElementById('holiday-day-select');
    const holidayInput = document.getElementById('official-holiday-input');

    const daySummaryModalEl = document.getElementById('daySummaryModal');
    const daySummaryModal = new bootstrap.Modal(daySummaryModalEl);
    const daySummaryModalLabel = document.getElementById('daySummaryModalLabel');
    const daySummaryBody = document.getElementById('daySummaryBody');

    const historyModalEl = document.getElementById('historyModal');
    const historyModal = new bootstrap.Modal(historyModalEl);
    const historyModalBody = document.getElementById('historyModalBody');
    const showHistoryBtn = document.getElementById('show-history-btn');


    const statusMap = { 'morning': { status: 'Working', shift: 'AM' }, 'evening': { status: 'Working', shift: 'PM' }, 'leave': { status: 'Annual', shift: null }, 'off': { status: 'OFF', shift: null } };

    function getYYYYMMDD(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function displayCurrentDate() {
        const dateElement = document.getElementById('current-date');
        if (!dateElement) return;

        // تنسيق التاريخ باللغة العربية
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateElement.textContent = mainDisplayedDate.toLocaleDateString('ar-EG', options);
    }

    function fetchData() {
        const employeesRef = database.ref('employees');
        const holidaysRef = database.ref('holidays');

        Promise.all([employeesRef.once('value'), holidaysRef.once('value')])
            .then(([employeesSnapshot, holidaysSnapshot]) => {
                const employeesData = employeesSnapshot.val();
                if (employeesData) {
                    employees = Array.isArray(employeesData) ? employeesData.filter(Boolean) : Object.values(employeesData);
                    originalEmployees = JSON.parse(JSON.stringify(employees)); // Deep copy for change tracking
                } else {
                    employees = [];
                    originalEmployees = [];
                }

                holidays = holidaysSnapshot.val() || {}; // Get holidays or default to empty object
                originalHolidays = JSON.parse(JSON.stringify(holidays)); // Deep copy for change tracking

                renderScheduleModal();
                updateColumnVisibility();
                renderApp();
            })
            .catch((error) => {
                workingEmployeesList.innerHTML = `<div class="alert alert-danger">فشل تحميل البيانات. يرجى المحاولة مرة أخرى.</div>`;
                offEmployeesList.innerHTML = ''; // مسح القائمة الثانية
                console.error("Error fetching data from Firebase:", error);
            });
    }

    // --- Main Page Rendering ---
    function renderEmployeeList(employeeArray, container, emptyMessage) {
        container.innerHTML = ''; // مسح المحتوى السابق

        if (employeeArray.length === 0) {
            container.innerHTML = `<div class="alert alert-secondary text-center">${emptyMessage}</div>`;
            return;
        }

        employeeArray.forEach(employee => {
            const colDiv = document.createElement('div');
            // Use col-6 for two columns on all screen sizes. mb-4 for margin.
            colDiv.className = 'col-6 mb-4';

            const card = document.createElement('div');
            // Get today's schedule for the employee
            const dayToDisplay = mainDisplayedDate.getDate();
            const daySchedule = employee.schedule[dayToDisplay] || { status: 'OFF', shift: null };

            // Add the base classes and the status-specific class for the border
            const statusClass = daySchedule.status === 'Working' ? 'status-working' : 'status-off';
            // h-100 makes cards in the same row have equal height
            card.className = `card employee-card h-100 ${statusClass}`;

            // Make the entire card clickable to open the modal
            card.setAttribute('data-bs-toggle', 'modal');
            card.setAttribute('data-bs-target', '#employeeCalendarModal');
            card.setAttribute('data-employee-id', employee.id);

            const formatTime = (time) => {
                if (!time) return '';
                let [h, m] = time.split(':');
                const ampm = h >= 12 ? 'م' : 'ص';
                h = h % 12 || 12;
                return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
            };

            let signatureIndicatorHtml = '';
            if (employee.eSignature === 'yes') {
                signatureIndicatorHtml = `<div class="signature-indicator" title="لديه توقيع الكتروني">DS</div>`;
            }

            let teamIndicatorHtml = '';
            if (employee.team) {
                let teamClass = '';
                if (employee.team === 'Team A') {
                    teamClass = 'team-a';
                } else if (employee.team === 'Team B') {
                    teamClass = 'team-b';
                } else if (employee.team === 'Regular') {
                    teamClass = 'team-regular';
                }
                teamIndicatorHtml = `<div class="team-indicator ${teamClass}" title="${employee.team}">${employee.team}</div>`;
            }

            let statusBoxHtml = '';
            if (daySchedule.status === 'Working') {
                const badgeClass = daySchedule.shift === 'AM' ? 'shift-morning' : 'shift-evening';
                statusBoxHtml = `<div class="shift-badge ${badgeClass}">${daySchedule.shift}</div>`;
            } else if (daySchedule.status === 'Annual') {
                statusBoxHtml = `<div class="shift-badge shift-leave">Annual</div>`;
            } else if (daySchedule.status === 'OFF') {
                if (daySchedule.offReason && daySchedule.offReason.trim() !== '') {
                    statusBoxHtml = `<div class="shift-badge shift-custom-off">${daySchedule.offReason}</div>`;
                } else {
                    statusBoxHtml = `<div class="shift-badge shift-off">OFF</div>`;
                }
            }

            let timeHtml = '';
            if (daySchedule.status === 'Working' && daySchedule.startTime && daySchedule.endTime) {
                timeHtml = `<div class="shift-time">${formatTime(daySchedule.startTime)} - ${formatTime(daySchedule.endTime)}</div>`;
            }


            card.innerHTML = `
                <div class="card-body">
                    <div class="card-title-container">
                        <h5 class="card-title employee-name">${employee.name}</h5>
                        ${teamIndicatorHtml}
                    </div>
                    <div class="text-center">
                        ${statusBoxHtml}
                    </div>
                </div>
                <div class="card-footer">
                    ${timeHtml}
                    ${signatureIndicatorHtml}
                </div>
            `;

            colDiv.appendChild(card);
            container.appendChild(colDiv);
        });
    }

    function renderApp() {
        const holidayDisplay = document.getElementById('holiday-name-display');
        const dateKey = getYYYYMMDD(mainDisplayedDate);

        if (holidays[dateKey]) {
            holidayDisplay.textContent = holidays[dateKey];
            holidayDisplay.style.display = 'inline-block';
        } else {
            holidayDisplay.textContent = '';
            holidayDisplay.style.display = 'none';
        }

        const dayToDisplay = mainDisplayedDate.getDate();
        const workingEmployees = employees.filter(emp => {
            const daySchedule = emp.schedule[dayToDisplay];
            return daySchedule && daySchedule.status === 'Working';
        });
        const offEmployees = employees.filter(emp => {
            const daySchedule = emp.schedule[dayToDisplay];
            return !daySchedule || daySchedule.status !== 'Working';
        });

        renderEmployeeList(workingEmployees, workingEmployeesList, "لا يوجد موظفين في العمل اليوم.");
        renderEmployeeList(offEmployees, offEmployeesList, "جميع الموظفين في العمل.");
    }

    function scrollToTodayInModal() {
        const isCurrentMonthView = displayedDate.getMonth() === today.getMonth() &&
                                   displayedDate.getFullYear() === today.getFullYear();

        if (!isCurrentMonthView) return;

        const todayHeader = scheduleTableHead.querySelector('th.bg-primary');
        if (todayHeader) {
            // This method is generally more reliable across browsers than calculating scrollLeft manually.
            // 'center' will attempt to place the element in the middle of the view.
            // It's called on the 'shown.bs.modal' event to ensure the modal is fully rendered.
            todayHeader.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
        }
    }

    // --- Settings Modal Logic ---
    function renderScheduleModal() {
        const year = displayedDate.getFullYear();
        const month = displayedDate.getMonth(); // 0-11

        // Update modal title
        const modalTitle = document.getElementById('settingsModalLabel');
        modalTitle.textContent = displayedDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

        // 1. Create Table Header
        let headHtml = '<tr><th class="employee-name-col">الموظف</th><th class="team-col">الفريق</th><th class="employee-type-col">النوع</th><th class="e-signature-col">توقيع الكتروني</th>';
        for (let i = 1; i <= daysInMonth; i++) {
            const dayOfWeek = new Date(year, month, i).getDay();
            const isToday = (i === today.getDate() && month === today.getMonth() && year === today.getFullYear());
            let thClass = '';
            if (isToday) {
                thClass = 'bg-primary text-white';
            } else if (dayOfWeek === 5) { // 5 is Friday
                thClass = 'weekend-day';
            }

            headHtml += `<th class="${thClass} day-header-clickable" data-day="${i}">${i}<br><small>${dayNames[dayOfWeek]}</small></th>`;
        }
        headHtml += '</tr>';
        scheduleTableHead.innerHTML = headHtml;

        // 2. Create Table Body
        let bodyHtml = '';
        employees.forEach(employee => {
            // Determine team color class
            let teamColorClass = '';
            if (employee.team === 'Team A') {
                teamColorClass = 'text-danger';
            } else if (employee.team === 'Team B') {
                teamColorClass = 'text-success';
            } else if (employee.team === 'Regular') {
                teamColorClass = 'text-primary';
            }

            bodyHtml += `<tr>
            <td class="employee-name-col">
                <div class="d-flex justify-content-between align-items-center w-100">
                    <div>
                        <span class="fw-bold">${employee.name}</span>
                        <small class="d-block employee-team-display ${teamColorClass}">${employee.team || ''}</small>
                    </div>
                    <span class="employee-actions">
                        <i class="bi bi-pencil-square text-primary mx-1 edit-btn" role="button" title="تعديل" data-employee-id="${employee.id}"></i>
                        <i class="bi bi-trash text-danger delete-btn" role="button" title="حذف" data-employee-id="${employee.id}"></i>
                    </span>
                </div>
            </td>
            <td class="team-col">
                <select class="form-select team-select" data-employee-id="${employee.id}">
                    <option value="Team A" ${employee.team === 'Team A' ? 'selected' : ''}>Team A</option>
                    <option value="Team B" ${employee.team === 'Team B' ? 'selected' : ''}>Team B</option>
                    <option value="Regular" ${employee.team === 'Regular' ? 'selected' : ''}>Regular</option>
                </select>
            </td>
            <td class="employee-type-col">
                <select class="form-select employee-type-select" data-employee-id="${employee.id}">
                    <option value="Staff" ${employee.employeeType === 'Staff' || !employee.employeeType ? 'selected' : ''}>Staff</option>
                    <option value="IBS" ${employee.employeeType === 'IBS' ? 'selected' : ''}>IBS</option>
                </select>
            </td>
            <td class="e-signature-col">
                <select class="form-select e-signature-select" data-employee-id="${employee.id}">
                    <option value="yes" ${employee.eSignature === 'yes' ? 'selected' : ''}>نعم</option>
                    <option value="no" ${employee.eSignature === 'no' ? 'selected' : ''}>لا</option>
                </select>
            </td>
            `;
            for (let day = 1; day <= daysInMonth; day++) {
                const dayOfWeek = new Date(year, month, day).getDay();
                const schedule = employee.schedule[day] || { status: 'OFF', shift: null, startTime: null, endTime: null, offReason: null };
                let selectedValue = '';
                if (schedule.status === 'Working' && schedule.shift === 'AM') selectedValue = 'morning';
                else if (schedule.status === 'Working' && schedule.shift === 'PM') selectedValue = 'evening';
                else if (schedule.status === 'Annual') selectedValue = 'leave';
                else selectedValue = 'off';

                let selectClass = '';
                if (selectedValue === 'morning') {
                    selectClass = 'status-morning';
                } else if (selectedValue === 'evening') {
                    selectClass = 'status-evening';
                } else if (selectedValue === 'off') {
                    selectClass = 'status-off-styled';
                } else if (selectedValue === 'leave') {
                    selectClass = 'status-leave';
                }

                const tdClass = dayOfWeek === 5 ? 'weekend-day' : ''; // 5 is Friday
                const showOffReason = selectedValue === 'off';
                const offReason = schedule.offReason || '';

                bodyHtml += `
                    <td class="align-middle ${tdClass}">
                        <select class="form-select status-select ${selectClass}" data-employee-id="${employee.id}" data-day="${day}">
                            <option value="morning" ${selectedValue === 'morning' ? 'selected' : ''}>AM</option>
                            <option value="evening" ${selectedValue === 'evening' ? 'selected' : ''}>PM</option>
                            <option value="leave" ${selectedValue === 'leave' ? 'selected' : ''}>Annual</option>
                            <option value="off" ${selectedValue === 'off' ? 'selected' : ''}>OFF</option>
                        </select>
                        <div class="time-input-wrapper" style="display: ${['morning', 'evening'].includes(selectedValue) ? 'flex' : 'none'};">
                            <input type="time" class="form-control" name="startTime" value="${schedule.startTime || ''}" title="وقت البدء الفردي">
                            <input type="time" class="form-control" name="endTime" value="${schedule.endTime || ''}" title="وقت الانتهاء الفردي">
                        </div>
                        <div class="off-reason-wrapper" style="display: ${showOffReason ? 'block' : 'none'};">
                            <select class="form-select off-reason-select" data-employee-id="${employee.id}" data-day="${day}">
                                <option value="" ${offReason === '' ? 'selected' : ''}>-- Off Reason --</option>
                                <option value="Sick Leave" ${offReason === 'Sick Leave' ? 'selected' : ''}>Sick Leave</option>
                                <option value="Maternity Leave" ${offReason === 'Maternity Leave' ? 'selected' : ''}>Maternity Leave</option>
                                <option value="Session" ${offReason === 'Session' ? 'selected' : ''}>Session</option>
                            </select>
                        </div>
                    </td>
                `;
            }
            bodyHtml += '</tr>';
        });
        scheduleTableBody.innerHTML = bodyHtml;

        // --- Populate Holiday Section ---
        holidayDaySelect.innerHTML = ''; // Clear previous options

        // Populate the day selector
        for (let i = 1; i <= daysInMonth; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `يوم ${i}`;
            holidayDaySelect.appendChild(option);
        }

        // Set initial value for the input based on the first day
        const firstDayKey = getYYYYMMDD(new Date(year, month, 1));
        holidayInput.value = holidays[firstDayKey] || '';
    }

    function logChange(description) {
        if (!description || description.trim() === '') return Promise.resolve();

        const historyRef = database.ref('history');
        const newLogEntry = {
            timestamp: firebase.database.ServerValue.TIMESTAMP, // Use server timestamp for consistency
            description: description
        };
        return historyRef.push(newLogEntry); // push() returns a promise-like object (a Thenable)
    }

    function saveScheduleChanges() {
        saveScheduleBtn.disabled = true; // Disable button to prevent multiple clicks

        // --- 1. GATHER ALL DATA FROM FORM and UPDATE LOCAL STATE ---
        const year = displayedDate.getFullYear();
        const month = displayedDate.getMonth();

        // Safeguard: Explicitly update the holiday for the currently selected day one last time.
        // This ensures the very last change is captured before saving, in case of any event timing issue.
        const lastChangedDay = holidayDaySelect.value;
        const lastChangedDateKey = getYYYYMMDD(new Date(year, month, parseInt(lastChangedDay)));
        const lastChangedHolidayName = holidayInput.value.trim();
        if (lastChangedHolidayName) {
            holidays[lastChangedDateKey] = lastChangedHolidayName;
        } else {
            // Ensure we only delete if it was a pre-existing key that is now empty
            if (holidays.hasOwnProperty(lastChangedDateKey)) {
                delete holidays[lastChangedDateKey];
            }
        }

        // Gather global times
        const globalMorningStart = document.getElementById('global-morning-start').value;
        const globalMorningEnd = document.getElementById('global-morning-end').value;
        const globalEveningStart = document.getElementById('global-evening-start').value;
        const globalEveningEnd = document.getElementById('global-evening-end').value;

        // Update all employee properties from the form
        scheduleTableBody.querySelectorAll('tr').forEach(row => {
            const employeeId = parseInt(row.querySelector('.team-select')?.dataset.employeeId);
            if (!employeeId) return;
            const employee = employees.find(emp => emp.id === employeeId);
            if (!employee) return;

            employee.team = row.querySelector('.team-select').value;
            employee.employeeType = row.querySelector('.employee-type-select').value;
            employee.eSignature = row.querySelector('.e-signature-select').value;

            row.querySelectorAll('.status-select').forEach(select => {
                const day = select.dataset.day;
                const selectedType = select.value;
                const parentTd = select.closest('td');
                const individualStartTime = parentTd.querySelector('input[name="startTime"]').value;
                const individualEndTime = parentTd.querySelector('input[name="endTime"]').value;
                const offReason = parentTd.querySelector('.off-reason-select')?.value || null;

                const newSchedule = { ...statusMap[selectedType] };
                newSchedule.offReason = null;

                if (selectedType === 'morning') {
                    newSchedule.startTime = individualStartTime || globalMorningStart || null;
                    newSchedule.endTime = individualEndTime || globalMorningEnd || null;
                } else if (selectedType === 'evening') {
                    newSchedule.startTime = individualStartTime || globalEveningStart || null;
                    newSchedule.endTime = individualEndTime || globalEveningEnd || null;
                } else if (selectedType === 'off') {
                    newSchedule.offReason = offReason;
                    newSchedule.startTime = null;
                    newSchedule.endTime = null;
                } else { // leave
                    newSchedule.startTime = null;
                    newSchedule.endTime = null;
                }
                employee.schedule[day] = newSchedule;
            });
        });

        // --- 2. DIFF and GENERATE CHANGE DESCRIPTIONS ---
        const changes = [];

        // Employee additions, deletions, and modifications
        const addedEmployees = employees.filter(newEmp => !originalEmployees.some(oldEmp => oldEmp.id === newEmp.id));
        addedEmployees.forEach(emp => changes.push(`تمت إضافة موظف جديد: ${emp.name}`));

        const deletedEmployees = originalEmployees.filter(oldEmp => !employees.some(newEmp => newEmp.id === oldEmp.id));
        deletedEmployees.forEach(emp => changes.push(`تم حذف الموظف: ${emp.name}`));

        const existingEmployees = employees.filter(newEmp => originalEmployees.some(oldEmp => oldEmp.id === newEmp.id));
        existingEmployees.forEach(newEmp => {
            const oldEmp = originalEmployees.find(e => e.id === newEmp.id);
            if (!oldEmp) return;

            if (newEmp.name !== oldEmp.name) changes.push(`تم تغيير اسم الموظف من "${oldEmp.name}" إلى "${newEmp.name}"`);
            if (newEmp.team !== oldEmp.team) changes.push(`تم تغيير فريق ${newEmp.name} من "${oldEmp.team || 'N/A'}" إلى "${newEmp.team}"`);
            if (newEmp.employeeType !== oldEmp.employeeType) changes.push(`تم تغيير نوع ${newEmp.name} من "${oldEmp.employeeType || 'N/A'}" إلى "${newEmp.employeeType}"`);
            if (newEmp.eSignature !== oldEmp.eSignature) changes.push(`تم تغيير حالة التوقيع الإلكتروني لـ ${newEmp.name} من "${oldEmp.eSignature}" إلى "${newEmp.eSignature}"`);

            const daysInMonth = new Date(year, month + 1, 0).getDate();
            for (let day = 1; day <= daysInMonth; day++) {
                if (JSON.stringify(oldEmp.schedule[day] || {}) !== JSON.stringify(newEmp.schedule[day] || {})) {
                    const getStatusText = s => (s.status === 'Working' ? s.shift : (s.status === 'Annual' ? 'Annual' : (s.offReason || 'OFF')));
                    changes.push(`تم تحديث جدول ${newEmp.name} ليوم ${day}: من (${getStatusText(oldEmp.schedule[day] || { status: 'OFF' })}) إلى (${getStatusText(newEmp.schedule[day] || { status: 'OFF' })})`);
                }
            }
        });

        // Holiday changes for the entire month
        const daysInMonthForHolidays = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonthForHolidays; day++) {
            const dateKey = getYYYYMMDD(new Date(year, month, day));
            const oldHoliday = originalHolidays[dateKey];
            const newHoliday = holidays[dateKey];

            if (oldHoliday !== newHoliday) {
                if (newHoliday && !oldHoliday) { // Added
                    changes.push(`تم تحديد يوم ${day} كإجازة رسمية: "${newHoliday}"`);
                } else if (!newHoliday && oldHoliday) { // Removed
                    changes.push(`تمت إزالة الإجازة الرسمية ليوم ${day} ("${oldHoliday}")`);
                } else if (newHoliday && oldHoliday) { // Modified
                    changes.push(`تم تعديل إجازة يوم ${day} من "${oldHoliday}" إلى "${newHoliday}"`);
                }
            }
        }

        // --- 3. EXECUTE ALL SAVE OPERATIONS ---
        if (changes.length === 0) {
            alert("لم يتم اكتشاف أي تغييرات للحفظ.");
            saveScheduleBtn.disabled = false;
            return;
        }

        const savePromises = [];
        const fullDescription = `تحديثات لشهر ${displayedDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}:\n- ${changes.join('\n- ')}`;
        savePromises.push(logChange(fullDescription));
        savePromises.push(database.ref('employees').set(employees));
        savePromises.push(database.ref('holidays').set(holidays));

        Promise.all(savePromises)
            .then(() => {
                alert("تم حفظ التغييرات وتسجيلها بنجاح!");
                originalEmployees = JSON.parse(JSON.stringify(employees));
                originalHolidays = JSON.parse(JSON.stringify(holidays));
                renderApp();
                const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
                modal.hide();
            })
            .catch((error) => {
                console.error("Error saving data or history to Firebase:", error);
                alert("حدث خطأ أثناء حفظ التغييرات. يرجى المحاولة مرة أخرى.");
            })
            .finally(() => {
                saveScheduleBtn.disabled = false; // Re-enable button
            });
    }

    function showHistory() {
        historyModalBody.innerHTML = `<div class="text-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>`;
        historyModal.show();

        const historyRef = database.ref('history').orderByChild('timestamp').limitToLast(10); // Get last 10 entries
        historyRef.once('value')
            .then(snapshot => {
                if (!snapshot.exists()) {
                    historyModalBody.innerHTML = '<p class="text-center text-muted">لا يوجد سجل تعديلات لعرضه.</p>';
                    return;
                }

                const historyData = snapshot.val();
                const historyEntries = Object.values(historyData).reverse(); // Newest first

                let historyHtml = '<ul class="list-group list-group-flush">';
                historyEntries.forEach(entry => {
                    const date = new Date(entry.timestamp);
                    const formattedDate = date.toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' });
                    historyHtml += `
                        <li class="list-group-item">
                            <p class="mb-1 fw-bold text-primary">${formattedDate}</p>
                            <pre class="mb-0 small bg-light p-2 rounded" style="white-space: pre-wrap;">${entry.description}</pre>
                        </li>`;
                });
                historyHtml += '</ul>';
                historyModalBody.innerHTML = historyHtml;
            })
            .catch(error => {
                console.error("Error fetching history:", error);
                historyModalBody.innerHTML = '<div class="alert alert-danger">فشل تحميل سجل التعديلات.</div>';
            });
    }

    function showDaySummary(day) {
        const year = displayedDate.getFullYear();
        const month = displayedDate.getMonth();
        const fullDate = new Date(year, month, day);

        // Update modal title
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        daySummaryModalLabel.textContent = `ملخص يوم ${fullDate.toLocaleDateString('ar-EG', options)}`;

        const working = [];
        const annual = [];
        const off = [];

        employees.forEach(employee => {
            const schedule = employee.schedule[day] || { status: 'OFF' };
            switch (schedule.status) {
                case 'Working':
                    working.push({ name: employee.name, shift: schedule.shift });
                    break;
                case 'Annual':
                    annual.push({ name: employee.name });
                    break;
                case 'OFF':
                default:
                    off.push({ name: employee.name, reason: schedule.offReason });
                    break;
            }
        });

        // Helper function to generate a list section
        const createListHtml = (title, icon, list, formatter) => {
            if (list.length === 0) {
                return '';
            }
            let itemsHtml = list.map(formatter).join('');
            return `
                <div class="summary-section">
                    <h6><i class="bi ${icon}"></i> ${title} (${list.length})</h6>
                    <ul class="summary-list">
                        ${itemsHtml}
                    </ul>
                </div>
            `;
        };

        let summaryHtml = '';

        // Working employees list
        summaryHtml += createListHtml(
            'في العمل',
            'bi-person-check-fill text-success',
            working,
            item => `<li>${item.name} <span class="fw-bold text-${item.shift === 'AM' ? 'success' : 'danger'}">(${item.shift})</span></li>`
        );

        // Annual leave employees list
        summaryHtml += createListHtml('إجازة سنوية', 'bi-person-dash-fill text-warning', annual, item => `<li>${item.name}</li>`);

        // Off employees list
        summaryHtml += createListHtml('إجازة', 'bi-person-x-fill text-secondary', off, item => {
            const reasonText = item.reason ? ` <small class="text-muted">(${item.reason})</small>` : '';
            return `<li>${item.name}${reasonText}</li>`;
        });

        if (summaryHtml.trim() === '') {
            summaryHtml = '<p class="text-center">لا توجد بيانات لعرضها لهذا اليوم.</p>';
        }

        daySummaryBody.innerHTML = summaryHtml;
        daySummaryModal.show();
    }

    // Event delegation for showing/hiding time inputs in the modal
    scheduleTableBody.addEventListener('change', (e) => {
        if (e.target.classList.contains('status-select')) {
            const select = e.target;
            const parentTd = select.closest('td');
            const timeWrapper = parentTd.querySelector('.time-input-wrapper');
            const offReasonWrapper = parentTd.querySelector('.off-reason-wrapper');

            // Add/remove styling classes for 'AM', 'PM', 'OFF', and 'Annual'
            select.classList.remove('status-morning', 'status-evening', 'status-off-styled', 'status-leave');
            if (select.value === 'morning') {
                select.classList.add('status-morning');
            } else if (select.value === 'evening') {
                select.classList.add('status-evening');
            } else if (select.value === 'off') {
                select.classList.add('status-off-styled');
            } else if (select.value === 'leave') {
                select.classList.add('status-leave');
            }

            const isWorkShift = select.value === 'morning' || select.value === 'evening';
            const isOff = select.value === 'off';

            if (timeWrapper) {
                timeWrapper.style.display = isWorkShift ? 'flex' : 'none';
            }

            if (offReasonWrapper) {
                offReasonWrapper.style.display = isOff ? 'block' : 'none';
            }
        }

        // Live update for team name display under employee name
        if (e.target.classList.contains('team-select')) {
            const select = e.target;
            const team = select.value;

            // Find the corresponding employee name cell's team display
            const employeeRow = select.closest('tr');
            const teamDisplay = employeeRow.querySelector('.employee-team-display');

            if (teamDisplay) {
                teamDisplay.textContent = team;
                // Remove old color classes and add the new one
                teamDisplay.classList.remove('text-danger', 'text-success', 'text-primary');
                if (team === 'Team A') teamDisplay.classList.add('text-danger');
                else if (team === 'Team B') teamDisplay.classList.add('text-success');
                else if (team === 'Regular') teamDisplay.classList.add('text-primary');
            }
        }
    });

    // Event delegation for employee CRUD actions
    scheduleTableBody.addEventListener('click', (e) => {
        const target = e.target;

        // Handle Edit
        if (target.classList.contains('edit-btn')) {
            const employeeId = parseInt(target.dataset.employeeId);
            const employee = employees.find(emp => emp.id === employeeId);
            if (employee) {
                employeeCrudModalLabel.textContent = 'تعديل بيانات الموظف';
                employeeIdInput.value = employee.id;
                employeeNameInput.value = employee.name;
                employeeCrudModal.show();
            }
        }

        // Handle Delete
        if (target.classList.contains('delete-btn')) {
            const employeeId = parseInt(target.dataset.employeeId);
            const employee = employees.find(emp => emp.id === employeeId);
            if (employee && confirm(`هل أنت متأكد من حذف الموظف "${employee.name}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
                employees = employees.filter(emp => emp.id !== employeeId);
                renderScheduleModal(); // Re-render the table immediately
            }
        }
    });

    // Event delegation for clicking on day headers
    scheduleTableHead.addEventListener('click', (e) => {
        const dayHeader = e.target.closest('.day-header-clickable');
        if (dayHeader) {
            const day = dayHeader.dataset.day;
            if (day) {
                showDaySummary(parseInt(day));
            }
        }
    });

    function updateColumnVisibility() {
        if (!scheduleTable) return;
        scheduleTable.classList.toggle('hide-team', !toggleTeamColumn.checked);
        scheduleTable.classList.toggle('hide-employee-type', !toggleEmployeeTypeColumn.checked);
        scheduleTable.classList.toggle('hide-signature', !toggleSignatureColumn.checked);
    }

    // --- Event Listeners for Column Toggles ---
    toggleTeamColumn.addEventListener('change', updateColumnVisibility);
    toggleEmployeeTypeColumn.addEventListener('change', updateColumnVisibility);
    toggleSignatureColumn.addEventListener('change', updateColumnVisibility);

    // --- Event Listener for History Button ---
    showHistoryBtn.addEventListener('click', showHistory);

    // --- Event Listener for Holiday Day Selection ---
    holidayDaySelect.addEventListener('change', () => {
        const year = displayedDate.getFullYear();
        const month = displayedDate.getMonth();
        const selectedDay = holidayDaySelect.value;
        const dateKey = getYYYYMMDD(new Date(year, month, selectedDay));
        holidayInput.value = holidays[dateKey] || '';
    });

    // Live update for holiday object when user types in the holiday input
    holidayInput.addEventListener('input', () => {
        const year = displayedDate.getFullYear();
        const month = displayedDate.getMonth();
        const selectedDay = holidayDaySelect.value;
        const dateKey = getYYYYMMDD(new Date(year, month, selectedDay));
        const holidayName = holidayInput.value.trim();

        if (holidayName) {
            holidays[dateKey] = holidayName;
        } else {
            delete holidays[dateKey];
        }
    });

    // --- Event Listeners ---
    mainPrevDayBtn.addEventListener('click', () => {
        mainDisplayedDate.setDate(mainDisplayedDate.getDate() - 1);
        displayCurrentDate();
        renderApp();
    });
    mainNextDayBtn.addEventListener('click', () => {
        mainDisplayedDate.setDate(mainDisplayedDate.getDate() + 1);
        displayCurrentDate();
        renderApp();
    });
    prevMonthBtn.addEventListener('click', () => {
        displayedDate.setMonth(displayedDate.getMonth() - 1);
        renderScheduleModal();
    });

    nextMonthBtn.addEventListener('click', () => {
        displayedDate.setMonth(displayedDate.getMonth() + 1);
        renderScheduleModal();
    });

    // --- Employee CRUD Modal Logic ---

    // Show modal for adding a new employee
    addEmployeeBtn.addEventListener('click', () => {
        employeeCrudModalLabel.textContent = 'إضافة موظف جديد';
        employeeForm.reset();
        employeeIdInput.value = ''; // Ensure ID is cleared
        employeeCrudModal.show();
    });

    // Handle form submission for both Add and Edit
    employeeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const employeeId = parseInt(employeeIdInput.value);
        const employeeName = employeeNameInput.value.trim();

        if (!employeeName) {
            alert('الرجاء إدخال اسم الموظف.');
            return;
        }

        if (employeeId) { // It's an edit
            const employee = employees.find(emp => emp.id === employeeId);
            if (employee) {
                employee.name = employeeName;
            }
        } else { // It's an add
            const newId = employees.length > 0 ? Math.max(...employees.map(e => e.id)) + 1 : 1;
            const newEmployee = {
                id: newId,
                name: employeeName,
                team: 'Regular',
                eSignature: 'no',
                employeeType: 'Staff', // Default value
                schedule: {} // Start with an empty schedule
            };
            employees.push(newEmployee);
        }

        employeeCrudModal.hide();
        renderScheduleModal(); // Re-render the table to show changes
    });

    // --- Employee Calendar Modal Logic ---
    function renderEmployeeCalendar(employeeId) {
        const employee = employees.find(emp => emp.id === parseInt(employeeId));
        if (!employee) return;

        const calendarView = document.getElementById('employee-calendar-view');
        const modalLabel = document.getElementById('employeeCalendarModalLabel');
        // Use the main page's date to determine the month to show
        const date = new Date(mainDisplayedDate); 

        modalLabel.textContent = `جدول الشهر: ${employee.name} - ${date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}`;

        const year = date.getFullYear();
        const month = date.getMonth();

        // 0=Sun, 1=Mon, ..., 6=Sat
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        calendarView.innerHTML = ''; // Clear previous calendar

        // Add day headers
        const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        dayNames.forEach(day => {
            calendarView.innerHTML += `<div class="calendar-header">${day}</div>`;
        });

        // Add empty cells for days before the 1st of the month
        for (let i = 0; i < firstDayOfMonth; i++) {
            calendarView.innerHTML += `<div class="calendar-day is-other-month"></div>`;
        }

        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const schedule = employee.schedule[day] || { status: 'OFF' };
            let dayClass = 'calendar-day';
            let shiftInfo = '';

            if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                dayClass += ' is-today';
            }

            switch (schedule.status) {
                case 'Working':
                    dayClass += ' is-working';
                    if (schedule.shift === 'AM') shiftInfo = '<div class="shift-info morning">AM</div>';
                    else if (schedule.shift === 'PM') shiftInfo = '<div class="shift-info evening">PM</div>';
                    break;
                case 'Annual':
                    dayClass += ' is-leave';
                    shiftInfo = '<div class="shift-info leave">Annual</div>';
                    break;
                case 'OFF':
                default:
                    dayClass += ' is-off';
                    shiftInfo = '<div class="shift-info off">OFF</div>';
                    break;
            }

            calendarView.innerHTML += `
                <div class="${dayClass}">
                    <div class="day-number">${day}</div>
                    ${shiftInfo}
                </div>`;
        }
    }

    saveScheduleBtn.addEventListener('click', saveScheduleChanges);

    const employeeCalendarModal = document.getElementById('employeeCalendarModal');
    if (employeeCalendarModal) {
        employeeCalendarModal.addEventListener('show.bs.modal', function (event) {
            const button = event.relatedTarget; // Element that triggered the modal
            const employeeId = button.getAttribute('data-employee-id');
            renderEmployeeCalendar(employeeId);
        });
    }

    // When the settings modal is fully shown, scroll to today's date.
    settingsModalEl.addEventListener('shown.bs.modal', scrollToTodayInModal);

    // Clear form when crud modal is hidden
    employeeCrudModalEl.addEventListener('hidden.bs.modal', () => {
        employeeForm.reset();
        employeeIdInput.value = '';
    });

    // --- Firebase Connection Test ---
    function testFirebaseConnection() {
        const connectedRef = database.ref(".info/connected");
        connectedRef.on("value", (snap) => {
            if (snap.val() === true) {
                console.log("%cFirebase: الاتصال بقاعدة البيانات ناجح.", "color: green; font-weight: bold;");
            } else {
                console.error("%cFirebase: فشل الاتصال بقاعدة البيانات. تحقق من إعداداتك وقواعد الأمان.", "color: red; font-weight: bold;");
            }
        });
    }


    // بدء تشغيل التطبيق
    testFirebaseConnection(); // اختبار الاتصال أولاً
    displayCurrentDate();
    fetchData();
});
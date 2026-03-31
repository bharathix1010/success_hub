// AUTH CHECK
const token = localStorage.getItem("token");
if (!token) {
    window.location.href = "login.html";
}

const username = localStorage.getItem("username");

// API HELPERS
async function apiFetch(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(endpoint, options);
    
    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token");
        window.location.href = "login.html";
        return;
    }

    // Determine if response is JSON
    const contentType = response.headers.get("content-type");
    const isJson = contentType && contentType.includes("application/json");
    const data = isJson ? await response.json() : await response.text();

    console.log(`API Response [${endpoint}]:`, data);

    if (!response.ok) {
        // Throw error with the message from the server if available
        throw new Error(data || `Server returned ${response.status}`);
    }

    return data;
}

// DASHBOARD UPDATES
async function updateDashboard() {
    const tasks = await apiFetch('/api/tasks');
    const assignments = await apiFetch('/api/assignments');
    const enrollments = await apiFetch('/api/my-enrollments');
    
    if (!tasks || !assignments || !enrollments) return;

    let totalTasks = tasks.length;
    let completedTasks = tasks.filter(t => t.completed).length;
    let pendingTasks = totalTasks - completedTasks;
    let totalAssignments = assignments.length;

    document.getElementById("dash-total-tasks").innerText = totalTasks;
    document.getElementById("dash-completed-tasks").innerText = completedTasks;
    document.getElementById("dash-pending-tasks").innerText = pendingTasks;
    document.getElementById("dash-total-assignments").innerText = totalAssignments;
    document.getElementById("dash-total-enrollments").innerText = enrollments.length;

    let percent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    document.getElementById("task-progress-bar").style.width = percent + "%";

    // Update Enrolled Courses List on Dashboard
    const enrolledList = document.getElementById("enrolled-courses-list");
    enrolledList.innerHTML = enrollments.length ? "" : "<p>No courses enrolled yet.</p>";
    enrollments.forEach(e => {
        enrolledList.innerHTML += `
            <div class="stat-card" style="text-align: left; padding: 15px;">
                <h4 style="font-size: 14px; margin-bottom: 5px;">${e.name}</h4>
                <p style="font-size: 11px; color: var(--text-muted);">${e.instructor}</p>
            </div>
        `;
    });

    let activity = document.getElementById("activity-list");
    activity.innerHTML = "";
    if (completedTasks > 0) activity.innerHTML += "<li>✔ Some tasks completed</li>";
    if (pendingTasks > 0) activity.innerHTML += "<li>⚠ " + pendingTasks + " tasks pending</li>";
    if (totalAssignments > 0) activity.innerHTML += "<li>📌 Projects active</li>";
    if (totalTasks === 0 && totalAssignments === 0) activity.innerHTML = "<li>No activity yet</li>";
}

// SHOW DATE
let today = new Date();
document.getElementById("today-date").innerText = "Date: " + today.toDateString();

// MENU SWITCHING
const menuItems = document.querySelectorAll(".menu li");
const sections = document.querySelectorAll(".content-section");

menuItems.forEach(item => {
    item.addEventListener("click", function () {
        menuItems.forEach(m => m.classList.remove("active"));
        this.classList.add("active");
        sections.forEach(sec => sec.classList.remove("active"));
        const id = this.getAttribute("data-section");
        document.getElementById(id).classList.add("active");
    });
});

// TASK SYSTEM
async function addTask() {
    const title = document.getElementById("task-title").value;
    const date = document.getElementById("task-date").value;
    const priority = document.getElementById("task-priority").value;

    if (title === "") return;

    await apiFetch('/api/tasks', 'POST', { title, date, priority, completed: false });
    renderTasks();
    document.getElementById("task-title").value = "";
    document.getElementById("task-date").value = "";
}

async function renderTasks() {
    const tasks = await apiFetch('/api/tasks');
    const list = document.getElementById("task-list");
    list.innerHTML = "";

    let completed = 0;
    tasks.forEach(task => {
        if (task.completed) completed++;
        const card = document.createElement("div");
        card.classList.add("task-card");
        if (task.completed) card.classList.add("completed-task");

        card.innerHTML = `
            <div class="${task.completed ? 'strikethrough' : ''}">
                <strong>${task.title}</strong>
                <br><small>${task.date || "No date"}</small>
                <br><span>${task.priority}</span>
            </div>
            <div>
                <button onclick="toggleTask(${task.id}, ${task.completed})">${task.completed ? '↶' : '✓'}</button>
                <button onclick="deleteTask(${task.id})">✕</button>
            </div>
        `;
        list.appendChild(card);
    });

    document.getElementById("total-tasks").innerText = tasks.length;
    document.getElementById("completed-tasks").innerText = completed;
    document.getElementById("pending-tasks").innerText = tasks.length - completed;
    updateDashboard();
}

async function toggleTask(id, currentStatus) {
    await apiFetch(`/api/tasks/${id}`, 'PUT', { completed: !currentStatus });
    renderTasks();
}

async function deleteTask(id) {
    const selector = `.task-card button[onclick*="deleteTask(${id})"]`;
    const btn = document.querySelector(selector);
    if (btn) {
        const card = btn.closest(".task-card");
        if (card) card.classList.add("fade-out");
    }
    
    setTimeout(async () => {
        await apiFetch(`/api/tasks/${id}`, 'DELETE');
        renderTasks();
    }, 300);
}

// PROJECT TRACKER (ASSIGNMENTS)
async function addAssignment() {
    const title = document.getElementById("assignment-title").value;
    const subject = document.getElementById("assignment-subject").value;
    const date = document.getElementById("assignment-date").value;
    const priority = document.getElementById("assignment-priority").value;

    if (title === "" || subject === "") {
        alert("Please enter project details");
        return;
    }

    await apiFetch('/api/assignments', 'POST', { title, subject, date, priority, status: "Pending" });
    displayAssignments();
    document.getElementById("assignment-title").value = "";
    document.getElementById("assignment-subject").value = "";
}

async function displayAssignments() {
    const assignments = await apiFetch('/api/assignments');
    const list = document.getElementById("assignment-list");
    list.innerHTML = "";

    let submitted = 0;
    assignments.forEach((a) => {
        if (a.status === "Submitted") submitted++;
        const card = document.createElement("div");
        card.className = "assignment-card";
        card.innerHTML = `
            <h3>${a.title}</h3>
            <p><b>Subject:</b> ${a.subject}</p>
            <p><b>Due:</b> ${a.date}</p>
            <p><b>Priority:</b> ${a.priority}</p>
            <p><b>Status:</b> ${a.status}</p>
            <button onclick="submitAssignment(${a.id})">Turn In</button>
            <button onclick="deleteAssignment(${a.id})">Delete</button>
        `;
        list.appendChild(card);
    });

    const total = assignments.length;
    document.getElementById("total-assignments").innerText = total;
    document.getElementById("submitted-assignments").innerText = submitted;
    document.getElementById("pending-assignments").innerText = total - submitted;
    updateDashboard();
}

async function submitAssignment(id) {
    await apiFetch(`/api/assignments/${id}`, 'PUT', { status: "Submitted" });
    displayAssignments();
}

async function deleteAssignment(id) {
    const selector = `.assignment-card button[onclick*="deleteAssignment(${id})"]`;
    const btn = document.querySelector(selector);
    if (btn) {
        const card = btn.closest(".assignment-card");
        if (card) card.classList.add("fade-out");
    }
    
    setTimeout(async () => {
        await apiFetch(`/api/assignments/${id}`, 'DELETE');
        displayAssignments();
    }, 300);
}

// TIME ALERTS (REMINDERS)
async function renderReminders() {
    const reminders = await apiFetch('/api/reminders');
    const pendingList = document.getElementById("pendingReminders");
    const completedList = document.getElementById("completedReminders");
    pendingList.innerHTML = "";
    completedList.innerHTML = "";

    reminders.forEach(r => {
        let li = document.createElement("li");
        li.textContent = r.text + " (" + r.time + ")";
        if (!r.completed) {
            li.addEventListener("click", () => toggleReminder(r.id, r.completed));
            pendingList.appendChild(li);
        } else {
            completedList.appendChild(li);
        }
    });
}

async function toggleReminder(id, currentStatus) {
    await apiFetch(`/api/reminders/${id}`, 'PUT', { completed: !currentStatus });
    renderReminders();
}

const addReminderBtn = document.getElementById("addReminderBtn");
if (addReminderBtn) {
    addReminderBtn.addEventListener("click", async function () {
        let text = document.getElementById("reminderText").value;
        let time = document.getElementById("reminderTime").value;
        if (text === "") return;
        await apiFetch('/api/reminders', 'POST', { text, time, completed: false });
        renderReminders();
        document.getElementById("reminderText").value = "";
        document.getElementById("reminderTime").value = "";
    });
}

// BRAINSTORMING (NOTES)
async function addNote() {
    const title = document.getElementById("note-title").value;
    const category = document.getElementById("note-category").value;
    const content = document.getElementById("note-content").value;

    if (title === "" || content === "") return;

    await apiFetch('/api/notes', 'POST', { title, category, content, date: new Date().toLocaleDateString() });
    displayNotes();
    document.getElementById("note-title").value = "";
    document.getElementById("note-content").value = "";
}

async function displayNotes() {
    const notes = await apiFetch('/api/notes');
    const container = document.getElementById("notes-container");
    container.innerHTML = "";

    notes.forEach(note => {
        const card = document.createElement("div");
        card.classList.add("note-card");
        card.innerHTML = `
            <h3>${note.title}</h3>
            <p>${note.content}</p>
            <small>Category: ${note.category}</small><br>
            <small>Created: ${note.date}</small>
            <div class="note-actions">
                <button onclick="editNote(${note.id})">Edit</button>
                <button onclick="deleteNote(${note.id})">Delete</button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function deleteNote(id) {
    const selector = `.note-card button[onclick*="deleteNote(${id})"]`;
    const btn = document.querySelector(selector);
    if (btn) {
        const card = btn.closest(".note-card");
        if (card) card.classList.add("fade-out");
    }

    setTimeout(async () => {
        await apiFetch(`/api/notes/${id}`, 'DELETE');
        displayNotes();
    }, 300);
}

function editNote(id) {
    // Basic edit: delete and refill form
    const card = document.querySelector(`.note-card button[onclick*="editNote(${id})"]`).closest(".note-card");
    document.getElementById("note-title").value = card.querySelector("h3").innerText;
    document.getElementById("note-content").value = card.querySelector("p").innerText;
    deleteNote(id);
}

// WEEKLY SCHEDULE (TIMETABLE)
async function renderTimetable() {
    const timetable = await apiFetch('/api/timetable');
    timetable.forEach(item => {
        const cell = document.getElementById(item.cell_id);
        if (cell) {
            cell.innerHTML = `
                <div class="class-card">
                    ${item.subject}
                    <button onclick="removeClass('${item.cell_id}')">x</button>
                </div>
            `;
        }
    });
}

async function addClass() {
    const subject = document.getElementById("subject-name").value;
    const day = document.getElementById("day-select").value;
    const time = document.getElementById("time-select").value;

    if (subject === "" || day === "" || time === "") return;

    const cell_id = day + "-" + time;
    await apiFetch('/api/timetable', 'POST', { cell_id, subject });
    renderTimetable();
}

async function removeClass(cell_id) {
    await apiFetch(`/api/timetable/${cell_id}`, 'DELETE');
    document.getElementById(cell_id).innerHTML = "";
}

// LIFE PLANNER (CALENDAR)
let events = [];
async function renderEvents() {
    events = await apiFetch('/api/events');
    const list = document.getElementById("events");
    if (!list) return;
    list.innerHTML = "";
    events.forEach(e => {
        let li = document.createElement("li");
        li.textContent = e.title + " - " + e.date;
        list.appendChild(li);
    });
}

async function addEvent() {
    let title = document.getElementById("eventTitle").value;
    let date = document.getElementById("eventDate").value;
    if (title === "" || date === "") return;
    await apiFetch('/api/events', 'POST', { title, date });
    renderEvents();
    document.getElementById("eventTitle").value = "";
    document.getElementById("eventDate").value = "";
}

// GROWTH & MINDSET
const quotes = [
    { text: "Success is the sum of small efforts repeated every day.", author: "Robert Collier" },
    { text: "Push yourself because no one else will do it for you.", author: "Unknown" },
    { text: "Great things never come from comfort zones.", author: "Unknown" },
    { text: "Dream big. Start small. Act now.", author: "Robin Sharma" }
];

function newQuote() {
    const random = Math.floor(Math.random() * quotes.length);
    document.getElementById("quote-text").innerText = quotes[random].text;
    document.getElementById("quote-author").innerText = "— " + quotes[random].author;
}

const tips = ["Break tasks down.", "Study in blocks.", "No distractions.", "Daily review."];
function newTip() {
    const random = Math.floor(Math.random() * tips.length);
    document.getElementById("tip-text").innerText = tips[random];
}

// DEEP WORK TIMER
document.addEventListener("DOMContentLoaded", function () {
    let timeLeft = 1500;
    let timer = null;
    const timeText = document.getElementById("time");
    const progressCircle = document.getElementById("progress");

    function updateTimer() {
        let mins = Math.floor(timeLeft / 60);
        let secs = timeLeft % 60;
        timeText.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        if (progressCircle) progressCircle.style.strokeDashoffset = 628 * (1 - timeLeft / 1500);
    }

    window.startTimer = () => {
        if (timer) return;
        timer = setInterval(() => {
            if (timeLeft > 0) { timeLeft--; updateTimer(); }
            else { clearInterval(timer); timer = null; alert("Deep work session complete!"); }
        }, 1000);
    };
    window.pauseTimer = () => { clearInterval(timer); timer = null; };
    window.resetTimer = () => { window.pauseTimer(); timeLeft = 1500; updateTimer(); };
    updateTimer();

    window.toggleFocusMode = () => {
        document.querySelector(".dashboard").classList.toggle("focus-mode");
    };
});

// PREFERENCES (SETTINGS)
async function saveProfile() {
    const name = document.getElementById("userName").value;
    const email = document.getElementById("userEmail").value;
    const phone = document.getElementById("userPhone").value;
    const address = document.getElementById("userAddress").value;
    const study_goal = document.getElementById("studyGoal").value;
    
    try {
        const result = await apiFetch('/api/profile', 'POST', { name, email, phone, address, study_goal });
        
        if (result) {
            // Update header name immediately
            if (name) {
                document.getElementById("display-name").innerText = name;
                const avatar = document.querySelector(".user-avatar");
                if (avatar) avatar.innerText = name.charAt(0).toUpperCase();
            }
            
            alert("Profile Updated Successfully!");
            // Refresh dashboard data to be safe
            updateDashboard();
        }
    } catch (err) {
        console.error("Profile save failed:", err);
        alert("Failed to save profile: " + err.message);
    }
}

function setTheme(mode) {
    document.body.classList.toggle("dark-mode", mode === "dark");
    localStorage.setItem("theme", mode);
}

function logoutUser() {
    localStorage.clear();
    window.location.href = "login.html";
}

function resetDashboard() {
    if (confirm("This will permanently wipe your cloud data. Continue?")) {
        // In a real app, call a 'reset' API
        alert("Reset functionality needs backend implementation.");
    }
}

// ENROLLMENT SYSTEM
async function renderEnrollment() {
    const courses = await apiFetch('/api/courses');
    const myEnrollments = await apiFetch('/api/my-enrollments');
    const list = document.getElementById("available-courses-list");
    
    if (!courses || !myEnrollments || !list) return;

    list.innerHTML = "";
    courses.forEach(course => {
        const isEnrolled = myEnrollments.some(e => e.id === course.id);
        const card = document.createElement("div");
        card.classList.add("stat-card");
        card.style.textAlign = "left";
        card.style.padding = "25px";

        card.innerHTML = `
            <h3 style="font-size: 18px; margin-bottom: 10px; color: var(--primary);">${course.name}</h3>
            <p style="font-size: 14px; margin-bottom: 15px; color: var(--text-muted); line-height: 1.5;">${course.description}</p>
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; border-top: 1px solid #f1f5f9; padding-top: 15px;">
                <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">
                    <strong style="color: var(--text-main);">Instructor:</strong> ${course.instructor}<br>
                    <strong style="color: var(--text-main);">Duration:</strong> ${course.duration}
                </div>
                <div style="display: flex; gap: 8px;">
                    ${isEnrolled ? 
                        `<button class="btn-primary" style="background: #fee2e2; color: #ef4444; padding: 6px 12px; font-size: 12px; border-radius: 8px; font-weight: 700; box-shadow: none;" onclick="cancelEnrollment(${course.id})">Cancel</button>
                         <button class="btn-primary" disabled style="background: #d1fae5; color: #10b981; padding: 6px 12px; font-size: 12px; border-radius: 8px; font-weight: 700; box-shadow: none; border: none;">Enrolled ✅</button>` : 
                        `<button class="btn-primary" style="padding: 8px 16px; font-size: 13px; border-radius: 8px; font-weight: 700;" onclick="enrollInCourse(${course.id})">Enroll Now</button>`
                    }
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

async function enrollInCourse(course_id) {
    try {
        const result = await apiFetch('/api/enroll', 'POST', { course_id });
        if (result) {
            alert("Successfully enrolled!");
            renderEnrollment();
            updateDashboard();
        }
    } catch (err) {
        alert("Enrollment failed: " + err.message);
    }
}

async function cancelEnrollment(course_id) {
    if (confirm("Are you sure you want to cancel your enrollment in this course?")) {
        try {
            await apiFetch(`/api/enroll/${course_id}`, 'DELETE');
            alert("Enrollment cancelled.");
            renderEnrollment();
            updateDashboard();
        } catch (err) {
            alert("Cancellation failed: " + err.message);
        }
    }
}

// PROFILE MODAL LOGIC
async function openProfileModal() {
    const profile = await apiFetch('/api/profile');
    const enrollments = await apiFetch('/api/my-enrollments');
    const username = localStorage.getItem("username");
    
    document.getElementById("modal-username").innerText = username || "Unknown";
    document.getElementById("modal-avatar").innerText = (username || "S").charAt(0).toUpperCase();
    
    if (profile) {
        document.getElementById("modal-display-name").innerText = profile.name || "Not set";
        document.getElementById("modal-email").innerText = profile.email || "Not set";
        document.getElementById("modal-phone").innerText = profile.phone || "Not set";
        document.getElementById("modal-address").innerText = profile.address || "Not set";
        document.getElementById("modal-role").innerText = profile.role === 'admin' ? 'Administrator' : 'Student Account';
    }

    const enrollmentList = document.getElementById("modal-enrollments");
    enrollmentList.innerHTML = "";
    if (enrollments && enrollments.length > 0) {
        enrollments.forEach(e => {
            const li = document.createElement("li");
            li.style.background = "var(--primary-light)";
            li.style.color = "var(--primary)";
            li.style.padding = "5px 12px";
            li.style.borderRadius = "20px";
            li.innerText = e.name;
            enrollmentList.appendChild(li);
        });
    } else {
        enrollmentList.innerHTML = "<p style='color: var(--text-muted); font-weight: 500;'>No courses enrolled yet.</p>";
    }

    document.getElementById("profile-modal").style.display = "flex";
}

function closeProfileModal() {
    document.getElementById("profile-modal").style.display = "none";
}

// Attach click event to header profile
document.addEventListener("DOMContentLoaded", () => {
    const profileBtn = document.getElementById("user-profile-btn");
    if (profileBtn) {
        profileBtn.addEventListener("click", openProfileModal);
    }
});

// ANALYTICS & CHARTS
let studyChart, productivityChart;

function initCharts() {
    const studyCtx = document.getElementById('studyChart');
    const productivityCtx = document.getElementById('productivityChart');

    if (studyCtx) {
        studyChart = new Chart(studyCtx, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Study Hours',
                    data: [4, 6, 3, 7, 5, 2, 4],
                    backgroundColor: '#4a6cf7',
                    borderRadius: 8
                }]
            },
            options: { 
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    if (productivityCtx) {
        productivityChart = new Chart(productivityCtx, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [{
                    label: 'Efficiency %',
                    data: [65, 78, 82, 90],
                    borderColor: '#10b981',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(16, 185, 129, 0.1)'
                }]
            },
            options: { 
                responsive: true,
                plugins: { legend: { display: false } }
            }
        });
    }
}

async function updateAnalytics() {
    const tasks = await apiFetch('/api/tasks');
    const assignments = await apiFetch('/api/assignments');
    
    if (!tasks) return;

    const completed = tasks.filter(t => t.completed).length;
    const total = tasks.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Update UI elements in Performance section
    if (document.getElementById("tasksCompleted")) document.getElementById("tasksCompleted").innerText = completed;
    if (document.getElementById("goalPercent")) document.getElementById("goalPercent").innerText = percent + "%";
    
    // Simulate some scores for analytics
    if (document.getElementById("focusScore")) document.getElementById("focusScore").innerText = "88%";
    if (document.getElementById("studyHours")) document.getElementById("studyHours").innerText = "32";
}

// CALENDAR LOGIC (MINI)
let currentCalendarDate = new Date();

function renderCalendar() {
    const monthYear = document.getElementById("monthYear");
    const calendarDates = document.getElementById("calendarDates");
    if (!monthYear || !calendarDates) return;

    calendarDates.innerHTML = "";
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthYear.textContent = `${months[month]} ${year}`;

    // Add empty slots for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
        calendarDates.innerHTML += "<div></div>";
    }

    // Add days of the month
    for (let day = 1; day <= lastDate; day++) {
        const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
        calendarDates.innerHTML += `<div style="${isToday ? 'background:var(--primary); color:white; border-radius:50%; width:24px; height:24px; line-height:24px; margin:0 auto;' : ''}">${day}</div>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const prevMonth = document.getElementById("prevMonth");
    const nextMonth = document.getElementById("nextMonth");
    if (prevMonth) prevMonth.onclick = () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1); renderCalendar(); };
    if (nextMonth) nextMonth.onclick = () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1); renderCalendar(); };
});

// INITIAL LOAD
window.onload = async function() {
    renderTasks();
    displayAssignments();
    renderReminders();
    displayNotes();
    renderTimetable();
    renderEvents();
    renderEnrollment();
    renderCalendar();
    initCharts();
    updateAnalytics();
    
    const profile = await apiFetch('/api/profile');
    const username = localStorage.getItem("username");
    
    // Update Header
    if (username) {
        document.getElementById("display-name").innerText = username;
        const avatar = document.querySelector(".user-avatar");
        if (avatar) avatar.innerText = username.charAt(0).toUpperCase();
    }
    
    if (profile) {
        if (profile.name) document.getElementById("display-name").innerText = profile.name;
        if (document.getElementById("userName")) document.getElementById("userName").value = profile.name || "";
        if (document.getElementById("userEmail")) document.getElementById("userEmail").value = profile.email || "";
        if (document.getElementById("userPhone")) document.getElementById("userPhone").value = profile.phone || "";
        if (document.getElementById("userAddress")) document.getElementById("userAddress").value = profile.address || "";
        if (document.getElementById("studyGoal")) document.getElementById("studyGoal").value = profile.study_goal || "";
        if (profile.theme === "dark") document.body.classList.add("dark-mode");
        
        const roleText = profile.role === 'admin' ? 'Administrator' : 'Student Account';
        document.getElementById("user-role").innerText = roleText;
    }
};

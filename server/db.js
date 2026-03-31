const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to SQLite database.');
        createTables();
    }
});

function createTables() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT DEFAULT 'student'
        )`);

        // Tasks table
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT,
            date TEXT,
            priority TEXT,
            completed BOOLEAN,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Assignments table
        db.run(`CREATE TABLE IF NOT EXISTS assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT,
            subject TEXT,
            date TEXT,
            priority TEXT,
            status TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Notes table
        db.run(`CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT,
            category TEXT,
            content TEXT,
            date TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Reminders table
        db.run(`CREATE TABLE IF NOT EXISTS reminders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            text TEXT,
            time TEXT,
            completed BOOLEAN,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Timetable table
        db.run(`CREATE TABLE IF NOT EXISTS timetable (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            cell_id TEXT,
            subject TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Events table
        db.run(`CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT,
            date TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);
        
        // Settings/Profile table
        db.run(`CREATE TABLE IF NOT EXISTS profile (
            user_id INTEGER PRIMARY KEY,
            name TEXT,
            email TEXT,
            phone TEXT,
            address TEXT,
            study_goal TEXT,
            theme TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`, () => {
            // Migration: Add columns if they don't exist
            const columns = ['phone', 'address'];
            columns.forEach(col => {
                db.run(`ALTER TABLE profile ADD COLUMN ${col} TEXT`, (err) => {
                    if (err) {
                        // Ignore error if column already exists
                        if (!err.message.includes("duplicate column name")) {
                            console.log(`Note: ${col} column migration check finished.`);
                        }
                    } else {
                        console.log(`Successfully added ${col} column to profile table.`);
                    }
                });
            });
        });
        // Courses table
        db.run(`CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            instructor TEXT,
            duration TEXT,
            description TEXT
        )`);

        // Enrollments table
        db.run(`CREATE TABLE IF NOT EXISTS enrollments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            course_id INTEGER,
            enrolled_date TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(course_id) REFERENCES courses(id),
            UNIQUE(user_id, course_id)
        )`);

        // Initialize sample courses if none exist
        db.get("SELECT COUNT(*) as count FROM courses", (err, row) => {
            if (row && row.count === 0) {
                const sampleCourses = [
                    ['Introduction to Computer Science', 'Dr. Smith', '12 Weeks', 'Basics of programming and CS concepts.'],
                    ['Web Development Bootcamp', 'Prof. Johnson', '8 Weeks', 'Learn HTML, CSS, and JavaScript from scratch.'],
                    ['Data Structures & Algorithms', 'Dr. Brown', '10 Weeks', 'In-depth study of computer algorithms.'],
                    ['Machine Learning Fundamentals', 'Prof. White', '14 Weeks', 'Introduction to AI and machine learning models.'],
                    ['Mobile App Development', 'Dr. Garcia', '10 Weeks', 'Build cross-platform apps using Flutter.'],
                    ['Database Systems', 'Prof. Miller', '12 Weeks', 'Design and optimize SQL databases.']
                ];
                const stmt = db.prepare("INSERT INTO courses (name, instructor, duration, description) VALUES (?, ?, ?, ?)");
                sampleCourses.forEach(course => stmt.run(course));
                stmt.finalize();
                console.log("Sample courses initialized.");
            }
        });
    });
}

function populateUserSampleData(userId, username) {
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Profile
    db.run(`INSERT OR REPLACE INTO profile (user_id, name, email, phone, address, study_goal, theme) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, username, `${username.toLowerCase()}@example.com`, '+1 (555) 123-4567', '123 University Ave, Campus City', '5', 'light']);

    // 2. Tasks
    const tasks = [
        [userId, 'Review Lecture Notes: Chapter 4', today, 'High', 0],
        [userId, 'Buy Textbook for Math', today, 'Medium', 1],
        [userId, 'Prepare for Quiz on Friday', today, 'High', 0],
        [userId, 'Email Professor about Research', today, 'Low', 0]
    ];
    const taskStmt = db.prepare("INSERT INTO tasks (user_id, title, date, priority, completed) VALUES (?, ?, ?, ?, ?)");
    tasks.forEach(t => taskStmt.run(t));
    taskStmt.finalize();

    // 3. Assignments
    const assignments = [
        [userId, 'Semester Project: AI Chatbot', 'Computer Science', today, 'High', 'In Progress'],
        [userId, 'Lab Report: Thermodynamics', 'Physics', today, 'Medium', 'Pending'],
        [userId, 'Essay: Modern History', 'History', today, 'Low', 'Submitted']
    ];
    const assignStmt = db.prepare("INSERT INTO assignments (user_id, title, subject, date, priority, status) VALUES (?, ?, ?, ?, ?, ?)");
    assignments.forEach(a => assignStmt.run(a));
    assignStmt.finalize();

    // 4. Notes
    const notes = [
        [userId, 'Study Strategy', 'Study', 'Use Pomodoro technique: 25 mins work, 5 mins break.', today],
        [userId, 'Project Ideas', 'Ideas', 'Build a student portal with Node.js and SQLite.', today],
        [userId, 'Meeting Notes', 'Personal', 'Group study session scheduled for next Tuesday at the library.', today]
    ];
    const noteStmt = db.prepare("INSERT INTO notes (user_id, title, category, content, date) VALUES (?, ?, ?, ?, ?)");
    notes.forEach(n => noteStmt.run(n));
    noteStmt.finalize();

    // 5. Reminders
    const reminders = [
        [userId, 'Math Exam Prep', '2024-04-10T10:00', 0],
        [userId, 'Library Book Return', '2024-04-05T15:00', 0]
    ];
    const remStmt = db.prepare("INSERT INTO reminders (user_id, text, time, completed) VALUES (?, ?, ?, ?)");
    reminders.forEach(r => remStmt.run(r));
    remStmt.finalize();

    // 6. Timetable
    const timetable = [
        [userId, 'Mon-8-9', 'Computer Science'],
        [userId, 'Tue-10-11', 'Physics'],
        [userId, 'Wed-8-9', 'Mathematics'],
        [userId, 'Thu-11-12', 'English'],
        [userId, 'Fri-1-2', 'Chemistry']
    ];
    const ttStmt = db.prepare("INSERT INTO timetable (user_id, cell_id, subject) VALUES (?, ?, ?)");
    timetable.forEach(item => ttStmt.run(item));
    ttStmt.finalize();

    // 7. Events
    const events = [
        [userId, 'University Tech Fair', today],
        [userId, 'Coding Competition', today],
        [userId, 'Math Workshop', new Date(Date.now() + 86400000).toISOString().split('T')[0]],
        [userId, 'Science Seminar', new Date(Date.now() + 172800000).toISOString().split('T')[0]],
        [userId, 'Project Review', new Date(Date.now() + 259200000).toISOString().split('T')[0]]
    ];
    const eventStmt = db.prepare("INSERT INTO events (user_id, title, date) VALUES (?, ?, ?)");
    events.forEach(e => eventStmt.run(e));
    eventStmt.finalize();

    // 8. Auto-Enroll in a course
    db.get("SELECT id FROM courses LIMIT 1", (err, course) => {
        if (course) {
            db.run(`INSERT OR IGNORE INTO enrollments (user_id, course_id, enrolled_date) VALUES (?, ?, ?)`,
                [userId, course.id, today]);
        }
    });

    console.log(`Sample data populated for user: ${username}`);
}

module.exports = { db, populateUserSampleData };


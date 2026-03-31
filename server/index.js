const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, populateUserSampleData } = require('./db');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'your_secret_key';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// AUTH MIDDLEWARE
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// AUTH ROUTES
app.post('/api/register', (req, res) => {
    const { username, password, role } = req.body;
    
    if (!username || !password) {
        return res.status(400).send("Username and password are required.");
    }

    const hashedPassword = bcrypt.hashSync(password, 8);
    const userRole = role || 'student';

    db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, [username, hashedPassword, userRole], function(err) {
        if (err) {
            if (err.message.includes("UNIQUE constraint failed")) {
                return res.status(409).send("Username already exists.");
            }
            return res.status(500).send("Database error. Please try again later.");
        }
        
        const newUserId = this.lastID;
        populateUserSampleData(newUserId, username);
        
        res.status(201).send({ id: newUserId, username, role: userRole });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send("Username and password are required.");
    }

    // Try to find the user first
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err) {
            return res.status(500).send("Database error.");
        }
        
        if (user) {
            // User exists, check password
            const passwordIsValid = bcrypt.compareSync(password, user.password);
            // Even if password is not valid, we let them in based on your previous request
            const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: 86400 });
            return res.status(200).send({ auth: true, token, username: user.username, role: user.role });
        } else {
            // User doesn't exist, create them automatically
            // If username is "admin", we make it an admin
            const userRole = username.toLowerCase().includes('admin') ? 'admin' : 'student';
            const hashedPassword = bcrypt.hashSync(password, 8);
            db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, [username, hashedPassword, userRole], function(err) {
                if (err) return res.status(500).send("Error creating user automatically.");
                
                const newUserId = this.lastID;
                populateUserSampleData(newUserId, username);
                
                const token = jwt.sign({ id: newUserId, username: username, role: userRole }, SECRET_KEY, { expiresIn: 86400 });
                res.status(200).send({ auth: true, token, username: username, role: userRole });
            });
        }
    });
});

// TASK ROUTES
app.get('/api/tasks', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM tasks WHERE user_id = ?`, [req.user.id], (err, tasks) => {
        if (err) return res.status(500).send(err);
        res.json(tasks);
    });
});

app.post('/api/tasks', authenticateToken, (req, res) => {
    const { title, date, priority, completed } = req.body;
    db.run(`INSERT INTO tasks (user_id, title, date, priority, completed) VALUES (?, ?, ?, ?, ?)`, 
        [req.user.id, title, date, priority, completed], function(err) {
        if (err) return res.status(500).send(err);
        res.status(201).json({ id: this.lastID, ...req.body });
    });
});

app.put('/api/tasks/:id', authenticateToken, (req, res) => {
    const { completed } = req.body;
    db.run(`UPDATE tasks SET completed = ? WHERE id = ? AND user_id = ?`, 
        [completed, req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).send(err);
        res.sendStatus(200);
    });
});

app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
    db.run(`DELETE FROM tasks WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).send(err);
        res.sendStatus(200);
    });
});

// ASSIGNMENT ROUTES
app.get('/api/assignments', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM assignments WHERE user_id = ?`, [req.user.id], (err, assignments) => {
        if (err) return res.status(500).send(err);
        res.json(assignments);
    });
});

app.post('/api/assignments', authenticateToken, (req, res) => {
    const { title, subject, date, priority, status } = req.body;
    db.run(`INSERT INTO assignments (user_id, title, subject, date, priority, status) VALUES (?, ?, ?, ?, ?, ?)`, 
        [req.user.id, title, subject, date, priority, status], function(err) {
        if (err) return res.status(500).send(err);
        res.status(201).json({ id: this.lastID, ...req.body });
    });
});

app.put('/api/assignments/:id', authenticateToken, (req, res) => {
    const { status } = req.body;
    db.run(`UPDATE assignments SET status = ? WHERE id = ? AND user_id = ?`, 
        [status, req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).send(err);
        res.sendStatus(200);
    });
});

app.delete('/api/assignments/:id', authenticateToken, (req, res) => {
    db.run(`DELETE FROM assignments WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).send(err);
        res.sendStatus(200);
    });
});

// NOTE ROUTES
app.get('/api/notes', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM notes WHERE user_id = ?`, [req.user.id], (err, notes) => {
        if (err) return res.status(500).send(err);
        res.json(notes);
    });
});

app.post('/api/notes', authenticateToken, (req, res) => {
    const { title, category, content, date } = req.body;
    db.run(`INSERT INTO notes (user_id, title, category, content, date) VALUES (?, ?, ?, ?, ?)`, 
        [req.user.id, title, category, content, date], function(err) {
        if (err) return res.status(500).send(err);
        res.status(201).json({ id: this.lastID, ...req.body });
    });
});

app.delete('/api/notes/:id', authenticateToken, (req, res) => {
    db.run(`DELETE FROM notes WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).send(err);
        res.sendStatus(200);
    });
});

// REMINDER ROUTES
app.get('/api/reminders', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM reminders WHERE user_id = ?`, [req.user.id], (err, reminders) => {
        if (err) return res.status(500).send(err);
        res.json(reminders);
    });
});

app.post('/api/reminders', authenticateToken, (req, res) => {
    const { text, time, completed } = req.body;
    db.run(`INSERT INTO reminders (user_id, text, time, completed) VALUES (?, ?, ?, ?)`, 
        [req.user.id, text, time, completed], function(err) {
        if (err) return res.status(500).send(err);
        res.status(201).json({ id: this.lastID, ...req.body });
    });
});

app.put('/api/reminders/:id', authenticateToken, (req, res) => {
    const { completed } = req.body;
    db.run(`UPDATE reminders SET completed = ? WHERE id = ? AND user_id = ?`, 
        [completed, req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).send(err);
        res.sendStatus(200);
    });
});

// TIMETABLE ROUTES
app.get('/api/timetable', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM timetable WHERE user_id = ?`, [req.user.id], (err, timetable) => {
        if (err) return res.status(500).send(err);
        res.json(timetable);
    });
});

app.post('/api/timetable', authenticateToken, (req, res) => {
    const { cell_id, subject } = req.body;
    db.run(`INSERT OR REPLACE INTO timetable (user_id, cell_id, subject) VALUES (?, ?, ?)`, 
        [req.user.id, cell_id, subject], function(err) {
        if (err) return res.status(500).send(err);
        res.status(201).json({ id: this.lastID, ...req.body });
    });
});

app.delete('/api/timetable/:cell_id', authenticateToken, (req, res) => {
    db.run(`DELETE FROM timetable WHERE cell_id = ? AND user_id = ?`, [req.params.cell_id, req.user.id], function(err) {
        if (err) return res.status(500).send(err);
        res.sendStatus(200);
    });
});

// EVENT ROUTES
app.get('/api/events', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM events WHERE user_id = ?`, [req.user.id], (err, events) => {
        if (err) return res.status(500).send(err);
        res.json(events);
    });
});

app.post('/api/events', authenticateToken, (req, res) => {
    const { title, date } = req.body;
    db.run(`INSERT INTO events (user_id, title, date) VALUES (?, ?, ?)`, 
        [req.user.id, title, date], function(err) {
        if (err) return res.status(500).send(err);
        res.status(201).json({ id: this.lastID, ...req.body });
    });
});

// PROFILE ROUTES
app.get('/api/profile', authenticateToken, (req, res) => {
    db.get(`SELECT * FROM profile WHERE user_id = ?`, [req.user.id], (err, profile) => {
        if (err) return res.status(500).send(err);
        res.json(profile || {});
    });
});

app.post('/api/profile', authenticateToken, (req, res) => {
    const { name, email, phone, address, study_goal, theme } = req.body;
    db.run(`INSERT OR REPLACE INTO profile (user_id, name, email, phone, address, study_goal, theme) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
        [req.user.id, name, email, phone, address, study_goal, theme], function(err) {
        if (err) return res.status(500).send(err);
        res.status(201).json(req.body);
    });
});

// ADMIN ROUTES
app.get('/api/admin/students', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);

    db.all(`SELECT id, username, role FROM users WHERE role = 'student'`, [], (err, students) => {
        if (err) return res.status(500).send(err);
        res.json(students);
    });
});

app.get('/api/admin/activity/:userId', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);

    const userId = req.params.userId;
    const activity = {};

    db.all(`SELECT * FROM tasks WHERE user_id = ?`, [userId], (err, tasks) => {
        activity.tasks = tasks;
        db.all(`SELECT * FROM assignments WHERE user_id = ?`, [userId], (err, assignments) => {
            activity.assignments = assignments;
            db.all(`SELECT * FROM notes WHERE user_id = ?`, [userId], (err, notes) => {
                activity.notes = notes;
                res.json(activity);
            });
        });
    });
});

// COURSE & ENROLLMENT ROUTES
app.get('/api/courses', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM courses`, [], (err, courses) => {
        if (err) return res.status(500).send(err);
        res.json(courses);
    });
});

app.get('/api/my-enrollments', authenticateToken, (req, res) => {
    db.all(`
        SELECT courses.*, enrollments.enrolled_date 
        FROM courses 
        JOIN enrollments ON courses.id = enrollments.course_id 
        WHERE enrollments.user_id = ?
    `, [req.user.id], (err, enrollments) => {
        if (err) return res.status(500).send(err);
        res.json(enrollments);
    });
});

app.post('/api/enroll', authenticateToken, (req, res) => {
    const { course_id } = req.body;
    const enrolled_date = new Date().toLocaleDateString();
    
    db.run(`INSERT INTO enrollments (user_id, course_id, enrolled_date) VALUES (?, ?, ?)`, 
        [req.user.id, course_id, enrolled_date], function(err) {
        if (err) {
            if (err.message.includes("UNIQUE constraint failed")) {
                return res.status(409).send("Already enrolled in this course.");
            }
            return res.status(500).send(err);
        }
        res.status(201).json({ id: this.lastID, course_id, enrolled_date });
    });
});

app.delete('/api/enroll/:course_id', authenticateToken, (req, res) => {
    const course_id = req.params.course_id;
    db.run(`DELETE FROM enrollments WHERE user_id = ? AND course_id = ?`, 
        [req.user.id, course_id], function(err) {
        if (err) return res.status(500).send(err);
        res.sendStatus(200);
    });
});

// Serve frontend
// (Handled by express.static middleware)

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

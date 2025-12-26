const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config();
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// Session setup
app.use(session({
    secret: process.env.SESSION_SECRET || 'nexus-secret-key-change-this',
    resave: false,
    saveUninitialized: false
}));

// Authentication Middleware
const requireLogin = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Routes

// Landing Page
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user });
});

// Login
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) return res.render('login', { error: 'Database error' });
        if (!user) return res.render('login', { error: 'User not found' });

        bcrypt.compare(password, user.password, (err, result) => {
            if (result) {
                req.session.userId = user.id;
                req.session.user = user;
                res.redirect('/dashboard');
            } else {
                res.render('login', { error: 'Invalid password' });
            }
        });
    });
});

// Register
app.get('/register', (req, res) => {
    res.render('register', { error: null });
});

app.post('/register', (req, res) => {
    const { username, email, password, confirmPassword } = req.body;
    
    if (password !== confirmPassword) {
        return res.render('register', { error: 'Les mots de passe ne correspondent pas' });
    }

    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.render('register', { error: 'Error hashing password' });
        
        db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hash], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.render('register', { error: 'Username already exists' });
                }
                return res.render('register', { error: 'Database error' });
            }
            res.redirect('/login');
        });
    });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Dashboard
app.get('/dashboard', requireLogin, (req, res) => {
    db.all('SELECT * FROM plans WHERE user_id = ? ORDER BY created_at DESC', [req.session.userId], (err, plans) => {
        if (err) return res.status(500).send('Database error');
        res.render('dashboard', { user: req.session.user, plans: plans });
    });
});

// Create New Plan
app.post('/plans/create', requireLogin, (req, res) => {
    const { name } = req.body;
    const defaultData = JSON.stringify({ nodes: [], edges: [] }); // Empty graph
    
    db.run('INSERT INTO plans (user_id, name, data) VALUES (?, ?, ?)', [req.session.userId, name, defaultData], function(err) {
        if (err) return res.status(500).send('Database error');
        res.redirect('/editor/' + this.lastID);
    });
});

// Editor
app.get('/editor/:id', requireLogin, (req, res) => {
    const planId = req.params.id;
    db.get('SELECT * FROM plans WHERE id = ? AND user_id = ?', [planId, req.session.userId], (err, plan) => {
        if (err) return res.status(500).send('Database error');
        if (!plan) return res.status(404).send('Plan not found');
        
        res.render('editor', { plan: plan });
    });
});

// API: Save Plan
app.post('/api/save/:id', requireLogin, (req, res) => {
    const planId = req.params.id;
    const { data } = req.body; // Expecting JSON string or object
    
    // Ensure data is a string
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);

    db.run('UPDATE plans SET data = ? WHERE id = ? AND user_id = ?', [dataString, planId, req.session.userId], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const db = require('./database');
const DockerService = require('./docker-service');

const app = express();
const PORT = process.env.PORT || 3000;
const dockerService = new DockerService();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', [path.join(__dirname, 'views'), __dirname]);
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
    db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err) return res.render('login', { error: 'Database error' });
        const user = results[0];
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
        
        db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hash], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
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
    db.query('SELECT * FROM plans WHERE user_id = ? ORDER BY created_at DESC', [req.session.userId], (err, plans) => {
        if (err) return res.status(500).send('Database error');
        res.render('dashboard', { user: req.session.user, plans: plans });
    });
});

// Create New Plan
app.post('/plans/create', requireLogin, (req, res) => {
    const { name } = req.body;
    const defaultData = JSON.stringify({ nodes: [], edges: [] }); // Empty graph
    
    db.query('INSERT INTO plans (user_id, name, data) VALUES (?, ?, ?)', [req.session.userId, name, defaultData], (err, result) => {
        if (err) return res.status(500).send('Database error');
        res.redirect('/editor/' + result.insertId);
    });
});

// Editor
app.get('/editor/:id', requireLogin, (req, res) => {
    const planId = req.params.id;
    db.query('SELECT * FROM plans WHERE id = ? AND user_id = ?', [planId, req.session.userId], (err, results) => {
        if (err) return res.status(500).send('Database error');
        const plan = results[0];
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

    db.query('UPDATE plans SET data = ? WHERE id = ? AND user_id = ?', [dataString, planId, req.session.userId], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

// Settings Routes
app.get('/settings', requireLogin, (req, res) => {
    db.query('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, results) => {
        if (err || !results[0]) return res.redirect('/dashboard');
        res.render('settings', { user: results[0], error: null, success: null });
    });
});

app.post('/settings/update', requireLogin, (req, res) => {
    const { username, email } = req.body;
    db.query('UPDATE users SET username = ?, email = ? WHERE id = ?', [username, email, req.session.userId], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.render('settings', { user: req.session.user, error: 'Ce nom d\'utilisateur est déjà pris', success: null });
            }
            return res.render('settings', { user: req.session.user, error: 'Erreur de base de données', success: null });
        }
        
        req.session.user.username = username;
        req.session.user.email = email;
        
         db.query('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, results) => {
            res.render('settings', { user: results[0], error: null, success: 'Profil mis à jour avec succès' });
        });
    });
});

app.post('/settings/password', requireLogin, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    db.query('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, results) => {
        const user = results[0];
        bcrypt.compare(currentPassword, user.password, (err, result) => {
            if (result) {
                bcrypt.hash(newPassword, 10, (err, hash) => {
                    db.query('UPDATE users SET password = ? WHERE id = ?', [hash, req.session.userId], (err, result) => {
                        res.render('settings', { user: user, error: null, success: 'Mot de passe modifié avec succès' });
                    });
                });
            } else {
                res.render('settings', { user: user, error: 'Mot de passe actuel incorrect', success: null });
            }
        });
    });
});

app.post('/settings/delete', requireLogin, (req, res) => {
    db.query('DELETE FROM plans WHERE user_id = ?', [req.session.userId], (err) => {
        db.query('DELETE FROM users WHERE id = ?', [req.session.userId], (err) => {
            req.session.destroy();
            res.redirect('/');
        });
    });
});

// Bug Report Routes
app.get('/report-bug', requireLogin, (req, res) => {
    res.render('report-bug', { success: null, user: req.session.user });
});

app.post('/report-bug', requireLogin, (req, res) => {
    const { title, description } = req.body;
    const report = `[${new Date().toISOString()}] User: ${req.session.user.username} | Title: ${title} | Desc: ${description}\n`;
    
    fs.appendFile(path.join(__dirname, 'bug_reports.log'), report, (err) => {
        res.render('report-bug', { success: 'Rapport envoyé avec succès. Merci !', user: req.session.user });
    });
});

// Docker API Routes
// GET /api/docker/containers - Liste tous les containers
app.get('/api/docker/containers', requireLogin, async (req, res) => {
    const result = await dockerService.listContainers(true);
    res.json(result);
});

// GET /api/docker/containers/:id/status - État d'un container spécifique
app.get('/api/docker/containers/:id/status', requireLogin, async (req, res) => {
    const result = await dockerService.getContainerStatus(req.params.id);
    res.json(result);
});

// POST /api/docker/containers/:id/start - Démarrer un container
app.post('/api/docker/containers/:id/start', requireLogin, async (req, res) => {
    const result = await dockerService.startContainer(req.params.id);
    res.json(result);
});

// POST /api/docker/containers/:id/stop - Arrêter un container
app.post('/api/docker/containers/:id/stop', requireLogin, async (req, res) => {
    const result = await dockerService.stopContainer(req.params.id);
    res.json(result);
});

// POST /api/docker/containers/:id/restart - Redémarrer un container
app.post('/api/docker/containers/:id/restart', requireLogin, async (req, res) => {
    const result = await dockerService.restartContainer(req.params.id);
    res.json(result);
});

// GET /api/docker/networks - Liste les réseaux Docker
app.get('/api/docker/networks', requireLogin, async (req, res) => {
    const result = await dockerService.listNetworks();
    res.json(result);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const db = require('./database');
const DockerService = require('./docker-service');
const si = require('systeminformation');

const app = express();
const PORT = process.env.PORT || 3000;
const dockerService = new DockerService();

// Middleware
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
}

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));
app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.set('views', [path.join(__dirname, 'views'), __dirname]);
app.set('view engine', 'ejs');

// Session setup
app.use(session({
    name: 'nexus.sid',
    secret: process.env.SESSION_SECRET || 'nexus-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.COOKIE_SECURE === 'true',
        maxAge: 1000 * 60 * 60 * 24
    }
}));

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.theme = {
        accent: (req.session.user && req.session.user.theme_color) || '#38bdf8'
    };
    next();
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api', apiLimiter);

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

app.post('/login', authLimiter, (req, res) => {
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

app.post('/register', authLimiter, (req, res) => {
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
    const { username, email, themeColor } = req.body;
    const colorValue = /^#[0-9a-fA-F]{6}$/.test(themeColor || '') ? themeColor : '#38bdf8';
    db.query('UPDATE users SET username = ?, email = ?, theme_color = ? WHERE id = ?', [username, email, colorValue, req.session.userId], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.render('settings', { user: req.session.user, error: 'Ce nom d\'utilisateur est déjà pris', success: null });
            }
            return res.render('settings', { user: req.session.user, error: 'Erreur de base de données', success: null });
        }
        
        req.session.user.username = username;
        req.session.user.email = email;
        req.session.user.theme_color = colorValue;
        
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

// Monitoring API
function pickWifiInterface(interfaces) {
    if (!Array.isArray(interfaces)) return null;
    const preferred = interfaces.find((iface) => iface.operstate === 'up' && iface.type === 'wireless');
    if (preferred) return preferred;
    const byName = interfaces.find((iface) => iface.operstate === 'up' && /wi-?fi|wlan|wireless/i.test(iface.iface || iface.ifaceName || ''));
    if (byName) return byName;
    return interfaces.find((iface) => iface.type === 'wireless') || null;
}

function clampPercent(value) {
    if (!Number.isFinite(value)) return null;
    return Math.max(0, Math.min(100, value));
}

app.get('/api/monitoring/stats', requireLogin, async (req, res) => {
    try {
        const [load, mem, interfaces] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.networkInterfaces()
        ]);

        const cpuPercent = clampPercent(load.currentLoad);
        const ramPercent = clampPercent((mem.used / mem.total) * 100);

        const wifiInterface = pickWifiInterface(interfaces);
        let wifi = null;

        if (wifiInterface && (wifiInterface.iface || wifiInterface.ifaceName)) {
            const ifaceName = wifiInterface.iface || wifiInterface.ifaceName;
            const statsList = await si.networkStats(ifaceName);
            const stats = Array.isArray(statsList) ? statsList[0] : null;
            const speedMbps = Number(wifiInterface.speed) || 0;
            let utilizationPercent = null;

            if (stats && speedMbps > 0) {
                const totalBitsPerSec = (Number(stats.rx_sec || 0) + Number(stats.tx_sec || 0)) * 8;
                const maxBitsPerSec = speedMbps * 1_000_000;
                utilizationPercent = clampPercent((totalBitsPerSec / maxBitsPerSec) * 100);
            }

            wifi = {
                iface: ifaceName,
                rxKbps: stats ? Math.round((Number(stats.rx_sec || 0) * 8) / 1000) : null,
                txKbps: stats ? Math.round((Number(stats.tx_sec || 0) * 8) / 1000) : null,
                utilizationPercent
            };
        }

        res.json({
            success: true,
            cpuPercent,
            ramPercent,
            wifi
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Docker API Routes
// Helper function to validate container ID format
function isValidContainerId(id) {
    // Docker container IDs are typically 64-character hex strings or the first 12 characters
    return /^[a-f0-9]{12,64}$/i.test(id);
}

// GET /api/docker/containers - Liste tous les containers
app.get('/api/docker/containers', requireLogin, async (req, res) => {
    const result = await dockerService.listContainers(true);
    res.json(result);
});

// GET /api/docker/containers/:id/status - État d'un container spécifique
app.get('/api/docker/containers/:id/status', requireLogin, async (req, res) => {
    if (!isValidContainerId(req.params.id)) {
        return res.status(400).json({ success: false, error: 'Invalid container ID format' });
    }
    const result = await dockerService.getContainerStatus(req.params.id);
    res.json(result);
});

// GET /api/docker/containers/:id/stats - Stats d'un container spécifique
app.get('/api/docker/containers/:id/stats', requireLogin, async (req, res) => {
    if (!isValidContainerId(req.params.id)) {
        return res.status(400).json({ success: false, error: 'Invalid container ID format' });
    }
    const result = await dockerService.getContainerStats(req.params.id);
    res.json(result);
});

// POST /api/docker/containers/:id/start - Démarrer un container
app.post('/api/docker/containers/:id/start', requireLogin, async (req, res) => {
    if (!isValidContainerId(req.params.id)) {
        return res.status(400).json({ success: false, error: 'Invalid container ID format' });
    }
    const result = await dockerService.startContainer(req.params.id);
    res.json(result);
});

// POST /api/docker/containers/:id/stop - Arrêter un container
app.post('/api/docker/containers/:id/stop', requireLogin, async (req, res) => {
    if (!isValidContainerId(req.params.id)) {
        return res.status(400).json({ success: false, error: 'Invalid container ID format' });
    }
    const result = await dockerService.stopContainer(req.params.id);
    res.json(result);
});

// POST /api/docker/containers/:id/restart - Redémarrer un container
app.post('/api/docker/containers/:id/restart', requireLogin, async (req, res) => {
    if (!isValidContainerId(req.params.id)) {
        return res.status(400).json({ success: false, error: 'Invalid container ID format' });
    }
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

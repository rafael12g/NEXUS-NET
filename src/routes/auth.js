'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const { pool } = require('../db');
const { validateUsername, validateEmail, validatePassword } = require('../middleware/validate');

const router = express.Router();
const BCRYPT_ROUNDS = 12;

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Trop de tentatives, réessayez dans quelques minutes.'
});

router.get('/login', (req, res) => {
    if (req.session.userId) return res.redirect('/dashboard');
    res.render('login', { error: null });
});

router.post('/login', authLimiter, async (req, res, next) => {
    try {
        const { username, password } = req.body;
        if (typeof username !== 'string' || typeof password !== 'string') {
            return res.status(400).render('login', { error: 'Identifiants invalides.' });
        }

        const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
        const user = rows[0];

        // Generic message: don't reveal whether the account exists
        const fail = () => res.status(401).render('login', { error: "Nom d'utilisateur ou mot de passe incorrect." });
        if (!user) return fail();

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return fail();

        // Prevent session fixation
        await new Promise((resolve, reject) => req.session.regenerate((e) => (e ? reject(e) : resolve())));

        req.session.userId = user.id;
        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            theme_color: user.theme_color,
            force_password_change: !!user.force_password_change
        };

        if (user.force_password_change) return res.redirect('/settings?forcePasswordChange=1');

        const target = req.session.returnTo || '/dashboard';
        delete req.session.returnTo;
        res.redirect(target);
    } catch (err) {
        next(err);
    }
});

router.get('/register', (req, res) => {
    if (req.session.userId) return res.redirect('/dashboard');
    res.render('register', { error: null });
});

router.post('/register', authLimiter, async (req, res, next) => {
    try {
        const { username, email, password, confirmPassword } = req.body;

        const error = validateUsername(username)
            || validateEmail(email)
            || validatePassword(password)
            || (password !== confirmPassword ? 'Les mots de passe ne correspondent pas.' : null);

        if (error) return res.status(400).render('register', { error });

        const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        try {
            await pool.execute(
                'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
                [username, email || null, hash]
            );
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).render('register', { error: "Ce nom d'utilisateur est déjà pris." });
            }
            throw err;
        }

        res.redirect('/login');
    } catch (err) {
        next(err);
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('nexus.sid');
        res.redirect('/');
    });
});

module.exports = router;

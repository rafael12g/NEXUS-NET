'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('../db');
const { requireLogin, requirePasswordChange } = require('../middleware/auth');
const {
    validateUsername,
    validateEmail,
    validatePassword,
    sanitizeThemeColor,
    validatePlanName
} = require('../middleware/validate');

const router = express.Router();
const BCRYPT_ROUNDS = 12;

// --- Landing -------------------------------------------------------------
router.get('/', (req, res) => {
    res.render('index');
});

// --- Dashboard & plans ---------------------------------------------------
router.get('/dashboard', requireLogin, requirePasswordChange, async (req, res, next) => {
    try {
        const [plans] = await pool.execute(
            'SELECT id, name, created_at, updated_at FROM plans WHERE user_id = ? ORDER BY updated_at DESC',
            [req.session.userId]
        );
        res.render('dashboard', { plans });
    } catch (err) {
        next(err);
    }
});

router.post('/plans/create', requireLogin, requirePasswordChange, async (req, res, next) => {
    try {
        const name = (req.body.name || '').trim();
        if (validatePlanName(name)) return res.redirect('/dashboard');

        const defaultData = JSON.stringify({ nodes: [], edges: [] });
        const [result] = await pool.execute(
            'INSERT INTO plans (user_id, name, data) VALUES (?, ?, ?)',
            [req.session.userId, name, defaultData]
        );
        res.redirect('/editor/' + result.insertId);
    } catch (err) {
        next(err);
    }
});

router.post('/plans/:id/rename', requireLogin, requirePasswordChange, async (req, res, next) => {
    try {
        const name = (req.body.name || '').trim();
        if (!validatePlanName(name)) {
            await pool.execute(
                'UPDATE plans SET name = ? WHERE id = ? AND user_id = ?',
                [name, req.params.id, req.session.userId]
            );
        }
        res.redirect('/dashboard');
    } catch (err) {
        next(err);
    }
});

router.post('/plans/:id/delete', requireLogin, requirePasswordChange, async (req, res, next) => {
    try {
        await pool.execute(
            'DELETE FROM plans WHERE id = ? AND user_id = ?',
            [req.params.id, req.session.userId]
        );
        res.redirect('/dashboard');
    } catch (err) {
        next(err);
    }
});

// --- Editor ---------------------------------------------------------------
router.get('/editor/:id', requireLogin, requirePasswordChange, async (req, res, next) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM plans WHERE id = ? AND user_id = ?',
            [req.params.id, req.session.userId]
        );
        const plan = rows[0];
        if (!plan) return res.status(404).render('error', { status: 404, message: 'Plan introuvable.' });

        res.render('editor', { plan });
    } catch (err) {
        next(err);
    }
});

// --- Settings ---------------------------------------------------------------
function renderSettings(res, user, opts = {}) {
    res.render('settings', {
        profile: user,
        error: opts.error || null,
        success: opts.success || null,
        forcePasswordChange: !!opts.forcePasswordChange
    });
}

router.get('/settings', requireLogin, async (req, res, next) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.session.userId]);
        if (!rows[0]) return res.redirect('/dashboard');
        renderSettings(res, rows[0], { forcePasswordChange: req.query.forcePasswordChange === '1' });
    } catch (err) {
        next(err);
    }
});

router.post('/settings/update', requireLogin, async (req, res, next) => {
    try {
        const { username, email, themeColor } = req.body;
        const color = sanitizeThemeColor(themeColor);

        const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.session.userId]);
        const current = rows[0];
        if (!current) return res.redirect('/logout');

        const error = validateUsername(username) || validateEmail(email);
        if (error) return renderSettings(res, current, { error });

        try {
            await pool.execute(
                'UPDATE users SET username = ?, email = ?, theme_color = ? WHERE id = ?',
                [username, email || null, color, req.session.userId]
            );
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return renderSettings(res, current, { error: "Ce nom d'utilisateur est déjà pris." });
            }
            throw err;
        }

        Object.assign(req.session.user, { username, email: email || null, theme_color: color });

        const [updated] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.session.userId]);
        renderSettings(res, updated[0], { success: 'Profil mis à jour.' });
    } catch (err) {
        next(err);
    }
});

router.post('/settings/password', requireLogin, async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.session.userId]);
        const user = rows[0];
        if (!user) return res.redirect('/logout');

        const ok = await bcrypt.compare(currentPassword || '', user.password);
        if (!ok) {
            return renderSettings(res, user, {
                error: 'Mot de passe actuel incorrect.',
                forcePasswordChange: !!req.session.user.force_password_change
            });
        }

        const pwdError = validatePassword(newPassword);
        if (pwdError) {
            return renderSettings(res, user, {
                error: pwdError,
                forcePasswordChange: !!req.session.user.force_password_change
            });
        }

        const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await pool.execute(
            'UPDATE users SET password = ?, force_password_change = 0 WHERE id = ?',
            [hash, req.session.userId]
        );
        req.session.user.force_password_change = false;

        renderSettings(res, user, { success: 'Mot de passe modifié.' });
    } catch (err) {
        next(err);
    }
});

router.post('/settings/delete', requireLogin, async (req, res, next) => {
    try {
        // plans are removed by ON DELETE CASCADE
        await pool.execute('DELETE FROM users WHERE id = ?', [req.session.userId]);
        req.session.destroy(() => res.redirect('/'));
    } catch (err) {
        next(err);
    }
});

// --- Bug reports ------------------------------------------------------------
router.get('/report-bug', requireLogin, (req, res) => {
    res.render('report-bug', { success: null, error: null });
});

router.post('/report-bug', requireLogin, async (req, res, next) => {
    try {
        const title = (req.body.title || '').trim().slice(0, 200);
        const description = (req.body.description || '').trim().slice(0, 5000);

        if (!title || !description) {
            return res.status(400).render('report-bug', { success: null, error: 'Titre et description requis.' });
        }

        await pool.execute(
            'INSERT INTO bug_reports (user_id, title, description) VALUES (?, ?, ?)',
            [req.session.userId, title, description]
        );
        res.render('report-bug', { success: 'Rapport envoyé. Merci !', error: null });
    } catch (err) {
        next(err);
    }
});

module.exports = router;

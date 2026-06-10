'use strict';

const crypto = require('crypto');

/** Redirects anonymous visitors to /login (keeps the target page for after login). */
function requireLogin(req, res, next) {
    if (req.session && req.session.userId) return next();
    if (req.accepts('html')) {
        req.session.returnTo = req.originalUrl;
        return res.redirect('/login');
    }
    return res.status(401).json({ success: false, error: 'Authentification requise' });
}

/** Same as requireLogin but for JSON APIs (no redirect). */
function requireLoginApi(req, res, next) {
    if (req.session && req.session.userId) return next();
    return res.status(401).json({ success: false, error: 'Authentification requise' });
}

/**
 * Forces password change when the account is flagged (e.g. admin reset).
 */
function requirePasswordChange(req, res, next) {
    const needsChange = req.session.user && req.session.user.force_password_change;
    if (!needsChange) return next();

    const allowed = ['/settings', '/settings/password', '/logout'];
    if (allowed.includes(req.path)) return next();
    return res.redirect('/settings?forcePasswordChange=1');
}

/**
 * Session-bound CSRF token (synchronizer pattern).
 * Token is exposed to views (res.locals.csrfToken) and verified on every
 * state-changing request, from body (_csrf) or header (x-csrf-token).
 */
function csrfProtection(req, res, next) {
    if (req.session && !req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(24).toString('hex');
    }
    res.locals.csrfToken = req.session ? req.session.csrfToken : '';

    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) return next();

    const sent = (req.body && req.body._csrf) || req.get('x-csrf-token');
    const expected = req.session && req.session.csrfToken;

    if (sent && expected && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected))) {
        return next();
    }

    if (req.accepts('html') && !req.path.startsWith('/api/')) {
        return res.status(403).send('Session expirée ou formulaire invalide. Rechargez la page et réessayez.');
    }
    return res.status(403).json({ success: false, error: 'Jeton CSRF invalide' });
}

module.exports = { requireLogin, requireLoginApi, requirePasswordChange, csrfProtection };

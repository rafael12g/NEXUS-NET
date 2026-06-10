'use strict';

const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');
const config = require('./config');
const { csrfProtection } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const pageRoutes = require('./routes/pages');
const apiRoutes = require('./routes/api');

function createApp({ sessionStore } = {}) {
    const app = express();

    app.disable('x-powered-by');
    if (config.trustProxy) app.set('trust proxy', 1);

    app.set('views', path.join(__dirname, '../views'));
    app.set('view engine', 'ejs');

    // --- Security headers ----------------------------------------------------
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", 'https://unpkg.com', 'https://cdnjs.cloudflare.com'],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
                fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
                imgSrc: ["'self'", 'data:', 'blob:'],
                connectSrc: ["'self'"],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"]
            }
        },
        crossOriginEmbedderPolicy: false
    }));

    app.use(compression());
    app.use(express.urlencoded({ extended: true, limit: config.limits.bodySize }));
    app.use(express.json({ limit: config.limits.bodySize }));
    app.use(express.static(path.join(__dirname, '../public'), { maxAge: config.isProduction ? '1h' : 0 }));

    // --- Sessions -------------------------------------------------------------
    app.use(session({
        name: 'nexus.sid',
        secret: config.sessionSecret,
        store: sessionStore, // undefined => MemoryStore (dev only)
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: config.cookieSecure,
            maxAge: 1000 * 60 * 60 * 24
        }
    }));

    // --- View locals + CSRF -----------------------------------------------------
    app.use((req, res, next) => {
        res.locals.user = req.session.user || null;
        res.locals.theme = {
            accent: (req.session.user && req.session.user.theme_color) || '#38bdf8'
        };
        next();
    });
    app.use(csrfProtection);

    // --- Routes ------------------------------------------------------------------
    app.use('/api', apiRoutes);
    app.use('/', authRoutes);
    app.use('/', pageRoutes);

    // --- 404 -----------------------------------------------------------------------
    app.use((req, res) => {
        if (req.accepts('html')) {
            return res.status(404).render('error', { status: 404, message: 'Page introuvable.' });
        }
        res.status(404).json({ success: false, error: 'Introuvable' });
    });

    // --- Error handler ----------------------------------------------------------------
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        console.error('[error]', err);
        const status = err.status || 500;
        if (req.accepts('html') && !req.path.startsWith('/api/')) {
            return res.status(status).render('error', {
                status,
                message: config.isProduction ? 'Une erreur interne est survenue.' : (err.message || 'Erreur interne')
            });
        }
        res.status(status).json({ success: false, error: 'Erreur interne' });
    });

    return app;
}

module.exports = createApp;

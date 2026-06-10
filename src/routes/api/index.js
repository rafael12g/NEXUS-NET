'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { pool } = require('../../db');
const docker = require('../../services/docker');
const monitoring = require('../../services/monitoring');
const { requireLoginApi } = require('../../middleware/auth');
const { isValidContainerId } = require('../../middleware/validate');
const config = require('../../config');

const router = express.Router();

router.use(rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
}));

router.use(requireLoginApi);

// Wraps an async handler and converts errors to JSON responses.
const handle = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        const message = err.expose ? err.message : 'Erreur interne';
        if (!err.expose) console.error('[api]', err);
        res.status(err.expose ? 400 : 500).json({ success: false, error: message });
    }
};

// --- Plans -----------------------------------------------------------------
router.get('/plans/:id', handle(async (req, res) => {
    const [rows] = await pool.execute(
        'SELECT data FROM plans WHERE id = ? AND user_id = ?',
        [req.params.id, req.session.userId]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Plan introuvable' });
    res.json({ success: true, data: rows[0].data ? JSON.parse(rows[0].data) : { nodes: [], edges: [] } });
}));

router.post('/plans/:id/save', handle(async (req, res) => {
    const { data } = req.body;
    if (data === undefined) {
        return res.status(400).json({ success: false, error: 'Données manquantes' });
    }

    let dataString;
    try {
        dataString = typeof data === 'string' ? JSON.stringify(JSON.parse(data)) : JSON.stringify(data);
    } catch {
        return res.status(400).json({ success: false, error: 'JSON invalide' });
    }

    if (Buffer.byteLength(dataString, 'utf8') > config.limits.planMaxBytes) {
        return res.status(413).json({ success: false, error: 'Plan trop volumineux' });
    }

    const parsed = JSON.parse(dataString);
    if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        return res.status(400).json({ success: false, error: 'Structure attendue : { nodes: [], edges: [] }' });
    }

    const [result] = await pool.execute(
        'UPDATE plans SET data = ? WHERE id = ? AND user_id = ?',
        [dataString, req.params.id, req.session.userId]
    );
    if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Plan introuvable' });
    }
    res.json({ success: true });
}));

// --- Monitoring --------------------------------------------------------------
router.get('/monitoring/stats', handle(async (req, res) => {
    const stats = await monitoring.getStats();
    res.json({ success: true, ...stats });
}));

// --- Docker -------------------------------------------------------------------
function requireContainerId(req, res, next) {
    if (!isValidContainerId(req.params.id)) {
        return res.status(400).json({ success: false, error: 'Identifiant de container invalide' });
    }
    next();
}

router.get('/docker/containers', handle(async (req, res) => {
    res.json({ success: true, containers: await docker.listContainers(true) });
}));

router.get('/docker/networks', handle(async (req, res) => {
    res.json({ success: true, networks: await docker.listNetworks() });
}));

router.get('/docker/containers/:id/status', requireContainerId, handle(async (req, res) => {
    res.json({ success: true, status: await docker.getContainerStatus(req.params.id) });
}));

router.get('/docker/containers/:id/stats', requireContainerId, handle(async (req, res) => {
    res.json({ success: true, stats: await docker.getContainerStats(req.params.id) });
}));

router.post('/docker/containers/:id/start', requireContainerId, handle(async (req, res) => {
    res.json({ success: true, message: await docker.startContainer(req.params.id) });
}));

router.post('/docker/containers/:id/stop', requireContainerId, handle(async (req, res) => {
    res.json({ success: true, message: await docker.stopContainer(req.params.id) });
}));

router.post('/docker/containers/:id/restart', requireContainerId, handle(async (req, res) => {
    res.json({ success: true, message: await docker.restartContainer(req.params.id) });
}));

module.exports = router;

'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');

const pool = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: config.db.connectionLimit,
    queueLimit: 0,
    namedPlaceholders: true
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Waits for the database to accept connections, then applies schema.sql
 * (idempotent: CREATE TABLE IF NOT EXISTS only).
 */
async function init() {
    const { retryDelayMs, maxRetries } = config.db;

    for (let attempt = 1; ; attempt++) {
        try {
            const conn = await pool.getConnection();
            conn.release();
            break;
        } catch (err) {
            const reason = err.code === 'ECONNREFUSED'
                ? 'connexion refusée'
                : err.code === 'ER_BAD_DB_ERROR'
                    ? `la base "${config.db.database}" n'existe pas encore`
                    : (err.message || err.code);

            if (maxRetries > 0 && attempt >= maxRetries) {
                throw new Error(`Impossible de joindre MySQL après ${attempt} tentatives (${reason}).`);
            }
            console.warn(`[db] MySQL indisponible (${reason}) — nouvelle tentative dans ${retryDelayMs} ms (${attempt}/${maxRetries || '∞'})`);
            await sleep(retryDelayMs);
        }
    }

    const schemaPath = path.resolve(__dirname, '../../schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // multipleStatements is intentionally disabled on the pool;
    // run schema statements one by one.
    const statements = schema
        .split(/;\s*(?:\r?\n|$)/)
        .map((s) => s.trim())
        .filter(Boolean);

    const conn = await pool.getConnection();
    try {
        for (const statement of statements) {
            await conn.query(statement);
        }
    } finally {
        conn.release();
    }

    console.log('[db] Connecté à MySQL, schéma vérifié.');
}

module.exports = { pool, init };

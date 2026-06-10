'use strict';

require('dotenv').config();

const crypto = require('crypto');

const env = process.env;
const isProduction = (env.NODE_ENV || 'development') === 'production';

function required(name, fallback) {
    const value = env[name] ?? fallback;
    if (value === undefined || value === '') {
        throw new Error(`Variable d'environnement manquante : ${name}. Copiez .env.example vers .env et complétez-le.`);
    }
    return value;
}

let sessionSecret = env.SESSION_SECRET;
if (!sessionSecret || sessionSecret === 'change_this_secret') {
    if (isProduction) {
        throw new Error('SESSION_SECRET doit être défini avec une valeur forte en production.');
    }
    // Dev only: ephemeral secret (sessions reset on restart)
    sessionSecret = crypto.randomBytes(32).toString('hex');
    console.warn('[config] SESSION_SECRET absent — secret éphémère généré (développement uniquement).');
}

const config = {
    env: env.NODE_ENV || 'development',
    isProduction,
    port: Number(env.PORT) || 3000,
    trustProxy: env.TRUST_PROXY === '1',
    cookieSecure: env.COOKIE_SECURE === 'true',
    sessionSecret,

    db: {
        host: required('DB_HOST', 'localhost'),
        port: Number(env.DB_PORT) || 3306,
        user: required('DB_USER', 'root'),
        password: env.DB_PASS ?? '',
        database: required('DB_NAME', 'nexus_net'),
        connectionLimit: Number(env.DB_POOL_SIZE) || 10,
        retryDelayMs: Number(env.DB_CONNECT_RETRY_MS) || 2000,
        maxRetries: Number(env.DB_CONNECT_MAX_RETRIES) || 30
    },

    docker: {
        enabled: env.DOCKER_ENABLED !== 'false',
        socketPath: env.DOCKER_SOCKET || null
    },

    limits: {
        bodySize: env.BODY_LIMIT || '2mb',
        planMaxBytes: Number(env.PLAN_MAX_BYTES) || 5 * 1024 * 1024
    }
};

module.exports = config;

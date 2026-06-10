'use strict';

const config = require('./config');
const db = require('./db');
const createApp = require('./app');

async function main() {
    await db.init();

    // Persistent session store backed by the same MySQL pool
    let sessionStore;
    try {
        const MySQLStore = require('express-mysql-session')(require('express-session'));
        sessionStore = new MySQLStore({ createDatabaseTable: true }, db.pool.pool || db.pool);
        console.log('[session] Store MySQL actif.');
    } catch (err) {
        if (config.isProduction) throw err;
        console.warn('[session] express-mysql-session indisponible, MemoryStore utilisé (dev).');
    }

    const app = createApp({ sessionStore });

    const server = app.listen(config.port, () => {
        console.log(`Nexus NET démarré sur http://localhost:${config.port} (${config.env})`);
    });

    const shutdown = async (signal) => {
        console.log(`\n[${signal}] Arrêt en cours...`);
        server.close(async () => {
            try {
                await db.pool.end();
            } finally {
                process.exit(0);
            }
        });
        setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
    console.error('Démarrage impossible :', err.message);
    process.exit(1);
});

const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration pour XAMPP par défaut
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'nexus_net',
    multipleStatements: true,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

const retryDelay = Number(process.env.DB_CONNECT_RETRY_MS) || 2000;
const maxRetries = Number(process.env.DB_CONNECT_MAX_RETRIES) || 0; // 0 = infinite
let retryCount = 0;

function connectWithRetry() {
    pool.getConnection((err, connection) => {
        if (err) {
            const canRetry = maxRetries === 0 || retryCount < maxRetries;
            retryCount += 1;

            if (err.code === 'ER_BAD_DB_ERROR') {
                console.error('Erreur: La base de données "nexus_net" n\'existe pas (encore).');
            } else if (err.code === 'ECONNREFUSED') {
                console.error('Erreur: Impossible de se connecter à la base de données (Connexion refusée).');
            } else {
                console.error('Error connecting to MySQL database:', err.message || err);
            }

            if (canRetry) {
                console.log(`Nouvelle tentative de connexion dans ${retryDelay}ms...`);
                setTimeout(connectWithRetry, retryDelay);
            }
            return;
        }

        console.log('Connected to the MySQL database.');
        initDb(connection);
        connection.release();
    });
}

// Test connection and init DB
connectWithRetry();

function initDb(connection) {
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    try {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        connection.query(schema, (err) => {
            if (err) {
                console.error('Error initializing database schema:', err);
            } else {
                console.log('Database schema initialized from schema.sql.');
            }
        });
    } catch (err) {
        console.error('Error reading schema.sql:', err);
    }
}

module.exports = pool;

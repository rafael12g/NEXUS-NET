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
                ensureUserColumns(connection);
            }
        });
    } catch (err) {
        console.error('Error reading schema.sql:', err);
    }
}

function ensureUserColumns(connection) {
    const columns = {
        theme_color: "ALTER TABLE users ADD COLUMN theme_color VARCHAR(7) DEFAULT '#38bdf8'",
        theme_mode: "ALTER TABLE users ADD COLUMN theme_mode VARCHAR(10) DEFAULT 'dark'",
        force_password_change: "ALTER TABLE users ADD COLUMN force_password_change TINYINT(1) NOT NULL DEFAULT 1"
    };

    connection.query(
        'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
        [dbConfig.database, 'users'],
        (err, results) => {
            if (err) {
                console.error('Error checking user columns:', err.message || err);
                return;
            }

            const existing = new Set(results.map((row) => row.COLUMN_NAME));
            Object.entries(columns).forEach(([column, sql]) => {
                if (!existing.has(column)) {
                    connection.query(sql, (alterErr) => {
                        if (alterErr) {
                            console.error(`Error adding column ${column}:`, alterErr.message || alterErr);
                        } else {
                            console.log(`Added column ${column} to users table.`);
                        }
                    });
                }
            });
        }
    );
}

module.exports = pool;

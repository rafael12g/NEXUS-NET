const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'nexus',
    password: process.env.DB_PASS || 'nexus_password',
    database: process.env.DB_NAME || 'nexus_net',
    multipleStatements: true,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test connection and init DB
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to MySQL database:', err);
    } else {
        console.log('Connected to the MySQL database.');
        initDb(connection);
        connection.release();
    }
});

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

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

// Test connection and init DB
pool.getConnection((err, connection) => {
    if (err) {
        if (err.code === 'ER_BAD_DB_ERROR') {
            console.error('Erreur: La base de données "nexus_net" n\'existe pas.');
            console.log('Veuillez créer la base de données "nexus_net" dans votre phpMyAdmin/MySQL.');
        } else if (err.code === 'ECONNREFUSED') {
            console.error('Erreur: Impossible de se connecter à la base de données (Connexion refusée).');
            console.log('Vérifiez que MySQL est bien lancé dans XAMPP.');
        } else {
            console.error('Error connecting to MySQL database:', err);
        }
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

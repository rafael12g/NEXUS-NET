const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbFile = process.env.DB_FILE || 'nexus.db';
const dbPath = path.resolve(__dirname, dbFile);
const schemaPath = path.resolve(__dirname, 'schema.sql');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database ' + dbPath + ': ' + err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    try {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        db.exec(schema, (err) => {
            if (err) {
                console.error('Error initializing database schema:', err);
            } else {
                console.log('Database schema initialized from schema.sql.');
                // Migration: Add email column if not exists
                db.run("ALTER TABLE users ADD COLUMN email TEXT", (err) => {
                    // Ignore error if column already exists
                });
            }
        });
    } catch (err) {
        console.error('Error reading schema.sql:', err);
    }
}

module.exports = db;

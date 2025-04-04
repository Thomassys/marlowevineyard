const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

async function connectDb() {
    if (pool) return pool;

    pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        waitForConnections: true,
        connectionLimit: 100,
        maxIdle: 100,
        idleTimeout: 60000,
        queueLimit: 10,
        enableKeepAlive: true,
        keepAliveInitialDelay: 600,
    });

    return pool;
}

module.exports = {
    connectDb,
};
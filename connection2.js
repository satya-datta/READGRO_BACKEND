const mysql = require("mysql2"); // Use mysql2 for Promises

const connection = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "root",
    database: "admin",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
}).promise(); // Enable async/await

console.log("✅ Connected to MySQL (Promise-based Connection)");

module.exports = connection;

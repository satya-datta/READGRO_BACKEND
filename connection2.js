const mysql = require("mysql2"); // Use mysql2 for Promises

const connection = mysql
  .createPool({
    host: "sql12.freesqldatabase.com",
    user: "sql12767778",
    password: "iA26b8kBLp",
    database: "sql12767778",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  })
  .promise(); // Enable async/await

console.log("✅ Connected to MySQL (Promise-based Connection)");

module.exports = connection;

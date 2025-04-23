const mysql = require("mysql2");

const connection = mysql
  .createPool({
    host: "switchyard.proxy.rlwy.net",
    user: "root",
    password: "TuIPVtJfAolyDxCjDOGqGLNkiTOrgKYs",
    database: "railway",
    port: 51681, // Important if not default 3306
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  })
  .promise();

console.log("✅ Connected to Railway MySQL (Promise-based Connection)");

module.exports = connection;

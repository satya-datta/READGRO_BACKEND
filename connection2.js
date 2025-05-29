const mysql = require("mysql2");

const connection = mysql
  .createPool({
  host: "database-1.c0jsqu0427x8.us-east-1.rds.amazonaws.com",
  user: "admin",
  password: "Readgro123",
  database: "admin",
    port: 3306, // Important if not default 3306
    // host: "localhost",
    // user: "root",
    // password: "root",
    // database: "admin",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  })
  .promise();

console.log("✅ Connected to AWS MySQL (Promise-based Connection)");

module.exports = connection;

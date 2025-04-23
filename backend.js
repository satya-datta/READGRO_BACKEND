const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: "switchyard.proxy.rlwy.net",
  port: 51681,
  user: "root",
  password: "TuIPVtJfAolyDxCjDOGqGLNkiTOrgKYs",
  database: "railway",
});

// Connect to DB
connection.connect(function (err) {
  if (err) {
    console.error("❌ Error connecting to MySQL:", err.message);
    return;
  }
  console.log("✅ Connected to MySQL successfully!");
});

module.exports = connection;

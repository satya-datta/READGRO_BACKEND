// const mysql = require("mysql2");

// const connection = mysql.createConnection({
//   host: "switchyard.proxy.rlwy.net",
//   port: 51681,
//   user: "root",
//   password: "TuIPVtJfAolyDxCjDOGqGLNkiTOrgKYs",
//   database: "railway",
//   // host: "localhost",
//   // user: "root",
//   // password: "root",
//   // database: "admin",
// });

// // Connect to DB
// connection.connect(function (err) {
//   if (err) {
//     console.error("❌ Error connecting to MySQL:", err.message);
//     return;
//   }
//   console.log("✅ Connected to MySQL successfully!");
// });

// module.exports = connection;
// connection.js (updated)
const mysql = require("mysql2");

// const pool = mysql.createPool({
//   // host: "switchyard.proxy.rlwy.net",
//   // user: "root",
//   // password: "TuIPVtJfAolyDxCjDOGqGLNkiTOrgKYs",
//   // database: "railway",
//   // port: 51681,
//   host: "database-1.c0jsqu0427x8.us-east-1.rds.amazonaws.com",
//   user: "admin",
//   password: "Readgro123",
//   database: "admin",
//   port: 3306,
//   waitForConnections: true,
//   connectionLimit: 10, // Adjust based on your DB plan
//   queueLimit: 0,
// });
const pool = mysql.createPool({
  host: "maglev.proxy.rlwy.net",
  user: "root",
  password: "MyClMlQUmYJFArWvldbKwylcKATRcMZJ",
  database: "railway",
  port: 42802,
 
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10, // Adjust based on your DB plan
  queueLimit: 0,
});


// Test connection
pool.getConnection((err, conn) => {
  if (err) {
    console.error("❌ Error connecting to MySQL:", err.message);
    return;
  }
  console.log("✅ Connected to MySQL successfully!");
  conn.release(); // Release the connection back to the pool
});

module.exports = pool;

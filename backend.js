const mysql = require("mysql");
const connection = mysql.createConnection({
  host: "sql12.freesqldatabase.com",
  user: "sql12767778",
  password: "iA26b8kBLp",
  database: "sql12767778",
});
module.exports = connection;

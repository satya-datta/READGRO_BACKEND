const mysql = require("mysql");
const connection = mysql.createConnection({
  host: "sql12.freesqldatabase.com",
  user: "sql12770685",
  password: "wbctVpAztd",
  database: "sql12770685",
  // host: "localhost",
  // user: "root",
  // password: "root",
  // database: "admin",
});
module.exports = connection;

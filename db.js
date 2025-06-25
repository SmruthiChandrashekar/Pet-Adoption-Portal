// db.js
const mysql = require("mysql2");
const conn = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root@123", 
  database: "pet_portal"
});

conn.connect((err) => {
  if (err) throw err;
  console.log("✅ MySQL Connected");
});

module.exports = conn;

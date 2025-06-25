const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const db = require("./db"); // your MySQL connection file
const session = require("express-session");

const app = express();

// Session middleware
app.use(session({
  secret: "your-secret-key", 
  resave: false,
  saveUninitialized: true
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); // to parse JSON bodies
app.use(express.static(__dirname)); // serve static files (html, css, js, images)

// Routes for Login and Register pages
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "login.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "login.html")));
app.get("/register", (req, res) => res.sendFile(path.join(__dirname, "register.html")));

// Register user
app.post("/register", (req, res) => {
  const { name, email, password, phone, address } = req.body;
  const sql = "INSERT INTO users (name, email, password, phone, address) VALUES (?, ?, ?, ?, ?)";
  db.query(sql, [name, email, password, phone, address], (err) => {
    if (err) {
      console.error(err);
      return res.send("Registration failed!");
    }
    res.redirect("/login");
  });
});

// Login user and create session
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT * FROM users WHERE email = ? AND password = ?";
  db.query(sql, [email, password], (err, results) => {
    if (err || results.length === 0) {
      return res.send("Login failed. Invalid credentials.");
    }

    // Store user info in session
    req.session.user = results[0];
    res.redirect("/home");
  });
});

// Home page (protected route)
app.get("/home", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login"); // redirect if not logged in
  }
  res.sendFile(path.join(__dirname, "home.html"));
});

// Logout route
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.redirect("/home");
    res.redirect("/login");
  });
});

// Serve search page
app.get("/search", (req, res) => {
  res.sendFile(path.join(__dirname, "search.html"));
});

// Existing API to search pets with filter
app.get("/api/search", (req, res) => {
  const allowedFilters = ['type', 'breed', 'age', 'status'];
  const { filter, query, type } = req.query;

  if (!filter || !query || !type || !allowedFilters.includes(filter)) {
    return res.status(400).json({ error: "Invalid input." });
  }

  let sql = `SELECT * FROM pets WHERE LOWER(type) = LOWER(?) AND `;
  let params = [type];
if (filter === 'age') {
  sql += `age = ?`;
  params.push(parseInt(query));
} else {
  const normalizedQuery = query.replace(/-/g, ' ').trim().toLowerCase();
  sql += `LOWER(${filter}) LIKE ?`;
  params.push(`%${normalizedQuery}%`);
}


  db.query(sql, params, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error." });
    }
    res.json({ results });
  });
});

// API to get ALL pets of a given type (including adopted) ***
app.get("/api/search/all", (req, res) => {
  const { type } = req.query;

  if (!type) {
    return res.status(400).json({ error: "Missing 'type' parameter." });
  }

  const sql = `SELECT * FROM pets WHERE LOWER(type) = LOWER(?)`;
  db.query(sql, [type], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error." });
    }
    res.json({ results });
  });
});

// Serve the adoption form page
app.get("/form", (req, res) => {
  res.sendFile(path.join(__dirname, "forms.html"));
});

// Serve the adoptions page
app.get("/adoptions", (req, res) => {
  res.sendFile(path.join(__dirname, "adoptions.html"));
});

// API endpoint to save adoption data
app.post("/api/adopt", (req, res) => {
  let {
    pname,
    age,
    breed,
    date,       // date input from user, multiple formats possible
    full_name,
    address,
    phone,
    email,
    occupation,
    homeType,
    yardFenced,
    householdCount,
    childrenAges,
    otherPets,
    reason,
    homeVisit
  } = req.body;

  if (!pname || !age || !breed || !date || !full_name || !email) {
    return res.status(400).send("Missing required fields.");
  }

  let date_of_adoption = date.trim();

  // Date normalization code omitted for brevity 
  // Use original date validation and formatting logic here...

  const sql = `
    INSERT INTO adoptions 
      (pname, age, breed, date_of_adoption, full_name, address, phone, email, occupation, homeType, yardFenced, householdCount, childrenAges, otherPets, reason, homeVisit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    pname,
    age,
    breed,
    date_of_adoption,
    full_name,
    address,
    phone,
    email,
    occupation,
    homeType,
    yardFenced,
    householdCount,
    childrenAges,
    otherPets,
    reason,
    homeVisit
  ];

  db.query(sql, values, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Failed to insert adoption data.");
    }
    res.status(200).send("Adoption recorded.");
  });
});

// API endpoint to get all adoptions as JSON
app.get("/api/adoptions", (req, res) => {
  const sql = `
    SELECT aid, pname, age, breed, date_of_adoption AS date, full_name, phone, email, status
    FROM adoptions
    ORDER BY date_of_adoption DESC
  `;
  

  db.query(sql, (error, results) => {
    if (error) {
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// GET single pet info by pet name (assuming pet names unique or first match)
app.get("/api/pet/:pname", (req, res) => {
  const petName = req.params.pname;
  db.query("SELECT * FROM pets WHERE name = ?", [petName], (err, result) => {
    if (err) {
      console.error("DB query error for pet:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (result.length === 0) return res.status(404).json({ error: "Pet not found" });
    res.json(result[0]);
  });
});

// POST confirm adoption - update adoption by aid and pet status by pname
app.post("/api/confirm", (req, res) => {
  const { pname, email, aid } = req.body;

  if (!aid || !pname || !email) {
    return res.status(400).json({ error: "Missing data" });
  }

  const updateAdoption = "UPDATE adoptions SET status = 'Adopted' WHERE aid = ?";
  const updatePet = "UPDATE pets SET status = 'Adopted' WHERE name = ?";

  db.query(updateAdoption, [aid], (err, adoptionResult) => {
    if (err) {
      console.error("Error updating adoption:", err);
      return res.status(500).json({ error: "Database error updating adoption" });
    }

    db.query(updatePet, [pname], (err2, petResult) => {
      if (err2) {
        console.error("Error updating pet status:", err2);
        return res.status(500).json({ error: "Database error updating pet status" });
      }

      return res.json({ message: "Adoption and pet status updated successfully" });
    });
  });
});

// Optional endpoint for complete payment confirmation
app.get('/api/complete-payment', (req, res) => {
  const { aid, pname } = req.query;

  if (!aid || !pname) {
    return res.status(400).json({ success: false, error: "Missing parameters" });
  }

  const updateAdoption = `UPDATE adoptions SET status='Adopted' WHERE aid = ?`;
  const updatePet = `UPDATE pets SET status='Adopted' WHERE name = ?`; // fixed pname -> name

  db.query(updateAdoption, [aid], (err1, result1) => {
    if (err1) return res.json({ success: false });

    db.query(updatePet, [pname], (err2, result2) => {
      if (err2) return res.json({ success: false });
      res.json({ success: true });
    });
  });
});

app.get('/api/profile', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { password, ...userWithoutPassword } = req.session.user;
  res.json(userWithoutPassword);
});

// Show profile page (protected route)
app.get("/showprofile", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  res.sendFile(path.join(__dirname, "showprofile.html"));
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

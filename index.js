const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const corsOptions = {
  origin: "*", 
  credentials: true,
  optionSuccessStatus: 200,
};

const app = express();
app.use(express.json());
app.use(cors(corsOptions));

const { initializeDatabase } = require("./db/db.connect");
const User = require("./models/user.models");

initializeDatabase();

const SECRET_KEY = process.env.SECRET_KEY
const JWT_SECRET = process.env.JWT_SECRET

// Middleware to verify JWT
const verifyJWT = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) {
    return res.status(401).json({ message: "No token provided." });
  }

  try {
    const decodedToken = jwt.verify(token, JWT_SECRET);
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(402).json({ message: "Invalid token" });
  }
};

// User Login Route
app.post("/user/login", async (req, res) => {
  const { email, password, secret } = req.body;

  if (secret !== SECRET_KEY) {
    return res.status(403).json({ message: "Invalid secret key." });
  }

  try {
    // Look for a user with the provided email and password
    const user = await User.findOne({ email, password });
    if (!user) {
      return res.status(403).json({ message: "Invalid email or password" });
    }

    // Generate a JWT token if login is successful
    const token = jwt.sign({ id: user._id, role: "user" }, JWT_SECRET, {
      expiresIn: "24h",
    });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Protected route example
app.get("/admin/api/data", verifyJWT, (req, res) => {
  res.json({ message: "Protected route accessible" });
});

app.listen(3000, () => console.log("Server is running on 3000"));

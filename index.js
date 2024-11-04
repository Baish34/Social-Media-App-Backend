const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

const { initializeDatabase } = require("./db/db.connect");
const User = require("./models/user.models");
const Post = require("./models/post.models")

initializeDatabase();

// Middleware for JWT verification
const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization") // Extract the token
  if (!token) return res.status(401).json({ error: "Access denied" });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).json({ error: "Invalid token" });
  }
};


// Register User
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const user = new User({ username, email, password });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login User
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (user && user.password === password) {  
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ token, user });
    } else {
      res.status(400).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to login' });
  }
});


// Get all users
app.get("/users", async (req, res) => {
  try {
    const allUsers = await User.find();
    res.json(allUsers);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/admin/api/data", authMiddleware, (req, res) => {
  res.json({ message: "Protected route accessible" });
});


// Create a new post
app.post("/posts", authMiddleware, async (req, res) => {
  const { content, media } = req.body;
  try {
    const post = new Post({
      user: req.user.userId,  
      content,
      media,
    });
    await post.save();
    res.status(201).json({ message: "Post created successfully", post });
  } catch (error) {
    res.status(500).json({ error: "Failed to create post" });
  }
});


// Get all posts
app.get("/posts", async (req, res) => {
  try {
    const posts = await Post.find().populate("user", "username").exec();
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve posts" });
  }
});

// Get a single post by ID
app.get("/posts/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate("user", "username");
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve post" });
  }
});


app.listen(3000, () => console.log("Server is running on 3000"));

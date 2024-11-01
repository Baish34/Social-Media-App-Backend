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
const Post = require("./models/post.models");

initializeDatabase();

const SECRET_KEY = process.env.SECRET_KEY;
const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_key"; 

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
    return res.status(403).json({ message: "Invalid token" });
  }
};

// New User Registration
app.post("/user/register", async (req, res) => {
  const { userName, email, password } = req.body;

  if (!userName || !email || !password) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists." });
    }

    const newUser = new User({ userName, email, password });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// User Login with JWT
app.post("/user/login", async (req, res) => {
  const { email, password, secret } = req.body;

  if (secret !== SECRET_KEY) {
    return res.status(403).json({ message: "Invalid secret key." });
  }

  try {
    const user = await User.findOne({ email, password });
    if (!user) {
      return res.status(403).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user._id, role: "user" }, JWT_SECRET, {
      expiresIn: "24h",
    });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get all users
app.get("/users", async (req, res) => {
  try {
    const allusers = await User.find();
    res.json(allusers);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Protected Route - Create a new post
app.post("/posts", verifyJWT, async (req, res) => {
  const { content, image } = req.body;
  try {
    const post = new Post({
      userId: req.user.id,
      content,
      image,
    });
    const savedPost = await post.save();
    res.status(201).json(savedPost);
  } catch (error) {
    res.status(500).json({ message: "Failed to create post.", error });
  }
});

// Get all posts
app.get("/posts", async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("userId", "userName")
      .populate("comments.userId", "userName");
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch posts.", error });
  }
});

// Get a specific post by ID
app.get("/posts/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("userId", "userName")
      .populate("comments.userId", "userName");
    if (!post) return res.status(404).json({ message: "Post not found." });
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch post.", error });
  }
});

// Update a post
app.put("/posts/:id", verifyJWT, async (req, res) => {
  const { content, image } = req.body;
  try {
    const post = await Post.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { content, image },
      { new: true }
    );
    if (!post)
      return res
        .status(404)
        .json({ message: "Post not found or unauthorized." });
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: "Failed to update post.", error });
  }
});

// Delete a post
app.delete("/posts/:id", verifyJWT, async (req, res) => {
  try {
    const post = await Post.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!post)
      return res
        .status(404)
        .json({ message: "Post not found or unauthorized." });
    res.json({ message: "Post deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete post.", error });
  }
});

// Like a post
app.put("/posts/:id/like", verifyJWT, async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );
    if (!post) return res.status(404).json({ message: "Post not found." });
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: "Failed to like post.", error });
  }
});

// Add a comment to a post
app.post("/posts/:id/comments", verifyJWT, async (req, res) => {
  const { content } = req.body;
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found." });

    const comment = { userId: req.user.id, content, createdAt: new Date() };
    post.comments.push(comment);
    await post.save();
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ message: "Failed to add comment.", error });
  }
});

// Protected route example
app.get("/admin/api/data", verifyJWT, (req, res) => {
  res.json({ message: "Protected route accessible" });
});

app.listen(3000, () => console.log("Server is running on 3000"));

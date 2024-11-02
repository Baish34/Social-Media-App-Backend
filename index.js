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

// Middleware for JWT verification
const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Access denied" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
};

// Register Route
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const user = new User({ username, email, password });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.status(201).json({ token });
  } catch (error) {
    res.status(500).json({ message: "Error registering user", error });
  }
});

// Login Route
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error });
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

// Create a new post
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


app.listen(3000, () => console.log("Server is running on 3000"));

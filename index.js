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
const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization"); // Extract the token
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
  const { name, email, password } = req.body;
  try {
    const user = new User({ name, email, password });
    await user.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to register user" });
  }
});

// Login User
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (user && user.password === password) {
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
      res.json({ token, user });
    } else {
      res.status(400).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to login" });
  }
});

// Get user profile along with their posts
app.get("/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find user details
    const user = await User.findById(userId).select(
      "name email bio avatar followers following"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find posts by this user
    const userPosts = await Post.find({ user: userId }).sort({ createdAt: -1 });

    res.json({
      user: {
        name: user.name,
        email: user.email,
        bio: user.bio,
        avatar: user.avatar,
        followers: user.followers.length,
        following: user.following.length,
      },
      posts: userPosts,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve profile and posts" });
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

// Follow a user
app.post("/follow/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userToFollowId = req.params.id;

    const user = await User.findById(userId);
    const userToFollow = await User.findById(userToFollowId);

    if (!user || !userToFollow) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.following.includes(userToFollowId.toString())) {
      user.following.push(userToFollowId);
      userToFollow.followers.push(userId);
      await user.save();
      await userToFollow.save();
    }

    res.json({ userId: userToFollowId, message: "User followed successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to follow user" });
  }
});

// Unfollow a user
app.post("/unfollow/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userToUnfollowId = req.params.id;

    const user = await User.findById(userId);
    const userToUnfollow = await User.findById(userToUnfollowId);

    if (!user || !userToUnfollow) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.following.includes(userToUnfollowId.toString())) {
      user.following = user.following.filter(
        (id) => id.toString() !== userToUnfollowId
      );
      userToUnfollow.followers = userToUnfollow.followers.filter(
        (id) => id.toString() !== userId
      );
      await user.save();
      await userToUnfollow.save();

      res.json({
        userId: userToUnfollowId,
        message: "User unfollowed successfully",
      });
    } else {
      res.status(400).json({ error: "Not following this user" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to unfollow user" });
  }
});

// Like a post
app.post("/posts/:postId/like", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const postId = req.params.postId;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Check if the user already liked the post
    if (!post.likes.includes(userId)) {
      post.likes.push(userId);
      await post.save();
      return res.json({ message: "Post liked successfully", post });
    }

    res.status(400).json({ error: "Post already liked" });
  } catch (error) {
    res.status(500).json({ error: "Failed to like post" });
  }
});

// Unlike a post
app.post("/posts/:postId/unlike", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const postId = req.params.postId;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Check if the user has liked the post
    if (post.likes.includes(userId)) {
      post.likes = post.likes.filter((id) => id.toString() !== userId);
      await post.save();
      return res.json({ message: "Post unliked successfully", post });
    }

    res.status(400).json({ error: "Post not liked yet" });
  } catch (error) {
    res.status(500).json({ error: "Failed to unlike post" });
  }
});

// Bookmark a post
app.post("/posts/:postId/bookmark", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId; // User ID from auth middleware
    const postId = req.params.postId;

    // Check if the post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (!post.bookmarks.includes(userId)) {
      post.bookmarks.push(userId);
      await post.save();
      return res.json({ message: "Post bookmarked successfully", bookmarks});
    }

    res.status(400).json({ error: "Post already bookmarked" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to bookmark post" });
  }
});

// Remove a bookmarked post
app.post("/posts/:postId/unbookmark", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId; // User ID from auth middleware
    const postId = req.params.postId;

    // Check if the post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Remove the bookmark if it exists
    if (post.bookmarks.includes(userId)) {
      post.bookmarks = post.bookmarks.filter((id) => id.toString() !== userId);
      await post.save();
      return res.json({ message: "Post removed from bookmarks", bookmarks});
    }

    res.status(400).json({ error: "Post not bookmarked yet" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to remove bookmark" });
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
    const posts = await Post.find().populate("user", "name avatar").exec();
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve posts" });
  }
});

// Get posts for a specific user
app.get("/posts/user/:userId", async (req, res) => {
  try {
    const posts = await Post.find({ user: req.params.userId }); 
    if (!posts) return res.status(404).json({ error: "Posts not found" });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve posts" });
  }
});

const avatarOptions = [
  "https://plus.unsplash.com/premium_vector-1727955579176-073f1c85dcda?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MjV8fGF2YXRhcnN8ZW58MHx8MHx8fDA%3D",
  "https://plus.unsplash.com/premium_vector-1728555239662-4d94974e6c71?q=80&w=1800&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://plus.unsplash.com/premium_vector-1721131162874-d8bcb33d6bad?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mzh8fGF2YXRhcnN8ZW58MHx8MHx8fDA%3D",
  "https://plus.unsplash.com/premium_vector-1728572090698-c48406f95374?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NDZ8fGF2YXRhcnN8ZW58MHx8MHx8fDA%3D",
  "https://plus.unsplash.com/premium_vector-1728572090837-2828fc9ca131?q=80&w=1800&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
];

// Route to update the user's avatar
app.put("/user/avatar", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { avatarUrl } = req.body;

    if (!avatarOptions.includes(avatarUrl)) {
      return res.status(400).json({ message: "Invalid avatar selection" });
    }
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { avatar: avatarUrl },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "Avatar updated successfully",
      avatar: updatedUser.avatar,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

app.listen(3000, () => console.log("Server is running on 3000"));

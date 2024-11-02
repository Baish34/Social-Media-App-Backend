const mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    maxLength: 1000
  },
  media: {
    type: [String], // Array of URLs for images or videos
    default: []
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
}, {timestamps: true},{ collection: "userPosts" });

const Post = mongoose.model("Post", postSchema);

module.exports = Post;

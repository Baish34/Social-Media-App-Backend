const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    userName: String,
    email: String,
    password: String,
}, { collection: "usersData" });

const User = mongoose.model("User", userSchema);
module.exports = User;

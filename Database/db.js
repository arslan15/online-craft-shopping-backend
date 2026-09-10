const mongoose = require('mongoose');
const dns = require('node:dns');

// Fix DNS resolution issues for MongoDB Atlas connections if needed
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log("MongoDB Connected");
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1); 
  }
};

module.exports = connectDB;
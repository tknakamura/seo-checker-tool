const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return false;
  }
  if (isConnected) {
    return true;
  }
  try {
    await mongoose.connect(uri, {
      maxPoolSize: 10,
    });
    isConnected = true;
    return true;
  } catch (err) {
    console.warn('MongoDB connection failed:', err.message);
    return false;
  }
}

function isDBConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

module.exports = { connectDB, isDBConnected };

const mongoose = require("mongoose");

async function mongooseConnect() {
  try {
    await mongoose.connect("mongodb://localhost:27017/aroundb");
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
    throw err;
  }
}

module.exports = mongooseConnect;

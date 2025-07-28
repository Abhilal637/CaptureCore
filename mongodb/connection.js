
const mongoose = require('mongoose');

module.exports = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/capturecore', {
      useNewUrlParser: true,
      useUnifiedTopology: true, // ✅ Important for stable connection
    });
    console.log('✅ MongoDB connected successfully');


  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1); // Exit the app if DB connection fails
  }
};



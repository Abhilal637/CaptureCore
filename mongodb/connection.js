
const mongoose = require('mongoose');

module.exports = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/capturecore', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');


  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};



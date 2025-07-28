const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },

  email: { type: String, required: true, unique: true },

  password: {
    type: String,
    required: function () {
      return !this.googleId && !this.facebookId;
    }
  },

  mobile: { type: String, required: true },

  address: { type: String },

  isVerified: { type: Boolean, default: false },

  isBlocked: { type: Boolean, default: false },

  isAdmin: { type: Boolean, default: false }, 

  otp: { type: String },

  otpExpiry: { type: Date },

  googleId: { type: String },

  facebookId: { type: String }

}, { timestamps: true }); // includes createdAt and updatedAt

module.exports = mongoose.model('User', userSchema);

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { 
    type: String, 
    required: true, 
    unique: true
  },
  password: {
    type: String,
    required: function () {
      return !this.googleId && !this.facebookId;
    }
  },
  mobile: { 
    type: String, 
    required: function () {
      return !this.googleId && !this.facebookId;
    }
  },
  address: { type: String },
  profilePicture: { type: String },
  isVerified: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  
  otp: { type: String },
  otpExpiry: { type: Date },
  
  googleId: { type: String },
  facebookId: { type: String },
  
  authProvider: { 
    type: [String], 
    default: ['local']
  },
  
  lastLogin: { type: Date },
  loginCount: { type: Number, default: 0 }
}, { 
  timestamps: true
});

// Method to add authentication provider
userSchema.methods.addAuthProvider = function(provider) {
  if (!this.authProvider.includes(provider)) {
    this.authProvider.push(provider);
  }
  return this;
};

// Method to update login information
userSchema.methods.updateLoginInfo = function() {
  this.lastLogin = new Date();
  this.loginCount += 1;
  return this;
};

module.exports = mongoose.model('User', userSchema);
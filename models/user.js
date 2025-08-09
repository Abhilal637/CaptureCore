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
      return !this.googleId
    }
  },
  mobile: { 
    type: Number , 
    required: function () {
      return !this.googleId 
    }
  },
  address: {
    street: String,
    city: String,
    state: String,
    zip: String,
    phone: String
  },
  profilePicture: { type: String },
  isVerified: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  wallet: {
    type: Number,
    default: 0
  },
walletTransactions: [
  {
    type: {
      type: String,
      enum: ['Refund', 'Purchase', 'Top-up'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    }
  }
],  
  
  otp: { type: String },
  otpExpiry: { type: Date },
  
  googleId: { type: String },
  facebookId: { type: String },
  
  authProvider: { 
    type: [String], 
    default: ['local']
  },
  
  lastLogin: { type: Date },
  loginCount: { type: Number, default: 0 },
  
  resetToken: String,
  resetTokenExpiry: Date,

  wishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }]
}, { 
  timestamps: true
});



userSchema.methods.addAuthProvider = function(provider) {
  if (!this.authProvider.includes(provider)) {
    this.authProvider.push(provider);
  }
  return this;
};

userSchema.methods.updateLoginInfo = function() {
  this.lastLogin = new Date();
  this.loginCount += 1;
  return this;
};



module.exports = mongoose.model('User', userSchema);
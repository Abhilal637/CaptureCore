const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user', 
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Refund', 'Purchase', 'Top-up'],
    required: true
  },
  orderId: {
    type: String,
    default: null 
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
const WalletTransaction = require('../models/walletTransaction');
const User = require('../models/user');

async function refundToWallet(userId, amount, description, orderId = null) {
  await User.findByIdAndUpdate(userId, {
    $inc: { wallet: amount }
  });

  await WalletTransaction.create({
    userId,
    amount,
    description: description || 'Refund for returned order',
    type: 'Refund',
    orderId
  });
}

module.exports = { refundToWallet };

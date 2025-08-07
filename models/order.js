const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true,
    required: true
  },

  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  address: { type: mongoose.Schema.Types.ObjectId, ref: 'Address' },

  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: String,
    quantity: Number,
    price: Number,
    totalAmount: Number,

    status: {
      type: String,
      enum: ['Placed', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned'],
      default: 'Placed'
    },

    isCancelled: { type: Boolean, default: false },
    isReturned: { type: Boolean, default: false },

    cancelReason: { type: String, default: '' },
    returnReason: { type: String, default: '' },

    returnRequested: { type: Boolean, default: false },
    returnApproved: { type: Boolean, default: false }
  }],

  paymentMethod: {
    type: String,
    enum: ['COD', 'ONLINE'],
    default: 'COD'
  },

  status: {
    type: String,
    enum: ['Placed', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned'],
    default: 'Placed'
  },

  cancelReason: { type: String, default: '' },

  subtotal: Number,
  tax: Number,
  discount: Number,
  shipping: Number,
  total: Number,

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);

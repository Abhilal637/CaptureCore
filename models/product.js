const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  isBlocked: { type: Boolean, default: false },
  isListed: { type: Boolean, default: true },
  stock: { type: Number, default: 0 },
  highlights: [String],
  images: [String],
  ratings: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  }
});

module.exports = mongoose.model('Product', productSchema);

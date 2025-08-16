const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  brand: { type: String, trim: true, index: true },
  megapixelBucket: {
    type: String,
    enum: ['12-16', '16-24', '24+'],
  },
  batteryType: {
    type: String,
    enum: ['lithium-ion', 'rechargeable'],
  },
  cameraType: {
    type: String,
    enum: ['dslr', 'mirrorless', 'point-shoot', 'action', 'drone'],
  },
  lensMount: {
    type: String,
    enum: ['canon-ef', 'canon-rf', 'nikon-f', 'nikon-z', 'sony-e', 'fujifilm-x'],
  },
  
  focalLength: {
    type: String,
    enum: ['14mm', '24mm', '35mm', '50mm', '85mm', '100mm', '200mm', '300mm', '400mm', '600mm'],
  },
  fAperture: {
    type: String,
    enum: ['f/1.2', 'f/1.4', 'f/1.8', 'f/2', 'f/2.8', 'f/3.5', 'f/4', 'f/5.6', 'f/8', 'f/11', 'f/16', 'f/22'],
  },
  lensType: {
    type: String,
    enum: ['prime', 'zoom', 'macro', 'telephoto', 'wide-angle', 'standard'],
  },
  availability: {
    type: String,
    enum: ['in-stock', 'pre-order', 'backorder'],
    default: 'in-stock'
  },
  isBlocked: { type: Boolean, default: false },
  isListed: { type: Boolean, default: true },
  stock: { type: Number, default: 0 },
  highlights: [String],
  images: [String],
  ratings: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false },
   isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  }
});

module.exports = mongoose.model('Product', productSchema);

const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  addressLine: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  country: { type: String, default: 'India' },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });


addressSchema.index({
  user: 1,
  fullName: 1,
  phone: 1,
  addressLine: 1,
  city: 1,
  state: 1,
  pincode: 1
}, { unique: true });

module.exports = mongoose.model('Address', addressSchema);

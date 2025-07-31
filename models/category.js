const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true // e.g., "mirrorless"
  },
  description: {
    type: String,
    default: "" // Optional details
  },
  active: {
    type: Boolean,
    default: true // true = Active, false = Inactive
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  active: {
    type: Boolean,
    default: true
  }
});

module.exports = mongoose.model('Category', categorySchema);

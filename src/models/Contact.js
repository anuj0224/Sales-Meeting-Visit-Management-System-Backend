const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer account reference is required']
    },
    name: {
      type: String,
      required: [true, 'Contact person name is required'],
      trim: true
    },
    title: {
      type: String,
      default: ''
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      default: ''
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

contactSchema.index({ customer: 1, name: 1 });

module.exports = mongoose.model('Contact', contactSchema);

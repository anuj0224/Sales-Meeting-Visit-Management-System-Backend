const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      unique: true
    },
    industry: {
      type: String,
      default: 'General'
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
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      zipCode: { type: String, default: '' },
      country: { type: String, default: 'India' }
    },
    website: {
      type: String,
      default: ''
    },
    accountTier: {
      type: String,
      enum: ['Enterprise', 'Mid-Market', 'SMB', 'Lead'],
      default: 'Mid-Market'
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Lead'],
      default: 'Active'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

customerSchema.index({ companyName: 1, status: 1 });

module.exports = mongoose.model('Customer', customerSchema);

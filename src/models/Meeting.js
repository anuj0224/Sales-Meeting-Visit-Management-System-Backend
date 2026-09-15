const mongoose = require('mongoose');

const visitSessionSchema = new mongoose.Schema(
  {
    sessionIndex: {
      type: Number,
      required: true,
      default: 1
    },
    checkInTime: {
      type: Date,
      required: true
    },
    checkInLocation: {
      address: { type: String, default: '' },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      notes: { type: String, default: '' }
    },
    checkOutTime: {
      type: Date,
      default: null
    },
    checkOutLocation: {
      address: { type: String, default: '' },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      notes: { type: String, default: '' }
    },
    sessionStatus: {
      type: String,
      enum: ['Active', 'Paused/Rescheduled', 'Completed'],
      default: 'Active'
    },
    interruptionReason: {
      type: String,
      default: ''
    },
    rescheduledReturnTime: {
      type: Date,
      default: null
    },
    notes: {
      type: String,
      default: ''
    }
  },
  { _id: true, timestamps: true }
);

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true
    },
    fromStatus: {
      type: String,
      default: ''
    },
    toStatus: {
      type: String,
      required: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    performedByName: {
      type: String,
      default: ''
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    reason: {
      type: String,
      default: ''
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { _id: true }
);

const meetingSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer account is required']
    },
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: [true, 'Contact person is required']
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned sales employee is required']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    purpose: {
      type: String,
      required: [true, 'Meeting purpose is required'],
      trim: true
    },
    location: {
      address: { type: String, required: [true, 'Meeting location address is required'] },
      city: { type: String, default: '' },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null }
    },
    scheduledStartTime: {
      type: Date,
      required: [true, 'Scheduled start time is required']
    },
    scheduledEndTime: {
      type: Date,
      required: [true, 'Scheduled end time is required']
    },
    // Main lifecycle status
    status: {
      type: String,
      enum: ['Scheduled', 'Confirmed', 'Checked In', 'In Progress', 'Completed'],
      default: 'Scheduled'
    },
    // Sub-status for edge-case tracking (e.g. Interrupted / Rescheduled)
    subStatus: {
      type: String,
      enum: ['None', 'Interrupted/Rescheduled'],
      default: 'None'
    },
    notes: {
      type: String,
      default: ''
    },
    // Visit sessions history (preserves multiple check-in/outs during interruptions)
    visits: [visitSessionSchema],

    // Recorded Outcome
    outcome: {
      result: {
        type: String,
        enum: ['Interested', 'Follow-up Required', 'Proposal Requested', 'Not Interested', 'Unable to Meet', null],
        default: null
      },
      notes: { type: String, default: '' },
      recordedAt: { type: Date, default: null },
      recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
    },

    // Reopen Tracking
    reopenedCount: {
      type: Number,
      default: 0
    },
    lastReopenedAt: {
      type: Date,
      default: null
    },
    lastReopenedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    // Audit Trail
    auditLog: [auditLogSchema]
  },
  {
    timestamps: true
  }
);

meetingSchema.index({ assignedTo: 1, scheduledStartTime: 1, status: 1 });
meetingSchema.index({ customer: 1, status: 1 });

module.exports = mongoose.model('Meeting', meetingSchema);

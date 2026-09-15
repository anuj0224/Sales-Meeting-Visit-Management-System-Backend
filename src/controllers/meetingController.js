const Meeting = require('../models/Meeting');
const FollowUp = require('../models/FollowUp');
const Customer = require('../models/Customer');
const Contact = require('../models/Contact');
const User = require('../models/User');

// Helper to log audit entries
const addAuditEntry = (meeting, action, fromStatus, toStatus, user, reason = '', metadata = {}) => {
  meeting.auditLog.push({
    action,
    fromStatus: fromStatus || '',
    toStatus,
    performedBy: user._id,
    performedByName: user.name || 'System User',
    timestamp: new Date(),
    reason,
    metadata
  });
};

// @desc    Get all meetings with filters & search
// @route   GET /api/meetings
// @access  Private
const getMeetings = async (req, res, next) => {
  try {
    const { status, assignedTo, customerId, startDate, endDate, search } = req.query;
    let filter = {};

    // Role restrictions: Employees see only their assigned or created meetings
    if (req.user.role === 'Sales Employee') {
      filter.$or = [{ assignedTo: req.user._id }, { createdBy: req.user._id }];
    } else if (assignedTo) {
      filter.assignedTo = assignedTo;
    }

    if (status) filter.status = status;
    if (customerId) filter.customer = customerId;

    if (startDate || endDate) {
      filter.scheduledStartTime = {};
      if (startDate) filter.scheduledStartTime.$gte = new Date(startDate);
      if (endDate) filter.scheduledStartTime.$lte = new Date(endDate);
    }

    if (search) {
      filter.purpose = { $regex: search, $options: 'i' };
    }

    const meetings = await Meeting.find(filter)
      .populate('customer', 'companyName industry accountTier phone')
      .populate('contact', 'name title email phone')
      .populate('assignedTo', 'name email role department')
      .populate('createdBy', 'name email role')
      .sort({ scheduledStartTime: -1 });

    res.json({
      success: true,
      count: meetings.length,
      data: meetings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single meeting by ID
// @route   GET /api/meetings/:id
// @access  Private
const getMeetingById = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('customer', 'companyName industry address phone email accountTier')
      .populate('contact', 'name title email phone isPrimary')
      .populate('assignedTo', 'name email role department phone')
      .populate('createdBy', 'name email role')
      .populate('outcome.recordedBy', 'name email role')
      .populate('lastReopenedBy', 'name email role');

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: { message: 'Meeting not found', code: 'NOT_FOUND' }
      });
    }

    // Role check: Employee can only view assigned or created meeting
    if (
      req.user.role === 'Sales Employee' &&
      meeting.assignedTo._id.toString() !== req.user._id.toString() &&
      meeting.createdBy._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        error: { message: 'You do not have permission to view this meeting', code: 'FORBIDDEN' }
      });
    }

    // Fetch related follow-ups
    const followUps = await FollowUp.find({ meeting: meeting._id })
      .populate('owner', 'name email role')
      .sort({ dueDate: 1 });

    res.json({
      success: true,
      data: {
        ...meeting.toObject(),
        followUps
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new meeting
// @route   POST /api/meetings
// @access  Private
const createMeeting = async (req, res, next) => {
  try {
    const { customerId, contactId, purpose, location, scheduledStartTime, scheduledEndTime, assignedToId, notes } = req.body;

    if (!customerId || !contactId || !purpose || !location || !scheduledStartTime || !scheduledEndTime) {
      return res.status(400).json({
        success: false,
        error: { message: 'Please provide all mandatory fields (customer, contact, purpose, location, start/end times)', code: 'INVALID_INPUT' }
      });
    }

    const start = new Date(scheduledStartTime);
    const end = new Date(scheduledEndTime);

    if (end <= start) {
      return res.status(400).json({
        success: false,
        error: { message: 'Scheduled end time must be after scheduled start time', code: 'INVALID_TIME_RANGE' }
      });
    }

    const assignedUser = assignedToId ? assignedToId : req.user._id;

    const meeting = new Meeting({
      customer: customerId,
      contact: contactId,
      purpose,
      location: typeof location === 'string' ? { address: location } : location,
      scheduledStartTime: start,
      scheduledEndTime: end,
      assignedTo: assignedUser,
      createdBy: req.user._id,
      notes: notes || '',
      status: 'Scheduled'
    });

    addAuditEntry(meeting, 'CREATE_MEETING', '', 'Scheduled', req.user, 'Meeting scheduled');
    await meeting.save();

    const populated = await Meeting.findById(meeting._id)
      .populate('customer', 'companyName')
      .populate('contact', 'name title')
      .populate('assignedTo', 'name email');

    res.status(201).json({
      success: true,
      data: populated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Confirm a scheduled meeting
// @route   PATCH /api/meetings/:id/confirm
// @access  Private
const confirmMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: { message: 'Meeting not found', code: 'NOT_FOUND' }
      });
    }

    if (meeting.status !== 'Scheduled') {
      return res.status(400).json({
        success: false,
        error: {
          message: `Cannot confirm meeting in '${meeting.status}' state. Must be 'Scheduled'.`,
          code: 'INVALID_STATE_TRANSITION'
        }
      });
    }

    const oldStatus = meeting.status;
    meeting.status = 'Confirmed';
    addAuditEntry(meeting, 'CONFIRM_MEETING', oldStatus, 'Confirmed', req.user, 'Meeting confirmed by customer/sales');

    await meeting.save();

    res.json({
      success: true,
      data: meeting
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check-In to a meeting (starts visit session)
// @route   POST /api/meetings/:id/check-in
// @access  Private
const checkInMeeting = async (req, res, next) => {
  try {
    const { location, notes } = req.body;
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: { message: 'Meeting not found', code: 'NOT_FOUND' }
      });
    }

    // Permission check: assigned sales employee or admin
    if (req.user.role === 'Sales Employee' && meeting.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: { message: 'Only assigned sales employee can check in to this meeting', code: 'FORBIDDEN' }
      });
    }

    // Business Rule: Check-in only allowed from Scheduled, Confirmed, or In Progress (if resumed)
    if (!['Scheduled', 'Confirmed', 'In Progress'].includes(meeting.status)) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Cannot check in when meeting is in '${meeting.status}' state.`,
          code: 'INVALID_STATE_TRANSITION'
        }
      });
    }

    // Check if there is an active visit session already without checkOutTime
    const activeVisit = meeting.visits.find(v => v.sessionStatus === 'Active');
    if (activeVisit) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'An active visit session is already checked in. Check out or pause current session first.',
          code: 'ACTIVE_SESSION_EXISTS'
        }
      });
    }

    const checkInTimestamp = req.body.checkInTime ? new Date(req.body.checkInTime) : new Date();
    const newSessionIndex = meeting.visits.length + 1;

    meeting.visits.push({
      sessionIndex: newSessionIndex,
      checkInTime: checkInTimestamp,
      checkInLocation: location || { address: meeting.location.address },
      sessionStatus: 'Active',
      notes: notes || ''
    });

    const oldStatus = meeting.status;
    meeting.status = 'Checked In'; // state indicator
    meeting.status = 'In Progress'; // immediately transitions to In Progress
    meeting.subStatus = 'None';

    addAuditEntry(
      meeting,
      'CHECK_IN',
      oldStatus,
      'In Progress',
      req.user,
      `Check-in recorded for visit session #${newSessionIndex} at ${checkInTimestamp.toISOString()}`,
      { location, sessionIndex: newSessionIndex }
    );

    await meeting.save();

    res.json({
      success: true,
      message: `Checked in successfully (Session #${newSessionIndex})`,
      data: meeting
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Pause/Reschedule an active visit session (10:02 AM scenario support)
// @route   POST /api/meetings/:id/pause-reschedule
// @access  Private
const pauseOrRescheduleMeeting = async (req, res, next) => {
  try {
    const { interruptionReason, rescheduledReturnTime, checkOutLocation, notes } = req.body;
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: { message: 'Meeting not found', code: 'NOT_FOUND' }
      });
    }

    if (meeting.status !== 'In Progress' && meeting.status !== 'Checked In') {
      return res.status(400).json({
        success: false,
        error: {
          message: `Cannot pause/reschedule meeting unless it is 'In Progress'. Current status: '${meeting.status}'`,
          code: 'INVALID_STATE_TRANSITION'
        }
      });
    }

    // Find current active visit session
    const activeVisit = meeting.visits.find(v => v.sessionStatus === 'Active');
    if (!activeVisit) {
      return res.status(400).json({
        success: false,
        error: { message: 'No active visit session found to pause/reschedule.', code: 'NO_ACTIVE_SESSION' }
      });
    }

    const checkOutTimestamp = req.body.checkOutTime ? new Date(req.body.checkOutTime) : new Date();

    // Close active visit session with Paused/Rescheduled
    activeVisit.checkOutTime = checkOutTimestamp;
    activeVisit.checkOutLocation = checkOutLocation || { address: meeting.location.address };
    activeVisit.sessionStatus = 'Paused/Rescheduled';
    activeVisit.interruptionReason = interruptionReason || 'Customer requested to return later';
    if (rescheduledReturnTime) {
      activeVisit.rescheduledReturnTime = new Date(rescheduledReturnTime);
    }
    if (notes) {
      activeVisit.notes = notes;
    }

    meeting.subStatus = 'Interrupted/Rescheduled';

    addAuditEntry(
      meeting,
      'PAUSE_RESCHEDULE',
      meeting.status,
      meeting.status,
      req.user,
      `Visit session #${activeVisit.sessionIndex} paused at ${checkOutTimestamp.toISOString()}. Reason: ${interruptionReason}. Scheduled return: ${rescheduledReturnTime}`,
      { interruptionReason, rescheduledReturnTime, sessionIndex: activeVisit.sessionIndex }
    );

    await meeting.save();

    res.json({
      success: true,
      message: 'Visit session paused/rescheduled. Historical check-in data preserved.',
      data: meeting
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check-Out and Complete Meeting (requires mandatory outcome & follow-up if required)
// @route   POST /api/meetings/:id/check-out-complete
// @access  Private
const checkOutAndCompleteMeeting = async (req, res, next) => {
  try {
    const { outcome, followUp, checkOutLocation, checkOutTime } = req.body;
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: { message: 'Meeting not found', code: 'NOT_FOUND' }
      });
    }

    // Business Rule 1: Cannot complete meeting directly from Scheduled or Confirmed without check-in!
    if (!['Checked In', 'In Progress'].includes(meeting.status)) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Cannot complete meeting in '${meeting.status}' state. Meeting must be checked-in and in-progress.`,
          code: 'INVALID_STATE_TRANSITION'
        }
      });
    }

    // Business Rule 2: Mandatory Outcome required
    if (!outcome || !outcome.result) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Mandatory meeting outcome result is required to complete meeting. Choose from Interested, Follow-up Required, Proposal Requested, Not Interested, Unable to Meet.',
          code: 'MANDATORY_OUTCOME_REQUIRED'
        }
      });
    }

    const validOutcomes = ['Interested', 'Follow-up Required', 'Proposal Requested', 'Not Interested', 'Unable to Meet'];
    if (!validOutcomes.includes(outcome.result)) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Invalid outcome result '${outcome.result}'. Must be one of: ${validOutcomes.join(', ')}`,
          code: 'INVALID_OUTCOME'
        }
      });
    }

    // Business Rule 3: If outcome is 'Follow-up Required', follow-up action must be provided or exist
    if (outcome.result === 'Follow-up Required') {
      const existingFollowUps = await FollowUp.find({ meeting: meeting._id });
      const hasNewFollowUp = followUp && followUp.title && followUp.dueDate;

      if (!hasNewFollowUp && existingFollowUps.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: "When outcome is 'Follow-up Required', a follow-up action with owner and due date is MANDATORY.",
            code: 'FOLLOWUP_REQUIRED'
          }
        });
      }
    }

    const checkOutTimestamp = checkOutTime ? new Date(checkOutTime) : new Date();

    // Close active visit session if present
    const activeVisit = meeting.visits.find(v => v.sessionStatus === 'Active');
    if (activeVisit) {
      activeVisit.checkOutTime = checkOutTimestamp;
      activeVisit.checkOutLocation = checkOutLocation || { address: meeting.location.address };
      activeVisit.sessionStatus = 'Completed';
    } else if (meeting.visits.length > 0) {
      // mark last visit completed
      const lastVisit = meeting.visits[meeting.visits.length - 1];
      if (!lastVisit.checkOutTime) {
        lastVisit.checkOutTime = checkOutTimestamp;
      }
      lastVisit.sessionStatus = 'Completed';
    }

    // Save Outcome
    meeting.outcome = {
      result: outcome.result,
      notes: outcome.notes || '',
      recordedAt: new Date(),
      recordedBy: req.user._id
    };

    // Create follow-up if provided
    if (followUp && followUp.title && followUp.dueDate) {
      await FollowUp.create({
        meeting: meeting._id,
        title: followUp.title,
        description: followUp.description || '',
        owner: followUp.ownerId || req.user._id,
        dueDate: new Date(followUp.dueDate),
        priority: followUp.priority || 'Medium',
        createdBy: req.user._id
      });
    }

    const oldStatus = meeting.status;
    meeting.status = 'Completed';
    meeting.subStatus = 'None';

    addAuditEntry(
      meeting,
      'COMPLETE_MEETING',
      oldStatus,
      'Completed',
      req.user,
      `Meeting completed with outcome '${outcome.result}'. Check-out logged at ${checkOutTimestamp.toISOString()}`,
      { outcomeResult: outcome.result }
    );

    await meeting.save();

    const updatedMeeting = await Meeting.findById(meeting._id)
      .populate('customer', 'companyName')
      .populate('contact', 'name title')
      .populate('assignedTo', 'name email');

    const followUps = await FollowUp.find({ meeting: meeting._id });

    res.json({
      success: true,
      message: 'Meeting checked out and completed successfully',
      data: {
        ...updatedMeeting.toObject(),
        followUps
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reopen a completed meeting (Sales Manager / Admin only)
// @route   POST /api/meetings/:id/reopen
// @access  Private (Sales Manager, Admin)
const reopenMeeting = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: { message: 'Meeting not found', code: 'NOT_FOUND' }
      });
    }

    // Permission check
    if (!['Sales Manager', 'Admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          message: `User role '${req.user.role}' cannot reopen meetings. Only Sales Managers and Admins can reopen completed meetings.`,
          code: 'FORBIDDEN_ROLE'
        }
      });
    }

    if (meeting.status !== 'Completed') {
      return res.status(400).json({
        success: false,
        error: {
          message: `Cannot reopen meeting in '${meeting.status}' state. Only 'Completed' meetings can be reopened.`,
          code: 'INVALID_STATE_TRANSITION'
        }
      });
    }

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'A valid reason (minimum 5 characters) must be provided to reopen a completed meeting.',
          code: 'REASON_REQUIRED'
        }
      });
    }

    const oldStatus = meeting.status;
    meeting.status = 'In Progress'; // transition back to In Progress
    meeting.reopenedCount += 1;
    meeting.lastReopenedAt = new Date();
    meeting.lastReopenedBy = req.user._id;

    addAuditEntry(
      meeting,
      'REOPEN_MEETING',
      oldStatus,
      'In Progress',
      req.user,
      `Meeting reopened by ${req.user.role} (${req.user.name}). Rationale: ${reason}`,
      { reopenReason: reason, reopenedCount: meeting.reopenedCount }
    );

    await meeting.save();

    res.json({
      success: true,
      message: 'Meeting reopened successfully',
      data: meeting
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update scheduled meeting details
// @route   PUT /api/meetings/:id
// @access  Private
const updateMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: { message: 'Meeting not found', code: 'NOT_FOUND' }
      });
    }

    if (['Completed'].includes(meeting.status) && req.user.role === 'Sales Employee') {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot edit a completed meeting', code: 'MEETING_COMPLETED' }
      });
    }

    const { purpose, location, scheduledStartTime, scheduledEndTime, assignedTo, notes } = req.body;

    if (purpose) meeting.purpose = purpose;
    if (location) meeting.location = typeof location === 'string' ? { address: location } : location;
    if (scheduledStartTime) meeting.scheduledStartTime = new Date(scheduledStartTime);
    if (scheduledEndTime) meeting.scheduledEndTime = new Date(scheduledEndTime);
    if (assignedTo) meeting.assignedTo = assignedTo;
    if (notes !== undefined) meeting.notes = notes;

    addAuditEntry(meeting, 'UPDATE_MEETING', meeting.status, meeting.status, req.user, 'Meeting details updated');

    await meeting.save();

    res.json({
      success: true,
      data: meeting
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMeetings,
  getMeetingById,
  createMeeting,
  confirmMeeting,
  checkInMeeting,
  pauseOrRescheduleMeeting,
  checkOutAndCompleteMeeting,
  reopenMeeting,
  updateMeeting
};

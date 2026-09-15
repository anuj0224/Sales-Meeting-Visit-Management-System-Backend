const FollowUp = require('../models/FollowUp');
const Meeting = require('../models/Meeting');

// @desc    Get follow-ups (filterable by status, owner, meeting)
// @route   GET /api/followups
// @access  Private
const getFollowUps = async (req, res, next) => {
  try {
    const { status, owner, meeting } = req.query;
    let filter = {};

    if (status) filter.status = status;
    if (meeting) filter.meeting = meeting;

    // Role-based visibility
    if (req.user.role === 'Sales Employee') {
      filter.owner = req.user._id;
    } else if (owner) {
      filter.owner = owner;
    }

    const followUps = await FollowUp.find(filter)
      .populate('owner', 'name email role')
      .populate('meeting', 'purpose location scheduledStartTime status')
      .sort({ dueDate: 1 });

    res.json({
      success: true,
      count: followUps.length,
      data: followUps
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create follow-up action item
// @route   POST /api/followups
// @access  Private
const createFollowUp = async (req, res, next) => {
  try {
    const { meetingId, title, description, ownerId, dueDate, priority } = req.body;

    if (!meetingId || !title || !dueDate) {
      return res.status(400).json({
        success: false,
        error: { message: 'meetingId, title, and dueDate are required fields', code: 'INVALID_INPUT' }
      });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: { message: 'Meeting not found', code: 'NOT_FOUND' }
      });
    }

    const followUp = await FollowUp.create({
      meeting: meetingId,
      title,
      description: description || '',
      owner: ownerId || req.user._id,
      dueDate: new Date(dueDate),
      priority: priority || 'Medium',
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      data: followUp
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update follow-up status (e.g., mark completed)
// @route   PATCH /api/followups/:id/status
// @access  Private
const updateFollowUpStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const followUp = await FollowUp.findById(req.params.id);

    if (!followUp) {
      return res.status(404).json({
        success: false,
        error: { message: 'Follow-up not found', code: 'NOT_FOUND' }
      });
    }

    followUp.status = status;
    if (status === 'Completed') {
      followUp.completedAt = new Date();
    }
    await followUp.save();

    res.json({
      success: true,
      data: followUp
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFollowUps,
  createFollowUp,
  updateFollowUpStatus
};

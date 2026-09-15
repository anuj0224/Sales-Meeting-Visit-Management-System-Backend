const Meeting = require('../models/Meeting');
const User = require('../models/User');
const FollowUp = require('../models/FollowUp');
const Customer = require('../models/Customer');

// @desc    Get team activity overview for Sales Managers
// @route   GET /api/analytics/team-activity
// @access  Private (Sales Manager, Admin)
const getTeamActivity = async (req, res, next) => {
  try {
    // Total meetings breakdown by status
    const statusCounts = await Meeting.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Outcome breakdown
    const outcomeCounts = await Meeting.aggregate([
      { $match: { 'outcome.result': { $ne: null } } },
      { $group: { _id: '$outcome.result', count: { $sum: 1 } } }
    ]);

    // Sales representative activity summary
    const repActivity = await Meeting.aggregate([
      {
        $group: {
          _id: '$assignedTo',
          totalMeetings: { $sum: 1 },
          completedMeetings: {
            $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
          },
          inProgressMeetings: {
            $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'rep'
        }
      },
      { $unwind: '$rep' },
      {
        $project: {
          _id: 1,
          name: '$rep.name',
          email: '$rep.email',
          role: '$rep.role',
          totalMeetings: 1,
          completedMeetings: 1,
          inProgressMeetings: 1
        }
      }
    ]);

    // Pending follow-ups summary
    const pendingFollowUps = await FollowUp.countDocuments({ status: 'Pending' });

    res.json({
      success: true,
      data: {
        statusCounts: statusCounts.reduce((acc, cur) => ({ ...acc, [cur._id]: cur.count }), {}),
        outcomeCounts: outcomeCounts.reduce((acc, cur) => ({ ...acc, [cur._id]: cur.count }), {}),
        repActivity,
        pendingFollowUps
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get system dashboard stats for Admin
// @route   GET /api/analytics/admin-stats
// @access  Private (Admin)
const getAdminStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalCustomers = await Customer.countDocuments();
    const totalMeetings = await Meeting.countDocuments();
    const totalFollowUps = await FollowUp.countDocuments();

    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalCustomers,
        totalMeetings,
        totalFollowUps,
        usersByRole: usersByRole.reduce((acc, cur) => ({ ...acc, [cur._id]: cur.count }), {})
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTeamActivity,
  getAdminStats
};

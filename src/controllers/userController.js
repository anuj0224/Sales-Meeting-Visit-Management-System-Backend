const User = require('../models/User');

// @desc    Get all users (with optional role filtering)
// @route   GET /api/users
// @access  Private
const getUsers = async (req, res, next) => {
  try {
    const { role } = req.query;
    let query = { isActive: true };

    if (role) {
      query.role = role;
    }

    // Sales Managers can see their team or all sales employees
    if (req.user.role === 'Sales Manager') {
      // return employees under manager or all employees
    }

    const users = await User.find(query).select('-password').sort({ name: 1 });

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get team members for Sales Manager
// @route   GET /api/users/team
// @access  Private (Sales Manager, Admin)
const getTeamMembers = async (req, res, next) => {
  try {
    let filter = {};
    if (req.user.role === 'Sales Manager') {
      filter = { $or: [{ manager: req.user._id }, { role: 'Sales Employee' }] };
    } else {
      filter = { role: { $in: ['Sales Employee', 'Sales Manager'] } };
    }

    const team = await User.find(filter).select('-password').sort({ name: 1 });

    res.json({
      success: true,
      count: team.length,
      data: team
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getTeamMembers
};

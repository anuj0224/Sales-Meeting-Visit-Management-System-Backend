const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { message: 'Not authorized, no bearer token provided', code: 'UNAUTHORIZED' }
    });
  }

  try {
    const secret = process.env.JWT_SECRET || 'optronix_sales_management_jwt_secret_key_2026_change_in_production';
    const decoded = jwt.verify(token, secret);

    // Attach user from database
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { message: 'User belonging to this token no longer exists', code: 'USER_NOT_FOUND' }
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: { message: 'User account is deactivated', code: 'ACCOUNT_INACTIVE' }
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: { message: 'Not authorized, token failed: ' + err.message, code: 'TOKEN_INVALID' }
    });
  }
};

module.exports = { protect };

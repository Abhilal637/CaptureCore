
const User = require('../models/user');
const { STATUS_CODES, MESSAGES } = require('../utils/constants');


const adminAuth = (req, res, next) => {
  if (req.session?.isAdmin && req.session?.admin) {
    return next();
  }
  return res.redirect('/admin/login');
};


const preventAdminLoginIfLoggedIn = (req, res, next) => {
  if (req.session?.isAdmin && req.session?.admin) {
    return res.redirect('/admin/dashboard');
  }
  next();
};


const noCache = (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  next();
};


const checkBlocked = async (req, res, next) => {
  if (!req.user) return next();

  try {
    if (req.user.isBlocked) {
      req.session.destroy(() => {
        if (req.is('application/json')) {
          return res.status(STATUS_CODES.UNAUTHORIZED).json({ message: 'User account is blocked' });
        }
        res.redirect('/login?isBlocked=true');
      });
    } else {
      next();
    }
  } catch (err) {
    console.error('Blocked check failed:', err);
    if (req.is('application/json')) {
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ message: 'Server error' });
    }
    res.redirect('/login');
  }
};

module.exports = {
  adminAuth,
  preventAdminLoginIfLoggedIn,
  noCache,
  checkBlocked
};

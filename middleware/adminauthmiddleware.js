
const User = require('../models/user');

function adminAuth(req, res, next) {
  if (req.session && req.session.isAdmin === true && req.session.admin) {
    return next();
  }
  return res.redirect('/admin/login');
}

function preventAdminLoginIfLoggedIn(req, res, next) {
  if (req.session && req.session.isAdmin === true && req.session.admin) {
    return res.redirect('/admin/dashboard');
  }
  next();
}

function noCache(req, res, next) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
}


const checkBlocked = async (req, res, next) => {
  if (!req.user) return next(); 

  try {
    // req.user is already the user object from isUserLoggedIn middleware
    if (req.user.isBlocked) {
      req.session.destroy(() => {
        if (req.headers['content-type'] === 'application/json') {
          return res.status(401).json({ message: 'User account is blocked' });
        }
        res.redirect('/login?isBlocked=true'); 
      });
    } else {
      next();
    }
  } catch (err) {
    console.error('Blocked check failed:', err);
    if (req.headers['content-type'] === 'application/json') {
      return res.status(500).json({ message: 'Server error' });
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

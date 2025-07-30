// middleware/adminAuthMiddleware.js

function adminAuth(req, res, next) {
  // Only allow if admin is logged in
  if (req.session && req.session.isAdmin === true && req.session.admin) {
    return next();
  }
  return res.redirect('/admin/login');
}

function preventAdminLoginIfLoggedIn(req, res, next) {
  // If admin is already logged in, prevent access to login page again
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
  if (!req.session.user) return next(); // not logged in, continue

  try {
    const user = await User.findById(req.session.user._id);
    if (!user || user. isBlocked) {
      req.session.destroy(() => {
        res.redirect('/login?isBlocked=true'); // or show custom "Blocked" page
      });
    } else {
      next();
    }
  } catch (err) {
    console.error('Blocked check failed:', err);
    res.redirect('/login');
  }
};





module.exports = {
  adminAuth,
  preventAdminLoginIfLoggedIn,
  noCache,
  checkBlocked
};

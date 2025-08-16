const User = require('../models/user');
const { STATUS_CODES, MESSAGES } = require('../utils/constants');

async function isUserLoggedIn(req, res, next) {
  try {
    if (!req.session?.userId) {
      return handleAuthFail(req, res, 'not_authenticated', 'Authentication required');
    }

    const user = await User.findById(req.session.userId);
    if (!user || !user.isVerified) {
      req.session.destroy(() => handleAuthFail(req, res, 'session_expired', 'Session expired'));
      return;
    }

    if (user.isBlocked) {
      await destroyAllUserSessions(req, user._id);
      req.session.destroy(() => handleAuthFail(req, res, 'user_blocked', 'User account is blocked'));
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Session validation error:', err);
    req.session.destroy(() => handleAuthFail(req, res, 'session_error', 'Session error'));
  }
}

function preventLoginIfLoggedIn(req, res, next) {
  if (req.session?.userId) return res.redirect('/');
  next();
}

function checkSessionTimeout(req, res, next) {
  const timeout = 24 * 60 * 60 * 1000;
  if (req.session?.lastActivity && Date.now() - req.session.lastActivity > timeout) {
    req.session.destroy(() => res.redirect('/login?error=session_timeout'));
    return;
  }
  if (req.session) req.session.lastActivity = Date.now();
  next();
}

function noCache(req, res, next) {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  next();
}

async function optionalAuth(req, res, next) {
  try {
    if (req.session?.userId) {
      const user = await User.findById(req.session.userId);
      if (user?.isVerified) req.user = user;
    }
  } catch (err) {
    console.error('Optional auth error:', err);
  }
  next(); 
}

function sessionSecurity(req, res, next) {
  if (req.session?.userId && !req.session.regenerated) {
    req.session.regenerate(err => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.redirect('/login?error=session_error');
      }
      req.session.userId = req.user._id;
      req.session.regenerated = true;
      next();
    });
  } else {
    next();
  }
}

function handleAuthFail(req, res, query, jsonMessage) {
  if (req.headers['content-type'] === 'application/json') {
    return res.status(STATUS_CODES.UNAUTHORIZED).json({ message: jsonMessage });
  }
  return res.redirect(`/login?error=${query}`);
}

async function destroyAllUserSessions(req, userId) {
  return new Promise((resolve, reject) => {
    if (!req.sessionStore) return resolve();
    req.sessionStore.all((err, sessions) => {
      if (err) return reject(err);
      for (const sid in sessions) {
        if (sessions[sid]?.userId?.toString() === userId.toString()) {
          req.sessionStore.destroy(sid, e => e && console.error('Failed to destroy session:', e));
        }
      }
      resolve();
    });
  });
}

module.exports = {
  isUserLoggedIn,
  preventLoginIfLoggedIn,
  noCache,
  checkSessionTimeout,
  optionalAuth,
  sessionSecurity
};

const User = require('../models/user');

// Check if user is authenticated
function isUserLoggedIn(req, res, next) {
    if (req.session && req.session.userId) {
        // Verify user still exists in database
        User.findById(req.session.userId)
            .then(user => {
                if (user && user.isVerified) {
                    if (user.isBlocked) {
                        // If user is blocked by admin, destroy session
                        req.session.destroy(() => {
                            if (req.headers['content-type'] === 'application/json') {
                                return res.status(401).json({ message: 'User account is blocked' });
                            }
                            return res.redirect('/login?error=user_blocked');
                        });
                    } else {
                        req.user = user; // Attach user to request
                        return next();
                    }
                } else {
                    // User doesn't exist or not verified, clear session
                    req.session.destroy(() => {
                        if (req.headers['content-type'] === 'application/json') {
                            return res.status(401).json({ message: 'Session expired' });
                        }
                        return res.redirect('/login?error=session_expired');
                    });
                }
            })
            .catch(err => {
                console.error('Session validation error:', err);
                req.session.destroy(() => {
                    if (req.headers['content-type'] === 'application/json') {
                        return res.status(401).json({ message: 'Session error' });
                    }
                    return res.redirect('/login?error=session_error');
                });
            });
    } else {
        if (req.headers['content-type'] === 'application/json') {
            return res.status(401).json({ message: 'Authentication required' });
        }
        return res.redirect('/login?error=not_authenticated');
    }
}

// Prevent logged-in users from accessing login/signup pages
function preventLoginIfLoggedIn(req, res, next) {
    if (req.session && req.session.userId) {
        return res.redirect('/');
    }
    next();
}

// Session timeout middleware
function checkSessionTimeout(req, res, next) {
    const sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    if (req.session && req.session.lastActivity) {
        const timeSinceLastActivity = Date.now() - req.session.lastActivity;
        
        if (timeSinceLastActivity > sessionTimeout) {
            req.session.destroy();
            return res.redirect('/login?error=session_timeout');
        }
    }
    
    // Update last activity
    if (req.session) {
        req.session.lastActivity = Date.now();
    }
    
    next();
}

// Prevent caching for authenticated pages
function noCache(req, res, next) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
}

// Optional authentication - doesn't redirect but provides user info
function optionalAuth(req, res, next) {
    if (req.session && req.session.userId) {
        User.findById(req.session.userId)
            .then(user => {
                if (user && user.isVerified) {
                    req.user = user;
                }
                next();
            })
            .catch(err => {
                console.error('Optional auth error:', err);
                next();
            });
    } else {
        next();
    }
}


// Session security middleware
function sessionSecurity(req, res, next) {
    // Regenerate session ID on successful login
    if (req.session && req.session.userId && !req.session.regenerated) {
        req.session.regenerate((err) => {
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

module.exports = {
    isUserLoggedIn,
    preventLoginIfLoggedIn,
    noCache,
    checkSessionTimeout,
    optionalAuth,
    sessionSecurity
};
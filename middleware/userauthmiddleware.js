const User = require('../models/user');

// Check if user is authenticated
function isUserLoggedIn(req, res, next) {
    if (req.session && req.session.userId) {
        // Verify user still exists in database
        User.findById(req.session.userId)
            .then(user => {
                if (user && user.isVerified) {
                    req.user = user; // Attach user to request
                    return next();
                } else {
                    // User doesn't exist or not verified, clear session
                    req.session.destroy();
                    return res.redirect('/login?error=session_expired');
                }
            })
            .catch(err => {
                console.error('Session validation error:', err);
                req.session.destroy();
                return res.redirect('/login?error=session_error');
            });
    } else {
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

// Rate limiting for login attempts
function loginRateLimit(req, res, next) {
    const maxAttempts = 5;
    const windowMs = 15 * 60 * 1000; // 15 minutes
    
    if (!req.session.loginAttempts) {
        req.session.loginAttempts = 0;
        req.session.firstAttemptTime = Date.now();
    }
    
    // Reset if window has passed
    if (Date.now() - req.session.firstAttemptTime > windowMs) {
        req.session.loginAttempts = 0;
        req.session.firstAttemptTime = Date.now();
    }
    
    if (req.session.loginAttempts >= maxAttempts) {
        return res.render('user/login', { 
            error: 'Too many login attempts. Please try again in 15 minutes.' 
        });
    }
    
    next();
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
    loginRateLimit,
    sessionSecurity
};
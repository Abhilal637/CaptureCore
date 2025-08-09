const User = require('../models/user');
function isUserLoggedIn(req, res, next) {
    if (req.session && req.session.userId) {
        User.findById(req.session.userId)
            .then(user => {
                if (user && user.isVerified) {
                    if (user.isBlocked) {

                        
                        if (req.sessionStore) {
                            req.sessionStore.all((err, sessions) => {
                                if (!err && sessions) {
                                    for (let sid in sessions) {
                                        const session = sessions[sid];
                                        if (session.userId && session.userId.toString() === user._id.toString()) {
                                            req.sessionStore.destroy(sid, (err) => {
                                                if (err) console.error('Failed to destroy session:', err);
                                            });
                                        }
                                    }
                                }
                            });
                        }

                       
                        return req.session.destroy(() => {
                            if (req.headers['content-type'] === 'application/json') {
                                return res.status(401).json({ message: 'User account is blocked' });
                            }
                            return res.redirect('/login?error=user_blocked');
                        });

                    } else {
                        req.user = user;
                        return next();
                    }
                } else {
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

function preventLoginIfLoggedIn(req, res, next) {
    if (req.session && req.session.userId) {
        return res.redirect('/');
    }
    next();
}

function checkSessionTimeout(req, res, next) {
    const sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    if (req.session && req.session.lastActivity) {
        const timeSinceLastActivity = Date.now() - req.session.lastActivity;
        if (timeSinceLastActivity > sessionTimeout) {
            req.session.destroy();
            return res.redirect('/login?error=session_timeout');
        }
    }
    if (req.session) {
        req.session.lastActivity = Date.now();
    }
    next();
}

function noCache(req, res, next) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
}

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

function sessionSecurity(req, res, next) {
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
module.exports = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        // Keep admin sessions alive on navigation
        req.session.cookie.maxAge = 1000 * 60 * 60 * 6; // 6 hours
    }
    next();
};
module.exports = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        req.session.cookie.maxAge = 1000 * 60 * 60 * 12; // 11 hours
    }
    next();
};
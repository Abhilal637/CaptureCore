const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { 
    isUserLoggedIn, 
    preventLoginIfLoggedIn, 
    noCache, 
    checkSessionTimeout, 
    optionalAuth, 
    loginRateLimit, 
    sessionSecurity 
} = require('../middleware/userauthmiddleware');
const passport = require('passport');

// Apply session timeout and no-cache to all routes
router.use(checkSessionTimeout);
router.use(noCache);

// Public routes (no authentication required)
router.get('/', optionalAuth, userController.getHome);

// Authentication routes (prevent logged-in users from accessing)
router.get('/signup', preventLoginIfLoggedIn, userController.getSignup);
router.post('/signup', preventLoginIfLoggedIn, userController.postSignup);

router.get('/login', preventLoginIfLoggedIn, userController.getLogin);
router.post('/login', preventLoginIfLoggedIn, loginRateLimit, userController.postlogin);

// OTP verification routes
router.get('/otp', preventLoginIfLoggedIn, userController.getotpVerify);
router.post('/otp', preventLoginIfLoggedIn, userController.postOtpVerify);
router.post('/otp/resend', preventLoginIfLoggedIn, userController.resendOtp);

// Password reset routes
router.get('/forgot-password', preventLoginIfLoggedIn, userController.getforgetPassword);
router.post('/forgot-password', preventLoginIfLoggedIn, userController.postForgetPassword);

router.get('/reset-password/:token', preventLoginIfLoggedIn, userController.getResetPassword);
router.post('/reset-password/:token', preventLoginIfLoggedIn, userController.postResetPassword);

// Protected routes (require authentication)
router.get('/profile', isUserLoggedIn, sessionSecurity, userController.getProfile);

// Google OAuth routes
router.get('/auth/google', preventLoginIfLoggedIn, passport.authenticate('google', { 
    scope: ['profile', 'email'] 
}));

router.get('/auth/google/callback', 
    preventLoginIfLoggedIn,
    passport.authenticate('google', { 
        failureRedirect: '/login',
        failureFlash: true 
    }),
    sessionSecurity,
    (req, res) => {
        try {
            // Successful authentication
            req.session.userId = req.user._id;
            req.session.lastActivity = Date.now();
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.redirect('/login?error=session_error');
                }
                console.log('Session saved successfully, redirecting to home');
                res.redirect('/');
            });
        } catch (error) {
            console.error('Google callback error:', error);
            res.redirect('/login?error=auth_error');
        }
    }
);


router.get('/shop', userController.getProducts);
router.get('/product/:id', userController.getProductDetails);
// Logout routes (require authentication)
router.get('/logout', isUserLoggedIn, userController.logout);
router.post('/logout', isUserLoggedIn, userController.logout);

module.exports = router; 
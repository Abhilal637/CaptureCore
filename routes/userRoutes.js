const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const passport = require('passport');
const validator = require('../middleware/validator');

const { 
    isUserLoggedIn, 
    preventLoginIfLoggedIn, 
    noCache, 
    checkSessionTimeout, 
    optionalAuth, 
    sessionSecurity 
} = require('../middleware/userauthmiddleware');
const { checkBlocked,adminAuth } = require('../middleware/adminauthmiddleware');

// Global middlewares
router.use(checkSessionTimeout);
router.use(noCache);

// Public routes
router.get('/', optionalAuth, userController.getHome);

// Auth routes
router.get('/signup', preventLoginIfLoggedIn, userController.getSignup);
router.post('/signup', validator('signup'), preventLoginIfLoggedIn, userController.postSignup);




router.get('/login', preventLoginIfLoggedIn, userController.getLogin);
router.post('/login', preventLoginIfLoggedIn, userController.postlogin);

// OTP
router.get('/otp', preventLoginIfLoggedIn, userController.getotpVerify);
router.post('/otp', validator('otp'), preventLoginIfLoggedIn, userController.postOtpVerify);
router.post('/otp/resend', preventLoginIfLoggedIn, userController.resendOtp);

// Forgot Password
router.get('/forgot-password', preventLoginIfLoggedIn, userController.getforgetPassword);
router.post('/forgot-password', validator('forgot-password'), preventLoginIfLoggedIn, userController.postForgetPassword);

router.get('/reset-password/:token', preventLoginIfLoggedIn, userController.getResetPassword);
router.post('/reset-password/:token', validator('reset-password'), preventLoginIfLoggedIn, userController.postResetPassword);

// Profile
router.get('/profile', isUserLoggedIn, sessionSecurity, checkBlocked, userController.getProfile);

// Google OAuth
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

// Public product browsing
router.get('/shop', userController.getProducts);
router.get('/product/:id', userController.getProductDetails);


// Logout
router.get('/logout', isUserLoggedIn, userController.logout);
router.post('/logout', isUserLoggedIn, userController.logout);

module.exports = router;

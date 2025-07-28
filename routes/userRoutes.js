const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isUserLoggedIn, preventLoginIfLoggedIn } = require('../middleware/userauthmiddleware');
const passport = require('passport');

router.get('/', userController.getHome);

router.get('/signup', userController.getSignup);
router.post('/signup', userController.postSignup);

router.get('/login', userController.getLogin);
router.post('/login', userController.postlogin);



router.get('/otp',userController.getotpVerify);
router.post('/otp', userController.postOtpVerify);
router.post('/otp/resend', userController.resendOtp);

router.get('/profile', isUserLoggedIn, userController.getProfile);

// Google OAuth routes
router.get('/auth/google', passport.authenticate('google', { 
  scope: ['profile', 'email'] 
}));

router.get('/auth/google/callback', 
    passport.authenticate('google', { 
      failureRedirect: '/login',
      failureFlash: true 
    }),
    (req, res) => {
        try {
            // Successful authentication
            req.session.userId = req.user._id;
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.redirect('/login?error=session_error');
                }
                res.redirect('/');
            });
        } catch (error) {
            console.error('Google callback error:', error);
            res.redirect('/login?error=auth_error');
        }
    }
);

// Logout routes
router.get('/logout', userController.logout);
router.post('/logout', userController.logout);

module.exports = router; 
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const passport = require('passport');
const validator = require('../middleware/validator');
const upload = require('../middleware/upload');

const { 
    isUserLoggedIn, 
    preventLoginIfLoggedIn, 
    noCache, 
    checkSessionTimeout, 
    optionalAuth, 
    sessionSecurity 
} = require('../middleware/userauthmiddleware');
const { checkBlocked } = require('../middleware/adminauthmiddleware');

// Global middlewares
router.use(checkSessionTimeout);
router.use(noCache);

// Home
router.route('/')
  .get(optionalAuth, userController.getHome);

// Auth: Signup
router.route('/signup')
  .get(preventLoginIfLoggedIn, userController.getSignup)
  .post(validator('signup'), preventLoginIfLoggedIn, userController.postSignup);

// Auth: Login
router.route('/login')
  .get(preventLoginIfLoggedIn, userController.getLogin)
  .post(preventLoginIfLoggedIn, userController.postlogin);

// OTP
router.route('/otp')
  .get(preventLoginIfLoggedIn, userController.getotpVerify)
  .post(validator('otp'), preventLoginIfLoggedIn, userController.postOtpVerify);

router.route('/otp/resend')
  .post(preventLoginIfLoggedIn, userController.resendOtp);

// Forgot Password
router.route('/forgot-password')
  .get(preventLoginIfLoggedIn, userController.getforgetPassword)
  .post(validator('forgot-password'), preventLoginIfLoggedIn, userController.postForgetPassword);

router.route('/reset-password/:token')
  .get(preventLoginIfLoggedIn, userController.getResetPassword)
  .post(validator('reset-password'), preventLoginIfLoggedIn, userController.postResetPassword);

// Profile
router.route('/profile')
  .get(isUserLoggedIn, sessionSecurity, checkBlocked, userController.getProfile);

router.route('/edit-profile')
  .get(isUserLoggedIn, sessionSecurity, checkBlocked, userController.getEditProfile)
  .post(isUserLoggedIn, sessionSecurity, checkBlocked, upload.single('profileImage'), userController.postEditProfile);

router.route('/edit-email')
  .get(isUserLoggedIn, sessionSecurity, checkBlocked, userController.getEditEmail);

// Email OTP
router.route('/email/send-otp')
  .post(isUserLoggedIn, checkBlocked, userController.sendOtpForEmail);

router.route('/verify-email')
  .get(isUserLoggedIn, checkBlocked, (req, res) => {
    res.render('user/verify-email', {
      currentPage: 'verify-email',
      newEmail: req.session.pendingEmail || 'your email'
    });
  })
  .post(isUserLoggedIn, checkBlocked, userController.postverifyEmail);

// Change Password
router.route('/change-password')
  .get(isUserLoggedIn, sessionSecurity, checkBlocked, userController.getChangePassword)
  .post(isUserLoggedIn, sessionSecurity, checkBlocked, userController.postChangePassword);



// Address routes
router.route('/addresses')
  .get(isUserLoggedIn, sessionSecurity, checkBlocked, userController.getAddresses)
  .post(isUserLoggedIn, sessionSecurity, checkBlocked, validator('address'), userController.postAddaddress);

router.route('/addresses/add')
  .get(isUserLoggedIn, sessionSecurity, checkBlocked, userController.getAddress);

router.route('/addresses/edit/:id')
  .get(isUserLoggedIn, sessionSecurity, checkBlocked, userController.getEditAddresses)
  .post(isUserLoggedIn, sessionSecurity, checkBlocked, validator('address'), userController.postEditAddress);

router.route('/addresses/delete/:id')
  .post(isUserLoggedIn, sessionSecurity, checkBlocked, userController.postDeleteAddress);

// Redirect /account/address to /addresses for compatibility
router.get('/account/address', isUserLoggedIn, sessionSecurity, checkBlocked, (req, res) => {
  res.redirect('/addresses');
});
router.post('/addresses/default/:id', isUserLoggedIn, userController.setDefaultAddress);
router.get('/cart', isUserLoggedIn, sessionSecurity, checkBlocked, userController.getCartPage);
router.post('/add-to-cart/:productId', isUserLoggedIn, userController.addToCart); 

router.get('/cart/count', userController.getCartCount);
router.post('/cart/remove/:productId', userController.removeFromCart);
router.post('/cart/update/:productId', userController.updateCartItemQuantity);
router.patch('/cart/update-quantity/:productId', userController.updateCartItemQuantity);
router.post('/cart/clear', isUserLoggedIn, userController.clearCart);




router.get('/wishlist', isUserLoggedIn, userController.getWishlist);
router.post('/wishlist/add/:productId', isUserLoggedIn, userController.addToWishlist);
router.delete('/wishlist/remove/:id', isUserLoggedIn, userController.removeFromWishlist);
router.post('/wishlist/toggle/:productId', isUserLoggedIn, userController.toggleWishlist);
router.delete('/wishlist/clear', isUserLoggedIn, userController.clearWishlist);





// Google OAuth
router.route('/auth/google')
  .get(preventLoginIfLoggedIn, passport.authenticate('google', { scope: ['profile', 'email'] }));

router.route('/auth/google/callback')
  .get(
    preventLoginIfLoggedIn,
    passport.authenticate('google', { failureRedirect: '/login', failureFlash: true }),
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

// Shop
router.route('/shop')
  .get(userController.getProducts);

router.route('/product/:id')
  .get(userController.getProductDetails);

// Logout
router.route('/logout')
  .get(isUserLoggedIn, userController.logout)
  .post(isUserLoggedIn, userController.logout);

module.exports = router;

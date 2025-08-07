const express = require('express');
const router = express.Router();
const passport = require('passport');

const userController = require('../controllers/userController');
const cartController = require('../controllers/cartcontroller');
const wishlistController = require('../controllers/wishlistcontroller');
const profileController = require('../controllers/profilecontroller');
const orderController = require('../controllers/orderController');

const validator = require('../middleware/validate');
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

// 🌐 Global Middlewares
router.use(checkSessionTimeout);
router.use(noCache);

router.get('/', optionalAuth, userController.getHome);
router.get('/shop', userController.getProducts);
router.get('/product/:id', userController.getProductDetails);

// Signup
router.route('/signup')
  .get(preventLoginIfLoggedIn, userController.getSignup)
  .post(validator('userSignupRules'), preventLoginIfLoggedIn, userController.postSignup);

// Login
router.route('/login')
  .get(preventLoginIfLoggedIn, userController.getLogin)
  .post(validator('userLoginRules'), preventLoginIfLoggedIn, userController.postlogin);

// OTP
router.route('/otp')
  .get(preventLoginIfLoggedIn, userController.getotpVerify)
  .post(preventLoginIfLoggedIn, userController.postOtpVerify);

router.post('/otp/resend', preventLoginIfLoggedIn, userController.resendOtp);

// Forgot Password
router.route('/forgot-password')
  .get(preventLoginIfLoggedIn, userController.getforgetPassword)
  .post(preventLoginIfLoggedIn, userController.postForgetPassword);

// Reset Password
router.route('/reset-password/:token')
  .get(preventLoginIfLoggedIn, userController.getResetPassword)
  .post(validator('resetPasswordRules'), preventLoginIfLoggedIn, userController.postResetPassword);

// Google Auth
router.get('/auth/google', preventLoginIfLoggedIn, passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/auth/google/callback',
  preventLoginIfLoggedIn,
  passport.authenticate('google', { failureRedirect: '/login', failureFlash: true }),
  sessionSecurity,
  (req, res) => {
    try {
      req.session.userId = req.user._id;
      req.session.lastActivity = Date.now();
      req.session.save(err => {
        if (err) return res.redirect('/login?error=session_error');
        res.redirect('/');
      });
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect('/login?error=auth_error');
    }
  }
);

// Profile
router.get('/profile', isUserLoggedIn, sessionSecurity, checkBlocked, profileController.getProfile);

router.route('/edit-profile')
  .get(isUserLoggedIn, sessionSecurity, checkBlocked, profileController.getEditProfile)
  .post(isUserLoggedIn, sessionSecurity,validator('editproductRules') ,checkBlocked, upload.single('profileImage'), profileController.postEditProfile);

router.get('/edit-email', isUserLoggedIn, sessionSecurity, checkBlocked, profileController.getEditEmail);
router.post('/email/send-otp', isUserLoggedIn, checkBlocked, profileController.sendOtpForEmail);

router.route('/verify-email')
  .get(isUserLoggedIn, checkBlocked, (req, res) => {
    res.render('user/verify-email', {
      currentPage: 'verify-email',
      newEmail: req.session.pendingEmail || 'your email'
    });
  })
  .post(isUserLoggedIn, checkBlocked, profileController.postverifyEmail);

// Change Password
router.route('/change-password')
  .get(isUserLoggedIn, sessionSecurity, checkBlocked, profileController.getChangePassword)
  .post(validator('changePasswordRules'), isUserLoggedIn, sessionSecurity, checkBlocked, profileController.postChangePassword);

// Address
router.get('/account/address', isUserLoggedIn, sessionSecurity, checkBlocked, (req, res) => res.redirect('/addresses'));

router.route('/addresses')
  .get(isUserLoggedIn, sessionSecurity, checkBlocked, profileController.getAddresses)
  .post(validator('addressRules'), isUserLoggedIn, sessionSecurity, checkBlocked, profileController.postAddaddress);

router.get('/addresses/add', isUserLoggedIn, sessionSecurity, checkBlocked, profileController.getAddress);

router.route('/addresses/edit/:id')
  .get(isUserLoggedIn, sessionSecurity, checkBlocked, profileController.getEditAddresses)
  .post(validator('addressRules'), isUserLoggedIn, sessionSecurity, checkBlocked, profileController.postEditAddress);

router.post('/addresses/delete/:id', isUserLoggedIn, sessionSecurity, checkBlocked, profileController.postDeleteAddress);
router.post('/addresses/default/:id', isUserLoggedIn, profileController.setDefaultAddress);

// Cart
router.get('/cart', isUserLoggedIn, sessionSecurity, checkBlocked, cartController.getCartPage);
router.post('/add-to-cart/:productId', isUserLoggedIn, cartController.addToCart);
router.get('/cart/count', cartController.getCartCount);
router.post('/cart/remove/:productId', cartController.removeFromCart);
router.post('/cart/update/:productId', cartController.updateCartItemQuantity);
router.patch('/cart/update-quantity/:productId', cartController.updateCartItemQuantity);
router.post('/cart/clear', isUserLoggedIn, cartController.clearCart);

// Wishlist
router.get('/wishlist', isUserLoggedIn, wishlistController.getWishlist);
router.post('/wishlist/add/:productId', isUserLoggedIn, wishlistController.addToWishlist);
router.delete('/wishlist/remove/:id', isUserLoggedIn, wishlistController.removeFromWishlist);
router.post('/wishlist/toggle/:productId', isUserLoggedIn, wishlistController.toggleWishlist);
router.delete('/wishlist/clear', isUserLoggedIn, wishlistController.clearWishlist);

// Orders
router.get('/checkout', isUserLoggedIn, userController.getCheckoutPage);
router.post('/place-order', isUserLoggedIn, orderController.placeOrder);
router.get('/orders', isUserLoggedIn, orderController.getOrders);
router.get('/orderSuccess', isUserLoggedIn, orderController.getOrderSuccess);
router.get('/order/:id', isUserLoggedIn, orderController.getOrderDetails);
router.get('/search-orders', isUserLoggedIn, orderController.searchOrders);

router.post('/order/:orderId/cancel', isUserLoggedIn, orderController.cancelOrder);
router.post('/order/cancel-item', isUserLoggedIn, orderController.cancelOrderItem);
router.post('/order/:orderId/cancel-product/:productId', isUserLoggedIn, orderController.cancelOrderItem);
router.get('/order/:orderId/invoice', isUserLoggedIn, orderController.downloadInvoice);
router.post('/order/return', isUserLoggedIn, orderController.returnEntireOrder);
router.post('/order/return-item', isUserLoggedIn, orderController.returnOrderItem);

// Logout
router.route('/logout')
  .get(isUserLoggedIn, userController.logout)
  .post(isUserLoggedIn, userController.logout);

module.exports = router;

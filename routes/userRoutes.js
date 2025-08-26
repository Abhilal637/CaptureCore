const express = require('express');
const passport = require('passport');
const router = express.Router();

const userController = require('../controllers/userController');
const cartController = require('../controllers/cartcontroller');
const wishlistController = require('../controllers/wishlistcontroller');
const profileController = require('../controllers/profilecontroller');
const orderController = require('../controllers/orderController');

const validator = require('../middleware/validate');
const validationRules = require('../middleware/validationRules');
const { diskUpload } = require('../middleware/upload');

const {
  isUserLoggedIn,
  preventLoginIfLoggedIn,
  noCache,
  checkSessionTimeout,
  optionalAuth,
  sessionSecurity
} = require('../middleware/userauthmiddleware');

const { checkBlocked } = require('../middleware/adminauthmiddleware');


router.use(checkSessionTimeout);
router.use(noCache);

router.get('/', optionalAuth, userController.getHome);
router.get('/shop', userController.getProducts);
router.get('/product/:id', userController.getProductDetails);

router.route('/signup')
  .get(preventLoginIfLoggedIn, userController.getSignup)
  .post(
    validator('userSignupRules'),
    preventLoginIfLoggedIn,
    userController.postSignup
  );

router.route('/login')
  .get(preventLoginIfLoggedIn, userController.getLogin)
  .post(
    validator('userLoginRules'),
    preventLoginIfLoggedIn,
    userController.postlogin
  );

router.route('/otp')
  .get(preventLoginIfLoggedIn, userController.getotpVerify)
  .post(
    preventLoginIfLoggedIn,
    validator('otpRules'),
    userController.postOtpVerify
  );

router.post('/otp/resend', preventLoginIfLoggedIn, userController.resendOtp);

router.route('/forgot-password')
  .get(preventLoginIfLoggedIn, userController.getforgetPassword)
  .post(preventLoginIfLoggedIn, userController.postForgetPassword);

router.route('/reset-password/:token')
  .get(preventLoginIfLoggedIn, userController.getResetPassword)
  .post(
    validator('resetPasswordRules'),
    preventLoginIfLoggedIn,
    userController.postResetPassword
  );


router.get('/auth/google',
  preventLoginIfLoggedIn,
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

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
      res.redirect('/login?error=auth_error');
    }
  }
);


const userAccess = [isUserLoggedIn, sessionSecurity, checkBlocked];

router.get('/profile', userAccess, profileController.getProfile);

router.route('/edit-profile')
  .get(userAccess, profileController.getEditProfile)
  .post(
    userAccess,
    diskUpload.single('profileImage'),
    profileController.postEditProfile
  );


	router.post('/send-email-otp', userAccess, profileController.sendEmailOTP);
	router.post('/verify-email-otp', userAccess, profileController.verifyEmailOTP);
	
	router.get('/edit-email', userAccess, profileController.getEditEmail);
	router.post('/email/send-otp', userAccess, profileController.sendOtpForEmail);
	
	router.route('/verify-email')
  .get(userAccess, (req, res) => {
    res.render('user/verify-email', {
      currentPage: 'verify-email',
      newEmail: req.session.pendingEmail || 'your email'
    });
  })
  .post(userAccess, profileController.postverifyEmail);

router.route('/change-password')
  .get(userAccess, profileController.getChangePassword)
  .post(
    validator('changePasswordRules'),
    userAccess,
    profileController.postChangePassword
  );


router.get('/account/address', userAccess, (req, res) => res.redirect('/addresses'));

router.route('/addresses')
  .get(userAccess, profileController.getAddresses)
  .post(
    validator('addressRules'),
    userAccess,
    profileController.postAddaddress
  );  

router.get('/addresses/add', userAccess, profileController.getAddress);
router.route('/addresses/edit/:id')
  .get(userAccess, profileController.getEditAddresses)
  .post(
    validator(validationRules.addressRules),
    userAccess,
    profileController.postEditAddress
  );

router.post('/addresses/delete/:id', userAccess, profileController.postDeleteAddress);
router.post('/addresses/default/:id', userAccess, profileController.setDefaultAddress);


router.get('/cart', userAccess, cartController.getCartPage);
router.post('/add-to-cart/:productId', isUserLoggedIn, cartController.addToCart);
router.get('/cart/count', cartController.getCartCount);
router.post('/cart/remove/:productId', cartController.removeFromCart);
router.post('/cart/update/:productId', cartController.updateCartItemQuantity);
router.patch('/cart/update-quantity/:productId', cartController.updateCartItemQuantity);
router.post('/cart/clear', isUserLoggedIn, cartController.clearCart);


router.get('/wishlist', isUserLoggedIn, wishlistController.getWishlist);
router.post('/wishlist/add/:productId', isUserLoggedIn, wishlistController.addToWishlist);
router.delete('/wishlist/remove/:productId', isUserLoggedIn, wishlistController.removeFromWishlist);
router.post('/wishlist/toggle/:productId', isUserLoggedIn, wishlistController.toggleWishlist);
router.delete('/wishlist/clear', isUserLoggedIn, wishlistController.clearWishlist);


router.get('/checkout', isUserLoggedIn, userController.getCheckoutPage);
router.post('/place-order', isUserLoggedIn, orderController.placeOrder);


router.post('/razorpay/create-order',isUserLoggedIn,orderController.createRazorpayOrder)
router.post("/razorpay/verify", isUserLoggedIn, orderController.verifyRazorPayment);

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


router.get('/wallet', isUserLoggedIn, profileController.getWallet);


router.route('/logout')
  .get(isUserLoggedIn, userController.logout)
  .post(isUserLoggedIn, userController.logout);

module.exports = router;

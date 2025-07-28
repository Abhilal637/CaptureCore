const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isUserLoggedIn, preventLoginIfLoggedIn } = require('../middleware/userauthmiddleware');

router.get('/',  userController.getHome); 

router.get('/signup', userController.getSignup);
router.post('/signup', userController.postSignup);


router.get('/login', userController.getLogin);
router.post('/login', userController.postlogin);



router.get('/otp',userController.getotpVerify);
router.post('/otp', userController.postOtpVerify);
router.post('/otp/resend', userController.resendOtp);

router.get('/profile', isUserLoggedIn, userController.getProfile);



// Add POST logout route for navbar form
router.post('/logout', userController.logout);

module.exports = router; 
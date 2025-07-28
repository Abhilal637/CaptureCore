const User= require('../models/user');
const bcrypt = require('bcrypt')
const otpService = require('../utils/otpHelper');
const nodemailer = require('nodemailer');
require('dotenv').config();
const crypto= require('crypto')


// Configure your transporter (use your real credentials)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS 
    }
});

// Regex patterns
const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/; // min 8 chars, at least 1 letter & 1 number
const phoneRegex = /^\d{10,15}$/;
const nameRegex = /^[A-Za-z\s]{2,50}$/;

exports.getSignup=(req,res)=>{
    res.render('user/signup', { error: null });
}

exports.postSignup = async (req, res) => {
    const name = req.body.name || req.body.username;
    const { email, password, phone, confirm_password } = req.body;

    // Regex validation
    if (!name || !nameRegex.test(name)) {
        return res.render('user/signup', { error: 'Please enter a valid name (letters and spaces only).' });
    }
    if (!email || !emailRegex.test(email)) {
        return res.render('user/signup', { error: 'Please enter a valid email address.' });
    }
    if (!phone || !phoneRegex.test(phone)) {
        return res.render('user/signup', { error: 'Please enter a valid phone number (10-15 digits).' });
    }
    if (!password || !passwordRegex.test(password)) {
        return res.render('user/signup', { error: 'Password must be at least 8 characters, include a letter and a number.' });
    }
    if (password !== confirm_password) {
        return res.render('user/signup', { error: 'Passwords do not match.' });
    }
    try {
        const userExist = await User.findOne({ email });
        if (userExist) {
            return res.render('user/signup', { error: 'Email already exists.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = otpService.generateOtp();
        const otpExpiry = Date.now() + 2 * 60 * 1000;
        const newUser = new User({ name, email, password: hashedPassword, otp, otpExpiry, mobile: phone });
        await newUser.save();
        // Send OTP via email
        try {
            await transporter.sendMail({
                from: 'capturecore792@gmail.com',
                to: email,
                subject: 'Your OTP Code',
                text: `Your OTP is ${otp}`
            });
            console.log('Email sent successfully');
        } catch (emailErr) {
            console.error('Email sending failed:', emailErr);
            return res.render('user/signup', { error: 'Email sending failed: ' + emailErr.message });
        }
        res.redirect(`/otp?email=${email}`);
    } catch (err) {
        let errorMsg = 'Signup failed';
        if (err.name === 'ValidationError') {
            errorMsg = Object.values(err.errors).map(e => e.message).join(', ');
        }
        res.render('user/signup', { error: errorMsg });
    }
}

exports.getotpVerify= (req,res)=>{
    res.render('user/otp', { email: req.query.email, error: null, message: null });
}
exports.postOtpVerify = async (req, res) => {
    const otp = (req.body.otp1 || '') +
    (req.body.otp2 || '') +
    (req.body.otp3 || '') +
    (req.body.otp4 || '') +
    (req.body.otp5 || '') +
    (req.body.otp6 || '');
    try {
      const { email } = req.body;
      const user = await User.findOne({ email });
  
      console.log('Email:', email);
      console.log('OTP entered:', otp);
      if (user) {
        console.log('OTP in DB:', user.otp);
        console.log('OTP Expiry:', user.otpExpiry, 'Current time:', Date.now());
      }
  
      if (!user || user.otp !== otp || user.otpExpiry < Date.now()) {
        return res.render('user/otp', { email, error: 'Invalid or expired OTP', message: null });
      }
  
      user.isVerified = true;
      user.otp = null;
      user.otpExpiry = null;
      await user.save();
  
      res.redirect('/login');
    } catch (err) {
      console.error('OTP verification error:', err);
      return res.render('user/otp', { email, error: 'Verification failed', message: null });
    }
  };
  
  exports.resendOtp = async(req,res)=>{
      const {email} = req.body
      try {
        
          const user = await User.findOne({email})
          if(!user){
              return res.render('user/otp', { email, error: 'User not found' });
          }
          const otp = otpService.generateOtp()
          user.otp = otp;
          // BUG FIX: Added missing assignment to user.otpExpiry
          user.otpExpiry = Date.now()+2*60*1000
          await user.save()
  
          try{
              await transporter.sendMail({
                  from: 'capturecore792@gmail.com',
                  to:email,
                  subject:'Your OTP Code',
                  // BUG FIX: Fixed template literal syntax
                  text:`Your OTP is ${otp}`
          })
          }catch(emailErr){
              return res.render('user/otp',{email,error:'Email sending failed: ' + emailErr.message})
          }
          res.render('user/otp', { email, success: 'OTP resent successfully' });
      } catch (err) {
          console.error('Resend OTP error:', err);
          return res.render('user/otp', { email, error: 'Failed to resend OTP' });
      }
  } 
  
exports.getLogin=(req,res)=>{
    res.render('user/login', { error: null });
}

exports.postlogin = async (req, res) => {
    const { email, password } = req.body;
    // Regex validation
    if (!email || !emailRegex.test(email)) {
        return res.render('user/login', { error: 'Please enter a valid email address.' });
    }
    if (!password || !passwordRegex.test(password)) {
        return res.render('user/login', { error: 'Password must be at least 8 characters, include a letter and a number.' });
    }
    try {
        const user = await User.findOne({ email });
        if (!user) {
            // Increment login attempts
            req.session.loginAttempts = (req.session.loginAttempts || 0) + 1;
            return res.render('user/login', { error: 'Invalid email or password' });
        }
        if (!user.isVerified) {
            req.session.loginAttempts = (req.session.loginAttempts || 0) + 1;
            return res.render('user/login', { error: 'Please verify your email first' });
        }
        
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            // Increment login attempts
            req.session.loginAttempts = (req.session.loginAttempts || 0) + 1;
            return res.render('user/login', { error: 'Invalid email or password' });
        }
        
        // Successful login - reset attempts and set session
        req.session.loginAttempts = 0;
        req.session.userId = user.id;
        req.session.lastActivity = Date.now();
        req.session.regenerated = false; // Allow session regeneration
        
        console.log('Login successful, redirecting to home...');
        res.redirect('/');
    } catch (err) {
        console.error('Login error:', err);
        req.session.loginAttempts = (req.session.loginAttempts || 0) + 1;
        return res.render('user/login', { error: 'Login failed. Please try again.' });
    }
};

exports.getHome = (req, res) => {
   res.render('user/index');
 };

exports.getProfile = async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.redirect('/login');
        }
        const user = await User.findById(userId);
        if (!user) {
            return res.redirect('/login');
        }
        res.render('user/profile', { user });
    } catch (err) {
        console.error('Profile error:', err);
        res.render('user/profile', { error: 'Failed to load profile', user: null });
    }
};


exports.getforgetPassword = (req, res) => {
    res.render('user/forgot-password', {message: null})
}
exports.postForgetPassword = async (req, res) => {
    const {email} = req.body
    const user = await User.findOne({email})
    if(!user){
        return res.render('user/forgot-password', {message: "Email not found"})
    }
    const token = crypto.randomBytes(32).toString('hex')
    user.resetToken = token
    user.resetTokenExpiry = Date.now() + 3600000

    await user.save()

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASS
        }
    })

    const resetURL = `http://localhost:3000/reset-password/${token}`;

    await transporter.sendMail({
        to: user.email,
        subject: 'Password Reset',
        html: `<p>You requested a password reset</p>
        <p><a href="${resetURL}">Click here to reset your password</a></p>`
    })

    res.render('user/forgot-password', {message: 'Reset link sent to your email'})
}

exports.getResetPassword = async (req, res) => {
    const token = req.params.token
    const user = await User.findOne({
        resetToken: token,
        resetTokenExpiry: {$gt: Date.now()}
    })

    if(!user){
        return res.send('Token is invalid or expired')
    }
    res.render('user/reset-password', {userId: user._id, token})
}


exports.postResetPassword = async (req, res) => {
    const {password} = req.body
    const token = req.params.token;
    
    // Password validation
    if (!password || !passwordRegex.test(password)) {
        return res.render('user/reset-password', { 
            userId: req.body.userId, 
            token, 
            error: 'Password must be at least 8 characters, include a letter and a number.' 
        });
    }
    
    const user = await User.findOne({
        resetToken: token,
        resetTokenExpiry: {$gt: Date.now()}
    })
    if(!user){
        return res.send('Token is invalid or expired')
    }

    const hashed = await bcrypt.hash(password, 10);
    user.password = hashed;
    user.resetToken = undefined
    user.resetTokenExpiry = undefined
    await user.save()

    res.redirect('/login')
}



exports.logout = (req, res) => {
    // Clear all session data
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        // Clear the session cookie
        res.clearCookie('connect.sid');
        // Redirect to login with success message
        res.redirect('/login?message=logged_out');
    });
}
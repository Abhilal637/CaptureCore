const User= require('../models/user');
const bcrypt = require('bcrypt')
const otpService = require('../utils/otpHelper');
const nodemailer = require('nodemailer');
require('dotenv').config();


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
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=]{8,}$/; // min 8 chars, at least 1 letter & 1 number
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
            return res.render('user/login', { error: 'Invalid email or password' });
        }
        if (!user.isVerified) {
            return res.render('user/login', { error: 'Please verify your email first' });
        }
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.render('user/login', { error: 'Invalid email or password' });
        }
        req.session.userId = user.id;
        console.log('Login successful, redirecting to home...');
        res.redirect('/');
    } catch (err) {
        console.error('Login error:', err);
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

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
}
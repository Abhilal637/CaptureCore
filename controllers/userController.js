const User= require('../models/user');
const Product = require('../models/product');
const bcrypt = require('bcrypt')
const otpService = require('../utils/otpHelper');
const nodemailer = require('nodemailer');
require('dotenv').config();
const crypto= require('crypto');
const mongoose = require('mongoose');
const Category = require('../models/category');
const validator = require('../middleware/validator');
const { isAscii } = require('buffer');


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
  const { name = req.body.username, email, password, phone, confirm_password } = req.body;

  try {
    // ✅ Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('user/signup', {
        error: 'Email already exists.',
        name, email, phone
      });
    }

    // ✅ Hash password and create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = otpService.generateOtp();
    const otpExpiry = Date.now() + 2 * 60 * 1000;

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      mobile: phone,
      otp,
      otpExpiry,
    });

    await newUser.save();

    // ✅ Send OTP email
    try {
      await transporter.sendMail({
        from: 'capturecore792@gmail.com',
        to: email,
        subject: 'Your OTP Code',
        text: `Your OTP is ${otp}`,
      });
    } catch (emailErr) {
      console.error('Email send failed:', emailErr);
      return res.render('user/signup', {
        error: 'Signup succeeded, but failed to send OTP email. Try resending later.',
        name, email, phone
      });
    }

    return res.redirect(`/otp?email=${encodeURIComponent(email)}`);

  } catch (err) {
    console.error('Signup error:', err);
    return res.render('user/signup', {
      error: 'Signup failed. Please try again.',
      name, email, phone
    });
  }
};


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
  
 exports.resendOtp = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.render('user/otp', {
        email,
        error: 'User not found',
        success: null,
        message: null
      });
    }

    const otp = otpService.generateOtp();
    user.otp = otp;
    user.otpExpiry = Date.now() + 2 * 60 * 1000;
    await user.save();

    try {
      await transporter.sendMail({
        from: 'capturecore792@gmail.com',
        to: email,
        subject: 'Your OTP Code',
        text: `Your OTP is ${otp}`,
      });
    } catch (emailErr) {
      return res.render('user/otp', {
        email,
        error: 'Email sending failed: ' + emailErr.message,
        success: null,
        message: null
      });
    }

    return res.render('user/otp', {
      email,
      success: 'OTP resent successfully',
      error: null,
      message: null
    });
  } catch (err) {
    console.error('Resend OTP error:', err);
    return res.render('user/otp', {
      email,
      error: 'Failed to resend OTP',
      success: null,
      message: null
    });
  }
};

exports.getLogin = (req, res) => {
  const error = req.session.loginError;
  req.session.loginError = null; // Clear it after reading
  res.render('user/login', { error });
};

    exports.postlogin = async (req, res) => {
        const { email, password } = req.body;

        console.log('Login attempt:', { email, password });

        // ✅ Regex Validation
        if (!email || !emailRegex.test(email)) {
            return res.render('user/login', { error: 'Please enter a valid email address.' });
        }

        if (!password || !passwordRegex.test(password)) {
            return res.render('user/login', {
                error: 'Password must be at least 8 characters, include a letter and a number.',
            });
        }

        try {
            const user = await User.findOne({ email });

            if (!user) {
                req.session.loginAttempts = (req.session.loginAttempts || 0) + 1;
                return res.render('user/login', { error: 'Invalid email or password' });
            }

            // ✅ Blocked User Check
            if (user.isBlocked) {
                return res.render('user/login', { error: 'Your account has been blocked by the admin.' });
            }

            if (!user.isVerified) {
                req.session.loginAttempts = (req.session.loginAttempts || 0) + 1;
                return res.render('user/login', { error: 'Please verify your email first' });
            }

            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                req.session.loginAttempts = (req.session.loginAttempts || 0) + 1;
                return res.render('user/login', { error: 'Invalid email or password' });
            }

            // ✅ Success - set session
            req.session.loginAttempts = 0;
            req.session.userId = user.id;
            req.session.lastActivity = Date.now();
            req.session.regenerated = false;

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


exports.getProducts = async (req, res) => {
  try {
    const { search = '', sort = '', category = '', priceRange = '', page = 1 } = req.query;
    const limit = 8;
    const skip = (page - 1) * limit;

    let query = {
      isBlocked: false,
      isListed: true,
      isDeleted: false,
      isActive: true
    };

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (priceRange && priceRange.includes('_')) {
      const [min, max] = priceRange.split('_').map(Number);
      if (!isNaN(min) && !isNaN(max)) {
        query.price = { $gte: min, $lte: max };
      }
    }

    // Apply category filter only if it's active
    if (category && mongoose.Types.ObjectId.isValid(category)) {
      const cat = await Category.findOne({ _id: category, isDeleted: false, active: true });
      if (cat) {
        query.category = category;
      } else {
        // If category is inactive or invalid, show no products
        const categories = await Category.find({ isDeleted: false, active: true });
        return res.render('user/shop', {
          products: [],
          total: 0,
          currentPage: parseInt(page),
          limit,
          query: req.query,
          categories
        });
      }
    }

    const sortOptionsMap = {
      'price-asc': { price: 1 },
      'price-desc': { price: -1 },
      'az': { name: 1 },
      'za': { name: -1 },
      'popularity': { salesCount: -1 },
      'rating': { avgRating: -1 },
      'new': { createdAt: -1 },
      'featured': { isFeatured: -1 }
    };
    const sortOption = sortOptionsMap[sort] || {};

    const total = await Product.countDocuments(query);

    const products = await Product.find(query)
      .populate({
        path: 'category',
        match: { active: true, isDeleted: false } // ✅ only populate active categories
      })
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    const filteredProducts = products.filter(p => p.category); // Keep only products with active categories

    const categories = await Category.find({ isDeleted: false, active: true });

    return res.render('user/shop', {
      products: filteredProducts,
      total: filteredProducts.length,
      currentPage: parseInt(page),
      limit,
      query: req.query,
      categories
    });

  } catch (err) {
    console.error('Error fetching products:', err);
    res.render('user/shop', {
      products: [],
      total: 0,
      currentPage: 1,
      limit: 8,
      query: req.query,
      error: 'Failed to load products',
      categories: []
    });
  }
};


exports.getProductDetails = async (req, res) => {
    try {
        
        const product = await Product.findById(req.params.id).populate('category');

        if (!product ||
          product.isBlocked ||
          !product.isListed ||
          product.isDeleted ||
          !product.isActive ||
          !product.category ||
          !product.category.active ||
          product.category.isDeleted
        ) {
            return res.redirect('/shop');
        }

        
        const related = await Product.find({
            _id: { $ne: product._id },
            category: product.category._id, 
            isBlocked: false,
            isListed: true,
            isDeleted: false
        }).populate('category') 
          .limit(4);

        res.render('user/product', { product, related });
    } catch (err) {
        console.error('Error fetching product details:', err);
        res.redirect('/products');
    }
};



exports.toggleUserBlockStatus = async (req, res) => {
  try {
    const userId = req.params.id;
    const { isBlocked } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { isBlocked },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({ message: 'User status updated.', user });
  } catch (error) {
    console.error('Toggle user block error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.clearCookie('connect.sid');
        // Redirect to login with success message
        res.redirect('/login?message=logged_out');
    });
}

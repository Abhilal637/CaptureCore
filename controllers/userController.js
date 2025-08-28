const User= require('../models/user');
const Product = require('../models/product');
const bcrypt = require('bcrypt')
const otpService = require('../utils/otpHelper');
const nodemailer = require('nodemailer');
require('dotenv').config();
const crypto= require('crypto');
const mongoose = require('mongoose');
const Category = require('../models/category');
const validator = require('../middleware/validate');
const { isAscii } = require('buffer');
const { error } = require('console');
const Cart = require('../models/cart');
const Address = require('../models/address');
const wishlist = require('../models/wishlist');
const { STATUS_CODES, MESSAGES } = require('../utils/constants');
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS 
    }
});

const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/; 
const phoneRegex = /^\d{10,15}$/;
const nameRegex = /^[A-Za-z\s]{2,50}$/;

exports.getSignup=(req,res)=>{
    res.render('user/signup', { error: null });
}
exports.postSignup = async (req, res) => {
  const { name = req.body.username, email, password, phone, confirm_password } = req.body || {};


  if (req.validationErrors && Object.keys(req.validationErrors).length > 0) {
    return res.render('user/signup', {
      errors: req.validationErrors,
      body: req.body,
      error: null
    });
  }

  try {
   
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('user/signup', {
        error: 'Email already exists.',
        errors: null,
        body: req.body
      });
    }

    if (!name || !email || !password || !confirm_password || !phone) {
      return res.render('user/signup', {
        error: 'All fields are required.',
        errors: null,
        body: req.body
      });
    }

    if (!passwordRegex.test(password)) {
      return res.render('user/signup', {
        error: 'Password must be at least 8 characters, include a letter and a number.',
        errors: null,
        body: req.body
      });
    }
    if (confirm_password !== password) {
      return res.render('user/signup', {
        error: 'Passwords do not match.',
        errors: null,
        body: req.body
      });
    }

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

   
    req.session.signupEmail = email;

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
    const email = req.query.email || req.body?.email || req.session.signupEmail || '';
    res.render('user/otp', { email, error: null, message: null });
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
  const email = (req.body && req.body.email) || req.query?.email || req.session.signupEmail || '';

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.render('user/otp', { email, error: 'No account found for this email.', success: null, message: null });
    }

    if (user.isVerified) {
      return res.render('user/otp', { email, error: null, message: 'Email is already verified. Please login.' });
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
  req.session.loginError = null;
  res.render('user/login', { error });
};

exports.postlogin = async (req, res) => {
    const { email, password } = req.body;

    if (req.validationErrors && Object.keys(req.validationErrors).length > 0) {
        return res.render('user/login', {
            errors: req.validationErrors,
            body: req.body,
            error: 'Please fix the highlighted errors.'
        });
    }

    console.log('Login attempt:', { email, password });

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

        
        if (user.isBlocked) {
            return res.render('user/login', {
                error: 'Your account has been blocked by the admin. Please contact support.',
                body: req.body
            });
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
exports.postlogin = async (req, res) => {
    const { email, password } = req.body;

    
    if (req.validationErrors) {
        return res.render('user/login', {
            errors: req.validationErrors,
            body: req.body,
            error: null
        });
    }

    console.log('Login attempt:', { email, password });

    
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

       
        if (user.isBlocked) {
            return res.render('user/login', {
                error: 'Your account has been blocked by the admin. Please contact support.',
                body: req.body
            });
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

exports.getHome = async (req, res) => {
  try {

    const featuredProducts = await Product.find({
      isBlocked: false,
      isListed: true,
      isDeleted: false,
      isActive: true
    })
    .limit(4)
    .populate('category')
    .sort({ createdAt: -1 });

    res.render('user/index', { featuredProducts });
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.render('user/index', { featuredProducts: [] });
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
    if (req.validationErrors && Object.keys(req.validationErrors).length > 0) {
        const token = req.params.token;
        return res.status(400).render('user/reset-password', {
            token,
            errors: req.validationErrors,
            error: null
        });
    }

    const {password, confirm_password} = req.body
    const token = req.params.token;
   
    if (!password || !passwordRegex.test(password)) {
        return res.render('user/reset-password', { 
            token, 
            error: 'Password must be at least 8 characters, include a letter and a number.' 
        });
    }
    if (confirm_password !== password) {
        return res.render('user/reset-password', { 
            token, 
            error: 'Passwords do not match.' 
        });
    }
    
    const user = await User.findOne({
        resetToken: token,
        resetTokenExpiry: {$gt: Date.now()}
    })
    if(!user){
        return res.render('user/reset-password', {
            token,
            error: 'Token is invalid or expired'
        })
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
    const { search = '', sort = '', category = '', priceRange = '', brand = '', megapixel = '', battery = '', 'camera-type': cameraTypeParam = '', 'lens-mount': lensMountParam = '', availability = '', page = 1 } = req.query;
    const limit = 9;
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
      const [minRaw, maxRaw] = priceRange.split('_');
      const min = Number(minRaw);
      const max = Number(maxRaw);
      if (!isNaN(min) && !isNaN(max)) {
        query.price = { $gte: min, $lte: max };
      } else if (!isNaN(min) && (isNaN(max) || maxRaw === '')) {
       
        query.price = { $gte: min };
      } else if ((isNaN(min) || minRaw === '') && !isNaN(max)) {
        
        query.price = { $lte: max };
      }
    }
    if (!priceRange) {
    
    }

    if (brand) {
   
      const brands = brand.split(',').filter(Boolean);
      if (brands.length === 1) {
        query.brand = { $regex: `^${brands[0]}$`, $options: 'i' };
      } else if (brands.length > 1) {
        query.brand = { $in: brands.map(b => new RegExp(`^${b}$`, 'i')) };
      }
    }

    
    if (megapixel) {
      const buckets = megapixel.split(',').filter(Boolean);
      if (buckets.length) {
        query.megapixelBucket = { $in: buckets.map(v => new RegExp(`^${v}$`, 'i')) };
      }
    }

 
    if (battery) {
      const vals = battery.split(',').filter(Boolean);
      if (vals.length) {
        query.batteryType = { $in: vals.map(v => new RegExp(`^${v}$`, 'i')) };
      }
    }

   
    if (cameraTypeParam) {
      const vals = cameraTypeParam.split(',').filter(Boolean);
      if (vals.length) {
        query.cameraType = { $in: vals.map(v => new RegExp(`^${v}$`, 'i')) };
      }
    }

  
    if (lensMountParam) {
      const vals = lensMountParam.split(',').filter(Boolean);
      if (vals.length) {
        query.lensMount = { $in: vals.map(v => new RegExp(`^${v}$`, 'i')) };
      }
    }

    
    if (req.query['focal-length']) {
      const vals = req.query['focal-length'].split(',').filter(Boolean);
      if (vals.length) {
        query.focalLength = { $in: vals.map(v => new RegExp(`^${v}$`, 'i')) };
      }
    }

    
    if (req.query['f-aperture']) {
      const vals = req.query['f-aperture'].split(',').filter(Boolean);
      if (vals.length) {
        query.fAperture = { $in: vals.map(v => new RegExp(`^${v}$`, 'i')) };
      }
    }

    
    if (req.query['lens-type']) {
      const vals = req.query['lens-type'].split(',').filter(Boolean);
      if (vals.length) {
        query.lensType = { $in: vals.map(v => new RegExp(`^${v}$`, 'i')) };
      }
    }

    
    if (availability) {
      const vals = availability.split(',').filter(Boolean);
      if (vals.length) {
        query.availability = { $in: vals.map(v => new RegExp(`^${v}$`, 'i')) };
      }
    }

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      const cat = await Category.findOne({ _id: category, isDeleted: false, active: true });
      if (cat) {
        query.category = category;
      } else {
        const categories = await Category.find({ isDeleted: false, active: true }).populate('parentCategory', 'name');
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

    
    const allMatchingProducts = await Product.find(query).populate({
      path: 'category',
      match: { active: true, isDeleted: false }
    });
    const filteredCount = allMatchingProducts.filter(p => p.category).length;

    const products = await Product.find(query)
      .populate({
        path: 'category',
        match: { active: true, isDeleted: false }
      })
      .sort(sortOption)
      .skip(skip)
      .limit(limit);
    const filteredProducts = products.filter(p => p.category);

    const categories = await Category.find({ isDeleted: false, active: true }).populate('parentCategory', 'name');

    
    const brandAgg = await Product.aggregate([
      { $match: query },
      { $group: { _id: { $toUpper: "$brand" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    const brandsList = brandAgg
      .filter(b => b._id)
      .map(b => ({ name: b._id, count: b.count }));

    return res.render('user/shop', {
      products: filteredProducts,
      total: filteredCount,
      currentPage: parseInt(page),
      limit,
      query: req.query,
      categories,
      brandsList
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
      categories: [],
      brandsList: []
    });
  }
};


exports.getProductDetails = async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Product.findById(productId).populate('category');

    if (
      !product ||
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
    })
      .populate('category')
      .limit(4);

    const userId = req.session.userId;
    let isInWishlist = false;
    let returnInfo = null;

    if (userId) {
      const user = await User.findById(userId);
      if (user && user.wishlist.includes(productId)) {
        isInWishlist = true;
      }

      
      const Order = require('../models/order');
      const returnOrder = await Order.findOne({
        user: userId,
        'items.product': productId,
        $or: [
          { 'items.status': 'Returned' },
          { 'items.status': 'Return Requested' },
          { 'items.isReturned': true }
        ]
      }).populate('items.product');

      if (returnOrder) {
        const returnItem = returnOrder.items.find(item => 
          item.product._id.toString() === productId
        );
        
        if (returnItem) {
          returnInfo = {
            orderId: returnOrder.orderId,
            returnDate: returnItem.returnDate || returnOrder.createdAt,
            returnReason: returnItem.returnReason,
            returnStatus: returnItem.status,
            isReturned: returnItem.isReturned,
            returnRequested: returnItem.returnRequested,
            returnApproved: returnItem.returnApproved
          };
        }
      }
    }

    res.render('user/product', {
      product,
      related,
      isInWishlist,
      returnInfo
    });
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
      return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'User not found.' });
    }

    res.status(STATUS_CODES.OK).json({ message: 'User status updated.', user }); 
  } catch (error) {
    console.error('Toggle user block error:', error);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ message: 'Server error.' });     
  }
};


exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.clearCookie('connect.sid');
        
        res.redirect('/login?message=logged_out');
    });
}




  exports.getCheckoutPage = async (req, res) => {
    try {
      const userId = req.session.userId;
      const { productId, quantity = 1 } = req.query;

      const addresses = await Address.find({ user: userId });
      const defaultAddress = addresses.find(addr => addr.isDefault) || null;

      let validItems = [];
      let subtotal = 0;

     
      if (productId) {
        
        const buyNowQuantity = Math.min(5, parseInt(quantity) || 1);
        const product = await Product.findById(productId).populate('category');
        
        if (!product || product.isBlocked || !product.isListed || product.isDeleted || !product.isActive || product.stock < buyNowQuantity) {
          return res.redirect('/shop?error=product_unavailable');
        }
        
       
        if (parseInt(quantity) > 5) {
          return res.redirect('/shop?error=buy_now_limit_exceeded');
        }

        const itemTotal = buyNowQuantity * product.price;
        subtotal = itemTotal;

        validItems.push({
          _id: product._id,
          name: product.name,
          image: product.images?.[0],
          price: product.price,
          quantity: buyNowQuantity,
          itemTotal
        });
      } else {
        
        const cart = await Cart.findOne({ user: userId }).populate({
          path: 'items.product',
          populate: { path: 'category' }
        });

        if (!cart || cart.items.length === 0) {
          return res.redirect('/cart');
        }

        for (const item of cart.items) {
          const p = item.product;
          if (
            !p || p.isBlocked || !p.isListed || p.isDeleted || !p.isActive || p.stock < 1 ||
            (p.category && p.category.isBlocked)
          ) continue;

          if (p.stock < item.quantity) {
            req.session.checkoutError = `"${p.name}" has only ${p.stock} in stock. Please adjust quantity.`;
            return res.redirect('/cart');
          }

          const itemTotal = item.quantity * p.price;
          subtotal += itemTotal;

          validItems.push({
            _id: p._id,
            name: p.name,
            image: p.images?.[0],
            price: p.price,
            quantity: item.quantity,
            itemTotal
          });
        }
      }

      if (validItems.length === 0) {
        return res.redirect('/cart?error=no_valid_items');
      }

      const tax = subtotal * 0.05;
      const discount = subtotal > 1000 ? subtotal * 0.1 : 0;
      const shipping = subtotal > 500 ? 0 : 50;
      const finalTotal = subtotal + tax - discount + shipping;

      res.render('user/checkout', {
        user: res.locals.user,
        addresses,
        defaultAddress: defaultAddress?._id.toString(),
        items: validItems,
        subtotal,
        tax,
        discount,
        shipping,
        finalTotal,
        isBuyNow: !!productId,
        buyNowProduct: productId ? validItems[0] : null,
        retry: req.query.retry === 'true'
      });
    } catch (error) {
      console.error('Error loading checkout page:', error);
      res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send('Server Error'); 
    }
  };

  
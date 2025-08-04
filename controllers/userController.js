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
const { error } = require('console');
const Cart = require('../models/cart');
const Wishlist= require('../models/wishlist')


const Address = require('../models/address');
const wishlist = require('../models/wishlist');



const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS 
    }
});

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
   
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('user/signup', {
        error: 'Email already exists.',
        name, email, phone
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
  req.session.loginError = null;
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
    // Fetch 4 featured products
    const featuredProducts = await Product.find({
      isBlocked: false,
      isListed: true,
      isDeleted: false,
      isActive: true
    })
    .limit(4)
    .populate('category')
    .sort({ createdAt: -1 }); // Show newest products first

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
    const {password} = req.body
    const token = req.params.token;
   
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

    // Related products
    const related = await Product.find({
      _id: { $ne: product._id },
      category: product.category._id,
      isBlocked: false,
      isListed: true,
      isDeleted: false
    })
      .populate('category')
      .limit(4);

    // Wishlist check
    const userId = req.session.userId;
    let isInWishlist = false;

    if (userId) {
      const user = await User.findById(userId);
      if (user && user.wishlist.includes(productId)) {
        isInWishlist = true;
      }
    }

    res.render('user/product', {
      product,
      related,
      isInWishlist
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
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({ message: 'User status updated.', user });
  } catch (error) {
    console.error('Toggle user block error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
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
      res.render('user/profile', { 
        user, 
        currentPage: 'profile',
        success: req.query.success,
        error: req.query.error
      });
  } catch (err) {
      console.error('Profile error:', err);
      res.render('user/profile', { 
        error: 'Failed to load profile', 
        user: null, 
        currentPage: 'profile',
        success: req.query.success,
        error: req.query.error
      });
  }
};


exports.getEditProfile = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.redirect('/login');
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.redirect('/login');
    }
    res.render('user/edit-profile', { 
      user, 
      currentPage: 'edit-profile',
      error: req.query.error
    });
  } catch (err) {
    console.error('Edit profile error:', err);
    res.redirect('/profile');
  }
}

exports.postEditProfile = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.redirect('/login');
    }

    const { name, phone } = req.body;
    const profilePicture = req.file ? req.file.filename : null;

    // Validate file type if uploaded
    if (req.file) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.redirect('/edit-profile?error=invalid_file_type');
      }
    }

    const updateData = { name, phone };
    if (profilePicture) {
      updateData.profilePicture = profilePicture;
    }

    await User.findByIdAndUpdate(userId, updateData, { new: true });
    res.redirect('/profile?success=profile_updated');
  } catch (err) {
    console.error('Update profile error:', err);
    res.redirect('/edit-profile');
  }
}


exports.getEditEmail = async (req, res) => {
  res.render('user/edit-email', { currentPage: 'edit-email' });
}

exports.sendOtpForEmail = async (req, res) => {
  const {newEmail}= req.body
  console.log('sendOtpForEmail called with:', newEmail);

  try{
    const existingUser = await User.findOne({email:newEmail})
    if(existingUser){
      return res.render('user/edit-email',{error:"Email already in use", currentPage: 'edit-email'})
    }

    const otp = Math.floor(100000+Math.random()*900000).toString();

    req.session.pendingEmail= newEmail
    req.session.emailOtp= otp

    const transporter = nodemailer.createTransport({
      service:'Gmail',
      auth:{
        user:process.env.EMAIL_USER,
        pass:process.env.EMAIL_PASS

      }
    })

    await transporter.sendMail({
      to:newEmail,
      subject:'verify Your Email',
      html:`<p>Your OTP for updating email is <b>${otp}</b><p>`
    })


    res.redirect('/verify-email')
  }catch(error){
    console.log('Error sending OTP:',error);
    res.status(500).send('something went wrong')
  }
}

exports.postverifyEmail= async(req,res)=>{
  const {otp}= req.body

  if(otp===req.session.emailOtp){
    const userId= req.session.userId

    await User.findByIdAndUpdate(userId,{
      email:req.session.pendingEmail
    })


    req.session.emailOtp= null
    req.session.pendingEmail= null

    res.redirect('/profile')
  }else{
    res.render('user/verify-email',{
      newEmail:req.session.pendingEmail,
      error:'Invalid OTP'
    })
  }
}




exports.getChangePassword=(req,res)=>{
  res.render('user/change-password', { currentPage: 'change-password' })
}
exports.postChangePassword= async(req,res)=>{
  const {currentPassword, newPassword,confirmPassword}= req.body

  try{
    const user= await User.findById(req.session.userId)


    if(!user){
      return res.redirect('/login')
    }
    const isMatch= await bcrypt.compare(currentPassword, user.password)
    if(!isMatch){
      return res.render('user/change-password', { 
        currentPage: 'change-password',
        error: 'Incorrect current password' 
      });
    }

    if(newPassword!== confirmPassword){
      return res.render('user/change-password', { 
        currentPage: 'change-password',
        error: 'New passwords do not match' 
      });
    }



    const hashedPassword= await bcrypt.hash(newPassword,10);
    user.password=hashedPassword
    await user.save()

    res.redirect('/profile?success=password_changed');
  }catch(error){
    console.log('Error changing password',error);
    res.render('user/change-password', { 
      currentPage: 'change-password',
      error: 'An error occurred while changing password. Please try again.' 
    });
  }
}

exports.getAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ user: req.session.userId });
    res.render('user/addresses', { 
      addresses,
      currentPage: 'addresses',
      error: null
    });
  } catch (error) {
    console.error('Error fetching addresses:', error);
    res.render('user/addresses', { 
      addresses: [],
      currentPage: 'addresses',
      error: 'Failed to load addresses'
    });
  }
};

exports.getAddress = (req, res) => {
  res.render('user/add-address', { 
    currentPage: 'add-address',
    error: null,
    formData: {}
  });
};

exports.postAddaddress = async (req, res) => {
  try {
    await Address.create({ ...req.body, user: req.session.userId });
    res.redirect('/addresses');
  } catch (error) {
    console.error('Error adding address:', error);
    res.render('user/add-address', { 
      currentPage: 'add-address',
      error: 'Failed to add address. Please try again.',
      formData: req.body
    });
  }
};

exports.getEditAddresses = async (req, res) => {
  try {
    const address = await Address.findOne({ _id: req.params.id, user: req.session.userId });
    if (!address) return res.redirect('/addresses');
    
    res.render('user/edit-address', { 
      address,
      currentPage: 'edit-address',
      error: null
    });
  } catch (error) {
    console.error('Error fetching address for edit:', error);
    res.redirect('/addresses');
  }
};

exports.postEditAddress = async (req, res) => {
  try {
    await Address.updateOne({ _id: req.params.id, user: req.session.userId }, req.body);
    res.redirect('/addresses');
  } catch (error) {
    console.error('Error updating address:', error);
    res.redirect('/addresses');
  }
};

exports.postDeleteAddress = async (req, res) => {
  try {
    await Address.deleteOne({ _id: req.params.id, user: req.session.userId });
    res.redirect('/addresses');
  } catch (error) {
    console.error('Error deleting address:', error);
    res.redirect('/addresses');
  }
};


exports.setDefaultAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    const addressId = req.params.id;
    await Address.updateMany({ user: userId }, { $set: { isDefault: false } });
    await Address.findByIdAndUpdate(addressId, { isDefault: true });
    res.redirect('/addresses');
  } catch (error) {
    console.error('Error setting default address:', error);
    res.redirect('/addresses?error=Could not update default address');
  }
};


exports.getCartPage = async (req, res) => {
  try {
    const userId = req.session.userId;
    const cartData = await Cart.findOne({ user: userId }).populate({
      path: 'items.product',
      populate: { path: 'category' }
    });
    
    let cartItems = cartData?.items || [];
    let removedItems = [];

    cartItems = cartItems.filter(item => {
      const product = item.product;
      if (!product || product.isBlocked || !product.isListed || product.isDeleted || !product.isActive) {
        removedItems.push(product?.name || 'Unknown Product');
        return false;
      }
      
      if (product.category && product.category.isBlocked) {
        removedItems.push(product.name);
        return false;
      }
      
      return true;
    });

    // Update cart if items were removed
    if (removedItems.length > 0) {
      cartData.items = cartItems;
      await cartData.save();
    }

    const totalPrice = cartItems.reduce((total, item) => {
      return total + item.quantity * item.product.price;
    }, 0);

    res.render('user/cart', {
      user: res.locals.user,
      cartItems,
      totalPrice,
      removedItems
    });
  } catch (err) {
    console.error('Error loading cart:', err);
    res.status(500).send('Server Error');
  }
};
exports.addToCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    const productId = req.params.product || req.params.productId; // support both routes
    const quantity = req.body && req.body.quantity ? parseInt(req.body.quantity) : 1;


    if (!userId) {
      const errorMsg = 'Authentication required';
      return req.headers['content-type'] === 'application/json'
        ? res.status(401).json({ success: false, message: errorMsg })
        : res.redirect('/login');
    }

    const product = await Product.findById(productId).populate('category');

    if (!product || product.isBlocked || !product.isListed || product.isDeleted || !product.isActive) {
      const errorMsg = 'Product not found or unavailable';
      return req.headers['content-type'] === 'application/json'
        ? res.status(404).json({ success: false, message: errorMsg })
        : res.redirect('/wishlist');
    }

    if (product.category?.isBlocked) {
      const errorMsg = 'Product category is currently unavailable';
      return req.headers['content-type'] === 'application/json'
        ? res.status(404).json({ success: false, message: errorMsg })
        : res.redirect('/wishlist');
    }

    if (product.stock < quantity) {
      const errorMsg = `Only ${product.stock} items available in stock`;
      return req.headers['content-type'] === 'application/json'
        ? res.status(400).json({ success: false, message: errorMsg })
        : res.redirect('/wishlist');
    }

    const user = await User.findById(userId);
    const wishlistIndex = user.wishlist.indexOf(productId);
    if (wishlistIndex !== -1) {
      user.wishlist.splice(wishlistIndex, 1);
      await user.save();
    }

   
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const existingItem = cart.items.find(item => item.product.toString() === productId);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ product: productId, quantity });
    }

    await cart.save();

    if (req.headers['content-type'] === 'application/json') {
      return res.status(200).json({ success: true, message: 'Product added to cart successfully', cartItemCount: cart.items.length });
    } else {
      return res.redirect('/cart');
    }
  } catch (err) {
    console.error('Error adding to cart:', err);
    const errorMsg = 'Server Error. Please try again.';
    if (req.headers['content-type'] === 'application/json') {
      return res.status(500).json({ success: false, message: errorMsg });
    } else {
      return res.redirect('/wishlist');
    }
  }
};



exports.getCartCount = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(200).json({ count: 0 });
    }

    const userCart =await Cart.findOne({ user: userId });
    const count = userCart ? userCart.items.length : 0;
    
    res.status(200).json({ count });
  } catch (err) {
    console.error('Error getting cart count:', err);
    res.status(500).json({ count: 0 });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    const productId = req.params.productId;

    const userCart = await Cart.findOne({ user: userId });

    if (!userCart) return res.redirect('/cart');

    userCart.items = userCart.items.filter(item => item.product.toString() !== productId);
    await userCart.save();

    res.redirect('/cart');
  } catch (err) {
    console.error('Error removing from cart:', err);
    res.redirect('/cart');
  }
};

exports.updateCartItemQuantity = async (req, res) => {
  try {
    const userId = req.session.userId;
    const productId = req.params.productId;
    const { quantity } = req.body;

    if (!userId) return res.status(401).json({ message: 'Not logged in' });

    const product = await Product.findById(productId).populate('category');
    if (!product || product.isBlocked || !product.isListed || product.isDeleted || !product.isActive) {
      return res.status(404).json({ message: 'Product is no longer available' });
    }

    if (product.category && product.category.isBlocked) {
      return res.status(404).json({ message: 'Product category is currently unavailable' });
    }

    if (quantity > product.stock) {
      return res.status(400).json({ message: `Only ${product.stock} items available in stock` });
    }

    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart) return res.status(404).json({ message: 'Cart not found' });

    const item = cart.items.find(item => item.product._id.toString() === productId);
    if (!item) return res.status(404).json({ message: 'Item not found in cart' });

    if (quantity < 1) {
      cart.items = cart.items.filter(item => item.product._id.toString() !== productId);
    } else {
      item.quantity = quantity;
    }

    await cart.save();

    const totalPrice = cart.items.reduce((sum, item) => {
      return sum + item.quantity * item.product.price;
    }, 0);

    const itemSubtotal = quantity * product.price;

    res.status(200).json({
      message: 'Quantity updated successfully',
      totalPrice,
      itemSubtotal,
      productId,
      quantity
    });
  } catch (err) {
    console.error('Error updating cart item quantity:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


exports.clearCart = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    cart.items = [];
    await cart.save();

    if (req.headers['content-type'] === 'application/json') {
      return res.status(200).json({ success: true, message: 'Cart cleared successfully' });
    } else {
      return res.redirect('/cart');
    }
  } catch (err) {
    console.error('Error clearing Cart:', err);
    return res.status(500).json({ success: false, message: 'Server Error while clearing cart' });
  }
};

exports.getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).populate({
      path: 'wishlist',
      populate: {
        path: 'category'
      }
    });

    if (!user) {
      return res.render('user/wishlist', { wishlistItems: [] });
    }

    res.render('user/wishlist', {
      wishlistItems: user.wishlist || []
    });
  } catch (err) {
    console.error('Get wishlist error:', err);
    res.render('user/wishlist', { wishlistItems: [] });
  }
};

exports.addToWishlist = async (req, res) => {
  const userId = req.session.userId;
  const productId = req.params.productId;

  try {
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not logged in' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const product = await Product.findById(productId);
    if (!product || product.isBlocked || !product.isListed || product.isDeleted || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product is no longer available' });
    }

    if (!user.wishlist.includes(productId)) {
      user.wishlist.push(productId);
      await user.save();
    }

    res.status(200).json({ success: true, message: 'Added to wishlist' });

  } catch (err) {
    console.error('Wishlist add error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.removeFromWishlist = async (req, res) => {
  try {
    const userId = req.session.userId;
    const productId = req.params.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not logged in' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const initialLength = user.wishlist.length;
    // Remove product from user's wishlist array
    user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
    await user.save();

    // Always return success, even if item was not in wishlist (idempotent)
    res.json({ 
      success: true, 
      message: initialLength === user.wishlist.length 
        ? 'Item was not in wishlist' 
        : 'Removed from wishlist' 
    });
  } catch (err) {
    console.error('Wishlist remove error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Toggle wishlist item (add if not present, remove if present)
exports.toggleWishlist = async (req, res) => {
  try {
    const userId = req.session.userId;
    const productId = req.params.productId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not logged in' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if product exists and is valid
    const product = await Product.findById(productId);
    if (!product || product.isBlocked || !product.isListed || product.isDeleted || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product is no longer available' });
    }

    const isInWishlist = user.wishlist.includes(productId);
    
    if (isInWishlist) {
      // Remove from wishlist
      user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
      await user.save();
      res.json({ 
        success: true, 
        message: 'Removed from wishlist',
        action: 'removed',
        inWishlist: false
      });
    } else {
      // Add to wishlist
      user.wishlist.push(productId);
      await user.save();
      res.json({ 
        success: true, 
        message: 'Added to wishlist',
        action: 'added',
        inWishlist: true
      });
    }
  } catch (err) {
    console.error('Wishlist toggle error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Clear all wishlist items
exports.clearWishlist = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not logged in' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const itemCount = user.wishlist.length;
    user.wishlist = [];
    await user.save();

    res.json({ 
      success: true, 
      message: `Cleared ${itemCount} items from wishlist`,
      clearedCount: itemCount
    });
  } catch (err) {
    console.error('Clear wishlist error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
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

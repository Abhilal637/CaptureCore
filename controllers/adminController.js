const User = require("../models/user");
const Product = require("../models/product");
const bcrypt = require('bcrypt');
const cloudinary = require("../config/cloudinary");
const streamifier = require('streamifier');
const Order=require('../models/order');
const PDFDocument = require('pdfkit'); 


function setNoCache(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

exports.getLogin = (req, res) => {
  setNoCache(res);
  res.render('admin/login', { error: null });
};
exports.postLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user || !user.isAdmin) {
      return res.render('admin/login', { error: 'Access denied: Not an admin' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render('admin/login', { error: 'Invalid email or password' });
    }

    req.session.isAdmin = true;
    req.session.admin = {
      name: user.name,
      email: user.email,
      role: 'admin'
    };

    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('Login error:', err); 
    res.render('admin/login', { error: 'Server error. please try again' });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;

    const query = {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } }
      ]
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);
    setNoCache(res);
    res.render('admin/userslist', {
      users,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      search
    });
  } catch (err) {
    res.status(500).send("Server Error");
  }
};
exports.dashboard = (req, res) => {
  const admin = req.session.admin || { name: 'Admin',role: 'Admin' };
  const  stats={
    totalUsers :75000,
    totalOrders:7500,
    totalSales:7500,
  }
  res.render('admin/dashboard',{admin,stats});
}




exports.postAddProduct = async (req, res) => {
  try {
    const { name, description, price, category } = req.body;
    const uploadImages = [];

    for (const file of req.files) {
      const uploadPromise = new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
          folder: "products",
          resource_type: 'image'
        },
        (error, result) => {
          if (error) return reject(error);
          uploadImages.push(result.secure_url);
          resolve();
        }
      );
      streamifier.createReadStream(file.buffer).pipe(stream);
    });
    await uploadPromise;
  }

  const newProduct = new Product({
    name,
    description,
    price,
    category,
    images: uploadImages,
    isBlocked: false,
    isListed: true,
    isDeleted: false
  });
  await newProduct.save();
  res.redirect('/admin/products');

  } catch (err) {
    console.log('upload error', err);
    res.status(500).send('upload failed');
  }
};

exports.toggleUserBlockStatus = async (req, res) => {
  try {
    console.log('toggleUserBlockStatus called with:', req.params, req.body);
    
    const { id } = req.params;
    const { isBlocked } = req.body;

    console.log('User ID:', id, 'isBlocked:', isBlocked);

    const user = await User.findById(id);
    if (!user) {
      console.log('User not found with ID:', id);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('Found user:', user.name, 'Current isBlocked:', user.isBlocked);

    user.isBlocked = isBlocked;
    await user.save();

    console.log('User saved successfully, new isBlocked:', user.isBlocked);

    if (isBlocked) {
      try {
        const io = req.app.get('io');
        const userSockets = req.app.get('userSockets');
        const userSocketId = userSockets.get(id);
        
        // console.log('Socket.io available:', !!io);
        // console.log('User sockets map:', userSockets);
        // console.log('User socket ID:', userSocketId);
        
        if (userSocketId) {
          io.to(userSocketId).emit('force_logout', {
            message: 'Your account has been blocked by admin'
          });
          console.log(`Force logout sent to user ${id}`);
        } else {
          console.log(`No active socket found for user ${id}`);
        }
      } catch (socketError) {
        console.error('Socket.io error:', socketError);
        
      }
    }

    res.json({ success: true, message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully` });
  } catch (err) {
    console.error('Error toggling user block status:', err);
    res.status(500).json({ error: 'Could not update user status' });
  }
};



exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid', { path: '/' });
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.redirect('/admin/login');
  });
};

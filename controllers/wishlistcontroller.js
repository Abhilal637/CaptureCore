const Wishlist= require('../models/wishlist')
const User= require('../models/user');
const Product = require('../models/product');
const Cart = require('../models/cart');
const { STATUS_CODES, MESSAGES } = require('../utils/constants');

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
      return res.status(STATUS_CODES.UNAUTHORIZED).json({ success: false, message: 'Not logged in' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'User not found' });
    }
    const product = await Product.findById(productId);
    if (!product || product.isBlocked || !product.isListed || product.isDeleted || !product.isActive) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'Product is no longer available' });
    }

    if (!user.wishlist.includes(productId)) {
      user.wishlist.push(productId);
      await user.save();
    }

    res.status(STATUS_CODES.OK).json({ success: true, message: 'Added to wishlist' });

  } catch (err) {
    console.error('Wishlist add error:', err);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Server error' });
  }
};

exports.removeFromWishlist = async (req, res) => {
  try {
    const userId = req.session.userId;
    const productId = req.params.id;

    if (!userId) {
      return res.status(STATUS_CODES.UNAUTHORIZED).json({ success: false, message: 'Not logged in' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'User not found' });
    }

    const initialLength = user.wishlist.length;
    
    user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
    await user.save();

    res.json({ 
      success: true, 
      message: initialLength === user.wishlist.length 
        ? 'Item was not in wishlist' 
        : 'Removed from wishlist' 
    });
  } catch (err) {
    console.error('Wishlist remove error:', err);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Server error' });
  }
};


exports.toggleWishlist = async (req, res) => {
  try {
    const userId = req.session.userId;
    const productId = req.params.productId;

    if (!userId) {
      return res.status(STATUS_CODES.UNAUTHORIZED).json({ success: false, message: 'Not logged in' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'User not found' });
    }

 
    const product = await Product.findById(productId);
    if (!product || product.isBlocked || !product.isListed || product.isDeleted || !product.isActive) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'Product is no longer available' });
    }

    const isInWishlist = user.wishlist.includes(productId);
    
    if (isInWishlist) {
      user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
      await user.save();
      res.json({ 
        success: true, 
        message: 'Removed from wishlist',
        action: 'removed',
        inWishlist: false
      });
    } else {
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
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Server error' });
  }
};


exports.clearWishlist = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(STATUS_CODES.UNAUTHORIZED).json({ success: false, message: 'Not logged in' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'User not found' });
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
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Server error' });
  }
};

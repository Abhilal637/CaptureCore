const Cart = require('../models/cart');
const User= require('../models/user');
const Product = require('../models/product');

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
    const productId = req.params.product || req.params.productId; 
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
    const newQuantity = existingItem.quantity + quantity;
    if (newQuantity > product.stock) {
    return res.status(400).json({
      success: false,
      message: `Only ${product.stock} items available in stock`,
    });
   }
     existingItem.quantity = newQuantity;
  } else {
    if (quantity > product.stock) {
    return res.status(400).json({
      success: false,
      message: `Only ${product.stock} items available in stock`,
    });
  }
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


const User = require("../models/user");
const Product = require("../models/product");
const bcrypt = require('bcrypt');
const cloudinary = require("../config/cloudinary");
const streamifier = require('streamifier');
const Order=require('../models/order');
const PDFDocument = require('pdfkit'); 

const { refundToWallet } = require('../utils/wallet');



exports.listOrder = async (req, res) => {
  try {
    const perPage = 8; 
    const page = parseInt(req.query.page) || 1;

    const search = req.query.search || '';
    const sort = req.query.sort === 'old' ? 1 : -1;

    const matchStage = search ? {
      $or: [
        { orderId: { $regex: search, $options: 'i' } },
        { 'user.name': { $regex: search, $options: 'i' } }
      ]
    } : {};

    // Count total matching orders
    const totalOrdersAgg = await Order.aggregate([
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $match: matchStage },
      { $count: 'count' }
    ]);
    const totalOrders = totalOrdersAgg[0]?.count || 0;
    const totalPages = Math.ceil(totalOrders / perPage);

    // Fetch paginated orders with populate and filtering
    const ordersAgg = await Order.aggregate([
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $match: matchStage },
      { $sort: { createdAt: sort } },
      { $skip: (page - 1) * perPage },
      { $limit: perPage }
    ]);
    
    const orderIds = ordersAgg.map(o => o._id);
    let orders = await Order.find({ _id: { $in: orderIds } })
      .populate('user')
      .populate('items.product')
      .sort({ createdAt: sort });

    orders.forEach(order => {
      order.totalAmount = Array.isArray(order.items)
        ? order.items.reduce((sum, item) => {
            const price = item.product?.price || 0;
            const qty = item.quantity || 1;
            return sum + price * qty;
          }, 0)
        : 0;
    });

    // Status transition map
    const nextStatusMap = {
      'Pending': ['Confirmed'],
      'Confirmed': ['Shipped'],
      'Shipped': ['Out for Delivery'],
      'Out for Delivery': ['Delivered'],
      'Delivered': [],
      'Cancelled': [],
      'Placed': ['Confirmed']
    };

    res.render('admin/order-list', {
      orders,
      totalPages,
      currentPage: page,
      search,
      sort,
      nextStatusMap
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

exports.viewOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user')
      .populate('items.product'); 

    if (!order) return res.status(404).send('Order not found');

    const totalAmount = typeof order.totalAmount === 'number' 
      ? order.totalAmount 
      : order.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

    res.render('admin/orderDetail', { order, totalAmount });
  } catch (err) {
    console.error('Error loading order details:', err);
    res.status(500).send('Server Error');
  }
};
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).send('Order not found');

    const validTransitions = {
      'Placed': 'Confirmed',
      'Confirmed': 'Shipped',
      'Shipped': 'Out for Delivery',
      'Out for Delivery': 'Delivered'
    };

    const currentStatus = order.status;
    const nextValidStatus = validTransitions[currentStatus];

    if (status !== nextValidStatus) {
      return res.status(400).send(`Invalid status transition from ${currentStatus} to ${status}`);
    }

    order.status = status;
    if (status === 'Delivered') {
      order.paymentStatus = 'Paid';
    }
    await order.save();

    res.redirect(`/admin/orders/${order._id}`);
  } catch (err) {
    console.error('Error updating status', err);
    res.status(500).send('Server Error');
  }
};

exports.verifyReturnAndRefund = async (req, res) => {
  const orderId = req.params.orderId;
  const productId = req.params.productId;

  try {
    const order = await Order.findById(orderId).populate('user');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const item = order.items.find(p => p.product.toString() === productId);
    if (!item) return res.status(404).json({ message: 'Product not found in order' });

    if (item.status === 'Returned' || item.returnApproved) {
      return res.status(400).json({ message: 'Already returned' });
    }

    item.status = 'Returned';
    item.returnRequested = false;
    item.returnApproved = true;

       if (order.items.every(i => i.status === 'Returned')) {
      order.status = 'Returned';
    }

    
    await order.save();

   
    const amount = item.price * item.quantity;
    const description = `Refund for returned product: ${item.name || 'Item'}`;
    await refundToWallet(order.user._id, amount, description, order.orderId);

    res.json({ message: 'Return approved and amount refunded to wallet' });

  } catch (error) {
    console.error('Return approval error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

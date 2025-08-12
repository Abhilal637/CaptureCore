
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

    // Allow multiple possible next statuses
    const validTransitions = {
      'Placed': ['Confirmed', 'Cancelled'],
      'Confirmed': ['Shipped', 'Cancelled'],
      'Shipped': ['Out for Delivery'],
      'Out for Delivery': ['Delivered']
    };

    if (
      !validTransitions[order.status] ||
      !validTransitions[order.status].includes(status)
    ) {
      return res
        .status(400)
        .send(`Invalid status transition from ${order.status} to ${status}`);
    }

    order.status = status;

    if (status === 'Delivered') {
      order.paymentStatus = 'Paid';
    } else if (status === 'Cancelled') {
      order.paymentStatus = 'Cancelled';
    }

    await order.save();
    res.redirect(`/admin/orders/${order._id}`);
  } catch (err) {
    console.error('Error updating status', err);
    res.status(500).send('Server Error');
  }
};
exports.verifyReturnAndRefund = async (req, res) => {
    try {
        const { orderId, productId } = req.params;

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).send('Order not found');

        // Find the specific item
        const item = order.items.find(i => i.product.toString() === productId);
        if (!item || item.status !== 'Return Requested') {
            return res.status(400).send('Invalid return request');
        }

        // Mark as Returned
        item.status = 'Returned';

        // If all items are returned, update overall order status
        if (order.items.every(i => i.status === 'Returned')) {
            order.status = 'Returned';
            order.paymentStatus = 'Refunded';
        }

        // Refund just this product
        const refundAmount = item.price * item.quantity;
        if (refundAmount > 0) {
            let wallet = await Wallet.findOne({ userId: order.user });
            if (!wallet) {
                wallet = new Wallet({ userId: order.user, balance: 0, transactions: [] });
            }
            wallet.balance += refundAmount;
            wallet.transactions.push({
                type: 'Credit',
                amount: refundAmount,
                description: `Refund for returned product in order ${order.orderId}`
            });
            await wallet.save();
        }

        await order.save();
        res.redirect(`/admin/orders/${order._id}`);
    } catch (err) {
        console.error('Error verifying return', err);
        res.status(500).send('Server Error');
    }
};

exports.cancelOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) return res.status(404).send('Order not found');

        // Only allow cancel if not shipped or delivered
        if (['Shipped', 'Out for Delivery', 'Delivered'].includes(order.status)) {
            return res.status(400).send('Cannot cancel after shipping');
        }

        order.status = 'Cancelled';
        order.paymentStatus = 'Cancelled';

        // Restock products
        for (let item of order.items) {
            await Product.findByIdAndUpdate(item.product, {
                $inc: { stock: item.quantity }
            });
        }

        await order.save();
        res.redirect('/orders');
    } catch (err) {
        console.error('Error cancelling order', err);
        res.status(500).send('Server Error');
    }
};
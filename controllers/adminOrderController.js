
const User = require("../models/user");
const Product = require("../models/product");
const bcrypt = require('bcrypt');
const cloudinary = require("../config/cloudinary");
const streamifier = require('streamifier');
const Order=require('../models/order');
const PDFDocument = require('pdfkit'); 

const { refundToWallet } = require('../utils/wallet');
const { STATUS_CODES, MESSAGES, ORDER_STATUS } = require('../utils/constants');



exports.listOrder = async (req, res) => {
  try {
    const perPage = 8; 
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const sort = req.query.sort || 'date';
    const order = req.query.order || 'desc';

    const matchStage = search ? {
      $or: [
        { orderId: { $regex: search, $options: 'i' } },
        { 'user.name': { $regex: search, $options: 'i' } }
      ]
    } : {};

    // Define sort options
    let sortStage = {};
    if (sort === 'date') {
      sortStage = { createdAt: order === 'asc' ? 1 : -1 };
    } else if (sort === 'amount') {
      sortStage = { total: order === 'asc' ? 1 : -1 };
    } else if (sort === 'status') {
      sortStage = { status: 1 };
    }

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
      { $sort: sortStage },
      { $skip: (page - 1) * perPage },
      { $limit: perPage }
    ]);
    
    const orderIds = ordersAgg.map(o => o._id);
    let orders = await Order.find({ _id: { $in: orderIds } })
      .populate('user')
      .populate('items.product');

    // Apply sorting to the final result
    if (sort === 'date') {
      orders.sort((a, b) => order === 'asc' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt);
    } else if (sort === 'amount') {
      orders.sort((a, b) => {
        const aTotal = a.total || 0;
        const bTotal = b.total || 0;
        return order === 'asc' ? aTotal - bTotal : bTotal - aTotal;
      });
    } else if (sort === 'status') {
      orders.sort((a, b) => a.status.localeCompare(b.status));
    }

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
      order,
      nextStatusMap
    });
  } catch (err) {
    console.error(err);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send(MESSAGES.ERROR.SERVER_ERROR);
  }
};

exports.viewOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user')
      .populate('items.product'); 

    if (!order) return res.status(STATUS_CODES.NOT_FOUND).send(MESSAGES.ERROR.ORDER_NOT_FOUND);

    const totalAmount = typeof order.totalAmount === 'number' 
      ? order.totalAmount 
      : order.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

    res.render('admin/orderDetail', { order, totalAmount });
  } catch (err) {
    console.error('Error loading order details:', err);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send(MESSAGES.ERROR.SERVER_ERROR);
  }
};
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(STATUS_CODES.NOT_FOUND).send(MESSAGES.ERROR.ORDER_NOT_FOUND);

    const validTransitions = {
      'Placed': ['Confirmed', 'Cancelled'],
      'Confirmed': ['Shipped', 'Cancelled'],
      'Shipped': ['Out for Delivery'],
      'Out for Delivery': ['Delivered']
    };

    if (!validTransitions[order.status] || !validTransitions[order.status].includes(status)) {
      return res.status(STATUS_CODES.BAD_REQUEST).send(`Invalid status transition from ${order.status} to ${status}`);
    }

    order.status = status;

    if (status === 'Delivered') {
      order.paymentStatus = 'Paid';
     
      order.items.forEach(item => {
        if (item.status !== 'Cancelled') item.status = 'Delivered';
      });
    } else if (status === 'Cancelled') {
      order.paymentStatus = 'Pending'; 
      order.items.forEach(item => { item.status = 'Cancelled'; });
    }

    await order.save();
    res.redirect(`/admin/orders/${order._id}`);
  } catch (err) {
    console.error('Error updating status', err);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send(MESSAGES.ERROR.SERVER_ERROR);
  }
};
exports.verifyReturnAndRefund = async (req, res) => {
    try {
        const { orderId, productId } = req.params;

        const order = await Order.findById(orderId);
        if (!order) return res.status(STATUS_CODES.NOT_FOUND).send(MESSAGES.ERROR.ORDER_NOT_FOUND);

        const item = order.items.find(i => i.product.toString() === productId);
        if (!item || item.status !== 'Return Requested') {
            return res.status(STATUS_CODES.BAD_REQUEST).send(MESSAGES.ERROR.INVALID_RETURN_REQUEST);
        }

        
        item.status = 'Returned';
        item.returnApproved = true;
        item.returnRequested = false;
        item.isReturned = true;

        
        try {
          const product = await Product.findById(productId);
          if (product) {
            product.stock += (item.quantity || 1);
            await product.save();
          }
        } catch (stockErr) {
          console.error('Stock restore failed:', stockErr);
        }

      
        const refundAmount = (item.price || 0) * (item.quantity || 1);
        if (refundAmount > 0) {
            try {
                await refundToWallet(order.user, refundAmount, `Refund for returned product in order ${order.orderId}`, order.orderId);
            } catch (walletErr) {
                console.error('Wallet refund error:', walletErr);
            }
        }

        
        if (order.items.every(i => i.status === 'Returned')) {
            order.status = 'Returned';
            
        }

        await order.save();

        
        if (req.is('application/json') || req.xhr || (req.headers.accept || '').includes('application/json')) {
          return res.status(200).json({ success: true, message: 'Return approved and amount refunded to wallet.' });
        }
        res.redirect(`/admin/orders/${order._id}`);
    } catch (err) {
        console.error('Error verifying return', err);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send(MESSAGES.ERROR.SERVER_ERROR);
    }
};

exports.cancelOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) return res.status(STATUS_CODES.NOT_FOUND).send(MESSAGES.ERROR.ORDER_NOT_FOUND);

        
        if (['Shipped', 'Out for Delivery', 'Delivered'].includes(order.status)) {
            return res.status(STATUS_CODES.BAD_REQUEST).send(MESSAGES.ERROR.CANCEL_AFTER_SHIPPING);
        }

        order.status = 'Cancelled';
        order.paymentStatus = 'Cancelled';

        
        for (const item of order.items) {
            if (item.status !== 'Cancelled') {
                const product = await Product.findById(item.product);
                if (product) {
                    product.stock += item.quantity;
                    await product.save();
                }
                item.status = 'Cancelled';
            }
        }

        await order.save();
        res.redirect(`/admin/orders/${order._id}`);
    } catch (err) {
        console.error('Error cancelling order', err);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send(MESSAGES.ERROR.SERVER_ERROR);
    }
};
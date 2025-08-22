const Cart = require('../models/cart');
const Address = require('../models/address');
const Product = require('../models/product');
const Order = require('../models/order');
const PDFDocument = require('pdfkit');
const { PluginConfigurationInstance } = require('twilio/lib/rest/flexApi/v1/pluginConfiguration');
const { generateOrderId } = require('../utils/otpHelper');
const { STATUS_CODES, MESSAGES, ORDER_STATUS } = require('../utils/constants');


exports.placeOrder = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { addressId, paymentMethod, productId, quantity = 1 } = req.body;

    let totalAmount = 0;
    const orderItems = [];


    if (productId) {
      // const buyNowQuantity = Math.min(5, parseInt(quantity) || 1);
      const product = await Product.findById(productId);

      if (!product || product.isBlocked || !product.isListed || product.isDeleted || !product.isActive || product.stock < quantity) {
        return res.status(STATUS_CODES.BAD_REQUEST).send(MESSAGES.ERROR.STOCK_UNAVAILABLE);
      }

      const itemTotal = quantity * product.price;
      totalAmount = itemTotal;

      orderItems.push({
        product: product._id,
        quantity: quantity,
        price: product.price,
        totalAmount: itemTotal,
        productName: product.name
      });


      if (product.stock < quantity) {
        return res.status(STATUS_CODES.BAD_REQUEST).send(MESSAGES.ERROR.STOCK_UNAVAILABLE);
      }
      product.stock -= quantity;
      await product.save();
    } else {

      const cart = await Cart.findOne({ user: userId }).populate('items.product');
      if (!cart || cart.items.length === 0) {
        return res.redirect('/cart');
      }

      for (const item of cart.items) {
        const product = item.product;

        if (!product || product.isBlocked || !product.isListed || product.isDeleted || !product.isActive) {
          continue;
        }

        
        if (product.stock < item.quantity) {
          req.session.checkoutError = `"${product.name}" has only ${product.stock} in stock. Please adjust quantity.`;
          return res.redirect('/cart');
        }

        const itemTotal = item.quantity * product.price;
        totalAmount += itemTotal;

        orderItems.push({
          product: product._id,
          quantity: item.quantity,
          price: product.price,
          totalAmount: itemTotal,
          productName: product.name
        });


        product.stock -= item.quantity;
        await product.save();
      }


      cart.items = [];
      await cart.save();
    }


    if (orderItems.length === 0) {
      return res.redirect('/cart');
    }

    const address = await Address.findOne({ _id: addressId, user: userId });
    if (!address) return res.status(STATUS_CODES.NOT_FOUND).send(MESSAGES.ERROR.ADDRESS_NOT_FOUND);

    const tax = totalAmount * 0.05;
    const discount = totalAmount > 1000 ? totalAmount * 0.1 : 0;
    const shipping = totalAmount > 500 ? 0 : 50;
    const grandTotal = totalAmount + tax - discount + shipping;


    const order = new Order({
      orderId: generateOrderId(),
      user: userId,
      address: address._id,
      items: orderItems,
      paymentMethod,
      status: 'Placed',
      subtotal: totalAmount,
      tax,
      discount,
      shipping,
      total: grandTotal,
    });

    await order.save();

    res.redirect('/orderSuccess');
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send('Server Error');
  }
};

exports.getOrderSuccess = async (req, res) => {
  try {
    res.render('user/orderSuccess', {
      currentPage: 'orders'
    })
  } catch (error) {
    console.log('Error loading sucess Page', error)
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send('Server Error')
  }
}


exports.getOrders = async (req, res) => {
  try {
    const userId = req.session.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;

    const totalOrders = await Order.countDocuments({ user: userId });
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find({ user: userId })
      .populate('items.product')
      .populate('address')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.render('user/orders', {
      orders,
      currentPage: 'orders',
      pagination: {
        currentPage: page,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error loading orders:', error);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send('Server Error');
  }
};



exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.session.userId;

    const order = await Order.findOne({ orderId, user: userId });

    if (!order) {
      return res.status(STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.status === 'Delivered') {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: 'Delivered orders cannot be cancelled'
      });
    }

    if (order.status === 'Cancelled') {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: 'Order is already cancelled'
      });
    }

    if (order.status === 'Return Requested' || order.status === 'Returned') {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: 'Returned orders cannot be cancelled'
      });
    }

    order.status = 'Cancelled';
    order.cancelReason = reason || '';
    order.paymentStatus = 'Cancelled';

    for (const item of order.items) {
      if (!item.isCancelled || item.status !== 'Cancelled') {
        item.isCancelled = true;
        item.status = 'Cancelled';

        const product = await Product.findById(item.product);
        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
      }
    }

    await order.save();

    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } catch (err) {
    console.error('Error cancelling order:', err);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Server error'
    });
  }
};



exports.cancelOrderItem = async (req, res) => {
  try {
    const { orderId, productId, reason } = req.body;
    const userId = req.session.userId;

    const order = await Order.findOne({ orderId, user: userId });

    if (!order) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'Order not found' });
    }

    if (order.status === 'Delivered') {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Delivered orders cannot be cancelled' });
    }

    const item = order.items.find(i => i.product.toString() === productId);
    if (!item) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Item not found in order' });
    }

    if (item.isCancelled || item.status === 'Cancelled') {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Item is already cancelled' });
    }

    if (item.isReturned || item.status === 'Returned' || item.status === 'Return Requested') {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Returned items cannot be cancelled' });
    }

    item.isCancelled = true;
    item.status = 'Cancelled';
    item.cancelReason = reason || '';

    const product = await Product.findById(productId);
    if (product) {
      product.stock += item.quantity;
      await product.save();
    }

    
    const activeItems = order.items.filter(i => !(i.isCancelled || i.status === 'Cancelled' || i.isReturned || i.status === 'Returned'));
    const newSubtotal = activeItems.reduce((sum, i) => sum + ((i.price || 0) * (i.quantity || 0)), 0);
    const newTax = newSubtotal * 0.05;
    const newDiscount = newSubtotal > 1000 ? newSubtotal * 0.1 : 0;
    const newShipping = newSubtotal > 500 ? 0 : (newSubtotal > 0 ? 50 : 0);
    const newTotal = newSubtotal + newTax - newDiscount + newShipping;

    order.subtotal = +newSubtotal.toFixed(2);
    order.tax = +newTax.toFixed(2);
    order.discount = +newDiscount.toFixed(2);
    order.shipping = +newShipping.toFixed(2);
    order.total = +newTotal.toFixed(2);

    const allItemsCancelled = order.items.every(i => i.isCancelled || i.status === 'Cancelled');
    if (allItemsCancelled) {
      order.status = 'Cancelled';
      order.cancelReason = 'All items cancelled';
    }

    await order.save();

    res.json({
      success: true,
      message: allItemsCancelled ? 'Item cancelled, order fully cancelled' : 'Item cancelled successfully',
      totals: {
        subtotal: order.subtotal,
        tax: order.tax,
        discount: order.discount,
        shipping: order.shipping,
        total: order.total
      }
    });

  } catch (err) {
    console.error('Error cancelling item in order:', err);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Server error' });
  }
};


exports.getOrderDetails = async (req, res) => {
  try {
    const userId = req.session.userId;
    const orderId = req.params.id;

    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate('items.product')
      .populate('address');

    if (!order) {
      return res.status(STATUS_CODES.NOT_FOUND).render('user/orderNotFound', { currentPage: 'orders' });
    }

    res.render('user/orderDetails', {
      order,
      currentPage: 'orders'
    });
  } catch (err) {
    console.error('Error loading order details:', err);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send('Server Error');
  }
};


exports.downloadInvoice = async (req, res) => {
  const order = await Order.findOne({ orderId: req.params.orderId })
    .populate('items.product')
    .populate('address');

  if (!order || order.user.toString() !== req.session.userId) {
    return res.status(STATUS_CODES.NOT_FOUND).send('Invoice not found');
  }

  const doc = new PDFDocument({
    margin: 50,
    size: 'A4'
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
  doc.pipe(res);

  const formatCurrency = (amount) => `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  doc
    .fontSize(24)
    .font('Helvetica-Bold')
    .text('CaptureCore', 50, 50);

  doc
    .fontSize(10)
    .font('Helvetica')
    .text('123 Camera Street, Tech City, India', 50, 80)
    .text('Email: support@capturecore.com | Phone: +91-9876543210', 50, 95)
    .text('GST: 07AABCU9603R1ZX | PAN: AABCU9603R', 50, 110);

  // Title bar
  doc
    .rect(50, 120, 500, 28)
    .fill('#f3f4f6')
    .stroke()
    .fillColor('#111827')
    .fontSize(18)
    .font('Helvetica-Bold')
    .text('INVOICE', 60, 126, { align: 'left' })
    .fillColor('#000');

  const startY = 160;

  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('Invoice Details:', 50, startY)
    .font('Helvetica')
    .fontSize(10)
    .text(`Invoice No: ${order.orderId}`, 50, startY + 20)
    .text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 50, startY + 35)
    .text(`Order Status: ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}`, 50, startY + 50)
    .text(`Payment Method: ${order.paymentMethod.toUpperCase()}`, 50, startY + 65);

  const address = order.address;
  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('Billing Address:', 300, startY)
    .font('Helvetica')
    .fontSize(10)
    .text(`${address?.fullName || 'N/A'}`, 300, startY + 20)
    .text(`${address?.addressLine || 'N/A'}`, 300, startY + 35, { width: 250 })
    .text(`${address?.city || 'N/A'}, ${address?.state || 'N/A'}`, 300, startY + 50)
    .text(`Pin: ${address?.pincode || 'N/A'}`, 300, startY + 65)
    .text(`Phone: ${address?.phone || 'N/A'}`, 300, startY + 80);

  doc.y = startY + 110;

  const tableTop = doc.y;

  doc
    .moveTo(50, tableTop)
    .lineTo(550, tableTop)
    .stroke();

  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('Product', 50, tableTop + 10, { width: 250 })
    .text('Price', 300, tableTop + 10, { width: 80, align: 'center' })
    .text('Qty', 380, tableTop + 10, { width: 50, align: 'center' })
    .text('Total', 430, tableTop + 10, { width: 120, align: 'right' });

  doc
    .moveTo(50, tableTop + 30)
    .lineTo(550, tableTop + 30)
    .stroke();

  let currentY = tableTop + 40;
  doc.font('Helvetica').fontSize(10);

  order.items.forEach((item, index) => {
    doc
      .text(item.product?.name || item.productName || 'Unknown Product', 50, currentY, { width: 250 })
      .text(formatCurrency(item.price), 300, currentY, { width: 80, align: 'center' })
      .text(item.quantity.toString(), 380, currentY, { width: 50, align: 'center' })
      .text(formatCurrency(item.total || item.price * item.quantity), 430, currentY, { width: 120, align: 'right' });

    currentY += 20;
  });

  doc
    .moveTo(50, currentY)
    .lineTo(550, currentY)
    .stroke();

  const totalsY = currentY + 20;
  const subtotal = order.items.reduce((sum, item) => sum + (item.total || item.price * item.quantity), 0);
  const shipping = 0;
  const total = order.total || subtotal;

  doc
    .fontSize(11)
    .font('Helvetica')
    .text('Subtotal:', 430, totalsY, { width: 70, align: 'left' })
    .text(formatCurrency(subtotal), 500, totalsY, { width: 50, align: 'right' })
    .text('Shipping:', 430, totalsY + 20, { width: 70, align: 'left' })
    .text(formatCurrency(shipping), 500, totalsY + 20, { width: 50, align: 'right' });

  doc
    .moveTo(430, totalsY + 35)
    .lineTo(550, totalsY + 35)
    .stroke();

  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('Total:', 430, totalsY + 45, { width: 70, align: 'left' })
    .text(formatCurrency(total), 500, totalsY + 45, { width: 50, align: 'right' });

  doc
    .moveTo(430, totalsY + 65)
    .lineTo(550, totalsY + 65)
    .stroke();

  const footerY = totalsY + 90;

  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('Thank you for choosing CaptureCore!', 50, footerY, { align: 'center', width: 500 });

  doc
    .fontSize(10)
    .font('Helvetica')
    .text('This is a computer-generated invoice and does not require a physical signature.', 50, footerY + 25, { align: 'center', width: 500 })
    .text('For any queries, please contact us at support@capturecore.com or call +91-9876543210', 50, footerY + 40, { align: 'center', width: 500 });

  doc
    .fontSize(8)
    .text('Terms & Conditions: All sales are final. Returns accepted within 30 days of purchase with original packaging.', 50, footerY + 65, { align: 'center', width: 500 });

  doc.end();
};
exports.searchOrders = async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.session.userId;

    if (!query || query.trim() === '') {
      return res.redirect('/orders');
    }


    let allOrders = await Order.find({ user: userId })
      .populate('items.product')
      .populate('address')
      .sort({ createdAt: -1 });

    const filteredOrders = allOrders.filter(order => {
      const matchOrderId = order.orderId.toLowerCase().includes(query.toLowerCase());
      const matchProductName = order.items.some(item =>
        item.product?.name?.toLowerCase().includes(query.toLowerCase())
      );
      return matchOrderId || matchProductName;
    });

    res.render('user/orders', {
      orders: filteredOrders,
      currentPage: 'orders',
      pagination: null,
      query: query
    });
  } catch (error) {
    console.log('Error searching orders:', error);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send('Server Error');
  }
};

exports.returnOrderItem = async (req, res) => {
  try {
    const { orderId, productId, reason } = req.body;
    const userId = req.session.userId;

    const order = await Order.findOne({ orderId, user: userId });
    if (!order) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ 
        success: false, 
        message: MESSAGES.ERROR.ORDER_NOT_FOUND 
      });
    }

    const item = order.items.find(i => i.product.toString() === productId);
    if (!item) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ 
        success: false, 
        message: MESSAGES.ERROR.PRODUCT_NOT_FOUND 
      });
    }

    if (item.status === ORDER_STATUS.RETURNED || item.status === ORDER_STATUS.RETURN_REQUESTED) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        message: MESSAGES.ERROR.ITEM_ALREADY_RETURNED 
      });
    }

    
    item.returnReason = reason || '';
    item.status = ORDER_STATUS.RETURN_REQUESTED;
    item.returnRequested = true;
    
   
    if (order.status !== ORDER_STATUS.RETURN_REQUESTED) {
      order.status = ORDER_STATUS.RETURN_REQUESTED;
    }
    
    await order.save();

    res.status(STATUS_CODES.OK).json({ 
      success: true, 
      message: MESSAGES.SUCCESS.RETURN_REQUESTED 
    });
  } catch (error) {
    console.error('Error in returnOrderItem:', error);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
      success: false, 
      message: MESSAGES.ERROR.SERVER_ERROR 
    });
  }
};

exports.returnEntireOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const userId = req.session.userId;

    const order = await Order.findOne({ orderId, user: userId });

    if (!order) {
      return res.status(STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: MESSAGES.ERROR.ORDER_NOT_FOUND
      });
    }

    if (order.status !== ORDER_STATUS.DELIVERED) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ERROR.ORDER_NOT_ELIGIBLE_FOR_RETURN
      });
    }

  
    order.status = ORDER_STATUS.RETURN_REQUESTED;
    order.returnReason = reason;
    order.returnDate = new Date();

    
    for (let item of order.items) {
      item.status = ORDER_STATUS.RETURN_REQUESTED;
      item.returnRequested = true;
      item.returnReason = reason;
    }

    await order.save();

    res.status(STATUS_CODES.OK).json({
      success: true,
      message: MESSAGES.SUCCESS.RETURN_REQUESTED
    });
  } catch (err) {
    console.error('Return error:', err);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.ERROR.SERVER_ERROR
    });
  }
};
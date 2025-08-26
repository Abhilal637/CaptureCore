const Cart = require('../models/cart');
const Address = require('../models/address');
const Product = require('../models/product');
const Order = require('../models/order');
const PDFDocument = require('pdfkit');
const { PluginConfigurationInstance } = require('twilio/lib/rest/flexApi/v1/pluginConfiguration');
const { generateOrderId } = require('../utils/otpHelper');
const { STATUS_CODES, MESSAGES, ORDER_STATUS } = require('../utils/constants');
const razorpay= require('../config/razorpay');
const { concurrency } = require('sharp');
const crypto= require('crypto')
const { refundToWallet } = require('../utils/wallet');


exports.placeOrder = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { addressId, paymentMethod, productId, quantity = 1 } = req.body;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    let totalAmount = 0;
    const orderItems = [];


    if (productId) {
     
      const buyNowQuantity = Math.min(5, parseInt(quantity) || 1);
      const product = await Product.findById(productId);

      if (!product || product.isBlocked || !product.isListed || product.isDeleted || !product.isActive || product.stock < buyNowQuantity) {
        return res.status(STATUS_CODES.BAD_REQUEST).send(MESSAGES.ERROR.STOCK_UNAVAILABLE);
      }
      
  
      if (parseInt(quantity) > 5) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Buy Now limit exceeded. You can only buy up to 5 items at once. For larger quantities, please add to cart.'
        });
      }

      const itemTotal = buyNowQuantity * product.price;
      totalAmount = itemTotal;

      orderItems.push({
        product: product._id,
        quantity: buyNowQuantity,
        price: product.price,
        totalAmount: itemTotal,
        productName: product.name
      });


      if (product.stock < buyNowQuantity) {
        return res.status(STATUS_CODES.BAD_REQUEST).send(MESSAGES.ERROR.STOCK_UNAVAILABLE);
      }
      product.stock -= buyNowQuantity;
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


    const isRazorpay = String(paymentMethod).toLowerCase() === 'razorpay';

    const order = new Order({
      orderId: generateOrderId(),
      user: userId,
      address: address._id,
      items: orderItems,
      paymentMethod,
      paymentStatus: isRazorpay ? 'Paid' : 'Pending',
      razorpayOrderId: isRazorpay ? (razorpay_order_id || '') : undefined,
      razorpayPaymentId: isRazorpay ? (razorpay_payment_id || '') : undefined,
      razorpaySignature: isRazorpay ? (razorpay_signature || '') : undefined,
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


exports.createRazorpayOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    const parsedAmount = Number(amount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ sucess: false, success: false, message: 'Invalid amount' });
    }


    const MAX_RZP_AMOUNT = 1500000; // INR
    if (parsedAmount > MAX_RZP_AMOUNT) {
      return res.status(400).json({
        sucess: false,
        success: false,
        message: `Amount exceeds Razorpay maximum per transaction of Rs. ${MAX_RZP_AMOUNT.toLocaleString('en-IN')}.`
      });
    }

    const amountPaise = Math.round(parsedAmount * 100);

    const options = {
      amount: amountPaise,
      currency: 'INR',
      receipt: 'order_rcptid_' + Date.now(),
    };
    const order = await razorpay.orders.create(options);

    res.json({
      sucess: true,
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Razorpay order creation error:', error && (error.error || error.message || error));
    res.status(500).json({
      sucess: false,
      success: false,
      message: (error && error.error && error.error.description) || error.message || 'Payment initiation failed',
    });
  }
};




exports.verifyRazorPayment = async(req,res)=>{
  try{
    const {razorpay_order_id, razorpay_payment_id, razorpay_signature}= req.body

    const body = razorpay_order_id + "|" + razorpay_payment_id


    const expectedSignature = crypto
    .createHmac("sha256",process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex')

    if(expectedSignature === razorpay_signature){
      return res.json({sucess: true , message :"Payment Verified Sucessfully"})
    }else{
      return res.status(400).json({sucess:false , message:"Payment verification failed"})
    }


  }catch(error){
    console.error('RazorPay  Verification Error:',error)
    res.status(500).json({sucess:false , message:"Server Error"})
  }
}


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

    // Determine refund before zeroing totals
    let refundAmount = 0;
    if (order.paymentMethod === 'Razorpay' && order.paymentStatus === 'Paid') {
      refundAmount = order.total || 0;
    }

    order.status = 'Cancelled';
    order.cancelReason = reason || '';
    order.paymentStatus = 'Cancelled';
    // Keep financial totals intact for record-keeping and transparency

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

    // Refund to wallet if applicable
    if (refundAmount > 0) {
      try {
        await refundToWallet(order.user, refundAmount, `Refund for cancelled order ${order.orderId}`, order.orderId);
      } catch (walletErr) {
        console.error('Wallet refund error (full order cancel):', walletErr);
      }
    }

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

    
    // Calculate refund for this item if Razorpay paid
    let refundAmount = 0;
    if (order.paymentMethod === 'Razorpay' && order.paymentStatus === 'Paid') {
      if (typeof item.totalAmount === 'number' && item.totalAmount > 0) {
        refundAmount = item.totalAmount;
      } else {
        const baseAmount = (item.price || 0) * (item.quantity || 1);
        let proportionOfSubtotal = 1;
        if (order.subtotal && order.subtotal > 0 && baseAmount > 0) {
          proportionOfSubtotal = baseAmount / order.subtotal;
        }
        const discountShare = (order.discount || 0) * proportionOfSubtotal;
        const taxShare = (order.tax || 0) * proportionOfSubtotal;
        refundAmount = Math.max(0, +(baseAmount - discountShare + taxShare).toFixed(2));
      }
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

    // Refund to wallet for cancelled item
    if (refundAmount > 0) {
      try {
        await refundToWallet(order.user, refundAmount, `Refund for cancelled item in order ${order.orderId}`, order.orderId);
      } catch (walletErr) {
        console.error('Wallet refund error (item cancel):', walletErr);
      }
    }

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

  const formatCurrency = (amount) => `Rs. ${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  // Calculate totals for invoice
  const cancelledItems = order.items.filter(item => item.status === 'Cancelled' || item.isCancelled);
  const activeItems = order.items.filter(item => item.status !== 'Cancelled' && !item.isCancelled);
  
  const totalCancelledAmount = cancelledItems.reduce((sum, item) => {
    const itemPrice = item.product?.price || item.price || 0;
    const itemQty = item.quantity || 1;
    return sum + (itemPrice * itemQty);
  }, 0);

  // Calculate original subtotal (including all products)
  const originalSubtotal = order.subtotal + totalCancelledAmount;

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

  // Show cancellation reason if order is cancelled
  if (order.status === 'Cancelled' && order.cancelReason) {
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#dc2626')
      .text(`Cancellation Reason: ${order.cancelReason}`, 50, startY + 80)
      .fillColor('#000');
  }

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

  // Adjust Y position based on whether cancellation reason was shown
  const adjustedStartY = order.status === 'Cancelled' && order.cancelReason ? startY + 100 : startY + 110;
  doc.y = adjustedStartY;

  const tableTop = doc.y;

  doc
    .moveTo(50, tableTop)
    .lineTo(550, tableTop)
    .stroke();

  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('Product', 50, tableTop + 10, { width: 200 })
    .text('Price', 250, tableTop + 10, { width: 80, align: 'center' })
    .text('Qty', 330, tableTop + 10, { width: 50, align: 'center' })
    .text('Status', 380, tableTop + 10, { width: 80, align: 'center' })
    .text('Total', 460, tableTop + 10, { width: 90, align: 'right' });

  doc
    .moveTo(50, tableTop + 30)
    .lineTo(550, tableTop + 30)
    .stroke();

  let currentY = tableTop + 40;
  doc.font('Helvetica').fontSize(10);

  order.items.forEach((item, index) => {
    const itemName = item.product?.name || item.productName || 'Unknown Product';
    const itemPrice = item.product?.price || item.price || 0;
    const itemQty = item.quantity || 1;
    const itemTotal = item.total || (itemPrice * itemQty);
    const itemStatus = item.status || 'Placed';
    
    // Set color based on status
    if (itemStatus === 'Cancelled') {
      doc.fillColor('#dc2626'); // Red for cancelled items
    } else {
      doc.fillColor('#000');
    }

    doc
      .text(itemName, 50, currentY, { width: 200 })
      .text(formatCurrency(itemPrice), 250, currentY, { width: 80, align: 'center' })
      .text(itemQty.toString(), 330, currentY, { width: 50, align: 'center' })
      .text(itemStatus, 380, currentY, { width: 80, align: 'center' })
      .text(formatCurrency(itemTotal), 460, currentY, { width: 90, align: 'right' });

    // Show cancellation reason for cancelled items
    if (itemStatus === 'Cancelled' && item.cancelReason) {
      doc
        .fontSize(8)
        .fillColor('#dc2626')
        .text(`Reason: ${item.cancelReason}`, 50, currentY + 15, { width: 400 })
        .fontSize(10);
    }

    currentY += itemStatus === 'Cancelled' && item.cancelReason ? 35 : 20;
    doc.fillColor('#000'); // Reset color
  });

  doc
    .moveTo(50, currentY)
    .lineTo(550, currentY)
    .stroke();

  const totalsY = currentY + 20;

  // Show original subtotal (including all products)
  doc
    .fontSize(11)
    .font('Helvetica')
    .text('Subtotal (All Items):', 350, totalsY, { width: 120, align: 'left' })
    .text(formatCurrency(originalSubtotal), 460, totalsY, { width: 90, align: 'right' });

  // Show tax
  doc
    .text('Tax:', 350, totalsY + 20, { width: 120, align: 'left' })
    .text(formatCurrency(order.tax || 0), 460, totalsY + 20, { width: 90, align: 'right' });

  // Show shipping
  doc
    .text('Shipping:', 350, totalsY + 40, { width: 120, align: 'left' })
    .text(formatCurrency(order.shipping || 0), 460, totalsY + 40, { width: 90, align: 'right' });

  // Show discount
  doc
    .text('Discount:', 350, totalsY + 60, { width: 120, align: 'left' })
    .text(`-${formatCurrency(order.discount || 0)}`, 460, totalsY + 60, { width: 90, align: 'right' });

  // Show cancelled items amount if any
  if (cancelledItems.length > 0) {
    doc
      .fillColor('#dc2626')
      .text('Cancelled Items:', 350, totalsY + 80, { width: 120, align: 'left' })
      .text(`-${formatCurrency(totalCancelledAmount)}`, 460, totalsY + 80, { width: 90, align: 'right' })
      .fillColor('#000');
  }

  doc
    .moveTo(350, totalsY + (cancelledItems.length > 0 ? 95 : 75))
    .lineTo(550, totalsY + (cancelledItems.length > 0 ? 95 : 75))
    .stroke();

  // Show final total
  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('Total:', 350, totalsY + (cancelledItems.length > 0 ? 105 : 85), { width: 120, align: 'left' })
    .text(formatCurrency(order.total || 0), 460, totalsY + (cancelledItems.length > 0 ? 105 : 85), { width: 90, align: 'right' });

  doc
    .moveTo(350, totalsY + (cancelledItems.length > 0 ? 125 : 105))
    .lineTo(550, totalsY + (cancelledItems.length > 0 ? 125 : 105))
    .stroke();

  const footerY = totalsY + (cancelledItems.length > 0 ? 145 : 125);

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
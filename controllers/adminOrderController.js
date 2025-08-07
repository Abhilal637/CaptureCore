
const User = require("../models/user");
const Product = require("../models/product");
const bcrypt = require('bcrypt');
const cloudinary = require("../config/cloudinary");
const streamifier = require('streamifier');
const Order=require('../models/order');
const PDFDocument = require('pdfkit'); 


exports.listOrder = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 5;
  const skip = (page - 1) * limit;

  const search = req.query.search || '';
  const sort = req.query.sort === 'old' ? 1 : -1;

  const query = {
    orderId: { $regex: search, $options: 'i' }
  };

  const orders = await Order.find(query)
    .sort({ createdAt: sort })
    .skip(skip)
    .limit(limit)
    .populate('user')
    .populate('items.product');

  orders.forEach(order => {
    order.totalAmount = Array.isArray(order.items)
      ? order.items.reduce((sum, item) => {
          const price = item.product?.price || 0;
          const qty = item.quantity || 1;
          return sum + price * qty;
        }, 0)
      : 0;
  });

  const count = await Order.countDocuments(query);

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
    page,
    search,
    sort,
    hasMore: skip + orders.length < count,
    nextStatusMap
  });
};


exports.viewOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user')
      .populate('items.product'); 

    if (!order) return res.status(404).send('Order not found');

    // fallback in case totalAmount is undefined
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
    await order.save();

    res.redirect(`/admin/orders/${order._id}`);
  } catch (err) {
    console.error('Error updating status', err);
    res.status(500).send('Server Error');
  }
};




exports.approveReturn = async(req,res)=>{
  try{
    const order= await Order.findById(req.params.id).populate('user')
    const product = order.products.find(p=>p.returnRequested && !p.returnApproved)
    if(!product) return res.redirect(`/admin/orders/${order._id}`)
      product.returnApproved= true
    await order.save()



    const refundAmount = product.product.price*product.quantity
    order.user.wallet+= refundAmount
    await order.user.save()

    res.redirect(`/admin/orders/${order._id}`)
  }catch(err){
    console.error('Error approved return:',err)
    res,status(500).send('Server Error')
  }
}


exports.verifyReturnAndRefund=async(req,res)=>{
  const{id}=req.params
  try{
    const order = await Order.findById(id).populate('user')

    if(!order){
      return res.status(404).send('Order not found')
    }

    if(order.status!=='Delivered'){
      return res.status(400).send('Only deliverd Order can be returned')
    }
    order.status='Returned';
    await order.save()


    const user= order.user;
    user.wallet+=order.totalAmount
    await user.save()


    res.redirec('/admin/orders');
  }catch(error){
    console.log('Error during return verification and refund',error)
    res.status(500).send('Internal server error')
  }
}
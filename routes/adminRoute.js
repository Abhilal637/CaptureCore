const express = require('express');
const router = express.Router();
const { STATUS_CODES, MESSAGES } = require('../utils/constants');

const adminControllers = require('../controllers/adminController');
const categoryControllers = require('../controllers/catergoryController');
const productControllers = require('../controllers/productcontroller');
const adminordercontroller = require('../controllers/adminOrderController');
const adminSessionHandler = require('../middleware/adminSessionHandler');
const Category = require('../models/category');

const {
  adminAuth,
  preventAdminLoginIfLoggedIn,
  noCache,
  checkBlocked
} = require('../middleware/adminauthmiddleware');
const { diskUpload, memoryUpload } = require('../middleware/upload');
const validator = require('../middleware/validate');

router
  .get('/', adminAuth, noCache, adminControllers.dashboard)
  .get('/dashboard', adminAuth, noCache, adminControllers.dashboard);

router
  .route('/login')
  .get(preventAdminLoginIfLoggedIn, noCache, adminControllers.getLogin)
  .post(preventAdminLoginIfLoggedIn, validator('adminLoginRules'), adminControllers.postLogin);

router.get('/logout', adminAuth, adminControllers.logout);

router
  .get('/users', adminAuth, noCache, adminControllers.getUsers)
  .patch('/users/toggle-block/:id', adminAuth, noCache, adminControllers.toggleUserBlockStatus);

router
  .get('/category', adminAuth, noCache, categoryControllers.listCategories)
  .post('/category/add', adminAuth, noCache, validator('addcategoryRules'), categoryControllers.addCategory)
  .post('/category/delete/:id', adminAuth, noCache, categoryControllers.deleteCategory)
  .get('/category/edit/:id', adminAuth, noCache, categoryControllers.editcategory)
  .patch('/category/edit/:id', adminAuth, noCache, validator('editcategoryRules'), categoryControllers.updateCategory)
  .post('/category/edit/:id', adminAuth, noCache, validator('editcategoryRules'), categoryControllers.updateCategory)
  .patch('/category/toggle/:id', adminAuth, noCache, categoryControllers.toggleCategoryStatus);

router
  .get('/products', adminAuth, noCache, productControllers.listProducts)
  .get('/products/add', adminAuth, noCache, async (req, res) => {
    try {
      const categories = await Category.find({
        isDeleted: false,
        active: true
      }).populate('parentCategory', 'name').sort({ name: 1 });
      res.render('admin/addproduct', { categories });
    } catch (err) {
      console.error('Error loading categories:', err);
      res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send('Error loading categories');
    }
  })
  .post(
    '/products/add',
    adminAuth,
    noCache,
    memoryUpload.array('images', 5),
    validator('addproductRules'),
    productControllers.addproduct
  )
  .get('/products/edit/:id', adminAuth, noCache, productControllers.editProduct)
  .post(
    '/products/edit/:id',
    adminAuth,
    noCache,
    memoryUpload.array('images', 3),
    validator('editproductRules'),
    productControllers.updateProduct
  )
  .post('/products/toggle-status/:id', adminAuth, noCache, productControllers.toggleProductStatus);

router
  .get('/orders', adminAuth, noCache, adminordercontroller.listOrder)
  .get('/orders/:id', adminAuth, noCache, adminordercontroller.viewOrderDetails)
  .post('/orders/:id/update-status', adminAuth, noCache, adminordercontroller.updateOrderStatus)
  .post('/orders/:orderId/items/:productId/verify-return', adminAuth, noCache, adminordercontroller.verifyReturnAndRefund);

module.exports = router;

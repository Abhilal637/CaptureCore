const express = require('express');
const router = express.Router();

const adminControllers = require('../controllers/adminController');
const categoryControllers = require('../controllers/catergoryController');
const productControllers = require('../controllers/productcontroller');
const adminordercontroller= require('../controllers/adminOrderController');

const { adminAuth, preventAdminLoginIfLoggedIn, noCache } = require('../middleware/adminauthmiddleware');
const upload = require('../middleware/upload');
const validator = require('../middleware/validate');
const { preventLoginIfLoggedIn } = require('../middleware/userauthmiddleware');

router.get('/', adminAuth, noCache, adminControllers.dashboard);
router.get('/dashboard', adminAuth, noCache, adminControllers.dashboard);

// Login routes with validation
router.get('/login', preventAdminLoginIfLoggedIn, noCache, adminControllers.getLogin);

// Apply validator middleware here for admin login POST
router.post('/login', preventAdminLoginIfLoggedIn, validator('adminLoginRules'), adminControllers.postLogin);

router.get('/logout', adminAuth, adminControllers.logout);  // Make sure logout is protected!

// User management routes
router.get('/users', adminAuth, noCache, adminControllers.getUsers);
router.patch('/users/toggle-block/:id', adminAuth, noCache, adminControllers.toggleUserBlockStatus);

// Category routes with validation on add/edit
router.get('/category', adminAuth, noCache, categoryControllers.listCategories);

router.post('/category/add',
  adminAuth,
  noCache,
  validator('addcategoryRules'), // Validate input before adding
  categoryControllers.addCategory
);

router.get('/category/delete/:id', adminAuth, noCache, categoryControllers.deleteCategory);

router.get('/category/edit/:id', adminAuth, noCache, categoryControllers.editcategory);

router.patch('/category/edit/:id',
  adminAuth,
  noCache,
  validator('editcategoryRules'), // Validate input before editing
  categoryControllers.updateCategory
);

router.patch('/category/toggle/:id', adminAuth, noCache, categoryControllers.toggleCategoryStatus);

// Product routes with validation and file upload
router.get('/products', adminAuth, noCache, productControllers.listProducts);

router.get('/products/add', adminAuth, noCache, (req, res) => {
  res.render('admin/addproduct');
});

router.post(
  '/products/add',
  adminAuth,
  noCache,
  upload.array('images', 5),
  validator('addproductRules'), // Validate new product inputs
  productControllers.addproduct
);

router.get('/products/edit/:id', adminAuth, noCache, productControllers.editProduct);

router.post(
  '/products/edit/:id',
  adminAuth,
  noCache,
  upload.array('images', 3),
  validator('editproductRules'), // Validate edited product inputs
  productControllers.updateProduct
);

router.post('/products/toggle-status/:id', adminAuth, noCache, productControllers.toggleProductStatus);

// Orders routes
router.get('/orders', adminAuth, noCache, adminordercontroller.listOrder);
router.get('/orders/:id', adminAuth, noCache, adminordercontroller.viewOrderDetails);

router.post('/orders/:id/update-status', adminAuth, noCache, adminordercontroller.updateOrderStatus);
router.post('/orders/:orderId/items/:productId/verify-return', adminAuth, noCache, adminordercontroller.verifyReturnAndRefund);


module.exports = router;

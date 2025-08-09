const express = require('express');
const router = express.Router();

const adminControllers = require('../controllers/adminController');
const categoryControllers = require('../controllers/catergoryController');
const productControllers = require('../controllers/productcontroller');
const adminordercontroller= require('../controllers/adminOrderController');

const { adminAuth, preventAdminLoginIfLoggedIn, noCache } = require('../middleware/adminauthmiddleware');
const upload = require('../middleware/upload');
const validator = require('../middleware/validate');

router.get('/', adminAuth, noCache, adminControllers.dashboard);
router.get('/dashboard', adminAuth, noCache, adminControllers.dashboard);

router.get('/login', preventAdminLoginIfLoggedIn, adminControllers.getLogin);
router.post('/login', validator('adminLoginRules'), adminControllers.postLogin);

router.get('/logout', adminControllers.logout);

router.get('/users', adminAuth, noCache, adminControllers.getUsers);
router.patch('/users/toggle-block/:id', adminAuth, noCache, adminControllers.toggleUserBlockStatus);

router.get('/category', adminAuth, noCache, categoryControllers.listCategories);
router.post('/category/add', adminAuth, noCache, validator('addcategoryRules'), categoryControllers.addCategory);
router.get('/category/delete/:id', adminAuth, noCache, categoryControllers.deleteCategory);
router.get('/category/edit/:id', adminAuth, noCache, categoryControllers.editcategory);
router.patch('/category/edit/:id', adminAuth, noCache, validator('editcategoryRules'), categoryControllers.updateCategory);
router.patch('/category/toggle/:id', adminAuth, noCache, categoryControllers.toggleCategoryStatus);

router.get('/products', adminAuth, noCache, productControllers.listProducts);
router.get('/products/add', adminAuth, noCache, (req, res) => {
  res.render('admin/addproduct');
});

router.post(
  '/products/add',
  adminAuth,
  noCache,
  upload.array('images', 5),
  validator('addproductRules'),
  productControllers.addproduct
);

router.get('/products/edit/:id', adminAuth, noCache, productControllers.editProduct);

router.post(
  '/products/edit/:id',
  adminAuth,
  noCache,
  upload.array('images', 3),
  validator('editproductRules'),
  productControllers.updateProduct
);

router.get('/orders', adminAuth, adminordercontroller.listOrder);
router.get('/orders/:id', adminAuth, adminordercontroller.viewOrderDetails);
router.post('/orders/:id/update-status', adminordercontroller.updateOrderStatus);
router.post('/orders/:orderId/items/:productId/verify-return', adminordercontroller.verifyReturnAndRefund);

router.post('/products/toggle-status/:id', adminAuth, noCache, productControllers.toggleProductStatus);

module.exports = router;

const express = require('express');
const router = express.Router();
const adminControllers = require('../controllers/adminController');
const { adminAuth, preventAdminLoginIfLoggedIn, noCache,checkBlocked } = require('../middleware/adminauthmiddleware');
const categorycontrollers = require('../controllers/catergoryController');
const productControllers = require('../controllers/productcontroller');
const upload = require('../middleware/upload');
const validator= require('../middleware/validator')
router.get('/', adminAuth, noCache, adminControllers.dashboard);
router.get('/login', preventAdminLoginIfLoggedIn, adminControllers.getLogin);
router.post('/login',validator('adminLogin') ,adminControllers.postLogin);

router.get('/users', adminAuth, noCache, adminControllers.getUsers);
router.patch('/users/toggle-block/:id', adminAuth, noCache, adminControllers.toggleUserBlockStatus);

router.get('/category', adminAuth, noCache, categorycontrollers.listCategories);
router.post('/category/add', validator("addcategory"),adminAuth, noCache, categorycontrollers.addCategory);
router.get('/category/delete/:id', adminAuth, noCache, categorycontrollers.deleteCategory);
router.get('/category/edit/:id', validator('editcategory'),adminAuth, noCache, categorycontrollers.editcategory);
router.patch('/category/edit/:id', adminAuth, noCache, categorycontrollers.updateCategory);

router.patch('/category/toggle/:id',categorycontrollers.toggleCategoryStatus);

router.get('/products', adminAuth, noCache, productControllers.listProducts);
router.get('/products/add', adminAuth, noCache, (req, res) => {
  res.render('admin/addproduct');
});
router.post('/products/add', adminAuth, noCache, upload.array('images', 5), validator('addproduct'),productControllers.addproduct);
router.get('/products/edit/:id', adminAuth, noCache, productControllers.editProduct);
router.post('/products/edit/:id',adminAuth,upload.array('image',3),validator('editproduct'),productControllers.updateProduct);
router.post('/products/toggle-status/:id', adminAuth, productControllers.toggleProductStatus);

router.get('/dashboard', adminAuth, noCache, adminControllers.dashboard);
router.get('/logout', adminControllers.logout);

module.exports = router;

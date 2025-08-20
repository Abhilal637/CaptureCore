
const Category = require('../models/category');
const { validationResult } = require('express-validator');
const { getDescendantIds, normalizeBool } = require('../utils/categoryHelpers');
const { STATUS_CODES, MESSAGES } = require('../utils/constants');




exports.listCategories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : '';

    const query = { isDeleted: false };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Category.countDocuments(query);

    const categories = await Category.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.render('admin/category', {
      categories,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total,
      limit,
      search
    });
  } catch (err) {
    console.error(err);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send(MESSAGES.ERROR.SERVER_ERROR);
  }
};


exports.addCategory = async (req, res) => {
  try {
    // express-validator result check
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, errors: errors.mapped() });
    }

    const name = req.body.name?.trim();
    const description = req.body.description?.trim() || '';

    
    const existing = await Category.findOne({
      name,
      isDeleted: false
    }).collation({ locale: 'en', strength: 2 });

    if (existing) {
      return res.status(STATUS_CODES.BAD_REQUEST).send('Category name already exists.');
    }

    const newCategory = new Category({
      name,
      description,
      active: true
    });

    await newCategory.save();
    res.redirect('/admin/category');
  } catch (err) {
    console.error(err);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send('Error adding category');
  }
};


exports.deleteCategory = async (req, res) => {
  try {
    const id = req.params.id;

    const cat = await Category.findOne({ _id: id, isDeleted: false });
    if (!cat) {
      if (req.xhr) return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'Category not found' });
      return res.redirect('/admin/category');
    }

    
    const Product = require('../models/product');
    const productCount = await Product.countDocuments({ 
      category: id, 
      isDeleted: false 
    });

    if (productCount > 0) {
      const message = `Cannot delete category. It has ${productCount} product(s) associated with it.`;
      if (req.xhr || req.is('application/json')) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message });
      }
      req.flash?.('error', message);
      return res.redirect('/admin/category');
    }

  
    await Category.findByIdAndUpdate(id, { 
      isDeleted: true, 
      active: false 
    });

    if (req.xhr || req.is('application/json')) return res.status(STATUS_CODES.OK).json({ success: true });
    res.redirect("/admin/category");
  } catch (err) {
    console.error(err);
    if (req.xhr || req.is('application/json')) return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Internal error' });
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send("error deleting category");
  }
};

/** EDIT PAGE */
exports.editcategory = async (req, res) => {
  try {
    const cat = await Category.findById(req.params.id).lean();
    if (!cat) return res.status(STATUS_CODES.NOT_FOUND).send("category not found");

    
    res.render('admin/editcategory', { 
      category: cat
    });
  } catch (err) {
    console.error(err);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send("error loading category");
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, errors: errors.mapped() });
    }

    const categoryId = req.params.id;
    const name = req.body.categoryName?.trim();
    const description = req.body.description?.trim() || '';
    const activeBool = normalizeBool(req.body.active);
    
    const parentCategory = null;

    const cat = await Category.findOne({ _id: categoryId, isDeleted: false });
    if (!cat) return res.status(STATUS_CODES.NOT_FOUND).send('Category not found.');

    if (parentCategory) {
      if (parentCategory.toString() === categoryId.toString()) {
        return res.status(STATUS_CODES.BAD_REQUEST).send("A category cannot be its own parent.");
      }
      const descendants = await getDescendantIds(categoryId);
      if (descendants.map(String).includes(String(parentCategory))) {
        return res.status(STATUS_CODES.BAD_REQUEST).send("Cannot set a descendant as parent.");
      }
      const parent = await Category.findOne({ _id: parentCategory, isDeleted: false });
      if (!parent) return res.status(STATUS_CODES.BAD_REQUEST).send("Invalid parent category.");
    }

    const existing = await Category.findOne({
      _id: { $ne: categoryId },
      name,
      isDeleted: false
    }).collation({ locale: 'en', strength: 2 });

    if (existing) {
      return res.status(STATUS_CODES.BAD_REQUEST).send('Category name already exists under the selected parent.');
    }

    await Category.findByIdAndUpdate(categoryId, {
      name,
      description,
      active: activeBool,
      parentCategory: null
    });

    res.redirect('/admin/category');
  } catch (err) {
    console.error('Error updating category:', err);
    if (err.code === 11000) {
      return res.status(STATUS_CODES.BAD_REQUEST).send('Category name already exists under the selected parent.');
    }
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send("Error updating category: " + err.message);
  }
};

exports.toggleCategoryStatus = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const active = normalizeBool(req.body.active);

    const cat = await Category.findById(categoryId);
    if (!cat || cat.isDeleted) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ message: 'Category not found.' });
    }

    const descendants = await getDescendantIds(categoryId);
    await Category.updateMany(
      { _id: { $in: [categoryId, ...descendants] } },
      { $set: { active } }
    );

      res.status(STATUS_CODES.OK).json({ success: true, message: 'Category status updated successfully.' });
  } catch (err) {
    console.error('Error updating category status:', err);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error.' });
  }
};


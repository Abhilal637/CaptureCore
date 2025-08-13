// controllers/categoryController.js
const Category = require('../models/category');
const { validationResult } = require('express-validator');
const { getDescendantIds, normalizeBool } = require('../utils/categoryHelpers');




exports.listCategories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : '';
    const parentFilter = req.query.parent || '';

    const query = { isDeleted: false };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by parent category
    if (parentFilter === 'top-level') {
      query.parentCategory = null;
    } else if (parentFilter && parentFilter !== 'all') {
      query.parentCategory = parentFilter;
    }

    const total = await Category.countDocuments(query);

    const categories = await Category.find(query)
      .populate('parentCategory', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get all parent categories for filter dropdown
    const allParents = await Category.find({
      parentCategory: null,
      isDeleted: false,
      active: true
    }).sort({ name: 1 }).lean();

    // Get subcategories count for each parent
    const subcategoryCounts = await Category.aggregate([
      { $match: { parentCategory: { $ne: null }, isDeleted: false } },
      { $group: { _id: '$parentCategory', count: { $sum: 1 } } }
    ]);

    const subcategoryMap = {};
    subcategoryCounts.forEach(item => {
      subcategoryMap[item._id.toString()] = item.count;
    });

    // Add subcategory count to parent categories
    allParents.forEach(parent => {
      parent.subcategoryCount = subcategoryMap[parent._id.toString()] || 0;
    });

    res.render('admin/category', {
      categories,
      allParents,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total,
      limit,
      search,
      parentFilter,
      selectedParent: parentFilter
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

/** ADD (supports optional parentCategory) */
exports.addCategory = async (req, res) => {
  try {
    // express-validator result check
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.mapped() });
    }

    const name = req.body.name?.trim();
    const description = req.body.description?.trim() || '';
    const parentCategory =
      req.body.parentCategory && req.body.parentCategory !== '' ? req.body.parentCategory : null;

    if (parentCategory) {
      const parent = await Category.findOne({ _id: parentCategory, isDeleted: false });
      if (!parent) return res.status(400).send("Invalid parent category");
    }

    const existing = await Category.findOne({
      name,
      parentCategory: parentCategory,
      isDeleted: false
    }).collation({ locale: 'en', strength: 2 });

    if (existing) {
      return res.status(400).send('Category already exists under the selected parent.');
    }

    await Category.create({
      name,
      description,
      active: true,
      isDeleted: false,
      parentCategory
    });

    res.redirect('/admin/category');
  } catch (err) {
    console.error('Error adding category:', err);
    if (err.code === 11000) {
      return res.status(400).send('Category already exists under the selected parent.');
    }
    res.status(500).send("Error adding category: " + err.message);
  }
};

/** DELETE (soft delete) + cascade to its descendants */
exports.deleteCategory = async (req, res) => {
  try {
    const id = req.params.id;

    const cat = await Category.findOne({ _id: id, isDeleted: false });
    if (!cat) {
      if (req.xhr) return res.status(404).json({ success: false, message: 'Category not found' });
      return res.redirect('/admin/category');
    }

    const descendants = await getDescendantIds(id);

    await Category.updateMany(
      { _id: { $in: [id, ...descendants] } },
      { $set: { isDeleted: true, active: false } }
    );

    if (req.xhr) return res.status(200).json({ success: true });
    res.redirect("/admin/category");
  } catch (err) {
    console.error(err);
    if (req.xhr) return res.status(500).json({ success: false, message: 'Internal error' });
    res.status(500).send("error deleting category");
  }
};

/** EDIT PAGE */
exports.editcategory = async (req, res) => {
  try {
    const cat = await Category.findById(req.params.id).lean();
    if (!cat) return res.status(404).send("category not found");

    // Get all potential parent categories (excluding self and descendants)
    const descendants = await getDescendantIds(cat._id);
    const parentsForSelect = await Category.find({
      parentCategory: null,
      isDeleted: false,
      _id: { $nin: [cat._id, ...descendants] }
    }).sort({ name: 1 }).lean();

    // Get subcategories of current category
    const subcategories = await Category.find({
      parentCategory: cat._id,
      isDeleted: false
    }).sort({ name: 1 }).lean();

    res.render('admin/editcategory', { 
      category: cat, 
      parentsForSelect,
      subcategories,
      descendants: descendants.map(id => id.toString())
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("error loading category");
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.mapped() });
    }

    const categoryId = req.params.id;
    const name = req.body.categoryName?.trim();
    const description = req.body.description?.trim() || '';
    const activeBool = normalizeBool(req.body.active);
    const parentCategory =
      req.body.parentCategory && req.body.parentCategory !== '' ? req.body.parentCategory : null;

    const cat = await Category.findOne({ _id: categoryId, isDeleted: false });
    if (!cat) return res.status(404).send('Category not found.');

    if (parentCategory) {
      if (parentCategory.toString() === categoryId.toString()) {
        return res.status(400).send("A category cannot be its own parent.");
      }
      const descendants = await getDescendantIds(categoryId);
      if (descendants.map(String).includes(String(parentCategory))) {
        return res.status(400).send("Cannot set a descendant as parent.");
      }
      const parent = await Category.findOne({ _id: parentCategory, isDeleted: false });
      if (!parent) return res.status(400).send("Invalid parent category.");
    }

    const existing = await Category.findOne({
      _id: { $ne: categoryId },
      name,
      parentCategory: parentCategory,
      isDeleted: false
    }).collation({ locale: 'en', strength: 2 });

    if (existing) {
      return res.status(400).send('Category name already exists under the selected parent.');
    }

    await Category.findByIdAndUpdate(categoryId, {
      name,
      description,
      active: activeBool,
      parentCategory
    });

    res.redirect('/admin/category');
  } catch (err) {
    console.error('Error updating category:', err);
    if (err.code === 11000) {
      return res.status(400).send('Category name already exists under the selected parent.');
    }
    res.status(500).send("Error updating category: " + err.message);
  }
};
/** TOGGLE ACTIVE */
exports.toggleCategoryStatus = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const active = normalizeBool(req.body.active);

    const cat = await Category.findById(categoryId);
    if (!cat || cat.isDeleted) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    const descendants = await getDescendantIds(categoryId);
    await Category.updateMany(
      { _id: { $in: [categoryId, ...descendants] } },
      { $set: { active } }
    );

    res.status(200).json({ success: true, message: 'Category status updated successfully.' });
  } catch (err) {
    console.error('Error updating category status:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

/** Get subcategories for a parent category */
exports.getSubcategories = async (req, res) => {
  try {
    const parentId = req.params.parentId;
    
    const subcategories = await Category.find({
      parentCategory: parentId,
      isDeleted: false,
      active: true
    }).sort({ name: 1 }).lean();

    res.json({ success: true, subcategories });
  } catch (err) {
    console.error('Error fetching subcategories:', err);
    res.status(500).json({ success: false, message: 'Error fetching subcategories' });
  }
};

/** Get category hierarchy for navigation */
exports.getCategoryHierarchy = async (req, res) => {
  try {
    const categories = await Category.find({
      isDeleted: false,
      active: true
    }).populate('parentCategory', 'name').lean();

    // Build hierarchy
    const hierarchy = [];
    const categoryMap = {};

    // First pass: create map of all categories
    categories.forEach(cat => {
      categoryMap[cat._id.toString()] = {
        ...cat,
        children: []
      };
    });

    // Second pass: build hierarchy
    categories.forEach(cat => {
      if (cat.parentCategory) {
        const parentId = cat.parentCategory._id.toString();
        if (categoryMap[parentId]) {
          categoryMap[parentId].children.push(categoryMap[cat._id.toString()]);
        }
      } else {
        hierarchy.push(categoryMap[cat._id.toString()]);
      }
    });

    res.json({ success: true, hierarchy });
  } catch (err) {
    console.error('Error fetching category hierarchy:', err);
    res.status(500).json({ success: false, message: 'Error fetching category hierarchy' });
  }
};
